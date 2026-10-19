-- Contacto del cliente de un pedido para el panel (el correo vive en auth.users, fuera de la API).
create or replace function public.admin_customer_contact(p_order_id uuid)
returns table (email text, full_name text, phone text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_admin();
  return query
  select u.email::text, p.full_name, p.phone
  from public.orders o
  join public.profiles p on p.id = o.customer_id
  join auth.users u on u.id = o.customer_id
  where o.id = p_order_id;
end;
$$;
revoke execute on function public.admin_customer_contact(uuid) from public, anon;
grant execute on function public.admin_customer_contact(uuid) to authenticated;
