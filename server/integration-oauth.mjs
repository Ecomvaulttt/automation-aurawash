import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const providerSettings = {
  google: {
    label: "Google Workspace",
    clientId: "GOOGLE_CLIENT_ID",
    clientSecret: "GOOGLE_CLIENT_SECRET",
    authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scopes: ["openid", "email", "https://www.googleapis.com/auth/gmail.readonly", "https://www.googleapis.com/auth/gmail.send"],
  },
  microsoft: {
    label: "Microsoft 365",
    clientId: "MICROSOFT_CLIENT_ID",
    clientSecret: "MICROSOFT_CLIENT_SECRET",
    authorizeUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    tokenUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    scopes: ["openid", "email", "offline_access", "User.Read", "Mail.Read", "Mail.Send"],
  },
  slack: {
    label: "Slack",
    clientId: "SLACK_CLIENT_ID",
    clientSecret: "SLACK_CLIENT_SECRET",
    authorizeUrl: "https://slack.com/oauth/v2/authorize",
    tokenUrl: "https://slack.com/api/oauth.v2.access",
    scopes: ["chat:write", "incoming-webhook"],
  },
};

function appUrl() {
  const value = process.env.APP_URL?.trim();
  if (!value) throw new Error("Missing APP_URL");
  return value.replace(/\/$/, "");
}

export function providerConfig(provider) {
  const settings = providerSettings[provider];
  if (!settings) throw new Error("Unsupported provider");
  const clientId = process.env[settings.clientId]?.trim();
  const clientSecret = process.env[settings.clientSecret]?.trim();
  if (!clientId || !clientSecret) throw new Error("Provider not configured");
  return { ...settings, provider, clientId, clientSecret };
}

export function callbackUrl() {
  return `${appUrl()}/api/integrations/callback`;
}

function signingKey() {
  const value = process.env.TOKEN_ENCRYPTION_KEY?.trim();
  if (!value || value.length < 32) throw new Error("Encryption key not configured");
  return createHash("sha256").update(value).digest();
}

export function createOAuthState(payload, now = Date.now()) {
  const body = Buffer.from(JSON.stringify({ ...payload, issuedAt: now, nonce: randomBytes(12).toString("hex") })).toString("base64url");
  const signature = createHmac("sha256", signingKey()).update(body).digest("base64url");
  return `${body}.${signature}`;
}

export function verifyOAuthState(state, now = Date.now()) {
  const [body, signature] = String(state ?? "").split(".");
  if (!body || !signature) throw new Error("Invalid state");
  const expected = createHmac("sha256", signingKey()).update(body).digest();
  const received = Buffer.from(signature, "base64url");
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) throw new Error("Invalid state");
  const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  if (!payload.issuedAt || now - payload.issuedAt > 10 * 60 * 1000 || payload.issuedAt > now + 30_000) throw new Error("Expired state");
  return payload;
}

export function encryptTokenPayload(payload) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", signingKey(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64url"), tag.toString("base64url"), encrypted.toString("base64url")].join(".");
}

export function decryptTokenPayload(value) {
  const [version, ivValue, tagValue, encryptedValue] = String(value).split(".");
  if (version !== "v1" || !ivValue || !tagValue || !encryptedValue) throw new Error("Invalid encrypted payload");
  const decipher = createDecipheriv("aes-256-gcm", signingKey(), Buffer.from(ivValue, "base64url"));
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  return JSON.parse(Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, "base64url")),
    decipher.final(),
  ]).toString("utf8"));
}

export function buildAuthorizationUrl(provider, state) {
  const config = providerConfig(provider);
  const url = new URL(config.authorizeUrl);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", callbackUrl());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", state);
  if (provider === "slack") url.searchParams.set("scope", config.scopes.join(","));
  else url.searchParams.set("scope", config.scopes.join(" "));
  if (provider === "google") {
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("prompt", "consent");
  }
  if (provider === "microsoft") url.searchParams.set("response_mode", "query");
  return url.toString();
}

export async function exchangeAuthorizationCode(provider, code) {
  const config = providerConfig(provider);
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code,
    redirect_uri: callbackUrl(),
    grant_type: "authorization_code",
  });
  const response = await fetch(config.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload || payload.error || payload.ok === false || !payload.access_token) throw new Error("Token exchange failed");
  return { ...payload, stored_at: Date.now() };
}

export async function refreshAuthorizationToken(provider, payload) {
  if (provider === "slack" || !payload?.refresh_token) return payload;
  const config = providerConfig(provider);
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    refresh_token: payload.refresh_token,
    grant_type: "refresh_token",
  });
  if (provider === "microsoft") body.set("scope", config.scopes.join(" "));
  const response = await fetch(config.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const next = await response.json().catch(() => null);
  if (!response.ok || !next?.access_token) throw new Error("Token refresh failed");
  return {
    ...payload,
    ...next,
    refresh_token: next.refresh_token || payload.refresh_token,
    stored_at: Date.now(),
  };
}

export function tokenNeedsRefresh(payload, now = Date.now()) {
  const storedAt = Number(payload?.stored_at || 0);
  const expiresIn = Number(payload?.expires_in || 0) * 1000;
  return Boolean(payload?.refresh_token && expiresIn && (!storedAt || now >= storedAt + expiresIn - 60_000));
}
