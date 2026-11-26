
create or replace function public.execute_order_cancellation(p_request_id uuid,p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_req public.order_cancellation_requests%rowtype;
  v_order public.orders%rowtype;
  v_actor uuid:=auth.uid();
begin
  if v_actor is null or not app_private.has_permission('orders.cancel.execute') then
    raise exception 'Permission denied: orders.cancel.execute is required';
  end if;
  if nullif(trim(p_reason),'') is null then
    raise exception 'Execution reason is required';
  end if;

  select * into v_req
  from public.order_cancellation_requests
  where id=p_request_id
  for update;

  if not found then raise exception 'Cancellation request not found'; end if;
  if v_req.request_status='executed' then return; end if;
  if v_req.request_status<>'approved' then
    raise exception 'Approved cancellation request not found';
  end if;

  if v_req.approved_by=v_actor and not app_private.has_permission('orders.cancel.approve') then
    raise exception 'Self-approved cancellation execution requires both orders.cancel.approve and orders.cancel.execute';
  end if;

  select * into v_order
  from public.orders
  where id=v_req.order_id
  for update;

  if v_order.order_status not in ('pending','processing') then
    raise exception 'Order is no longer eligible for cancellation';
  end if;

  update public.orders
  set order_status='cancelled',updated_at=now()
  where id=v_order.id;

  update public.order_cancellation_requests
  set request_status='executed',
      executed_by=v_actor,
      executed_at=now(),
      admin_note=concat_ws(E'\n',admin_note,trim(p_reason)),
      updated_at=now()
  where id=v_req.id;

  insert into public.order_status_history(order_id,old_status,new_status,reason,changed_by)
  values(v_order.id,v_order.order_status,'cancelled',trim(p_reason),v_actor);

  insert into public.admin_audit_logs(admin_user_id,actor_user_id,action,target_type,target_id,old_values,new_values,reason)
  select au.id,v_actor,'order.cancel.execute','order',v_order.id,
         jsonb_build_object('order_status',v_order.order_status,'reserved_stock_released',false),
         jsonb_build_object('order_status','cancelled','reserved_stock_released',false),
         trim(p_reason)
  from public.admin_users au where au.user_id=v_actor;
  -- Inventory reservations intentionally remain reserved until the separate inventory.release action.
end;
$function$;
