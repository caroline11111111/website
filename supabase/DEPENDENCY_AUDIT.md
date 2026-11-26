# Supabase Migration Dependency and Replay Audit

Date: 2026-11-26
Branch: `fix/storefront-render-admin-features-favicon`

## Scope and safety

The original 52 SQL migration files were recovered from the Production migration ledger and verified to match its 52 applied versions. A further seven forward-only migrations were added to capture security remediation and catalog objects that existed in Production but were missing from the recovered history.

A fresh online Supabase Free project, `website-security-test` (`xsvodzqyxyycbvwdwjru`), was created in Singapore at US$0/month. The test project is isolated and contains no copied Production Auth users, customer rows, or Storage objects.

All SQL writes and migration executions described in this report occurred only in that test project. Production project `jhjebhpzzjbtsmflwnzf` was inspected read-only. No Production schema, rows, policies, grants, Storage objects, cron jobs, Edge Functions, or deployments were changed.

No Docker, local PostgreSQL, local Supabase CLI, or paid database branch was used.

## Migration inventory

- 52 historical migration files match the Production migration ledger exactly.
- 7 additional forward-only migrations are now present in the repository; they have been applied only to the isolated test project.
- The test migration ledger contains 61 entries: 52 historical migrations, 7 forward-only migrations, and 2 test-only environment prerequisites.
- The initial replay stopped at migration 2 because the Production environment-level function `public.rls_auto_enable()` was missing. The function and its `ensure_rls` DDL event trigger were installed in the test project, then the migration succeeded and the full replay continued.
- All 52 historical migrations and all 7 forward-only migrations completed successfully in the test project.

### Forward-only migrations

1. `20261126090000_security_hardening_followup.sql`
2. `20261126100000_restore_public_variant_visibility_helpers.sql`
3. `20261126100500_restore_storefront_page_layout_policies.sql`
4. `20261126101000_restore_production_rpc_definitions_and_acl_defaults.sql`
5. `20261126101500_align_storefront_page_layout_privileges.sql`
6. `20261126102000_align_public_table_privileges.sql`
7. `20261126102500_remove_default_public_table_delete_grants.sql`

## Environment prerequisites

The historical migrations rely on Supabase-managed schemas and roles:

- `auth` for Auth identities and user foreign keys.
- `storage` for Storage buckets, objects, and policies.
- `cron` and `pg_cron` for deadline notification scheduling.
- Supabase roles including `anon`, `authenticated`, `service_role`, and `postgres`.

The 52 historical migrations do not create the Production `private` schema or the `ensure_rls` event trigger. Both are covered in `supabase/bootstrap/001_create_private_schema.sql`, together with the observed restricted default privileges for objects created by postgres in the public schema.

Observed installed extensions in both projects:
- `pgcrypto` 1.3
- `btree_gist` 1.7
- `pg_cron` 1.6.4

Production also has `pg_stat_statements`, `supabase_vault`, `uuid-ossp`, and `plpgsql`; this review did not establish that the recovered application migrations depend on those additional extensions.

## Catalog objects missing from the recovered migration history

The read-only Production catalog comparison identified objects that existed in Production but were not represented by the 52 historical migrations:

- `public.rls_auto_enable()` and the `ensure_rls` DDL event trigger.
- The owner-only `private` schema used by three currency trigger functions.
- Three `app_private` product/variant visibility helper functions and their associated public-read policy definitions.
- The `public.storefront_page_layouts` table and its three RLS policies. Production had two rows; the test project recreated the table empty and did not copy those rows.
- Production versions of `public.list_admin_users()` (which excludes the Owner identity from non-owner results) and `public.quote_shipping()` (which includes region-name normalization).
- Restricted default privileges for future public tables, functions, and sequences.

The forward-only migrations now capture these objects and ACLs. The legacy `public.submit_order()` body still differs from Production, but its ACL is postgres-only in both projects; anon and authenticated clients cannot execute it. It remains an inactive legacy RPC and was not restored as an active endpoint.

## Schema and privilege comparison

Read-only catalog comparisons between Production and the isolated test project found:

| Item | Production | Test project | Result |
|---|---:|---:|---|
| Public application tables | 48 | 48 | Names match |
| Public columns | 455 | 455 | Names, types, nullability, defaults match |
| Public indexes | 132 | 132 | Definitions match |
| Public table triggers | 93 | 93 | Definitions match |
| Historical public constraints | 229 | 229 | Definitions match |
| Additional shipping-address constraints | 0 | 3 | Intentional security hardening |
| SECURITY DEFINER functions | 64 | 64 | All have fixed function-level search_path |
| Function signatures across public/app_private/private | 72 | 72 | Signatures match |

After reconciliation:
- Public table ACLs match Production for anon, authenticated, and service_role.
- Public-schema default ACLs match Production.
- Function ACLs match Production for PUBLIC, anon, authenticated, and service_role.
- All non-refund Storage and public RLS policy definitions match Production.
- The test project replaces the single Production refund-evidence FOR ALL policy with four command-specific policies; this is the intended security fix.
- All 48 public application tables have RLS enabled in both projects.
- The four `app_private` tables have RLS enabled in the test project as defense in depth. Production still has RLS disabled on those four tables. Neither anon nor authenticated has direct SELECT privileges on those tables in either project.
- Both projects have identical four Storage bucket configurations:
  - `product-images`: public, 5 MiB, JPEG/PNG/WebP.
  - `homepage-media`: public, 5 MiB, JPEG/PNG/WebP.
  - `payment-proofs`: private, 5 MiB, JPEG/PNG/PDF.
  - `refund-evidence`: private, 5 MiB, JPEG/PNG/WebP.
- Both projects have the same active cron job: `order-deadline-notifications`, scheduled every 15 minutes, calling `public.process_order_deadline_notifications()`.

Function body differences are understood:
- `request_shipping_address_change()` and `sync_shipping_rate_currency_prices()` differ intentionally because the test project contains the new address and FX hardening.
- Three variant-visibility helpers and `rls_auto_enable()` have the same reviewed logic but differ in formatting/hash.
- `public.submit_order()` is the inactive legacy function noted above.
- The Production bodies of `list_admin_users()` and `quote_shipping()` were captured in forward-only migrations.

## Isolated behavior tests

All fixtures were created inside transactions in the test project and rolled back:

- Refund evidence: a test Admin with `refunds.view` but an explicit deny for `refunds.manage` could SELECT evidence but could not DELETE or INSERT. A test Admin with `refunds.manage` could DELETE and INSERT.
- The Storage delete-protection trigger was temporarily disabled only inside that transaction to isolate the RLS policy behavior; all test rows were rolled back. This was a database-level policy test, not a Storage HTTP API test.
- Shipping address change RPC: incomplete address JSON was rejected; a complete address request was accepted and recorded.
- Shipping address CHECK constraint: an invalid update to an order's shipping address was rejected.
- All test Auth users, orders, address requests, and Storage object fixtures were rolled back.

## Remaining review items

1. Confirm the actual hosted Data API exposed-schema setting. The repository `config.toml` alone does not prove the live dashboard setting. Keep `app_private` out of exposed schemas unless there is a reviewed reason otherwise.
2. Complete the remaining line-by-line review of all 64 SECURITY DEFINER function bodies; the catalog and targeted function checks do not replace a full code review.
3. Run customer/admin frontend integration tests against the isolated test project.
4. Re-check the Vercel build separately. The database replay did not deploy the application.
5. Do not apply the forward-only migrations to Production until the user separately approves a release plan.

## Safety boundary

Production remains read-only. Never use Production as a migration test target, and do not apply the historical or forward-only migrations to Production as part of recovery verification.
