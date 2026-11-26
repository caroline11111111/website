
-- Table privileges complement RLS policies; they do not bypass row-level security.
grant select on table public.store_currencies to anon, authenticated;
grant insert, update, delete on table public.store_currencies to authenticated;

grant select on table public.currency_payment_instructions to anon, authenticated;
grant insert, update, delete on table public.currency_payment_instructions to authenticated;

-- Legacy per-currency price tables are intentionally not granted to storefront roles.
-- Current storefront pricing is calculated from MYR base prices and configured FX rates.
