# Supabase recovery setup

This folder contains the recovered migration history plus the local configuration and Edge Function source needed to reproduce more of the Supabase project.

## Safety boundary

- Work only on the existing GitHub feature branch: `fix/storefront-render-admin-features-favicon`.
- Do not run `supabase link`, `supabase db push`, or deploy functions as part of local recovery.
- Do not run these recovered migrations against the live Production database.
- No Production schema, data, Storage objects, Auth users, secrets, or Edge Function deployments were changed while preparing these files.

## Files added

- `config.toml`: local Supabase configuration, PostgreSQL major version 17, the four observed Storage buckets, and JWT verification for the account-management Edge Function.
- `functions/owner-manage-account-password/index.ts`: source retrieved from the active Production Edge Function (version 3). Its deployment setting has `verify_jwt = true`.
- `bootstrap/001_create_private_schema.sql`: local-only prerequisite described below.

## Important prerequisite: private schema

The live database contains a `private` schema owned by `postgres`, with access restricted to the owner. Three currency-related trigger functions live in that schema:

- `private.set_order_exchange_rate_snapshot()`
- `private.sync_currency_prices_from_myr()`
- `private.refresh_prices_after_currency_catalog_change()`

The 52 recovered historical migrations do not contain a `CREATE SCHEMA private` statement. Therefore, a clean database may fail when it reaches those functions unless the schema exists first.

Do not edit the contents of the 52 already-applied historical migration files to hide this gap. The bootstrap SQL is deliberately kept separate so it can be run against a disposable local database only.

### Local test sequence

1. Install Docker Desktop and the Supabase CLI.
2. From the repository root, start the local stack with `supabase start`.
3. Open the local Studio at `http://127.0.0.1:54323`, open SQL Editor, and run the contents of `bootstrap/001_create_private_schema.sql` against the local database.
4. From the repository root, run `supabase migration up` to apply the recovered migrations to the local database.
5. Run `supabase migration list` and inspect the local database for the expected tables, RLS policies, functions, triggers, and cron job.
6. Do not use `supabase db reset` yet. A reset replays the migration history from scratch and the current history does not yet include the private-schema prerequisite. First convert that prerequisite into a properly generated, reviewed migration using the Supabase CLI.

This is a local-only procedure. Do not link the local CLI project to Production while carrying out the recovery test.

## Storage recovery

The local config declares these bucket settings from the live project:

| Bucket | Public | Limit | Allowed MIME types |
|---|---:|---:|---|
| `product-images` | Yes | 5 MiB | JPEG, PNG, WebP |
| `homepage-media` | Yes | 5 MiB | JPEG, PNG, WebP |
| `payment-proofs` | No | 5 MiB | JPEG, PNG, PDF |
| `refund-evidence` | No | 5 MiB | JPEG, PNG, WebP |

Bucket configuration and Storage RLS policies do not copy the actual uploaded files. Object contents need a separate backup/export and restore procedure.

## Secrets and Auth data

No Production secrets, service-role keys, API keys, user passwords, or Auth user records are stored in this repository. The Edge Function relies on Supabase runtime environment variables. A local test must use local credentials only.

## What this does not yet prove

A successful static file check does not prove that all SQL executes on a fresh PostgreSQL instance. The local Docker replay is still required. Edge Function source is backed up, but secrets and live Auth/Storage data are not included in the source repository.
