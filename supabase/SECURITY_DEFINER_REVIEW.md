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
