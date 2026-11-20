-- Trigger-only helper: prevent direct Data API/RPC execution.
revoke all on function public.sync_shipping_rate_currency_prices() from public, anon, authenticated;
