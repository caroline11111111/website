
create or replace function public.submit_order_confirmed(
 p_cart_item_ids uuid[],p_recipient_name text,p_recipient_phone text,p_shipping_address jsonb,
 p_payment_proof_path text,p_original_filename text,p_mime_type text,p_file_size bigint,
 p_expected_subtotal_myr numeric,p_expected_shipping_fee_myr numeric,p_idempotency_key uuid
)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_user uuid:=auth.uid();v_cart uuid;v_quote jsonb;v_zone uuid;v_weight integer;v_rate_id uuid;v_result jsonb;
begin
 if v_user is null then raise exception 'Authentication required';end if;
 select id into v_cart from public.carts where user_id=v_user and cart_status='active' for update;
 if v_cart is null then raise exception 'Active cart not found';end if;
 perform ci.id from public.cart_items ci where ci.cart_id=v_cart and ci.id=any(p_cart_item_ids) order by ci.id for update;
 if (select count(*) from public.cart_items ci where ci.cart_id=v_cart and ci.id=any(p_cart_item_ids))<>cardinality(p_cart_item_ids) then raise exception 'Selected cart lines have changed';end if;
 perform p.id from public.products p join public.cart_items ci on ci.product_id=p.id
 where ci.cart_id=v_cart and ci.id=any(p_cart_item_ids) order by p.id for update of p;
 perform pv.id from public.product_variants pv join public.cart_items ci on ci.variant_id=pv.id
 where ci.cart_id=v_cart and ci.id=any(p_cart_item_ids) order by pv.id for update of pv;
 v_quote:=public.quote_shipping(p_cart_item_ids,p_shipping_address->>'country_code',p_shipping_address->>'region_code');
 v_zone:=(v_quote->>'zone_id')::uuid;v_weight:=(v_quote->>'total_weight_grams')::integer;
 perform 1 from public.shipping_zones where id=v_zone for share;
 select id into v_rate_id from public.shipping_rates where zone_id=v_zone and is_active
 and v_weight>=min_weight_grams and v_weight<max_weight_grams for share;
 if v_rate_id is null then raise exception 'Shipping rate changed; refresh your quote';end if;
 v_quote:=public.quote_shipping(p_cart_item_ids,p_shipping_address->>'country_code',p_shipping_address->>'region_code');
 if round((v_quote->>'subtotal_myr')::numeric,2)<>round(p_expected_subtotal_myr,2)
  or round((v_quote->>'shipping_fee_myr')::numeric,2)<>round(p_expected_shipping_fee_myr,2) then
  raise exception 'Price or shipping changed. Please review the updated quote and confirm again.';
 end if;
 v_result:=public.submit_order(p_cart_item_ids,p_recipient_name,p_recipient_phone,p_shipping_address,
  p_payment_proof_path,p_original_filename,p_mime_type,p_file_size,p_idempotency_key);
 return v_result;
end;
$$;
revoke all on function public.submit_order_confirmed(uuid[],text,text,jsonb,text,text,text,bigint,numeric,numeric,uuid) from public,anon;
grant execute on function public.submit_order_confirmed(uuid[],text,text,jsonb,text,text,text,bigint,numeric,numeric,uuid) to authenticated;
revoke all on function public.submit_order(uuid[],text,text,jsonb,text,text,text,bigint,uuid) from public,anon,authenticated;
