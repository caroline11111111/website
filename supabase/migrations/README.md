# Supabase migration history reconciliation

Last verified against Supabase project `jhjebhpzzjbtsmflwnzf` and branch `fix/storefront-render-admin-features-favicon`.

## Important status

- Supabase reports **52 applied migrations**.
- This repository contains **6 SQL migration files** whose version prefixes now match applied migration records.
- **46 earlier applied migrations have no recoverable SQL source in the current Git history/tree inspected during this reconciliation.**
- The missing historical SQL was not fabricated from migration names or current schema state. Current schema state is not a safe substitute for the original ordered migrations.
- Do not use this repository alone to bootstrap a fresh database, run `supabase db reset`, or assume it can recreate the production schema until the missing history is recovered or a separately reviewed baseline strategy is prepared.
- No migration was re-applied to the live database as part of this reconciliation.

## Applied migration manifest

| Version | Name | Repository status |
|---|---|---|
| `20261111042546` | `initial_commerce_schema_and_rls` | 缺少历史 SQL 源文件 |
| `20261111042701` | `commerce_security_rpc_and_order_submission` | 缺少历史 SQL 源文件 |
| `20261111042734` | `admin_order_workflows_and_inventory_dispatch` | 缺少历史 SQL 源文件 |
| `20261111042927` | `sku_integrity_shipping_rules_and_payment_resubmission` | 缺少历史 SQL 源文件 |
| `20261111043109` | `inventory_integrity_product_lifecycle_and_admin_rbac` | 缺少历史 SQL 源文件 |
| `20261111043141` | `tighten_owner_permissions_and_order_integrity` | 缺少历史 SQL 源文件 |
| `20261111043229` | `customer_admin_read_policies_and_shipping_quote` | 缺少历史 SQL 源文件 |
| `20261111043243` | `require_price_and_shipping_reconfirmation_at_checkout` | 缺少历史 SQL 源文件 |
| `20261111043321` | `consolidate_customer_profile_rls_policies` | 缺少历史 SQL 源文件 |
| `20261111043333` | `audit_direct_admin_data_changes` | 缺少历史 SQL 源文件 |
| `20261111043450` | `owner_bootstrap_recovery_secret_and_admin_management` | 缺少历史 SQL 源文件 |
| `20261111043459` | `owner_recovery_edge_function_rpc` | 缺少历史 SQL 源文件 |
| `20261111043655` | `remove_duplicate_legacy_payment_storage_policies` | 缺少历史 SQL 源文件 |
| `20261111043802` | `enforce_image_slot_limits` | 缺少历史 SQL 源文件 |
| `20261111043807` | `correct_media_slot_limit_trigger` | 缺少历史 SQL 源文件 |
| `20261111044048` | `validate_payment_resubmission_storage_metadata` | 缺少历史 SQL 源文件 |
| `20261111044120` | `allow_inventory_roles_to_read_catalogue` | 缺少历史 SQL 源文件 |
| `20261111044302` | `allow_product_editors_to_add_variants` | 缺少历史 SQL 源文件 |
| `20261111044318` | `enable_variant_inventory_mode_safely` | 缺少历史 SQL 源文件 |
| `20261111061703` | `configure_whatsapp_support_setting` | 缺少历史 SQL 源文件 |
| `20261111063530` | `add_semantic_colour_theme_settings` | 缺少历史 SQL 源文件 |
| `20261112092613` | `fix_list_admin_users_email_return_type` | 缺少历史 SQL 源文件 |
| `20261112092626` | `allow_public_read_of_storefront_currency_settings` | 缺少历史 SQL 源文件 |
| `20261112092831` | `consolidate_public_storefront_settings_read_policies` | 缺少历史 SQL 源文件 |
| `20261113072134` | `add_product_multi_category_tags` | 缺少历史 SQL 源文件 |
| `20261118085704` | `order_deadlines_business_calendar` | 缺少历史 SQL 源文件 |
| `20261118085724` | `schedule_order_deadline_notifications` | 缺少历史 SQL 源文件 |
| `20261118090128` | `branding_storage_and_public_read` | 缺少历史 SQL 源文件 |
| `20261118090159` | `safe_inventory_reservation_read_rpc` | 缺少历史 SQL 源文件 |
| `20261118090638` | `separate_order_cancellation_and_stock_release` | 缺少历史 SQL 源文件 |
| `20261118090759` | `enforce_separate_cancel_permissions` | 缺少历史 SQL 源文件 |
| `20261118090947` | `record_deadline_reminder_history` | 缺少历史 SQL 源文件 |
| `20261118091026` | `secure_customer_directory_rpc` | 缺少历史 SQL 源文件 |
| `20261118091202` | `hold_deadline_notifications_pending_channel_choice` | 缺少历史 SQL 源文件 |
| `20261118091248` | `assign_deadline_extension_to_admin` | 缺少历史 SQL 源文件 |
| `20261118092725` | `independent_currency_pricing_foundation` | 缺少历史 SQL 源文件 |
| `20261118092815` | `currency_aware_shipping_and_checkout_rpc` | 缺少历史 SQL 源文件 |
| `20261119025538` | `manual_myr_exchange_rates_and_price_sync` | 缺少历史 SQL 源文件 |
| `20261119025737` | `snapshot_currency_precision_on_orders` | 缺少历史 SQL 源文件 |
| `20261119025809` | `refresh_fx_prices_on_currency_settings_change` | 缺少历史 SQL 源文件 |
| `20261119030907` | `grant_currency_catalog_table_privileges` | 缺少历史 SQL 源文件 |
| `20261119043746` | `allow_public_read_product_card_design` | 缺少历史 SQL 源文件 |
| `20261119084927` | `allow_public_homepage_section_content_read` | 缺少历史 SQL 源文件 |
| `20261120065419` | `custom_shipping_management` | 缺少历史 SQL 源文件 |
| `20261120065611` | `restrict_shipping_rate_trigger_function` | 缺少历史 SQL 源文件 |
| `20261120071007` | `fix_shipping_management_rls` | 缺少历史 SQL 源文件 |
| `20261124020020` | `prevent_payment_review_on_cancelled_orders` | 已在 GitHub 对应 SQL |
| `20261124020329` | `add_audited_order_refund_management` | 已在 GitHub 对应 SQL |
| `20261124031949` | `add_admin_favicon_setting_read_access` | 已在 GitHub 对应 SQL |
| `20261124064202` | `add_private_refund_evidence_attachments` | 已在 GitHub 对应 SQL |
| `20261124065611` | `add_individual_admin_permission_overrides_and_remove_unused_role` | 已在 GitHub 对应 SQL |
| `20261124065724` | `harden_admin_permission_rpc_wrappers` | 已在 GitHub 对应 SQL |

## Recovery guidance

1. Preserve the live database and its migration ledger.
2. Recover the 44 missing SQL files from the original authoring environment, previous local clones, CI artifacts, or backups if available.
3. Compare recovered SQL with the current database schema and migration ledger before committing it.
4. If original SQL cannot be recovered, create a separately reviewed schema baseline for future fresh environments. Do not backfill old migration filenames with guessed SQL.
5. Keep future schema changes in timestamped files under `supabase/migrations/`, commit them before or alongside applying them, and verify the resulting ledger after deployment.

## Filename corrections made

The following repository filenames were aligned to the versions recorded by Supabase:

- `20261124050000_add_admin_favicon_setting_read_access.sql` → `20261124031949_add_admin_favicon_setting_read_access.sql`
- `20261124130000_add_individual_admin_permission_overrides_and_remove_unused_role.sql` → `20261124065611_add_individual_admin_permission_overrides_and_remove_unused_role.sql`
- `20261124131500_harden_admin_permission_rpc_wrappers.sql` → `20261124065724_harden_admin_permission_rpc_wrappers.sql`

The un-applied draft `20261124040000_expose_storefront_favicon_setting.sql` was removed from the migration directory. The final applied Favicon policy is represented by the migration recorded as `20261124031949`.
