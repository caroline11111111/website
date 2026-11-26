
drop policy if exists variants_insert_authorized on public.product_variants;
create policy variants_insert_authorized on public.product_variants for insert to authenticated
 with check (app_private.has_permission('products.create') or app_private.has_permission('products.edit'));
