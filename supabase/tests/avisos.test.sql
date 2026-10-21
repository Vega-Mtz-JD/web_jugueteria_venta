-- Cola de avisos: qué cambio de estado deja qué aviso, y cómo los toma el notificador (plan 4, tarea 1).
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

delete from public.orders;
delete from public.notification_outbox;
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000ad', 'admin@test.bo'),
  ('00000000-0000-0000-0000-0000000000c1', 'cliente@test.bo');
update public.profiles set role = 'customer';
update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-0000000000ad';
update public.profiles set full_name = 'Ana Cliente' where id = '00000000-0000-0000-0000-0000000000c1';
insert into public.categories (id, name, slug) values ('00000000-0000-0000-0000-0000000000ca', 'Test', 't-cat');
insert into public.products (id, name, slug, category_id, price_cents, stock) values
  ('00000000-0000-0000-0000-0000000000f1', 'Juego', 't-av1', '00000000-0000-0000-0000-0000000000ca', 1000, 20);

create function pg_temp.as_user(u text) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
end $$;
create function pg_temp.as_role(r text) returns void language plpgsql as $$
begin
  perform set_config('role', r, true);
  perform set_config('request.jwt.claims', json_build_object('role', r)::text, true);
end $$;
create function pg_temp.pedido(k text) returns void language plpgsql as $$
begin
  perform pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
  perform set_config(k, (select order_id::text from public.create_order(gen_random_uuid(),
    '[{"product_id":"00000000-0000-0000-0000-0000000000f1","quantity":1}]',
    '{"method":"recojo","recipient_name":"Ana","phone":"71234567"}', '{"requested":false}')), true);
end $$;
create function pg_temp.captura(k text, n int) returns void language plpgsql as $$
declare p text := '00000000-0000-0000-0000-0000000000c1/' || current_setting(k) || '/' || n || '.webp';
begin
  perform pg_temp.as_role('postgres');
  insert into storage.objects (bucket_id, name) values ('payment-proofs', p);
  perform pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
  perform public.submit_payment_proof(current_setting(k)::uuid, p);
end $$;
create function pg_temp.mover(k text, desde text, hacia text, motivo text default null) returns void language sql as $$
  select public.admin_set_order_status(current_setting(k)::uuid, desde::public.order_status, hacia::public.order_status, motivo, 'Trans Copacabana', 'G-1', null)
$$;
create function pg_temp.kinds(k text) returns text language sql as $$
  select string_agg(kind || '/' || audience, ',' order by id) from public.notification_outbox where order_id = current_setting(k)::uuid
$$;

-- Qué cambio deja qué aviso -------------------------------------------------------------------------------
select pg_temp.pedido('t.o1');
select pg_temp.as_role('postgres');
select is(pg_temp.kinds('t.o1'), 'pedido_recibido/cliente', 'un pedido nuevo avisa al comprador');
select pg_temp.captura('t.o1', 1);
select pg_temp.as_user('00000000-0000-0000-0000-0000000000ad');
select pg_temp.mover('t.o1', 'en_revision', 'rechazado', 'Monto incorrecto');
select pg_temp.captura('t.o1', 2);
select pg_temp.as_user('00000000-0000-0000-0000-0000000000ad');
select pg_temp.mover('t.o1', 'en_revision', 'pagado');
select pg_temp.mover('t.o1', 'pagado', 'listo_para_recoger');
select pg_temp.mover('t.o1', 'listo_para_recoger', 'entregado');
select pg_temp.as_role('postgres');
select is(pg_temp.kinds('t.o1'),
  'pedido_recibido/cliente,pago_por_revisar/admins,pago_rechazado/cliente,nueva_captura/admins,pago_confirmado/cliente,listo_para_recoger/cliente',
  'captura, rechazo, nueva captura, pago y listo avisan; entregado no');

select pg_temp.pedido('t.o2');
select pg_temp.captura('t.o2', 1);
select pg_temp.as_user('00000000-0000-0000-0000-0000000000ad');
select pg_temp.mover('t.o2', 'en_revision', 'pagado');
update public.orders set delivery_method = 'envio_ciudad' where id = current_setting('t.o2')::uuid;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000ad');
select pg_temp.mover('t.o2', 'pagado', 'enviado');
select pg_temp.mover('t.o2', 'enviado', 'reembolsado');
select pg_temp.as_role('postgres');
select is(pg_temp.kinds('t.o2'), 'pedido_recibido/cliente,pago_por_revisar/admins,pago_confirmado/cliente,enviado/cliente,reembolsado/cliente', 'enviado y reembolsado avisan');

select pg_temp.pedido('t.o3');
select public.cancel_order_by_customer(current_setting('t.o3')::uuid);
select pg_temp.as_role('postgres');
select is(pg_temp.kinds('t.o3'), 'pedido_recibido/cliente', 'si cancela el propio comprador no hay correo');

select pg_temp.pedido('t.o4');
select pg_temp.as_role('postgres');
update public.orders set status_changed_at = now() - interval '2 hours' where id = current_setting('t.o4')::uuid;
select public.expire_orders();
select is(pg_temp.kinds('t.o4'), 'pedido_recibido/cliente,cancelado/cliente', 'el vencimiento automático avisa al comprador');

-- El notificador tiene tiempo para un lote real de correos (Gmail: 1–3 s por correo) ------------------------
select pg_temp.as_role('postgres');
select public.wake_notifier();
select is((select timeout_milliseconds from net.http_request_queue order by id desc limit 1), 60000, 'pg_net espera hasta 60 s a la función');

-- Avisos atrasados (la función estuvo caída): no se manda «paga en 60 minutos» a un pedido viejo -------------
select pg_temp.pedido('t.o6');
select pg_temp.as_role('postgres');
update public.notification_outbox set created_at = now() - interval '2 hours' where order_id = current_setting('t.o6')::uuid;
insert into public.notification_outbox (order_id, kind, audience, created_at)
  values (current_setting('t.o6')::uuid, 'pago_confirmado', 'cliente', now() - interval '25 hours');
select pg_temp.as_role('service_role');
select is((select count(*)::int from jsonb_array_elements(public.claim_notifications(50)) e where e -> 'order' ->> 'id' = current_setting('t.o6')),
  0, 'los avisos atrasados no se envían');
select pg_temp.as_role('postgres');
select is((select count(*)::int from public.notification_outbox where order_id = current_setting('t.o6')::uuid and sent_at is not null and last_error like 'Omitido%'),
  2, 'quedan marcados como omitidos, con el motivo');
update public.notification_outbox set attempts = 0, locked_until = null where sent_at is null; -- devolver lo que tomó este claim

-- Sin secretos en Vault (o sin función) el pedido se crea igual ----------------------------------------------
delete from vault.secrets where name in ('notify_url', 'notify_secret');
select lives_ok($$select pg_temp.pedido('t.o5')$$, 'sin notificador configurado el pedido se crea igual');

-- El notificador toma cada aviso una vez ------------------------------------------------------------------------
select pg_temp.as_role('postgres');
delete from public.notification_outbox where order_id <> current_setting('t.o1')::uuid;
select pg_temp.as_role('service_role');
select set_config('t.claim', public.claim_notifications(10)::text, true);
select is(jsonb_array_length(current_setting('t.claim')::jsonb), 6, 'toma los 6 avisos pendientes');
select is(current_setting('t.claim')::jsonb -> 0 -> 'order' ->> 'number', (select number::text from public.orders where id = current_setting('t.o1')::uuid), 'trae el número del pedido');
select is(current_setting('t.claim')::jsonb -> 0 -> 'customer' ->> 'email', 'cliente@test.bo', 'trae el correo del comprador');
select is(current_setting('t.claim')::jsonb -> 0 -> 'admins' -> 0 ->> 'email', 'admin@test.bo', 'trae los correos de los admins');
select is((current_setting('t.claim')::jsonb -> 2 -> 'order' ->> 'rejectionReason'), 'Monto incorrecto', 'trae el motivo del rechazo');
select is(public.claim_notifications(10), '[]'::jsonb, 'un segundo notificador a la vez no los vuelve a tomar');
select public.finish_notification((current_setting('t.claim')::jsonb -> 0 ->> 'id')::bigint, null);
select pg_temp.as_role('postgres');
select isnt((select sent_at from public.notification_outbox where id = (current_setting('t.claim')::jsonb -> 0 ->> 'id')::bigint), null, 'enviado queda marcado');

-- Un aviso que falla se reintenta hasta 5 veces
select set_config('t.fail', (current_setting('t.claim')::jsonb -> 1 ->> 'id'), true);
select pg_temp.as_role('service_role');
select public.finish_notification(current_setting('t.fail')::bigint, '535 credenciales');
select pg_temp.as_role('postgres');
select is((select last_error from public.notification_outbox where id = current_setting('t.fail')::bigint), '535 credenciales', 'el error queda guardado');
select ok((select locked_until > now() + interval '30 seconds' from public.notification_outbox where id = current_setting('t.fail')::bigint), 'espera un rato antes de reintentar (no en la misma vuelta)');
select pg_temp.as_role('service_role');
select is((select count(*)::int from jsonb_array_elements(public.claim_notifications(10)) e where (e ->> 'id')::bigint = current_setting('t.fail')::bigint), 0, 'el notificador no lo vuelve a tomar enseguida');
select pg_temp.as_role('postgres');
update public.notification_outbox set locked_until = now() - interval '1 second' where id = current_setting('t.fail')::bigint;
update public.notification_outbox set attempts = 5 where id = current_setting('t.fail')::bigint;
select pg_temp.as_role('service_role');
select is((select count(*)::int from jsonb_array_elements(public.claim_notifications(10)) e where (e ->> 'id')::bigint = current_setting('t.fail')::bigint), 0, 'tras 5 intentos no se vuelve a intentar');

-- Aviso de prueba
select pg_temp.as_user('00000000-0000-0000-0000-0000000000ad');
select lives_ok($$select public.admin_send_test_push()$$, 'el admin pide un aviso de prueba');
select pg_temp.as_role('postgres');
select is((select kind || '/' || target_user_id from public.notification_outbox where kind = 'prueba'), 'prueba/00000000-0000-0000-0000-0000000000ad', 'la prueba va solo a ese admin');

-- Seguridad ------------------------------------------------------------------------------------------------------
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
select throws_ok($$select count(*) from public.notification_outbox$$, '42501', null, 'un cliente no ve la cola');
select throws_ok($$select public.claim_notifications(10)$$, '42501', null, 'un cliente no toma avisos');
select throws_ok($$select public.finish_notification(1, null)$$, '42501', null, 'un cliente no marca avisos');
select throws_ok($$select public.admin_send_test_push()$$, '42501', null, 'un cliente no pide avisos de prueba');
select throws_ok($$insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) values ('00000000-0000-0000-0000-0000000000c1', 'https://push.example/c', 'k', 'a')$$,
  '42501', null, 'un cliente no registra avisos push');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000ad');
select lives_ok($$insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) values ('00000000-0000-0000-0000-0000000000ad', 'https://push.example/a', 'k', 'a')$$, 'el admin registra su celular');
select throws_ok($$insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) values ('00000000-0000-0000-0000-0000000000c1', 'https://push.example/x', 'k', 'a')$$,
  '42501', null, 'el admin no registra el celular de otro');
select is((select count(*)::int from public.push_subscriptions), 1, 'el admin ve solo los suyos');

select * from finish();
rollback;
