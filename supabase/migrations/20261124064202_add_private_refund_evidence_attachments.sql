insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('refund-evidence','refund-evidence',false,5242880,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=false, file_size_limit=5242880, allowed_mime_types=array['image/jpeg','image/png','image/webp'];

create table if not exists public.order_refund_attachments (
  id uuid primary key default gen_random_uuid(),
  refund_id uuid not null references public.order_refunds(id) on delete cascade,
  storage_path text not null unique,
  original_filename text not null,
  mime_type text not null check (mime_type in ('image/jpeg','image/png','image/webp')),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
alter table public.order_refund_attachments enable row level security;
revoke all on public.order_refund_attachments from anon, authenticated;
grant select, insert on public.order_refund_attachments to authenticated;

create policy order_refund_attachments_read_authorized
on public.order_refund_attachments for select to authenticated
using (app_private.has_permission('refunds.view') or app_private.has_permission('refunds.manage'));

create policy order_refund_attachments_insert_authorized
on public.order_refund_attachments for insert to authenticated
with check (
  app_private.has_permission('refunds.manage')
  and created_by = (select auth.uid())
);

create policy admins_manage_refund_evidence
on storage.objects for all to authenticated
using (bucket_id='refund-evidence' and (app_private.has_permission('refunds.view') or app_private.has_permission('refunds.manage')))
with check (bucket_id='refund-evidence' and app_private.has_permission('refunds.manage'));
