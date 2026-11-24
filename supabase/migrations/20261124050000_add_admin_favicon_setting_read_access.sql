-- Allow both public browser tabs to read their own independent favicon settings.
DROP POLICY IF EXISTS site_settings_anon_storefront_read ON public.site_settings;
CREATE POLICY site_settings_anon_storefront_read
ON public.site_settings
FOR SELECT
TO anon
USING (
  setting_key = ANY (ARRAY[
    'website_colour_theme',
    'whatsapp_support_phone',
    'storefront_currency_settings',
    'storefront_default_currency',
    'storefront_favicon',
    'admin_favicon'
  ]::text[])
);

DROP POLICY IF EXISTS site_settings_authenticated_read ON public.site_settings;
CREATE POLICY site_settings_authenticated_read
ON public.site_settings
FOR SELECT
TO authenticated
USING (
  setting_key = ANY (ARRAY[
    'website_colour_theme',
    'whatsapp_support_phone',
    'storefront_currency_settings',
    'storefront_default_currency',
    'storefront_favicon',
    'admin_favicon',
    'storefront_homepage_section_content',
    'product_card_design'
  ]::text[])
  OR app_private.has_permission('settings.manage')
);
