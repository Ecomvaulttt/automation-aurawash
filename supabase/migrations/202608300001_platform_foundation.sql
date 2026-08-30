create extension if not exists pgcrypto;

create type public.app_role as enum (
  'ecomvault_superadmin',
  'owner',
  'manager',
  'accountant',
  'employee'
);

create type public.membership_status as enum ('invited', 'active', 'blocked');
create type public.connector_status as enum (
  'not_configured',
  'connecting',
  'connected',
  'attention',
  'expired',
  'disabled'
);
create type public.invoice_direction as enum ('payable', 'receivable');
create type public.paid_value as enum ('yes', 'no', 'installment');
create type public.record_status as enum (
  'received',
  'extracted',
  'review_required',
  'approved',
  'rejected',
  'paid',
  'archived'
);
create type public.run_status as enum ('queued', 'running', 'succeeded', 'failed', 'cancelled');

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null,
  sector text not null default '',
  logo_url text,
  brand_color text not null default '#2D5BFF',
  status text not null default 'onboarding',
  template_key text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create unique index organizations_slug_active_idx on public.organizations (lower(slug)) where deleted_at is null;

create table public.locations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  name text not null,
  code text not null,
  address jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create unique index locations_org_code_active_idx on public.locations (organization_id, lower(code)) where deleted_at is null;

create table public.profiles (
  id uuid primary key,
  full_name text not null default '',
  email text not null default '',
  platform_role public.app_role,
  status text not null default 'active',
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  organization_id uuid not null,
  location_id uuid,
  role public.app_role not null,
  status public.membership_status not null default 'invited',
  invited_by uuid,
  invited_at timestamptz not null default now(),
  activated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create unique index memberships_scope_active_idx
  on public.memberships (user_id, organization_id, coalesce(location_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where deleted_at is null;
create index memberships_org_user_idx on public.memberships (organization_id, user_id) where deleted_at is null;

create table public.organization_settings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  bookkeeper_email text not null default '',
  admin_email text not null default '',
  bank_upload_cadence text not null default 'monthly',
  payable_reminder_days integer not null default 5 check (payable_reminder_days between 0 and 60),
  receivable_reminder_days integer not null default 3 check (receivable_reminder_days between 0 and 60),
  auto_customer_email boolean not null default false,
  employee_mfa_required boolean not null default false,
  preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create unique index organization_settings_org_idx on public.organization_settings (organization_id);

create table public.onboarding_progress (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  current_step text not null default 'company',
  completed_steps text[] not null default '{}',
  status text not null default 'in_progress',
  data jsonb not null default '{}'::jsonb,
  launched_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create unique index onboarding_org_idx on public.onboarding_progress (organization_id);

create table public.integrations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  location_id uuid,
  provider text not null,
  display_name text not null,
  status public.connector_status not null default 'not_configured',
  scopes text[] not null default '{}',
  configuration jsonb not null default '{}'::jsonb,
  last_sync_at timestamptz,
  last_test_at timestamptz,
  last_error_code text,
  retry_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create unique index integrations_provider_scope_active_idx
  on public.integrations (organization_id, coalesce(location_id, '00000000-0000-0000-0000-000000000000'::uuid), provider)
  where deleted_at is null;

create table public.integration_secrets (
  id uuid primary key default gen_random_uuid(),
  integration_id uuid not null,
  encrypted_payload text not null,
  key_version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create unique index integration_secrets_active_idx on public.integration_secrets (integration_id) where deleted_at is null;
revoke all on table public.integration_secrets from anon, authenticated;

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  location_id uuid,
  actor_user_id uuid,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  before_data jsonb,
  after_data jsonb,
  reason text,
  correlation_id text,
  ip_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index audit_events_org_created_idx on public.audit_events (organization_id, created_at desc) where deleted_at is null;

create table public.support_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  requested_by uuid not null,
  approved_by uuid,
  reason text not null,
  status text not null default 'requested',
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  location_id uuid,
  document_type text not null,
  file_name text not null,
  storage_path text not null,
  mime_type text not null default 'application/pdf',
  file_size bigint not null default 0,
  source text not null default 'upload',
  source_external_id text,
  status public.record_status not null default 'received',
  received_at timestamptz not null default now(),
  uploaded_by uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create unique index documents_storage_path_active_idx on public.documents (storage_path) where deleted_at is null;
create unique index documents_source_external_active_idx on public.documents (organization_id, source, source_external_id) where deleted_at is null and source_external_id is not null;

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  location_id uuid,
  direction public.invoice_direction not null,
  relation_name text not null,
  invoice_number text not null,
  amount numeric(14, 2) not null default 0,
  tax_amount numeric(14, 2),
  invoice_date date,
  due_date date,
  paid public.paid_value not null default 'no',
  source_paid_field text not null default '',
  status public.record_status not null default 'review_required',
  priority text not null default 'normal',
  assigned_to uuid,
  document_id uuid,
  notes text not null default '',
  extraction jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create unique index invoices_dedupe_active_idx
  on public.invoices (organization_id, direction, lower(relation_name), lower(invoice_number), amount)
  where deleted_at is null;
create index invoices_org_due_idx on public.invoices (organization_id, due_date) where deleted_at is null and paid = 'no';

create table public.invoice_approvals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  invoice_id uuid not null,
  actor_user_id uuid not null,
  decision text not null check (decision in ('approved', 'rejected')),
  comment text not null default '',
  decided_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.employees (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  location_id uuid,
  user_id uuid,
  full_name text not null,
  email text not null default '',
  status text not null default 'active',
  job_title text not null default '',
  gross_monthly numeric(14, 2) not null default 0,
  net_monthly numeric(14, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index employees_org_user_idx on public.employees (organization_id, user_id) where deleted_at is null;

create table public.payroll_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  location_id uuid,
  employee_id uuid not null,
  document_id uuid,
  period text not null,
  gross numeric(14, 2) not null default 0,
  net numeric(14, 2) not null default 0,
  status text not null default 'review',
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create unique index payroll_employee_period_active_idx on public.payroll_documents (employee_id, period) where deleted_at is null;

create table public.automation_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  location_id uuid,
  integration_id uuid,
  run_type text not null,
  status public.run_status not null default 'queued',
  idempotency_key text not null,
  processed_count integer not null default 0,
  success_count integer not null default 0,
  failed_count integer not null default 0,
  last_error_code text,
  started_at timestamptz,
  finished_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create unique index automation_idempotency_active_idx on public.automation_runs (organization_id, idempotency_key) where deleted_at is null;

create table public.action_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  location_id uuid,
  assigned_to uuid,
  title text not null,
  detail text not null default '',
  entity_type text,
  entity_id uuid,
  priority text not null default 'normal',
  status text not null default 'open',
  due_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index action_items_assignee_due_idx on public.action_items (assigned_to, due_at) where deleted_at is null and status = 'open';

create table public.workspace_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  location_id uuid,
  schema_version integer not null default 1,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create unique index workspace_snapshots_scope_active_idx
  on public.workspace_snapshots (organization_id, coalesce(location_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where deleted_at is null;

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'organizations', 'locations', 'profiles', 'memberships', 'organization_settings',
    'onboarding_progress', 'integrations', 'integration_secrets', 'audit_events',
    'support_sessions', 'documents', 'invoices', 'invoice_approvals', 'employees',
    'payroll_documents', 'automation_runs', 'action_items', 'workspace_snapshots'
  ] loop
    execute format('create trigger %I_touch_updated_at before update on public.%I for each row execute function public.touch_updated_at()', table_name, table_name);
  end loop;
end $$;

create or replace function public.is_ecomvault_superadmin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.platform_role = 'ecomvault_superadmin'
      and p.status = 'active'
      and p.deleted_at is null
  );
$$;

create or replace function public.has_org_role(target_org uuid, allowed public.app_role[])
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_ecomvault_superadmin() or exists (
    select 1 from public.memberships m
    where m.user_id = auth.uid()
      and m.organization_id = target_org
      and m.role = any(allowed)
      and m.status = 'active'
      and m.deleted_at is null
  );
$$;

create or replace function public.has_location_access(target_org uuid, target_location uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_ecomvault_superadmin() or exists (
    select 1 from public.memberships m
    where m.user_id = auth.uid()
      and m.organization_id = target_org
      and m.status = 'active'
      and m.deleted_at is null
      and (
        m.role in ('owner', 'accountant')
        or m.location_id is null
        or target_location is null
        or m.location_id = target_location
      )
  );
$$;

create or replace function public.shares_org_with(target_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_ecomvault_superadmin() or exists (
    select 1
    from public.memberships mine
    join public.memberships theirs on theirs.organization_id = mine.organization_id
    where mine.user_id = auth.uid()
      and theirs.user_id = target_user
      and mine.status = 'active'
      and theirs.status in ('invited', 'active', 'blocked')
      and mine.deleted_at is null
      and theirs.deleted_at is null
      and mine.role = 'owner'
  );
$$;

create or replace function public.is_own_employee(target_employee uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.employees e
    where e.id = target_employee
      and e.user_id = auth.uid()
      and e.deleted_at is null
  );
$$;

grant execute on function public.is_ecomvault_superadmin() to authenticated;
grant execute on function public.has_org_role(uuid, public.app_role[]) to authenticated;
grant execute on function public.has_location_access(uuid, uuid) to authenticated;
grant execute on function public.shares_org_with(uuid) to authenticated;
grant execute on function public.is_own_employee(uuid) to authenticated;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'organizations', 'locations', 'profiles', 'memberships', 'organization_settings',
    'onboarding_progress', 'integrations', 'integration_secrets', 'audit_events', 'support_sessions',
    'documents', 'invoices', 'invoice_approvals', 'employees', 'payroll_documents',
    'automation_runs', 'action_items', 'workspace_snapshots'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on table public.%I from anon, authenticated', table_name);
  end loop;
end $$;

grant select, update on public.organizations to authenticated;
grant select, insert, update on public.locations to authenticated;
grant select, update on public.profiles to authenticated;
grant select on public.memberships to authenticated;
grant select, insert, update on public.organization_settings to authenticated;
grant select, insert, update on public.onboarding_progress to authenticated;
grant select on public.integrations to authenticated;
grant select on public.audit_events to authenticated;
grant select, insert, update on public.support_sessions to authenticated;
grant select, insert, update on public.documents to authenticated;
grant select, insert, update on public.invoices to authenticated;
grant select, insert on public.invoice_approvals to authenticated;
grant select, insert, update on public.employees to authenticated;
grant select, insert, update on public.payroll_documents to authenticated;
grant select on public.automation_runs to authenticated;
grant select, insert, update on public.action_items to authenticated;
grant select, insert, update on public.workspace_snapshots to authenticated;

create policy organizations_select on public.organizations for select to authenticated
  using (deleted_at is null and (public.is_ecomvault_superadmin() or public.has_org_role(id, array['owner','manager','accountant','employee']::public.app_role[])));
create policy organizations_update on public.organizations for update to authenticated
  using (deleted_at is null and public.has_org_role(id, array['owner']::public.app_role[]) and (auth.jwt()->>'aal') = 'aal2')
  with check (public.has_org_role(id, array['owner']::public.app_role[]));

create policy locations_select on public.locations for select to authenticated
  using (deleted_at is null and public.has_location_access(organization_id, id));
create policy locations_insert on public.locations for insert to authenticated
  with check (public.has_org_role(organization_id, array['owner']::public.app_role[]) and (auth.jwt()->>'aal') = 'aal2');
create policy locations_update on public.locations for update to authenticated
  using (deleted_at is null and public.has_org_role(organization_id, array['owner']::public.app_role[]) and (auth.jwt()->>'aal') = 'aal2')
  with check (public.has_org_role(organization_id, array['owner']::public.app_role[]));

create policy profiles_select on public.profiles for select to authenticated
  using (deleted_at is null and (id = auth.uid() or public.shares_org_with(id)));
create policy profiles_update_self on public.profiles for update to authenticated
  using (deleted_at is null and id = auth.uid())
  with check (id = auth.uid());

create policy memberships_select on public.memberships for select to authenticated
  using (deleted_at is null and (user_id = auth.uid() or public.has_org_role(organization_id, array['owner']::public.app_role[])));

create policy settings_select on public.organization_settings for select to authenticated
  using (deleted_at is null and public.has_org_role(organization_id, array['owner','manager','accountant']::public.app_role[]));
create policy settings_insert on public.organization_settings for insert to authenticated
  with check (public.has_org_role(organization_id, array['owner']::public.app_role[]) and (auth.jwt()->>'aal') = 'aal2');
create policy settings_update on public.organization_settings for update to authenticated
  using (deleted_at is null and public.has_org_role(organization_id, array['owner']::public.app_role[]) and (auth.jwt()->>'aal') = 'aal2')
  with check (public.has_org_role(organization_id, array['owner']::public.app_role[]));

create policy onboarding_select on public.onboarding_progress for select to authenticated
  using (deleted_at is null and public.has_org_role(organization_id, array['owner','manager']::public.app_role[]));
create policy onboarding_insert on public.onboarding_progress for insert to authenticated
  with check (public.has_org_role(organization_id, array['owner','manager']::public.app_role[]) and (auth.jwt()->>'aal') = 'aal2');
create policy onboarding_update on public.onboarding_progress for update to authenticated
  using (deleted_at is null and public.has_org_role(organization_id, array['owner','manager']::public.app_role[]) and (auth.jwt()->>'aal') = 'aal2')
  with check (public.has_org_role(organization_id, array['owner','manager']::public.app_role[]));

create policy integrations_select on public.integrations for select to authenticated
  using (deleted_at is null and public.has_org_role(organization_id, array['owner','manager']::public.app_role[]) and public.has_location_access(organization_id, location_id));

create policy audit_select on public.audit_events for select to authenticated
  using (deleted_at is null and public.has_org_role(organization_id, array['owner','accountant']::public.app_role[]));

create policy support_select on public.support_sessions for select to authenticated
  using (deleted_at is null and (public.is_ecomvault_superadmin() or public.has_org_role(organization_id, array['owner']::public.app_role[])));
create policy support_insert on public.support_sessions for insert to authenticated
  with check (public.is_ecomvault_superadmin() and requested_by = auth.uid() and (auth.jwt()->>'aal') = 'aal2');
create policy support_update on public.support_sessions for update to authenticated
  using (deleted_at is null and public.has_org_role(organization_id, array['owner']::public.app_role[]) and (auth.jwt()->>'aal') = 'aal2')
  with check (public.has_org_role(organization_id, array['owner']::public.app_role[]));

create policy documents_select on public.documents for select to authenticated
  using (
    deleted_at is null and public.has_location_access(organization_id, location_id) and (
      public.has_org_role(organization_id, array['owner','manager','accountant']::public.app_role[])
      or (document_type = 'payroll' and exists (
        select 1 from public.payroll_documents pd
        where pd.document_id = documents.id and public.is_own_employee(pd.employee_id) and pd.deleted_at is null
      ))
    )
  );
create policy documents_insert on public.documents for insert to authenticated
  with check (public.has_org_role(organization_id, array['owner','manager']::public.app_role[]) and public.has_location_access(organization_id, location_id) and (auth.jwt()->>'aal') = 'aal2');
create policy documents_update on public.documents for update to authenticated
  using (deleted_at is null and public.has_org_role(organization_id, array['owner','manager']::public.app_role[]) and public.has_location_access(organization_id, location_id) and (auth.jwt()->>'aal') = 'aal2')
  with check (public.has_org_role(organization_id, array['owner','manager']::public.app_role[]));

create policy invoices_select on public.invoices for select to authenticated
  using (deleted_at is null and public.has_org_role(organization_id, array['owner','manager','accountant']::public.app_role[]) and public.has_location_access(organization_id, location_id));
create policy invoices_insert on public.invoices for insert to authenticated
  with check (public.has_org_role(organization_id, array['owner','manager']::public.app_role[]) and public.has_location_access(organization_id, location_id) and (auth.jwt()->>'aal') = 'aal2');
create policy invoices_update on public.invoices for update to authenticated
  using (deleted_at is null and public.has_org_role(organization_id, array['owner','manager']::public.app_role[]) and public.has_location_access(organization_id, location_id) and (auth.jwt()->>'aal') = 'aal2')
  with check (public.has_org_role(organization_id, array['owner','manager']::public.app_role[]));

create policy approvals_select on public.invoice_approvals for select to authenticated
  using (deleted_at is null and public.has_org_role(organization_id, array['owner','manager','accountant']::public.app_role[]));
create policy approvals_insert on public.invoice_approvals for insert to authenticated
  with check (actor_user_id = auth.uid() and public.has_org_role(organization_id, array['owner','manager']::public.app_role[]) and (auth.jwt()->>'aal') = 'aal2');

create policy employees_select on public.employees for select to authenticated
  using (deleted_at is null and public.has_location_access(organization_id, location_id) and (user_id = auth.uid() or public.has_org_role(organization_id, array['owner','manager','accountant']::public.app_role[])));
create policy employees_insert on public.employees for insert to authenticated
  with check (public.has_org_role(organization_id, array['owner','manager']::public.app_role[]) and public.has_location_access(organization_id, location_id) and (auth.jwt()->>'aal') = 'aal2');
create policy employees_update on public.employees for update to authenticated
  using (deleted_at is null and public.has_org_role(organization_id, array['owner','manager']::public.app_role[]) and public.has_location_access(organization_id, location_id) and (auth.jwt()->>'aal') = 'aal2')
  with check (public.has_org_role(organization_id, array['owner','manager']::public.app_role[]));

create policy payroll_select on public.payroll_documents for select to authenticated
  using (deleted_at is null and public.has_location_access(organization_id, location_id) and (public.is_own_employee(employee_id) or public.has_org_role(organization_id, array['owner','manager','accountant']::public.app_role[])));
create policy payroll_insert on public.payroll_documents for insert to authenticated
  with check (public.has_org_role(organization_id, array['owner','manager']::public.app_role[]) and public.has_location_access(organization_id, location_id) and (auth.jwt()->>'aal') = 'aal2');
create policy payroll_update on public.payroll_documents for update to authenticated
  using (deleted_at is null and public.has_org_role(organization_id, array['owner','manager']::public.app_role[]) and public.has_location_access(organization_id, location_id) and (auth.jwt()->>'aal') = 'aal2')
  with check (public.has_org_role(organization_id, array['owner','manager']::public.app_role[]));

create policy automation_select on public.automation_runs for select to authenticated
  using (deleted_at is null and public.has_org_role(organization_id, array['owner','manager']::public.app_role[]) and public.has_location_access(organization_id, location_id));

create policy actions_select on public.action_items for select to authenticated
  using (deleted_at is null and public.has_location_access(organization_id, location_id) and (assigned_to = auth.uid() or public.has_org_role(organization_id, array['owner','manager','accountant']::public.app_role[])));
create policy actions_insert on public.action_items for insert to authenticated
  with check (public.has_org_role(organization_id, array['owner','manager']::public.app_role[]) and public.has_location_access(organization_id, location_id) and (auth.jwt()->>'aal') = 'aal2');
create policy actions_update on public.action_items for update to authenticated
  using (deleted_at is null and public.has_location_access(organization_id, location_id) and (assigned_to = auth.uid() or public.has_org_role(organization_id, array['owner','manager']::public.app_role[])))
  with check (public.has_location_access(organization_id, location_id));

create policy workspace_snapshots_select on public.workspace_snapshots for select to authenticated
  using (deleted_at is null and public.has_org_role(organization_id, array['owner','manager','accountant']::public.app_role[]) and public.has_location_access(organization_id, location_id));
create policy workspace_snapshots_insert on public.workspace_snapshots for insert to authenticated
  with check (public.has_org_role(organization_id, array['owner','manager']::public.app_role[]) and public.has_location_access(organization_id, location_id) and (auth.jwt()->>'aal') = 'aal2');
create policy workspace_snapshots_update on public.workspace_snapshots for update to authenticated
  using (deleted_at is null and public.has_org_role(organization_id, array['owner','manager']::public.app_role[]) and public.has_location_access(organization_id, location_id) and (auth.jwt()->>'aal') = 'aal2')
  with check (public.has_org_role(organization_id, array['owner','manager']::public.app_role[]) and public.has_location_access(organization_id, location_id));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documents', 'documents', false, 52428800, array['application/pdf', 'image/jpeg', 'image/png', 'text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy storage_documents_select on storage.objects for select to authenticated
  using (
    bucket_id = 'documents' and exists (
      select 1 from public.documents d
      where d.storage_path = name
        and d.deleted_at is null
        and (
          public.has_org_role(d.organization_id, array['owner','manager','accountant']::public.app_role[])
          or (d.document_type = 'payroll' and exists (
            select 1 from public.payroll_documents pd
            where pd.document_id = d.id and public.is_own_employee(pd.employee_id) and pd.deleted_at is null
          ))
        )
    )
  );

create policy storage_documents_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'documents'
    and public.has_org_role(((storage.foldername(name))[1])::uuid, array['owner','manager']::public.app_role[])
    and (auth.jwt()->>'aal') = 'aal2'
  );

create policy storage_documents_update on storage.objects for update to authenticated
  using (
    bucket_id = 'documents'
    and public.has_org_role(((storage.foldername(name))[1])::uuid, array['owner','manager']::public.app_role[])
    and (auth.jwt()->>'aal') = 'aal2'
  );

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''), coalesce(new.email, ''))
  on conflict (id) do update set email = excluded.email, updated_at = now();
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create trigger on_auth_user_email_updated
  after update of email on auth.users
  for each row execute function public.handle_new_user();
