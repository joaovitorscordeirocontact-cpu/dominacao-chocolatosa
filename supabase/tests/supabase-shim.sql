-- SOMENTE PARA TESTES LOCAIS. Imita o mínimo de um projeto Supabase para que a
-- migração rode num PostgreSQL comum: papéis, auth.uid() a partir do JWT,
-- realtime.messages/send/topic e os grants padrão do schema public.
-- NUNCA aplique este arquivo num projeto Supabase.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;

grant usage on schema public to anon, authenticated, service_role;
-- O Supabase concede EXECUTE em funções novas de public: a migração precisa revogar.
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;

create schema auth;
create function auth.jwt() returns jsonb language sql stable as
  $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
create function auth.uid() returns uuid language sql stable as
  $$ select nullif(auth.jwt() ->> 'sub', '')::uuid $$;
grant usage on schema auth to anon, authenticated, service_role;

create schema realtime;
create table realtime.messages (
  id          uuid not null default gen_random_uuid(),
  topic       text not null,
  extension   text not null default 'broadcast',
  event       text,
  payload     jsonb,
  private     boolean not null default false,
  inserted_at timestamptz not null default now()
);
alter table realtime.messages enable row level security;
create function realtime.topic() returns text language sql stable as
  $$ select nullif(current_setting('realtime.topic', true), '') $$;
create function realtime.send(payload jsonb, event text, topic text, private boolean default true)
returns void language plpgsql security definer as $$
begin
  insert into realtime.messages (topic, event, payload, private) values (send.topic, send.event, send.payload, send.private);
  perform pg_notify('realtime_shim', json_build_object(
    'topic', send.topic, 'event', send.event, 'payload', send.payload, 'private', send.private)::text);
end $$;
grant usage on schema realtime to anon, authenticated, service_role;
grant select, insert on realtime.messages to anon, authenticated;
grant execute on function realtime.topic() to anon, authenticated;
