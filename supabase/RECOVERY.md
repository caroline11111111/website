# Supabase recovery and online validation

This folder contains the recovered Production migration history, the forward-only security/reconciliation migrations, and the configuration needed to reproduce the database structure.

## Safety boundary

- Work only on the GitHub branch `fix/storefront-render-admin-features-favicon`.
- Production project `jhjebhpzzjbtsmflwnzf` remains read-only.
- Do not apply migrations, DDL, DML, grants, policy changes, cron changes, or deployments to Production without a separate explicit release approval.
- No Production customer data, Auth users, Storage objects, secrets, or Edge Function deployments were copied or modified during this validation.
- The validation was performed online in Supabase; Docker, local PostgreSQL, Supabase CLI, and paid branches were not used.

## Projects

| Purpose | Project | Region | Status | Cost |
|---|---|---|---|---:|
| Production | `website` (`jhjebhpzzjbtsmflwnzf`) | Singapore | Active | Existing |
| Isolated test | `website-security-test` (`xsvodzqyxyycbvwdwjru`) | Singapore | Active healthy | US$0/month |

The test project is a separate Supabase project under the Free organization. It started with an empty application database. No Production rows, Auth accounts, or Storage objects were copied.

## Migration history and forward-only migrations

- The original Production ledger contains 52 historical migrations.
- Those 52 SQL files were recovered from the Production migration ledger and still match the historical Production versions.
- Seven additional forward-only migrations were added after the recovery to capture security remediation and Production catalog objects that had been created outside the original migration history:
  1. `20261126090000_security_hardening_followup.sql`
  2. `20261126100000_restore_public_variant_visibility_helpers.sql`
  3. `20261126100500_restore_storefront_page_layout_policies.sql`
  4. `20261126101000_restore_production_rpc_definitions_and_acl_defaults.sql`
  5. `20261126101500_align_storefront_page_layout_privileges.sql`
  6. `20261126102000_align_public_table_privileges.sql`
  7. `20261126102500_remove_default_public_table_delete_grants.sql`

These seven migrations are on the development branch and have been applied only to the isolated test project. They have **not** been applied to Production.

## Environment bootstrap prerequisite

The 52 historical migrations did not create the Production `private` schema or the Production `ensure_rls` DDL event trigger. The file `bootstrap/001_create_private_schema.sql` now documents these environment prerequisites and the observed default privileges:

- Create the owner-only `private` schema used by the three currency trigger functions.
- Match the restricted default privileges for new public tables, functions, and sequences.
- Install the `public.rls_auto_enable()` function and `ensure_rls` event trigger so every new public table has RLS enabled.

Run this bootstrap only against a clean, isolated Supabase project before replaying migrations. Never run it against Production. In the completed online test, the private schema and RLS event trigger were installed as separate test-only prerequisite entries before continuing the replay; default privileges were then aligned by the forward-only migration.

## Online replay result — 2026-11-26

The test project is healthy and the replay completed:

- 52 recovered historical migrations: applied successfully.
- 7 forward-only security/reconciliation migrations: applied successfully.
- 2 test-only environment prerequisites: recorded separately.
- Test migration ledger: 61 entries in total.
- The first attempt stopped at migration 2 because `public.rls_auto_enable()` was missing. The exact Production helper function and `ensure_rls` event trigger were then installed in the test project, after which the migration succeeded and the replay continued.
- No migration was run against Production.

## Catalog comparison results

The replayed test database was compared with Production using read-only catalog queries.

- Public application tables: 48 in each project.
- Public columns: 455 in each project; names, types, nullability, and defaults matched.
- Public indexes: 132 in each project; definitions matched.
- Public table triggers: 93 in each project; definitions matched.
- Public constraints: 229 historical constraints matched, plus the three new shipping-address validation constraints in the test project.
- Public tables with RLS: 48/48 in both projects.
- Public table ACLs and public-schema default ACLs matched after the reconciliation migrations.
- All 72 function signatures across `public`, `app_private`, and `private` matched.
- All 64 `SECURITY DEFINER` functions in both projects had a fixed function-level `search_path`.
- Function ACLs matched after reconciliation.
- Storage bucket configuration matched for all four buckets.
- Storage policies matched except for the intentional refund-evidence policy split in the test project.
- The `order-deadline-notifications` cron job matched Production: every 15 minutes, calling `public.process_order_deadline_notifications()`.

### Intentional test-only differences

- RLS is enabled on the four `app_private` tables in the test project. Production still has RLS disabled on those four tables; neither anon nor authenticated has direct table SELECT privileges in either project.
- The test project splits refund-evidence access into SELECT, INSERT, UPDATE, and DELETE policies. SELECT requires `refunds.view` or `refunds.manage`; every write requires `refunds.manage`. Production still has the original FOR ALL policy because no Production changes were made.
- The test project adds address CHECK constraints and stricter validation in `request_shipping_address_change()`.
- The test project removes the implicit 1:1 FX fallback in `sync_shipping_rate_currency_prices()`.
- `public.submit_order()` remains an inactive legacy function whose body differs from Production; its ACL is restricted to postgres, so clients cannot execute it. The active confirmed checkout RPCs were not changed by this note.

### Transaction-level behavior checks

All test fixtures were created and rolled back inside the isolated test project:

- A view-only admin with `refunds.view` and an explicit deny for `refunds.manage` could read refund-evidence objects, but could not delete or upload them.
- An admin with `refunds.manage` could delete and upload refund-evidence objects.
- The direct SQL test temporarily disabled Storage's protective delete trigger inside the transaction to isolate the RLS policy behavior; no Storage API or Production object was changed.
- `request_shipping_address_change()` rejected an incomplete address, accepted a complete address, and the CHECK constraint rejected an invalid order address update.
- Shipping currency sync: a temporary shipping rate created only the MYR price when CNY/SGD/USD had no configured positive FX rate; after a stale CNY price was inserted, the next sync removed it and updated the MYR amount. This confirms no synthetic 1:1 converted price is generated.
- All fixture users, orders, requests, Storage rows, shipping zones, rates, and converted prices were rolled back.

These are isolated database-level tests, not a full browser/API integration test of the customer and admin applications.

## Remaining checks

1. Confirm the actual hosted Data API exposed-schema setting; the repository config alone does not prove the live dashboard setting. Keep `app_private` out of exposed schemas unless there is a reviewed reason otherwise.
2. Complete the remaining line-by-line review of all 64 `SECURITY DEFINER` function bodies and application-level RPC tests.
3. Run customer/admin UI integration tests against the isolated project before considering any release.
4. Re-check Vercel build status separately; this database replay did not deploy the application.

## Storage and secrets

The four bucket declarations reproduce configuration only. They do not copy uploaded objects. No Production Auth users, Storage files, secrets, service-role keys, API keys, passwords, or customer data are stored in this repository or test project.
