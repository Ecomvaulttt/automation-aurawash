alter table public.locations add constraint locations_organization_fk foreign key (organization_id) references public.organizations(id) on delete restrict;
alter table public.memberships add constraint memberships_user_fk foreign key (user_id) references auth.users(id) on delete restrict;
alter table public.memberships add constraint memberships_organization_fk foreign key (organization_id) references public.organizations(id) on delete restrict;
alter table public.memberships add constraint memberships_location_fk foreign key (location_id) references public.locations(id) on delete restrict;
alter table public.organization_settings add constraint settings_organization_fk foreign key (organization_id) references public.organizations(id) on delete restrict;
alter table public.onboarding_progress add constraint onboarding_organization_fk foreign key (organization_id) references public.organizations(id) on delete restrict;
alter table public.integrations add constraint integrations_organization_fk foreign key (organization_id) references public.organizations(id) on delete restrict;
alter table public.integrations add constraint integrations_location_fk foreign key (location_id) references public.locations(id) on delete restrict;
alter table public.integration_secrets add constraint integration_secrets_integration_fk foreign key (integration_id) references public.integrations(id) on delete cascade;
alter table public.audit_events add constraint audit_organization_fk foreign key (organization_id) references public.organizations(id) on delete restrict;
alter table public.audit_events add constraint audit_location_fk foreign key (location_id) references public.locations(id) on delete restrict;
alter table public.support_sessions add constraint support_organization_fk foreign key (organization_id) references public.organizations(id) on delete restrict;
alter table public.documents add constraint documents_organization_fk foreign key (organization_id) references public.organizations(id) on delete restrict;
alter table public.documents add constraint documents_location_fk foreign key (location_id) references public.locations(id) on delete restrict;
alter table public.invoices add constraint invoices_organization_fk foreign key (organization_id) references public.organizations(id) on delete restrict;
alter table public.invoices add constraint invoices_location_fk foreign key (location_id) references public.locations(id) on delete restrict;
alter table public.invoices add constraint invoices_document_fk foreign key (document_id) references public.documents(id) on delete restrict;
alter table public.invoice_approvals add constraint approvals_organization_fk foreign key (organization_id) references public.organizations(id) on delete restrict;
alter table public.invoice_approvals add constraint approvals_invoice_fk foreign key (invoice_id) references public.invoices(id) on delete restrict;
alter table public.employees add constraint employees_organization_fk foreign key (organization_id) references public.organizations(id) on delete restrict;
alter table public.employees add constraint employees_location_fk foreign key (location_id) references public.locations(id) on delete restrict;
alter table public.payroll_documents add constraint payroll_organization_fk foreign key (organization_id) references public.organizations(id) on delete restrict;
alter table public.payroll_documents add constraint payroll_location_fk foreign key (location_id) references public.locations(id) on delete restrict;
alter table public.payroll_documents add constraint payroll_employee_fk foreign key (employee_id) references public.employees(id) on delete restrict;
alter table public.payroll_documents add constraint payroll_document_fk foreign key (document_id) references public.documents(id) on delete restrict;
alter table public.automation_runs add constraint automation_organization_fk foreign key (organization_id) references public.organizations(id) on delete restrict;
alter table public.automation_runs add constraint automation_location_fk foreign key (location_id) references public.locations(id) on delete restrict;
alter table public.automation_runs add constraint automation_integration_fk foreign key (integration_id) references public.integrations(id) on delete restrict;
alter table public.action_items add constraint actions_organization_fk foreign key (organization_id) references public.organizations(id) on delete restrict;
alter table public.action_items add constraint actions_location_fk foreign key (location_id) references public.locations(id) on delete restrict;
alter table public.workspace_snapshots add constraint snapshots_organization_fk foreign key (organization_id) references public.organizations(id) on delete restrict;
alter table public.workspace_snapshots add constraint snapshots_location_fk foreign key (location_id) references public.locations(id) on delete restrict;

create index documents_org_type_idx on public.documents (organization_id, document_type, received_at desc) where deleted_at is null;
create index invoices_org_direction_paid_idx on public.invoices (organization_id, direction, paid, due_date) where deleted_at is null;
create index payroll_org_period_idx on public.payroll_documents (organization_id, period) where deleted_at is null;

create or replace function public.audit_sensitive_record_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  action_name text;
  before_value jsonb;
  after_value jsonb;
begin
  if tg_table_name = 'invoices' and (old.paid is distinct from new.paid or old.status is distinct from new.status) then
    action_name := 'invoice.status_changed';
    before_value := jsonb_build_object('paid', old.paid, 'status', old.status);
    after_value := jsonb_build_object('paid', new.paid, 'status', new.status);
  elsif tg_table_name = 'documents' and (old.status is distinct from new.status or old.deleted_at is distinct from new.deleted_at) then
    action_name := case when old.deleted_at is null and new.deleted_at is not null then 'document.removed' else 'document.status_changed' end;
    before_value := jsonb_build_object('status', old.status, 'deleted', old.deleted_at is not null);
    after_value := jsonb_build_object('status', new.status, 'deleted', new.deleted_at is not null);
  elsif tg_table_name = 'employees' and (old.status is distinct from new.status or old.deleted_at is distinct from new.deleted_at) then
    action_name := 'employee.status_changed';
    before_value := jsonb_build_object('status', old.status, 'deleted', old.deleted_at is not null);
    after_value := jsonb_build_object('status', new.status, 'deleted', new.deleted_at is not null);
  else
    return new;
  end if;
  insert into public.audit_events (organization_id, location_id, actor_user_id, action, entity_type, entity_id, before_data, after_data)
  values (new.organization_id, new.location_id, auth.uid(), action_name, tg_table_name, new.id, before_value, after_value);
  return new;
end;
$$;

create trigger invoices_audit_sensitive after update on public.invoices for each row execute function public.audit_sensitive_record_change();
create trigger documents_audit_sensitive after update on public.documents for each row execute function public.audit_sensitive_record_change();
create trigger employees_audit_sensitive after update on public.employees for each row execute function public.audit_sensitive_record_change();
