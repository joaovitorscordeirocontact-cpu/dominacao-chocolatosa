# Dominação Chocolatosa · Topa ou Arrisca?

Jogo presencial de equipes. Cada pessoa participa pelo próprio celular, o
moderador conduz as etapas e um telão mostra o que é público. A disputa bíblica
e as cartas continuam **físicas**.

- **Interface:** Next.js (App Router) exportado como site **estático**, com
  React, TypeScript, Tailwind CSS e Motion.
- **Partida:** Supabase. O Postgres guarda tudo e aplica as regras em funções
  transacionais; o Realtime avisa os aparelhos. Não há servidor Node próprio.

## Fluxo

1. O organizador toca em **Criar sala** e vira moderador. A sala tem código, link
   e QR code.
2. Quem abre o convite informa o nome, monta o mascote e entra no lobby, sem
   cadastro (sessão anônima).
3. O moderador escolhe 2, 3 ou 4 capitães. O banco sorteia as demais pessoas
   (diferença máxima de uma por equipe). As entradas se fecham.
4. Cada capitão monta a fábrica (nome, modelo e fundo) e a equipe acompanha.
5. O moderador informa os bombons e começa: as 60 maletas são sorteadas e
   fixadas no banco.
6. Cada rodada (no máximo 15): representantes → batalha pelas cartas →
   preparação (combinações) → escolha das maletas → revelação e cartas
   especiais → conferência → pagamento → próxima rodada ou encerramento.

| Rota | Quem usa |
| --- | --- |
| `/` | Abertura: criar, entrar ou continuar |
| `/entrar/?sala=CÓDIGO` | Convite |
| `/sala/?sala=CÓDIGO` | Participante e capitão |
| `/moderador/?sala=CÓDIGO` | Moderador |
| `/telao/?sala=CÓDIGO` | Telão, somente leitura |

O papel vem do **banco**. Abrir outra rota ou mudar o endereço não muda o que a
pessoa pode fazer.

## Executar localmente

Requer Node.js 22.18 ou mais recente.

```bash
npm install
```

### A) Sem projeto Supabase (somente desenvolvimento)

Requer PostgreSQL 17 instalado. O backend local **não é o Supabase**: é um
emulador mínimo de entrada anônima, RPC e Realtime sobre um banco temporário com
as migrações reais. Os dados somem ao encerrá-lo.

```bash
npm run backend:local     # terminal 1: mostra as duas variáveis
```

No terminal 2, rode `npm run dev` com as variáveis que o terminal 1 mostrou, ou
copie-as para `.env.local`. Para testar vários papéis no mesmo computador, use
janelas anônimas ou perfis diferentes: abas comuns compartilham a identidade.

### B) Com um projeto Supabase

Copie `.env.example` para `.env.local`, preencha a URL e a chave
**publicável** e rode `npm run dev` (http://localhost:3000).

Sem essas variáveis, o aplicativo informa que o servidor não está configurado.
Ele não simula partidas.

## Configurar o Supabase

Um único projeto atende todas as salas. **Prefira um projeto sem outros
aplicativos**, porque os passos 2 e 3 valem para o projeto inteiro.

1. **Migração.** Num projeto dedicado:
   ```bash
   supabase link --project-ref SEU_REF
   supabase db push --dry-run   # confira antes
   supabase db push
   ```
   Se o projeto já tiver o histórico de migrações de outro aplicativo, o
   `db push` vai acusar versões que não existem nesta pasta. Não use
   `migration repair` sem entender o efeito: aplique o arquivo de
   `supabase/migrations/` pelo SQL Editor.
   A migração cria o schema `dominacao`, funções `dc_*` em `public` e uma
   política em `realtime.messages` restrita aos tópicos `dominacao:*`.
2. **Authentication → Sign In / Providers → Allow anonymous sign-ins.**
   Atenção em projeto compartilhado: usuários anônimos recebem o papel
   `authenticated` e passam a atender às políticas de **outros aplicativos** que
   confiem apenas nesse papel.
3. **Authentication → Rate Limits → anonymous sign-ins.** O padrão é **30 por
   hora por IP**. Com 20 a 30 participantes, moderador e telão no mesmo Wi-Fi,
   isso pode ser insuficiente. Use pelo menos 150 antes de um evento. Cada
   aparelho cria um usuário só uma vez (recarregar e reconectar reaproveitam a
   sessão), mas janelas anônimas e trocas de navegador contam de novo.
4. **Não** adicione `dominacao` aos schemas expostos da Data API. O acesso é só
   pelas funções `dc_*`.
5. O canal do jogo é **privado** e protegido por RLS. Não é preciso mudar as
   configurações globais do Realtime. No plano Free, o limite documentado é de
   200 conexões simultâneas e 100 mensagens por segundo no projeto.
6. Copie a URL e a chave publicável (`sb_publishable_…`). **Nunca** use a chave
   secreta nem a `service_role` no aplicativo.
7. Rode `supabase db advisors --linked`. São esperados avisos informativos de
   "RLS sem política" nas 4 tabelas secretas, que ninguém pode ler diretamente.

O Supabase recomenda CAPTCHA para a entrada anônima. Ele **não** está integrado:
se for ativado no painel, as entradas param de funcionar.

### Limpeza

Nada é apagado automaticamente. Para remover salas antigas (SQL Editor):

```sql
delete from dominacao.rooms where created_at < now() - interval '30 days';
```

Usuários anônimos antigos ficam em `auth.users`. Em projeto compartilhado, não os
apague em lote: podem pertencer a outro aplicativo.

## Publicar no GitHub Pages

O workflow `publicar.yml` fica **desligado** até ser habilitado.

- No **GitHub Free**, o Pages exige repositório **público** (ou plano Pro). O
  repositório é privado, e mudar isso é uma decisão sua: o código e as imagens
  ficariam públicos. Mesmo com Pro e repositório privado, o **site** publicado
  é acessível a qualquer pessoa.
- Depois de decidir:
  1. Settings → Pages → Source: **GitHub Actions**.
  2. Settings → Secrets and variables → Actions → **Variables**:
     `PAGES_ENABLED=true`, `NEXT_PUBLIC_SUPABASE_URL` e
     `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
  3. Rode "Publicar no GitHub Pages" na aba Actions.

O `basePath` é obtido automaticamente. Para conferir localmente um build em
subpasta:

```bash
NEXT_PUBLIC_BASE_PATH=/dominacao-chocolatosa npm run build
NEXT_PUBLIC_BASE_PATH=/dominacao-chocolatosa npm start
```

## Regras implementadas

### Bombons

- Saldo inicial total = equipes × saldo inicial. Reserva das cartas de bônus =
  8×2 + 4×4 = **32**.
- Limite da soma das maletas positivas (**verba**) = total − saldo inicial total
  − 32.
- A partida só começa com verba de pelo menos **62** (para que o menor ganho
  valha 1).

**Distribuição das 60 maletas** (constante em `dominacao.case_distribution`).
Cada valor é `piso(verba × peso / 62)`:

| Tipo | Quantidade (peso) |
| --- | --- |
| Ganho | 14 (1) · 10 (2) · 5 (4) · 1 (8) |
| Perda fixa | 6 (1) · 4 (2) |
| Perde ⅓ do saldo do início da rodada | 8 |
| Zero | 12 |

A soma dos ganhos nunca passa da verba. O que sobra do arredondamento fica no
banco.

- Perda fixa nunca deixa saldo negativo. Um terço é arredondado para baixo
  (10 → 3, 6 → 2).
- Bloqueio anula maleta negativa. Os bônus entram depois.
- No pagamento, o banco e as fábricas continuam somando o total. A transação é
  cancelada se a conta não fechar.

### Cartas

- Uma combinação por fábrica por rodada. A azul libera a espionagem no celular do
  capitão. Amarela, verde e vermelha são presenciais; o app registra equipe,
  poder e alvo.
- Uma carta especial por fábrica por rodada: Inverter, Coringa, Bloqueio, +2
  (8 na partida) e +4 (4 na partida).
- Inverter move cada maleta para a próxima fábrica **na ordem de jogada**.
  Saldos, bônus e proteções ficam onde estão.

### Decisões tomadas onde o enunciado não detalhava

- Na classificação da batalha, a última colocada é a que não recebe cartas.
- Encerrar a preparação com espionagem não usada exige confirmação, e a
  autorização se perde.
- É possível desfazer: a combinação (menos espionagem já usada), a última
  escolha de maleta (antes da revelação) e a última carta especial.
- Quem chega depois do sorteio só entra se o moderador reabrir as entradas, e
  aguarda até ser colocado numa das menores equipes.
- O moderador pode passar a liderança a outra pessoa, caso o aparelho do capitão
  falhe. Uma espionagem já feita continua visível só para quem a fez.
- Dá para encerrar depois de um pagamento, ou numa rodada recém-aberta em que
  nada aconteceu.

## Segurança

- Tabelas no schema `dominacao` (não exposto), com RLS em todas. Os clientes têm
  só leitura, por colunas, das salas das quais participam.
- Conteúdo das maletas, espionagens e registro de comandos não têm nenhum grant.
  O conteúdo só vai para a parte pública na revelação.
- A API pública (`dc_*`) é `SECURITY INVOKER`. As funções `SECURITY DEFINER`
  ficam no schema privado, com `search_path` fixo, e validam usuário, sala, papel
  e etapa.
- Os avisos do Realtime levam apenas o número da revisão. Cada aparelho busca o
  estado que tem permissão de ver.

## Verificação

```bash
npm run check   # tipos, lint, testes, testes do banco e build
```

`npm run test:db` cria um PostgreSQL temporário (porta própria) e o apaga ao
final. Para usar um servidor existente, defina `DATABASE_URL`.

| Comando | O que faz |
| --- | --- |
| `npm test` | Sincronização, textos, convites, mascote e migração do perfil |
| `npm run test:db` | Regras, permissões, concorrência, idempotência e conservação |
| `npm run assets` | Regera `public/assets/` (Python 3 e Pillow) |

Os testes do banco usam `supabase/tests/supabase-shim.sql`, que imita o mínimo
do Supabase. **Nunca aplique esse arquivo num projeto real.**

## Organização

```
image-assets/            originais (não são alterados)
scripts/                 preparo dos assets e servidor estático local
src/app/                 rotas
src/components/          telas por papel e componentes visuais
src/lib/room/            tipos, API, sincronização e textos da sala
src/data/accessory-layout.json   âncoras e camadas dos acessórios
supabase/migrations/     banco, permissões e regras
tests/                   unidade, banco e backend local
```

## Limitações conhecidas

- **Moderador preso à sessão do navegador.** Limpar os dados ou trocar de
  aparelho perde a moderação da sala, e não há recuperação. Não use janela
  anônima para moderar.
- Um participante que perde a sessão entra como pessoa nova. No lobby, o
  moderador pode remover o registro antigo.
- **Bigode e barba** cobrem parte do sorriso, e o bigode encosta nos óculos. Eles
  vêm da primeira folha de acessórios.
- Sob chapéus, o cabelo é recortado para não atravessar a peça.
- A capa é esticada na largura para aparecer nas laterais.
- Fábricas (~350–400 px) e mascote (~500 px) podem perder nitidez num telão
  grande. Convém exportar a arte final em pelo menos o dobro.
- Nomes muito longos sem espaços são quebrados no meio quando chegam ao menor
  tamanho legível (12 px).
