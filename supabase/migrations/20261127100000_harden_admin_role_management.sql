-- Harden administrator access and role management.
-- Owner self-deactivation is blocked; the Owner identity is never managed by
-- the routine non-Owner access function.
-- The single-role Admin UI replaces prior non-Owner roles and removes
-- stale individual Allow overrides while preserving explicit Deny overrides.

CREATE OR REPLACE FUNCTION public.set_admin_access(
  p_target_user_id uuid,
  p_active boolean,
  p_role_name text DEFAULT 'Admin'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_admin_id uuid;
  v_role public.roles%rowtype;
  v_owner_user uuid;
  v_replaced_roles jsonb := '[]'::jsonb;
  v_removed_allow_overrides integer := 0;
BEGIN
  IF v_actor IS NULL OR NOT app_private.has_permission('admins.manage') THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  IF p_target_user_id = v_actor AND NOT p_active THEN
    RAISE EXCEPTION 'You cannot deactivate your own administrator account';
  END IF;

  SELECT user_id INTO v_owner_user
  FROM app_private.owner_principal
  WHERE singleton = true;

  IF p_target_user_id = v_owner_user THEN
    RAISE EXCEPTION 'The Owner account cannot be managed through routine administrator access';
  END IF;

  SELECT id INTO v_admin_id
  FROM public.admin_users
  WHERE user_id = p_target_user_id
  FOR UPDATE;

  IF v_admin_id IS NULL THEN
    INSERT INTO public.admin_users(user_id, is_active)
    VALUES (p_target_user_id, p_active)
    RETURNING id INTO v_admin_id;
  ELSE
    UPDATE public.admin_users
    SET is_active = p_active, updated_at = now()
    WHERE id = v_admin_id;
  END IF;

  IF p_active THEN
    SELECT * INTO v_role
    FROM public.roles
    WHERE name = p_role_name;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Role does not exist';
    END IF;

    IF v_role.name = 'Owner' THEN
      RAISE EXCEPTION 'Owner role assignment is protected';
    END IF;

    SELECT COALESCE(jsonb_agg(r.name ORDER BY r.name), '[]'::jsonb)
    INTO v_replaced_roles
    FROM public.admin_user_roles aur
    JOIN public.roles r ON r.id = aur.role_id
    WHERE aur.admin_user_id = v_admin_id
      AND r.name <> 'Owner'
      AND aur.role_id <> v_role.id;

    DELETE FROM public.admin_user_roles aur
    USING public.roles r
    WHERE aur.admin_user_id = v_admin_id
      AND r.id = aur.role_id
      AND r.name <> 'Owner'
      AND aur.role_id <> v_role.id;

    -- Remove only positive individual overrides so an old role's explicit
    -- Allow cannot survive a downgrade. Explicit Deny overrides are retained.
    DELETE FROM public.admin_user_permission_overrides
    WHERE admin_user_id = v_admin_id
      AND granted = true;
    GET DIAGNOSTICS v_removed_allow_overrides = ROW_COUNT;

    INSERT INTO public.admin_user_roles(admin_user_id, role_id, assigned_by)
    VALUES (v_admin_id, v_role.id, v_actor)
    ON CONFLICT DO NOTHING;
  END IF;

  INSERT INTO public.admin_audit_logs(
    admin_user_id, actor_user_id, action, target_type, target_id, new_values
  )
  SELECT
    au.id,
    v_actor,
    'admin.access.set',
    'admin_user',
    v_admin_id,
    jsonb_build_object(
      'is_active', p_active,
      'role', CASE WHEN p_active THEN p_role_name ELSE NULL END,
      'replaced_roles', v_replaced_roles,
      'removed_allow_overrides', v_removed_allow_overrides
    )
  FROM public.admin_users au
  WHERE au.user_id = v_actor;

  RETURN v_admin_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_role_permission(
  p_role_id uuid,
  p_permission_code text,
  p_grant boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_role public.roles%rowtype;
  v_permission public.permissions%rowtype;
  v_owner_only_permissions constant text[] := ARRAY[
    'admins.manage',
    'roles.manage',
    'settings.manage',
    'refunds.manage',
    'refunds.view',
    'customers.manage',
    'customers.view',
    'audit_logs.view',
    'orders.cancel.approve',
    'orders.cancel.execute'
  ];
BEGIN
  IF v_actor IS NULL OR NOT app_private.has_permission('roles.manage') THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  SELECT * INTO v_role
  FROM public.roles
  WHERE id = p_role_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Role not found';
  END IF;

  IF v_role.name = 'Owner' AND NOT app_private.is_owner() THEN
    RAISE EXCEPTION 'Only Owner can manage the Owner role';
  END IF;

  SELECT * INTO v_permission
  FROM public.permissions
  WHERE code = p_permission_code;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Permission code is not registered';
  END IF;

  IF p_permission_code = ANY(v_owner_only_permissions)
     AND NOT app_private.is_owner() THEN
    RAISE EXCEPTION 'Only Owner can grant or revoke this privileged permission';
  END IF;

  IF p_grant THEN
    INSERT INTO public.role_permissions(role_id, permission_id, assigned_by)
    VALUES (p_role_id, v_permission.id, v_actor)
    ON CONFLICT DO NOTHING;
  ELSE
    DELETE FROM public.role_permissions
    WHERE role_id = p_role_id
      AND permission_id = v_permission.id;
  END IF;

  INSERT INTO public.admin_audit_logs(
    admin_user_id, actor_user_id, action, target_type, target_id, new_values
  )
  SELECT
    au.id,
    v_actor,
    CASE WHEN p_grant THEN 'role.permission.grant' ELSE 'role.permission.revoke' END,
    'role',
    p_role_id,
    jsonb_build_object('permission', p_permission_code)
  FROM public.admin_users au
  WHERE au.user_id = v_actor;
END;
$function$;
