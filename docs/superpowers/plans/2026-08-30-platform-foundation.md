# EcomVault Platform Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the secure multi-tenant foundation, role-aware login shell, admin center and resumable plug-and-play onboarding for the AuraWash pilot.

**Architecture:** Supabase supplies Auth, TOTP MFA, Postgres and private Storage. Browser data access is tenant-scoped by RLS; service-role operations stay in server-side API handlers. The existing local dashboard remains available as an explicit demo adapter until each financial module is migrated.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind CSS 4, Supabase JS, Postgres RLS, Vitest, Playwright.

---

### Task 1: Platform dependencies and environment contract

**Files:**
- Modify: `package.json`
- Modify: `.env.example`
- Create: `src/platform/config.ts`
- Create: `src/platform/config.test.ts`

- [ ] **Step 1: Add the failing environment tests**

```ts
import { describe, expect, it } from "vitest";
import { readPlatformConfig } from "./config";

describe("readPlatformConfig", () => {
  it("uses demo mode when public Supabase values are absent", () => {
    expect(readPlatformConfig({})).toMatchObject({ mode: "demo", configured: false });
  });

  it("uses production mode only when both public values exist", () => {
    expect(readPlatformConfig({
      VITE_SUPABASE_URL: "https://example.supabase.co",
      VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
    })).toMatchObject({ mode: "production", configured: true });
  });
});
```

- [ ] **Step 2: Install the platform and test dependencies**

Run:

```bash
npm install @supabase/supabase-js zod
npm install -D vitest jsdom @testing-library/react @testing-library/user-event
```

Expected: lockfile updates without audit-blocking install errors.

- [ ] **Step 3: Implement the environment reader**

```ts
export type PlatformConfig = {
  mode: "demo" | "production";
  configured: boolean;
  supabaseUrl: string;
  supabasePublishableKey: string;
};

export function readPlatformConfig(env: Record<string, string | undefined>): PlatformConfig {
  const supabaseUrl = env.VITE_SUPABASE_URL?.trim() ?? "";
  const supabasePublishableKey = env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ?? "";
  const configured = Boolean(supabaseUrl && supabasePublishableKey);
  return { mode: configured ? "production" : "demo", configured, supabaseUrl, supabasePublishableKey };
}
```

- [ ] **Step 4: Add environment names without values**

```text
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
APP_URL=http://localhost:5173
TOKEN_ENCRYPTION_KEY=
```

- [ ] **Step 5: Add and run test scripts**

```json
"test": "vitest",
"test:run": "vitest run"
```

Run: `npm run test:run`

Expected: two configuration tests pass.

### Task 2: Multi-tenant database and RLS

**Files:**
- Create: `supabase/config.toml`
- Create: `supabase/migrations/202608300001_platform_foundation.sql`
- Create: `supabase/seed.sql`
- Create: `supabase/tests/platform_rls.test.sql`

- [ ] **Step 1: Define tenant and role enums**

```sql
create type public.app_role as enum (
  'ecomvault_superadmin', 'owner', 'manager', 'accountant', 'employee'
);
create type public.connector_status as enum (
  'not_configured', 'connecting', 'connected', 'attention', 'expired', 'disabled'
);
```

- [ ] **Step 2: Create foundation tables**

Create UUID-keyed tables for `organizations`, `locations`, `profiles`, `memberships`, `organization_settings`, `onboarding_progress`, `integrations`, `audit_events`, `support_sessions`, `documents`, `invoices`, `employees`, `payroll_documents`, `automation_runs` and `action_items`. Every business table must include `organization_id`, timestamps and `deleted_at`; location-specific rows include `location_id`.

- [ ] **Step 3: Add tenant helper functions**

```sql
create or replace function public.has_org_role(target_org uuid, allowed public.app_role[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.memberships m
    where m.user_id = auth.uid()
      and m.organization_id = target_org
      and m.role = any(allowed)
      and m.status = 'active'
      and m.deleted_at is null
  );
$$;
```

- [ ] **Step 4: Enable RLS and revoke anonymous access**

```sql
alter table public.organizations enable row level security;
revoke all on table public.organizations from anon;
grant select, update on table public.organizations to authenticated;
```

Repeat with operation-specific grants and policies for every exposed table. Financial write policies require `auth.jwt()->>'aal' = 'aal2'` plus owner/manager rights. Employee payroll reads require `employee.user_id = auth.uid()`.

- [ ] **Step 5: Add private document bucket policies**

Create a non-public `documents` bucket. Storage paths begin with organization UUID. Select/insert policies validate the first folder segment against active membership and require AAL2 for payroll and financial documents.

- [ ] **Step 6: Seed the AuraWash template**

Seed one inactive template organization with slug `aurawash-template`, a default location, onboarding defaults, reminder rules and connector placeholders. Do not seed real payroll or invoice data.

- [ ] **Step 7: Add SQL tenant-isolation tests**

Tests must prove that an owner in organization A cannot select, insert or update organization B, a manager cannot access an unassigned location, an accountant cannot mutate memberships and an employee can only read payroll documents linked to their own employee record.

Run: `supabase test db`

Expected: all pgTAP assertions pass once a local Supabase instance is available.

### Task 3: Supabase client, domain types and repositories

**Files:**
- Create: `src/platform/supabase.ts`
- Create: `src/platform/types.ts`
- Create: `src/platform/repositories/workspace-repository.ts`
- Create: `src/platform/repositories/demo-workspace-repository.ts`
- Create: `src/platform/repositories/supabase-workspace-repository.ts`
- Create: `src/platform/repositories/workspace-repository.test.ts`

- [ ] **Step 1: Define stable application contracts**

```ts
export type AppRole = "ecomvault_superadmin" | "owner" | "manager" | "accountant" | "employee";
export type Workspace = { organizationId: string; organizationName: string; locationId: string | null; locationName: string | null; role: AppRole };
export interface WorkspaceRepository {
  listForCurrentUser(): Promise<Workspace[]>;
  getOnboarding(organizationId: string): Promise<OnboardingState>;
  saveOnboarding(organizationId: string, patch: Partial<OnboardingState>): Promise<OnboardingState>;
}
```

- [ ] **Step 2: Create a singleton browser client only when configured**

Use `createClient(url, publishableKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })`. Never import the service-role key in `src/`.

- [ ] **Step 3: Implement demo and Supabase repositories**

The demo repository returns one AuraWash workspace and persists onboarding under a versioned local key. The Supabase repository selects only RLS-protected memberships and uses `upsert` for onboarding progress.

- [ ] **Step 4: Test adapter parity**

Run: `npm run test:run -- src/platform/repositories/workspace-repository.test.ts`

Expected: demo adapter returns the same shape required by the production adapter contract.

### Task 4: Auth provider and mandatory MFA gate

**Files:**
- Create: `src/platform/auth/AuthProvider.tsx`
- Create: `src/platform/auth/SecurityWall.tsx`
- Create: `src/platform/auth/MfaGate.tsx`
- Create: `src/platform/auth/auth.test.tsx`
- Modify: `src/main.tsx`

- [ ] **Step 1: Test demo access and production login states**

Cover loading, signed-out, AAL1-without-factor, AAL1-with-factor, AAL2 and sign-out states. Demo mode must enter the app as an AuraWash owner without pretending that real security is active.

- [ ] **Step 2: Build AuthProvider**

Subscribe to `supabase.auth.onAuthStateChange`, load `getAuthenticatorAssuranceLevel()` and `listFactors()`, and expose `signIn`, `signOut`, `enrollTotp`, `verifyTotp` and `refreshSecurityState`.

- [ ] **Step 3: Build SecurityWall**

Use a focused EcomVault login screen with email, password, forgot-password action and a visible `Demo workspace` badge only in demo mode. Never expose financial content behind a blurred overlay before authentication.

- [ ] **Step 4: Build MFA enrollment and challenge**

Enrollment shows the Supabase QR SVG and accepts a six-digit code. Existing verified factors use challenge + verify. Sensitive roles require AAL2; employee MFA remains configurable per organization.

- [ ] **Step 5: Wrap the app**

```tsx
createRoot(document.getElementById("root")!).render(
  <AuthProvider><App /></AuthProvider>,
);
```

- [ ] **Step 6: Run auth tests**

Run: `npm run test:run -- src/platform/auth/auth.test.tsx`

Expected: all auth and MFA branch tests pass.

### Task 5: Workspace context and role-aware navigation

**Files:**
- Create: `src/platform/workspace/WorkspaceProvider.tsx`
- Create: `src/platform/workspace/permissions.ts`
- Create: `src/platform/workspace/permissions.test.ts`
- Modify: `src/App.tsx`

- [ ] **Step 1: Write permission matrix tests**

```ts
expect(can("accountant", "export_financials")).toBe(true);
expect(can("accountant", "manage_users")).toBe(false);
expect(can("employee", "read_own_payroll")).toBe(true);
expect(can("employee", "read_financial_dashboard")).toBe(false);
```

- [ ] **Step 2: Implement the central matrix**

Export `can(role, permission)` and `navigationFor(role)`. Components consume these helpers; they do not recreate role checks inline.

- [ ] **Step 3: Add workspace selector**

Owners and superadmins can switch location; managers receive only assigned locations. The active workspace persists by organization and user.

- [ ] **Step 4: Filter navigation**

Employees receive a minimal payroll/profile shell. Accountants lose Setup, Automation mutation and user administration. The existing financial tabs remain available for owner and manager according to permission.

- [ ] **Step 5: Run permission tests and build**

Run: `npm run test:run && npm run build`

Expected: tests pass and the standalone demo still builds.

### Task 6: EcomVault admin center

**Files:**
- Create: `src/features/admin/AdminCenter.tsx`
- Create: `src/features/admin/OrganizationList.tsx`
- Create: `src/features/admin/UserAccessTable.tsx`
- Create: `src/features/admin/IntegrationHealthTable.tsx`
- Create: `api/admin/users.mjs`
- Create: `server/supabase-admin.mjs`
- Modify: `server/ai-helper.d.mts`

- [ ] **Step 1: Add authenticated server client helper**

Create a per-request Supabase client using the request bearer token and a separate service-role client. Verify caller membership and permission before any admin operation.

- [ ] **Step 2: Implement invite API**

`POST /api/admin/users` accepts organization, optional location, email and role. It validates owner/superadmin access, calls `inviteUserByEmail`, upserts membership and writes an audit event. Responses never include service keys or raw provider errors.

- [ ] **Step 3: Build organization and account management UI**

Provide organization/location filters, invite form, role selector, active/blocked status and resend/revoke actions. Buttons are permission-aware and every destructive action requires a reason.

- [ ] **Step 4: Add connector and automation health**

Show connector status, last sync, last error code, retry count and `Test`/`Reconnect` actions. Raw tokens are never returned.

- [ ] **Step 5: Test admin authorization**

API tests cover missing token, wrong organization, accountant invite attempt, owner invite and superadmin organization listing.

### Task 7: Plug-and-play onboarding wizard

**Files:**
- Create: `src/features/onboarding/OnboardingWizard.tsx`
- Create: `src/features/onboarding/onboarding-steps.ts`
- Create: `src/features/onboarding/ConnectorStep.tsx`
- Create: `src/features/onboarding/LaunchCheck.tsx`
- Create: `src/features/onboarding/onboarding.test.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Define the ten stored steps**

Each step has `id`, `title`, `permission`, `required`, `validate`, `status` and `target`. Validation is deterministic and independently tested.

- [ ] **Step 2: Build resumable wizard shell**

Show current step, compact progress, save-and-exit, previous/next and blocked reason. Do not use a marketing hero or explanatory feature copy.

- [ ] **Step 3: Build connector states**

Render `not_configured`, `connecting`, `connected`, `attention`, `expired` and `disabled` with one relevant action each: connect, test, reconnect or enable.

- [ ] **Step 4: Build launch check**

Activation requires organization profile, one location, one owner, owner MFA policy, bank import mapping and successful test for each enabled critical connector. Customer auto-mail remains off until explicitly approved.

- [ ] **Step 5: Test resume and activation rules**

Run: `npm run test:run -- src/features/onboarding/onboarding.test.tsx`

Expected: incomplete critical steps block launch and optional integrations can be skipped.

### Task 8: Documentation, visual QA and activation handoff

**Files:**
- Modify: `README.md`
- Modify: `INSTALLATION_STACK.md`
- Create: `docs/AURAWASH_PILOT_ACTIVATION.md`

- [ ] **Step 1: Document secure owner actions**

List Supabase EU project creation, public URL/key placement, service-role placement, redirect URLs, first owner invitation and MFA enrollment. Show environment variable names only; never ask for values in chat.

- [ ] **Step 2: Run automated verification**

Run:

```bash
npm run test:run
npm run build
git diff --check
```

Expected: all tests pass, Vite builds and single HTML is regenerated.

- [ ] **Step 3: Run browser QA**

Test demo login, owner navigation, employee navigation, admin center, onboarding resume and dark/light mode at 1440x950, 1280x900 and 375x812. Assert no root horizontal overflow and no console errors.

- [ ] **Step 4: Secret scan and staged diff review**

Search tracked source only for secret patterns while excluding `.env*`, then verify `.env.local` is ignored. Confirm `worksheets/` remains untouched.

- [ ] **Step 5: Commit the foundation**

```bash
git add package.json package-lock.json .env.example src supabase api server README.md INSTALLATION_STACK.md docs aurawash-administratie.html
git commit -m "Build secure multi-tenant pilot foundation"
```
