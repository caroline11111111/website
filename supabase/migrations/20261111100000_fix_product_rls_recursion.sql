-- Break the products <-> product_variants RLS policy cycle.
-- The helper functions run with their owner privileges and have a fixed search_path.
-- They expose only boolean visibility checks, not product or inventory rows.

create or replace function app_private.product_has_active_variant(p_product_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.product_variants pv
    where pv.product_id = p_product_id
      and pv.is_active
  );
$$;

create or replace function app_private.product_has_sellable_variant(p_product_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.product_variants pv
    where pv.product_id = p_product_id
      and pv.is_active
      and pv.stock_quantity > pv.reserved_quantity
  );
$$;

create or replace function app_private.is_public_product_variant(
  p_product_id uuid,
  p_variant_stock integer,
  p_variant_reserved integer
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.products p
    where p.id = p_product_id
      and p.is_published
      and not p.is_archived
      and (
        p.sold_out_display = 'show'
        or p_variant_stock > p_variant_reserved
      )
  );
$$;

revoke all on function app_private.product_has_active_variant(uuid) from public;
revoke all on function app_private.product_has_sellable_variant(uuid) from public;
revoke all on function app_private.is_public_product_variant(uuid, integer, integer) from public;

grant usage on schema app_private to anon, authenticated;
grant execute on function app_private.product_has_active_variant(uuid) to anon, authenticated;
grant execute on function app_private.product_has_sellable_variant(uuid) to anon, authenticated;
grant execute on function app_private.is_public_product_variant(uuid, integer, integer) to anon, authenticated;

drop policy if exists products_public_read on public.products;
create policy products_public_read
on public.products
for select
to anon, authenticated
using (
  (
    is_published
    and not is_archived
    and (
      sold_out_display = 'show'
      or app_private.product_has_sellable_variant(id)
      or (
        not app_private.product_has_active_variant(id)
        and stock_quantity > reserved_quantity
      )
    )
  )
  or app_private.has_permission('products.view')
  or app_private.has_permission('inventory.view')
  or app_private.has_permission('inventory.adjust')
);

drop policy if exists variants_public_read on public.product_variants;
create policy variants_public_read
on public.product_variants
for select
to anon, authenticated
using (
  (
    is_active
    and app_private.is_public_product_variant(
      product_id,
      stock_quantity,
      reserved_quantity
    )
  )
  or app_private.has_permission('products.view')
  or app_private.has_permission('inventory.view')
  or app_private.has_permission('inventory.adjust')
);
