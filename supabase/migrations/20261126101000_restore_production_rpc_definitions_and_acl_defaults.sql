-- Restore two Production RPC definitions that were changed outside the
-- recovered migration ledger. This captures the live owner-list filtering and
-- Malaysian region-name normalization in version control.

CREATE OR REPLACE FUNCTION public.list_admin_users()
 RETURNS TABLE(user_id uuid, email text, is_active boolean, role_names text[])
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_is_owner boolean;
BEGIN
  IF auth.uid() IS NULL OR NOT app_private.has_permission('admins.manage') THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  v_is_owner := app_private.is_owner();

  RETURN QUERY
  SELECT
    au.user_id,
    u.email::text,
    au.is_active,
    COALESCE(array_agg(r.name::text) FILTER (WHERE r.name IS NOT NULL), '{}'::text[])
  FROM public.admin_users au
  JOIN auth.users u ON u.id = au.user_id
  LEFT JOIN public.admin_user_roles aur ON aur.admin_user_id = au.id
  LEFT JOIN public.roles r ON r.id = aur.role_id
  WHERE
    (
      v_is_owner
      AND au.is_active = true
    )
    OR
    (
      NOT v_is_owner
      AND NOT EXISTS (
        SELECT 1
        FROM app_private.owner_principal op
        WHERE op.singleton = true
          AND op.user_id = au.user_id
      )
    )
  GROUP BY au.user_id, u.email, au.is_active
  ORDER BY u.email;
END;
$function$;

CREATE OR REPLACE FUNCTION public.quote_shipping(p_cart_item_ids uuid[], p_country_code text, p_region_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
 select id into v_zone from public.shipping_zones where is_active and country_code=upper(p_country_code) and (region_code is null or upper(trim(region_code))=upper(trim(p_region_code)) or upper(trim(region_code))=case upper(trim(p_region_code)) when 'JOHOR' then 'JHR' when 'KEDAH' then 'KDH' when 'KELANTAN' then 'KTN' when 'MELAKA' then 'MLK' when 'NEGERI SEMBILAN' then 'NSN' when 'PAHANG' then 'PHG' when 'PENANG' then 'PNG' when 'PULAU PINANG' then 'PNG' when 'PERAK' then 'PRK' when 'PERLIS' then 'PLS' when 'SELANGOR' then 'SGR' when 'TERENGGANU' then 'TRG' when 'KUALA LUMPUR' then 'KUL' when 'W.P. KUALA LUMPUR' then 'KUL' when 'LABUAN' then 'LBN' when 'PUTRAJAYA' then 'PJY' when 'SABAH' then 'SBH' when 'SARAWAK' then 'SWK' else upper(trim(p_region_code)) end or upper(trim(p_region_code))=case upper(trim(region_code)) when 'JOHOR' then 'JHR' when 'KEDAH' then 'KDH' when 'KELANTAN' then 'KTN' when 'MELAKA' then 'MLK' when 'NEGERI SEMBILAN' then 'NSN' when 'PAHANG' then 'PHG' when 'PENANG' then 'PNG' when 'PULAU PINANG' then 'PNG' when 'PERAK' then 'PRK' when 'PERLIS' then 'PLS' when 'SELANGOR' then 'SGR' when 'TERENGGANU' then 'TRG' when 'KUALA LUMPUR' then 'KUL' when 'W.P. KUALA LUMPUR' then 'KUL' when 'LABUAN' then 'LBN' when 'PUTRAJAYA' then 'PJY' when 'SABAH' then 'SBH' when 'SARAWAK' then 'SWK' else upper(trim(region_code)) end) order by (region_code is not null) desc limit 1;
 if v_zone is null then raise exception 'Shipping is not available for this address';end if;
 select count(*) into v_count from public.shipping_rates where zone_id=v_zone and is_active and v_weight>=min_weight_grams and v_weight<max_weight_grams;
 if v_count<>1 then raise exception 'Shipping rate is missing or ambiguous for this weight';end if;
 select * into v_rate from public.shipping_rates where zone_id=v_zone and is_active and v_weight>=min_weight_grams and v_weight<max_weight_grams;
 v_fee:=v_rate.base_fee_myr;
 if v_rate.additional_unit_grams>0 and v_weight>v_rate.min_weight_grams then v_fee:=v_fee+ceil((v_weight-v_rate.min_weight_grams)::numeric/v_rate.additional_unit_grams)*v_rate.additional_fee_myr;end if;
 return jsonb_build_object('subtotal_myr',v_subtotal,'shipping_fee_myr',v_fee,'total_myr',v_subtotal+v_fee,'total_weight_grams',v_weight,'zone_id',v_zone);
end;
$function$;

-- Match Production's function ACL and default-privilege posture.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE SELECT, INSERT, UPDATE ON TABLES FROM anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM anon, authenticated, service_role;

REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon, service_role;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA app_private FROM service_role;

GRANT EXECUTE ON FUNCTION public.list_admin_users() TO authenticated;
GRANT EXECUTE ON FUNCTION public.quote_shipping(uuid[], text, text) TO authenticated;

GRANT EXECUTE ON FUNCTION public.owner_recovery_log_password_reset(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.owner_recovery_verify_secret(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.process_order_deadline_notifications() TO service_role;

GRANT EXECUTE ON FUNCTION app_private.bootstrap_first_owner(text) TO service_role;
GRANT EXECUTE ON FUNCTION app_private.verify_owner_recovery_secret(text) TO service_role;

REVOKE EXECUTE ON FUNCTION app_private.product_has_active_variant(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION app_private.product_has_sellable_variant(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION app_private.is_public_product_variant(uuid, integer, integer) FROM PUBLIC;
