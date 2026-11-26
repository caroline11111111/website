-- Restore Production's RLS policies for storefront page layouts.
-- The table was present in the recovered migration replay, but these policies
-- were present only in the Production catalog and absent from migration history.

CREATE POLICY storefront_page_layouts_public_read
ON public.storefront_page_layouts
FOR SELECT
TO anon, authenticated
USING (
  is_published
  OR app_private.has_permission('content.manage')
);

CREATE POLICY storefront_page_layouts_admin_insert
ON public.storefront_page_layouts
FOR INSERT
TO authenticated
WITH CHECK (
  app_private.has_permission('content.manage')
);

CREATE POLICY storefront_page_layouts_admin_update
ON public.storefront_page_layouts
FOR UPDATE
TO authenticated
USING (
  app_private.has_permission('content.manage')
)
WITH CHECK (
  app_private.has_permission('content.manage')
);
