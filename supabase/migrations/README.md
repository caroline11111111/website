# Supabase migration history

Source of truth: Supabase project `jhjebhpzzjbtsmflwnzf`, table `supabase_migrations.schema_migrations`, column `statements[1]`.

## Reconciliation status

- Supabase migration ledger: **52 applied migrations**.
- Repository SQL files: **52**.
- Every applied migration now has a matching `<version>_<name>.sql` file in this directory.
- The SQL contents were recovered from the SQL statements retained by Supabase for each applied migration. This is not a reconstruction from current schema guesses.
- Six files that existed in the repository but differed from the database-recorded SQL were replaced with the exact recorded statement.
- The three incorrectly timestamped migration files were aligned to their actual Supabase versions.
- The superseded, unapplied Favicon draft migration was removed.
- **No migration was applied, re-applied, rolled back, or otherwise executed against the live database during this recovery.** This operation restored source files in GitHub only.

## Verification requirements before using migrations on another database

1. Keep the migration version and name exactly aligned with the Supabase ledger.
2. Review this migration history before using it to bootstrap a fresh environment.
3. Confirm required Supabase-managed services, extensions, Auth, Storage buckets, and Edge Functions are also provisioned; SQL migration history alone may not recreate external resources or data.
4. Never re-run this full history against the already-migrated production database.

## Applied migration manifest

| Version | Name | Repository file |
|---|---|---|
| `20261111042546` | `initial_commerce_schema_and_rls` | `Recovered` |
| `20261111042701` | `commerce_security_rpc_and_order_submission` | `Recovered` |
| `20261111042734` | `admin_order_workflows_and_inventory_dispatch` | `Recovered` |
| `20261111042927` | `sku_integrity_shipping_rules_and_payment_resubmission` | `Recovered` |
| `20261111043109` | `inventory_integrity_product_lifecycle_and_admin_rbac` | `Recovered` |
| `20261111043141` | `tighten_owner_permissions_and_order_integrity` | `Recovered` |
| `20261111043229` | `customer_admin_read_policies_and_shipping_quote` | `Recovered` |
| `20261111043243` | `require_price_and_shipping_reconfirmation_at_checkout` | `Recovered` |
| `20261111043321` | `consolidate_customer_profile_rls_policies` | `Recovered` |
| `20261111043333` | `audit_direct_admin_data_changes` | `Recovered` |
| `20261111043450` | `owner_bootstrap_recovery_secret_and_admin_management` | `Recovered` |
| `20261111043459` | `owner_recovery_edge_function_rpc` | `Recovered` |
| `20261111043655` | `remove_duplicate_legacy_payment_storage_policies` | `Recovered` |
| `20261111043802` | `enforce_image_slot_limits` | `Recovered` |
| `20261111043807` | `correct_media_slot_limit_trigger` | `Recovered` |
| `20261111044048` | `validate_payment_resubmission_storage_metadata` | `Recovered` |
| `20261111044120` | `allow_inventory_roles_to_read_catalogue` | `Recovered` |
| `20261111044302` | `allow_product_editors_to_add_variants` | `Recovered` |
| `20261111044318` | `enable_variant_inventory_mode_safely` | `Recovered` |
| `20261111061703` | `configure_whatsapp_support_setting` | `Recovered` |
| `20261111063530` | `add_semantic_colour_theme_settings` | `Recovered` |
| `20261112092613` | `fix_list_admin_users_email_return_type` | `Recovered` |
| `20261112092626` | `allow_public_read_of_storefront_currency_settings` | `Recovered` |
| `20261112092831` | `consolidate_public_storefront_settings_read_policies` | `Recovered` |
| `20261113072134` | `add_product_multi_category_tags` | `Recovered` |
| `20261118085704` | `order_deadlines_business_calendar` | `Recovered` |
| `20261118085724` | `schedule_order_deadline_notifications` | `Recovered` |
| `20261118090128` | `branding_storage_and_public_read` | `Recovered` |
| `20261118090159` | `safe_inventory_reservation_read_rpc` | `Recovered` |
| `20261118090638` | `separate_order_cancellation_and_stock_release` | `Recovered` |
| `20261118090759` | `enforce_separate_cancel_permissions` | `Recovered` |
| `20261118090947` | `record_deadline_reminder_history` | `Recovered` |
| `20261118091026` | `secure_customer_directory_rpc` | `Recovered` |
| `20261118091202` | `hold_deadline_notifications_pending_channel_choice` | `Recovered` |
| `20261118091248` | `assign_deadline_extension_to_admin` | `Recovered` |
| `20261118092725` | `independent_currency_pricing_foundation` | `Recovered` |
| `20261118092815` | `currency_aware_shipping_and_checkout_rpc` | `Recovered` |
| `20261119025538` | `manual_myr_exchange_rates_and_price_sync` | `Recovered` |
| `20261119025737` | `snapshot_currency_precision_on_orders` | `Recovered` |
| `20261119025809` | `refresh_fx_prices_on_currency_settings_change` | `Recovered` |
| `20261119030907` | `grant_currency_catalog_table_privileges` | `Recovered` |
| `20261119043746` | `allow_public_read_product_card_design` | `Recovered` |
| `20261119084927` | `allow_public_homepage_section_content_read` | `Recovered` |
| `20261120065419` | `custom_shipping_management` | `Recovered` |
| `20261120065611` | `restrict_shipping_rate_trigger_function` | `Recovered` |
| `20261120071007` | `fix_shipping_management_rls` | `Recovered` |
| `20261124020020` | `prevent_payment_review_on_cancelled_orders` | `Recovered` |
| `20261124020329` | `add_audited_order_refund_management` | `Recovered` |
| `20261124031949` | `add_admin_favicon_setting_read_access` | `Recovered` |
| `20261124064202` | `add_private_refund_evidence_attachments` | `Recovered` |
| `20261124065611` | `add_individual_admin_permission_overrides_and_remove_unused_role` | `Recovered` |
| `20261124065724` | `harden_admin_permission_rpc_wrappers` | `Recovered` |
