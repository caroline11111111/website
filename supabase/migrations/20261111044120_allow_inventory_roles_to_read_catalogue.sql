
drop policy if exists products_public_read on public.products;
create policy products_public_read on public.products for select to anon,authenticated using (
 (is_published and not is_archived and (
   sold_out_display='show'
   or exists(select 1 from public.product_variants pv where pv.product_id=products.id and pv.is_active and pv.stock_quantity>pv.reserved_quantity)
   or (not exists(select 1 from public.product_variants pv where pv.product_id=products.id and pv.is_active) and stock_quantity>reserved_quantity)
 ))
 or app_private.has_permission('products.view')
 or app_private.has_permission('inventory.view')
 or app_private.has_permission('inventory.adjust')
);
drop policy if exists variants_public_read on public.product_variants;
create policy variants_public_read on public.product_variants for select to anon,authenticated using (
 is_active and exists(select 1 from public.products p where p.id=product_id and p.is_published and not p.is_archived
  and (p.sold_out_display='show' or product_variants.stock_quantity>product_variants.reserved_quantity))
 or app_private.has_permission('products.view')
 or app_private.has_permission('inventory.view')
 or app_private.has_permission('inventory.adjust')
);
