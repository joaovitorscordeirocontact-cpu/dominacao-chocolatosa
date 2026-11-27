-- =============================================================================
-- Dominação Chocolatosa — banco, permissões e regras autoritativas
-- =============================================================================
-- Isolamento: tudo do jogo vive no schema `dominacao`, que NÃO é exposto pela
-- Data API. Em `public` há apenas funções `dc_*` (SECURITY INVOKER), a porta de
-- entrada do aplicativo. Nada de outros aplicativos é alterado.
--
-- Segredos (conteúdo de maletas e espionagens) ficam em tabelas SEM nenhum
-- grant para os papéis do cliente. RLS fica ligado em todas as tabelas.
--
-- Concorrência: toda mudança trava a linha da sala (FOR UPDATE), então os
-- comandos de uma mesma sala são executados um de cada vez.
-- =============================================================================

create schema if not exists dominacao;
revoke all on schema dominacao from public;
grant usage on schema dominacao to authenticated;

-- -----------------------------------------------------------------------------
-- Tabelas
-- -----------------------------------------------------------------------------

create table dominacao.rooms (
  id               uuid primary key default gen_random_uuid(),
  code             text not null unique check (code ~ '^[A-HJ-NP-Z2-9]{6}$'),
  status           text not null default 'lobby' check (status in ('lobby', 'factories', 'playing', 'ended')),
  stage            text check (stage in
                     ('representatives', 'battle', 'preparation', 'picking', 'interference', 'review', 'paid')),
  round_number     int not null default 0 check (round_number between 0 and 15),
  total_chocolates int check (total_chocolates between 0 and 100000),
  initial_per_team int check (initial_per_team between 0 and 100000),
  bank             int check (bank >= 0),
  entries_open     boolean not null default true,
  revision         bigint not null default 1,
  created_by       uuid not null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint stage_only_while_playing check ((status = 'playing') = (stage is not null))
);
create index rooms_created_by_idx on dominacao.rooms (created_by, created_at);

create table dominacao.teams (
  id                 uuid primary key default gen_random_uuid(),
  room_id            uuid not null references dominacao.rooms (id) on delete cascade,
  slot               int not null check (slot between 1 and 4),
  factory_name       text not null default '' check (char_length(factory_name) <= 24),
  factory_model      text not null default 'engrenagem' check (factory_model in
                       ('engrenagem', 'castelo', 'palacio-dourado', 'rosquinha', 'chale',
                        'cupula', 'torre-torta', 'realeza', 'cogumelo', 'relogio')),
  factory_background text not null default 'palco-rosa' check (factory_background in
                       ('noite-cacau', 'palco-rosa', 'raios-dourados', 'rio-de-calda', 'festa-uva')),
  ready              boolean not null default false,
  balance            int not null default 0 check (balance >= 0),
  unique (room_id, slot),
  unique (room_id, id)
);

create table dominacao.members (
  id         uuid primary key default gen_random_uuid(),
  room_id    uuid not null references dominacao.rooms (id) on delete cascade,
  -- Usuário (anônimo) do Supabase Auth. Sem chave estrangeira de propósito:
  -- apagar usuários antigos não pode apagar o histórico de uma partida.
  user_id    uuid not null,
  kind       text not null check (kind in ('moderator', 'player', 'screen')),
  name       text not null default '' check (char_length(name) <= 18),
  look       jsonb not null default '{"color":"rosa","hairColor":"castanho","accessories":{}}',
  team_id    uuid,
  is_captain boolean not null default false,
  battles    int not null default 0 check (battles >= 0),
  joined_at  timestamptz not null default clock_timestamp(),
  unique (room_id, user_id),
  unique (room_id, id),
  foreign key (room_id, team_id) references dominacao.teams (room_id, id),
  check (team_id is null or kind = 'player'),
  check (not is_captain or team_id is not null)
);
create unique index one_captain_per_team on dominacao.members (team_id) where is_captain;
create index members_user_idx on dominacao.members (user_id);

create table dominacao.rounds (
  room_id    uuid not null references dominacao.rooms (id) on delete cascade,
  number     int not null check (number between 1 and 15),
  started_at timestamptz not null default now(),
  paid_at    timestamptz,
  primary key (room_id, number)
);

create table dominacao.round_teams (
  room_id           uuid not null,
  round_number      int not null,
  team_id           uuid not null,
  start_balance     int not null check (start_balance >= 0),
  representative_id uuid,
  battle_place      int check (battle_place between 1 and 4),
  play_position     int check (play_position between 1 and 4),
  case_number       int check (case_number between 1 and 60),
  pick_seq          int,
  blocked           boolean not null default false,
  bonus             int not null default 0 check (bonus >= 0),
  primary key (room_id, round_number, team_id),
  foreign key (room_id, round_number) references dominacao.rounds (room_id, number) on delete cascade,
  foreign key (room_id, team_id) references dominacao.teams (room_id, id) on delete cascade,
  foreign key (room_id, representative_id) references dominacao.members (room_id, id),
  -- Duas fábricas nunca ficam com a mesma maleta. Adiável para permitir trocas.
  unique (room_id, round_number, case_number) deferrable initially deferred
);

-- Dados PÚBLICOS das maletas: o conteúdo só aparece aqui depois de revelado.
create table dominacao.cases (
  room_id         uuid not null references dominacao.rooms (id) on delete cascade,
  number          int not null check (number between 1 and 60),
  state           text not null default 'available' check (state in ('available', 'chosen', 'opened')),
  opened_round    int,
  revealed_kind   text check (revealed_kind in ('gain', 'loss', 'loss_third', 'zero')),
  revealed_amount int,
  primary key (room_id, number),
  check ((state = 'opened') = (revealed_kind is not null)),
  check ((state = 'opened') = (revealed_amount is not null))
);

-- SEGREDO: conteúdo de cada maleta, fixado no início da partida.
create table dominacao.case_contents (
  room_id uuid not null,
  number  int not null,
  kind    text not null check (kind in ('gain', 'loss', 'loss_third', 'zero')),
  amount  int not null check (amount >= 0),
  primary key (room_id, number),
  foreign key (room_id, number) references dominacao.cases (room_id, number) on delete cascade
);

create table dominacao.power_uses (
  id             uuid primary key default gen_random_uuid(),
  seq            bigint generated always as identity,
  room_id        uuid not null,
  round_number   int not null,
  team_id        uuid not null,
  category       text not null check (category in ('combo', 'special')),
  power          text not null check (power in
                   ('blue', 'yellow', 'green', 'red', 'invert', 'joker', 'block', 'plus2', 'plus4')),
  target_team_id uuid,
  -- Estado anterior, usado apenas para desfazer um especial registrado por engano.
  previous       jsonb,
  created_at     timestamptz not null default now(),
  foreign key (room_id, round_number, team_id)
    references dominacao.round_teams (room_id, round_number, team_id) on delete cascade,
  foreign key (room_id, target_team_id) references dominacao.teams (room_id, id),
  check ((category = 'combo') = (power in ('blue', 'yellow', 'green', 'red'))),
  -- Uma combinação e uma carta especial por equipe por rodada.
  unique (room_id, round_number, team_id, category)
);

-- SEGREDO: autorizações de espionagem (guardam qual maleta foi vista).
create table dominacao.spy_grants (
  id           uuid primary key default gen_random_uuid(),
  room_id      uuid not null,
  round_number int not null,
  team_id      uuid not null,
  member_id    uuid not null,
  power_use_id uuid not null unique references dominacao.power_uses (id) on delete cascade,
  status       text not null default 'active' check (status in ('active', 'used', 'expired')),
  case_number  int check (case_number between 1 and 60),
  used_at      timestamptz,
  foreign key (room_id, member_id) references dominacao.members (room_id, id),
  foreign key (room_id, team_id) references dominacao.teams (room_id, id) on delete cascade,
  check ((status = 'used') = (case_number is not null))
);
create index spy_grants_member_idx on dominacao.spy_grants (room_id, member_id);

create table dominacao.payments (
  room_id       uuid not null,
  round_number  int not null,
  team_id       uuid not null,
  start_balance int not null,
  case_number   int not null,
  case_kind     text not null,
  case_amount   int not null,
  delta         int not null,
  effective     int not null,
  blocked       boolean not null,
  bonus         int not null,
  final_balance int not null check (final_balance >= 0),
  paid_at       timestamptz not null default now(),
  -- Garante que cada fábrica recebe uma única vez por rodada.
  primary key (room_id, round_number, team_id),
  foreign key (room_id, team_id) references dominacao.teams (room_id, id) on delete cascade
);

-- Histórico público da sala. NUNCA recebe conteúdo secreto.
create table dominacao.events (
  id           bigint generated always as identity primary key,
  room_id      uuid not null references dominacao.rooms (id) on delete cascade,
  revision     bigint not null,
  round_number int not null,
  type         text not null,
  actor_id     uuid,
  data         jsonb not null default '{}',
  created_at   timestamptz not null default now()
);
create index events_room_idx on dominacao.events (room_id, id desc);

-- Idempotência: o mesmo comando repetido devolve o mesmo resultado, sem efeito.
create table dominacao.commands (
  user_id    uuid not null,
  command_id uuid not null,
  room_id    uuid not null references dominacao.rooms (id) on delete cascade,
  type       text not null,
  result     jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, command_id)
);
create index commands_room_idx on dominacao.commands (room_id);

-- Freio simples contra adivinhação de códigos de sala.
create table dominacao.join_failures (
  user_id uuid not null,
  at      timestamptz not null default now()
);
create index join_failures_idx on dominacao.join_failures (user_id, at);

-- -----------------------------------------------------------------------------
-- RLS e grants
-- -----------------------------------------------------------------------------

alter table dominacao.rooms         enable row level security;
alter table dominacao.teams         enable row level security;
alter table dominacao.members       enable row level security;
alter table dominacao.rounds        enable row level security;
alter table dominacao.round_teams   enable row level security;
alter table dominacao.cases         enable row level security;
alter table dominacao.case_contents enable row level security;
alter table dominacao.power_uses    enable row level security;
alter table dominacao.spy_grants    enable row level security;
alter table dominacao.payments      enable row level security;
alter table dominacao.events        enable row level security;
alter table dominacao.commands      enable row level security;
alter table dominacao.join_failures enable row level security;

revoke all on all tables in schema dominacao from public, anon, authenticated;
revoke all on all sequences in schema dominacao from public, anon, authenticated;

-- Helpers de participação. SECURITY DEFINER para não haver recursão de RLS;
-- só respondem sobre o PRÓPRIO usuário autenticado.
create function dominacao.is_member(p_room uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from dominacao.members m
    where m.room_id = p_room and m.user_id = (select auth.uid())
  );
$$;

create function dominacao.my_member_id(p_room uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select m.id from dominacao.members m
  where m.room_id = p_room and m.user_id = (select auth.uid());
$$;

-- Leitura (somente integrantes da própria sala). Sem políticas de escrita.
create policy rooms_read on dominacao.rooms for select to authenticated
  using (dominacao.is_member(id));
create policy teams_read on dominacao.teams for select to authenticated
  using (dominacao.is_member(room_id));
create policy members_read on dominacao.members for select to authenticated
  using (dominacao.is_member(room_id));
create policy rounds_read on dominacao.rounds for select to authenticated
  using (dominacao.is_member(room_id));
create policy round_teams_read on dominacao.round_teams for select to authenticated
  using (dominacao.is_member(room_id));
create policy cases_read on dominacao.cases for select to authenticated
  using (dominacao.is_member(room_id));
create policy power_uses_read on dominacao.power_uses for select to authenticated
  using (dominacao.is_member(room_id));
create policy payments_read on dominacao.payments for select to authenticated
  using (dominacao.is_member(room_id));
create policy events_read on dominacao.events for select to authenticated
  using (dominacao.is_member(room_id));

-- Colunas: identificadores de autenticação nunca são legíveis.
grant select (id, code, status, stage, round_number, total_chocolates, initial_per_team, bank,
              entries_open, revision, created_at) on dominacao.rooms to authenticated;
grant select (id, room_id, kind, name, look, team_id, is_captain, battles, joined_at)
  on dominacao.members to authenticated;
grant select on dominacao.teams, dominacao.rounds, dominacao.round_teams, dominacao.cases,
  dominacao.payments to authenticated;
grant select (id, seq, room_id, round_number, team_id, category, power, target_team_id)
  on dominacao.power_uses to authenticated;
grant select (id, room_id, revision, round_number, type, data, created_at)
  on dominacao.events to authenticated;
-- case_contents, spy_grants, commands e join_failures: NENHUM grant.

-- -----------------------------------------------------------------------------
-- Regras auxiliares (sem grant: só são chamadas por funções do próprio schema)
-- -----------------------------------------------------------------------------

create function dominacao.fail(p_code text, p_detail jsonb default null) returns void
language plpgsql set search_path = '' as $$
begin
  raise exception using errcode = 'P0001', message = 'dc:' || p_code, detail = coalesce(p_detail::text, '');
end;
$$;

create function dominacao.require_moderator(me dominacao.members) returns void
language plpgsql set search_path = '' as $$
begin
  if me.kind <> 'moderator' then perform dominacao.fail('moderator_only'); end if;
end;
$$;

create function dominacao.require_captain(me dominacao.members) returns void
language plpgsql set search_path = '' as $$
begin
  if me.kind <> 'player' or not me.is_captain or me.team_id is null then
    perform dominacao.fail('captain_only');
  end if;
end;
$$;

create function dominacao.require_status(room dominacao.rooms, variadic p_status text[]) returns void
language plpgsql set search_path = '' as $$
begin
  if not (room.status = any (p_status)) then perform dominacao.fail('wrong_stage'); end if;
end;
$$;

create function dominacao.require_stage(room dominacao.rooms, variadic p_stage text[]) returns void
language plpgsql set search_path = '' as $$
begin
  if room.status <> 'playing' or not (room.stage = any (p_stage)) then
    perform dominacao.fail('wrong_stage');
  end if;
end;
$$;

create function dominacao.arg_uuid(args jsonb, p_key text) returns uuid
language plpgsql immutable set search_path = '' as $$
begin
  return (args ->> p_key)::uuid;
exception when others then
  perform dominacao.fail('bad_arguments');
end;
$$;

create function dominacao.arg_int(args jsonb, p_key text) returns int
language plpgsql immutable set search_path = '' as $$
begin
  if jsonb_typeof(args -> p_key) is distinct from 'number' or (args ->> p_key) !~ '^-?[0-9]{1,9}$' then
    perform dominacao.fail('bad_arguments');
  end if;
  return (args ->> p_key)::int;
end;
$$;

create function dominacao.clean_text(p_value text, p_max int) returns text
language sql immutable set search_path = '' as $$
  select btrim(left(btrim(regexp_replace(regexp_replace(coalesce(p_value, ''), '[[:cntrl:]]', '', 'g'),
                                         '\s+', ' ', 'g')), p_max));
$$;

-- Mantém apenas valores conhecidos; o cliente não grava JSON arbitrário.
create function dominacao.clean_look(p_look jsonb) returns jsonb
language plpgsql immutable set search_path = '' as $$
declare
  look jsonb := case when jsonb_typeof(p_look) = 'object' then p_look else '{}'::jsonb end;
  worn jsonb := case when jsonb_typeof(look -> 'accessories') = 'object' then look -> 'accessories' else '{}'::jsonb end;
  allowed constant jsonb := '{
    "chapeu": ["coroa", "chapeu-chef", "bone", "cartola", "aureola"],
    "cabelo": ["cabelo-curto", "cabelo-cacheado", "cabelo-longo"],
    "olhos": ["oculos-redondos", "oculos-escuros", "monoculo"],
    "pelos": ["bigode", "barba"],
    "traje": ["gravata", "capa"],
    "enfeite": ["laco"]
  }';
  clean jsonb := '{}';
  slot text;
begin
  for slot in select jsonb_object_keys(allowed) loop
    if jsonb_typeof(worn -> slot) = 'string' and (allowed -> slot) ? (worn ->> slot) then
      clean := clean || jsonb_build_object(slot, worn ->> slot);
    end if;
  end loop;
  return jsonb_build_object(
    'color', case when look ->> 'color' in ('azul', 'verde', 'rosa', 'chocolate', 'branco', 'marrom')
                  then look ->> 'color' else 'rosa' end,
    'hairColor', case when look ->> 'hairColor' in ('preto', 'vermelho', 'branco', 'loiro', 'castanho')
                      then look ->> 'hairColor' else 'castanho' end,
    'accessories', clean);
end;
$$;

-- ---------- Economia ----------

-- DISTRIBUIÇÃO DAS 60 MALETAS (constante documentada no README).
-- 30 ganhos, 10 perdas fixas, 8 perdas de um terço e 12 zeros.
-- Valor = piso(verba_de_ganhos × peso / soma_dos_pesos_dos_ganhos).
-- Como a soma dos pisos nunca passa do piso da soma, os ganhos somados nunca
-- ultrapassam a verba.
create function dominacao.case_distribution()
returns table (kind text, weight int, quantity int)
language sql immutable set search_path = '' as $$
  values ('gain', 1, 14), ('gain', 2, 10), ('gain', 4, 5), ('gain', 8, 1),
         ('loss', 1, 6), ('loss', 2, 4),
         ('loss_third', 0, 8),
         ('zero', 0, 12);
$$;

create function dominacao.bonus_reserve() returns int
language sql immutable set search_path = '' as $$ select 8 * 2 + 4 * 4; $$;

create function dominacao.economy(p_total int, p_initial int, p_teams int) returns jsonb
language sql immutable set search_path = '' as $$
  with base as (
    select dominacao.bonus_reserve() as reserve,
           -- Menor verba em que a menor maleta de ganho ainda vale 1 bombom.
           (select sum(weight * quantity)::int from dominacao.case_distribution() where kind = 'gain') as min_budget,
           p_teams * p_initial as initial_total
  )
  select jsonb_build_object(
    'ok', p_total - initial_total - reserve >= min_budget,
    'teams', p_teams,
    'total', p_total,
    'initialPerTeam', p_initial,
    'initialTotal', initial_total,
    'bonusReserve', reserve,
    'gainBudget', p_total - initial_total - reserve,
    'minGainBudget', min_budget,
    'minTotal', initial_total + reserve + min_budget,
    'maxInitialPerTeam', greatest(floor((p_total - reserve - min_budget)::numeric / p_teams)::int, -1))
  from base;
$$;

create function dominacao.generate_cases(p_room uuid, p_budget int) returns void
language plpgsql set search_path = '' as $$
declare
  weight_sum int;
begin
  select sum(d.weight * d.quantity)::int into weight_sum
  from dominacao.case_distribution() d where d.kind = 'gain';

  insert into dominacao.cases (room_id, number)
  select p_room, n from generate_series(1, 60) n;

  -- gen_random_uuid() é um gerador criptográfico: serve de embaralhamento.
  insert into dominacao.case_contents (room_id, number, kind, amount)
  with deck as (
    select d.kind,
           case when d.weight = 0 then 0 else (p_budget::bigint * d.weight / weight_sum)::int end as amount,
           row_number() over (order by gen_random_uuid()) as position
    from dominacao.case_distribution() d, generate_series(1, d.quantity)
  )
  select p_room, position::int, kind, amount from deck;
end;
$$;

-- Resultado de cada fábrica na rodada. Só há resultado depois da revelação,
-- porque lê o conteúdo PÚBLICO (revelado) da maleta que está com a fábrica.
create function dominacao.settlement(p_room uuid, p_round int)
returns table (team_id uuid, start_balance int, case_number int, case_kind text, case_amount int,
               delta int, effective int, blocked boolean, bonus int, final_balance int)
language sql stable set search_path = '' as $$
  with calc as (
    select rt.team_id, rt.start_balance, rt.case_number, c.revealed_kind as case_kind,
           c.revealed_amount as case_amount, rt.blocked, rt.bonus,
           case c.revealed_kind
             when 'gain' then c.revealed_amount
             when 'loss' then -least(c.revealed_amount, rt.start_balance)  -- nunca deixa saldo negativo
             when 'loss_third' then -(rt.start_balance / 3)                -- divisão inteira = piso
             else 0
           end as delta
    from dominacao.round_teams rt
    join dominacao.cases c on c.room_id = rt.room_id and c.number = rt.case_number
    where rt.room_id = p_room and rt.round_number = p_round and c.state = 'opened'
  )
  select team_id, start_balance, case_number, case_kind, case_amount, delta,
         case when blocked and delta < 0 then 0 else delta end,
         blocked, bonus,
         start_balance + case when blocked and delta < 0 then 0 else delta end + bonus
  from calc;
$$;
grant execute on function dominacao.settlement(uuid, int) to authenticated;

-- Situação das espionagens da rodada, SEM número nem conteúdo de maleta.
create function dominacao.spy_status(p_room uuid, p_round int)
returns table (team_id uuid, status text)
language sql stable security definer set search_path = '' as $$
  select g.team_id, g.status from dominacao.spy_grants g
  where g.room_id = p_room and g.round_number = p_round and dominacao.is_member(p_room);
$$;

create function dominacao.new_round(p_room uuid, p_number int) returns void
language sql set search_path = '' as $$
  insert into dominacao.rounds (room_id, number) values (p_room, p_number);
  insert into dominacao.round_teams (room_id, round_number, team_id, start_balance)
  select p_room, p_number, t.id, t.balance from dominacao.teams t where t.room_id = p_room;
$$;

-- Publica no histórico, avança a revisão e avisa os aparelhos. O aviso leva SÓ
-- a revisão: cada aparelho busca o estado que ele próprio tem permissão de ver.
create function dominacao.publish(p_room uuid, p_type text, p_actor uuid, p_data jsonb) returns bigint
language plpgsql set search_path = '' as $$
declare
  new_revision bigint;
  current_round int;
begin
  update dominacao.rooms set revision = revision + 1, updated_at = now()
  where id = p_room returning revision, round_number into new_revision, current_round;

  insert into dominacao.events (room_id, revision, round_number, type, actor_id, data)
  values (p_room, new_revision, current_round, p_type, p_actor, coalesce(p_data, '{}'));

  perform realtime.send(jsonb_build_object('revision', new_revision), 'changed', 'dominacao:' || p_room, true);
  return new_revision;
end;
$$;

-- -----------------------------------------------------------------------------
-- Comandos (um por ação). Retornam os dados públicos do evento.
-- Sem grant: só são alcançados pelo despachante dominacao.run_command.
-- -----------------------------------------------------------------------------

create function dominacao.cmd_set_look(room dominacao.rooms, me dominacao.members, args jsonb) returns jsonb
language plpgsql set search_path = '' as $$
declare
  new_name text := dominacao.clean_text(args ->> 'name', 18);
begin
  if me.kind <> 'player' then perform dominacao.fail('player_only'); end if;
  perform dominacao.require_status(room, 'lobby', 'factories', 'playing');
  if new_name = '' then perform dominacao.fail('name_required'); end if;
  update dominacao.members set name = new_name, look = dominacao.clean_look(args -> 'look') where id = me.id;
  return jsonb_build_object('memberId', me.id);
end;
$$;

create function dominacao.cmd_set_entries(room dominacao.rooms, me dominacao.members, args jsonb) returns jsonb
language plpgsql set search_path = '' as $$
declare
  is_open boolean := coalesce((args ->> 'open') = 'true', false);
begin
  perform dominacao.require_moderator(me);
  perform dominacao.require_status(room, 'lobby', 'factories', 'playing');
  update dominacao.rooms set entries_open = is_open where id = room.id;
  return jsonb_build_object('open', is_open);
end;
$$;

create function dominacao.cmd_remove_member(room dominacao.rooms, me dominacao.members, args jsonb) returns jsonb
language plpgsql set search_path = '' as $$
declare
  target dominacao.members;
begin
  perform dominacao.require_moderator(me);
  select * into target from dominacao.members
  where room_id = room.id and id = dominacao.arg_uuid(args, 'memberId');
  if not found or target.kind = 'moderator' then perform dominacao.fail('member_not_found'); end if;
  -- Quem já está numa equipe só sai refazendo a divisão (antes da partida).
  if target.team_id is not null then perform dominacao.fail('member_in_team'); end if;
  delete from dominacao.members where id = target.id;
  return jsonb_build_object('name', target.name, 'kind', target.kind);
end;
$$;

create function dominacao.cmd_form_teams(room dominacao.rooms, me dominacao.members, args jsonb) returns jsonb
language plpgsql set search_path = '' as $$
declare
  captains uuid[];
  team_ids uuid[] := '{}';
  new_team uuid;
  team_total int;
begin
  perform dominacao.require_moderator(me);
  perform dominacao.require_status(room, 'lobby');
  if jsonb_typeof(args -> 'captainIds') is distinct from 'array' then perform dominacao.fail('bad_arguments'); end if;
  begin
    select array_agg(value::uuid order by ordinality) into captains
    from jsonb_array_elements_text(args -> 'captainIds') with ordinality;
  exception when others then
    perform dominacao.fail('bad_arguments');
  end;
  team_total := coalesce(cardinality(captains), 0);
  if team_total not between 2 and 4 then perform dominacao.fail('team_count'); end if;
  if (select count(distinct c) from unnest(captains) c) <> team_total then
    perform dominacao.fail('captains_must_differ');
  end if;
  if (select count(*) from dominacao.members
      where room_id = room.id and kind = 'player' and id = any (captains)) <> team_total then
    perform dominacao.fail('member_not_found');
  end if;

  for i in 1..team_total loop
    insert into dominacao.teams (room_id, slot) values (room.id, i) returning id into new_team;
    team_ids := team_ids || new_team;
    update dominacao.members set team_id = new_team, is_captain = true where id = captains[i];
  end loop;

  -- Sorteio: embaralha os demais e distribui em rodízio, começando por uma
  -- ordem de equipes também sorteada. A diferença entre equipes é no máximo 1.
  with order_of_teams as (
    select t.id, row_number() over (order by gen_random_uuid()) - 1 as position
    from unnest(team_ids) t(id)
  ), shuffled as (
    select m.id, row_number() over (order by gen_random_uuid()) - 1 as position
    from dominacao.members m
    where m.room_id = room.id and m.kind = 'player' and m.team_id is null
  )
  update dominacao.members m set team_id = o.id
  from shuffled s join order_of_teams o on o.position = s.position % team_total
  where m.id = s.id;

  update dominacao.rooms set status = 'factories', entries_open = false where id = room.id;
  return jsonb_build_object('teams', team_total);
end;
$$;

create function dominacao.cmd_reset_teams(room dominacao.rooms, me dominacao.members, args jsonb) returns jsonb
language plpgsql set search_path = '' as $$
begin
  perform dominacao.require_moderator(me);
  perform dominacao.require_status(room, 'factories');  -- só antes da partida
  update dominacao.members set team_id = null, is_captain = false where room_id = room.id;
  delete from dominacao.teams where room_id = room.id;
  update dominacao.rooms set status = 'lobby', entries_open = true where id = room.id;
  return '{}';
end;
$$;

create function dominacao.cmd_assign_member(room dominacao.rooms, me dominacao.members, args jsonb) returns jsonb
language plpgsql set search_path = '' as $$
declare
  target dominacao.members;
  chosen uuid := dominacao.arg_uuid(args, 'teamId');
  chosen_size int;
  smallest int;
begin
  perform dominacao.require_moderator(me);
  perform dominacao.require_status(room, 'factories', 'playing');
  select * into target from dominacao.members
  where room_id = room.id and id = dominacao.arg_uuid(args, 'memberId') and kind = 'player';
  if not found then perform dominacao.fail('member_not_found'); end if;
  if target.team_id is not null then perform dominacao.fail('member_in_team'); end if;
  if not exists (select 1 from dominacao.teams where room_id = room.id and id = chosen) then
    perform dominacao.fail('team_not_found');
  end if;

  with sizes as (
    select t.id, count(m.id)::int as size from dominacao.teams t
    left join dominacao.members m on m.team_id = t.id
    where t.room_id = room.id group by t.id
  )
  select (select size from sizes where id = chosen), min(size) into chosen_size, smallest from sizes;
  if chosen_size > smallest then perform dominacao.fail('unbalanced_team'); end if;

  update dominacao.members set team_id = chosen where id = target.id;
  return jsonb_build_object('memberId', target.id, 'teamId', chosen);
end;
$$;

create function dominacao.cmd_set_captain(room dominacao.rooms, me dominacao.members, args jsonb) returns jsonb
language plpgsql set search_path = '' as $$
declare
  chosen uuid := dominacao.arg_uuid(args, 'teamId');
  target dominacao.members;
begin
  perform dominacao.require_moderator(me);
  perform dominacao.require_status(room, 'factories', 'playing');
  select * into target from dominacao.members
  where room_id = room.id and id = dominacao.arg_uuid(args, 'memberId') and team_id = chosen;
  if not found then perform dominacao.fail('member_not_found'); end if;
  if target.is_captain then perform dominacao.fail('already_captain'); end if;

  update dominacao.members set is_captain = false where team_id = chosen and is_captain;
  update dominacao.members set is_captain = true where id = target.id;
  -- Uma autorização ainda NÃO usada passa à nova liderança. Uma consulta já
  -- feita continua visível apenas para quem a fez.
  update dominacao.spy_grants set member_id = target.id
  where room_id = room.id and team_id = chosen and status = 'active';
  return jsonb_build_object('teamId', chosen, 'memberId', target.id);
end;
$$;

create function dominacao.cmd_set_factory(room dominacao.rooms, me dominacao.members, args jsonb) returns jsonb
language plpgsql set search_path = '' as $$
declare
  new_name text := dominacao.clean_text(args ->> 'name', 24);
  confirm boolean := coalesce((args ->> 'ready') = 'true', false);
begin
  perform dominacao.require_captain(me);
  perform dominacao.require_status(room, 'factories');
  if confirm and new_name = '' then perform dominacao.fail('factory_name_required'); end if;
  begin
    update dominacao.teams
    set factory_name = new_name, factory_model = args ->> 'model',
        factory_background = args ->> 'background', ready = confirm
    where id = me.team_id;
  exception when check_violation or not_null_violation then
    perform dominacao.fail('bad_arguments');
  end;
  return jsonb_build_object('teamId', me.team_id, 'ready', confirm);
end;
$$;

create function dominacao.cmd_set_economy(room dominacao.rooms, me dominacao.members, args jsonb) returns jsonb
language plpgsql set search_path = '' as $$
declare
  total int := dominacao.arg_int(args, 'total');
  initial int := dominacao.arg_int(args, 'initialPerTeam');
begin
  perform dominacao.require_moderator(me);
  perform dominacao.require_status(room, 'lobby', 'factories');
  if total not between 0 and 100000 or initial not between 0 and 100000 then
    perform dominacao.fail('bad_arguments');
  end if;
  update dominacao.rooms set total_chocolates = total, initial_per_team = initial where id = room.id;
  return jsonb_build_object('total', total, 'initialPerTeam', initial);
end;
$$;

create function dominacao.cmd_start_match(room dominacao.rooms, me dominacao.members, args jsonb) returns jsonb
language plpgsql set search_path = '' as $$
declare
  team_total int;
  plan jsonb;
begin
  perform dominacao.require_moderator(me);
  perform dominacao.require_status(room, 'factories');
  if room.total_chocolates is null then perform dominacao.fail('economy_missing'); end if;
  select count(*) into team_total from dominacao.teams where room_id = room.id;
  if exists (select 1 from dominacao.teams where room_id = room.id and not ready) then
    perform dominacao.fail('factories_not_ready');
  end if;
  plan := dominacao.economy(room.total_chocolates, room.initial_per_team, team_total);
  if not (plan ->> 'ok')::boolean then perform dominacao.fail('economy_does_not_fit', plan); end if;

  perform dominacao.generate_cases(room.id, (plan ->> 'gainBudget')::int);
  update dominacao.teams set balance = room.initial_per_team where room_id = room.id;
  update dominacao.rooms
  set status = 'playing', stage = 'representatives', round_number = 1,
      bank = room.total_chocolates - team_total * room.initial_per_team
  where id = room.id;
  perform dominacao.new_round(room.id, 1);
  return jsonb_build_object('teams', team_total);
end;
$$;

create function dominacao.cmd_select_representative(room dominacao.rooms, me dominacao.members, args jsonb)
returns jsonb language plpgsql set search_path = '' as $$
declare
  chosen uuid := dominacao.arg_uuid(args, 'memberId');
begin
  perform dominacao.require_captain(me);
  perform dominacao.require_stage(room, 'representatives');
  if not exists (select 1 from dominacao.members where id = chosen and team_id = me.team_id) then
    perform dominacao.fail('member_not_in_team');
  end if;
  update dominacao.round_teams set representative_id = chosen
  where room_id = room.id and round_number = room.round_number and team_id = me.team_id;
  return jsonb_build_object('teamId', me.team_id);
end;
$$;

create function dominacao.cmd_start_battle(room dominacao.rooms, me dominacao.members, args jsonb) returns jsonb
language plpgsql set search_path = '' as $$
declare
  missing int;
begin
  perform dominacao.require_moderator(me);
  perform dominacao.require_stage(room, 'representatives');
  select count(*) into missing from dominacao.round_teams rt
  where rt.room_id = room.id and rt.round_number = room.round_number
    and not exists (select 1 from dominacao.members m
                    where m.id = rt.representative_id and m.team_id = rt.team_id);
  if missing > 0 then perform dominacao.fail('representatives_missing'); end if;

  -- Único ponto em que o contador sobe. A mudança de etapa na mesma transação
  -- impede contar duas vezes.
  update dominacao.members set battles = battles + 1
  where id in (select representative_id from dominacao.round_teams
               where room_id = room.id and round_number = room.round_number);
  update dominacao.rooms set stage = 'battle' where id = room.id;
  return '{}';
end;
$$;

create function dominacao.team_permutation(p_room uuid, p_value jsonb) returns uuid[]
language plpgsql set search_path = '' as $$
declare
  ids uuid[];
  expected int;
begin
  if jsonb_typeof(p_value) is distinct from 'array' then perform dominacao.fail('bad_arguments'); end if;
  begin
    select array_agg(value::uuid order by ordinality) into ids
    from jsonb_array_elements_text(p_value) with ordinality;
  exception when others then
    perform dominacao.fail('bad_arguments');
  end;
  select count(*) into expected from dominacao.teams where room_id = p_room;
  if coalesce(cardinality(ids), 0) <> expected
     or (select count(distinct t.id) from dominacao.teams t
         where t.room_id = p_room and t.id = any (ids)) <> expected then
    perform dominacao.fail('order_must_list_all_teams');
  end if;
  return ids;
end;
$$;

create function dominacao.cmd_record_battle(room dominacao.rooms, me dominacao.members, args jsonb) returns jsonb
language plpgsql set search_path = '' as $$
declare
  ranking uuid[];
  play_order uuid[];
begin
  perform dominacao.require_moderator(me);
  -- Na preparação o registro ainda pode ser corrigido: nenhuma maleta foi escolhida.
  perform dominacao.require_stage(room, 'battle', 'preparation');
  ranking := dominacao.team_permutation(room.id, args -> 'ranking');
  play_order := dominacao.team_permutation(room.id, args -> 'playOrder');
  update dominacao.round_teams
  set battle_place = array_position(ranking, team_id), play_position = array_position(play_order, team_id)
  where room_id = room.id and round_number = room.round_number;
  update dominacao.rooms set stage = 'preparation' where id = room.id;
  return jsonb_build_object('ranking', to_jsonb(ranking), 'playOrder', to_jsonb(play_order));
end;
$$;

create function dominacao.cmd_register_combo(room dominacao.rooms, me dominacao.members, args jsonb) returns jsonb
language plpgsql set search_path = '' as $$
declare
  team uuid := dominacao.arg_uuid(args, 'teamId');
  chosen text := args ->> 'power';
  target uuid := case when args ->> 'targetTeamId' is null then null else dominacao.arg_uuid(args, 'targetTeamId') end;
  use_id uuid;
  captain uuid;
begin
  perform dominacao.require_moderator(me);
  perform dominacao.require_stage(room, 'preparation');
  if chosen is null or chosen not in ('blue', 'yellow', 'green', 'red') then perform dominacao.fail('bad_arguments'); end if;
  if not exists (select 1 from dominacao.teams where room_id = room.id and id = team) then
    perform dominacao.fail('team_not_found');
  end if;
  if chosen in ('yellow', 'red') then
    if target is null or target = team
       or not exists (select 1 from dominacao.teams where room_id = room.id and id = target) then
      perform dominacao.fail('target_required');
    end if;
  else
    target := null;
  end if;
  if exists (select 1 from dominacao.power_uses where room_id = room.id and round_number = room.round_number
             and team_id = team and category = 'combo') then
    perform dominacao.fail('combo_already_used');
  end if;

  insert into dominacao.power_uses (room_id, round_number, team_id, category, power, target_team_id)
  values (room.id, room.round_number, team, 'combo', chosen, target) returning id into use_id;

  if chosen = 'blue' then
    select id into captain from dominacao.members where team_id = team and is_captain;
    insert into dominacao.spy_grants (room_id, round_number, team_id, member_id, power_use_id)
    values (room.id, room.round_number, team, captain, use_id);
  end if;
  return jsonb_build_object('teamId', team, 'power', chosen, 'targetTeamId', target);
end;
$$;

create function dominacao.cmd_undo_combo(room dominacao.rooms, me dominacao.members, args jsonb) returns jsonb
language plpgsql set search_path = '' as $$
declare
  used dominacao.power_uses;
begin
  perform dominacao.require_moderator(me);
  perform dominacao.require_stage(room, 'preparation');
  select * into used from dominacao.power_uses
  where room_id = room.id and round_number = room.round_number
    and team_id = dominacao.arg_uuid(args, 'teamId') and category = 'combo';
  if not found then perform dominacao.fail('nothing_to_undo'); end if;
  -- Quem já viu uma maleta não "desvê": a espionagem usada não é desfeita.
  if exists (select 1 from dominacao.spy_grants where power_use_id = used.id and status = 'used') then
    perform dominacao.fail('spy_already_seen');
  end if;
  delete from dominacao.power_uses where id = used.id;  -- remove também a autorização
  return jsonb_build_object('teamId', used.team_id, 'power', used.power);
end;
$$;

create function dominacao.cmd_close_preparation(room dominacao.rooms, me dominacao.members, args jsonb)
returns jsonb language plpgsql set search_path = '' as $$
begin
  perform dominacao.require_moderator(me);
  perform dominacao.require_stage(room, 'preparation');
  if exists (select 1 from dominacao.spy_grants
             where room_id = room.id and round_number = room.round_number and status = 'active') then
    if coalesce((args ->> 'force') = 'true', false) is false then perform dominacao.fail('spy_pending'); end if;
    update dominacao.spy_grants set status = 'expired'
    where room_id = room.id and round_number = room.round_number and status = 'active';
  end if;
  update dominacao.rooms set stage = 'picking' where id = room.id;
  return '{}';
end;
$$;

create function dominacao.cmd_pick_case(room dominacao.rooms, me dominacao.members, args jsonb) returns jsonb
language plpgsql set search_path = '' as $$
declare
  chosen int := dominacao.arg_int(args, 'number');
  on_turn uuid;
  next_seq int;
begin
  perform dominacao.require_captain(me);
  perform dominacao.require_stage(room, 'picking');
  select team_id into on_turn from dominacao.round_teams
  where room_id = room.id and round_number = room.round_number and case_number is null
  order by play_position limit 1;
  if on_turn is null then perform dominacao.fail('all_picked'); end if;
  if on_turn <> me.team_id then perform dominacao.fail('not_your_turn'); end if;

  update dominacao.cases set state = 'chosen' where room_id = room.id and number = chosen and state = 'available';
  if not found then perform dominacao.fail('case_unavailable'); end if;

  select coalesce(max(pick_seq), 0) + 1 into next_seq from dominacao.round_teams
  where room_id = room.id and round_number = room.round_number;
  update dominacao.round_teams set case_number = chosen, pick_seq = next_seq
  where room_id = room.id and round_number = room.round_number and team_id = me.team_id;
  return jsonb_build_object('teamId', me.team_id, 'number', chosen);
end;
$$;

create function dominacao.cmd_undo_pick(room dominacao.rooms, me dominacao.members, args jsonb) returns jsonb
language plpgsql set search_path = '' as $$
declare
  latest dominacao.round_teams;
begin
  perform dominacao.require_moderator(me);
  perform dominacao.require_stage(room, 'picking');  -- reversível: nada foi aberto
  select * into latest from dominacao.round_teams
  where room_id = room.id and round_number = room.round_number and case_number is not null
  order by pick_seq desc limit 1;
  if not found then perform dominacao.fail('nothing_to_undo'); end if;
  update dominacao.cases set state = 'available' where room_id = room.id and number = latest.case_number;
  update dominacao.round_teams set case_number = null, pick_seq = null
  where room_id = room.id and round_number = room.round_number and team_id = latest.team_id;
  return jsonb_build_object('teamId', latest.team_id, 'number', latest.case_number);
end;
$$;

create function dominacao.cmd_reveal(room dominacao.rooms, me dominacao.members, args jsonb) returns jsonb
language plpgsql set search_path = '' as $$
begin
  perform dominacao.require_moderator(me);
  perform dominacao.require_stage(room, 'picking');
  if exists (select 1 from dominacao.round_teams
             where room_id = room.id and round_number = room.round_number and case_number is null) then
    perform dominacao.fail('picks_missing');
  end if;
  -- Só agora, e só para as maletas escolhidas, o conteúdo vai para a parte pública.
  update dominacao.cases c
  set state = 'opened', opened_round = room.round_number, revealed_kind = s.kind, revealed_amount = s.amount
  from dominacao.round_teams rt
  join dominacao.case_contents s on s.room_id = rt.room_id and s.number = rt.case_number
  where rt.room_id = room.id and rt.round_number = room.round_number
    and c.room_id = rt.room_id and c.number = rt.case_number;
  update dominacao.rooms set stage = 'interference' where id = room.id;
  return '{}';
end;
$$;

create function dominacao.cmd_register_special(room dominacao.rooms, me dominacao.members, args jsonb)
returns jsonb language plpgsql set search_path = '' as $$
declare
  team uuid := dominacao.arg_uuid(args, 'teamId');
  chosen text := args ->> 'power';
  target uuid := case when args ->> 'targetTeamId' is null then null else dominacao.arg_uuid(args, 'targetTeamId') end;
  team_total int;
  before jsonb;
begin
  perform dominacao.require_moderator(me);
  perform dominacao.require_stage(room, 'interference');
  if chosen is null or chosen not in ('invert', 'joker', 'block', 'plus2', 'plus4') then
    perform dominacao.fail('bad_arguments');
  end if;
  if not exists (select 1 from dominacao.teams where room_id = room.id and id = team) then
    perform dominacao.fail('team_not_found');
  end if;
  if exists (select 1 from dominacao.power_uses where room_id = room.id and round_number = room.round_number
             and team_id = team and category = 'special') then
    perform dominacao.fail('special_already_used');
  end if;
  -- Limites da partida inteira: essas cartas saem do jogo ao serem consumidas.
  if chosen = 'plus2' and (select count(*) from dominacao.power_uses
                           where room_id = room.id and power = 'plus2') >= 8 then
    perform dominacao.fail('plus2_exhausted');
  end if;
  if chosen = 'plus4' and (select count(*) from dominacao.power_uses
                           where room_id = room.id and power = 'plus4') >= 4 then
    perform dominacao.fail('plus4_exhausted');
  end if;
  if chosen = 'joker' then
    if target is null or target = team
       or not exists (select 1 from dominacao.teams where room_id = room.id and id = target) then
      perform dominacao.fail('target_required');
    end if;
  else
    target := null;
  end if;

  select jsonb_object_agg(rt.team_id, jsonb_build_object('case', rt.case_number, 'blocked', rt.blocked, 'bonus', rt.bonus))
  into before from dominacao.round_teams rt where rt.room_id = room.id and rt.round_number = room.round_number;

  if chosen = 'invert' then
    -- Cada maleta avança uma fábrica na ordem de jogada (a última vai à primeira).
    -- Fábricas, saldos, bônus e proteções ficam onde estão.
    select count(*) into team_total from dominacao.round_teams
    where room_id = room.id and round_number = room.round_number;
    update dominacao.round_teams dest set case_number = source.case_number
    from (select play_position, case_number from dominacao.round_teams
          where room_id = room.id and round_number = room.round_number) source
    where dest.room_id = room.id and dest.round_number = room.round_number
      and dest.play_position = source.play_position % team_total + 1;
  elsif chosen = 'joker' then
    update dominacao.round_teams dest set case_number = source.case_number
    from (select team_id, case_number from dominacao.round_teams
          where room_id = room.id and round_number = room.round_number) source
    where dest.room_id = room.id and dest.round_number = room.round_number
      and dest.team_id in (team, target) and source.team_id in (team, target)
      and source.team_id <> dest.team_id;
  elsif chosen = 'block' then
    update dominacao.round_teams set blocked = true
    where room_id = room.id and round_number = room.round_number and team_id = team;
  else
    update dominacao.round_teams set bonus = bonus + case chosen when 'plus2' then 2 else 4 end
    where room_id = room.id and round_number = room.round_number and team_id = team;
  end if;

  insert into dominacao.power_uses (room_id, round_number, team_id, category, power, target_team_id, previous)
  values (room.id, room.round_number, team, 'special', chosen, target, before);
  return jsonb_build_object('teamId', team, 'power', chosen, 'targetTeamId', target);
end;
$$;

create function dominacao.cmd_undo_special(room dominacao.rooms, me dominacao.members, args jsonb) returns jsonb
language plpgsql set search_path = '' as $$
declare
  latest dominacao.power_uses;
begin
  perform dominacao.require_moderator(me);
  perform dominacao.require_stage(room, 'interference');
  -- Só o ÚLTIMO especial: assim o estado anterior guardado é sempre exato.
  select * into latest from dominacao.power_uses
  where room_id = room.id and round_number = room.round_number and category = 'special'
  order by seq desc limit 1;
  if not found then perform dominacao.fail('nothing_to_undo'); end if;
  update dominacao.round_teams rt
  set case_number = (latest.previous -> rt.team_id::text ->> 'case')::int,
      blocked = (latest.previous -> rt.team_id::text ->> 'blocked')::boolean,
      bonus = (latest.previous -> rt.team_id::text ->> 'bonus')::int
  where rt.room_id = room.id and rt.round_number = room.round_number;
  delete from dominacao.power_uses where id = latest.id;
  return jsonb_build_object('teamId', latest.team_id, 'power', latest.power);
end;
$$;

create function dominacao.cmd_open_review(room dominacao.rooms, me dominacao.members, args jsonb) returns jsonb
language plpgsql set search_path = '' as $$
begin
  perform dominacao.require_moderator(me);
  perform dominacao.require_stage(room, 'interference');
  update dominacao.rooms set stage = 'review' where id = room.id;
  return '{}';
end;
$$;

create function dominacao.cmd_back_to_interference(room dominacao.rooms, me dominacao.members, args jsonb)
returns jsonb language plpgsql set search_path = '' as $$
begin
  perform dominacao.require_moderator(me);
  perform dominacao.require_stage(room, 'review');
  update dominacao.rooms set stage = 'interference' where id = room.id;
  return '{}';
end;
$$;

create function dominacao.cmd_confirm_payment(room dominacao.rooms, me dominacao.members, args jsonb)
returns jsonb language plpgsql set search_path = '' as $$
declare
  moved int;
  held int;
  new_bank int;
begin
  perform dominacao.require_moderator(me);
  perform dominacao.require_stage(room, 'review');

  insert into dominacao.payments (room_id, round_number, team_id, start_balance, case_number, case_kind,
                                  case_amount, delta, effective, blocked, bonus, final_balance)
  select room.id, room.round_number, s.* from dominacao.settlement(room.id, room.round_number) s;

  update dominacao.teams t set balance = p.final_balance
  from dominacao.payments p
  where p.room_id = room.id and p.round_number = room.round_number and t.id = p.team_id;

  select coalesce(sum(effective + bonus), 0) into moved from dominacao.payments
  where room_id = room.id and round_number = room.round_number;
  -- Ganhos saem do banco; perdas voltam para ele. bank >= 0 é restrição da tabela.
  update dominacao.rooms set bank = bank - moved, stage = 'paid' where id = room.id
  returning bank into new_bank;
  update dominacao.rounds set paid_at = now() where room_id = room.id and number = room.round_number;

  select coalesce(sum(balance), 0) into held from dominacao.teams where room_id = room.id;
  if new_bank + held <> room.total_chocolates then perform dominacao.fail('conservation_broken'); end if;
  return jsonb_build_object('bank', new_bank);
end;
$$;

create function dominacao.cmd_next_round(room dominacao.rooms, me dominacao.members, args jsonb) returns jsonb
language plpgsql set search_path = '' as $$
begin
  perform dominacao.require_moderator(me);
  perform dominacao.require_stage(room, 'paid');
  if room.round_number >= 15 then perform dominacao.fail('last_round'); end if;
  update dominacao.rooms set round_number = room.round_number + 1, stage = 'representatives' where id = room.id;
  perform dominacao.new_round(room.id, room.round_number + 1);
  return jsonb_build_object('round', room.round_number + 1);
end;
$$;

create function dominacao.cmd_end_match(room dominacao.rooms, me dominacao.members, args jsonb) returns jsonb
language plpgsql set search_path = '' as $$
declare
  last_paid int := room.round_number;
begin
  perform dominacao.require_moderator(me);
  -- Depois de um pagamento, ou numa rodada recém-aberta em que nada aconteceu.
  perform dominacao.require_stage(room, 'paid', 'representatives');
  if room.stage = 'representatives' then
    if room.round_number <= 1 then perform dominacao.fail('end_after_payment'); end if;
    delete from dominacao.rounds where room_id = room.id and number = room.round_number;
    last_paid := room.round_number - 1;
  end if;
  update dominacao.rooms set status = 'ended', stage = null, round_number = last_paid, entries_open = false
  where id = room.id;
  return jsonb_build_object('rounds', last_paid);
end;
$$;

-- -----------------------------------------------------------------------------
-- Pontos de entrada privilegiados (validam usuário, sala, papel e etapa)
-- -----------------------------------------------------------------------------

create function dominacao.run_command(p_room uuid, p_command_id uuid, p_type text, p_args jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  room dominacao.rooms;
  me dominacao.members;
  previous dominacao.commands;
  args jsonb := coalesce(p_args, '{}');
  data jsonb;
  response jsonb;
begin
  if uid is null then perform dominacao.fail('unauthenticated'); end if;
  if p_command_id is null or p_type is null then perform dominacao.fail('bad_arguments'); end if;

  select * into room from dominacao.rooms where id = p_room for update;
  if not found then perform dominacao.fail('not_member'); end if;
  select * into me from dominacao.members where room_id = p_room and user_id = uid;
  if not found then perform dominacao.fail('not_member'); end if;

  select * into previous from dominacao.commands where user_id = uid and command_id = p_command_id;
  if found then
    if previous.room_id <> p_room or previous.type <> p_type then perform dominacao.fail('command_reused'); end if;
    return previous.result || '{"repeated": true}';
  end if;

  -- Autorização por papel ANTES de olhar os argumentos. Cada comando ainda
  -- confere o próprio papel, a etapa e o alvo.
  if p_type in ('set_entries', 'remove_member', 'form_teams', 'reset_teams', 'assign_member', 'set_captain',
                'set_economy', 'start_match', 'start_battle', 'record_battle', 'register_combo', 'undo_combo',
                'close_preparation', 'undo_pick', 'reveal', 'register_special', 'undo_special', 'open_review',
                'back_to_interference', 'confirm_payment', 'next_round', 'end_match') then
    perform dominacao.require_moderator(me);
  elsif p_type in ('set_factory', 'select_representative', 'pick_case') then
    perform dominacao.require_captain(me);
  end if;

  data := case p_type
    when 'set_look' then dominacao.cmd_set_look(room, me, args)
    when 'set_entries' then dominacao.cmd_set_entries(room, me, args)
    when 'remove_member' then dominacao.cmd_remove_member(room, me, args)
    when 'form_teams' then dominacao.cmd_form_teams(room, me, args)
    when 'reset_teams' then dominacao.cmd_reset_teams(room, me, args)
    when 'assign_member' then dominacao.cmd_assign_member(room, me, args)
    when 'set_captain' then dominacao.cmd_set_captain(room, me, args)
    when 'set_factory' then dominacao.cmd_set_factory(room, me, args)
    when 'set_economy' then dominacao.cmd_set_economy(room, me, args)
    when 'start_match' then dominacao.cmd_start_match(room, me, args)
    when 'select_representative' then dominacao.cmd_select_representative(room, me, args)
    when 'start_battle' then dominacao.cmd_start_battle(room, me, args)
    when 'record_battle' then dominacao.cmd_record_battle(room, me, args)
    when 'register_combo' then dominacao.cmd_register_combo(room, me, args)
    when 'undo_combo' then dominacao.cmd_undo_combo(room, me, args)
    when 'close_preparation' then dominacao.cmd_close_preparation(room, me, args)
    when 'pick_case' then dominacao.cmd_pick_case(room, me, args)
    when 'undo_pick' then dominacao.cmd_undo_pick(room, me, args)
    when 'reveal' then dominacao.cmd_reveal(room, me, args)
    when 'register_special' then dominacao.cmd_register_special(room, me, args)
    when 'undo_special' then dominacao.cmd_undo_special(room, me, args)
    when 'open_review' then dominacao.cmd_open_review(room, me, args)
    when 'back_to_interference' then dominacao.cmd_back_to_interference(room, me, args)
    when 'confirm_payment' then dominacao.cmd_confirm_payment(room, me, args)
    when 'next_round' then dominacao.cmd_next_round(room, me, args)
    when 'end_match' then dominacao.cmd_end_match(room, me, args)
    else null
  end;
  if data is null then perform dominacao.fail('unknown_command'); end if;

  response := jsonb_build_object('ok', true, 'revision', dominacao.publish(p_room, p_type, me.id, data));
  insert into dominacao.commands (user_id, command_id, room_id, type, result)
  values (uid, p_command_id, p_room, p_type, response);
  return response;
end;
$$;

create function dominacao.create_room(p_command_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  previous dominacao.commands;
  new_code text;
  new_room uuid;
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';  -- sem 0/O e 1/I
  bytes bytea;
  response jsonb;
begin
  if uid is null then perform dominacao.fail('unauthenticated'); end if;
  if p_command_id is null then perform dominacao.fail('bad_arguments'); end if;
  -- Serializa pedidos do mesmo usuário (toque duplo em "Criar sala").
  perform pg_advisory_xact_lock(hashtextextended('dominacao:create:' || uid::text, 0));

  select * into previous from dominacao.commands where user_id = uid and command_id = p_command_id;
  if found then
    if previous.type <> 'create_room' then perform dominacao.fail('command_reused'); end if;
    return previous.result || '{"repeated": true}';
  end if;
  if (select count(*) from dominacao.rooms where created_by = uid and created_at > now() - interval '1 day') >= 10 then
    perform dominacao.fail('too_many_rooms');
  end if;

  loop
    bytes := uuid_send(gen_random_uuid());
    -- 32 símbolos dividem 256 exatamente: sem viés. Os 6 primeiros bytes do
    -- UUID v4 são totalmente aleatórios.
    select string_agg(substr(alphabet, get_byte(bytes, i) % 32 + 1, 1), '' order by i)
    into new_code from generate_series(0, 5) i;
    insert into dominacao.rooms (code, created_by) values (new_code, uid)
    on conflict (code) do nothing returning id into new_room;
    exit when new_room is not null;
  end loop;

  insert into dominacao.members (room_id, user_id, kind, name) values (new_room, uid, 'moderator', '');
  response := jsonb_build_object('ok', true, 'roomId', new_room, 'code', new_code);
  insert into dominacao.commands (user_id, command_id, room_id, type, result)
  values (uid, p_command_id, new_room, 'create_room', response);
  return response;
end;
$$;

-- Entrada pelo convite. Nunca concede moderação. Quem já é da sala recebe o
-- mesmo vínculo de volta (sem duplicar e sem mudar de papel).
create function dominacao.join_room(p_code text, p_as text, p_name text, p_look jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  room dominacao.rooms;
  me dominacao.members;
  new_name text := dominacao.clean_text(p_name, 18);
  new_member uuid;
begin
  if uid is null then perform dominacao.fail('unauthenticated'); end if;
  if p_as is null or p_as not in ('player', 'screen') then perform dominacao.fail('bad_arguments'); end if;
  if (select count(*) from dominacao.join_failures where user_id = uid and at > now() - interval '10 minutes') >= 20 then
    return jsonb_build_object('ok', false, 'error', 'too_many_attempts');
  end if;

  select * into room from dominacao.rooms where code = upper(btrim(coalesce(p_code, ''))) for update;
  if not found then
    insert into dominacao.join_failures (user_id) values (uid);
    return jsonb_build_object('ok', false, 'error', 'room_not_found');
  end if;

  select * into me from dominacao.members where room_id = room.id and user_id = uid;
  if found then
    return jsonb_build_object('ok', true, 'roomId', room.id, 'code', room.code, 'kind', me.kind, 'existing', true);
  end if;

  if p_as = 'player' then
    if room.status = 'ended' then return jsonb_build_object('ok', false, 'error', 'room_ended'); end if;
    if not room.entries_open then return jsonb_build_object('ok', false, 'error', 'entries_closed'); end if;
    if (select count(*) from dominacao.members where room_id = room.id and kind = 'player') >= 60 then
      return jsonb_build_object('ok', false, 'error', 'room_full');
    end if;
    if new_name = '' then return jsonb_build_object('ok', false, 'error', 'name_required'); end if;
  else
    if (select count(*) from dominacao.members where room_id = room.id and kind = 'screen') >= 6 then
      return jsonb_build_object('ok', false, 'error', 'too_many_screens');
    end if;
    new_name := '';
  end if;

  insert into dominacao.members (room_id, user_id, kind, name, look)
  values (room.id, uid, p_as, new_name, dominacao.clean_look(p_look))
  returning id into new_member;
  perform dominacao.publish(room.id, 'joined', new_member,
                            jsonb_build_object('memberId', new_member, 'kind', p_as, 'name', new_name));
  return jsonb_build_object('ok', true, 'roomId', room.id, 'code', room.code, 'kind', p_as, 'existing', false);
end;
$$;

-- Espionagem azul. Só o capitão autorizado, só na preparação, uma maleta.
-- Repetir o pedido da MESMA maleta devolve a mesma consulta (falha de rede não
-- perde a informação nem dá outra espiada). O número não vai para o histórico.
create function dominacao.spy(p_room uuid, p_number int) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  room dominacao.rooms;
  me dominacao.members;
  permit dominacao.spy_grants;
  secret dominacao.case_contents;
begin
  if uid is null then perform dominacao.fail('unauthenticated'); end if;
  select * into room from dominacao.rooms where id = p_room for update;
  if not found then perform dominacao.fail('not_member'); end if;
  select * into me from dominacao.members where room_id = p_room and user_id = uid;
  if not found then perform dominacao.fail('not_member'); end if;
  perform dominacao.require_captain(me);

  select * into permit from dominacao.spy_grants
  where room_id = p_room and round_number = room.round_number and team_id = me.team_id and member_id = me.id;
  if not found then perform dominacao.fail('spy_not_authorized'); end if;

  if permit.status = 'used' then
    if permit.case_number is distinct from p_number then perform dominacao.fail('spy_already_used'); end if;
    select * into secret from dominacao.case_contents where room_id = p_room and number = p_number;
    return jsonb_build_object('ok', true, 'number', secret.number, 'kind', secret.kind,
                              'amount', secret.amount, 'repeated', true);
  end if;

  perform dominacao.require_stage(room, 'preparation');
  if permit.status <> 'active' then perform dominacao.fail('spy_not_authorized'); end if;
  if not exists (select 1 from dominacao.cases
                 where room_id = p_room and number = p_number and state = 'available') then
    perform dominacao.fail('case_unavailable');
  end if;
  select * into secret from dominacao.case_contents where room_id = p_room and number = p_number;
  update dominacao.spy_grants set status = 'used', case_number = p_number, used_at = now() where id = permit.id;
  perform dominacao.publish(p_room, 'spy_used', me.id, jsonb_build_object('teamId', me.team_id));
  return jsonb_build_object('ok', true, 'number', secret.number, 'kind', secret.kind,
                            'amount', secret.amount, 'repeated', false);
end;
$$;

-- Consultas que a PRÓPRIA pessoa já fez (recuperação após recarregar).
create function dominacao.my_spies(p_room uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'round', g.round_number, 'number', s.number, 'kind', s.kind, 'amount', s.amount)
           order by g.round_number), '[]')
  from dominacao.spy_grants g
  join dominacao.case_contents s on s.room_id = g.room_id and s.number = g.case_number
  where g.room_id = p_room and g.status = 'used' and g.member_id = dominacao.my_member_id(p_room);
$$;

-- Autorização do canal privado de avisos: somente integrantes da sala do tópico.
create function dominacao.can_listen(p_topic text) returns boolean
language sql stable security definer set search_path = '' as $$
  select case
    when p_topic ~ '^dominacao:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then dominacao.is_member(substr(p_topic, 11)::uuid)
    else false
  end;
$$;

-- -----------------------------------------------------------------------------
-- Realtime: política restrita aos tópicos do jogo. Não há política de INSERT:
-- os aparelhos só ESCUTAM; quem publica é o banco.
-- (No Supabase, o schema realtime só aceita políticas.)
-- -----------------------------------------------------------------------------

create policy "dominacao: avisos da própria sala" on realtime.messages
  for select to authenticated
  using (
    realtime.messages.extension = 'broadcast'
    and dominacao.can_listen((select realtime.topic()))
  );

-- -----------------------------------------------------------------------------
-- API pública do aplicativo (SECURITY INVOKER)
-- -----------------------------------------------------------------------------

create function public.dc_create_room(p_command_id uuid) returns jsonb
language sql volatile security invoker set search_path = '' as $$
  select dominacao.create_room(p_command_id);
$$;

create function public.dc_join_room(p_code text, p_as text, p_name text default '', p_look jsonb default '{}')
returns jsonb language sql volatile security invoker set search_path = '' as $$
  select dominacao.join_room(p_code, p_as, p_name, p_look);
$$;

create function public.dc_command(p_room uuid, p_command_id uuid, p_type text, p_args jsonb default '{}')
returns jsonb language sql volatile security invoker set search_path = '' as $$
  select dominacao.run_command(p_room, p_command_id, p_type, p_args);
$$;

create function public.dc_spy(p_room uuid, p_number int) returns jsonb
language sql volatile security invoker set search_path = '' as $$
  select dominacao.spy(p_room, p_number);
$$;

create function public.dc_my_spies(p_room uuid) returns jsonb
language sql stable security invoker set search_path = '' as $$
  select dominacao.my_spies(p_room);
$$;

-- Salas em que a pessoa já está (para "Continuar partida").
create function public.dc_my_rooms() returns jsonb
language plpgsql stable security invoker set search_path = '' as $$
begin
  -- As políticas de leitura já limitam às salas da própria pessoa.
  return (
    select coalesce(jsonb_agg(entry order by entry ->> 'createdAt' desc), '[]')
    from (
      select jsonb_build_object('roomId', r.id, 'code', r.code, 'status', r.status, 'createdAt', r.created_at,
                                'kind', m.kind) as entry
      from dominacao.rooms r
      join dominacao.members m on m.room_id = r.id and m.id = dominacao.my_member_id(r.id)
      order by r.created_at desc
      limit 10
    ) recent
  );
end;
$$;

-- Estado atual da sala para quem pede. SECURITY INVOKER: o RLS e os grants de
-- coluna se aplicam. Não contém nenhum segredo.
create function public.dc_snapshot(p_code text) returns jsonb
language plpgsql stable security invoker set search_path = '' as $$
declare
  room record;
  my_id uuid;
begin
  select r.id, r.code, r.status, r.stage, r.round_number, r.total_chocolates, r.initial_per_team, r.bank,
         r.entries_open, r.revision
  into room from dominacao.rooms r where r.code = upper(btrim(coalesce(p_code, '')));
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_member');
  end if;
  my_id := dominacao.my_member_id(room.id);

  return jsonb_build_object(
    'ok', true,
    'room', jsonb_build_object(
      'id', room.id, 'code', room.code, 'status', room.status, 'stage', room.stage,
      'round', room.round_number, 'maxRounds', 15, 'totalChocolates', room.total_chocolates,
      'initialPerTeam', room.initial_per_team, 'bank', room.bank, 'entriesOpen', room.entries_open,
      'revision', room.revision),
    'me', (select jsonb_build_object('memberId', m.id, 'kind', m.kind, 'teamId', m.team_id, 'isCaptain', m.is_captain)
           from dominacao.members m where m.id = my_id),
    'members', coalesce((select jsonb_agg(jsonb_build_object(
        'id', m.id, 'kind', m.kind, 'name', m.name, 'look', m.look, 'teamId', m.team_id,
        'isCaptain', m.is_captain, 'battles', m.battles) order by m.joined_at, m.id)
      from dominacao.members m where m.room_id = room.id), '[]'),
    'teams', coalesce((select jsonb_agg(jsonb_build_object(
        'id', t.id, 'slot', t.slot, 'name', t.factory_name, 'model', t.factory_model,
        'background', t.factory_background, 'ready', t.ready, 'balance', t.balance) order by t.slot)
      from dominacao.teams t where t.room_id = room.id), '[]'),
    'roundTeams', coalesce((select jsonb_agg(jsonb_build_object(
        'teamId', rt.team_id, 'startBalance', rt.start_balance, 'representativeId', rt.representative_id,
        'battlePlace', rt.battle_place, 'playPosition', rt.play_position, 'caseNumber', rt.case_number,
        'blocked', rt.blocked, 'bonus', rt.bonus) order by rt.play_position nulls last, rt.team_id)
      from dominacao.round_teams rt where rt.room_id = room.id and rt.round_number = room.round_number), '[]'),
    'cases', coalesce((select jsonb_agg(jsonb_build_object(
        'number', c.number, 'state', c.state, 'openedRound', c.opened_round,
        'kind', c.revealed_kind, 'amount', c.revealed_amount) order by c.number)
      from dominacao.cases c where c.room_id = room.id), '[]'),
    'powers', coalesce((select jsonb_agg(jsonb_build_object(
        'teamId', p.team_id, 'category', p.category, 'power', p.power, 'targetTeamId', p.target_team_id)
        order by p.seq)
      from dominacao.power_uses p where p.room_id = room.id and p.round_number = room.round_number), '[]'),
    'bonusCardsUsed', jsonb_build_object(
      'plus2', (select count(*) from dominacao.power_uses p where p.room_id = room.id and p.power = 'plus2'),
      'plus4', (select count(*) from dominacao.power_uses p where p.room_id = room.id and p.power = 'plus4')),
    'spy', coalesce((select jsonb_agg(jsonb_build_object('teamId', s.team_id, 'status', s.status))
      from dominacao.spy_status(room.id, room.round_number) s), '[]'),
    'settlement', case when room.stage in ('interference', 'review') then
      coalesce((select jsonb_agg(jsonb_build_object(
          'teamId', s.team_id, 'startBalance', s.start_balance, 'caseNumber', s.case_number,
          'caseKind', s.case_kind, 'caseAmount', s.case_amount, 'delta', s.delta, 'effective', s.effective,
          'blocked', s.blocked, 'bonus', s.bonus, 'finalBalance', s.final_balance))
        from dominacao.settlement(room.id, room.round_number) s), '[]') end,
    'payments', coalesce((select jsonb_agg(jsonb_build_object(
        'round', p.round_number, 'teamId', p.team_id, 'startBalance', p.start_balance,
        'caseNumber', p.case_number, 'caseKind', p.case_kind, 'caseAmount', p.case_amount,
        'delta', p.delta, 'effective', p.effective, 'blocked', p.blocked, 'bonus', p.bonus,
        'finalBalance', p.final_balance) order by p.round_number, p.team_id)
      from dominacao.payments p where p.room_id = room.id), '[]'),
    'history', coalesce((select jsonb_agg(jsonb_build_object(
        'id', e.id, 'revision', e.revision, 'round', e.round_number, 'type', e.type, 'data', e.data,
        'at', e.created_at) order by e.id desc)
      from (select ev.id, ev.revision, ev.round_number, ev.type, ev.data, ev.created_at
            from dominacao.events ev where ev.room_id = room.id order by ev.id desc limit 60) e), '[]')
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- Execução: nada é público. Libera apenas a API e os helpers que ela usa.
-- (O Supabase concede EXECUTE por padrão em `public`; por isso o revoke.)
-- -----------------------------------------------------------------------------

revoke execute on all functions in schema dominacao from public, anon, authenticated;

grant execute on function
  dominacao.is_member(uuid),
  dominacao.my_member_id(uuid),
  dominacao.can_listen(text),
  dominacao.settlement(uuid, int),
  dominacao.spy_status(uuid, int),
  dominacao.create_room(uuid),
  dominacao.join_room(text, text, text, jsonb),
  dominacao.run_command(uuid, uuid, text, jsonb),
  dominacao.spy(uuid, int),
  dominacao.my_spies(uuid)
to authenticated;

revoke execute on function
  public.dc_create_room(uuid),
  public.dc_join_room(text, text, text, jsonb),
  public.dc_command(uuid, uuid, text, jsonb),
  public.dc_spy(uuid, int),
  public.dc_my_spies(uuid),
  public.dc_my_rooms(),
  public.dc_snapshot(text)
from public, anon;

grant execute on function
  public.dc_create_room(uuid),
  public.dc_join_room(text, text, text, jsonb),
  public.dc_command(uuid, uuid, text, jsonb),
  public.dc_spy(uuid, int),
  public.dc_my_spies(uuid),
  public.dc_my_rooms(),
  public.dc_snapshot(text)
to authenticated;
