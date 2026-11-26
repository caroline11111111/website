-- Restore Production's public product/variant visibility helpers.
-- These objects exist in Production but were absent from the recovered migration
-- ledger. Keeping them in version control makes clean replays reproducible.

CREATE OR REPLACE FUNCTION app_private.product_has_active_variant(p_product_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.product_variants pv
    WHERE pv.product_id = p_product_id
      AND pv.is_active
  );
$function$;

CREATE OR REPLACE FUNCTION app_private.product_has_sellable_variant(p_product_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.product_variants pv
    WHERE pv.product_id = p_product_id
      AND pv.is_active
      AND pv.stock_quantity > pv.reserved_quantity
  );
$function$;

CREATE OR REPLACE FUNCTION app_private.is_public_product_variant(
  p_product_id uuid,
  p_variant_stock integer,
  p_variant_reserved integer
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.products p
    WHERE p.id = p_product_id
      AND p.is_published
      AND NOT p.is_archived
      AND (
        p.sold_out_display = 'show'
        OR p_variant_stock > p_variant_reserved
      )
  );
$function$;

GRANT EXECUTE ON FUNCTION app_private.product_has_active_variant(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION app_private.product_has_sellable_variant(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION app_private.is_public_product_variant(uuid, integer, integer) TO anon, authenticated;

DROP POLICY IF EXISTS products_public_read ON public.products;
CREATE POLICY products_public_read
ON public.products
FOR SELECT
TO anon, authenticated
USING (
  (
    is_published
    AND NOT is_archived
    AND (
      sold_out_display = 'show'
      OR app_private.product_has_sellable_variant(id)
      OR (
        NOT app_private.product_has_active_variant(id)
        AND stock_quantity > reserved_quantity
      )
    )
  )
  OR app_private.has_permission('products.view')
  OR app_private.has_permission('inventory.view')
  OR app_private.has_permission('inventory.adjust')
);

DROP POLICY IF EXISTS variants_public_read ON public.product_variants;
CREATE POLICY variants_public_read
ON public.product_variants
FOR SELECT
TO anon, authenticated
USING (
  (
    is_active
    AND app_private.is_public_product_variant(product_id, stock_quantity, reserved_quantity)
  )
  OR app_private.has_permission('products.view')
  OR app_private.has_permission('inventory.view')
  OR app_private.has_permission('inventory.adjust')
);
