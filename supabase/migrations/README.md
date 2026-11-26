# Supabase migration history reconciliation

Last verified against Supabase project `jhjebhpzzjbtsmflwnzf` and branch `fix/storefront-render-admin-features-favicon`.

## Current status

- Supabase reports **52 applied migrations**.
- This repository now contains **20 SQL migration files** matching applied version prefixes and names.
- **32 applied migrations remain without SQL source files** in the GitHub branches inspected.
- The SQL for 14 migrations was recovered from the historical branch `fix/complete-missing-features` and renamed to the exact version recorded by Supabase. The content was preserved; only the version prefix was aligned.
- Six latest migration files were already present on the active branch; three were renamed to match the Supabase ledger.
- The unapplied draft `20261124040000_expose_storefront_favicon_setting.sql` was removed. The final Favicon read policy is recorded as `20261124031949_add_admin_favicon_setting_read_access`.
- The two old-branch draft migrations `fix_product_rls_recursion` and `normalize_shipping_region_matching` were not added because they do not appear as applied migration records in Supabase.
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
| `20261111063530` | `add_semantic_colour_theme_settings` | SQL 文件已恢复 |
| `20261112092613` | `fix_list_admin_users_email_return_type` | 缺少历史 SQL 源文件 |
| `20261112092626` | `allow_public_read_of_storefront_currency_settings` | 缺少历史 SQL 源文件 |
| `20261112092831` | `consolidate_public_storefront_settings_read_policies` | 缺少历史 SQL 源文件 |
| `20261113072134` | `add_product_multi_category_tags` | 缺少历史 SQL 源文件 |
| `20261118085704` | `order_deadlines_business_calendar` | SQL 文件已恢复 |
| `20261118085724` | `schedule_order_deadline_notifications` | SQL 文件已恢复 |
| `20261118090128` | `branding_storage_and_public_read` | SQL 文件已恢复 |
| `20261118090159` | `safe_inventory_reservation_read_rpc` | SQL 文件已恢复 |
| `20261118090638` | `separate_order_cancellation_and_stock_release` | SQL 文件已恢复 |
| `20261118090759` | `enforce_separate_cancel_permissions` | SQL 文件已恢复 |
| `20261118090947` | `record_deadline_reminder_history` | SQL 文件已恢复 |
| `20261118091026` | `secure_customer_directory_rpc` | SQL 文件已恢复 |
| `20261118091202` | `hold_deadline_notifications_pending_channel_choice` | SQL 文件已恢复 |
| `20261118091248` | `assign_deadline_extension_to_admin` | SQL 文件已恢复 |
| `20261118092725` | `independent_currency_pricing_foundation` | 缺少历史 SQL 源文件 |
| `20261118092815` | `currency_aware_shipping_and_checkout_rpc` | 缺少历史 SQL 源文件 |
| `20261119025538` | `manual_myr_exchange_rates_and_price_sync` | 缺少历史 SQL 源文件 |
| `20261119025737` | `snapshot_currency_precision_on_orders` | 缺少历史 SQL 源文件 |
| `20261119025809` | `refresh_fx_prices_on_currency_settings_change` | 缺少历史 SQL 源文件 |
| `20261119030907` | `grant_currency_catalog_table_privileges` | 缺少历史 SQL 源文件 |
| `20261119043746` | `allow_public_read_product_card_design` | 缺少历史 SQL 源文件 |
| `20261119084927` | `allow_public_homepage_section_content_read` | 缺少历史 SQL 源文件 |
| `20261120065419` | `custom_shipping_management` | SQL 文件已恢复 |
| `20261120065611` | `restrict_shipping_rate_trigger_function` | SQL 文件已恢复 |
| `20261120071007` | `fix_shipping_management_rls` | SQL 文件已恢复 |
| `20261124020020` | `prevent_payment_review_on_cancelled_orders` | SQL 文件已恢复 |
| `20261124020329` | `add_audited_order_refund_management` | SQL 文件已恢复 |
| `20261124031949` | `add_admin_favicon_setting_read_access` | SQL 文件已恢复 |
| `20261124064202` | `add_private_refund_evidence_attachments` | SQL 文件已恢复 |
| `20261124065611` | `add_individual_admin_permission_overrides_and_remove_unused_role` | SQL 文件已恢复 |
| `20261124065724` | `harden_admin_permission_rpc_wrappers` | SQL 文件已恢复 |

## Recovery guidance

1. Preserve the live database and its migration ledger.
2. Recover the remaining 32 missing SQL files from the original authoring environment, previous local clones, CI artifacts, or backups if available.
3. Compare recovered SQL with the current database schema and migration ledger before committing it.
4. If original SQL cannot be recovered, create a separately reviewed schema baseline for future fresh environments. Do not backfill old migration filenames with guessed SQL.
5. Until the missing history is recovered or a reviewed baseline is created, do not use this repository alone to bootstrap a fresh database or run `supabase db reset`.
6. Keep future schema changes in timestamped files under `supabase/migrations/`, commit them before or alongside applying them, and verify the resulting ledger after deployment.

## Filename corrections

- `20261124050000_add_admin_favicon_setting_read_access.sql` → `20261124031949_add_admin_favicon_setting_read_access.sql`
- `20261124130000_add_individual_admin_permission_overrides_and_remove_unused_role.sql` → `20261124065611_add_individual_admin_permission_overrides_and_remove_unused_role.sql`
- `20261124131500_harden_admin_permission_rpc_wrappers.sql` → `20261124065724_harden_admin_permission_rpc_wrappers.sql`
- The superseded, unapplied `20261124040000_expose_storefront_favicon_setting.sql` was removed.
