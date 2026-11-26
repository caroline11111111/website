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
