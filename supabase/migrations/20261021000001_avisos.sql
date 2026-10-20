-- Avisos (plan 4): cada cambio de estado de un pedido deja un aviso en una cola, en la misma
-- transacción. Una Edge Function ("notify") los envía por Web Push y correo. Si avisar falla,
-- el pedido se guarda igual: la cola nunca lanza errores hacia la compra.

create extension if not exists pg_net with schema extensions;

create table public.notification_outbox (
  id bigint generated always as identity primary key,
  order_id uuid references public.orders (id) on delete cascade,
  kind text not null check (kind in ('pedido_recibido', 'pago_por_revisar', 'nueva_captura', 'pago_confirmado', 'pago_rechazado',
                                     'enviado', 'listo_para_recoger', 'cancelado', 'reembolsado', 'prueba')),
  audience text not null check (audience in ('admins', 'cliente')),
  target_user_id uuid references public.profiles (id) on delete cascade,
  -- Nota del evento en ese momento (motivo del rechazo, "Venció sin pago"…): el pedido puede cambiar después.
  note text,
  created_at timestamptz not null default now(),
  attempts int not null default 0,
  locked_until timestamptz,
  sent_at timestamptz,
  last_error text
);
create index notification_outbox_pending_idx on public.notification_outbox (id) where sent_at is null;
alter table public.notification_outbox enable row level security; -- sin políticas: nadie la lee por la API
revoke all on public.notification_outbox from anon, authenticated;

-- Suscripciones Web Push de cada celular o PC de un administrador ---------------------------------
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;
create policy "push: cada uno ve los suyos" on public.push_subscriptions
  for select to authenticated using (user_id = (select auth.uid()));
create policy "push: un admin registra los suyos" on public.push_subscriptions
  for insert to authenticated with check (user_id = (select auth.uid()) and (select public.is_admin()));
create policy "push: un admin actualiza los suyos" on public.push_subscriptions
  for update to authenticated using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and (select public.is_admin()));
create policy "push: cada uno borra los suyos" on public.push_subscriptions
  for delete to authenticated using (user_id = (select auth.uid()));
revoke all on public.push_subscriptions from anon;

-- Qué cambio deja qué aviso --------------------------------------------------------------------------
create or replace function public.enqueue_order_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_kind text := case
    when new.to_status = 'esperando_pago' and new.from_status is null then 'pedido_recibido'
    when new.to_status = 'en_revision' and new.from_status = 'rechazado' then 'nueva_captura'
    when new.to_status = 'en_revision' then 'pago_por_revisar'
    when new.to_status = 'pagado' then 'pago_confirmado'
    when new.to_status = 'rechazado' then 'pago_rechazado'
    when new.to_status = 'enviado' then 'enviado'
    when new.to_status = 'listo_para_recoger' then 'listo_para_recoger'
    when new.to_status = 'cancelado' and new.actor <> 'cliente' then 'cancelado'
    when new.to_status = 'reembolsado' then 'reembolsado'
  end;
begin
  if v_kind is not null then
    insert into public.notification_outbox (order_id, kind, audience, note)
    values (new.order_id, v_kind, case when v_kind in ('pago_por_revisar', 'nueva_captura') then 'admins' else 'cliente' end, new.note);
  end if;
  return new;
exception when others then
  raise warning 'aviso no encolado para el pedido %: %', new.order_id, sqlerrm;
  return new;
end;
$$;

create trigger order_events_enqueue
  after insert on public.order_events
  for each row execute function public.enqueue_order_notification();

-- Despertar al notificador (URL y secreto en Vault; sin ellos no hace nada) ----------------------------
create or replace function public.wake_notifier()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'notify_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'notify_secret';
  if v_url is null or v_secret is null then
    return;
  end if;
  perform net.http_post(
    url := v_url,
    body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_secret),
    timeout_milliseconds := 5000
  );
exception when others then
  raise warning 'no se pudo despertar al notificador: %', sqlerrm;
end;
$$;
revoke execute on function public.wake_notifier() from public, anon, authenticated;

create or replace function public.outbox_wake()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.wake_notifier();
  return null;
end;
$$;

create trigger notification_outbox_wake
  after insert on public.notification_outbox
  for each statement execute function public.outbox_wake();

-- Reintento: cada 5 minutos, si quedó algo pendiente.
select cron.schedule('reintentar-avisos', '*/5 * * * *',
  $$select public.wake_notifier() where exists (select 1 from public.notification_outbox where sent_at is null and attempts < 5)$$);

-- Tomar y cerrar avisos (solo la Edge Function, con la clave de servicio) -----------------------------
create or replace function public.claim_notifications(p_limit int default 20)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  with picked as (
    select n.id from public.notification_outbox n
    where n.sent_at is null and n.attempts < 5 and (n.locked_until is null or n.locked_until < now())
    order by n.id
    limit greatest(coalesce(p_limit, 20), 1)
    for update skip locked
  ),
  claimed as (
    update public.notification_outbox n
    set attempts = n.attempts + 1, locked_until = now() + interval '5 minutes'
    from picked where n.id = picked.id
    returning n.*
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', c.id,
    'kind', c.kind,
    'audience', c.audience,
    'targetUserId', c.target_user_id,
    'order', case when o.id is null then null else jsonb_build_object(
      'id', o.id,
      'number', o.number,
      'totalCents', o.total_cents,
      'subtotalCents', o.subtotal_cents,
      'deliveryFeeCents', o.delivery_fee_cents,
      'deliveryMethod', o.delivery_method,
      'zoneName', z.name,
      'city', o.city,
      'department', o.department,
      'rejectionReason', case when c.kind = 'pago_rechazado' then coalesce(c.note, o.rejection_reason) else o.rejection_reason end,
      'shippingAgency', o.shipping_agency,
      'trackingCode', o.tracking_code,
      'statusChangedAt', o.status_changed_at,
      'note', c.note
    ) end,
    'customer', case when o.id is null then null else jsonb_build_object(
      'email', u.email,
      'name', coalesce(nullif(p.full_name, ''), o.recipient_name)
    ) end,
    'admins', (select coalesce(jsonb_agg(jsonb_build_object('userId', ap.id, 'email', au.email) order by ap.created_at), '[]'::jsonb)
               from public.profiles ap join auth.users au on au.id = ap.id where ap.role = 'admin'),
    'store', (select jsonb_build_object('name', s.store_name, 'address', s.address, 'pickupHours', s.pickup_hours, 'whatsappPhone', s.whatsapp_phone)
              from public.store_settings s limit 1)
  ) order by c.id), '[]'::jsonb)
  into v_result
  from claimed c
  left join public.orders o on o.id = c.order_id
  left join public.delivery_zones z on z.id = o.zone_id
  left join public.profiles p on p.id = o.customer_id
  left join auth.users u on u.id = o.customer_id;
  return v_result;
end;
$$;

create or replace function public.finish_notification(p_id bigint, p_error text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.notification_outbox n
  set sent_at = case when p_error is null then now() end,
      last_error = coalesce(left(p_error, 500), n.last_error),
      -- Tras un error espera 1 minuto por intento (si no, la misma vuelta gastaría los 5 intentos).
      locked_until = case when p_error is null then n.locked_until else now() + interval '1 minute' * n.attempts end
  where n.id = p_id;
$$;

revoke execute on function public.claim_notifications(int) from public, anon, authenticated;
revoke execute on function public.finish_notification(bigint, text) from public, anon, authenticated;
grant execute on function public.claim_notifications(int) to service_role;
grant execute on function public.finish_notification(bigint, text) to service_role;

-- Aviso de prueba para el admin que lo pide ------------------------------------------------------------
create or replace function public.admin_send_test_push()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_admin();
  insert into public.notification_outbox (kind, audience, target_user_id) values ('prueba', 'admins', auth.uid());
end;
$$;
revoke execute on function public.admin_send_test_push() from public, anon;
grant execute on function public.admin_send_test_push() to authenticated;
