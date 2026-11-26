
create table if not exists public.currency_exchange_rates (
 currency_code text primary key references public.store_currencies(code) on update cascade on delete restrict,
 base_currency_code text not null default 'MYR' check(base_currency_code='MYR'),
 rate numeric(20,10),
 is_configured boolean not null default false,
 updated_at timestamptz not null default now(),
 updated_by uuid references auth.users(id) on delete set null,
 constraint currency_exchange_rates_rate_positive check (
  (currency_code='MYR' and rate=1 and is_configured=true) or
  (currency_code<>'MYR' and ((not is_configured and rate is null) or (is_configured and rate>0)))
 )
);
insert into public.currency_exchange_rates(currency_code,base_currency_code,rate,is_configured)
select code,'MYR',case when code='MYR' then 1 else null end,code='MYR'
from public.store_currencies on conflict(currency_code) do nothing;
alter table public.currency_exchange_rates enable row level security;
drop policy if exists currency_exchange_rates_public_read on public.currency_exchange_rates;
create policy currency_exchange_rates_public_read on public.currency_exchange_rates for select to anon,authenticated
using(currency_code='MYR' or exists(select 1 from public.store_currencies c where c.code=currency_exchange_rates.currency_code and c.is_active) or app_private.has_permission('settings.manage'));
drop policy if exists currency_exchange_rates_manage on public.currency_exchange_rates;
create policy currency_exchange_rates_manage on public.currency_exchange_rates for all to authenticated
using(app_private.has_permission('settings.manage')) with check(app_private.has_permission('settings.manage'));
grant select on public.currency_exchange_rates to anon,authenticated;
grant insert,update,delete on public.currency_exchange_rates to authenticated;

alter table public.orders add column if not exists exchange_rate_from_myr_snapshot numeric(20,10);
create or replace function private.set_order_exchange_rate_snapshot()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_rate numeric(20,10);
begin
 if new.currency_code='MYR' then new.exchange_rate_from_myr_snapshot:=1;
 else
  select r.rate into v_rate from public.currency_exchange_rates r join public.store_currencies c on c.code=r.currency_code
  where r.currency_code=new.currency_code and r.is_configured and c.is_active;
  if v_rate is null then raise exception 'Exchange rate for % has not been configured. Checkout is unavailable.',new.currency_code; end if;
  new.exchange_rate_from_myr_snapshot:=v_rate;
 end if;
 return new;
end; $$;
drop trigger if exists orders_set_exchange_rate_snapshot on public.orders;
create trigger orders_set_exchange_rate_snapshot before insert on public.orders
for each row execute function private.set_order_exchange_rate_snapshot();

create or replace function private.sync_currency_prices_from_myr()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_code text; v_rate numeric(20,10); v_decimals smallint; v_id uuid;
begin
 if tg_table_name='products' then
  v_id:=coalesce(new.id,old.id);
  delete from public.product_currency_prices where product_id=v_id and currency_code<>'MYR';
  for v_code,v_rate,v_decimals in select r.currency_code,r.rate,c.decimal_places from public.currency_exchange_rates r join public.store_currencies c on c.code=r.currency_code and c.is_active where r.currency_code<>'MYR' and r.is_configured loop
   insert into public.product_currency_prices(product_id,currency_code,price,updated_at,updated_by)
   select v_id,v_code,round(p.price_myr*v_rate,v_decimals),now(),auth.uid() from public.products p where p.id=v_id
   on conflict(product_id,currency_code) do update set price=excluded.price,updated_at=excluded.updated_at,updated_by=excluded.updated_by;
  end loop;
 elsif tg_table_name='product_variants' then
  v_id:=coalesce(new.id,old.id);
  delete from public.variant_currency_prices where variant_id=v_id and currency_code<>'MYR';
  for v_code,v_rate,v_decimals in select r.currency_code,r.rate,c.decimal_places from public.currency_exchange_rates r join public.store_currencies c on c.code=r.currency_code and c.is_active where r.currency_code<>'MYR' and r.is_configured loop
   insert into public.variant_currency_prices(variant_id,currency_code,price,updated_at,updated_by)
   select v_id,v_code,round(pv.price_myr*v_rate,v_decimals),now(),auth.uid() from public.product_variants pv where pv.id=v_id
   on conflict(variant_id,currency_code) do update set price=excluded.price,updated_at=excluded.updated_at,updated_by=excluded.updated_by;
  end loop;
 elsif tg_table_name='shipping_rates' then
  v_id:=coalesce(new.id,old.id);
  delete from public.shipping_rate_currency_prices where shipping_rate_id=v_id and currency_code<>'MYR';
  for v_code,v_rate,v_decimals in select r.currency_code,r.rate,c.decimal_places from public.currency_exchange_rates r join public.store_currencies c on c.code=r.currency_code and c.is_active where r.currency_code<>'MYR' and r.is_configured loop
   insert into public.shipping_rate_currency_prices(shipping_rate_id,currency_code,base_fee,additional_fee,updated_at,updated_by)
   select v_id,v_code,round(s.base_fee_myr*v_rate,v_decimals),round(s.additional_fee_myr*v_rate,v_decimals),now(),auth.uid() from public.shipping_rates s where s.id=v_id
   on conflict(shipping_rate_id,currency_code) do update set base_fee=excluded.base_fee,additional_fee=excluded.additional_fee,updated_at=excluded.updated_at,updated_by=excluded.updated_by;
  end loop;
 elsif tg_table_name='currency_exchange_rates' then
  v_code:=coalesce(new.currency_code,old.currency_code);
  if v_code='MYR' then return new; end if;
  if tg_op='DELETE' or not coalesce(new.is_configured,false) then
   delete from public.product_currency_prices where currency_code=v_code;
   delete from public.variant_currency_prices where currency_code=v_code;
   delete from public.shipping_rate_currency_prices where currency_code=v_code;
   return new;
  end if;
  select decimal_places into v_decimals from public.store_currencies where code=v_code and is_active;
  if v_decimals is null then
   delete from public.product_currency_prices where currency_code=v_code;
   delete from public.variant_currency_prices where currency_code=v_code;
   delete from public.shipping_rate_currency_prices where currency_code=v_code;
   return new;
  end if;
  delete from public.product_currency_prices where currency_code=v_code;
  insert into public.product_currency_prices(product_id,currency_code,price,updated_at,updated_by)
  select p.id,v_code,round(p.price_myr*new.rate,v_decimals),now(),auth.uid() from public.products p
  on conflict(product_id,currency_code) do update set price=excluded.price,updated_at=excluded.updated_at,updated_by=excluded.updated_by;
  delete from public.variant_currency_prices where currency_code=v_code;
  insert into public.variant_currency_prices(variant_id,currency_code,price,updated_at,updated_by)
  select pv.id,v_code,round(pv.price_myr*new.rate,v_decimals),now(),auth.uid() from public.product_variants pv
  on conflict(variant_id,currency_code) do update set price=excluded.price,updated_at=excluded.updated_at,updated_by=excluded.updated_by;
  delete from public.shipping_rate_currency_prices where currency_code=v_code;
  insert into public.shipping_rate_currency_prices(shipping_rate_id,currency_code,base_fee,additional_fee,updated_at,updated_by)
  select s.id,v_code,round(s.base_fee_myr*new.rate,v_decimals),round(s.additional_fee_myr*new.rate,v_decimals),now(),auth.uid() from public.shipping_rates s
  on conflict(shipping_rate_id,currency_code) do update set base_fee=excluded.base_fee,additional_fee=excluded.additional_fee,updated_at=excluded.updated_at,updated_by=excluded.updated_by;
 end if;
 return new;
end; $$;

drop trigger if exists products_sync_currency_prices on public.products;
create trigger products_sync_currency_prices after insert or update of price_myr on public.products for each row execute function private.sync_currency_prices_from_myr();
drop trigger if exists variants_sync_currency_prices on public.product_variants;
create trigger variants_sync_currency_prices after insert or update of price_myr on public.product_variants for each row execute function private.sync_currency_prices_from_myr();
drop trigger if exists shipping_rates_sync_currency_prices on public.shipping_rates;
create trigger shipping_rates_sync_currency_prices after insert or update of base_fee_myr,additional_fee_myr on public.shipping_rates for each row execute function private.sync_currency_prices_from_myr();
drop trigger if exists exchange_rates_sync_currency_prices on public.currency_exchange_rates;
create trigger exchange_rates_sync_currency_prices after insert or update of rate,is_configured on public.currency_exchange_rates for each row execute function private.sync_currency_prices_from_myr();

delete from public.product_currency_prices where currency_code<>'MYR';
delete from public.variant_currency_prices where currency_code<>'MYR';
delete from public.shipping_rate_currency_prices where currency_code<>'MYR';
do $$ declare r record; begin
 for r in select currency_code from public.currency_exchange_rates where currency_code<>'MYR' and is_configured loop
  update public.currency_exchange_rates set rate=rate where currency_code=r.currency_code;
 end loop;
end $$;
