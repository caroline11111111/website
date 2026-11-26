CREATE OR REPLACE FUNCTION public.list_admin_users()
RETURNS TABLE(user_id uuid, email text, is_active boolean, role_names text[])
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT app_private.has_permission('admins.manage') THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  RETURN QUERY
  SELECT
    au.user_id,
    u.email::text,
    au.is_active,
    COALESCE(array_agg(r.name::text) FILTER (WHERE r.name IS NOT NULL), '{}'::text[])
  FROM public.admin_users au
  JOIN auth.users u ON u.id = au.user_id
  LEFT JOIN public.admin_user_roles aur ON aur.admin_user_id = au.id
  LEFT JOIN public.roles r ON r.id = aur.role_id
  GROUP BY au.user_id, u.email, au.is_active
  ORDER BY u.email;
END;
$function$;