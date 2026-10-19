-- Pedidos, entrega y pagos: estructura y reglas de seguridad (RLS).
begin;
create extension if not exists pgtap with schema extensions;
select plan(23);

-- Usuarios y datos de la prueba (como postgres) -----------------------------
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.bo'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.bo'),
  ('00000000-0000-0000-0000-0000000000ad', 'admin@test.bo');
update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-0000000000ad';

insert into public.orders (id, request_id, customer_id, delivery_method, recipient_name, phone, subtotal_cents, delivery_fee_cents, total_cents)
values ('00000000-0000-0000-0000-0000000000f1', gen_random_uuid(), '00000000-0000-0000-0000-00000000000a', 'recojo', 'Ana', '71234567', 4500, 0, 4500);
insert into public.order_items (order_id, product_id, product_name, unit_price_cents, quantity)
select '00000000-0000-0000-0000-0000000000f1', id, name, price_cents, 1 from public.products where slug = 'uno';
insert into public.order_events (order_id, to_status, actor) values ('00000000-0000-0000-0000-0000000000f1', 'esperando_pago', 'cliente');
update public.delivery_zones set is_active = false where name = 'Achumani';

-- Estructura ------------------------------------------------------------------
select has_type('public', 'order_status', 'existe el enum order_status');
select ok(
  (select bool_and(relrowsecurity) from pg_class where oid in (
    'public.orders'::regclass, 'public.order_items'::regclass, 'public.order_events'::regclass,
    'public.payment_proofs'::regclass, 'public.delivery_zones'::regclass, 'public.meeting_points'::regclass,
    'public.payment_methods'::regclass)),
  'RLS activo en las tablas de pedidos y entrega'
);
select is((select public from storage.buckets where id = 'payment-proofs'), false, 'el bucket de capturas es privado');
select is((select delivery_fee_home_cents from public.store_settings), 1500, 'tarifa a domicilio por defecto Bs 15');
select is((select allowed_mime_types from storage.buckets where id = 'payment-proofs'), array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'], 'las capturas solo aceptan fotos (no SVG)');

-- Visitante sin cuenta --------------------------------------------------------
set local role anon;
select is((select count(*)::int from public.delivery_zones), 9, 'anon ve las zonas activas (10 menos 1 inactiva)');
select is((select count(*)::int from public.meeting_points), 5, 'anon ve 5 puntos de encuentro');
select is((select count(*)::int from public.payment_methods), 3, 'anon ve 3 billeteras QR');
select is((select count(*)::int from public.orders), 0, 'anon no ve pedidos');
reset role;

-- Cliente A ---------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';
select is((select count(*)::int from public.orders), 1, 'A ve su pedido');
select is((select count(*)::int from public.order_items), 1, 'A ve sus items');
select is((select count(*)::int from public.order_events), 1, 'A ve los eventos de su pedido');
select throws_ok(
  $$insert into public.orders (request_id, customer_id, delivery_method, recipient_name, phone, subtotal_cents, delivery_fee_cents, total_cents)
    values (gen_random_uuid(), '00000000-0000-0000-0000-00000000000a', 'recojo', 'x', '71234567', 1, 0, 1)$$,
  '42501', null, 'A no puede crear pedidos directamente'
);
select is_empty(
  $$update public.orders set status = 'pagado' where id = '00000000-0000-0000-0000-0000000000f1' returning 1$$,
  'A no puede cambiar el estado de su pedido'
);
select lives_ok(
  $$insert into storage.objects (bucket_id, name) values ('payment-proofs', '00000000-0000-0000-0000-00000000000a/00000000-0000-0000-0000-0000000000f1/1.webp')$$,
  'A sube una captura a la carpeta de su pedido'
);
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('payment-proofs', '00000000-0000-0000-0000-00000000000b/00000000-0000-0000-0000-0000000000f1/2.webp')$$,
  '42501', null, 'A no puede subir a la carpeta de otro usuario'
);
reset role;

-- Cliente B ---------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000000b", "role": "authenticated"}';
select is((select count(*)::int from public.orders), 0, 'B no ve el pedido de A');
select is((select count(*)::int from public.order_items), 0, 'B no ve los items de A');
select is((select count(*)::int from storage.objects where bucket_id = 'payment-proofs'), 0, 'B no ve la captura de A');
reset role;

-- Pedido pagado: ya no se pueden subir capturas -------------------------------
update public.orders set status = 'pagado' where id = '00000000-0000-0000-0000-0000000000f1';
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('payment-proofs', '00000000-0000-0000-0000-00000000000a/00000000-0000-0000-0000-0000000000f1/3.webp')$$,
  '42501', null, 'con el pedido pagado no se suben más capturas'
);
reset role;

-- Admin ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000ad", "role": "authenticated"}';
select is((select count(*)::int from storage.objects where bucket_id = 'payment-proofs' and name like '00000000-0000-0000-0000-00000000000a/%'), 1, 'admin ve la captura de A');
reset role;

-- Restricciones -----------------------------------------------------------------
select throws_ok(
  $$insert into public.orders (request_id, customer_id, delivery_method, recipient_name, phone, subtotal_cents, delivery_fee_cents, total_cents)
    values (gen_random_uuid(), '00000000-0000-0000-0000-00000000000a', 'recojo', 'x', '71234567', 100, 50, 999)$$,
  '23514', null, 'el total debe ser subtotal + envío'
);
select throws_ok(
  $$insert into public.orders (request_id, customer_id, delivery_method, recipient_name, phone, subtotal_cents, delivery_fee_cents, total_cents, invoice_requested)
    values (gen_random_uuid(), '00000000-0000-0000-0000-00000000000a', 'recojo', 'x', '71234567', 100, 0, 100, true)$$,
  '23514', null, 'si pide factura, exige NIT y razón social'
);

select * from finish();
rollback;
