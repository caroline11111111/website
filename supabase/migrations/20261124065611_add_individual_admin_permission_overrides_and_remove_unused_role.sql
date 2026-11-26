
-- Remove the unused placeholder role only when it has no assignments or permission links.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.roles WHERE name = '01') THEN
    IF EXISTS (
      SELECT 1 FROM public.admin_user_roles aur
      JOIN public.roles r ON r.id = aur.role_id
      WHERE r.name = '01'
    ) OR EXISTS (
      SELECT 1 FROM public.role_permissions rp
      JOIN public.roles r ON r.id = rp.role_id
      WHERE r.name = '01'
    ) THEN
      RAISE EXCEPTION 'Role 01 is still referenced and cannot be safely deleted';
    END IF;
    DELETE FROM public.roles WHERE name = '01';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.admin_user_permission_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid NOT NULL REFERENCES public.admin_users(id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  granted boolean NOT NULL,
  changed_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT admin_user_permission_overrides_unique UNIQUE (admin_user_id, permission_id)
);

ALTER TABLE public.admin_user_permission_overrides ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_user_permission_overrides FROM anon, authenticated;
GRANT SELECT ON public.admin_user_permission_overrides TO authenticated;

DROP POLICY IF EXISTS "Admins can view individual permission overrides" ON public.admin_user_permission_overrides;
CREATE POLICY "Admins can view individual permission overrides"
ON public.admin_user_permission_overrides
FOR SELECT TO authenticated
USING (app_private.has_permission('admins.manage'));

CREATE OR REPLACE FUNCTION app_private.has_permission(p_code text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT app_private.is_owner()
    OR EXISTS (
      SELECT 1
      FROM public.admin_users au
      WHERE au.user_id = (SELECT auth.uid())
        AND au.is_active
        AND (
          EXISTS (
            SELECT 1
            FROM public.admin_user_permission_overrides o
            JOIN public.permissions p ON p.id = o.permission_id
            WHERE o.admin_user_id = au.id
              AND p.code = p_code
              AND o.granted = true
          )
          OR (
            NOT EXISTS (
              SELECT 1
              FROM public.admin_user_permission_overrides o
              JOIN public.permissions p ON p.id = o.permission_id
              WHERE o.admin_user_id = au.id
                AND p.code = p_code
            )
            AND EXISTS (
              SELECT 1
              FROM public.admin_user_roles aur
              JOIN public.role_permissions rp ON rp.role_id = aur.role_id
              JOIN public.permissions p ON p.id = rp.permission_id
              WHERE aur.admin_user_id = au.id
                AND p.code = p_code
            )
          )
        )
    )
$function$;

CREATE OR REPLACE FUNCTION public.get_my_admin_access()
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path TO ''
AS $function$
  SELECT jsonb_build_object(
    'is_admin', app_private.is_admin_user(),
    'is_owner', app_private.is_owner(),
    'permissions', COALESCE((
      SELECT jsonb_agg(p.code ORDER BY p.code)
      FROM public.permissions p
      WHERE app_private.has_permission(p.code)
        AND app_private.is_admin_user()
    ), '[]'::jsonb)
  )
$function$;

CREATE OR REPLACE FUNCTION public.list_admin_user_permissions(p_target_user_id uuid)
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
    SELECT 1
    FROM public.admin_user_roles aur
    JOIN public.roles r ON r.id = aur.role_id
    JOIN public.admin_users au ON au.id = aur.admin_user_id
    WHERE au.user_id = p_target_user_id AND r.name = 'Owner'
  ) THEN
    RAISE EXCEPTION 'Owner permissions are protected';
  END IF;

  SELECT au.id INTO v_target_admin_id
  FROM public.admin_users au
  WHERE au.user_id = p_target_user_id;

  IF v_target_admin_id IS NULL THEN
    RAISE EXCEPTION 'Admin account not found';
  END IF;

  RETURN QUERY
  SELECT
    p.code,
    COALESCE(rd.role_default, false),
    o.granted,
    COALESCE(o.granted, COALESCE(rd.role_default, false)),
    CASE
      WHEN o.id IS NOT NULL THEN 'Individual Override'
      ELSE 'Role Default'
    END
  FROM public.permissions p
  LEFT JOIN LATERAL (
    SELECT true AS role_default
    FROM public.admin_user_roles aur
    JOIN public.role_permissions rp ON rp.role_id = aur.role_id
    WHERE aur.admin_user_id = v_target_admin_id
      AND rp.permission_id = p.id
    LIMIT 1
  ) rd ON true
  LEFT JOIN public.admin_user_permission_overrides o
    ON o.admin_user_id = v_target_admin_id
   AND o.permission_id = p.id
  ORDER BY p.code;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_admin_user_permission(
  p_target_user_id uuid,
  p_permission_code text,
  p_override boolean
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
  IF p_target_user_id = v_actor THEN
    RAISE EXCEPTION 'You cannot edit your own permissions';
  END IF;
  IF EXISTS (
    SELECT 1 FROM app_private.owner_principal op
    WHERE op.singleton = true AND op.user_id = p_target_user_id
  ) OR EXISTS (
    SELECT 1
    FROM public.admin_user_roles aur
    JOIN public.roles r ON r.id = aur.role_id
    JOIN public.admin_users au ON au.id = aur.admin_user_id
    WHERE au.user_id = p_target_user_id AND r.name = 'Owner'
  ) THEN
    RAISE EXCEPTION 'Owner permissions are protected';
  END IF;

  SELECT au.id INTO v_admin_id
  FROM public.admin_users au
  WHERE au.user_id = p_target_user_id
  FOR UPDATE;
  IF v_admin_id IS NULL THEN RAISE EXCEPTION 'Admin account not found'; END IF;

  SELECT p.id INTO v_permission_id
  FROM public.permissions p
  WHERE p.code = p_permission_code;
  IF v_permission_id IS NULL THEN RAISE EXCEPTION 'Permission code is not registered'; END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.admin_user_roles aur
    JOIN public.role_permissions rp ON rp.role_id = aur.role_id
    WHERE aur.admin_user_id = v_admin_id
      AND rp.permission_id = v_permission_id
  ) INTO v_role_default;

  SELECT o.granted INTO v_old_override
  FROM public.admin_user_permission_overrides o
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
  VALUES (
    (SELECT id FROM public.admin_users WHERE user_id = v_actor),
    v_actor,
    'admin.permission.override',
    'admin_user',
    v_admin_id,
    jsonb_build_object('permission', p_permission_code, 'override', v_old_override),
    jsonb_build_object('permission', p_permission_code, 'override', p_override, 'role_default', v_role_default),
    'Individual admin permission override changed'
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.list_admin_user_permissions(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_admin_user_permission(uuid, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_admin_user_permissions(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_admin_user_permission(uuid, text, boolean) TO authenticated;
