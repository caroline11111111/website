# Online Migration Dependency Audit

Date: 2026-11-26
Branch: `fix/storefront-render-admin-features-favicon`

## Scope and safety

This is a static review of the 52 recovered SQL migration files plus read-only catalog inspection of the existing Supabase Production project. No SQL writes, migrations, deployments, branch creation, or Production configuration changes were performed.

This report does not replace a clean database replay. That remains unverified because the current workflow is intentionally online-only and no free isolated PostgreSQL/Supabase test database has been established.

## Migration inventory

- 52 SQL migration files were present in `supabase/migrations`.
- Migration sequence was already verified against the Production migration ledger in the prior recovery pass.
- The initial migration creates schema `app_private`.
- The migrations create/ensure these extensions:
  - `pgcrypto`
  - `btree_gist`
  - `pg_cron` (in `pg_catalog`)
- Migrations reference Supabase-managed schemas/services:
  - `auth` (identity functions and user references)
  - `storage` (objects, buckets, and Storage policies)
  - `cron` (deadline notification scheduling)
- No migration creates schema `private`. Two currency-related migrations create functions in `private`; therefore the separate local-only bootstrap prerequisite remains necessary for a clean replay unless it is converted into a reviewed migration later.
- No migration creates database roles/users. The SQL expects Supabase roles such as `anon`, `authenticated`, and `service_role` to exist.

## Production catalog comparison (read-only)

Observed installed extensions:
- `pgcrypto` 1.3
- `btree_gist` 1.7
- `pg_cron` 1.6.4
- `pg_stat_statements` 1.11
- `supabase_vault` 0.3.1
- `uuid-ossp` 1.1
- `plpgsql` 1.0

The first three are directly represented in the migration SQL. The additional extensions are present in Production, but this scan did not establish that the recovered migrations depend on them.

Observed relevant schemas: `public`, `app_private`, `private`, `auth`, `storage`, `extensions`, `cron`, and `vault`. The Supabase-managed schemas and roles are environment prerequisites, not objects that should be recreated by blindly replaying application migrations.

Observed relevant roles include `anon`, `authenticated`, `authenticator`, `service_role`, `postgres`, and `supabase_admin`.

## Cron dependency

The recovered migrations install the `pg_cron` extension and create the job `order-deadline-notifications`. Production currently has one active job:

- Schedule: `*/15 * * * *`
- Command: `select public.process_order_deadline_notifications();`

The existence of this job was verified read-only. It was not changed or manually triggered.

## SECURITY DEFINER inventory

Read-only catalog inspection found 64 `SECURITY DEFINER` functions across `public`, `app_private`, and `private`:

| Schema | Count | Fixed function search_path |
|---|---:|---:|
| public | 40 | 40 |
| app_private | 21 | 21 |
| private | 3 | 3 |

All 64 catalog entries have a function-level `search_path` setting. Most use an empty search path; one public function uses `extensions, pg_catalog`. This is a positive hardening signal, not proof that each function body has correct authorization checks or safe data handling.

Privilege summary from catalog checks:
- `public`: 0 functions executable by `anon`; 33 executable by `authenticated`.
- `app_private`: 13 executable by `anon`; 16 executable by `authenticated`.
- `private`: 3 report executable by `anon` and `authenticated` at the function ACL layer. The schema ACL observed in the earlier read-only check restricts schema use to its owner, so function ACL alone does not establish that clients can reach these functions.

The `app_private` schema usage grants and its function ACLs deserve a dedicated exposure review. The actual PostgREST exposed-schema configuration was not confirmed in the earlier checks, so no grant/revoke change is recommended from this evidence alone.

## Findings and next checks

1. **Known replay prerequisite:** `private` schema is not created by the 52 migrations. The local-only bootstrap file covers this prerequisite for the current manual test procedure.
2. **Managed service prerequisites:** a replay environment must provide Supabase Auth, Storage, the expected Supabase roles, and `pg_cron`; a generic empty PostgreSQL database is not an equivalent test target.
3. **Function review still needed:** review the bodies of all 64 `SECURITY DEFINER` functions for actor checks, object ownership, role/permission checks, dynamic SQL, and unintended data disclosure. The catalog scan only checked search_path and ACL metadata.
4. **API exposure still needed:** confirm the actual Data API exposed schemas and assess whether `app_private` should be exposed at all. Do not revoke grants until dependencies and policy behavior are verified.
5. **Clean replay still unverified:** static dependency checks cannot prove that all 52 migrations apply in order or that the resulting schema matches Production.

## Safety boundary

Do not run these migrations, bootstrap SQL, DDL, DML, cron commands, or privilege changes against Production as part of recovery verification. Any future execution test must use a separate isolated environment and remain within a confirmed free allowance.
