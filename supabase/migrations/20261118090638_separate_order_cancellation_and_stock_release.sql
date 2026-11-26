
begin;

alter table public.inventory_reservations
  add column if not exists released_by uuid references auth.users(id) on delete set null,
  add column if not exists release_reason text;

alter table public.inventory_movements
  add column if not exists cancellation_request_id uuid references public.order_cancellation_requests(id) on delete restrict;

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
  if v_req.request_status='executed' then
    return;
  end if;
  if v_req.request_status<>'approved' then
    raise exception 'Approved cancellation request not found';
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

create or replace function public.release_reservation(
  p_reservation_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid:=auth.uid();
  v_res public.inventory_reservations%rowtype;
  v_order public.orders%rowtype;
  v_cancellation_id uuid;
  v_rows integer;
begin
  if v_actor is null or not app_private.has_permission('inventory.release') then
    raise exception 'Permission denied: inventory.release is required';
  end if;
  if nullif(trim(p_reason),'') is null then
    raise exception 'A release reason is required';
  end if;

  select * into v_res
  from public.inventory_reservations
  where id=p_reservation_id
  for update;

  if not found then raise exception 'Inventory reservation not found'; end if;

  if v_res.status='released' then
    return jsonb_build_object(
      'status','already_released',
      'reservation_id',v_res.id,
      'released_at',v_res.released_at
    );
  end if;
  if v_res.status<>'reserved' then
    raise exception 'Only a reserved inventory allocation can be released';
  end if;

  select * into v_order
  from public.orders
  where id=v_res.order_id
  for update;

  if not found or v_order.order_status<>'cancelled' then
    raise exception 'Cancel the order through the approved cancellation workflow before releasing its reserved stock';
  end if;

  select id into v_cancellation_id
  from public.order_cancellation_requests
  where order_id=v_order.id and request_status='executed'
  order by executed_at desc
  limit 1;

  if v_cancellation_id is null then
    raise exception 'An executed cancellation record is required before stock release';
  end if;

  if v_res.variant_id is null then
    update public.products
    set reserved_quantity=reserved_quantity-v_res.quantity
    where id=v_res.product_id and reserved_quantity>=v_res.quantity;
  else
    update public.product_variants
    set reserved_quantity=reserved_quantity-v_res.quantity
    where id=v_res.variant_id and reserved_quantity>=v_res.quantity;
  end if;
  get diagnostics v_rows = row_count;
  if v_rows<>1 then
    raise exception 'Reserved stock integrity check failed; no stock was released';
  end if;

  update public.inventory_reservations
  set status='released',
      released_at=now(),
      released_by=v_actor,
      release_reason=trim(p_reason)
  where id=v_res.id and status='reserved';

  insert into public.inventory_movements(
    product_id,variant_id,order_id,reservation_id,cancellation_request_id,
    movement_type,quantity_change,reason,event_key,created_by
  ) values (
    v_res.product_id,v_res.variant_id,v_order.id,v_res.id,v_cancellation_id,
    'release',v_res.quantity,trim(p_reason),
    v_order.id::text||':release:'||v_res.id::text,v_actor
  ) on conflict(event_key) do nothing;

  insert into public.admin_audit_logs(
    admin_user_id,actor_user_id,action,target_type,target_id,old_values,new_values,reason
  )
  select au.id,v_actor,'inventory.reservation.release','inventory_reservation',v_res.id,
         jsonb_build_object('status','reserved','reserved_quantity_reduction',0),
         jsonb_build_object('status','released','released_quantity',v_res.quantity,
                            'order_id',v_order.id,'cancellation_request_id',v_cancellation_id),
         trim(p_reason)
  from public.admin_users au where au.user_id=v_actor;

  return jsonb_build_object(
    'status','released',
    'reservation_id',v_res.id,
    'order_id',v_order.id,
    'cancellation_request_id',v_cancellation_id,
    'released_quantity',v_res.quantity
  );
end;
$function$;

revoke all on function public.release_reservation(uuid,text) from public,anon;
grant execute on function public.release_reservation(uuid,text) to authenticated;

commit;
