begin;
create extension if not exists pgtap;
select plan(13);

insert into public.organizations (id, name, slug) values
  ('10000000-0000-4000-8000-000000000001', 'Tenant A', 'tenant-a'),
  ('20000000-0000-4000-8000-000000000001', 'Tenant B', 'tenant-b');

insert into public.locations (id, organization_id, name, code) values
  ('10000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'A HQ', 'HQ'),
  ('10000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', 'A West', 'WEST'),
  ('20000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', 'B HQ', 'HQ');

insert into public.profiles (id, full_name, email) values
  ('10000000-0000-4000-8000-000000000010', 'Owner A', 'owner-a@example.test'),
  ('10000000-0000-4000-8000-000000000011', 'Manager A', 'manager-a@example.test'),
  ('10000000-0000-4000-8000-000000000012', 'Accountant A', 'accountant-a@example.test'),
  ('10000000-0000-4000-8000-000000000013', 'Employee A', 'employee-a@example.test'),
  ('20000000-0000-4000-8000-000000000010', 'Owner B', 'owner-b@example.test');

insert into public.memberships (user_id, organization_id, location_id, role, status) values
  ('10000000-0000-4000-8000-000000000010', '10000000-0000-4000-8000-000000000001', null, 'owner', 'active'),
  ('10000000-0000-4000-8000-000000000011', '10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', 'manager', 'active'),
  ('10000000-0000-4000-8000-000000000012', '10000000-0000-4000-8000-000000000001', null, 'accountant', 'active'),
  ('10000000-0000-4000-8000-000000000013', '10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', 'employee', 'active'),
  ('20000000-0000-4000-8000-000000000010', '20000000-0000-4000-8000-000000000001', null, 'owner', 'active');

insert into public.invoices (organization_id, location_id, direction, relation_name, invoice_number, amount, paid, source_paid_field) values
  ('10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', 'payable', 'Supplier A HQ', 'A-1', 100, 'no', 'H:NEE'),
  ('10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000003', 'receivable', 'Client A West', 'A-2', 150, 'no', 'J:NEE'),
  ('20000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002', 'payable', 'Supplier B', 'B-1', 200, 'no', 'H:NEE');

insert into public.employees (id, organization_id, location_id, user_id, full_name) values
  ('10000000-0000-4000-8000-000000000020', '10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000013', 'Employee A'),
  ('10000000-0000-4000-8000-000000000021', '10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', null, 'Employee B');

insert into public.payroll_documents (organization_id, location_id, employee_id, period, gross, net) values
  ('10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000020', '2026-08', 2500, 2100),
  ('10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000021', '2026-08', 2600, 2200);

set local role authenticated;

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000010', true);
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000010","aal":"aal2"}', true);
select is((select count(*)::integer from public.organizations), 1, 'owner sees one organization');
select is((select count(*)::integer from public.invoices), 2, 'owner sees every own-tenant invoice');
select is((select count(*)::integer from public.invoices where invoice_number = 'B-1'), 0, 'tenant B invoice is isolated');
update public.organizations set name = 'Changed A' where id = '10000000-0000-4000-8000-000000000001';
select is((select name from public.organizations), 'Changed A', 'owner can update own organization with aal2');
update public.organizations set name = 'Changed B' where id = '20000000-0000-4000-8000-000000000001';
select is((select count(*)::integer from public.organizations where name = 'Changed B'), 0, 'owner cannot update another organization');
select is((select count(*)::integer from public.memberships), 4, 'owner sees memberships only in own organization');

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000011', true);
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000011","aal":"aal2"}', true);
select is((select count(*)::integer from public.locations), 1, 'manager sees only assigned location');
select is((select count(*)::integer from public.invoices), 1, 'manager sees invoices only for assigned location');

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000012', true);
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000012","aal":"aal2"}', true);
select is((select count(*)::integer from public.invoices), 2, 'accountant can read own-tenant financials');
select throws_ok(
  $$insert into public.memberships (user_id, organization_id, role, status) values ('10000000-0000-4000-8000-000000000099', '10000000-0000-4000-8000-000000000001', 'employee', 'active')$$,
  '42501',
  'accountant cannot mutate memberships'
);

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000013', true);
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000013","aal":"aal1"}', true);
select is((select count(*)::integer from public.payroll_documents), 1, 'employee sees only own payroll document');
select is((select count(*)::integer from public.invoices), 0, 'employee cannot read financial invoices');

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000010', true);
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000010","aal":"aal1"}', true);
update public.organizations set name = 'AAL1 update' where id = '10000000-0000-4000-8000-000000000001';
select is((select name from public.organizations), 'Changed A', 'financial admin writes require aal2');

select * from finish();
rollback;
