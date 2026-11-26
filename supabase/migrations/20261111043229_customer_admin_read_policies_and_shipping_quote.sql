
create schema if not exists extensions;
alter extension btree_gist set schema extensions;

create index if not exists products_brand_id_idx on public.products(brand_id);
create index if not exists products_category_id_idx on public.products(category_id);
create index if not exists products_archived_by_idx on public.products(archived_by);
create index if not exists sku_registry_product_idx on app_private.sku_registry(product_id);
create index if not exists sku_registry_variant_idx on app_private.sku_registry(variant_id);
create index if not exists order_submission_requests_order_idx on public.order_submission_requests(order_id);
drop index if exists public.admin_users_created_by_placeholder_idx;

drop policy if exists profiles_admin_read on public.profiles;
create policy profiles_admin_read on public.profiles for select to authenticated using (app_private.has_permission('customers.view'));
drop policy if exists customer_addresses_admin_read on public.customer_addresses;
create policy customer_addresses_admin_read on public.customer_addresses for select to authenticated using (app_private.has_permission('customers.view'));

drop policy if exists orders_read_own_or_authorized on public.orders;
create policy orders_read_own_or_authorized on public.orders for select to authenticated using (
 user_id=(select auth.uid()) or app_private.has_permission('orders.view') or
 app_private.has_permission('payments.review') or app_private.has_permission('shipments.manage') or
 app_private.has_permission('orders.cancel.approve') or app_private.has_permission('orders.cancel.execute') or
 app_private.has_permission('orders.shipping_address.review') or app_private.has_permission('orders.complete')
);
drop policy if exists order_items_read_own_or_authorized on public.order_items;
create policy order_items_read_own_or_authorized on public.order_items for select to authenticated using (
 exists(select 1 from public.orders o where o.id=order_id and (o.user_id=(select auth.uid()) or app_private.has_permission('orders.view') or app_private.has_permission('shipments.manage') or app_private.has_permission('payments.review')))
);
drop policy if exists cancel_requests_read_own_or_authorized on public.order_cancellation_requests;
create policy cancel_requests_read_own_or_authorized on public.order_cancellation_requests for select to authenticated using (
 user_id=(select auth.uid()) or app_private.has_permission('orders.view') or app_private.has_permission('orders.cancel.approve') or app_private.has_permission('orders.cancel.execute')
);
drop policy if exists shipping_change_read_own_or_authorized on public.order_shipping_change_requests;
create policy shipping_change_read_own_or_authorized on public.order_shipping_change_requests for select to authenticated using (
 user_id=(select auth.uid()) or app_private.has_permission('orders.view') or app_private.has_permission('orders.shipping_address.review')
);
drop policy if exists inventory_reservations_admin_read on public.inventory_reservations;
create policy inventory_reservations_admin_read on public.inventory_reservations for select to authenticated
 using (app_private.has_permission('inventory.view') or app_private.has_permission('inventory.release'));
drop policy if exists inventory_movements_admin_read on public.inventory_movements;
create policy inventory_movements_admin_read on public.inventory_movements for select to authenticated
 using (app_private.has_permission('inventory.view') or app_private.has_permission('inventory.adjust') or app_private.has_permission('inventory.release'));
drop policy if exists order_submission_request_own_read on public.order_submission_requests;
create policy order_submission_request_own_read on public.order_submission_requests for select to authenticated
 using (user_id=(select auth.uid()) or app_private.has_permission('orders.view'));

create or replace function public.quote_shipping(p_cart_item_ids uuid[],p_country_code text,p_region_code text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_user uuid:=auth.uid();v_cart uuid;v_item record;v_product public.products%rowtype;v_variant public.product_variants%rowtype;
 v_weight integer:=0;v_subtotal numeric(12,2):=0;v_zone uuid;v_rate public.shipping_rates%rowtype;v_count integer;v_fee numeric(12,2);
begin
 if v_user is null then raise exception 'Authentication required';end if;
 select id into v_cart from public.carts where user_id=v_user and cart_status='active';
 if v_cart is null or coalesce(array_length(p_cart_item_ids,1),0)=0 then raise exception 'No selected cart items';end if;
 for v_item in select * from public.cart_items where cart_id=v_cart and id=any(p_cart_item_ids)
 loop
  select * into v_product from public.products where id=v_item.product_id and is_published and not is_archived;
  if not found then raise exception 'A selected product is unavailable';end if;
  if v_item.variant_id is null then
   if exists(select 1 from public.product_variants where product_id=v_product.id and is_active) then raise exception 'Select a product variant';end if;
   v_weight:=v_weight+v_product.weight_grams*v_item.quantity;v_subtotal:=v_subtotal+v_product.price_myr*v_item.quantity;
  else
   select * into v_variant from public.product_variants where id=v_item.variant_id and product_id=v_product.id and is_active;
   if not found then raise exception 'Selected variant is unavailable';end if;
   v_weight:=v_weight+v_variant.weight_grams*v_item.quantity;v_subtotal:=v_subtotal+v_variant.price_myr*v_item.quantity;
  end if;
 end loop;
 select id into v_zone from public.shipping_zones where is_active and country_code=upper(p_country_code) and (region_code is null or region_code=p_region_code) order by (region_code is not null) desc limit 1;
 if v_zone is null then raise exception 'Shipping is not available for this address';end if;
 select count(*) into v_count from public.shipping_rates where zone_id=v_zone and is_active and v_weight>=min_weight_grams and v_weight<max_weight_grams;
 if v_count<>1 then raise exception 'Shipping rate is missing or ambiguous for this weight';end if;
 select * into v_rate from public.shipping_rates where zone_id=v_zone and is_active and v_weight>=min_weight_grams and v_weight<max_weight_grams;
 v_fee:=v_rate.base_fee_myr;
 if v_rate.additional_unit_grams>0 and v_weight>v_rate.min_weight_grams then v_fee:=v_fee+ceil((v_weight-v_rate.min_weight_grams)::numeric/v_rate.additional_unit_grams)*v_rate.additional_fee_myr;end if;
 return jsonb_build_object('subtotal_myr',v_subtotal,'shipping_fee_myr',v_fee,'total_myr',v_subtotal+v_fee,'total_weight_grams',v_weight,'zone_id',v_zone);
end;
$$;
revoke all on function public.quote_shipping(uuid[],text,text) from public,anon;
grant execute on function public.quote_shipping(uuid[],text,text) to authenticated;
