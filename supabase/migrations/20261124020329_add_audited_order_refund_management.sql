create table public.order_refunds (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  amount numeric(20,4) not null check (amount > 0),
  currency_code text not null references public.store_currencies(code),
  currency_symbol_snapshot text not null,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  method text not null check (length(trim(method)) > 0),
  reason text not null check (length(trim(reason)) > 0),
  internal_note text,
  external_reference text,
  idempotency_key uuid not null unique,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  processed_by uuid references auth.users(id) on delete set null,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index order_refunds_order_id_created_at_idx
  on public.order_refunds(order_id, created_at desc);

alter table public.order_refunds enable row level security;

create policy order_refunds_read_authorized
  on public.order_refunds
  for select
  to authenticated
  using (
    app_private.has_permission('refunds.view')
    or app_private.has_permission('refunds.manage')
  );

revoke all on table public.order_refunds from anon, authenticated;
grant select on table public.order_refunds to authenticated;

insert into public.permissions(code, description)
values
  ('refunds.view', 'View refund records'),
  ('refunds.manage', 'Create and manage refunds')
on conflict (code) do nothing;

insert into public.role_permissions(role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.name = 'Admin'
  and p.code in ('refunds.view', 'refunds.manage')
on conflict do nothing;

create or replace function public.create_order_refund(
  p_order_id uuid,
  p_amount numeric,
  p_method text,
  p_reason text,
  p_internal_note text,
  p_idempotency_key uuid
)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_order public.orders%rowtype;
  v_existing_id uuid;
  v_refund_id uuid;
  v_reserved_amount numeric(20,4);
  v_decimals integer;
begin
  if v_actor is null or not app_private.has_permission('refunds.manage') then
    raise exception 'Permission denied';
  end if;

  if p_idempotency_key is null then
    raise exception 'Idempotency key is required';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Refund amount must be greater than zero';
  end if;

  if nullif(trim(p_method), '') is null or nullif(trim(p_reason), '') is null then
    raise exception 'Refund method and reason are required';
  end if;

  select *
    into v_order
    from public.orders
   where id = p_order_id
   for update;

  if not found then
    raise exception 'Order not found';
  end if;

  select id
    into v_existing_id
    from public.order_refunds
   where idempotency_key = p_idempotency_key;

  if v_existing_id is not null then
    return v_existing_id;
  end if;

  if v_order.order_status <> 'cancelled' then
    raise exception 'Refunds can only be created for cancelled orders';
  end if;

  if v_order.payment_status <> 'verified' then
    raise exception 'Only verified payments can be refunded';
  end if;

  v_decimals := coalesce(v_order.currency_decimal_places_snapshot, 2);

  if p_amount <> round(p_amount, v_decimals) then
    raise exception 'Refund amount exceeds the currency decimal precision';
  end if;

  select coalesce(sum(amount), 0)
    into v_reserved_amount
    from public.order_refunds
   where order_id = p_order_id
     and status in ('pending', 'processing', 'completed');

  if v_reserved_amount + p_amount > v_order.total_amount then
    raise exception 'Refund amount exceeds the remaining refundable balance';
  end if;

  insert into public.order_refunds(
    order_id, amount, currency_code, currency_symbol_snapshot,
    status, method, reason, internal_note, idempotency_key, created_by, updated_by
  )
  values (
    v_order.id, p_amount, v_order.currency_code, v_order.currency_symbol_snapshot,
    'pending', trim(p_method), trim(p_reason), nullif(trim(p_internal_note), ''),
    p_idempotency_key, v_actor, v_actor
  )
  returning id into v_refund_id;

  insert into public.admin_audit_logs(
    admin_user_id, actor_user_id, action, target_type, target_id,
    old_values, new_values, reason
  )
  values (
    (select au.id from public.admin_users au where au.user_id = v_actor limit 1),
    v_actor,
    'refund.created',
    'order_refund',
    v_refund_id,
    null,
    jsonb_build_object(
      'order_id', v_order.id,
      'amount', p_amount,
      'currency_code', v_order.currency_code,
      'status', 'pending',
      'method', trim(p_method)
    ),
    trim(p_reason)
  );

  return v_refund_id;
end;
$function$;

create or replace function public.update_order_refund_status(
  p_refund_id uuid,
  p_new_status text,
  p_external_reference text,
  p_note text
)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_refund public.order_refunds%rowtype;
  v_order public.orders%rowtype;
begin
  if v_actor is null or not app_private.has_permission('refunds.manage') then
    raise exception 'Permission denied';
  end if;

  if p_new_status not in ('processing', 'completed', 'failed', 'cancelled') then
    raise exception 'Invalid refund status';
  end if;

  select *
    into v_refund
    from public.order_refunds
   where id = p_refund_id
   for update;

  if not found then
    raise exception 'Refund record not found';
  end if;

  select *
    into v_order
    from public.orders
   where id = v_refund.order_id
   for update;

  if p_new_status = 'processing' and v_refund.status not in ('pending', 'failed') then
    raise exception 'Only pending or failed refunds can move to processing';
  elsif p_new_status = 'completed' and v_refund.status <> 'processing' then
    raise exception 'Only processing refunds can be completed';
  elsif p_new_status = 'failed' and v_refund.status <> 'processing' then
    raise exception 'Only processing refunds can be marked failed';
  elsif p_new_status = 'cancelled' and v_refund.status not in ('pending', 'failed') then
    raise exception 'Only pending or failed refunds can be cancelled';
  end if;

  if p_new_status = 'completed' and nullif(trim(p_external_reference), '') is null then
    raise exception 'A bank or transfer reference is required to complete a refund';
  end if;

  if p_new_status = 'failed' and nullif(trim(p_note), '') is null then
    raise exception 'A failure reason is required';
  end if;

  update public.order_refunds
     set status = p_new_status,
         external_reference = case
           when p_new_status = 'completed' then trim(p_external_reference)
           when nullif(trim(p_external_reference), '') is not null then trim(p_external_reference)
           else external_reference
         end,
         internal_note = coalesce(nullif(trim(p_note), ''), internal_note),
         updated_by = v_actor,
         updated_at = now(),
         processed_by = case
           when p_new_status in ('completed', 'failed') then v_actor
           when p_new_status = 'processing' then null
           else processed_by
         end,
         processed_at = case
           when p_new_status in ('completed', 'failed') then now()
           when p_new_status = 'processing' then null
           else processed_at
         end
   where id = v_refund.id;

  insert into public.admin_audit_logs(
    admin_user_id, actor_user_id, action, target_type, target_id,
    old_values, new_values, reason
  )
  values (
    (select au.id from public.admin_users au where au.user_id = v_actor limit 1),
    v_actor,
    'refund.status_changed',
    'order_refund',
    v_refund.id,
    jsonb_build_object(
      'status', v_refund.status,
      'external_reference', v_refund.external_reference
    ),
    jsonb_build_object(
      'status', p_new_status,
      'external_reference',
      coalesce(nullif(trim(p_external_reference), ''), v_refund.external_reference)
    ),
    nullif(trim(p_note), '')
  );
end;
$function$;

revoke all on function public.create_order_refund(uuid,numeric,text,text,text,uuid) from public, anon;
revoke all on function public.update_order_refund_status(uuid,text,text,text) from public, anon;
grant execute on function public.create_order_refund(uuid,numeric,text,text,text,uuid) to authenticated;
grant execute on function public.update_order_refund_status(uuid,text,text,text) to authenticated;
