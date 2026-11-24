-- Allow public storefront pages to read only the configured favicon setting.
-- Upload and replacement remain restricted by the existing settings.manage policies.
alter policy site_settings_anon_storefront_read
on public.site_settings
to anon
using (
  setting_key = any (
    array[
      'website_colour_theme',
      'whatsapp_support_phone',
      'storefront_currency_settings',
      'storefront_favicon'
    ]::text[]
  )
);
