-- Costo vigente, copia del costo en cada venta y ganancia por producto (plan 3B).
-- Solo admin: nunca en products ni en order_items, que el público o el comprador pueden leer.

-- "Costo de lo que ya tenías" ----------------------------------------------------------------------------
create table public.product_costs (
  product_id uuid primary key references public.products (id) on delete cascade,
  initial_cost_cents int not null check (initial_cost_cents >= 0),
  updated_at timestamptz not null default now()
);

-- Copia del costo vigente al vender (así la ganancia no cambia si después sube el costo) ------------------
create table public.sale_costs (
  id bigint generated always as identity primary key,
  source text not null check (source in ('web', 'manual')),
  order_item_id uuid unique references public.order_items (id) on delete cascade,
  manual_sale_id uuid unique references public.manual_sales (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  quantity int not null,
  unit_price_cents int not null,
  unit_cost_cents int,
  cost_origin text check (cost_origin in ('compra', 'inicial')),
  created_at timestamptz not null default now(),
  check ((source = 'web') = (order_item_id is not null) and (source = 'manual') = (manual_sale_id is not null))
);
create index sale_costs_product_idx on public.sale_costs (product_id);

alter table public.product_costs enable row level security;
alter table public.sale_costs enable row level security;
create policy "costo inicial: admin lee" on public.product_costs for select to authenticated using ((select public.is_admin()));
create policy "costo de ventas: admin lee" on public.sale_costs for select to authenticated using ((select public.is_admin()));
revoke all on public.product_costs, public.sale_costs from anon;
revoke insert, update, delete on public.product_costs, public.sale_costs from authenticated;

-- Costo vigente: la última compra recibida; si no hay, lo que ya tenía; si no, sin costo -------------------
create or replace function public.product_current_cost(p_product_id uuid)
returns table (unit_cost_cents int, origin text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return query
  select round(i.line_cost_cents::numeric / i.quantity_received)::int, 'compra'::text
  from public.purchase_items i
  join public.purchases p on p.id = i.purchase_id
  where i.product_id = p_product_id and p.status = 'recibida' and i.quantity_received > 0 and i.line_cost_cents is not null
  order by p.received_at desc, i.id desc
  limit 1;
  if found then
    return;
  end if;
  return query select c.initial_cost_cents, 'inicial'::text from public.product_costs c where c.product_id = p_product_id;
  if found then
    return;
  end if;
  return query select null::int, null::text;
end;
$$;
revoke execute on function public.product_current_cost(uuid) from public, anon, authenticated;

-- Copias automáticas ---------------------------------------------------------------------------------------
create or replace function public.copy_web_sale_costs()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.sale_costs (source, order_item_id, product_id, quantity, unit_price_cents, unit_cost_cents, cost_origin)
  select 'web', oi.id, oi.product_id, oi.quantity, oi.unit_price_cents, c.unit_cost_cents, c.origin
  from public.order_items oi
  cross join lateral public.product_current_cost(oi.product_id) c
  where oi.order_id = new.order_id
  on conflict (order_item_id) do nothing;
  return new;
end;
$$;

create trigger order_events_copy_costs
  after insert on public.order_events
  for each row when (new.to_status = 'pagado')
  execute function public.copy_web_sale_costs();

create or replace function public.copy_manual_sale_cost()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.sale_costs (source, manual_sale_id, product_id, quantity, unit_price_cents, unit_cost_cents, cost_origin)
  select 'manual', new.id, new.product_id, new.quantity, new.unit_price_cents, c.unit_cost_cents, c.origin
  from public.product_current_cost(new.product_id) c
  on conflict (manual_sale_id) do nothing;
  return new;
end;
$$;

create trigger manual_sales_copy_cost
  after insert on public.manual_sales
  for each row execute function public.copy_manual_sale_cost();

-- Las ventas anteriores a esta etapa quedan "sin costo" (se muestran aparte; no se inventa un costo).
insert into public.sale_costs (source, order_item_id, product_id, quantity, unit_price_cents)
select 'web', oi.id, oi.product_id, oi.quantity, oi.unit_price_cents
from public.order_items oi
join public.orders o on o.id = oi.order_id
where o.status in ('pagado', 'enviado', 'listo_para_recoger', 'entregado', 'reembolsado')
on conflict do nothing;
insert into public.sale_costs (source, manual_sale_id, product_id, quantity, unit_price_cents)
select 'manual', s.id, s.product_id, s.quantity, s.unit_price_cents from public.manual_sales s
on conflict do nothing;

-- RPC del panel --------------------------------------------------------------------------------------------
create or replace function public.admin_set_initial_cost(p_product_id uuid, p_cost_cents int)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_admin();
  if not exists (select 1 from public.products where id = p_product_id) then
    raise exception 'Ese producto ya no existe' using errcode = 'P0001';
  end if;
  if p_cost_cents is null then
    delete from public.product_costs where product_id = p_product_id;
    return;
  end if;
  if p_cost_cents < 0 or p_cost_cents > 100000000 then
    raise exception 'Escribe el costo en Bs' using errcode = 'P0001';
  end if;
  insert into public.product_costs (product_id, initial_cost_cents) values (p_product_id, p_cost_cents)
  on conflict (product_id) do update set initial_cost_cents = excluded.initial_cost_cents, updated_at = now();
end;
$$;

create or replace function public.admin_product_cost_summary(p_product_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_current record;
  v_result jsonb;
begin
  perform public.require_admin();
  select * into v_current from public.product_current_cost(p_product_id);

  with received as (
    select i.*, p.received_at, p.status, s.id as supplier_id, s.name as supplier_name, s.whatsapp as supplier_whatsapp, p.id as pid
    from public.purchase_items i
    join public.purchases p on p.id = i.purchase_id
    join public.suppliers s on s.id = p.supplier_id
    where i.product_id = p_product_id
  ),
  sales as (
    select sc.*,
      case when sc.source = 'web'
        then exists (select 1 from public.order_items oi join public.orders o on o.id = oi.order_id
                     where oi.id = sc.order_item_id and o.status in ('pagado', 'enviado', 'listo_para_recoger', 'entregado'))
        else exists (select 1 from public.manual_sales ms where ms.id = sc.manual_sale_id and ms.voided_at is null)
      end as counts
    from public.sale_costs sc where sc.product_id = p_product_id
  )
  select jsonb_build_object(
    'currentUnitCostCents', v_current.unit_cost_cents,
    'costOrigin', v_current.origin,
    'initialCostCents', (select initial_cost_cents from public.product_costs where product_id = p_product_id),
    'averageUnitCostCents', (select round(sum(line_cost_cents)::numeric / nullif(sum(quantity_received), 0))::int
                             from received where status = 'recibida' and quantity_received > 0),
    'lastPurchase', (select jsonb_build_object('purchaseId', pid, 'supplierId', supplier_id, 'supplierName', supplier_name,
                       'supplierWhatsapp', supplier_whatsapp, 'receivedAt', received_at, 'quantity', quantity_received,
                       'unitCostCents', round(line_cost_cents::numeric / quantity_received)::int)
                     from received where status = 'recibida' and quantity_received > 0
                     order by received_at desc, id desc limit 1),
    'purchases', coalesce((select jsonb_agg(x order by x ->> 'sortKey' desc) from (
                     select jsonb_build_object('purchaseId', pid, 'supplierName', supplier_name, 'receivedAt', received_at, 'status', status,
                       'quantity', coalesce(quantity_received, quantity_ordered),
                       'unitCostCents', case when quantity_received > 0 then round(line_cost_cents::numeric / quantity_received)::int end,
                       'sortKey', coalesce(received_at, '9999-12-31'::timestamptz)::text) as x
                     from received where status <> 'anulada' order by coalesce(received_at, '9999-12-31') desc limit 20) t), '[]'::jsonb),
    'sold', (select jsonb_build_object(
               'units', coalesce(sum(quantity) filter (where counts), 0),
               'unitsWithoutCost', coalesce(sum(quantity) filter (where counts and unit_cost_cents is null), 0),
               'revenueCents', coalesce(sum(quantity::bigint * unit_price_cents) filter (where counts), 0),
               'profitCents', coalesce(sum(quantity::bigint * (unit_price_cents - unit_cost_cents)) filter (where counts and unit_cost_cents is not null), 0))
             from sales)
  ) into v_result;
  return v_result;
end;
$$;

revoke execute on function public.admin_set_initial_cost(uuid, int) from public, anon;
revoke execute on function public.admin_product_cost_summary(uuid) from public, anon;
grant execute on function public.admin_set_initial_cost(uuid, int) to authenticated;
grant execute on function public.admin_product_cost_summary(uuid) to authenticated;
