
create or replace function public.admin_review_payment(
 p_payment_proof_id uuid,
 p_decision text,
 p_note text
)
returns void language plpgsql security definer
set search_path = ''
as $$
declare v_proof public.payment_proofs%rowtype; v_order public.orders%rowtype; v_actor uuid:=auth.uid();
begin
 if v_actor is null or not app_private.has_permission('payments.review') then raise exception 'Permission denied'; end if;
 if p_decision not in ('approved','rejected') then raise exception 'Invalid review decision'; end if;
 select * into v_proof from public.payment_proofs where id=p_payment_proof_id for update;
 if not found then raise exception 'Payment proof not found'; end if;
 select * into v_order from public.orders where id=v_proof.order_id for update;
 if v_proof.review_status<>'pending' or v_order.payment_status<>'verification_pending' then
   raise exception 'This payment proof or order has already been reviewed';
 end if;
 update public.payment_proofs set review_status=p_decision,reviewed_by=v_actor,reviewed_at=now(),review_note=nullif(trim(p_note),'')
 where id=v_proof.id;
 update public.orders set payment_status=case when p_decision='approved' then 'verified' else 'rejected' end,
  order_status=case when p_decision='approved' then 'processing' else order_status end,updated_at=now()
 where id=v_order.id;
 insert into public.payment_status_history(order_id,payment_proof_id,old_status,new_status,reason,changed_by)
 values(v_order.id,v_proof.id,v_order.payment_status,
  case when p_decision='approved' then 'verified' else 'rejected' end,
  coalesce(nullif(trim(p_note),''),'Payment proof reviewed'),v_actor);
 if p_decision='approved' then
  insert into public.order_status_history(order_id,old_status,new_status,reason,changed_by)
  values(v_order.id,v_order.order_status,'processing','Payment proof approved',v_actor);
 end if;
 insert into public.admin_audit_logs(admin_user_id,actor_user_id,action,target_type,target_id,old_values,new_values,reason)
 select au.id,v_actor,'payment.proof.review','payment_proof',v_proof.id,
  jsonb_build_object('review_status','pending','order_payment_status',v_order.payment_status),
  jsonb_build_object('review_status',p_decision,'order_payment_status',case when p_decision='approved' then 'verified' else 'rejected' end),
  p_note from public.admin_users au where au.user_id=v_actor;
end;
$$;
revoke all on function public.admin_review_payment(uuid,text,text) from public,anon;
grant execute on function public.admin_review_payment(uuid,text,text) to authenticated;

create or replace function public.request_order_cancellation(p_order_id uuid,p_reason text)
returns uuid language plpgsql security definer
set search_path = ''
as $$
declare v_user uuid:=auth.uid(); v_order public.orders%rowtype; v_request uuid;
begin
 if v_user is null then raise exception 'Authentication required'; end if;
 if nullif(trim(p_reason),'') is null then raise exception 'Cancellation reason is required'; end if;
 select * into v_order from public.orders where id=p_order_id and user_id=v_user for update;
 if not found then raise exception 'Order not found'; end if;
 if v_order.order_status not in ('pending','processing') then raise exception 'This order can no longer be cancelled through the standard process'; end if;
 insert into public.order_cancellation_requests(order_id,user_id,request_reason)
 values(p_order_id,v_user,trim(p_reason)) returning id into v_request;
 return v_request;
end;
$$;
revoke all on function public.request_order_cancellation(uuid,text) from public,anon;
grant execute on function public.request_order_cancellation(uuid,text) to authenticated;

create or replace function public.review_order_cancellation(
 p_request_id uuid,p_decision text,p_admin_note text default null
)
returns void language plpgsql security definer
set search_path = ''
as $$
declare v_req public.order_cancellation_requests%rowtype; v_actor uuid:=auth.uid();
begin
 if v_actor is null or not app_private.has_permission('orders.cancel.approve') then raise exception 'Permission denied'; end if;
 if p_decision not in ('approved','rejected') then raise exception 'Invalid decision'; end if;
 select * into v_req from public.order_cancellation_requests where id=p_request_id for update;
 if not found or v_req.request_status<>'pending' then raise exception 'Pending cancellation request not found'; end if;
 perform 1 from public.orders where id=v_req.order_id and order_status in ('pending','processing') for update;
 if not found then raise exception 'Order is no longer eligible for cancellation'; end if;
 update public.order_cancellation_requests set request_status=p_decision,
  approved_by=case when p_decision='approved' then v_actor else null end,
  approved_at=case when p_decision='approved' then now() else null end,
  admin_note=nullif(trim(p_admin_note),''),
  updated_at=now()
 where id=v_req.id;
 insert into public.admin_audit_logs(admin_user_id,actor_user_id,action,target_type,target_id,new_values,reason)
 select au.id,v_actor,'order.cancellation.'||p_decision,'cancellation_request',v_req.id,
  jsonb_build_object('request_status',p_decision),p_admin_note from public.admin_users au where au.user_id=v_actor;
end;
$$;
revoke all on function public.review_order_cancellation(uuid,text,text) from public,anon;
grant execute on function public.review_order_cancellation(uuid,text,text) to authenticated;

create or replace function public.execute_order_cancellation(p_request_id uuid,p_reason text)
returns void language plpgsql security definer
set search_path = ''
as $$
declare v_req public.order_cancellation_requests%rowtype; v_order public.orders%rowtype; v_res public.inventory_reservations%rowtype; v_actor uuid:=auth.uid();
begin
 if v_actor is null or not app_private.has_permission('orders.cancel.execute') then raise exception 'Permission denied'; end if;
 if nullif(trim(p_reason),'') is null then raise exception 'Execution reason is required'; end if;
 select * into v_req from public.order_cancellation_requests where id=p_request_id for update;
 if not found or v_req.request_status<>'approved' then raise exception 'Approved cancellation request not found'; end if;
 select * into v_order from public.orders where id=v_req.order_id for update;
 if v_order.order_status not in ('pending','processing') then raise exception 'Order is no longer eligible for cancellation'; end if;
 for v_res in select * from public.inventory_reservations where order_id=v_order.id and status='reserved' for update
 loop
  if v_res.variant_id is null then
   update public.products set reserved_quantity=reserved_quantity-v_res.quantity
   where id=v_res.product_id and reserved_quantity>=v_res.quantity;
  else
   update public.product_variants set reserved_quantity=reserved_quantity-v_res.quantity
   where id=v_res.variant_id and reserved_quantity>=v_res.quantity;
  end if;
  if not found then raise exception 'Reserved stock integrity check failed'; end if;
  update public.inventory_reservations set status='released',released_at=now() where id=v_res.id;
  insert into public.inventory_movements(product_id,variant_id,order_id,reservation_id,movement_type,quantity_change,reason,event_key,created_by)
  values(v_res.product_id,v_res.variant_id,v_order.id,v_res.id,'release',v_res.quantity,trim(p_reason),
    v_order.id::text||':release:'||v_res.id::text,v_actor);
 end loop;
 update public.orders set order_status='cancelled',updated_at=now() where id=v_order.id;
 update public.order_cancellation_requests set request_status='executed',executed_by=v_actor,executed_at=now(),
  admin_note=concat_ws(E'\n',admin_note,trim(p_reason)),updated_at=now() where id=v_req.id;
 insert into public.order_status_history(order_id,old_status,new_status,reason,changed_by)
 values(v_order.id,v_order.order_status,'cancelled',trim(p_reason),v_actor);
 insert into public.admin_audit_logs(admin_user_id,actor_user_id,action,target_type,target_id,old_values,new_values,reason)
 select au.id,v_actor,'order.cancel.execute','order',v_order.id,
  jsonb_build_object('order_status',v_order.order_status),jsonb_build_object('order_status','cancelled'),trim(p_reason)
 from public.admin_users au where au.user_id=v_actor;
end;
$$;
revoke all on function public.execute_order_cancellation(uuid,text) from public,anon;
grant execute on function public.execute_order_cancellation(uuid,text) to authenticated;

create or replace function public.request_shipping_address_change(
 p_order_id uuid,p_recipient_name text,p_recipient_phone text,p_address jsonb,p_reason text default null
)
returns uuid language plpgsql security definer
set search_path = ''
as $$
declare v_user uuid:=auth.uid(); v_order public.orders%rowtype; v_id uuid;
begin
 if v_user is null then raise exception 'Authentication required'; end if;
 select * into v_order from public.orders where id=p_order_id and user_id=v_user for update;
 if not found or v_order.order_status<>'pending' then raise exception 'Only pending orders can request address changes'; end if;
 if nullif(trim(p_recipient_name),'') is null or nullif(trim(p_recipient_phone),'') is null or jsonb_typeof(p_address)<>'object' then
  raise exception 'Complete recipient and address details are required';
 end if;
 insert into public.order_shipping_change_requests(order_id,user_id,original_recipient_name,original_recipient_phone,
  original_shipping_address,requested_recipient_name,requested_recipient_phone,requested_shipping_address,customer_reason)
 values(v_order.id,v_user,v_order.recipient_name,v_order.recipient_phone,v_order.shipping_address,
  trim(p_recipient_name),trim(p_recipient_phone),p_address,p_reason) returning id into v_id;
 return v_id;
end;
$$;
revoke all on function public.request_shipping_address_change(uuid,text,text,jsonb,text) from public,anon;
grant execute on function public.request_shipping_address_change(uuid,text,text,jsonb,text) to authenticated;

create or replace function public.review_shipping_address_change(p_request_id uuid,p_decision text,p_admin_note text default null)
returns void language plpgsql security definer
set search_path = ''
as $$
declare v_req public.order_shipping_change_requests%rowtype; v_order public.orders%rowtype; v_actor uuid:=auth.uid();
begin
 if v_actor is null or not app_private.has_permission('orders.shipping_address.review') then raise exception 'Permission denied'; end if;
 if p_decision not in ('approved','rejected') then raise exception 'Invalid decision'; end if;
 select * into v_req from public.order_shipping_change_requests where id=p_request_id for update;
 if not found or v_req.request_status<>'pending' then raise exception 'Pending address change request not found'; end if;
 select * into v_order from public.orders where id=v_req.order_id for update;
 if v_order.order_status<>'pending' then raise exception 'Order is no longer eligible for address changes'; end if;
 if p_decision='approved' then
  update public.orders set recipient_name=v_req.requested_recipient_name,
   recipient_phone=v_req.requested_recipient_phone,shipping_address=v_req.requested_shipping_address,updated_at=now()
  where id=v_order.id;
 end if;
 update public.order_shipping_change_requests set request_status=p_decision,reviewed_by=v_actor,reviewed_at=now(),
  admin_note=nullif(trim(p_admin_note),''),updated_at=now() where id=v_req.id;
 insert into public.admin_audit_logs(admin_user_id,actor_user_id,action,target_type,target_id,old_values,new_values,reason)
 select au.id,v_actor,'order.shipping_address.'||p_decision,'shipping_change_request',v_req.id,
  jsonb_build_object('recipient_name',v_order.recipient_name,'recipient_phone',v_order.recipient_phone,'address',v_order.shipping_address),
  case when p_decision='approved' then jsonb_build_object('recipient_name',v_req.requested_recipient_name,'recipient_phone',v_req.requested_recipient_phone,'address',v_req.requested_shipping_address) else null end,
  p_admin_note from public.admin_users au where au.user_id=v_actor;
end;
$$;
revoke all on function public.review_shipping_address_change(uuid,text,text) from public,anon;
grant execute on function public.review_shipping_address_change(uuid,text,text) to authenticated;

create or replace function public.confirm_order_received(p_order_id uuid)
returns void language plpgsql security definer
set search_path = ''
as $$
declare v_user uuid:=auth.uid(); v_order public.orders%rowtype;
begin
 if v_user is null then raise exception 'Authentication required'; end if;
 select * into v_order from public.orders where id=p_order_id and user_id=v_user for update;
 if not found or v_order.order_status<>'shipped' then raise exception 'Only your shipped orders can be confirmed'; end if;
 update public.orders set order_status='completed',updated_at=now() where id=v_order.id;
 insert into public.order_status_history(order_id,old_status,new_status,reason,changed_by)
 values(v_order.id,'shipped','completed','Customer confirmed receipt',v_user);
end;
$$;
revoke all on function public.confirm_order_received(uuid) from public,anon;
grant execute on function public.confirm_order_received(uuid) to authenticated;

create or replace function public.admin_complete_order(p_order_id uuid,p_reason text)
returns void language plpgsql security definer
set search_path = ''
as $$
declare v_order public.orders%rowtype; v_actor uuid:=auth.uid();
begin
 if v_actor is null or not app_private.has_permission('orders.complete') then raise exception 'Permission denied'; end if;
 if nullif(trim(p_reason),'') is null then raise exception 'Completion reason is required'; end if;
 select * into v_order from public.orders where id=p_order_id for update;
 if not found or v_order.order_status<>'shipped' then raise exception 'Only shipped orders can be completed'; end if;
 update public.orders set order_status='completed',updated_at=now() where id=v_order.id;
 insert into public.order_status_history(order_id,old_status,new_status,reason,changed_by)
 values(v_order.id,'shipped','completed',trim(p_reason),v_actor);
 insert into public.admin_audit_logs(admin_user_id,actor_user_id,action,target_type,target_id,old_values,new_values,reason)
 select au.id,v_actor,'order.complete','order',v_order.id,
  jsonb_build_object('order_status','shipped'),jsonb_build_object('order_status','completed'),trim(p_reason)
 from public.admin_users au where au.user_id=v_actor;
end;
$$;
revoke all on function public.admin_complete_order(uuid,text) from public,anon;
grant execute on function public.admin_complete_order(uuid,text) to authenticated;

create or replace function public.create_shipment(
 p_order_id uuid,p_shipment_number text,p_carrier text,p_tracking_number text,p_tracking_url text,p_items jsonb
)
returns uuid language plpgsql security definer
set search_path = ''
as $$
declare v_actor uuid:=auth.uid(); v_order public.orders%rowtype; v_ship uuid; v_line jsonb; v_item public.order_items%rowtype; v_qty integer; v_reserved public.inventory_reservations%rowtype; v_sent integer;
begin
 if v_actor is null or not app_private.has_permission('shipments.manage') then raise exception 'Permission denied'; end if;
 if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 then raise exception 'Shipment items are required'; end if;
 select * into v_order from public.orders where id=p_order_id for update;
 if not found or v_order.order_status<>'processing' then raise exception 'Only processing orders can be shipped'; end if;
 insert into public.shipments(order_id,shipment_number,carrier_name,tracking_number,tracking_url,shipment_status,shipped_at,created_by)
 values(p_order_id,p_shipment_number,p_carrier,p_tracking_number,p_tracking_url,'shipped',now(),v_actor)
 returning id into v_ship;
 for v_line in select * from jsonb_array_elements(p_items)
 loop
  select * into v_item from public.order_items where id=(v_line->>'order_item_id')::uuid and order_id=p_order_id for update;
  if not found then raise exception 'Shipment item does not belong to this order'; end if;
  v_qty:=(v_line->>'quantity')::integer;
  if v_qty<=0 then raise exception 'Shipment quantity must be positive'; end if;
  select coalesce(sum(si.quantity),0) into v_sent from public.shipment_items si join public.shipments s on s.id=si.shipment_id
   where si.order_item_id=v_item.id;
  if v_sent+v_qty>v_item.quantity then raise exception 'Shipment quantity exceeds ordered quantity'; end if;
  insert into public.shipment_items(shipment_id,order_item_id,quantity) values(v_ship,v_item.id,v_qty);
  for v_reserved in select * from public.inventory_reservations where order_item_id=v_item.id and status='reserved' order by created_at for update
  loop
   exit when v_qty=0;
   if v_reserved.quantity<=v_qty then
    if v_reserved.variant_id is null then
     update public.products set reserved_quantity=reserved_quantity-v_reserved.quantity,stock_quantity=stock_quantity-v_reserved.quantity
      where id=v_reserved.product_id and reserved_quantity>=v_reserved.quantity and stock_quantity>=v_reserved.quantity;
    else
     update public.product_variants set reserved_quantity=reserved_quantity-v_reserved.quantity,stock_quantity=stock_quantity-v_reserved.quantity
      where id=v_reserved.variant_id and reserved_quantity>=v_reserved.quantity and stock_quantity>=v_reserved.quantity;
    end if;
    if not found then raise exception 'Inventory consumption integrity check failed'; end if;
    update public.inventory_reservations set status='consumed',consumed_at=now() where id=v_reserved.id;
    insert into public.inventory_movements(product_id,variant_id,order_id,reservation_id,movement_type,quantity_change,reason,event_key,created_by)
    values(v_reserved.product_id,v_reserved.variant_id,p_order_id,v_reserved.id,'consume',-v_reserved.quantity,
      'Shipment dispatched',p_order_id::text||':consume:'||v_reserved.id::text,v_actor);
    v_qty:=v_qty-v_reserved.quantity;
   else
    raise exception 'Partial reservation consumption requires a split reservation; ship complete reservation quantities per line in this release';
   end if;
  end loop;
  if v_qty<>0 then raise exception 'Insufficient reserved inventory for shipment'; end if;
 end loop;
 if not exists(
  select 1 from public.order_items oi
  where oi.order_id=p_order_id and
   (select coalesce(sum(si.quantity),0) from public.shipment_items si join public.shipments s on s.id=si.shipment_id where si.order_item_id=oi.id)<oi.quantity
 ) then
  update public.orders set order_status='shipped',updated_at=now() where id=p_order_id;
  insert into public.order_status_history(order_id,old_status,new_status,reason,changed_by)
  values(p_order_id,'processing','shipped','All order items have been dispatched',v_actor);
 end if;
 insert into public.admin_audit_logs(admin_user_id,actor_user_id,action,target_type,target_id,new_values)
 select au.id,v_actor,'shipment.create','shipment',v_ship,jsonb_build_object('shipment_number',p_shipment_number)
 from public.admin_users au where au.user_id=v_actor;
 return v_ship;
end;
$$;
revoke all on function public.create_shipment(uuid,text,text,text,text,jsonb) from public,anon;
grant execute on function public.create_shipment(uuid,text,text,text,text,jsonb) to authenticated;
