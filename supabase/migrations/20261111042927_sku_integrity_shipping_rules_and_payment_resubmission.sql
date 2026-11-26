
create extension if not exists btree_gist;

alter table public.shipping_rates
 add constraint shipping_rates_no_active_overlap
 exclude using gist (
  zone_id with =,
  int4range(min_weight_grams,max_weight_grams,'[)') with &&
 ) where (is_active);

create table if not exists app_private.sku_registry(
 sku_normalized text primary key,
 product_id uuid references public.products(id) on delete cascade,
 variant_id uuid references public.product_variants(id) on delete cascade,
 check ((product_id is not null)::int + (variant_id is not null)::int = 1)
);
create or replace function app_private.sync_product_sku()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
 delete from app_private.sku_registry where product_id=old.id;
 if tg_op<>'DELETE' then
  insert into app_private.sku_registry(sku_normalized,product_id)
  values(lower(trim(new.sku)),new.id);
  return new;
 end if;
 return old;
end;
$$;
create or replace function app_private.sync_variant_sku()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
 if tg_op<>'INSERT' then delete from app_private.sku_registry where variant_id=old.id; end if;
 if tg_op<>'DELETE' then
  insert into app_private.sku_registry(sku_normalized,variant_id)
  values(lower(trim(new.sku)),new.id);
  return new;
 end if;
 return old;
end;
$$;
revoke all on function app_private.sync_product_sku() from public,anon,authenticated;
revoke all on function app_private.sync_variant_sku() from public,anon,authenticated;
drop trigger if exists products_sync_sku on public.products;
create trigger products_sync_sku after insert or update of sku or delete on public.products
for each row execute function app_private.sync_product_sku();
drop trigger if exists variants_sync_sku on public.product_variants;
create trigger variants_sync_sku after insert or update of sku or delete on public.product_variants
for each row execute function app_private.sync_variant_sku();
insert into app_private.sku_registry(sku_normalized,product_id)
select lower(trim(sku)),id from public.products on conflict do nothing;
insert into app_private.sku_registry(sku_normalized,variant_id)
select lower(trim(sku)),id from public.product_variants on conflict do nothing;

create or replace function app_private.enforce_product_variant_inventory()
returns trigger language plpgsql set search_path=''
as $$
declare v_product_id uuid; v_has_variants boolean; v_mode text; v_stock integer; v_reserved integer;
begin
 if tg_table_name='products' then
  v_product_id:=new.id;
 else
  v_product_id:=coalesce(new.product_id,old.product_id);
 end if;
 select inventory_mode,stock_quantity,reserved_quantity into v_mode,v_stock,v_reserved
 from public.products where id=v_product_id;
 if not found then return coalesce(new,old); end if;
 select exists(select 1 from public.product_variants where product_id=v_product_id and is_active) into v_has_variants;
 if v_has_variants and (v_stock<>0 or v_reserved<>0) then
  raise exception 'Product-level inventory must be zero when active variants are used';
 end if;
 if v_mode='single_item' and v_stock>1 then raise exception 'Single-item inventory cannot exceed one'; end if;
 return coalesce(new,old);
end;
$$;
revoke all on function app_private.enforce_product_variant_inventory() from public,anon,authenticated;
drop trigger if exists product_inventory_mode_guard on public.products;
create constraint trigger product_inventory_mode_guard after insert or update of inventory_mode,stock_quantity,reserved_quantity on public.products
deferrable initially deferred for each row execute function app_private.enforce_product_variant_inventory();
drop trigger if exists variant_inventory_mode_guard on public.product_variants;
create constraint trigger variant_inventory_mode_guard after insert or update or delete on public.product_variants
deferrable initially deferred for each row execute function app_private.enforce_product_variant_inventory();

create or replace function public.resubmit_payment_proof(
 p_order_id uuid,p_storage_path text,p_original_filename text,p_mime_type text,p_file_size bigint
)
returns uuid language plpgsql security definer set search_path=''
as $$
declare v_user uuid:=auth.uid();v_order public.orders%rowtype;v_id uuid;v_n integer;v_meta jsonb;
begin
 if v_user is null then raise exception 'Authentication required';end if;
 if p_mime_type not in ('image/jpeg','image/png','application/pdf') or p_file_size<=0 or p_file_size>5242880 then raise exception 'Invalid payment proof file';end if;
 if (string_to_array(p_storage_path,'/'))[1]<>v_user::text then raise exception 'Invalid payment proof path';end if;
 select metadata into v_meta from storage.objects where bucket_id='payment-proofs' and name=p_storage_path;
 if not found then raise exception 'Payment proof upload not found';end if;
 if coalesce(v_meta->>'mimetype','')<>p_mime_type then raise exception 'Uploaded MIME type mismatch';end if;
 select * into v_order from public.orders where id=p_order_id and user_id=v_user for update;
 if not found or v_order.order_status in ('completed','cancelled') then raise exception 'Order not found or closed';end if;
 if v_order.payment_status<>'rejected' then raise exception 'Only rejected payments can be resubmitted';end if;
 select coalesce(max(submission_number),0)+1 into v_n from public.payment_proofs where order_id=p_order_id;
 insert into public.payment_proofs(order_id,user_id,storage_path,original_filename,mime_type,file_size,submission_number)
 values(p_order_id,v_user,p_storage_path,p_original_filename,p_mime_type,p_file_size,v_n) returning id into v_id;
 update public.orders set payment_status='verification_pending',updated_at=now() where id=p_order_id;
 insert into public.payment_status_history(order_id,payment_proof_id,old_status,new_status,reason,changed_by)
 values(p_order_id,v_id,'rejected','verification_pending','Customer submitted a new payment proof',v_user);
 return v_id;
end;
$$;
revoke all on function public.resubmit_payment_proof(uuid,text,text,text,bigint) from public,anon;
grant execute on function public.resubmit_payment_proof(uuid,text,text,text,bigint) to authenticated;

create or replace function public.create_shipment(
 p_order_id uuid,p_shipment_number text,p_carrier text,p_tracking_number text,p_tracking_url text,p_items jsonb
)
returns uuid language plpgsql security definer set search_path=''
as $$
declare v_actor uuid:=auth.uid();v_order public.orders%rowtype;v_ship uuid;v_line jsonb;v_item public.order_items%rowtype;v_qty integer;v_take integer;v_res public.inventory_reservations%rowtype;v_sent integer;v_consumed_id uuid;
begin
 if v_actor is null or not app_private.has_permission('shipments.manage') then raise exception 'Permission denied';end if;
 if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 then raise exception 'Shipment items are required';end if;
 select * into v_order from public.orders where id=p_order_id for update;
 if not found or v_order.order_status<>'processing' then raise exception 'Only processing orders can be shipped';end if;
 insert into public.shipments(order_id,shipment_number,carrier_name,tracking_number,tracking_url,shipment_status,shipped_at,created_by)
 values(p_order_id,p_shipment_number,p_carrier,p_tracking_number,p_tracking_url,'shipped',now(),v_actor) returning id into v_ship;
 for v_line in select * from jsonb_array_elements(p_items)
 loop
  select * into v_item from public.order_items where id=(v_line->>'order_item_id')::uuid and order_id=p_order_id for update;
  if not found then raise exception 'Shipment item does not belong to this order';end if;
  v_qty:=(v_line->>'quantity')::integer;
  if v_qty<=0 then raise exception 'Shipment quantity must be positive';end if;
  select coalesce(sum(si.quantity),0) into v_sent from public.shipment_items si join public.shipments s on s.id=si.shipment_id where si.order_item_id=v_item.id;
  if v_sent+v_qty>v_item.quantity then raise exception 'Shipment quantity exceeds ordered quantity';end if;
  insert into public.shipment_items(shipment_id,order_item_id,quantity) values(v_ship,v_item.id,v_qty);
  for v_res in select * from public.inventory_reservations where order_item_id=v_item.id and status='reserved' order by created_at for update
  loop
   exit when v_qty=0;
   v_take:=least(v_qty,v_res.quantity);
   if v_res.variant_id is null then
    update public.products set reserved_quantity=reserved_quantity-v_take,stock_quantity=stock_quantity-v_take where id=v_res.product_id and reserved_quantity>=v_take and stock_quantity>=v_take;
   else
    update public.product_variants set reserved_quantity=reserved_quantity-v_take,stock_quantity=stock_quantity-v_take where id=v_res.variant_id and reserved_quantity>=v_take and stock_quantity>=v_take;
   end if;
   if not found then raise exception 'Inventory consumption integrity check failed';end if;
   if v_take=v_res.quantity then
    update public.inventory_reservations set status='consumed',consumed_at=now() where id=v_res.id;
    v_consumed_id:=v_res.id;
   else
    update public.inventory_reservations set quantity=quantity-v_take where id=v_res.id;
    insert into public.inventory_reservations(order_id,order_item_id,product_id,variant_id,quantity,status,reserved_at,consumed_at)
    values(v_res.order_id,v_res.order_item_id,v_res.product_id,v_res.variant_id,v_take,'consumed',v_res.reserved_at,now())
    returning id into v_consumed_id;
   end if;
   insert into public.inventory_movements(product_id,variant_id,order_id,reservation_id,movement_type,quantity_change,reason,event_key,created_by)
   values(v_res.product_id,v_res.variant_id,p_order_id,v_consumed_id,'consume',-v_take,'Shipment dispatched',
    p_order_id::text||':consume:'||v_consumed_id::text,v_actor);
   v_qty:=v_qty-v_take;
  end loop;
  if v_qty<>0 then raise exception 'Insufficient reserved inventory for shipment';end if;
 end loop;
 if not exists(select 1 from public.order_items oi where oi.order_id=p_order_id and
  (select coalesce(sum(si.quantity),0) from public.shipment_items si join public.shipments s on s.id=si.shipment_id where si.order_item_id=oi.id)<oi.quantity) then
  update public.orders set order_status='shipped',updated_at=now() where id=p_order_id;
  insert into public.order_status_history(order_id,old_status,new_status,reason,changed_by) values(p_order_id,'processing','shipped','All order items have been dispatched',v_actor);
 end if;
 insert into public.admin_audit_logs(admin_user_id,actor_user_id,action,target_type,target_id,new_values)
 select au.id,v_actor,'shipment.create','shipment',v_ship,jsonb_build_object('shipment_number',p_shipment_number) from public.admin_users au where au.user_id=v_actor;
 return v_ship;
end;
$$;
revoke all on function public.create_shipment(uuid,text,text,text,text,jsonb) from public,anon;
grant execute on function public.create_shipment(uuid,text,text,text,text,jsonb) to authenticated;
