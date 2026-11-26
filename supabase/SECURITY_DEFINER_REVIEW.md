# SECURITY DEFINER Function Review — Admin and Owner Controls

Date: 2026-11-26
Project: `jhjebhpzzjbtsmflwnzf` (read-only review)
Branch: `fix/storefront-render-admin-features-favicon`

## Scope and safety

Reviewed the live definitions and ACLs of the sensitive owner/admin/permission-related `SECURITY DEFINER` functions in Production using read-only catalog queries. No data or schema changes were made. This is a targeted review, not yet a complete line-by-line review of all 64 functions.

## Positive controls observed

- All 64 `SECURITY DEFINER` functions catalogued in the prior pass have a function-level `search_path` setting.
- `app_private.bootstrap_first_owner(text)` is executable only by `service_role` and postgres; it checks that no owner exists and requires a confirmed Auth user. The singleton owner record also provides a database uniqueness boundary.
- `app_private.verify_owner_recovery_secret(text)`, `public.owner_recovery_verify_secret(text)`, and `public.owner_recovery_log_password_reset(uuid)` are executable only by `service_role` and postgres.
- Owner recovery secret verification uses a password hash comparison, locks after five failed attempts for 30 minutes, and records success/failure events.
- Administrative RPCs reviewed (including `set_admin_access`, `set_admin_access_by_email`, `set_admin_role`, `set_role_permission`, `set_admin_user_permission`, and `list_admin_user_permissions`) check the relevant permission before changing or returning privileged data.
- Individual permission editing blocks self-edit and protects the owner identity/Owner role.
- Ordinary admin-management functions explicitly prevent granting the Owner role through routine admin management. Owner-role operations are restricted to the current owner.
- `public.list_admin_users()` requires `admins.manage` and excludes the Owner identity from non-owner results.
- Sensitive order/payment RPCs inspected check permissions before modifying records, lock target rows, validate state transitions, and write audit/history records.

## Items requiring follow-up

### 1. app_private helper RPC exposure

The functions `app_private.is_owner()`, `app_private.is_admin_user()`, and `app_private.has_permission(text)` have EXECUTE grants to anon/authenticated. The prior schema ACL inspection also found USAGE on `app_private` for anon/authenticated.

These helpers return identity/permission booleans rather than exposing table rows directly, and `has_permission` uses the current `auth.uid()`. No privilege escalation was established from the definitions reviewed. However, the actual PostgREST exposed-schema list was not confirmed (the earlier `current_setting('pgrst.db_schemas', true)` check returned NULL). Confirm whether `app_private` is exposed through the Data API before deciding whether these grants should be narrowed. Do not revoke grants blindly because RLS policies and internal calls depend on these helpers.

### 2. Owner self-deactivation

`public.set_admin_access` prevents non-owners from managing the Owner identity and blocks assigning the Owner role through this routine. The current Owner can still call it against their own account and set `p_active=false`. This may be intentional owner self-lockout capability, but it is a recovery/availability risk worth confirming against the intended owner-account policy.

### 3. Full function review incomplete

This pass sampled sensitive owner/admin and payment/order functions. The remaining SECURITY DEFINER functions (especially inventory, shipping, cancellation, refund, notification, and currency functions) still require full body review for actor authorization, object ownership, concurrency, dynamic SQL, and data exposure.

## Current conclusion

No confirmed privilege-escalation vulnerability was established in the sampled admin/owner functions. The main unresolved concerns are Data API exposure of `app_private`, owner self-deactivation behavior, and completion of the remaining function-body review.

## Safety boundary

All checks in this review were read-only. Do not apply grants/revokes, change owner status, run migrations, or deploy changes to Production based on this report alone. Any remediation must first be reviewed against RLS policies and application dependencies and must remain outside Production until explicitly approved.


## Follow-up review — inventory, shipping, cancellation, refund, notifications, currency

Date: 2026-11-26 (same read-only Production session)

### Functions and controls inspected

Reviewed definitions and/or execute ACLs for:
- Inventory: `adjust_inventory`, `list_inventory_reservations`, `release_reservation`
- Cancellation and order state: `request_order_cancellation`, `review_order_cancellation`, `execute_order_cancellation`, `confirm_order_received`, `admin_complete_order`
- Shipping: `quote_shipping_currency`, `request_shipping_address_change`, `review_shipping_address_change`
- Refund: `create_order_refund`, `update_order_refund_status`
- Notifications: `process_order_deadline_notifications`, `mark_admin_notification_read`
- Related currency and shipping-price trigger functions

### Positive controls observed

- Customer cancellation and shipping-address-change requests constrain the target order by both order ID and `auth.uid()`; customers cannot submit requests against another user's order.
- Customer receipt confirmation similarly requires the order to belong to the caller and to be in the `shipped` state.
- Admin cancellation review, cancellation execution, inventory adjustment/release, refund creation/status changes, and shipping-address review check the relevant permission before privileged writes.
- Cancellation review locks the request and order and accepts only approved/rejected decisions. Execution requires an approved request, locks the request/order, validates the current order state, and records order history and an admin audit entry.
- Inventory release requires an already-cancelled order and an executed cancellation request. It locks the reservation/order, verifies the reserved quantity can be decremented, marks the reservation released, and records an inventory movement plus audit log. Repeated release calls return an already-released result.
- Inventory adjustment locks the product or variant row, prevents stock going negative or below reserved quantity, enforces the single-item stock ceiling, and records an event key and audit log.
- Refund creation requires `refunds.manage`, a cancelled order with verified payment, a positive amount matching currency decimal precision, and checks pending/processing/completed refunds against the order's remaining refundable balance while holding the order row lock. Refund status transitions are constrained and completion requires an external transfer reference.
- `process_order_deadline_notifications()` is executable by `service_role`, not anon/authenticated. The scheduled function marks deadlines overdue and creates idempotent notifications; its body explicitly does not automatically cancel orders or release stock.
- The older `submit_order` RPC is not executable by anon or authenticated. The confirmed order-submission RPCs are executable by authenticated users and validate caller identity, cart ownership, stock, quote totals, currency, and payment-proof storage path/metadata.
- Reviewed trigger functions use fixed function-level search paths; trigger-only functions are not directly executable by anon/authenticated.

### Finding — shipping address payload validation is too permissive

Severity: **Medium (input validation / operational integrity; not an authorization bypass)**

`request_shipping_address_change` checks that `jsonb_typeof(p_address) <> 'object'`, but it does not reject an empty JSON object (`{}`) or validate required address fields. The destination column is NOT NULL, but the live schema has no CHECK constraint requiring a non-empty object or required keys. A customer can therefore submit an empty object as the requested address; if an administrator approves it, `review_shipping_address_change` copies that object into the order's `shipping_address`.

The NULL case is rejected downstream by the NOT NULL column constraint, so this is not a NULL-injection bypass. The concrete issue is that an empty/incomplete object can pass the RPC and later replace a valid delivery address.

Recommended remediation (not applied): define the canonical address JSON contract used by checkout, validate its required keys and non-empty values in this RPC, and add a matching database CHECK constraint where compatible with existing rows. Add tests for NULL, `{}`, missing country/postcode/address lines, and valid payloads. Review existing customer address formats before enforcing the constraint.

### Remaining scope / limitations

- This was a targeted review of relevant functions, not a full review of every SECURITY DEFINER function body.
- Currency price synchronization and currency-catalog trigger functions were inspected for fixed search paths and trigger-oriented behavior; their full end-to-end trigger dependency chain and data invariants still need a separate pass.
- No live checkout, cancellation, refund, or inventory mutation was executed as a test. Production remained read-only.

### Updated conclusion

No direct privilege escalation was confirmed in the functions inspected in this follow-up. One concrete medium-severity validation weakness was found in customer shipping-address change requests: empty/incomplete address objects can be approved and overwrite a valid order address. The `app_private` exposure and Owner self-deactivation questions from the first pass remain open.

All findings are observations from read-only Production inspection. No Production data, schema, grants, or deployment state was changed.


## Follow-up review — app_private exposure, Owner active flag, currency synchronization

Date: 2026-11-26 (read-only Production catalog review)

### app_private Data API exposure

- Production database grants show USAGE on `app_private` for both `anon` and `authenticated`; its helper functions `is_owner()`, `is_admin_user()`, and `has_permission(text)` also have EXECUTE for both roles.
- The checked-in `supabase/config.toml` currently lists only `public` and `graphql_public` under `[api].schemas`; it does not list `app_private`.
- However, the live database session returns NULL for `current_setting('pgrst.db_schemas', true)`, and the available project metadata API does not expose the live PostgREST schema setting. Therefore the production Data API exposure state remains **unconfirmed**. A repository config file is not proof of the currently applied hosted setting.
- The helper functions reviewed only evaluate the current caller's own identity/permission state using `auth.uid()`; no cross-user data retrieval or privilege escalation was found in their bodies. If `app_private` is exposed, authenticated callers could directly probe their own role/permission booleans. This is unnecessary API surface and should be kept unexposed unless there is a deliberate documented need.
- Recommended follow-up: verify the hosted Data API exposed-schema setting in the Supabase Dashboard (Integrations → Data API) or an authoritative Management API setting before changing grants. Do not revoke grants blindly because policies and internal database code depend on these functions.

### Owner self-deactivation — refined conclusion

- `app_private.is_owner()` checks the singleton `app_private.owner_principal` record and does not depend on `public.admin_users.is_active`.
- `app_private.has_permission(text)` returns true immediately for the Owner identity, before checking the normal active-admin permission mapping.
- Therefore setting the Owner's `admin_users.is_active=false` through `set_admin_access` does **not** remove the Owner's database-level `is_owner()` identity or permission bypass. This is not a confirmed database privilege lockout.
- `list_admin_users()` filters the Owner result to `au.is_active=true`, so a self-deactivated Owner may disappear from that particular list. Frontend admin-route behavior was not verified in this SQL-only pass. Treat this as an operational/UI consistency question, not a confirmed security vulnerability.

### Currency and shipping-price trigger review

- Production currently has active MYR, CNY, SGD, and USD currencies; all four corresponding exchange-rate rows are configured and have positive rates. The database CHECK constraint enforces MYR=1 and requires non-MYR rates to be positive when configured, or NULL when not configured.
- The order exchange-rate snapshot trigger rejects checkout if a non-MYR currency has no configured active exchange rate.
- The currency-price synchronization trigger deletes non-MYR product, variant, and shipping price rows when an exchange rate is removed/unconfigured; it rebuilds rows only for configured exchange rates and active currencies.
- **Low-severity consistency issue in `public.sync_shipping_rate_currency_prices()`:** when a shipping-rate row is inserted or its MYR fee fields are updated, the trigger loops over every active currency and uses `coalesce(er.rate,1)`. If a non-MYR currency is active but its exchange rate is not configured (or the exchange-rate row is absent), it will still create/update that shipping currency price using a multiplier of 1. This conflicts with the configured-rate-only behavior of the other synchronization trigger and can leave misleading shipping-price rows. In the current Production snapshot all four active currencies have configured rates, so this condition is **not currently observed in live rows**.
- Recommended remediation (not applied): make the shipping-rate trigger generate non-MYR rows only when an active currency has a configured positive exchange rate; otherwise delete/skip that currency's row. Add regression tests for active-but-unconfigured currencies, toggling a rate off/on, and inserting/updating shipping rates. Verify all dependent checkout quote paths before release.

### Current scope conclusion

- No confirmed privilege escalation was found in the app_private helper bodies or Owner active-flag behavior reviewed here.
- Two code-level improvements are recommended: explicitly keep `app_private` out of the hosted Data API schema list (after confirming the live setting), and correct the shipping-rate currency trigger's fallback-to-1 behavior.
- The shipping-address JSON validation weakness recorded above remains the concrete medium-severity finding.
- No Production grants, schema, data, or deployment state were changed.

## Follow-up review — private-table ACLs, customer data policies, and Storage evidence access

Date: 2026-11-26 (read-only Production catalog review)

### app_private RLS Advisor warning — verified ACL context

Supabase's table-list/advisor response flags all four app_private tables as having RLS disabled:
- owner_principal
- owner_recovery_credentials
- owner_recovery_audit_logs
- sku_registry

A direct read-only catalog check confirmed relrowsecurity=false and relforcerowsecurity=false for all four. The same check confirmed:
- anon and authenticated both have USAGE on the app_private schema.
- Neither anon nor authenticated has table-level SELECT, INSERT, UPDATE, or DELETE privileges on any of these four tables.
- No RLS policies currently exist on these four tables.

Risk interpretation: the Advisor warning is valid as a defense-in-depth/configuration warning, but the direct table ACLs currently block ordinary anon/authenticated table access. Therefore this review did not establish that these rows are presently readable or writable through PostgREST. Actual hosted Data API exposure of app_private also remains unconfirmed. The tables are accessed internally by SECURITY DEFINER functions and triggers; those call paths need to retain their intended behavior if RLS is later enabled.

Recommended remediation (not applied): first verify the hosted Data API schema list; keep app_private unexposed; then plan RLS enablement with narrowly scoped policies or no client policies if all access is intended to remain through vetted privileged functions. Test owner bootstrap/recovery, permission helpers, and SKU registry triggers in an isolated environment before any production change. Do not apply the Advisor SQL blindly.

### Finding — refund-evidence Storage policy allows deletion to view-only admins

Severity: Medium (evidence integrity / authorization scope)

The live storage.objects policy named admins_manage_refund_evidence is a permissive FOR ALL policy for authenticated users on bucket refund-evidence. Its USING expression permits either refunds.view or refunds.manage, while its WITH CHECK expression requires refunds.manage.

For PostgreSQL RLS command semantics, the USING expression controls which existing rows can be targeted by DELETE. Since DELETE does not use WITH CHECK, a user who has refunds.view but lacks refunds.manage can satisfy this policy's DELETE condition and may delete refund-evidence objects. The stricter WITH CHECK does not protect DELETE.

Recommended remediation (not applied): replace the broad FOR ALL policy with separate policies:
- SELECT: refunds.view OR refunds.manage
- INSERT: refunds.manage
- UPDATE: refunds.manage in both USING and WITH CHECK
- DELETE: refunds.manage in USING

Also review Storage object deletion paths and test with a refunds.view-only admin account in an isolated environment. No Storage objects or policies were changed during this review.

### Customer/profile/address and payment-proof policy observations

- profiles: authenticated users can read their own profile; users with customers.view can read customer profiles. Updates are constrained to the caller's own profile by both USING and WITH CHECK.
- customer_addresses: authenticated users can read their own addresses; customers.view admins can read customer addresses. Insert, update, and delete are constrained to the caller's own user_id; update has both USING and WITH CHECK.
- payment_proofs: the row-level SELECT policy permits the owning customer or an admin with payments.review. The associated private Storage bucket policy permits customers to read only objects whose first path segment equals their own Auth UID, or admins with payments.review; customer uploads are similarly constrained to their own UID path.
- order_refund_attachments: row SELECT is limited to refunds.view or refunds.manage; INSERT requires refunds.manage and created_by=auth.uid(). No direct DELETE policy was returned for this table.
- Product and product-image policies inspected restrict public reads to published/non-archived products and their images; writes require the corresponding product create/edit permission.
- Public Storage read policies apply only to homepage-media and product-images. The private evidence buckets do not have a public-read policy in the inspected policy set.

These observations are policy-definition reviews, not end-to-end API or file-download tests.

### Updated conclusion

- The four private tables have RLS disabled, but direct anon/authenticated table privileges are absent; direct client table exposure was not established. The Advisor warning should be remediated deliberately as defense in depth, not by blindly enabling RLS.
- A concrete Medium-severity Storage authorization issue was identified: refunds.view alone appears sufficient to DELETE objects from refund-evidence because a FOR ALL policy combines a broad USING expression with a narrower WITH CHECK.
- The previously recorded Medium-severity shipping-address payload validation issue and Low-severity shipping-currency fallback issue remain open.
- Production remained read-only: no schema, grants, policies, rows, Storage objects, or deployment state were changed.
Additional role-model verification for the refund-evidence finding:
- The built-in Admin and Owner roles currently both include refunds.view and refunds.manage.
- The live admin_user_permission_overrides table currently has no explicit deny override for either permission (and was observed empty in the table inventory). Thus no current view-only admin account was identified from the present role/override snapshot.
- The permission model does support per-user permission overrides, including revoking refunds.manage while retaining refunds.view. The Storage policy therefore becomes exploitable if such a view-only account is configured in future; the policy is not least-privilege safe even though the current default roles bundle both permissions.
- refund-evidence is a private bucket with a 5 MiB limit and JPEG/PNG/WebP allowlist; public=false.
## Remediation drafted on development branch — not applied to Production

Date: 2026-11-26

Migration added: `supabase/migrations/20261126090000_security_hardening_followup.sql`.

The migration is committed on `fix/storefront-render-admin-features-favicon` only. It contains:
- Enable RLS (without FORCE and without client policies) on `app_private.owner_principal`, `owner_recovery_credentials`, `owner_recovery_audit_logs`, and `sku_registry`. Live catalog review confirmed these tables are owned by postgres and the internal functions/triggers that access them are SECURITY DEFINER functions owned by postgres. Existing anon/authenticated table grants remain unchanged and absent.
- Replace the refund-evidence FOR ALL policy with separate SELECT, INSERT, UPDATE, and DELETE policies. SELECT permits refunds.view or refunds.manage; all writes, including DELETE, require refunds.manage.
- Strengthen `request_shipping_address_change` to reject NULL/non-object payloads and require nonblank `address_line_1`, `city`, and `country_code`.
- Add matching CHECK constraints to orders.shipping_address and both original/requested shipping-address JSON columns in order_shipping_change_requests.
- Update `sync_shipping_rate_currency_prices()` so active non-MYR currencies without a configured positive exchange rate do not get a synthetic 1:1 price; any stale row for that currency/rate is deleted.

Pre-migration read-only data checks found zero invalid existing order shipping addresses and zero invalid original/requested addresses in shipping-change requests. The canonical required fields were aligned with the existing customer_addresses schema and observed order JSON keys.

Initial static verification: the migration file was committed and fetched back from GitHub; it includes the four separate Storage policy commands, RLS enablement, required address validation, and no `coalesce(er.rate,1)` fallback. The subsequent online isolated replay and transaction-level checks are documented below. Production was not modified.

Release safety: do not merge/deploy or apply this migration to Production until the isolated migration test and permission-specific tests pass and the user explicitly approves Production release.

## Online isolated validation — 2026-11-26

A free Supabase test project, `website-security-test` (`xsvodzqyxyycbvwdwjru`), was created in Singapore at US$0/month. It contains no copied Production Auth users, customer records, or Storage objects. All writes described here occurred only in that test project.

### Migration execution

- The 52 recovered historical migrations and 7 forward-only migrations completed successfully.
- Two test-only environment prerequisites were installed separately: the owner-only `private` schema and the Production `public.rls_auto_enable()` function / `ensure_rls` event trigger.
- The first replay attempt stopped at migration 2 because `public.rls_auto_enable()` was missing from the fresh project. After installing the environment prerequisite in the test project, migration 2 and the remaining sequence succeeded.
- Production was not used as a migration target.

### Catalog parity

- Both projects have 48 public application tables, all with RLS enabled.
- Public columns (455), indexes (132), triggers (93), and the 229 historical constraints match.
- The test project has three additional CHECK constraints for shipping-address JSON validation.
- All 72 function signatures match; all 64 SECURITY DEFINER functions in both projects have a fixed function-level `search_path`.
- Function ACLs, public table ACLs, and public-schema default ACLs match after reconciliation.
- All non-refund RLS/Storage policy definitions match. The test project intentionally replaces the single Production refund-evidence FOR ALL policy with four command-specific policies.
- All four Storage bucket configurations and the order-deadline cron job match Production.
- RLS is enabled on the four app_private tables in the test project as defense in depth; Production remains unchanged and still has RLS disabled on those four tables. Direct anon/authenticated table SELECT grants are absent in both projects.

### Permission-specific tests

All fixtures were created and rolled back inside transactions in the isolated test project.

1. A test Admin with `refunds.view` and an explicit deny for `refunds.manage` could read refund-evidence objects, but could not delete or upload them.
2. A test Admin with `refunds.manage` could delete and upload refund-evidence objects.
3. The Storage delete-protection trigger was temporarily disabled only inside the test transaction to isolate RLS policy behavior. The test did not call the Storage HTTP API, and no Storage object persisted.
4. `request_shipping_address_change()` rejected incomplete address JSON and accepted a complete address.
5. The CHECK constraint rejected an invalid order shipping-address update.
6. Shipping currency sync created only the MYR row when CNY/SGD/USD had no configured positive FX rate; a deliberately inserted stale CNY row was deleted on the next sync, while the MYR amount updated correctly. All fixture rows were rolled back.

### Remaining limitations

- These are isolated database-level tests, not a complete browser/API integration test of the customer and admin applications.
- The hosted Production Data API exposed-schema setting remains unconfirmed; repository configuration is not proof of the live dashboard setting.
- The legacy `public.submit_order()` body differs from Production but is restricted to postgres only in both projects; clients cannot execute it. The two active hardening changes to `request_shipping_address_change()` and `sync_shipping_rate_currency_prices()` intentionally differ from Production until a separately approved release.
- The line-by-line review of all 64 SECURITY DEFINER bodies is still incomplete.

### Release safety

The new migrations and test results are committed on the development branch only. Production remains read-only. Do not merge, deploy, apply migrations, or alter Production until the remaining application/API checks are complete and the user explicitly approves the Production release.
