
alter table public.orders add column if not exists currency_decimal_places_snapshot smallint;
create or replace function private.set_order_exchange_rate_snapshot()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_rate numeric(20,10); v_decimals smallint;
begin
 select decimal_places into v_decimals from public.store_currencies where code=new.currency_code;
 if v_decimals is null then raise exception 'Currency % is not registered.',new.currency_code; end if;
 new.currency_decimal_places_snapshot:=v_decimals;
 if new.currency_code='MYR' then new.exchange_rate_from_myr_snapshot:=1;
 else
  select r.rate into v_rate from public.currency_exchange_rates r join public.store_currencies c on c.code=r.currency_code
  where r.currency_code=new.currency_code and r.is_configured and c.is_active;
  if v_rate is null then raise exception 'Exchange rate for % has not been configured. Checkout is unavailable.',new.currency_code; end if;
  new.exchange_rate_from_myr_snapshot:=v_rate;
 end if;
 return new;
end; $$;
update public.orders o set exchange_rate_from_myr_snapshot=1,
 currency_decimal_places_snapshot=(select c.decimal_places from public.store_currencies c where c.code='MYR')
where o.currency_code='MYR' and (o.exchange_rate_from_myr_snapshot is null or o.currency_decimal_places_snapshot is null);
