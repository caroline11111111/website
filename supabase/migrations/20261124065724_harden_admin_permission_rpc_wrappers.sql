
CREATE OR REPLACE FUNCTION app_private.list_admin_user_permissions(p_target_user_id uuid)
RETURNS TABLE (
  permission_code text,
  role_default boolean,
  override_granted boolean,
  effective_granted boolean,
  permission_source text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_target_admin_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT app_private.has_permission('admins.manage') THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;
  IF p_target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'You cannot edit your own permissions';
  END IF;
  IF EXISTS (
    SELECT 1 FROM app_private.owner_principal op
    WHERE op.singleton = true AND op.user_id = p_target_user_id
  ) OR EXISTS (
    SELECT 1 FROM public.admin_user_roles aur
    JOIN public.roles r ON r.id = aur.role_id
    JOIN public.admin_users au ON au.id = aur.admin_user_id
    WHERE au.user_id = p_target_user_id AND r.name = 'Owner'
  ) THEN
    RAISE EXCEPTION 'Owner permissions are protected';
  END IF;
  SELECT au.id INTO v_target_admin_id
  FROM public.admin_users au WHERE au.user_id = p_target_user_id;
  IF v_target_admin_id IS NULL THEN RAISE EXCEPTION 'Admin account not found'; END IF;

  RETURN QUERY
  SELECT p.code,
    COALESCE(rd.role_default, false),
    o.granted,
    COALESCE(o.granted, COALESCE(rd.role_default, false)),
    CASE WHEN o.id IS NOT NULL THEN 'Individual Override' ELSE 'Role Default' END
  FROM public.permissions p
  LEFT JOIN LATERAL (
    SELECT true AS role_default
    FROM public.admin_user_roles aur
    JOIN public.role_permissions rp ON rp.role_id = aur.role_id
    WHERE aur.admin_user_id = v_target_admin_id AND rp.permission_id = p.id
    LIMIT 1
  ) rd ON true
  LEFT JOIN public.admin_user_permission_overrides o
    ON o.admin_user_id = v_target_admin_id AND o.permission_id = p.id
  ORDER BY p.code;
END;
$function$;

CREATE OR REPLACE FUNCTION app_private.set_admin_user_permission(
  p_target_user_id uuid, p_permission_code text, p_override boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_admin_id uuid;
  v_permission_id uuid;
  v_role_default boolean := false;
  v_old_override boolean;
BEGIN
  IF v_actor IS NULL OR NOT app_private.has_permission('admins.manage') THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;
  IF p_target_user_id = v_actor THEN RAISE EXCEPTION 'You cannot edit your own permissions'; END IF;
  IF EXISTS (
    SELECT 1 FROM app_private.owner_principal op
    WHERE op.singleton = true AND op.user_id = p_target_user_id
  ) OR EXISTS (
    SELECT 1 FROM public.admin_user_roles aur
    JOIN public.roles r ON r.id = aur.role_id
    JOIN public.admin_users au ON au.id = aur.admin_user_id
    WHERE au.user_id = p_target_user_id AND r.name = 'Owner'
  ) THEN
    RAISE EXCEPTION 'Owner permissions are protected';
  END IF;

  SELECT au.id INTO v_admin_id FROM public.admin_users au
  WHERE au.user_id = p_target_user_id FOR UPDATE;
  IF v_admin_id IS NULL THEN RAISE EXCEPTION 'Admin account not found'; END IF;

  SELECT p.id INTO v_permission_id FROM public.permissions p WHERE p.code = p_permission_code;
  IF v_permission_id IS NULL THEN RAISE EXCEPTION 'Permission code is not registered'; END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.admin_user_roles aur
    JOIN public.role_permissions rp ON rp.role_id = aur.role_id
    WHERE aur.admin_user_id = v_admin_id AND rp.permission_id = v_permission_id
  ) INTO v_role_default;

  SELECT o.granted INTO v_old_override FROM public.admin_user_permission_overrides o
  WHERE o.admin_user_id = v_admin_id AND o.permission_id = v_permission_id;

  IF p_override IS NULL OR p_override = v_role_default THEN
    DELETE FROM public.admin_user_permission_overrides
    WHERE admin_user_id = v_admin_id AND permission_id = v_permission_id;
  ELSE
    INSERT INTO public.admin_user_permission_overrides
      (admin_user_id, permission_id, granted, changed_by)
    VALUES (v_admin_id, v_permission_id, p_override, v_actor)
    ON CONFLICT (admin_user_id, permission_id)
    DO UPDATE SET granted = EXCLUDED.granted, changed_by = EXCLUDED.changed_by, updated_at = now();
  END IF;

  INSERT INTO public.admin_audit_logs
    (admin_user_id, actor_user_id, action, target_type, target_id, old_values, new_values, reason)
  SELECT actor.id, v_actor, 'admin.permission.override', 'admin_user', v_admin_id,
    jsonb_build_object('permission', p_permission_code, 'override', v_old_override),
    jsonb_build_object('permission', p_permission_code, 'override', p_override, 'role_default', v_role_default),
    'Individual admin permission override changed'
  FROM public.admin_users actor WHERE actor.user_id = v_actor;
END;
$function$;

REVOKE ALL ON FUNCTION app_private.list_admin_user_permissions(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION app_private.set_admin_user_permission(uuid, text, boolean) FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA app_private TO authenticated;
GRANT EXECUTE ON FUNCTION app_private.list_admin_user_permissions(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION app_private.set_admin_user_permission(uuid, text, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.list_admin_user_permissions(p_target_user_id uuid)
RETURNS TABLE (
  permission_code text,
  role_default boolean,
  override_granted boolean,
  effective_granted boolean,
  permission_source text
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO ''
AS $function$
  SELECT * FROM app_private.list_admin_user_permissions(p_target_user_id)
$function$;

CREATE OR REPLACE FUNCTION public.set_admin_user_permission(
  p_target_user_id uuid, p_permission_code text, p_override boolean
)
RETURNS void
LANGUAGE sql
SECURITY INVOKER
SET search_path TO ''
AS $function$
  SELECT app_private.set_admin_user_permission(p_target_user_id, p_permission_code, p_override)
$function$;

REVOKE ALL ON FUNCTION public.list_admin_user_permissions(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_admin_user_permission(uuid, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_admin_user_permissions(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_admin_user_permission(uuid, text, boolean) TO authenticated;
