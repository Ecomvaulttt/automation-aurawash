alter table public.invoices add column if not exists amount_ex_vat numeric(14, 2);
alter table public.invoices add column if not exists amount_inc_vat numeric(14, 2);
alter table public.invoices add column if not exists vat_reclaimable boolean not null default true;

update public.invoices
set
  amount_inc_vat = coalesce(amount_inc_vat, amount),
  amount_ex_vat = coalesce(amount_ex_vat, round(amount / 1.21, 2)),
  tax_amount = coalesce(tax_amount, round(amount - (amount / 1.21), 2)),
  vat_reclaimable = case when direction = 'payable' then coalesce(vat_reclaimable, true) else false end
where amount_inc_vat is null or amount_ex_vat is null or tax_amount is null;

alter table public.invoices alter column amount_ex_vat set default 0;
alter table public.invoices alter column amount_ex_vat set not null;
alter table public.invoices alter column amount_inc_vat set default 0;
alter table public.invoices alter column amount_inc_vat set not null;

alter table public.invoices add constraint invoices_amounts_nonnegative
  check (amount >= 0 and amount_ex_vat >= 0 and amount_inc_vat >= 0 and coalesce(tax_amount, 0) >= 0);

create index if not exists invoices_org_month_idx
  on public.invoices (organization_id, invoice_date, direction, status)
  where deleted_at is null;

create or replace function public.audit_sensitive_record_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  action_name text;
  before_value jsonb;
  after_value jsonb;
begin
  if tg_table_name = 'invoices' and (
    old.paid is distinct from new.paid or old.status is distinct from new.status or
    old.amount_ex_vat is distinct from new.amount_ex_vat or old.amount_inc_vat is distinct from new.amount_inc_vat or
    old.tax_amount is distinct from new.tax_amount or old.vat_reclaimable is distinct from new.vat_reclaimable or
    old.invoice_date is distinct from new.invoice_date or old.due_date is distinct from new.due_date
  ) then
    action_name := 'invoice.financial_data_changed';
    before_value := jsonb_build_object(
      'paid', old.paid, 'status', old.status, 'amount_ex_vat', old.amount_ex_vat,
      'amount_inc_vat', old.amount_inc_vat, 'tax_amount', old.tax_amount,
      'vat_reclaimable', old.vat_reclaimable, 'invoice_date', old.invoice_date, 'due_date', old.due_date
    );
    after_value := jsonb_build_object(
      'paid', new.paid, 'status', new.status, 'amount_ex_vat', new.amount_ex_vat,
      'amount_inc_vat', new.amount_inc_vat, 'tax_amount', new.tax_amount,
      'vat_reclaimable', new.vat_reclaimable, 'invoice_date', new.invoice_date, 'due_date', new.due_date
    );
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
