-- Correção: apagar uma sala falhava quando havia carta com alvo (Informante,
-- Roubo de receita ou Coringa). A cascata removia as equipes antes dos
-- registros que apontavam para elas.
--
-- Estas quatro referências não têm cascata. A checagem passa para o FIM da
-- transação: continua proibido gravar referência quebrada, mas a exclusão de
-- uma sala inteira consegue concluir todas as cascatas antes da conferência.

alter table dominacao.members
  alter constraint members_room_id_team_id_fkey deferrable initially deferred;
alter table dominacao.power_uses
  alter constraint power_uses_room_id_target_team_id_fkey deferrable initially deferred;
alter table dominacao.round_teams
  alter constraint round_teams_room_id_representative_id_fkey deferrable initially deferred;
alter table dominacao.spy_grants
  alter constraint spy_grants_room_id_member_id_fkey deferrable initially deferred;
