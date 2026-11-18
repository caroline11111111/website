
insert into public.role_permissions(role_id,permission_id)
select r.id,p.id
from public.roles r
cross join public.permissions p
where r.name='Admin' and p.code='orders.deadline.extend'
on conflict do nothing;
