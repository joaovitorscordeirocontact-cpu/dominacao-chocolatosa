-- Exclusão de salas pelo moderador que as criou.
--
-- Apagar a linha da sala leva junto, em cascata e na mesma transação, equipes,
-- integrantes, rodadas, maletas e conteúdos secretos, poderes, espionagens,
-- pagamentos, histórico e registro de comandos. As referências sem cascata são
-- conferidas no fim da transação (migração anterior). Usuários do Auth não são
-- tocados: a mesma pessoa pode estar em outras salas.

-- Aviso de sala apagada. Depois da exclusão ninguém mais é "integrante", então
-- este registro mínimo é o que permite aos aparelhos (inclusive os que estavam
-- desconectados) saber o que houve. Sem nomes e sem dados da partida: só o
-- código e identificadores anônimos. Sem grant: só as funções abaixo leem.
create table dominacao.deleted_rooms (
  room_id    uuid primary key,
  code       text not null unique,
  owner_id   uuid not null,
  member_ids uuid[] not null,
  deleted_at timestamptz not null default now()
);
alter table dominacao.deleted_rooms enable row level security;
revoke all on dominacao.deleted_rooms from public, anon, authenticated;

-- O código de uma sala apagada não volta a ser usado: um link ou QR code antigo
-- nunca pode levar a outra partida. Descartar a linha faz o sorteio de
-- dominacao.create_room tentar outro código.
create function dominacao.skip_deleted_codes() returns trigger
language plpgsql set search_path = '' as $$
begin
  if exists (select 1 from dominacao.deleted_rooms d where d.code = new.code) then
    return null;
  end if;
  return new;
end;
$$;

create trigger rooms_skip_deleted_codes before insert on dominacao.rooms
  for each row execute function dominacao.skip_deleted_codes();

create function dominacao.delete_room(p_room uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  room dominacao.rooms;
  my_kind text;
begin
  if uid is null then perform dominacao.fail('unauthenticated'); end if;
  if p_room is null then perform dominacao.fail('bad_arguments'); end if;

  -- Mesma trava dos comandos: nada muda na sala enquanto ela é apagada.
  select * into room from dominacao.rooms where id = p_room for update;
  if not found then
    -- Repetição (toque duplo ou resposta perdida): só quem apagou recebe a
    -- confirmação. Para os demais, é como uma sala que nunca existiu.
    if exists (select 1 from dominacao.deleted_rooms d where d.room_id = p_room and d.owner_id = uid) then
      return jsonb_build_object('ok', true, 'repeated', true);
    end if;
    perform dominacao.fail('not_member');
  end if;

  select m.kind into my_kind from dominacao.members m where m.room_id = p_room and m.user_id = uid;
  if my_kind is null then perform dominacao.fail('not_member'); end if;
  if my_kind <> 'moderator' or room.created_by <> uid then
    perform dominacao.fail('moderator_only');
  end if;

  insert into dominacao.deleted_rooms (room_id, code, owner_id, member_ids)
  select room.id, room.code, uid, array_agg(m.user_id) from dominacao.members m where m.room_id = room.id;

  -- Aviso aos aparelhos conectados, no mesmo formato dos demais (só a revisão).
  -- Quem não o receber descobre na próxima consulta.
  perform realtime.send(jsonb_build_object('revision', room.revision + 1), 'changed', 'dominacao:' || room.id, true);

  delete from dominacao.rooms where id = room.id;
  return jsonb_build_object('ok', true, 'repeated', false);
end;
$$;

-- O código pertence a uma sala apagada? "wasMember" diz se quem pergunta estava
-- nela. Não revela nada sobre salas que existem.
create function dominacao.room_gone(p_code text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select jsonb_build_object('gone', true,
                               'wasMember', coalesce((select auth.uid()) = any (d.member_ids), false))
     from dominacao.deleted_rooms d
     where d.code = upper(btrim(coalesce(p_code, '')))),
    jsonb_build_object('gone', false, 'wasMember', false));
$$;

-- -----------------------------------------------------------------------------
-- API pública (SECURITY INVOKER)
-- -----------------------------------------------------------------------------

create function public.dc_delete_room(p_room uuid) returns jsonb
language sql volatile security invoker set search_path = '' as $$
  select dominacao.delete_room(p_room);
$$;

create function public.dc_room_gone(p_code text) returns jsonb
language sql stable security invoker set search_path = '' as $$
  select dominacao.room_gone(p_code);
$$;

-- Salas que a pessoa criou. Só o criador é moderador; o RLS limita o resto.
create function public.dc_owned_rooms() returns jsonb
language sql stable security invoker set search_path = '' as $$
  select coalesce(jsonb_agg(entry order by created_at desc), '[]')
  from (
    select r.created_at,
           jsonb_build_object(
             'roomId', r.id, 'code', r.code, 'status', r.status, 'round', r.round_number,
             'createdAt', r.created_at,
             'players', (select count(*) from dominacao.members p
                         where p.room_id = r.id and p.kind = 'player')) as entry
    from dominacao.rooms r
    join dominacao.members m on m.room_id = r.id and m.id = dominacao.my_member_id(r.id)
    where m.kind = 'moderator'
    order by r.created_at desc
    limit 100
  ) owned;
$$;

-- -----------------------------------------------------------------------------
-- Execução: funções novas nascem abertas; revoga e libera uma a uma.
-- -----------------------------------------------------------------------------

revoke execute on function
  dominacao.skip_deleted_codes(),
  dominacao.delete_room(uuid),
  dominacao.room_gone(text),
  public.dc_delete_room(uuid),
  public.dc_room_gone(text),
  public.dc_owned_rooms()
from public, anon, authenticated;

grant execute on function
  dominacao.delete_room(uuid),
  dominacao.room_gone(text),
  public.dc_delete_room(uuid),
  public.dc_room_gone(text),
  public.dc_owned_rooms()
to authenticated;

-- Única coisa que quem não entrou pode fazer: um convite antigo mostra que a
-- sala acabou sem precisar criar um usuário só para isso.
grant usage on schema dominacao to anon;
grant execute on function dominacao.room_gone(text), public.dc_room_gone(text) to anon;
