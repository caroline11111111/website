-- Keep the default semantic colour theme available to the storefront.
-- Public clients may read only this theme setting; all other site settings
-- remain protected by their existing policies.

grant select on table public.site_settings to anon, authenticated;

create policy site_settings_public_colour_theme_read
on public.site_settings
for select
to anon, authenticated
using (setting_key = 'website_colour_theme');

insert into public.site_settings (setting_key, setting_value, updated_at)
values (
  'website_colour_theme',
  '{
    "name": "Default Neutral",
    "primary": "#ded8d3",
    "secondary": "#4b3f34",
    "accent": "#b5a699",
    "background": "#fbf9f7",
    "surface": "#fffdfb",
    "textPrimary": "#2d2926",
    "textSecondary": "#6b625b",
    "border": "#ded8d3",
    "buttonPrimary": "#4b3f34",
    "buttonText": "#ffffff",
    "buttonHover": "#392f27",
    "inputBackground": "#fffdfa",
    "inputBorder": "#b5a699",
    "navigationActive": "#4b3f34",
    "overlay": "#4b3f34",
    "overlayOpacity": 0.5
  }'::jsonb,
  now()
)
on conflict (setting_key) do nothing;
