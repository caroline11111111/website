
create or replace function private.refresh_prices_after_currency_catalog_change()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
 if new.code='MYR' then return new; end if;
 if not new.is_active then
  delete from public.product_currency_prices where currency_code=new.code;
  delete from public.variant_currency_prices where currency_code=new.code;
  delete from public.shipping_rate_currency_prices where currency_code=new.code;
 else
  update public.currency_exchange_rates set rate=rate
  where currency_code=new.code and is_configured;
 end if;
 return new;
end; $$;
drop trigger if exists store_currencies_refresh_converted_prices on public.store_currencies;
create trigger store_currencies_refresh_converted_prices
after update of decimal_places,is_active on public.store_currencies
for each row execute function private.refresh_prices_after_currency_catalog_change();
