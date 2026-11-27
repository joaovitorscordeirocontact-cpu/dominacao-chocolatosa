/** Códigos de regra devolvidos pelo banco (`dc:<código>`) e suas explicações. */
const MESSAGES: Record<string, string> = {
  not_configured:
    "O servidor da partida não está configurado neste site. Nenhuma sala pode ser criada ou aberta.",
  network: "Sem resposta do servidor. Confira a internet e tente de novo; a ação não será repetida em dobro.",
  server: "O servidor recusou o pedido. Tente de novo em instantes.",
  unauthenticated: "Sua sessão expirou. Recarregue a página.",
  anonymous_disabled: "O projeto da partida está com a entrada anônima desativada. Avise quem organiza.",
  auth_rate_limit:
    "Muitas entradas pela mesma rede em pouco tempo. Aguarde alguns minutos ou entre usando os dados móveis.",
  not_member: "Você não faz parte desta sala.",
  moderator_only: "Somente o moderador pode fazer isso.",
  captain_only: "Somente a liderança da fábrica pode fazer isso.",
  player_only: "Somente participantes podem fazer isso.",
  wrong_stage: "A partida já está em outra etapa.",
  command_reused: "Pedido repetido de forma inválida. Tente novamente.",
  bad_arguments: "Dados inválidos.",
  unknown_command: "Ação desconhecida. Recarregue a página para atualizar o aplicativo.",
  too_many_rooms: "Limite de salas criadas hoje neste aparelho foi atingido.",
  too_many_attempts: "Muitas tentativas com códigos errados. Aguarde 10 minutos.",
  room_not_found: "Sala não encontrada ou encerrada.",
  room_ended: "Esta partida já foi encerrada.",
  entries_closed: "As entradas estão fechadas. Peça ao moderador para reabrir.",
  room_full: "A sala está cheia.",
  too_many_screens: "Esta sala já atingiu o limite de telões.",
  name_required: "Escreva seu nome.",
  member_not_found: "Essa pessoa não está mais disponível.",
  member_in_team: "Essa pessoa já está numa equipe.",
  member_not_in_team: "Escolha alguém da sua própria equipe.",
  team_not_found: "Equipe não encontrada.",
  team_count: "Escolha 2, 3 ou 4 capitães.",
  captains_must_differ: "Cada equipe precisa de um capitão diferente.",
  unbalanced_team: "Coloque a pessoa numa das menores equipes, para manter o equilíbrio.",
  already_captain: "Essa pessoa já é capitã.",
  factory_name_required: "Dê um nome à fábrica antes de confirmar.",
  economy_missing: "Salve a configuração dos bombons antes de começar.",
  factories_not_ready: "Ainda há fábricas sem confirmação.",
  economy_does_not_fit: "A configuração não cabe no estoque de bombons.",
  representatives_missing: "Ainda falta representante de alguma fábrica.",
  order_must_list_all_teams: "A classificação e a ordem precisam incluir todas as fábricas, uma vez cada.",
  target_required: "Escolha a fábrica alvo.",
  combo_already_used: "Essa fábrica já usou uma combinação nesta rodada.",
  nothing_to_undo: "Não há o que desfazer.",
  spy_already_seen: "A maleta já foi vista: essa espionagem não pode ser desfeita.",
  spy_pending: "Há uma espionagem autorizada que ainda não foi usada.",
  spy_not_authorized: "Não há espionagem autorizada para você agora.",
  spy_already_used: "Sua espionagem já foi usada em outra maleta.",
  case_unavailable: "Essa maleta não está disponível.",
  not_your_turn: "Ainda não é a vez da sua fábrica.",
  all_picked: "Todas as fábricas já escolheram.",
  picks_missing: "Ainda há fábricas sem maleta.",
  special_already_used: "Essa fábrica já usou uma carta especial nesta rodada.",
  plus2_exhausted: "As oito cartas +2 do jogo já foram usadas.",
  plus4_exhausted: "As quatro cartas +4 do jogo já foram usadas.",
  conservation_broken: "A conta de bombons não fechou; o pagamento foi cancelado.",
  last_round: "A 15ª rodada é a última.",
  end_after_payment: "Só é possível encerrar depois de concluir um pagamento.",
};

export class GameError extends Error {
  readonly code: string;
  readonly detail: string;

  constructor(code: string, detail = "") {
    super(MESSAGES[code] ?? MESSAGES.server);
    this.name = "GameError";
    this.code = code;
    this.detail = detail;
  }
}

type BackendFailure = { message?: string; details?: string | null; code?: string | null; status?: number };

/** Converte erros do PostgREST, do Auth ou da rede em um erro do jogo. */
export function toGameError(error: unknown): GameError {
  if (error instanceof GameError) return error;
  const failure = (error ?? {}) as BackendFailure;
  const message = failure.message ?? "";
  if (message.startsWith("dc:")) return new GameError(message.slice(3), failure.details ?? "");
  if (failure.code === "anonymous_provider_disabled" || /anonymous sign-ins are disabled/i.test(message)) {
    return new GameError("anonymous_disabled");
  }
  if (failure.status === 429 || /rate limit/i.test(message)) return new GameError("auth_rate_limit");
  if (/failed to fetch|fetch failed|networkerror|load failed|network request|aborted|timeout/i.test(message)) {
    return new GameError("network");
  }
  return new GameError("server", message);
}
