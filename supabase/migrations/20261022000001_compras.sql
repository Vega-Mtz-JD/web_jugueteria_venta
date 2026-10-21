-- Proveedores y compras (plan 3B): encargo, llegada por bus, pagos en Bs o dólares y costo real.
-- Todo es solo de admin. Los costos nunca van en products ni en order_items (legibles por el público).
-- Dinero en enteros: centavos de Bs, o centavos de US$ en compras y pagos en dólares.

-- Stock y visibilidad --------------------------------------------------------------------------------
alter table public.stock_movements drop constraint stock_movements_reason_check;
alter table public.stock_movements add constraint stock_movements_reason_check
  check (reason in ('alta', 'venta_web', 'devolucion_web', 'venta_manual', 'anulacion_venta_manual', 'ajuste', 'compra', 'anulacion_compra'));

-- Un juego creado desde una compra nace con precio 0: no se puede mostrar hasta ponerle precio.
-- (not valid: no revisa filas viejas, sí cada alta o cambio desde ahora)
alter table public.products add constraint products_visible_price check (not is_active or price_cents > 0) not valid;

-- Tablas ------------------------------------------------------------------------------------------------
create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 2 and 120),
  contact_name text,
  whatsapp text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.purchases (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique,
  supplier_id uuid not null references public.suppliers (id) on delete restrict,
  ordered_on date not null default current_date,
  currency text not null check (currency in ('BOB', 'USD')),
  arrival_rate numeric(10, 4) check (arrival_rate > 0),
  shipping_cents int check (shipping_cents >= 0),
  status text not null default 'encargada' check (status in ('encargada', 'recibida', 'anulada')),
  note text,
  issues_note text,
  received_at timestamptz,
  voided_at timestamptz,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);
create index purchases_supplier_idx on public.purchases (supplier_id, created_at desc);
create index purchases_status_idx on public.purchases (status, ordered_on);

create table public.purchase_items (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references public.purchases (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete restrict,
  quantity_ordered int not null check (quantity_ordered between 1 and 10000),
  quantity_received int check (quantity_received between 0 and 10000),
  unit_price_cents int not null check (unit_price_cents >= 0),
  -- Costo real en centavos de Bs (valor en Bs + parte del envío); se fija al llegar.
  line_cost_cents bigint
);
create index purchase_items_purchase_idx on public.purchase_items (purchase_id);
create index purchase_items_product_idx on public.purchase_items (product_id);

create table public.purchase_payments (
  id uuid primary key default gen_random_uuid(),
  request_id uuid unique,
  purchase_id uuid not null references public.purchases (id) on delete cascade,
  paid_on date not null default current_date,
  currency text not null check (currency in ('BOB', 'USD')),
  amount_cents int not null,
  rate numeric(10, 4) check (rate > 0),
  -- El mismo monto en la moneda de la compra y en Bs (cada uno redondeado una vez, al guardarse).
  amount_purchase_cents int not null,
  amount_bob_cents bigint not null,
  kind text not null default 'pago' check (kind in ('pago', 'devolucion', 'saldo_usado', 'saldo_recibido')),
  linked_payment_id uuid references public.purchase_payments (id),
  note text,
  voided_at timestamptz,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);
create index purchase_payments_purchase_idx on public.purchase_payments (purchase_id);

alter table public.suppliers enable row level security;
alter table public.purchases enable row level security;
alter table public.purchase_items enable row level security;
alter table public.purchase_payments enable row level security;

create policy "proveedores: admin gestiona" on public.suppliers
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "compras: admin lee" on public.purchases for select to authenticated using ((select public.is_admin()));
create policy "líneas de compra: admin lee" on public.purchase_items for select to authenticated using ((select public.is_admin()));
create policy "pagos de compra: admin lee" on public.purchase_payments for select to authenticated using ((select public.is_admin()));

revoke all on public.suppliers from anon;
revoke all on public.purchases, public.purchase_items, public.purchase_payments from anon;
revoke insert, update, delete on public.purchases, public.purchase_items, public.purchase_payments from authenticated;

-- Saldo de cada compra, en su moneda (las anuladas no cuentan) ------------------------------------------
create view public.purchase_balances with (security_invoker = true) as
select t.id, t.supplier_id, t.currency, t.status, t.total_cents, t.paid_cents, t.total_cents - t.paid_cents as debt_cents
from (
  select p.id, p.supplier_id, p.currency, p.status,
    coalesce((
      select sum((case when p.status = 'recibida' then coalesce(i.quantity_received, 0) else i.quantity_ordered end)::bigint * i.unit_price_cents)
      from public.purchase_items i where i.purchase_id = p.id
    ), 0)::bigint as total_cents,
    coalesce((
      select sum(pp.amount_purchase_cents) from public.purchase_payments pp
      where pp.purchase_id = p.id and pp.voided_at is null
    ), 0)::bigint as paid_cents
  from public.purchases p
  where p.status <> 'anulada'
) t;
revoke all on public.purchase_balances from anon;

-- Ayudantes -----------------------------------------------------------------------------------------------
-- Dirección web desde un nombre (igual que slugify en src/features/admin/slug.ts).
create or replace function public.slugify_name(p_name text)
returns text
language sql
immutable
set search_path = ''
as $$
  select coalesce(nullif(trim(both '-' from left(regexp_replace(lower(public.immutable_unaccent(p_name)), '[^a-z0-9]+', '-', 'g'), 80)), ''), 'producto');
$$;

create or replace function public.next_free_product_slug(p_base text)
returns text
language plpgsql
stable
set search_path = ''
as $$
declare
  v_slug text := p_base;
  n int := 2;
begin
  while exists (select 1 from public.products where slug = v_slug) loop
    v_slug := p_base || '-' || n;
    n := n + 1;
  end loop;
  return v_slug;
end;
$$;

-- Reparte p_total entre pesos, al centavo, por el resto mayor (a igual resto gana el id menor).
-- Σ resultado = p_total exacto. Si todos los pesos son 0, reparte en partes iguales.
create or replace function public.distribute_cents(p_total bigint, p_weights bigint[], p_ids uuid[])
returns bigint[]
language plpgsql
immutable
set search_path = ''
as $$
declare
  n int := coalesce(array_length(p_weights, 1), 0);
  w bigint[] := p_weights;
  sum_w numeric;
  shares bigint[] := '{}';
  rems numeric[] := '{}';
  given bigint := 0;
  left_over bigint;
  i int;
  best int;
begin
  if n = 0 then
    return '{}';
  end if;
  sum_w := (select sum(x) from unnest(w) x);
  if sum_w = 0 then
    w := array_fill(1::bigint, array[n]);
    sum_w := n;
  end if;
  for i in 1..n loop
    shares := shares || floor(p_total::numeric * w[i] / sum_w)::bigint;
    rems := rems || ((p_total::numeric * w[i]) % sum_w);
    given := given + shares[i];
  end loop;
  left_over := p_total - given;
  while left_over > 0 loop
    best := null;
    for i in 1..n loop
      if rems[i] >= 0 and (best is null or rems[i] > rems[best] or (rems[i] = rems[best] and p_ids[i] < p_ids[best])) then
        best := i;
      end if;
    end loop;
    shares[best] := shares[best] + 1;
    rems[best] := -1; -- cada línea recibe a lo más un centavo extra
    left_over := left_over - 1;
  end loop;
  return shares;
end;
$$;

-- Dólar con el que se valoran los productos de una compra en USD: lo pagado, con el dólar de cada
-- pago; lo que falta pagar, con el dólar anotado al llegar. Pagada del todo, el costo en Bs es
-- exactamente lo que salió del bolsillo.
create or replace function public.purchase_effective_rate(p_purchase_id uuid)
returns numeric
language plpgsql
stable
set search_path = ''
as $$
declare
  v public.purchases%rowtype;
  v_total numeric;
  v_paid numeric;
  v_paid_bob numeric;
begin
  select * into v from public.purchases where id = p_purchase_id;
  select coalesce(sum(coalesce(quantity_received, 0)::bigint * unit_price_cents), 0) into v_total
  from public.purchase_items where purchase_id = p_purchase_id;
  select coalesce(sum(amount_purchase_cents), 0), coalesce(sum(amount_bob_cents), 0) into v_paid, v_paid_bob
  from public.purchase_payments where purchase_id = p_purchase_id and voided_at is null;
  if v_total = 0 then
    return v.arrival_rate;
  end if;
  if v_paid >= v_total and v_paid > 0 then
    return v_paid_bob / v_paid;
  end if;
  return (v_paid_bob + (v_total - v_paid) * v.arrival_rate) / v_total;
end;
$$;

-- Costo real de cada línea recibida: valor en Bs + parte del envío (por el valor de cada línea).
create or replace function public.recompute_purchase_costs(p_purchase_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.purchases%rowtype;
  v_ids uuid[];
  v_values bigint[];
  v_bob bigint[];
  v_ship bigint[];
  v_total bigint;
  i int;
begin
  select * into v from public.purchases where id = p_purchase_id;
  if not found or v.status <> 'recibida' then
    update public.purchase_items set line_cost_cents = null where purchase_id = p_purchase_id;
    return;
  end if;

  select array_agg(id order by id), array_agg(coalesce(quantity_received, 0)::bigint * unit_price_cents order by id)
  into v_ids, v_values
  from public.purchase_items where purchase_id = p_purchase_id;
  if v_ids is null then
    return;
  end if;

  if v.currency = 'BOB' then
    v_bob := v_values;
  else
    v_total := (select sum(x) from unnest(v_values) x);
    v_bob := public.distribute_cents(round(v_total * public.purchase_effective_rate(p_purchase_id))::bigint, v_values, v_ids);
  end if;
  v_ship := public.distribute_cents(coalesce(v.shipping_cents, 0), v_bob, v_ids);

  for i in 1..array_length(v_ids, 1) loop
    update public.purchase_items set line_cost_cents = v_bob[i] + v_ship[i] where id = v_ids[i];
  end loop;
end;
$$;

-- Líneas de una compra: producto existente o juego nuevo (se crea oculto, sin precio y sin stock).
create or replace function public.insert_purchase_lines(p_purchase_id uuid, p_lines jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_line jsonb;
  v_product uuid;
  v_name text;
  v_category uuid;
  v_qty int;
  v_price int;
begin
  if jsonb_typeof(p_lines) is distinct from 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'Agrega al menos un producto' using errcode = 'P0001';
  end if;
  if jsonb_array_length(p_lines) > 50 then
    raise exception 'Una compra puede tener hasta 50 productos' using errcode = 'P0001';
  end if;
  for v_line in select * from jsonb_array_elements(p_lines) loop
    v_qty := (v_line ->> 'quantity')::int;
    v_price := (v_line ->> 'unit_price_cents')::int;
    if v_qty is null or v_qty < 1 or v_qty > 10000 then
      raise exception 'La cantidad debe ser entre 1 y 10000' using errcode = 'P0001';
    end if;
    if v_price is null or v_price < 0 then
      raise exception 'Escribe el precio de cada producto' using errcode = 'P0001';
    end if;
    if v_line ? 'new_product' then
      v_name := nullif(trim(v_line -> 'new_product' ->> 'name'), '');
      v_category := nullif(v_line -> 'new_product' ->> 'category_id', '')::uuid;
      if v_name is null or length(v_name) < 3 or length(v_name) > 120 then
        raise exception 'Escribe el nombre del juego nuevo (3 a 120 letras)' using errcode = 'P0001';
      end if;
      if not exists (select 1 from public.categories where id = v_category) then
        raise exception 'Elige la categoría del juego nuevo' using errcode = 'P0001';
      end if;
      insert into public.products (name, slug, category_id, price_cents, stock, is_active)
      values (v_name, public.next_free_product_slug(public.slugify_name(v_name)), v_category, 0, 0, false)
      returning id into v_product;
    else
      v_product := nullif(v_line ->> 'product_id', '')::uuid;
      if not exists (select 1 from public.products where id = v_product) then
        raise exception 'Ese producto ya no existe' using errcode = 'P0001';
      end if;
    end if;
    insert into public.purchase_items (purchase_id, product_id, quantity_ordered, unit_price_cents)
    values (p_purchase_id, v_product, v_qty, v_price);
  end loop;
end;
$$;

create or replace function public.check_purchase_header(p_supplier_id uuid, p_currency text)
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if not exists (select 1 from public.suppliers where id = p_supplier_id) then
    raise exception 'Elige un proveedor' using errcode = 'P0001';
  end if;
  if p_currency is null or p_currency not in ('BOB', 'USD') then
    raise exception 'Elige si la compra es en bolivianos o en dólares' using errcode = 'P0001';
  end if;
end;
$$;

-- Cambia el stock de una compra (llegada, corrección o anulación) sin dejarlo negativo.
-- p_deltas: [{product_id, delta}] ya agrupado por producto.
create or replace function public.apply_purchase_stock(p_purchase_id uuid, p_deltas jsonb, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_d record;
  v_product public.products%rowtype;
begin
  for v_d in
    select (e ->> 'product_id')::uuid as product_id, (e ->> 'delta')::int as delta
    from jsonb_array_elements(p_deltas) e
    where (e ->> 'delta')::int <> 0
    order by 1
  loop
    select * into v_product from public.products where id = v_d.product_id for update;
    if v_product.stock + v_d.delta < 0 then
      raise exception 'No alcanza el stock: ya se vendieron % de «%»', -(v_product.stock + v_d.delta), v_product.name using errcode = 'P0001';
    end if;
  end loop;
  perform public.set_stock_reason(p_reason, p_purchase_id);
  update public.products p set stock = p.stock + (e ->> 'delta')::int
  from jsonb_array_elements(p_deltas) e
  where p.id = (e ->> 'product_id')::uuid and (e ->> 'delta')::int <> 0;
  perform public.set_stock_reason('');
end;
$$;

-- Cantidades recibidas: [{item_id, quantity}] → (item_id, cantidad); lo que falte, igual a lo encargado.
create or replace function public.read_received(p_purchase_id uuid, p_received jsonb)
returns table (item_id uuid, product_id uuid, quantity int, previous int)
language plpgsql
stable
set search_path = ''
as $$
begin
  return query
  select i.id, i.product_id,
    coalesce((select (e ->> 'quantity')::int from jsonb_array_elements(coalesce(p_received, '[]')) e
              where (e ->> 'item_id')::uuid = i.id limit 1), i.quantity_ordered),
    coalesce(i.quantity_received, 0)
  from public.purchase_items i
  where i.purchase_id = p_purchase_id;
end;
$$;

-- RPC del panel ---------------------------------------------------------------------------------------------
create or replace function public.admin_create_purchase(
  p_request_id uuid, p_supplier_id uuid, p_ordered_on date, p_currency text, p_note text, p_lines jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  perform public.require_admin();
  select id into v_id from public.purchases where request_id = p_request_id;
  if found then
    return v_id; -- reintento del mismo envío (doble toque o respuesta perdida)
  end if;
  perform public.check_purchase_header(p_supplier_id, p_currency);
  insert into public.purchases (request_id, supplier_id, ordered_on, currency, note, created_by)
  values (p_request_id, p_supplier_id, coalesce(p_ordered_on, current_date), p_currency, nullif(trim(p_note), ''), auth.uid())
  returning id into v_id;
  perform public.insert_purchase_lines(v_id, p_lines);
  return v_id;
end;
$$;

create or replace function public.admin_update_purchase(
  p_purchase_id uuid, p_supplier_id uuid, p_ordered_on date, p_currency text, p_note text, p_lines jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.purchases%rowtype;
begin
  perform public.require_admin();
  select * into v from public.purchases where id = p_purchase_id for update;
  if not found then
    raise exception 'Esa compra no existe' using errcode = 'P0001';
  end if;
  if v.status <> 'encargada' then
    raise exception 'Solo se puede corregir una compra encargada' using errcode = 'P0001';
  end if;
  perform public.check_purchase_header(p_supplier_id, p_currency);
  update public.purchases
  set supplier_id = p_supplier_id, ordered_on = coalesce(p_ordered_on, ordered_on), currency = p_currency, note = nullif(trim(p_note), '')
  where id = p_purchase_id;
  delete from public.purchase_items where purchase_id = p_purchase_id;
  perform public.insert_purchase_lines(p_purchase_id, p_lines);
end;
$$;

create or replace function public.admin_set_purchase_notes(p_purchase_id uuid, p_note text, p_issues_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_admin();
  update public.purchases set note = nullif(trim(p_note), ''), issues_note = nullif(trim(p_issues_note), '')
  where id = p_purchase_id;
  if not found then
    raise exception 'Esa compra no existe' using errcode = 'P0001';
  end if;
end;
$$;

create or replace function public.check_arrival_values(p_currency text, p_shipping_cents int, p_arrival_rate numeric)
returns void
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_currency = 'USD' and (p_arrival_rate is null or p_arrival_rate <= 0) then
    raise exception 'Anota a cuánto estaba el dólar' using errcode = 'P0001';
  end if;
  if coalesce(p_shipping_cents, 0) < 0 then
    raise exception 'El envío no puede ser negativo' using errcode = 'P0001';
  end if;
end;
$$;

create or replace function public.admin_receive_purchase(p_purchase_id uuid, p_received jsonb, p_shipping_cents int, p_arrival_rate numeric)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.purchases%rowtype;
  v_deltas jsonb;
begin
  perform public.require_admin();
  select * into v from public.purchases where id = p_purchase_id for update;
  if not found then
    raise exception 'Esa compra no existe' using errcode = 'P0001';
  end if;
  if v.status = 'anulada' then
    raise exception 'Esta compra está anulada' using errcode = 'P0001';
  end if;
  if v.status <> 'encargada' then
    raise exception 'Esta compra ya llegó' using errcode = 'P0001';
  end if;
  perform public.check_arrival_values(v.currency, p_shipping_cents, p_arrival_rate);
  if exists (select 1 from public.read_received(p_purchase_id, p_received) r where r.quantity < 0 or r.quantity > 10000) then
    raise exception 'Revisa las cantidades que llegaron' using errcode = 'P0001';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('product_id', product_id, 'delta', q)), '[]') into v_deltas
  from (select r.product_id, sum(r.quantity)::int as q from public.read_received(p_purchase_id, p_received) r group by r.product_id) s;

  update public.purchase_items i set quantity_received = r.quantity
  from public.read_received(p_purchase_id, p_received) r where i.id = r.item_id;
  perform public.apply_purchase_stock(p_purchase_id, v_deltas, 'compra');
  update public.purchases
  set status = 'recibida', received_at = clock_timestamp(), shipping_cents = coalesce(p_shipping_cents, 0),
      arrival_rate = case when currency = 'USD' then p_arrival_rate end
  where id = p_purchase_id;
  perform public.recompute_purchase_costs(p_purchase_id);
end;
$$;

create or replace function public.admin_correct_arrival(p_purchase_id uuid, p_received jsonb, p_shipping_cents int, p_arrival_rate numeric)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.purchases%rowtype;
  v_deltas jsonb;
begin
  perform public.require_admin();
  select * into v from public.purchases where id = p_purchase_id for update;
  if not found then
    raise exception 'Esa compra no existe' using errcode = 'P0001';
  end if;
  if v.status <> 'recibida' then
    raise exception 'Solo se puede corregir la llegada de una compra recibida' using errcode = 'P0001';
  end if;
  perform public.check_arrival_values(v.currency, p_shipping_cents, p_arrival_rate);
  if exists (select 1 from public.read_received(p_purchase_id, p_received) r where r.quantity < 0 or r.quantity > 10000) then
    raise exception 'Revisa las cantidades que llegaron' using errcode = 'P0001';
  end if;

  -- Sin cantidad nueva para una línea, se queda con la que ya tenía.
  select coalesce(jsonb_agg(jsonb_build_object('product_id', product_id, 'delta', d)), '[]') into v_deltas
  from (
    select i.product_id, sum(coalesce(n.q, i.quantity_received) - i.quantity_received)::int as d
    from public.purchase_items i
    left join lateral (
      select (e ->> 'quantity')::int as q from jsonb_array_elements(coalesce(p_received, '[]')) e
      where (e ->> 'item_id')::uuid = i.id limit 1
    ) n on true
    where i.purchase_id = p_purchase_id
    group by i.product_id
  ) s;

  perform public.apply_purchase_stock(p_purchase_id, v_deltas, 'compra');
  update public.purchase_items i
  set quantity_received = (e ->> 'quantity')::int
  from jsonb_array_elements(coalesce(p_received, '[]')) e
  where i.purchase_id = p_purchase_id and i.id = (e ->> 'item_id')::uuid;
  update public.purchases
  set shipping_cents = coalesce(p_shipping_cents, 0), arrival_rate = case when currency = 'USD' then p_arrival_rate end
  where id = p_purchase_id;
  perform public.recompute_purchase_costs(p_purchase_id);
end;
$$;

create or replace function public.admin_void_purchase(p_purchase_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.purchases%rowtype;
  v_deltas jsonb;
begin
  perform public.require_admin();
  select * into v from public.purchases where id = p_purchase_id for update;
  if not found then
    raise exception 'Esa compra no existe' using errcode = 'P0001';
  end if;
  if v.status = 'anulada' then
    raise exception 'Esta compra ya estaba anulada' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.purchase_payments where purchase_id = p_purchase_id and voided_at is null) then
    raise exception 'Primero anula los pagos de esta compra' using errcode = 'P0001';
  end if;
  if v.status = 'recibida' then
    select coalesce(jsonb_agg(jsonb_build_object('product_id', product_id, 'delta', -q)), '[]') into v_deltas
    from (select product_id, sum(coalesce(quantity_received, 0))::int as q from public.purchase_items
          where purchase_id = p_purchase_id group by product_id) s;
    perform public.apply_purchase_stock(p_purchase_id, v_deltas, 'anulacion_compra');
  end if;
  update public.purchases set status = 'anulada', voided_at = now() where id = p_purchase_id;
  perform public.recompute_purchase_costs(p_purchase_id);
end;
$$;

-- Pagos ------------------------------------------------------------------------------------------------------
-- Un pago en otra moneda que la compra se convierte con el dólar de ese pago (redondeo único al guardar).
create or replace function public.admin_record_payment(
  p_request_id uuid, p_purchase_id uuid, p_paid_on date, p_currency text, p_amount_cents int, p_rate numeric, p_note text, p_kind text default 'pago'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.purchases%rowtype;
  v_id uuid;
  v_sign int;
  v_purchase_amount int;
  v_bob bigint;
begin
  perform public.require_admin();
  select id into v_id from public.purchase_payments where request_id = p_request_id;
  if found then
    return v_id; -- reintento del mismo pago
  end if;
  select * into v from public.purchases where id = p_purchase_id for update;
  if not found then
    raise exception 'Esa compra no existe' using errcode = 'P0001';
  end if;
  if v.status = 'anulada' then
    raise exception 'Esta compra está anulada' using errcode = 'P0001';
  end if;
  if p_kind is null or p_kind not in ('pago', 'devolucion') then
    raise exception 'Tipo de pago no válido' using errcode = 'P0001';
  end if;
  if p_currency is null or p_currency not in ('BOB', 'USD') then
    raise exception 'Elige si pagaste en bolivianos o en dólares' using errcode = 'P0001';
  end if;
  if p_amount_cents is null or p_amount_cents <= 0 or p_amount_cents > 100000000 then
    raise exception 'Escribe el monto del pago' using errcode = 'P0001';
  end if;
  if (p_currency = 'USD' or v.currency = 'USD') and (p_rate is null or p_rate <= 0) then
    raise exception 'Anota a cuánto estaba el dólar' using errcode = 'P0001';
  end if;

  v_sign := case when p_kind = 'devolucion' then -1 else 1 end;
  v_purchase_amount := case
    when p_currency = v.currency then p_amount_cents
    when p_currency = 'BOB' then round(p_amount_cents / p_rate)::int  -- Bs que pagan dólares
    else round(p_amount_cents * p_rate)::int                          -- dólares que pagan Bs
  end;
  v_bob := case when p_currency = 'BOB' then p_amount_cents else round(p_amount_cents * p_rate)::bigint end;

  insert into public.purchase_payments (request_id, purchase_id, paid_on, currency, amount_cents, rate, amount_purchase_cents, amount_bob_cents, kind, note, created_by)
  values (p_request_id, p_purchase_id, coalesce(p_paid_on, current_date), p_currency, v_sign * p_amount_cents,
          case when p_currency = 'USD' or v.currency = 'USD' then p_rate end,
          v_sign * v_purchase_amount, v_sign * v_bob, p_kind, nullif(trim(p_note), ''), auth.uid())
  returning id into v_id;
  perform public.recompute_purchase_costs(p_purchase_id);
  return v_id;
end;
$$;

create or replace function public.admin_void_payment(p_payment_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.purchase_payments%rowtype;
begin
  perform public.require_admin();
  select * into v from public.purchase_payments where id = p_payment_id for update;
  if not found then
    raise exception 'Ese pago no existe' using errcode = 'P0001';
  end if;
  if v.voided_at is not null then
    raise exception 'Este pago ya estaba anulado' using errcode = 'P0001';
  end if;
  -- Un traspaso de saldo se anula entero (los dos lados).
  update public.purchase_payments set voided_at = now()
  where voided_at is null and (id = p_payment_id or id = v.linked_payment_id or linked_payment_id = p_payment_id);
  perform public.recompute_purchase_costs(p.purchase_id)
  from (select distinct purchase_id from public.purchase_payments
        where id = p_payment_id or id = v.linked_payment_id or linked_payment_id = p_payment_id) p;
end;
$$;

-- Saldo a favor de una compra → pago de otra compra del mismo proveedor (en una sola operación).
create or replace function public.admin_apply_credit(p_request_id uuid, p_from_purchase_id uuid, p_to_purchase_id uuid, p_rate numeric)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_from public.purchases%rowtype;
  v_to public.purchases%rowtype;
  v_credit bigint;
  v_to_amount int;
  v_bob bigint;
  v_out uuid;
  v_in uuid;
begin
  perform public.require_admin();
  if exists (select 1 from public.purchase_payments where request_id = p_request_id) then
    return; -- reintento
  end if;
  perform 1 from public.purchases where id in (p_from_purchase_id, p_to_purchase_id) order by id for update;
  select * into v_from from public.purchases where id = p_from_purchase_id;
  select * into v_to from public.purchases where id = p_to_purchase_id;
  if v_from.id is null or v_to.id is null or v_from.id = v_to.id or v_from.status = 'anulada' or v_to.status = 'anulada' then
    raise exception 'Elige otra compra para usar el saldo' using errcode = 'P0001';
  end if;
  if v_from.supplier_id <> v_to.supplier_id then
    raise exception 'Solo se puede usar el saldo en una compra del mismo proveedor' using errcode = 'P0001';
  end if;
  select -debt_cents into v_credit from public.purchase_balances where id = p_from_purchase_id;
  if coalesce(v_credit, 0) <= 0 then
    raise exception 'Esta compra no tiene saldo a favor' using errcode = 'P0001';
  end if;
  if (v_from.currency = 'USD' or v_to.currency = 'USD') and (p_rate is null or p_rate <= 0) then
    raise exception 'Anota a cuánto estaba el dólar' using errcode = 'P0001';
  end if;

  v_to_amount := case
    when v_from.currency = v_to.currency then v_credit
    when v_from.currency = 'USD' then round(v_credit * p_rate)::int
    else round(v_credit / p_rate)::int
  end;
  v_bob := case when v_from.currency = 'BOB' then v_credit else round(v_credit * p_rate)::bigint end;

  insert into public.purchase_payments (request_id, purchase_id, currency, amount_cents, rate, amount_purchase_cents, amount_bob_cents, kind, note, created_by)
  values (p_request_id, p_from_purchase_id, v_from.currency, -v_credit,
          case when v_from.currency = 'USD' or v_to.currency = 'USD' then p_rate end,
          -v_credit, -v_bob, 'saldo_usado', 'Saldo usado en otra compra', auth.uid())
  returning id into v_out;
  insert into public.purchase_payments (purchase_id, currency, amount_cents, rate, amount_purchase_cents, amount_bob_cents, kind, linked_payment_id, note, created_by)
  values (p_to_purchase_id, v_to.currency, v_to_amount,
          case when v_from.currency = 'USD' or v_to.currency = 'USD' then p_rate end,
          v_to_amount, v_bob, 'saldo_recibido', v_out, 'Saldo a favor de otra compra', auth.uid())
  returning id into v_in;
  update public.purchase_payments set linked_payment_id = v_in where id = v_out;
  perform public.recompute_purchase_costs(p_from_purchase_id);
  perform public.recompute_purchase_costs(p_to_purchase_id);
end;
$$;

revoke execute on function public.admin_record_payment(uuid, uuid, date, text, int, numeric, text, text) from public, anon;
revoke execute on function public.admin_void_payment(uuid) from public, anon;
revoke execute on function public.admin_apply_credit(uuid, uuid, uuid, numeric) from public, anon;
grant execute on function public.admin_record_payment(uuid, uuid, date, text, int, numeric, text, text) to authenticated;
grant execute on function public.admin_void_payment(uuid) to authenticated;
grant execute on function public.admin_apply_credit(uuid, uuid, uuid, numeric) to authenticated;

-- Permisos --------------------------------------------------------------------------------------------------
revoke execute on function public.distribute_cents(bigint, bigint[], uuid[]) from public, anon, authenticated;
revoke execute on function public.purchase_effective_rate(uuid) from public, anon, authenticated;
revoke execute on function public.recompute_purchase_costs(uuid) from public, anon, authenticated;
revoke execute on function public.insert_purchase_lines(uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.check_purchase_header(uuid, text) from public, anon, authenticated;
revoke execute on function public.apply_purchase_stock(uuid, jsonb, text) from public, anon, authenticated;
revoke execute on function public.read_received(uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.check_arrival_values(text, int, numeric) from public, anon, authenticated;
revoke execute on function public.next_free_product_slug(text) from public, anon, authenticated;

revoke execute on function public.admin_create_purchase(uuid, uuid, date, text, text, jsonb) from public, anon;
revoke execute on function public.admin_update_purchase(uuid, uuid, date, text, text, jsonb) from public, anon;
revoke execute on function public.admin_set_purchase_notes(uuid, text, text) from public, anon;
revoke execute on function public.admin_receive_purchase(uuid, jsonb, int, numeric) from public, anon;
revoke execute on function public.admin_correct_arrival(uuid, jsonb, int, numeric) from public, anon;
revoke execute on function public.admin_void_purchase(uuid) from public, anon;
grant execute on function public.admin_create_purchase(uuid, uuid, date, text, text, jsonb) to authenticated;
grant execute on function public.admin_update_purchase(uuid, uuid, date, text, text, jsonb) to authenticated;
grant execute on function public.admin_set_purchase_notes(uuid, text, text) to authenticated;
grant execute on function public.admin_receive_purchase(uuid, jsonb, int, numeric) to authenticated;
grant execute on function public.admin_correct_arrival(uuid, jsonb, int, numeric) to authenticated;
grant execute on function public.admin_void_purchase(uuid) to authenticated;
