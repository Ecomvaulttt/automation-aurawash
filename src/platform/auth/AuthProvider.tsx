import { Session, User } from "@supabase/supabase-js";
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { platformConfig } from "../config";
import { getSupabaseClient } from "../supabase";

type AssuranceLevel = "aal1" | "aal2" | null;

type TotpEnrollment = {
  factorId: string;
  qrCode: string;
  secret: string;
};

type AuthContextValue = {
  mode: "demo" | "production";
  loading: boolean;
  session: Session | null;
  user: User | null;
  assuranceLevel: AssuranceLevel;
  hasVerifiedTotp: boolean;
  enrollment: TotpEnrollment | null;
  error: string;
  signIn(email: string, password: string): Promise<boolean>;
  signInWithGoogle(): Promise<boolean>;
  signOut(): Promise<void>;
  sendPasswordReset(email: string): Promise<boolean>;
  enrollTotp(): Promise<boolean>;
  verifyTotp(code: string): Promise<boolean>;
  refreshSecurityState(): Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function friendlyError(message: string) {
  if (message.toLowerCase().includes("invalid login")) return "E-mailadres of wachtwoord klopt niet.";
  if (message.toLowerCase().includes("factor")) return "De beveiligingscode kon niet worden geverifieerd.";
  return "Dit lukte niet. Probeer het opnieuw of neem contact op met EcomVault support.";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const client = getSupabaseClient();
  const [loading, setLoading] = useState(platformConfig.configured);
  const [session, setSession] = useState<Session | null>(null);
  const [assuranceLevel, setAssuranceLevel] = useState<AssuranceLevel>(platformConfig.configured ? null : "aal2");
  const [hasVerifiedTotp, setHasVerifiedTotp] = useState(false);
  const [enrollment, setEnrollment] = useState<TotpEnrollment | null>(null);
  const [error, setError] = useState("");

  const refreshSecurityState = useCallback(async () => {
    if (!client) return;

    const [{ data: assurance }, { data: factors }] = await Promise.all([
      client.auth.mfa.getAuthenticatorAssuranceLevel(),
      client.auth.mfa.listFactors(),
    ]);
    setAssuranceLevel((assurance?.currentLevel as AssuranceLevel) ?? "aal1");
    setHasVerifiedTotp(Boolean(factors?.totp.some((factor) => factor.status === "verified")));
  }, [client]);

  useEffect(() => {
    if (!client) return;

    let active = true;
    client.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      setSession(data.session);
      if (data.session) await refreshSecurityState();
      setLoading(false);
    });

    const { data: listener } = client.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      setError("");
      if (!nextSession) {
        setAssuranceLevel(null);
        setHasVerifiedTotp(false);
        setEnrollment(null);
        setLoading(false);
      } else {
        setLoading(true);
        window.setTimeout(() => {
          void refreshSecurityState().finally(() => {
            if (active) setLoading(false);
          });
        }, 0);
      }
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [client, refreshSecurityState]);

  const value = useMemo<AuthContextValue>(() => ({
    mode: platformConfig.mode,
    loading,
    session,
    user: session?.user ?? null,
    assuranceLevel,
    hasVerifiedTotp,
    enrollment,
    error,
    async signIn(email, password) {
      if (!client) return true;
      setError("");
      const result = await client.auth.signInWithPassword({ email, password });
      if (result.error) {
        setError(friendlyError(result.error.message));
        return false;
      }
      return true;
    },
    async signInWithGoogle() {
      if (!client) return true;
      setError("");
      const result = await client.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}${window.location.pathname}`,
        },
      });
      if (result.error) {
        setError(friendlyError(result.error.message));
        return false;
      }
      return true;
    },
    async signOut() {
      if (client) await client.auth.signOut();
    },
    async sendPasswordReset(email) {
      if (!client) return true;
      setError("");
      const result = await client.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/`,
      });
      if (result.error) {
        setError(friendlyError(result.error.message));
        return false;
      }
      return true;
    },
    async enrollTotp() {
      if (!client) return true;
      setError("");
      const result = await client.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "EcomVault Finance",
      });
      if (result.error) {
        setError(friendlyError(result.error.message));
        return false;
      }
      setEnrollment({
        factorId: result.data.id,
        qrCode: result.data.totp.qr_code,
        secret: result.data.totp.secret,
      });
      return true;
    },
    async verifyTotp(code) {
      if (!client) return true;
      setError("");
      const verifiedFactor = (await client.auth.mfa.listFactors()).data?.totp.find(
        (factor) => factor.status === "verified",
      );
      const factorId = enrollment?.factorId ?? verifiedFactor?.id;
      if (!factorId) {
        setError("Start eerst de 2FA-configuratie.");
        return false;
      }
      const challenge = await client.auth.mfa.challenge({ factorId });
      if (challenge.error) {
        setError(friendlyError(challenge.error.message));
        return false;
      }
      const verification = await client.auth.mfa.verify({
        factorId,
        challengeId: challenge.data.id,
        code,
      });
      if (verification.error) {
        setError(friendlyError(verification.error.message));
        return false;
      }
      setEnrollment(null);
      await refreshSecurityState();
      return true;
    },
    refreshSecurityState,
  }), [assuranceLevel, client, enrollment, error, hasVerifiedTotp, loading, refreshSecurityState, session]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used within AuthProvider");
  return value;
}
