
grant usage on schema public to anon, authenticated;
grant usage on schema app_private to anon, authenticated;
grant execute on function app_private.is_owner() to anon, authenticated;
grant execute on function app_private.is_admin_user() to anon, authenticated;
grant execute on function app_private.has_permission(text) to anon, authenticated;

revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

alter table public.products add column if not exists weight_grams integer not null default 0 check (weight_grams >= 0);

create unique index if not exists products_sku_ci_unique on public.products(lower(sku));
create unique index if not exists product_variants_sku_ci_unique on public.product_variants(lower(sku));
create unique index if not exists shipping_zones_one_active_match
 on public.shipping_zones(country_code,coalesce(region_code,'*')) where is_active;
create index if not exists cart_items_cart_idx on public.cart_items(cart_id);
create index if not exists cart_items_product_idx on public.cart_items(product_id);
create index if not exists cart_items_variant_idx on public.cart_items(variant_id) where variant_id is not null;
create index if not exists order_items_order_idx on public.order_items(order_id);
create index if not exists order_items_product_idx on public.order_items(product_id);
create index if not exists order_items_variant_idx on public.order_items(variant_id) where variant_id is not null;
create index if not exists inventory_reservations_order_idx on public.inventory_reservations(order_id);
create index if not exists inventory_reservations_item_idx on public.inventory_reservations(order_item_id);
create index if not exists inventory_reservations_product_idx on public.inventory_reservations(product_id);
create index if not exists inventory_reservations_variant_idx on public.inventory_reservations(variant_id) where variant_id is not null;
create index if not exists inventory_movements_product_idx on public.inventory_movements(product_id,created_at desc);
create index if not exists inventory_movements_variant_idx on public.inventory_movements(variant_id,created_at desc) where variant_id is not null;
create index if not exists inventory_movements_order_idx on public.inventory_movements(order_id);
create index if not exists inventory_movements_reservation_idx on public.inventory_movements(reservation_id);
create index if not exists inventory_movements_actor_idx on public.inventory_movements(created_by);
create index if not exists payment_proofs_user_idx on public.payment_proofs(user_id,created_at desc);
create index if not exists payment_proofs_reviewer_idx on public.payment_proofs(reviewed_by);
create index if not exists payment_history_order_idx on public.payment_status_history(order_id,created_at desc);
create index if not exists payment_history_proof_idx on public.payment_status_history(payment_proof_id);
create index if not exists payment_history_actor_idx on public.payment_status_history(changed_by);
create index if not exists order_history_order_idx on public.order_status_history(order_id,created_at desc);
create index if not exists order_history_actor_idx on public.order_status_history(changed_by);
create index if not exists cancellation_user_idx on public.order_cancellation_requests(user_id,created_at desc);
create index if not exists cancellation_approver_idx on public.order_cancellation_requests(approved_by);
create index if not exists cancellation_executor_idx on public.order_cancellation_requests(executed_by);
create index if not exists shipping_change_user_idx on public.order_shipping_change_requests(user_id,created_at desc);
create index if not exists shipping_change_reviewer_idx on public.order_shipping_change_requests(reviewed_by);
create index if not exists shipment_items_order_item_idx on public.shipment_items(order_item_id);
create index if not exists shipments_created_by_idx on public.shipments(created_by);
create index if not exists site_settings_updated_by_idx on public.site_settings(updated_by);
create index if not exists admin_users_created_by_placeholder_idx on public.admin_users(user_id);
create index if not exists admin_user_roles_role_idx on public.admin_user_roles(role_id);
create index if not exists admin_user_roles_assigned_by_idx on public.admin_user_roles(assigned_by);
create index if not exists role_permissions_permission_idx on public.role_permissions(permission_id);
create index if not exists role_permissions_assigned_by_idx on public.role_permissions(assigned_by);
create index if not exists admin_audit_admin_user_idx on public.admin_audit_logs(admin_user_id);
create index if not exists owner_principal_established_by_idx on app_private.owner_principal(established_by);
create index if not exists owner_recovery_audit_actor_idx on app_private.owner_recovery_audit_logs(actor_user_id);

drop policy if exists products_admin_manage on public.products;
drop policy if exists variants_admin_manage on public.product_variants;
drop policy if exists images_admin_manage on public.product_images;
drop policy if exists brands_admin_manage on public.brands;
drop policy if exists categories_admin_manage on public.categories;
drop policy if exists content_admin_manage_slides on public.homepage_slides;
drop policy if exists content_admin_manage_banners on public.homepage_banners;
drop policy if exists content_admin_manage_about on public.about_images;
drop policy if exists settings_admin_manage on public.site_settings;
drop policy if exists shipping_zones_admin_manage on public.shipping_zones;
drop policy if exists shipping_rates_admin_manage on public.shipping_rates;

create policy "products_insert_authorized" on public.products for insert to authenticated
 with check (app_private.has_permission('products.create'));
create policy "products_update_authorized" on public.products for update to authenticated
 using (app_private.has_permission('products.edit') or app_private.has_permission('products.archive') or app_private.has_permission('products.restore'))
 with check (app_private.has_permission('products.edit') or app_private.has_permission('products.archive') or app_private.has_permission('products.restore'));

create policy "variants_insert_authorized" on public.product_variants for insert to authenticated
 with check (app_private.has_permission('products.create'));
create policy "variants_update_authorized" on public.product_variants for update to authenticated
 using (app_private.has_permission('products.edit')) with check (app_private.has_permission('products.edit'));
create policy "images_insert_authorized" on public.product_images for insert to authenticated
 with check (app_private.has_permission('products.create') or app_private.has_permission('products.edit'));
create policy "images_update_authorized" on public.product_images for update to authenticated
 using (app_private.has_permission('products.edit')) with check (app_private.has_permission('products.edit'));
create policy "images_delete_authorized" on public.product_images for delete to authenticated
 using (app_private.has_permission('products.edit'));
create policy "brands_insert_authorized" on public.brands for insert to authenticated
 with check (app_private.has_permission('products.create'));
create policy "brands_update_authorized" on public.brands for update to authenticated
 using (app_private.has_permission('products.edit')) with check (app_private.has_permission('products.edit'));
create policy "categories_insert_authorized" on public.categories for insert to authenticated
 with check (app_private.has_permission('products.create'));
create policy "categories_update_authorized" on public.categories for update to authenticated
 using (app_private.has_permission('products.edit')) with check (app_private.has_permission('products.edit'));

create policy "slides_insert_authorized" on public.homepage_slides for insert to authenticated
 with check (app_private.has_permission('content.manage'));
create policy "slides_update_authorized" on public.homepage_slides for update to authenticated
 using (app_private.has_permission('content.manage')) with check (app_private.has_permission('content.manage'));
create policy "slides_delete_authorized" on public.homepage_slides for delete to authenticated
 using (app_private.has_permission('content.manage'));
create policy "banners_insert_authorized" on public.homepage_banners for insert to authenticated
 with check (app_private.has_permission('content.manage'));
create policy "banners_update_authorized" on public.homepage_banners for update to authenticated
 using (app_private.has_permission('content.manage')) with check (app_private.has_permission('content.manage'));
create policy "banners_delete_authorized" on public.homepage_banners for delete to authenticated
 using (app_private.has_permission('content.manage'));
create policy "about_images_insert_authorized" on public.about_images for insert to authenticated
 with check (app_private.has_permission('content.manage'));
create policy "about_images_update_authorized" on public.about_images for update to authenticated
 using (app_private.has_permission('content.manage')) with check (app_private.has_permission('content.manage'));
create policy "about_images_delete_authorized" on public.about_images for delete to authenticated
 using (app_private.has_permission('content.manage'));
create policy "settings_insert_authorized" on public.site_settings for insert to authenticated
 with check (app_private.has_permission('settings.manage'));
create policy "settings_update_authorized" on public.site_settings for update to authenticated
 using (app_private.has_permission('settings.manage')) with check (app_private.has_permission('settings.manage'));

create policy "shipping_zones_insert_authorized" on public.shipping_zones for insert to authenticated
 with check (app_private.has_permission('shipping_rates.manage'));
create policy "shipping_zones_update_authorized" on public.shipping_zones for update to authenticated
 using (app_private.has_permission('shipping_rates.manage')) with check (app_private.has_permission('shipping_rates.manage'));
create policy "shipping_zones_delete_authorized" on public.shipping_zones for delete to authenticated
 using (app_private.has_permission('shipping_rates.manage'));
create policy "shipping_rates_insert_authorized" on public.shipping_rates for insert to authenticated
 with check (app_private.has_permission('shipping_rates.manage'));
create policy "shipping_rates_update_authorized" on public.shipping_rates for update to authenticated
 using (app_private.has_permission('shipping_rates.manage')) with check (app_private.has_permission('shipping_rates.manage'));
create policy "shipping_rates_delete_authorized" on public.shipping_rates for delete to authenticated
 using (app_private.has_permission('shipping_rates.manage'));

grant select on public.inventory_reservations,public.inventory_movements,public.order_submission_requests to authenticated;
create policy "inventory_reservations_admin_read" on public.inventory_reservations for select to authenticated
 using (app_private.has_permission('inventory.view'));
create policy "inventory_movements_admin_read" on public.inventory_movements for select to authenticated
 using (app_private.has_permission('inventory.view'));
create policy "order_submission_request_own_read" on public.order_submission_requests for select to authenticated
 using (user_id=(select auth.uid()));

create or replace function public.get_my_admin_access()
returns jsonb language sql stable security invoker
set search_path = ''
as $$
 select jsonb_build_object(
   'is_admin', app_private.is_admin_user(),
   'is_owner', app_private.is_owner(),
   'permissions', coalesce((
     select jsonb_agg(distinct p.code order by p.code)
     from public.admin_users au
     join public.admin_user_roles aur on aur.admin_user_id=au.id
     join public.role_permissions rp on rp.role_id=aur.role_id
     join public.permissions p on p.id=rp.permission_id
     where au.user_id=(select auth.uid()) and au.is_active
   ),'[]'::jsonb)
 )
$$;
revoke all on function public.get_my_admin_access() from public,anon;
grant execute on function public.get_my_admin_access() to authenticated;

create or replace function public.get_or_create_my_cart()
returns uuid language plpgsql security definer
set search_path = ''
as $$
declare v_user uuid := auth.uid(); v_cart uuid;
begin
 if v_user is null then raise exception 'Authentication required'; end if;
 select id into v_cart from public.carts
 where user_id=v_user and cart_status='active'
 for update;
 if v_cart is null then
   insert into public.carts(user_id) values(v_user) returning id into v_cart;
 end if;
 return v_cart;
end;
$$;
revoke all on function public.get_or_create_my_cart() from public,anon;
grant execute on function public.get_or_create_my_cart() to authenticated;

create or replace function public.submit_order(
 p_cart_item_ids uuid[],
 p_recipient_name text,
 p_recipient_phone text,
 p_shipping_address jsonb,
 p_payment_proof_path text,
 p_original_filename text,
 p_mime_type text,
 p_file_size bigint,
 p_idempotency_key uuid
)
returns jsonb language plpgsql security definer
set search_path = ''
as $$
declare
 v_user uuid := auth.uid();
 v_cart_id uuid;
 v_request public.order_submission_requests%rowtype;
 v_item record;
 v_product public.products%rowtype;
 v_variant public.product_variants%rowtype;
 v_order_id uuid;
 v_order_number text;
 v_subtotal numeric(12,2) := 0;
 v_total_weight integer := 0;
 v_shipping_fee numeric(12,2);
 v_zone_id uuid;
 v_rate record;
 v_rate_count integer;
 v_item_price numeric(12,2);
 v_item_weight integer;
 v_brand text;
 v_image text;
 v_order_item_id uuid;
 v_submission integer;
 v_file_meta jsonb;
 v_count integer := 0;
begin
 if v_user is null then raise exception 'Authentication required'; end if;
 if p_idempotency_key is null then raise exception 'Idempotency key required'; end if;
 if coalesce(array_length(p_cart_item_ids,1),0)=0 then raise exception 'Select at least one cart item'; end if;
 if nullif(trim(p_recipient_name),'') is null or nullif(trim(p_recipient_phone),'') is null then
   raise exception 'Recipient name and phone are required';
 end if;
 if p_shipping_address is null or jsonb_typeof(p_shipping_address)<>'object' then
   raise exception 'Valid shipping address is required';
 end if;
 if p_mime_type not in ('image/jpeg','image/png','application/pdf') or p_file_size<=0 or p_file_size>5242880 then
   raise exception 'Invalid payment proof file';
 end if;
 if (string_to_array(p_payment_proof_path,'/'))[1] <> v_user::text then
   raise exception 'Invalid payment proof path';
 end if;
 select metadata into v_file_meta from storage.objects
 where bucket_id='payment-proofs' and name=p_payment_proof_path;
 if not found then raise exception 'Payment proof upload not found'; end if;
 if coalesce(v_file_meta->>'mimetype','') <> p_mime_type then
   raise exception 'Uploaded file MIME type mismatch';
 end if;
 if coalesce((v_file_meta->>'size')::bigint,p_file_size) <> p_file_size then
   raise exception 'Uploaded file size mismatch';
 end if;

 insert into public.order_submission_requests(user_id,idempotency_key,request_status)
 values(v_user,p_idempotency_key,'processing')
 on conflict(user_id,idempotency_key) do nothing;
 select * into v_request from public.order_submission_requests
 where user_id=v_user and idempotency_key=p_idempotency_key for update;
 if v_request.request_status='completed' and v_request.order_id is not null then
   return jsonb_build_object('order_id',v_request.order_id,'status','completed','idempotent_replay',true);
 end if;
 if v_request.request_status='processing' and v_request.created_at < now() - interval '2 minutes' then
   update public.order_submission_requests set request_status='failed' where id=v_request.id;
 else
   if v_request.created_at < now() - interval '2 minutes' then
     raise exception 'Previous order request needs review';
   end if;
 end if;

 select id into v_cart_id from public.carts
 where user_id=v_user and cart_status='active' for update;
 if v_cart_id is null then raise exception 'Active cart not found'; end if;

 perform ci.id from public.cart_items ci
 where ci.cart_id=v_cart_id and ci.id=any(p_cart_item_ids)
 order by ci.id for update;
 select count(*) into v_count from public.cart_items ci
 where ci.cart_id=v_cart_id and ci.id=any(p_cart_item_ids);
 if v_count <> cardinality(p_cart_item_ids) then raise exception 'One or more selected cart items are invalid'; end if;

 for v_item in
   select ci.* from public.cart_items ci
   where ci.cart_id=v_cart_id and ci.id=any(p_cart_item_ids)
   order by ci.product_id,ci.variant_id nulls first
 loop
   select * into v_product from public.products where id=v_item.product_id for update;
   if not found or not v_product.is_published or v_product.is_archived then
     raise exception 'A selected product is no longer available';
   end if;
   if v_item.variant_id is null then
     if exists(select 1 from public.product_variants where product_id=v_product.id) then
       raise exception 'Please select a product variant';
     end if;
     v_item_price:=v_product.price_myr;
     v_item_weight:=v_product.weight_grams;
     if v_product.stock_quantity-v_product.reserved_quantity < v_item.quantity then
       raise exception 'Insufficient stock for product %',v_product.name;
     end if;
   else
     select * into v_variant from public.product_variants
     where id=v_item.variant_id and product_id=v_product.id and is_active for update;
     if not found then raise exception 'A selected product variant is unavailable'; end if;
     v_item_price:=v_variant.price_myr;
     v_item_weight:=v_variant.weight_grams;
     if v_variant.stock_quantity-v_variant.reserved_quantity < v_item.quantity then
       raise exception 'Insufficient stock for selected variant';
     end if;
   end if;
   v_subtotal:=v_subtotal+(v_item_price*v_item.quantity);
   v_total_weight:=v_total_weight+(v_item_weight*v_item.quantity);
 end loop;

 select id into v_zone_id from public.shipping_zones
 where is_active and country_code=upper(p_shipping_address->>'country_code')
   and (region_code is null or region_code=p_shipping_address->>'region_code')
 order by (region_code is not null) desc
 limit 1;
 if v_zone_id is null then raise exception 'Shipping is not available for this address'; end if;

 select count(*) into v_rate_count from public.shipping_rates
 where zone_id=v_zone_id and is_active
   and v_total_weight>=min_weight_grams and v_total_weight<max_weight_grams;
 if v_rate_count<>1 then raise exception 'Shipping rate is missing or ambiguous for this weight'; end if;
 select * into v_rate from public.shipping_rates
 where zone_id=v_zone_id and is_active
   and v_total_weight>=min_weight_grams and v_total_weight<max_weight_grams;
 v_shipping_fee:=v_rate.base_fee_myr;
 if v_rate.additional_unit_grams>0 and v_total_weight>v_rate.min_weight_grams then
   v_shipping_fee:=v_shipping_fee
    + ceil((v_total_weight-v_rate.min_weight_grams)::numeric/v_rate.additional_unit_grams)*v_rate.additional_fee_myr;
 end if;

 v_order_number:='ORD-'||to_char(now() at time zone 'utc','YYYYMMDD')||'-'||upper(substr(encode(gen_random_bytes(5),'hex'),1,10));
 insert into public.orders(order_number,user_id,recipient_name,recipient_phone,shipping_address,
  subtotal_myr,shipping_fee_myr,total_myr,order_status,payment_status)
 values(v_order_number,v_user,trim(p_recipient_name),trim(p_recipient_phone),p_shipping_address,
  v_subtotal,v_shipping_fee,v_subtotal+v_shipping_fee,'pending','verification_pending')
 returning id into v_order_id;

 for v_item in
   select ci.* from public.cart_items ci
   where ci.cart_id=v_cart_id and ci.id=any(p_cart_item_ids)
   order by ci.product_id,ci.variant_id nulls first
 loop
   select * into v_product from public.products where id=v_item.product_id;
   select b.name into v_brand from public.brands b where b.id=v_product.brand_id;
   select pi.storage_path into v_image from public.product_images pi
    where pi.product_id=v_product.id order by pi.is_primary desc,pi.display_order asc limit 1;
   if v_item.variant_id is null then
     v_item_price:=v_product.price_myr;
     insert into public.order_items(order_id,product_id,product_name,brand_name,product_image,unit_price_myr,quantity,line_total_myr)
     values(v_order_id,v_product.id,v_product.name,v_brand,v_image,v_item_price,v_item.quantity,v_item_price*v_item.quantity)
     returning id into v_order_item_id;
     update public.products set reserved_quantity=reserved_quantity+v_item.quantity where id=v_product.id;
   else
     select * into v_variant from public.product_variants where id=v_item.variant_id;
     v_item_price:=v_variant.price_myr;
     insert into public.order_items(order_id,product_id,variant_id,product_name,brand_name,product_image,
       variant_snapshot,unit_price_myr,quantity,line_total_myr)
     values(v_order_id,v_product.id,v_variant.id,v_product.name,v_brand,v_image,
       jsonb_build_object('name',v_variant.variant_name,'value',v_variant.variant_value,'sku',v_variant.sku,'weight_grams',v_variant.weight_grams),
       v_item_price,v_item.quantity,v_item_price*v_item.quantity)
     returning id into v_order_item_id;
     update public.product_variants set reserved_quantity=reserved_quantity+v_item.quantity where id=v_variant.id;
   end if;
   insert into public.inventory_reservations(order_id,order_item_id,product_id,variant_id,quantity,status)
   values(v_order_id,v_order_item_id,v_product.id,v_item.variant_id,v_item.quantity,'reserved');
   insert into public.inventory_movements(product_id,variant_id,order_id,reservation_id,movement_type,quantity_change,reason,event_key,created_by)
   values(v_product.id,v_item.variant_id,v_order_id,
     (select ir.id from public.inventory_reservations ir where ir.order_item_id=v_order_item_id),
     'reserve',-v_item.quantity,'Order inventory reservation',v_order_id::text||':reserve:'||v_order_item_id::text,v_user);
 end loop;

 select coalesce(max(submission_number),0)+1 into v_submission from public.payment_proofs where order_id=v_order_id;
 insert into public.payment_proofs(order_id,user_id,storage_path,original_filename,mime_type,file_size,submission_number)
 values(v_order_id,v_user,p_payment_proof_path,p_original_filename,p_mime_type,p_file_size,v_submission);
 insert into public.payment_status_history(order_id,old_status,new_status,reason,changed_by)
 values(v_order_id,null,'verification_pending','Order submitted with payment proof',v_user);
 insert into public.order_status_history(order_id,old_status,new_status,reason,changed_by)
 values(v_order_id,null,'pending','Order submitted',v_user);
 delete from public.cart_items where cart_id=v_cart_id and id=any(p_cart_item_ids);
 update public.order_submission_requests set request_status='completed',order_id=v_order_id,completed_at=now()
 where id=v_request.id;
 return jsonb_build_object('order_id',v_order_id,'order_number',v_order_number,'status','completed','idempotent_replay',false);
end;
$$;
revoke all on function public.submit_order(uuid[],text,text,jsonb,text,text,text,bigint,uuid) from public,anon;
grant execute on function public.submit_order(uuid[],text,text,jsonb,text,text,text,bigint,uuid) to authenticated;

comment on function public.submit_order(uuid[],text,text,jsonb,text,text,text,bigint,uuid) is
 'Atomically validates selected cart lines, calculates configured shipping, creates order snapshots and payment proof record, reserves inventory, writes histories, and removes only purchased cart lines.';
