ALTER TABLE public.order_submission_requests
  ADD COLUMN request_fingerprint text;

CREATE OR REPLACE FUNCTION public.submit_order_confirmed_currency(p_cart_item_ids uuid[], p_recipient_name text, p_recipient_phone text, p_shipping_address jsonb, p_payment_proof_path text, p_original_filename text, p_mime_type text, p_file_size bigint, p_currency_code text, p_expected_subtotal numeric, p_expected_shipping_fee numeric, p_idempotency_key uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 v_user uuid:=auth.uid();
 v_cart_id uuid;
 v_request public.order_submission_requests%rowtype;
 v_currency public.store_currencies%rowtype;
 v_quote jsonb;
 v_item record;
 v_product public.products%rowtype;
 v_variant public.product_variants%rowtype;
 v_order_id uuid;
 v_order_number text;
 v_subtotal numeric(14,4);
 v_shipping_fee numeric(14,4);
 v_total numeric(14,4);
 v_total_weight integer;
 v_zone_id uuid;
 v_rate public.shipping_rates%rowtype;
 v_item_price numeric(14,4);
 v_brand text;
 v_image text;
 v_order_item_id uuid;
 v_submission integer;
 v_meta jsonb;
 v_count integer:=0;
 v_rate_price record;
 v_request_fingerprint text;
begin
 if v_user is null then raise exception 'Authentication required'; end if;
 if p_idempotency_key is null or coalesce(array_length(p_cart_item_ids,1),0)=0 then
   raise exception 'Selected cart items and idempotency key are required';
 end if;
 if nullif(trim(p_recipient_name),'') is null or nullif(trim(p_recipient_phone),'') is null then
   raise exception 'Recipient name and phone are required';
 end if;
 if p_shipping_address is null or jsonb_typeof(p_shipping_address)<>'object' then
   raise exception 'Valid shipping address is required';
 end if;
 if p_mime_type not in ('image/jpeg','image/png','application/pdf') or p_file_size<=0 or p_file_size>5242880 then
   raise exception 'Invalid payment proof file';
 end if;
 if (string_to_array(p_payment_proof_path,'/'))[1]<>v_user::text then
   raise exception 'Invalid payment proof path';
 end if;

 -- Canonical request fingerprint: object-key order is normalized by jsonb;
 -- selected cart IDs are sorted because their input order is not meaningful.
 v_request_fingerprint := encode(
   extensions.digest(
     convert_to(
       jsonb_build_object(
         'cart_item_ids', to_jsonb(ARRAY(SELECT x FROM unnest(p_cart_item_ids) AS x ORDER BY x)),
         'recipient_name', trim(p_recipient_name),
         'recipient_phone', trim(p_recipient_phone),
         'shipping_address', p_shipping_address,
         'payment_proof_path', p_payment_proof_path,
         'original_filename', p_original_filename,
         'mime_type', p_mime_type,
         'file_size', p_file_size,
         'currency_code', upper(trim(p_currency_code)),
         'expected_subtotal', p_expected_subtotal,
         'expected_shipping_fee', p_expected_shipping_fee
       )::text,
       'UTF8'
     ),
     'sha256'
   ),
   'hex'
 );

 insert into public.order_submission_requests(
   user_id,idempotency_key,request_status,request_fingerprint
 )
 values(v_user,p_idempotency_key,'processing',v_request_fingerprint)
 on conflict(user_id,idempotency_key) do nothing;

 select * into v_request
 from public.order_submission_requests
 where user_id=v_user and idempotency_key=p_idempotency_key
 for update;

 if v_request.request_fingerprint is null
    or v_request.request_fingerprint<>v_request_fingerprint then
   raise exception 'Idempotency key conflict: this key was already used for a different checkout request';
 end if;

 if v_request.request_status='completed' and v_request.order_id is not null then
   return jsonb_build_object(
     'order_id',v_request.order_id,
     'status','completed',
     'idempotent_replay',true
   );
 end if;

 if v_request.request_status='processing' and v_request.created_at<now()-interval '2 minutes' then
   update public.order_submission_requests set request_status='failed' where id=v_request.id;
 end if;

 -- Mutable checks happen after completed replay so a valid retry is not broken
 -- by a later currency toggle or by the payment-proof object being cleaned up.
 select * into v_currency
 from public.store_currencies
 where code=upper(trim(p_currency_code)) and is_active;
 if not found then raise exception 'Selected currency is not enabled'; end if;

 select metadata into v_meta
 from storage.objects
 where bucket_id='payment-proofs' and name=p_payment_proof_path;
 if not found then raise exception 'Payment proof upload not found'; end if;
 if coalesce(v_meta->>'mimetype','')<>p_mime_type
    or coalesce((v_meta->>'size')::bigint,-1)<>p_file_size then
   raise exception 'Payment proof file metadata does not match upload';
 end if;

 select id into v_cart_id
 from public.carts
 where user_id=v_user and cart_status='active'
 for update;
 if v_cart_id is null then raise exception 'Active cart not found'; end if;

 perform ci.id
 from public.cart_items ci
 where ci.cart_id=v_cart_id and ci.id=any(p_cart_item_ids)
 order by ci.id
 for update;

 select count(*) into v_count
 from public.cart_items ci
 where ci.cart_id=v_cart_id and ci.id=any(p_cart_item_ids);
 if v_count<>cardinality(p_cart_item_ids) then
   raise exception 'One or more selected cart items are invalid';
 end if;

 perform p.id
 from public.products p
 join public.cart_items ci on ci.product_id=p.id
 where ci.cart_id=v_cart_id and ci.id=any(p_cart_item_ids)
 order by p.id
 for update of p;

 perform pv.id
 from public.product_variants pv
 join public.cart_items ci on ci.variant_id=pv.id
 where ci.cart_id=v_cart_id and ci.id=any(p_cart_item_ids)
 order by pv.id
 for update of pv;

 v_quote:=public.quote_shipping_currency(
   p_cart_item_ids,
   p_shipping_address->>'country_code',
   p_shipping_address->>'region_code',
   v_currency.code
 );
 v_subtotal:=(v_quote->>'subtotal')::numeric;
 v_shipping_fee:=(v_quote->>'shipping_fee')::numeric;
 v_total:=(v_quote->>'total')::numeric;
 v_total_weight:=(v_quote->>'total_weight_grams')::integer;

 if round(v_subtotal,v_currency.decimal_places)<>round(p_expected_subtotal,v_currency.decimal_places)
    or round(v_shipping_fee,v_currency.decimal_places)<>round(p_expected_shipping_fee,v_currency.decimal_places) then
   raise exception 'Price or shipping changed. Please review the updated quote and confirm again.';
 end if;

 v_zone_id:=(v_quote->>'zone_id')::uuid;
 perform 1 from public.shipping_zones where id=v_zone_id for share;

 select * into v_rate
 from public.shipping_rates
 where zone_id=v_zone_id and is_active
   and v_total_weight>=min_weight_grams and v_total_weight<max_weight_grams
 for share;
 if not found then raise exception 'Shipping rate changed; refresh your quote'; end if;

 perform 1
 from public.shipping_rate_currency_prices
 where shipping_rate_id=v_rate.id and currency_code=v_currency.code
 for share;
 if not found then raise exception 'Shipping price changed; refresh your quote'; end if;

 v_order_number:='ORD-'||to_char(now() at time zone 'utc','YYYYMMDD')||'-'||upper(substr(encode(extensions.gen_random_bytes(5),'hex'),1,10));

 insert into public.orders(
   order_number,user_id,recipient_name,recipient_phone,shipping_address,
   subtotal_myr,shipping_fee_myr,total_myr,currency_code,currency_symbol_snapshot,
   subtotal_amount,shipping_fee_amount,total_amount,order_status,payment_status
 )
 values(
   v_order_number,v_user,trim(p_recipient_name),trim(p_recipient_phone),p_shipping_address,
   case when v_currency.code='MYR' then v_subtotal else null end,
   case when v_currency.code='MYR' then v_shipping_fee else null end,
   case when v_currency.code='MYR' then v_total else null end,
   v_currency.code,v_currency.symbol,v_subtotal,v_shipping_fee,v_total,'pending','verification_pending'
 )
 returning id into v_order_id;

 for v_item in
   select ci.*
   from public.cart_items ci
   where ci.cart_id=v_cart_id and ci.id=any(p_cart_item_ids)
   order by ci.product_id,ci.variant_id nulls first
 loop
   select * into v_product from public.products where id=v_item.product_id;
   if not found or not v_product.is_published or v_product.is_archived then
     raise exception 'A selected product is no longer available';
   end if;

   select b.name into v_brand from public.brands b where b.id=v_product.brand_id;
   select pi.storage_path into v_image
   from public.product_images pi
   where pi.product_id=v_product.id
   order by pi.is_primary desc,pi.display_order asc
   limit 1;

   if v_item.variant_id is null then
     if exists(select 1 from public.product_variants where product_id=v_product.id and is_active) then
       raise exception 'Please select a product variant';
     end if;
     select price into v_item_price
     from public.product_currency_prices
     where product_id=v_product.id and currency_code=v_currency.code;
     if v_item_price is null then
       raise exception 'Price not configured for %: %',v_currency.code,v_product.name;
     end if;
     if v_product.stock_quantity-v_product.reserved_quantity<v_item.quantity then
       raise exception 'Insufficient stock for product %',v_product.name;
     end if;

     insert into public.order_items(
       order_id,product_id,product_name,brand_name,product_image,variant_snapshot,
       unit_price_myr,line_total_myr,currency_code,unit_price,line_total,quantity
     )
     values(
       v_order_id,v_product.id,v_product.name,v_brand,v_image,null,
       case when v_currency.code='MYR' then v_item_price else null end,
       case when v_currency.code='MYR' then v_item_price*v_item.quantity else null end,
       v_currency.code,v_item_price,v_item_price*v_item.quantity,v_item.quantity
     )
     returning id into v_order_item_id;

     update public.products
     set reserved_quantity=reserved_quantity+v_item.quantity
     where id=v_product.id;
   else
     select * into v_variant
     from public.product_variants
     where id=v_item.variant_id and product_id=v_product.id and is_active
     for update;
     if not found then raise exception 'Selected product variant is unavailable'; end if;

     select price into v_item_price
     from public.variant_currency_prices
     where variant_id=v_variant.id and currency_code=v_currency.code;
     if v_item_price is null then
       raise exception 'Price not configured for %: %',v_currency.code,v_product.name;
     end if;
     if v_variant.stock_quantity-v_variant.reserved_quantity<v_item.quantity then
       raise exception 'Insufficient stock for selected variant';
     end if;

     insert into public.order_items(
       order_id,product_id,variant_id,product_name,brand_name,product_image,variant_snapshot,
       unit_price_myr,line_total_myr,currency_code,unit_price,line_total,quantity
     )
     values(
       v_order_id,v_product.id,v_variant.id,v_product.name,v_brand,v_image,
       jsonb_build_object(
         'name',v_variant.variant_name,
         'value',v_variant.variant_value,
         'sku',v_variant.sku,
         'weight_grams',v_variant.weight_grams
       ),
       case when v_currency.code='MYR' then v_item_price else null end,
       case when v_currency.code='MYR' then v_item_price*v_item.quantity else null end,
       v_currency.code,v_item_price,v_item_price*v_item.quantity,v_item.quantity
     )
     returning id into v_order_item_id;

     update public.product_variants
     set reserved_quantity=reserved_quantity+v_item.quantity
     where id=v_variant.id;
   end if;

   insert into public.inventory_reservations(
     order_id,order_item_id,product_id,variant_id,quantity,status
   )
   values(
     v_order_id,v_order_item_id,
     case when v_item.variant_id is null then v_product.id else null end,
     v_item.variant_id,v_item.quantity,'reserved'
   );

   insert into public.inventory_movements(
     product_id,variant_id,order_id,reservation_id,movement_type,
     quantity_change,reason,event_key,created_by
   )
   values(
     case when v_item.variant_id is null then v_product.id else null end,
     v_item.variant_id,v_order_id,
     (select ir.id from public.inventory_reservations ir where ir.order_item_id=v_order_item_id),
     'reserve',-v_item.quantity,'Order inventory reservation',
     v_order_id::text||':reserve:'||v_order_item_id::text,v_user
   );
 end loop;

 select coalesce(max(submission_number),0)+1
 into v_submission
 from public.payment_proofs
 where order_id=v_order_id;

 insert into public.payment_proofs(
   order_id,user_id,storage_path,original_filename,mime_type,file_size,
   submission_number,currency_code,expected_amount
 )
 values(
   v_order_id,v_user,p_payment_proof_path,p_original_filename,p_mime_type,p_file_size,
   v_submission,v_currency.code,v_total
 );

 insert into public.payment_status_history(order_id,old_status,new_status,reason,changed_by)
 values(v_order_id,null,'verification_pending','Order submitted with payment proof',v_user);

 insert into public.order_status_history(order_id,old_status,new_status,reason,changed_by)
 values(v_order_id,null,'pending','Order submitted',v_user);

 delete from public.cart_items
 where cart_id=v_cart_id and id=any(p_cart_item_ids);

 update public.order_submission_requests
 set request_status='completed',order_id=v_order_id,completed_at=now()
 where id=v_request.id;

 return jsonb_build_object(
   'order_id',v_order_id,
   'order_number',v_order_number,
   'status','completed',
   'idempotent_replay',false,
   'currency_code',v_currency.code,
   'subtotal',v_subtotal,
   'shipping_fee',v_shipping_fee,
   'total',v_total
 );
end;
$function$;
