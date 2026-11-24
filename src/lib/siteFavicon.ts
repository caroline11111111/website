import { supabase } from './supabase';

export async function applySiteFavicon() {
  const { data, error } = await supabase
    .from('site_settings')
    .select('setting_value')
    .eq('setting_key', 'storefront_favicon')
    .maybeSingle();
  if (error) return;
  const value = (data?.setting_value || {}) as { storage_path?: string | null; mime_type?: string | null };
  const path = value.storage_path;
  const link = document.querySelector<HTMLLinkElement>('link[rel~="icon"]');
  if (!link) return;
  if (!path) {
    link.href = '/favicon.svg';
    link.type = 'image/svg+xml';
    return;
  }
  const { data: publicData } = supabase.storage.from('homepage-media').getPublicUrl(path);
  link.href = publicData.publicUrl;
  link.type = value.mime_type || 'image/png';
}
