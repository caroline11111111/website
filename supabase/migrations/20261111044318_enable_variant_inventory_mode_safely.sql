
create or replace function public.enable_product_variants(p_product_id uuid)
returns void language plpgsql security definer set search_path=''
as $$
declare v_actor uuid:=auth.uid();v_product public.products%rowtype;
begin
 if v_actor is null or not (app_private.has_permission('products.edit') or app_private.has_permission('products.create')) then raise exception 'Permission denied';end if;
 select * into v_product from public.products where id=p_product_id for update;
 if not found or v_product.is_archived then raise exception 'Product not found or archived';end if;
 if v_product.stock_quantity<>0 or v_product.reserved_quantity<>0 then raise exception 'Product-level stock must be zero before enabling variants';end if;
 update public.products set inventory_mode='multiple',updated_at=now() where id=p_product_id;
end;
$$;
revoke all on function public.enable_product_variants(uuid) from public,anon;
grant execute on function public.enable_product_variants(uuid) to authenticated;
