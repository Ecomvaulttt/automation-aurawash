insert into public.organizations (
  id, name, slug, sector, brand_color, status, template_key
) values (
  '00000000-0000-4000-8000-000000000101',
  'AuraWash template',
  'aurawash-template',
  'Autodetailing / carwash',
  '#2D5BFF',
  'template',
  'automotive-detailing-v1'
) on conflict (id) do nothing;

insert into public.locations (
  id, organization_id, name, code
) values (
  '00000000-0000-4000-8000-000000000201',
  '00000000-0000-4000-8000-000000000101',
  'Hoofdvestiging',
  'HQ'
) on conflict (id) do nothing;

insert into public.organization_settings (
  id, organization_id, payable_reminder_days, receivable_reminder_days, auto_customer_email
) values (
  '00000000-0000-4000-8000-000000000301',
  '00000000-0000-4000-8000-000000000101',
  5,
  3,
  false
) on conflict (id) do nothing;

insert into public.onboarding_progress (
  id, organization_id, current_step, completed_steps, status
) values (
  '00000000-0000-4000-8000-000000000401',
  '00000000-0000-4000-8000-000000000101',
  'company',
  '{}',
  'template'
) on conflict (id) do nothing;

insert into public.integrations (
  id, organization_id, provider, display_name, status
) values
  ('00000000-0000-4000-8000-000000000501', '00000000-0000-4000-8000-000000000101', 'google', 'Gmail inbox', 'not_configured'),
  ('00000000-0000-4000-8000-000000000502', '00000000-0000-4000-8000-000000000101', 'microsoft', 'Microsoft inbox', 'disabled'),
  ('00000000-0000-4000-8000-000000000503', '00000000-0000-4000-8000-000000000101', 'slack', 'Slack meldingen', 'not_configured'),
  ('00000000-0000-4000-8000-000000000504', '00000000-0000-4000-8000-000000000101', 'bank_file', 'Bank CSV/XLS', 'not_configured')
on conflict (id) do nothing;
