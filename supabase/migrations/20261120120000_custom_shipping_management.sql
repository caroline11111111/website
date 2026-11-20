-- Custom Shipping Management: configurable country/region zones and calculation methods.
alter table public.shipping_zones
  add column if not exists match_type text not null default 'country';
update public.shipping_zones
set match_type = case when nullif(trim(region_code),'') is null then 'country' else 'region' end;
alter table public.shipping_zones drop constraint if exists shipping_zones_match_type_check;
alter table public.shipping_zones add constraint shipping_zones_match_type_check
  check (match_type in ('country','region'));

alter table public.shipping_rates
  add column if not exists calculation_type text not null default 'weight_based',
  add column if not exists flat_fee_myr numeric(14,4) not null default 0,
  add column if not exists volume_fee_per_litre_myr numeric(14,4) not null default 0,
  add column if not exists per_item_fee_myr numeric(14,4) not null default 0;
alter table public.shipping_rates drop constraint if exists shipping_rates_calculation_type_check;
alter table public.shipping_rates add constraint shipping_rates_calculation_type_check
  check (calculation_type in ('flat_rate','weight_based','volume_based','per_item'));

alter table public.shipping_rate_currency_prices
  add column if not exists flat_fee numeric(14,4) not null default 0,
  add column if not exists volume_fee_per_litre numeric(14,4) not null default 0,
  add column if not exists per_item_fee numeric(14,4) not null default 0;

alter table public.products
  add column if not exists length_cm numeric(10,2),
  add column if not exists width_cm numeric(10,2),
  add column if not exists height_cm numeric(10,2);
alter table public.product_variants
  add column if not exists length_cm numeric(10,2),
  add column if not exists width_cm numeric(10,2),
  add column if not exists height_cm numeric(10,2);

create or replace function public.sync_shipping_rate_currency_prices()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare c record;
begin
  for c in select sc.code, sc.is_active, coalesce(er.rate,1) as fx
    from public.store_currencies sc
    left join public.currency_exchange_rates er on er.currency_code=sc.code and er.is_configured
    where sc.is_active
  loop
    insert into public.shipping_rate_currency_prices(
      shipping_rate_id,currency_code,base_fee,additional_fee,flat_fee,volume_fee_per_litre,per_item_fee,updated_at,updated_by
    ) values (
      new.id,c.code,
      case when c.code='MYR' then new.base_fee_myr else new.base_fee_myr*c.fx end,
      case when c.code='MYR' then new.additional_fee_myr else new.additional_fee_myr*c.fx end,
      case when c.code='MYR' then new.flat_fee_myr else new.flat_fee_myr*c.fx end,
      case when c.code='MYR' then new.volume_fee_per_litre_myr else new.volume_fee_per_litre_myr*c.fx end,
      case when c.code='MYR' then new.per_item_fee_myr else new.per_item_fee_myr*c.fx end,
      now(),auth.uid()
    )
    on conflict (shipping_rate_id,currency_code) do update set
      base_fee=excluded.base_fee,additional_fee=excluded.additional_fee,flat_fee=excluded.flat_fee,
      volume_fee_per_litre=excluded.volume_fee_per_litre,per_item_fee=excluded.per_item_fee,
      updated_at=now(),updated_by=auth.uid();
  end loop;
  return new;
end;
$$;

drop trigger if exists shipping_rates_sync_currency_prices on public.shipping_rates;
create trigger shipping_rates_sync_currency_prices
after insert or update of base_fee_myr,additional_fee_myr,flat_fee_myr,volume_fee_per_litre_myr,per_item_fee_myr
on public.shipping_rates for each row execute function public.sync_shipping_rate_currency_prices();

CREATE OR REPLACE FUNCTION public.quote_shipping_currency(p_cart_item_ids uuid[], p_country_code text, p_region_code text, p_currency_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user uuid := auth.uid();
  v_cart uuid;
  v_currency public.store_currencies%rowtype;
  v_zone public.shipping_zones%rowtype;
  v_rate public.shipping_rates%rowtype;
  v_item record;
  v_price numeric(14,4);
  v_subtotal numeric(14,4) := 0;
  v_weight integer := 0;
  v_volume numeric(14,4) := 0;
  v_item_count integer := 0;
  v_fee numeric(14,4) := 0;
  v_base_fee numeric(14,4);
  v_additional_fee numeric(14,4);
  v_flat_fee numeric(14,4);
  v_volume_fee numeric(14,4);
  v_per_item_fee numeric(14,4);
  v_rate_count integer;
  v_method text;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  select * into v_currency from public.store_currencies
    where code=upper(p_currency_code) and is_active;
  if not found then raise exception 'Selected currency is not enabled'; end if;

  select id into v_cart from public.carts where user_id=v_user and cart_status='active';
  if v_cart is null or coalesce(array_length(p_cart_item_ids,1),0)=0 then
    raise exception 'No selected cart items';
  end if;
  if (select count(*) from public.cart_items ci where ci.cart_id=v_cart and ci.id=any(p_cart_item_ids)) <> cardinality(p_cart_item_ids) then
    raise exception 'One or more selected cart items are invalid';
  end if;

  for v_item in
    select ci.*,p.name,p.price_myr,p.weight_grams,p.length_cm,p.width_cm,p.height_cm,
           p.is_published,p.is_archived,p.inventory_mode,
           pv.price_myr as variant_price_myr,pv.weight_grams as variant_weight_grams,
           pv.length_cm as variant_length_cm,pv.width_cm as variant_width_cm,pv.height_cm as variant_height_cm
    from public.cart_items ci
    join public.products p on p.id=ci.product_id
    left join public.product_variants pv on pv.id=ci.variant_id
    where ci.cart_id=v_cart and ci.id=any(p_cart_item_ids)
  loop
    if not v_item.is_published or v_item.is_archived then raise exception 'A selected product is unavailable'; end if;
    if v_item.variant_id is null then
      select price into v_price from public.product_currency_prices
        where product_id=v_item.product_id and currency_code=v_currency.code;
      v_weight:=v_weight+coalesce(v_item.weight_grams,0)*v_item.quantity;
      if v_item.length_cm is null or v_item.width_cm is null or v_item.height_cm is null then
        v_volume:=null;
      elsif v_volume is not null then
        v_volume:=v_volume+(v_item.length_cm*v_item.width_cm*v_item.height_cm*v_item.quantity);
      end if;
    else
      select price into v_price from public.variant_currency_prices
        where variant_id=v_item.variant_id and currency_code=v_currency.code;
      v_weight:=v_weight+coalesce(v_item.variant_weight_grams,0)*v_item.quantity;
      if coalesce(v_item.variant_length_cm,v_item.length_cm) is null or coalesce(v_item.variant_width_cm,v_item.width_cm) is null or coalesce(v_item.variant_height_cm,v_item.height_cm) is null then
        v_volume:=null;
      elsif v_volume is not null then
        v_volume:=v_volume+(coalesce(v_item.variant_length_cm,v_item.length_cm)*coalesce(v_item.variant_width_cm,v_item.width_cm)*coalesce(v_item.variant_height_cm,v_item.height_cm)*v_item.quantity);
      end if;
    end if;
    if v_price is null then raise exception 'Price not configured for %: %',v_currency.code,v_item.name; end if;
    v_subtotal:=v_subtotal+v_price*v_item.quantity;
    v_item_count:=v_item_count+v_item.quantity;
  end loop;

  select * into v_zone
  from public.shipping_zones
  where is_active
    and country_code=upper(trim(p_country_code))
    and (nullif(trim(region_code),'') is null or lower(trim(region_code))=lower(trim(coalesce(p_region_code,''))))
  order by (nullif(trim(region_code),'') is not null) desc, created_at
  limit 1;
  if not found then raise exception 'Shipping is not available for this address'; end if;
  perform 1 from public.shipping_zones where id=v_zone.id for share;

  select count(distinct calculation_type) into v_rate_count from public.shipping_rates where zone_id=v_zone.id and is_active;
  if v_rate_count<>1 then raise exception 'Configure exactly one active calculation method per zone. Weight-based zones may have multiple weight bands.'; end if;
  select max(calculation_type) into v_method from public.shipping_rates where zone_id=v_zone.id and is_active;
  select count(*) into v_rate_count from public.shipping_rates where zone_id=v_zone.id and is_active and calculation_type=v_method
    and ((v_method='weight_based' and v_weight>=min_weight_grams and v_weight<max_weight_grams) or v_method<>'weight_based');
  if v_rate_count<>1 then raise exception 'Shipping rate is missing or ambiguous for this destination and calculation method'; end if;
  select * into v_rate from public.shipping_rates where zone_id=v_zone.id and is_active and calculation_type=v_method
    and ((v_method='weight_based' and v_weight>=min_weight_grams and v_weight<max_weight_grams) or v_method<>'weight_based');
  perform 1 from public.shipping_rates where id=v_rate.id for share;

  if v_currency.code='MYR' then
    v_base_fee:=v_rate.base_fee_myr; v_additional_fee:=v_rate.additional_fee_myr;
    v_flat_fee:=v_rate.flat_fee_myr; v_volume_fee:=v_rate.volume_fee_per_litre_myr;
    v_per_item_fee:=v_rate.per_item_fee_myr;
  else
    select base_fee,additional_fee,flat_fee,volume_fee_per_litre,per_item_fee
      into v_base_fee,v_additional_fee,v_flat_fee,v_volume_fee,v_per_item_fee
    from public.shipping_rate_currency_prices
    where shipping_rate_id=v_rate.id and currency_code=v_currency.code;
    if not found then raise exception 'Shipping price not configured for %',v_currency.code; end if;
  end if;

  case v_rate.calculation_type
    when 'flat_rate' then v_fee:=v_flat_fee;
    when 'weight_based' then
      v_fee:=v_base_fee;
      if v_rate.additional_unit_grams>0 and v_weight>v_rate.min_weight_grams then
        v_fee:=v_fee+ceil((v_weight-v_rate.min_weight_grams)::numeric/v_rate.additional_unit_grams)*v_additional_fee;
      end if;
    when 'volume_based' then
      if v_volume is null then raise exception 'Product dimensions are required for volume-based shipping'; end if;
      v_fee:=v_flat_fee+ceil(v_volume/1000)*v_volume_fee;
    when 'per_item' then v_fee:=v_item_count*v_per_item_fee;
    else raise exception 'Unsupported shipping calculation type';
  end case;

  return jsonb_build_object(
    'currency_code',v_currency.code,'currency_symbol',v_currency.symbol,
    'decimal_places',v_currency.decimal_places,
    'subtotal',round(v_subtotal,v_currency.decimal_places),
    'shipping_fee',round(v_fee,v_currency.decimal_places),
    'total',round(v_subtotal+v_fee,v_currency.decimal_places),
    'subtotal_myr',case when v_currency.code='MYR' then round(v_subtotal,2) else null end,
    'shipping_fee_myr',case when v_currency.code='MYR' then round(v_fee,2) else null end,
    'total_myr',case when v_currency.code='MYR' then round(v_subtotal+v_fee,2) else null end,
    'total_weight_grams',v_weight,'total_volume_cm3',v_volume,'total_items',v_item_count,
    'zone_id',v_zone.id,'zone_name',v_zone.zone_name,
    'rate_id',v_rate.id,'calculation_type',v_rate.calculation_type
  );
end;
$function$;

insert into public.shipping_rate_currency_prices(
  shipping_rate_id,currency_code,base_fee,additional_fee,flat_fee,volume_fee_per_litre,per_item_fee,updated_at
)
select r.id,c.code,
  case when c.code='MYR' then r.base_fee_myr else r.base_fee_myr*coalesce(er.rate,1) end,
  case when c.code='MYR' then r.additional_fee_myr else r.additional_fee_myr*coalesce(er.rate,1) end,
  case when c.code='MYR' then r.flat_fee_myr else r.flat_fee_myr*coalesce(er.rate,1) end,
  case when c.code='MYR' then r.volume_fee_per_litre_myr else r.volume_fee_per_litre_myr*coalesce(er.rate,1) end,
  case when c.code='MYR' then r.per_item_fee_myr else r.per_item_fee_myr*coalesce(er.rate,1) end,
  now()
from public.shipping_rates r
cross join public.store_currencies c
left join public.currency_exchange_rates er on er.currency_code=c.code and er.is_configured
where c.is_active
on conflict (shipping_rate_id,currency_code) do nothing;
