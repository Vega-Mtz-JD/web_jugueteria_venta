-- Borrar productos de prueba sin romper pedidos: los que ya aparecen en algún pedido
-- se ocultan (is_active = false) para conservar el historial; el resto se borra.
create or replace function public.delete_sample_products()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  hidden integer;
  deleted integer;
begin
  if not public.is_admin() then
    raise exception 'Solo un administrador puede borrar los productos de prueba'
      using errcode = '42501';
  end if;

  update public.products p set is_active = false
  where p.is_sample and exists (select 1 from public.order_items i where i.product_id = p.id);
  get diagnostics hidden = row_count;

  delete from public.products p
  where p.is_sample and not exists (select 1 from public.order_items i where i.product_id = p.id);
  get diagnostics deleted = row_count;

  return hidden + deleted;
end;
$$;
