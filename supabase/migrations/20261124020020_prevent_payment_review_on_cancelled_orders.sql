create or replace function public.admin_review_payment(
  p_payment_proof_id uuid,
  p_decision text,
  p_note text
)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_proof public.payment_proofs%rowtype;
  v_order public.orders%rowtype;
  v_actor uuid := auth.uid();
begin
  if v_actor is null or not app_private.has_permission('payments.review') then
    raise exception 'Permission denied';
  end if;

  if p_decision not in ('approved', 'rejected') then
    raise exception 'Invalid review decision';
  end if;

  select *
    into v_proof
    from public.payment_proofs
   where id = p_payment_proof_id
   for update;

  if not found then
    raise exception 'Payment proof not found';
  end if;

  select *
    into v_order
    from public.orders
   where id = v_proof.order_id
   for update;

  if not found then
    raise exception 'Order not found';
  end if;

  if v_order.order_status = 'cancelled' then
    raise exception 'Cannot review payment proof for a cancelled order';
  end if;

  if v_proof.review_status <> 'pending'
     or v_order.payment_status <> 'verification_pending' then
    raise exception 'This payment proof or order has already been reviewed';
  end if;

  update public.payment_proofs
     set review_status = p_decision,
         reviewed_by = v_actor,
         reviewed_at = now(),
         review_note = nullif(trim(p_note), '')
   where id = v_proof.id;

  update public.orders
     set payment_status = case when p_decision = 'approved' then 'verified' else 'rejected' end,
         order_status = case when p_decision = 'approved' then 'processing' else order_status end,
         updated_at = now()
   where id = v_order.id;

  insert into public.payment_status_history(
    order_id, payment_proof_id, old_status, new_status, reason, changed_by
  )
  values (
    v_order.id,
    v_proof.id,
    v_order.payment_status,
    case when p_decision = 'approved' then 'verified' else 'rejected' end,
    coalesce(nullif(trim(p_note), ''), 'Payment proof reviewed'),
    v_actor
  );

  if p_decision = 'approved' then
    insert into public.order_status_history(
      order_id, old_status, new_status, reason, changed_by
    )
    values (
      v_order.id,
      v_order.order_status,
      'processing',
      'Payment proof approved',
      v_actor
    );
  end if;

  insert into public.admin_audit_logs(
    admin_user_id, actor_user_id, action, target_type, target_id,
    old_values, new_values, reason
  )
  select
    au.id,
    v_actor,
    'payment.proof.review',
    'payment_proof',
    v_proof.id,
    jsonb_build_object(
      'review_status', 'pending',
      'order_payment_status', v_order.payment_status
    ),
    jsonb_build_object(
      'review_status', p_decision,
      'order_payment_status',
      case when p_decision = 'approved' then 'verified' else 'rejected' end
    ),
    p_note
  from public.admin_users au
  where au.user_id = v_actor;
end;
$function$;