import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

if (!supabaseUrl || !supabasePublishableKey) {
  console.warn('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.');
}

// Keep the two portals' sessions isolated even though they share one origin and Supabase project.
// The admin entry point is served from /admin.html; all other routes use the customer session.
const authStorageKey = typeof window !== 'undefined' && window.location.pathname.toLowerCase().endsWith('/admin.html')
  ? 'jaquack-admin-auth-token'
  : 'storefront-customer-auth-token';

export const supabase = createClient(
  supabaseUrl || 'https://example.supabase.co',
  supabasePublishableKey || 'sb_publishable_missing_configuration',
  {
    auth: {
      storageKey: authStorageKey,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);
