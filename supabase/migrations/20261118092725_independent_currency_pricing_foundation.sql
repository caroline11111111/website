
-- Independent, manually maintained currency prices. No exchange-rate conversion is used.
create table if not exists public.store_currencies (
  code text primary key check (code ~ '^[A-Z]{3}$'),
  name text not null,
  symbol text not null,
  decimal_places smallint not null default 2 check (decimal_places between 0 and 4),
  is_active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
insert into public.store_currencies(code,name,symbol,decimal_places,is_active,display_order)
values
 ('MYR','Malaysian Ringgit','RM',2,true,1),
 ('SGD','Singapore Dollar','S$',2,true,2),
 ('USD','US Dollar','$',2,true,3),
 ('CNY','Chinese Yuan','¥',2,true,4)
on conflict(code) do update set name=excluded.name,symbol=excluded.symbol,decimal_places=excluded.decimal_places,is_active=true,display_order=excluded.display_order,updated_at=now();

create table if not exists public.product_currency_prices (
  product_id uuid not null references public.products(id) on delete cascade,
  currency_code text not null references public.store_currencies(code) on update cascade,
  price numeric(14,4) not null check (price >= 0),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  primary key(product_id,currency_code)
);
insert into public.product_currency_prices(product_id,currency_code,price)
select id,'MYR',price_myr from public.products
on conflict(product_id,currency_code) do nothing;

create table if not exists public.variant_currency_prices (
  variant_id uuid not null references public.product_variants(id) on delete cascade,
  currency_code text not null references public.store_currencies(code) on update cascade,
  price numeric(14,4) not null check (price >= 0),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  primary key(variant_id,currency_code)
);
insert into public.variant_currency_prices(variant_id,currency_code,price)
select id,'MYR',price_myr from public.product_variants
on conflict(variant_id,currency_code) do nothing;

create table if not exists public.shipping_rate_currency_prices (
  shipping_rate_id uuid not null references public.shipping_rates(id) on delete cascade,
  currency_code text not null references public.store_currencies(code) on update cascade,
  base_fee numeric(14,4) not null check (base_fee >= 0),
  additional_fee numeric(14,4) not null default 0 check (additional_fee >= 0),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  primary key(shipping_rate_id,currency_code)
);
insert into public.shipping_rate_currency_prices(shipping_rate_id,currency_code,base_fee,additional_fee)
select id,'MYR',base_fee_myr,additional_fee_myr from public.shipping_rates
on conflict(shipping_rate_id,currency_code) do nothing;

alter table public.orders
  add column if not exists currency_code text references public.store_currencies(code),
  add column if not exists currency_symbol_snapshot text,
  add column if not exists subtotal_amount numeric(14,4),
  add column if not exists shipping_fee_amount numeric(14,4),
  add column if not exists total_amount numeric(14,4);
update public.orders set currency_code='MYR',currency_symbol_snapshot='RM',
 subtotal_amount=subtotal_myr,shipping_fee_amount=shipping_fee_myr,total_amount=total_myr
where currency_code is null or subtotal_amount is null or shipping_fee_amount is null or total_amount is null;
alter table public.orders alter column currency_code set default 'MYR';
alter table public.orders alter column currency_code set not null;
alter table public.orders alter column currency_symbol_snapshot set default 'RM';
alter table public.orders alter column currency_symbol_snapshot set not null;
alter table public.orders alter column subtotal_amount set not null;
alter table public.orders alter column shipping_fee_amount set not null;
alter table public.orders alter column total_amount set not null;
alter table public.orders add constraint orders_currency_amounts_nonnegative check (subtotal_amount >= 0 and shipping_fee_amount >= 0 and total_amount >= 0);

alter table public.order_items
  add column if not exists currency_code text references public.store_currencies(code),
  add column if not exists unit_price numeric(14,4),
  add column if not exists line_total numeric(14,4);
update public.order_items set currency_code='MYR',unit_price=unit_price_myr,line_total=line_total_myr
where currency_code is null or unit_price is null or line_total is null;
alter table public.order_items alter column currency_code set default 'MYR';
alter table public.order_items alter column currency_code set not null;
alter table public.order_items alter column unit_price set not null;
alter table public.order_items alter column line_total set not null;

alter table public.payment_proofs
  add column if not exists currency_code text references public.store_currencies(code),
  add column if not exists expected_amount numeric(14,4);
update public.payment_proofs pp set currency_code=o.currency_code,expected_amount=o.total_amount
from public.orders o where o.id=pp.order_id and (pp.currency_code is null or pp.expected_amount is null);

create table if not exists public.currency_payment_instructions (
  currency_code text primary key references public.store_currencies(code) on update cascade,
  bank_name text,
  account_name text,
  account_number text,
  payment_instructions text,
  is_active boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  constraint currency_payment_instructions_complete check (
    not is_active or (
      nullif(trim(coalesce(bank_name,'')),'') is not null and
      nullif(trim(coalesce(account_name,'')),'') is not null and
      nullif(trim(coalesce(account_number,'')),'') is not null
    )
  )
);

alter table public.store_currencies enable row level security;
alter table public.product_currency_prices enable row level security;
alter table public.variant_currency_prices enable row level security;
alter table public.shipping_rate_currency_prices enable row level security;
alter table public.currency_payment_instructions enable row level security;

drop policy if exists store_currencies_public_read on public.store_currencies;
create policy store_currencies_public_read on public.store_currencies for select to anon,authenticated using (is_active or app_private.has_permission('settings.manage'));
drop policy if exists store_currencies_manage on public.store_currencies;
create policy store_currencies_manage on public.store_currencies for all to authenticated using (app_private.has_permission('settings.manage')) with check (app_private.has_permission('settings.manage'));

drop policy if exists product_currency_prices_public_read on public.product_currency_prices;
create policy product_currency_prices_public_read on public.product_currency_prices for select to anon,authenticated using (
 exists(select 1 from public.products p where p.id=product_id and ((p.is_published and not p.is_archived) or app_private.has_permission('products.view') or app_private.has_permission('products.edit') or app_private.has_permission('products.create')))
);
drop policy if exists product_currency_prices_manage on public.product_currency_prices;
create policy product_currency_prices_manage on public.product_currency_prices for all to authenticated using (app_private.has_permission('products.edit') or app_private.has_permission('products.create')) with check (app_private.has_permission('products.edit') or app_private.has_permission('products.create'));

drop policy if exists variant_currency_prices_public_read on public.variant_currency_prices;
create policy variant_currency_prices_public_read on public.variant_currency_prices for select to anon,authenticated using (
 exists(select 1 from public.product_variants v join public.products p on p.id=v.product_id where v.id=variant_id and ((p.is_published and not p.is_archived and v.is_active) or app_private.has_permission('products.view') or app_private.has_permission('products.edit') or app_private.has_permission('products.create')))
);
drop policy if exists variant_currency_prices_manage on public.variant_currency_prices;
create policy variant_currency_prices_manage on public.variant_currency_prices for all to authenticated using (app_private.has_permission('products.edit') or app_private.has_permission('products.create')) with check (app_private.has_permission('products.edit') or app_private.has_permission('products.create'));

drop policy if exists shipping_rate_currency_prices_public_read on public.shipping_rate_currency_prices;
create policy shipping_rate_currency_prices_public_read on public.shipping_rate_currency_prices for select to anon,authenticated using (
 exists(select 1 from public.shipping_rates r join public.shipping_zones z on z.id=r.zone_id where r.id=shipping_rate_id and r.is_active and z.is_active)
);
drop policy if exists shipping_rate_currency_prices_manage on public.shipping_rate_currency_prices;
create policy shipping_rate_currency_prices_manage on public.shipping_rate_currency_prices for all to authenticated using (app_private.has_permission('shipping_rates.manage')) with check (app_private.has_permission('shipping_rates.manage'));

drop policy if exists currency_payment_instructions_public_read on public.currency_payment_instructions;
create policy currency_payment_instructions_public_read on public.currency_payment_instructions for select to anon,authenticated using (is_active);
drop policy if exists currency_payment_instructions_manage on public.currency_payment_instructions;
create policy currency_payment_instructions_manage on public.currency_payment_instructions for all to authenticated using (app_private.has_permission('settings.manage')) with check (app_private.has_permission('settings.manage'));

create index if not exists product_currency_prices_currency_idx on public.product_currency_prices(currency_code,product_id);
create index if not exists variant_currency_prices_currency_idx on public.variant_currency_prices(currency_code,variant_id);
create index if not exists shipping_rate_currency_prices_currency_idx on public.shipping_rate_currency_prices(currency_code,shipping_rate_id);
