import { supabase } from './supabase';

/**
 * Removes only an unlinked payment-proof object owned by the current user.
 * The Edge Function checks the authenticated UID and database references
 * before using its server-side Storage permission. A linked proof is retained.
 */
export const cleanupUnlinkedPaymentProof = async (path: string): Promise<void> => {
  const { error } = await supabase.functions.invoke('cleanup-unlinked-payment-proof', {
    body: { path },
  });
  if (error) {
    // Cleanup is best-effort; never block checkout or hide the original error.
    console.warn('Could not clean up an unlinked payment proof:', error.message);
  }
};
