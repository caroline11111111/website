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
  v_existing public.order_refunds%rowtype;
  v_refund_id uuid;
  v_reserved_amount numeric(20,4);
  v_decimals integer;
  v_method text := trim(p_method);
  v_reason text := trim(p_reason);
  v_internal_note text := nullif(trim(p_internal_note), '');
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

  if nullif(v_method, '') is null or nullif(v_reason, '') is null then
    raise exception 'Refund method and reason are required';
  end if;

  -- A previously committed request may be retried even if the order has
  -- since changed state. Return it only when the complete request matches.
  select *
    into v_existing
    from public.order_refunds
   where idempotency_key = p_idempotency_key
   for update;

  if found then
    if v_existing.order_id is distinct from p_order_id
       or v_existing.amount is distinct from p_amount
       or v_existing.method is distinct from v_method
       or v_existing.reason is distinct from v_reason
       or v_existing.internal_note is distinct from v_internal_note
       or v_existing.created_by is distinct from v_actor then
      raise exception 'Idempotency key conflict: this key was already used for a different refund request';
    end if;

    return v_existing.id;
  end if;

  select *
    into v_order
    from public.orders
   where id = p_order_id
   for update;

  if not found then
    raise exception 'Order not found';
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

  -- DO NOTHING handles simultaneous requests using the same key. The
  -- subsequent locked read validates the winner's complete request payload.
  insert into public.order_refunds(
    order_id, amount, currency_code, currency_symbol_snapshot,
    status, method, reason, internal_note, idempotency_key, created_by, updated_by
  )
  values (
    v_order.id, p_amount, v_order.currency_code, v_order.currency_symbol_snapshot,
    'pending', v_method, v_reason, v_internal_note,
    p_idempotency_key, v_actor, v_actor
  )
  on conflict (idempotency_key) do nothing
  returning id into v_refund_id;

  if v_refund_id is null then
    select *
      into v_existing
      from public.order_refunds
     where idempotency_key = p_idempotency_key
     for update;

    if not found then
      raise exception 'Unable to resolve concurrent refund request; retry with the same idempotency key';
    end if;

    if v_existing.order_id is distinct from p_order_id
       or v_existing.amount is distinct from p_amount
       or v_existing.method is distinct from v_method
       or v_existing.reason is distinct from v_reason
       or v_existing.internal_note is distinct from v_internal_note
       or v_existing.created_by is distinct from v_actor then
      raise exception 'Idempotency key conflict: this key was already used for a different refund request';
    end if;

    return v_existing.id;
  end if;

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
      'method', v_method
    ),
    v_reason
  );

  return v_refund_id;
end;
$function$;