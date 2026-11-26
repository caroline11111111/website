
drop policy if exists roles_read_authorized on public.roles;
create policy roles_read_authorized on public.roles for select to authenticated using (app_private.is_admin_user() or app_private.is_owner());
drop policy if exists permissions_read_authorized on public.permissions;
create policy permissions_read_authorized on public.permissions for select to authenticated using (app_private.is_admin_user() or app_private.is_owner());
drop policy if exists admin_user_roles_read_authorized on public.admin_user_roles;
create policy admin_user_roles_read_authorized on public.admin_user_roles for select to authenticated using (app_private.is_admin_user() or app_private.is_owner());
drop policy if exists role_permissions_read_authorized on public.role_permissions;
create policy role_permissions_read_authorized on public.role_permissions for select to authenticated using (app_private.is_admin_user() or app_private.is_owner());

drop policy if exists products_public_read on public.products;
create policy products_public_read on public.products for select to anon,authenticated using (
 (is_published and not is_archived and (
   sold_out_display='show'
   or exists(select 1 from public.product_variants pv where pv.product_id=products.id and pv.is_active and pv.stock_quantity>pv.reserved_quantity)
   or (not exists(select 1 from public.product_variants pv where pv.product_id=products.id and pv.is_active) and stock_quantity>reserved_quantity)
 ))
 or app_private.has_permission('products.view')
);
drop policy if exists variants_public_read on public.product_variants;
create policy variants_public_read on public.product_variants for select to anon,authenticated using (
 is_active and exists(select 1 from public.products p where p.id=product_id and p.is_published and not p.is_archived
  and (p.sold_out_display='show' or product_variants.stock_quantity>product_variants.reserved_quantity))
 or app_private.has_permission('products.view')
);

create or replace function public.submit_order(
 p_cart_item_ids uuid[],p_recipient_name text,p_recipient_phone text,p_shipping_address jsonb,
 p_payment_proof_path text,p_original_filename text,p_mime_type text,p_file_size bigint,p_idempotency_key uuid
)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
 v_user uuid:=auth.uid();v_cart_id uuid;v_request public.order_submission_requests%rowtype;
 v_item record;v_product public.products%rowtype;v_variant public.product_variants%rowtype;
 v_order_id uuid;v_order_number text;v_subtotal numeric(12,2):=0;v_total_weight integer:=0;
 v_shipping_fee numeric(12,2);v_zone_id uuid;v_rate public.shipping_rates%rowtype;v_rate_count integer;
 v_item_price numeric(12,2);v_item_weight integer;v_brand text;v_image text;v_order_item_id uuid;v_submission integer;v_meta jsonb;v_count integer:=0;
begin
 if v_user is null then raise exception 'Authentication required';end if;
 if p_idempotency_key is null or coalesce(array_length(p_cart_item_ids,1),0)=0 then raise exception 'Selected cart items and idempotency key are required';end if;
 if nullif(trim(p_recipient_name),'') is null or nullif(trim(p_recipient_phone),'') is null then raise exception 'Recipient name and phone are required';end if;
 if p_shipping_address is null or jsonb_typeof(p_shipping_address)<>'object' then raise exception 'Valid shipping address is required';end if;
 if p_mime_type not in ('image/jpeg','image/png','application/pdf') or p_file_size<=0 or p_file_size>5242880 then raise exception 'Invalid payment proof file';end if;
 if (string_to_array(p_payment_proof_path,'/'))[1]<>v_user::text then raise exception 'Invalid payment proof path';end if;
 select metadata into v_meta from storage.objects where bucket_id='payment-proofs' and name=p_payment_proof_path;
 if not found then raise exception 'Payment proof upload not found';end if;
 if coalesce(v_meta->>'mimetype','')<>p_mime_type or coalesce((v_meta->>'size')::bigint,-1)<>p_file_size then raise exception 'Payment proof file metadata does not match upload';
 end if;
 insert into public.order_submission_requests(user_id,idempotency_key,request_status) values(v_user,p_idempotency_key,'processing') on conflict(user_id,idempotency_key) do nothing;
 select * into v_request from public.order_submission_requests where user_id=v_user and idempotency_key=p_idempotency_key for update;
 if v_request.request_status='completed' and v_request.order_id is not null then return jsonb_build_object('order_id',v_request.order_id,'status','completed','idempotent_replay',true);end if;
 if v_request.request_status='processing' and v_request.created_at<now()-interval '2 minutes' then update public.order_submission_requests set request_status='failed' where id=v_request.id;end if;
 select id into v_cart_id from public.carts where user_id=v_user and cart_status='active' for update;
 if v_cart_id is null then raise exception 'Active cart not found';end if;
 perform ci.id from public.cart_items ci where ci.cart_id=v_cart_id and ci.id=any(p_cart_item_ids) order by ci.id for update;
 select count(*) into v_count from public.cart_items ci where ci.cart_id=v_cart_id and ci.id=any(p_cart_item_ids);
 if v_count<>cardinality(p_cart_item_ids) then raise exception 'One or more selected cart items are invalid';end if;
 for v_item in select ci.* from public.cart_items ci where ci.cart_id=v_cart_id and ci.id=any(p_cart_item_ids) order by ci.product_id,ci.variant_id nulls first
 loop
  select * into v_product from public.products where id=v_item.product_id for update;
  if not found or not v_product.is_published or v_product.is_archived then raise exception 'A selected product is no longer available';end if;
  if v_item.variant_id is null then
   if exists(select 1 from public.product_variants where product_id=v_product.id and is_active) then raise exception 'Please select a product variant';end if;
   v_item_price:=v_product.price_myr;v_item_weight:=v_product.weight_grams;
   if v_product.stock_quantity-v_product.reserved_quantity<v_item.quantity then raise exception 'Insufficient stock for product %',v_product.name;end if;
  else
   select * into v_variant from public.product_variants where id=v_item.variant_id and product_id=v_product.id and is_active for update;
   if not found then raise exception 'Selected product variant is unavailable';end if;
   v_item_price:=v_variant.price_myr;v_item_weight:=v_variant.weight_grams;
   if v_variant.stock_quantity-v_variant.reserved_quantity<v_item.quantity then raise exception 'Insufficient stock for selected variant';end if;
  end if;
  v_subtotal:=v_subtotal+v_item_price*v_item.quantity;v_total_weight:=v_total_weight+v_item_weight*v_item.quantity;
 end loop;
 select id into v_zone_id from public.shipping_zones where is_active and country_code=upper(p_shipping_address->>'country_code')
  and (region_code is null or region_code=p_shipping_address->>'region_code') order by (region_code is not null) desc limit 1;
 if v_zone_id is null then raise exception 'Shipping is not available for this address';end if;
 select count(*) into v_rate_count from public.shipping_rates where zone_id=v_zone_id and is_active and v_total_weight>=min_weight_grams and v_total_weight<max_weight_grams;
 if v_rate_count<>1 then raise exception 'Shipping rate is missing or ambiguous for this weight';end if;
 select * into v_rate from public.shipping_rates where zone_id=v_zone_id and is_active and v_total_weight>=min_weight_grams and v_total_weight<max_weight_grams;
 v_shipping_fee:=v_rate.base_fee_myr;
 if v_rate.additional_unit_grams>0 and v_total_weight>v_rate.min_weight_grams then v_shipping_fee:=v_shipping_fee+ceil((v_total_weight-v_rate.min_weight_grams)::numeric/v_rate.additional_unit_grams)*v_rate.additional_fee_myr;end if;
 v_order_number:='ORD-'||to_char(now() at time zone 'utc','YYYYMMDD')||'-'||upper(substr(encode(gen_random_bytes(5),'hex'),1,10));
 insert into public.orders(order_number,user_id,recipient_name,recipient_phone,shipping_address,subtotal_myr,shipping_fee_myr,total_myr,order_status,payment_status)
 values(v_order_number,v_user,trim(p_recipient_name),trim(p_recipient_phone),p_shipping_address,v_subtotal,v_shipping_fee,v_subtotal+v_shipping_fee,'pending','verification_pending') returning id into v_order_id;
 for v_item in select ci.* from public.cart_items ci where ci.cart_id=v_cart_id and ci.id=any(p_cart_item_ids) order by ci.product_id,ci.variant_id nulls first
 loop
  select * into v_product from public.products where id=v_item.product_id;
  select b.name into v_brand from public.brands b where b.id=v_product.brand_id;
  select pi.storage_path into v_image from public.product_images pi where pi.product_id=v_product.id order by pi.is_primary desc,pi.display_order asc limit 1;
  if v_item.variant_id is null then
   v_item_price:=v_product.price_myr;
   insert into public.order_items(order_id,product_id,product_name,brand_name,product_image,unit_price_myr,quantity,line_total_myr)
   values(v_order_id,v_product.id,v_product.name,v_brand,v_image,v_item_price,v_item.quantity,v_item_price*v_item.quantity) returning id into v_order_item_id;
   update public.products set reserved_quantity=reserved_quantity+v_item.quantity where id=v_product.id;
  else
   select * into v_variant from public.product_variants where id=v_item.variant_id;
   v_item_price:=v_variant.price_myr;
   insert into public.order_items(order_id,product_id,variant_id,product_name,brand_name,product_image,variant_snapshot,unit_price_myr,quantity,line_total_myr)
   values(v_order_id,v_product.id,v_variant.id,v_product.name,v_brand,v_image,jsonb_build_object('name',v_variant.variant_name,'value',v_variant.variant_value,'sku',v_variant.sku,'weight_grams',v_variant.weight_grams),v_item_price,v_item.quantity,v_item_price*v_item.quantity) returning id into v_order_item_id;
   update public.product_variants set reserved_quantity=reserved_quantity+v_item.quantity where id=v_variant.id;
  end if;
  insert into public.inventory_reservations(order_id,order_item_id,product_id,variant_id,quantity,status)
  values(v_order_id,v_order_item_id,case when v_item.variant_id is null then v_product.id else null end,v_item.variant_id,v_item.quantity,'reserved');
  insert into public.inventory_movements(product_id,variant_id,order_id,reservation_id,movement_type,quantity_change,reason,event_key,created_by)
  values(case when v_item.variant_id is null then v_product.id else null end,v_item.variant_id,v_order_id,
   (select ir.id from public.inventory_reservations ir where ir.order_item_id=v_order_item_id),'reserve',-v_item.quantity,'Order inventory reservation',
   v_order_id::text||':reserve:'||v_order_item_id::text,v_user);
 end loop;
 select coalesce(max(submission_number),0)+1 into v_submission from public.payment_proofs where order_id=v_order_id;
 insert into public.payment_proofs(order_id,user_id,storage_path,original_filename,mime_type,file_size,submission_number)
 values(v_order_id,v_user,p_payment_proof_path,p_original_filename,p_mime_type,p_file_size,v_submission);
 insert into public.payment_status_history(order_id,old_status,new_status,reason,changed_by) values(v_order_id,null,'verification_pending','Order submitted with payment proof',v_user);
 insert into public.order_status_history(order_id,old_status,new_status,reason,changed_by) values(v_order_id,null,'pending','Order submitted',v_user);
 delete from public.cart_items where cart_id=v_cart_id and id=any(p_cart_item_ids);
 update public.order_submission_requests set request_status='completed',order_id=v_order_id,completed_at=now() where id=v_request.id;
 return jsonb_build_object('order_id',v_order_id,'order_number',v_order_number,'status','completed','idempotent_replay',false,'shipping_fee_myr',v_shipping_fee);
end;
$$;
revoke all on function public.submit_order(uuid[],text,text,jsonb,text,text,text,bigint,uuid) from public,anon;
grant execute on function public.submit_order(uuid[],text,text,jsonb,text,text,text,bigint,uuid) to authenticated;

create or replace function public.execute_order_cancellation(p_request_id uuid,p_reason text)
returns void language plpgsql security definer set search_path=''
as $$
declare v_req public.order_cancellation_requests%rowtype;v_order public.orders%rowtype;v_res public.inventory_reservations%rowtype;v_actor uuid:=auth.uid();
begin
 if v_actor is null or not app_private.has_permission('orders.cancel.execute') or not app_private.has_permission('inventory.release') then raise exception 'Permission denied: cancellation execution and inventory release permissions are both required';end if;
 if nullif(trim(p_reason),'') is null then raise exception 'Execution reason is required';end if;
 select * into v_req from public.order_cancellation_requests where id=p_request_id for update;
 if not found or v_req.request_status<>'approved' then raise exception 'Approved cancellation request not found';end if;
 select * into v_order from public.orders where id=v_req.order_id for update;
 if v_order.order_status not in ('pending','processing') then raise exception 'Order is no longer eligible for cancellation';end if;
 for v_res in select * from public.inventory_reservations where order_id=v_order.id and status='reserved' for update loop
  if v_res.variant_id is null then update public.products set reserved_quantity=reserved_quantity-v_res.quantity where id=v_res.product_id and reserved_quantity>=v_res.quantity;
  else update public.product_variants set reserved_quantity=reserved_quantity-v_res.quantity where id=v_res.variant_id and reserved_quantity>=v_res.quantity;end if;
  if not found then raise exception 'Reserved stock integrity check failed';end if;
  update public.inventory_reservations set status='released',released_at=now() where id=v_res.id;
  insert into public.inventory_movements(product_id,variant_id,order_id,reservation_id,movement_type,quantity_change,reason,event_key,created_by)
  values(v_res.product_id,v_res.variant_id,v_order.id,v_res.id,'release',v_res.quantity,trim(p_reason),v_order.id::text||':release:'||v_res.id::text,v_actor);
 end loop;
 update public.orders set order_status='cancelled',updated_at=now() where id=v_order.id;
 update public.order_cancellation_requests set request_status='executed',executed_by=v_actor,executed_at=now(),admin_note=concat_ws(E'\n',admin_note,trim(p_reason)),updated_at=now() where id=v_req.id;
 insert into public.order_status_history(order_id,old_status,new_status,reason,changed_by) values(v_order.id,v_order.order_status,'cancelled',trim(p_reason),v_actor);
 insert into public.admin_audit_logs(admin_user_id,actor_user_id,action,target_type,target_id,old_values,new_values,reason)
 select au.id,v_actor,'order.cancel.execute','order',v_order.id,jsonb_build_object('order_status',v_order.order_status),jsonb_build_object('order_status','cancelled'),trim(p_reason) from public.admin_users au where au.user_id=v_actor;
end;
$$;
revoke all on function public.execute_order_cancellation(uuid,text) from public,anon;
grant execute on function public.execute_order_cancellation(uuid,text) to authenticated;

create or replace function public.set_admin_role(p_target_user_id uuid,p_role_name text,p_assign boolean)
returns void language plpgsql security definer set search_path=''
as $$
declare v_actor uuid:=auth.uid();v_target_id uuid;v_role public.roles%rowtype;v_owner_id uuid;
begin
 if v_actor is null or not app_private.has_permission('admins.manage') then raise exception 'Permission denied';end if;
 select * into v_role from public.roles where name=p_role_name;
 if not found then raise exception 'Role not found';end if;
 select user_id into v_owner_id from app_private.owner_principal where singleton=true;
 if v_role.name='Owner' and (not app_private.is_owner() or p_target_user_id<>v_owner_id) then raise exception 'Only the current Owner may manage the Owner role, and it cannot be assigned to another identity';end if;
 select id into v_target_id from public.admin_users where user_id=p_target_user_id for update;
 if v_target_id is null then
  if not p_assign then raise exception 'Admin user not found';end if;
  insert into public.admin_users(user_id,is_active) values(p_target_user_id,true) returning id into v_target_id;
 end if;
 if p_assign then
  insert into public.admin_user_roles(admin_user_id,role_id,assigned_by) values(v_target_id,v_role.id,v_actor) on conflict do nothing;
 else
  delete from public.admin_user_roles where admin_user_id=v_target_id and role_id=v_role.id;
 end if;
 insert into public.admin_audit_logs(admin_user_id,actor_user_id,action,target_type,target_id,new_values)
 select au.id,v_actor,case when p_assign then 'admin.role.assign' else 'admin.role.revoke' end,'admin_user',v_target_id,jsonb_build_object('role',p_role_name) from public.admin_users au where au.user_id=v_actor;
end;
$$;
revoke all on function public.set_admin_role(uuid,text,boolean) from public,anon;
grant execute on function public.set_admin_role(uuid,text,boolean) to authenticated;

drop policy if exists roles_read_authorized on public.roles;
create policy roles_read_authorized on public.roles for select to authenticated using (app_private.is_admin_user() or app_private.is_owner());
