grant select on table public.site_settings to anon, authenticated;
create policy site_settings_public_whatsapp_read on public.site_settings for select to anon, authenticated using (setting_key = 'whatsapp_support_phone');
create policy site_settings_admin_read on public.site_settings for select to authenticated using (app_private.has_permission('settings.manage'));
insert into public.site_settings (setting_key, setting_value, updated_at)
values ('whatsapp_support_phone', jsonb_build_object('phone', '+601158892234'), now())
on conflict (setting_key) do update set setting_value = excluded.setting_value, updated_at = now();