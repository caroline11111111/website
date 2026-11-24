-- Public storefront clients (anonymous and authenticated) may read only
-- storefront-facing settings. Admin-only settings remain protected by RLS.
alter policy site_settings_anon_storefront_read
on public.site_settings
to anon
using (
  setting_key = any (
    array[
      'website_colour_theme',
      'whatsapp_support_phone',
      'storefront_currency_settings',
      'storefront_default_currency',
      'storefront_favicon'
    ]::text[]
  )
);

alter policy site_settings_authenticated_read
on public.site_settings
to authenticated
using (
  setting_key = any (
    array[
      'website_colour_theme',
      'whatsapp_support_phone',
      'storefront_currency_settings',
      'storefront_default_currency',
      'storefront_favicon',
      'storefront_homepage_section_content',
      'product_card_design'
    ]::text[]
  )
  or app_private.has_permission('settings.manage'::text)
);
