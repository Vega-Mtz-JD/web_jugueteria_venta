-- Dashboard del panel (plan 5): una sola definición de venta, períodos, lista de ventas y resúmenes.
-- Todo se suma desde sales_lines para que la portada, las barras y la lista den lo mismo al centavo.

-- Qué es una venta ------------------------------------------------------------------------------------------
-- Pedido web pagado/enviado/listo/entregado (fecha: último evento a 'pagado') o venta manual vigente.
-- El envío va en una sola línea por pedido, para sumarlo sin repetirlo; no es venta.
create or replace function public.sales_lines(p_from timestamptz, p_to timestamptz)
returns table (
  sold_at timestamptz,
  channel text,
  order_id uuid,
  order_number int,
  manual_sale_id uuid,
  customer_id uuid,
  product_id uuid,
  product_name text,
  quantity int,
  unit_price_cents int,
  unit_cost_cents int,
  delivery_fee_cents int
)
language sql
stable
security definer
set search_path = ''
as $$
  select w.sold_at, 'web', o.id, o.number, null::uuid, o.customer_id, oi.product_id, oi.product_name, oi.quantity,
    oi.unit_price_cents, sc.unit_cost_cents,
    case when row_number() over (partition by o.id order by oi.id) = 1 then o.delivery_fee_cents else 0 end
  from public.orders o
  cross join lateral (select max(e.created_at) as sold_at from public.order_events e
                      where e.order_id = o.id and e.to_status = 'pagado') w
  join public.order_items oi on oi.order_id = o.id
  left join public.sale_costs sc on sc.order_item_id = oi.id
  where o.status in ('pagado', 'enviado', 'listo_para_recoger', 'entregado')
    and w.sold_at >= p_from and w.sold_at < p_to
  union all
  select s.created_at, s.channel, null, null, s.id, null, s.product_id, p.name, s.quantity, s.unit_price_cents,
    sc.unit_cost_cents, 0
  from public.manual_sales s
  join public.products p on p.id = s.product_id
  left join public.sale_costs sc on sc.manual_sale_id = s.id
  where s.voided_at is null and s.created_at >= p_from and s.created_at < p_to;
$$;
revoke execute on function public.sales_lines(timestamptz, timestamptz) from public, anon, authenticated;

-- El único lugar donde se suman los totales -----------------------------------------------------------------
create or replace function public.sales_totals(p_from timestamptz, p_to timestamptz, p_channel text default null, p_without_cost boolean default false)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'salesCents', coalesce(sum(l.quantity::bigint * l.unit_price_cents), 0),
    'count', count(distinct coalesce(l.order_id, l.manual_sale_id)),
    'units', coalesce(sum(l.quantity), 0),
    'costCents', coalesce(sum(l.quantity::bigint * l.unit_cost_cents) filter (where l.unit_cost_cents is not null), 0),
    'profitCents', coalesce(sum(l.quantity::bigint * (l.unit_price_cents - l.unit_cost_cents)) filter (where l.unit_cost_cents is not null), 0),
    'withoutCostCents', coalesce(sum(l.quantity::bigint * l.unit_price_cents) filter (where l.unit_cost_cents is null), 0),
    'withoutCostUnits', coalesce(sum(l.quantity) filter (where l.unit_cost_cents is null), 0),
    'shippingCents', coalesce(sum(l.delivery_fee_cents), 0))
  from public.sales_lines(p_from, p_to) l
  where (p_channel is null or l.channel = p_channel) and (not p_without_cost or l.unit_cost_cents is null);
$$;
revoke execute on function public.sales_totals(timestamptz, timestamptz, text, boolean) from public, anon, authenticated;

-- Medianoche de La Paz de un día ----------------------------------------------------------------------------
create or replace function public.la_paz_start(p_day date)
returns timestamptz
language sql
immutable
set search_path = ''
as $$ select p_day::timestamp at time zone 'America/La_Paz' $$;
revoke execute on function public.la_paz_start(date) from public, anon, authenticated;

-- Períodos: el actual, el anterior (cortado en el mismo punto) y los días de la lista -------------------------
create or replace function public.dashboard_period(p_period text, p_now timestamptz)
returns table (cur_from timestamptz, cur_to timestamptz, prev_from timestamptz, prev_to timestamptz, list_from date, list_to date)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_local timestamp := p_now at time zone 'America/La_Paz';
  v_d date := v_local::date;
  v_m date := date_trunc('month', v_local)::date;
  v_prev_m date := (date_trunc('month', v_local) - interval '1 month')::date;
  -- +1 µs: incluye una venta registrada en el mismo instante.
  v_now timestamptz := p_now + interval '1 microsecond';
begin
  case p_period
    when 'hoy' then
      return query select public.la_paz_start(v_d), v_now, public.la_paz_start(v_d - 1), v_now - interval '1 day', v_d, v_d;
    when '7dias' then
      return query select public.la_paz_start(v_d - 6), v_now, public.la_paz_start(v_d - 13), v_now - interval '7 days', v_d - 6, v_d;
    when 'mes' then
      return query select public.la_paz_start(v_m), v_now, public.la_paz_start(v_prev_m),
        least(public.la_paz_start(v_prev_m) + (v_now - public.la_paz_start(v_m)), public.la_paz_start(v_m)), v_m, v_d;
    when 'mes-anterior' then
      return query select public.la_paz_start(v_prev_m), public.la_paz_start(v_m),
        public.la_paz_start((v_prev_m - interval '1 month')::date), public.la_paz_start(v_prev_m), v_prev_m, v_m - 1;
    when '12meses' then
      return query select public.la_paz_start((v_m - interval '11 months')::date), v_now,
        public.la_paz_start((v_m - interval '23 months')::date), v_now - interval '1 year', (v_m - interval '11 months')::date, v_d;
    else
      raise exception 'Período desconocido' using errcode = 'P0001';
  end case;
end;
$$;
revoke execute on function public.dashboard_period(text, timestamptz) from public, anon, authenticated;

-- Lista de ventas (página Ventas) ---------------------------------------------------------------------------
create or replace function public.admin_sales_list(
  p_period text default null,
  p_from date default null,
  p_to date default null,
  p_channel text default null,
  p_without_cost boolean default false,
  p_limit int default 200
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_from date := p_from;
  v_to date := p_to;
  v_lo timestamptz;
  v_hi timestamptz;
  v_rows jsonb;
  v_count int;
begin
  perform public.require_admin();
  if p_channel is not null and p_channel not in ('web', 'tienda', 'whatsapp') then
    raise exception 'Canal desconocido' using errcode = 'P0001';
  end if;
  if p_period is not null then
    select d.list_from, d.list_to into v_from, v_to from public.dashboard_period(p_period, now()) d;
  end if;
  if v_from is null or v_to is null or v_from > v_to or v_to - v_from > 800 then
    raise exception 'Revisa las fechas' using errcode = 'P0001';
  end if;
  v_lo := public.la_paz_start(v_from);
  v_hi := public.la_paz_start(v_to + 1);

  select count(*) into v_count
  from public.sales_lines(v_lo, v_hi) l
  where (p_channel is null or l.channel = p_channel) and (not p_without_cost or l.unit_cost_cents is null);

  select coalesce(jsonb_agg(x.j order by x.n), '[]'::jsonb) into v_rows
  from (
    select row_number() over (order by l.sold_at desc, l.product_name) as n,
      jsonb_build_object(
        'soldAt', l.sold_at, 'channel', l.channel, 'orderId', l.order_id, 'orderNumber', l.order_number,
        'manualSaleId', l.manual_sale_id, 'productId', l.product_id, 'productName', l.product_name,
        'quantity', l.quantity, 'unitPriceCents', l.unit_price_cents, 'unitCostCents', l.unit_cost_cents,
        'profitCents', l.quantity::bigint * (l.unit_price_cents - l.unit_cost_cents)) as j
    from public.sales_lines(v_lo, v_hi) l
    where (p_channel is null or l.channel = p_channel) and (not p_without_cost or l.unit_cost_cents is null)
  ) x
  where x.n <= least(greatest(p_limit, 1), 500);

  return jsonb_build_object(
    'range', jsonb_build_object('from', v_from, 'to', v_to),
    'totals', public.sales_totals(v_lo, v_hi, p_channel, p_without_cost),
    'rowCount', v_count,
    'rows', v_rows);
end;
$$;
revoke execute on function public.admin_sales_list(text, date, date, text, boolean, int) from public, anon;
grant execute on function public.admin_sales_list(text, date, date, text, boolean, int) to authenticated;
