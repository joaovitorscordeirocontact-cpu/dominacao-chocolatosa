# Dominação Chocolatosa · Topa ou Arrisca?

**Jogar:** https://joaovitorscordeirocontact-cpu.github.io/dominacao-chocolatosa/

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
| `/salas/` | Moderador: salas criadas neste aparelho |
| `/entrar/?sala=CÓDIGO` | Convite |
| `/sala/?sala=CÓDIGO` | Participante e capitão |
| `/moderador/?sala=CÓDIGO` | Moderador |
| `/telao/?sala=CÓDIGO` | Telão, somente leitura |

O papel vem do **banco**. Abrir outra rota ou mudar o endereço não muda o que a
pessoa pode fazer.

## Sair e apagar salas

- **Sair da sala** não apaga nada. O moderador volta por **Continuar partida**
  ou **Minhas salas**.
- **Apagar sala** remove para sempre a partida e os dados dela, para todos. Só
  quem criou a sala consegue, e o banco confere isso. Funciona no lobby, com a
  partida em andamento ou encerrada.
  - Na abertura: **Minhas salas** → **Apagar sala**.
  - Dentro da sala: **Configurações da sala** → **Apagar sala**.

O sucesso só aparece depois da confirmação do banco. Sem resposta, a sala
continua na tela e dá para tentar de novo; repetir o pedido não tem efeito extra.

Quem estava na sala vê **Esta sala foi apagada pelo moderador**, mesmo que
estivesse sem internet na hora. Links e QR codes antigos, em outros aparelhos,
mostram **Sala não encontrada ou encerrada**. A identidade anônima e o mascote
são mantidos, e as outras salas não mudam.

Para reconhecer salas apagadas, fica em `dominacao.deleted_rooms` um registro
mínimo: identificador e código da sala, data e os identificadores anônimos do
dono e de quem estava nela. Não há nomes nem dados da partida. O código não é
usado de novo. Os avisos do Realtime (só um número de revisão) são descartados
pelo próprio Supabase.

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
copie-as para `.env.local`. O backend local só escuta no próprio computador:
celulares não o alcançam.

Abas do mesmo perfil compartilham a identidade. Para testar vários papéis, use
perfis ou navegadores diferentes. No Chrome, todas as janelas anônimas também
compartilham uma única identidade entre si.

### B) Com o projeto Supabase

Copie `.env.example` para `.env.local`, preencha a URL e a chave
**publicável** (Dashboard → Project Settings → API Keys) e rode `npm run dev`
(http://localhost:3000). Se o `npm run dev` já estiver ligado, reinicie-o.

Sem essas variáveis, o aplicativo informa que o servidor não está configurado.
Ele não simula partidas.

## Supabase

O projeto do jogo é o **dominacao-chocolatosa**
(`tfggkikrzmsvzmbovgjm`, região `sa-east-1`). Um único projeto atende todas as
salas.

### O que está aplicado

| Item | Estado |
| --- | --- |
| Migrações de `supabase/migrations/` | Aplicadas com `supabase db push` |
| Entrada anônima | Ligada |
| Limite de entradas anônimas | **150 por hora por IP** (o padrão é 30) |
| Realtime | Política em `realtime.messages` (criada pela migração); canal privado |
| Data API | Schema `dominacao` **não** exposto; acesso só pelas funções `dc_*` |
| Sem entrar | A única função liberada é `dc_room_gone`, que só responde sobre salas **apagadas** |
| URLs do Auth | `site_url` é o endereço publicado; redirecionamentos liberados para ele e para `http://localhost:3000` |

As opções globais do painel do Realtime não foram alteradas: o jogo usa canal
privado, autorizado por RLS. Se quiser impedir canais públicos no projeto
inteiro, desligue **Allow public access** em Realtime → Settings. O jogo não
depende disso, e essa combinação não foi testada.

### Alterar o banco

Nunca edite uma migração já aplicada. Crie outra:

```bash
supabase migration new descricao < /dev/null   # a CLI lê o conteúdo da entrada padrão
npm run test:db
supabase db push --dry-run                     # confira antes
supabase db push
```

### Alterar a autenticação

`supabase/hospedado/supabase/config.toml` declara **somente** o que o jogo muda.
Use a CLI **3.x**: nela, `config push` envia apenas o que está declarado e há
`config diff` para conferir antes. Não envie o `supabase/config.toml` da raiz,
que é do ambiente local.

```bash
npx supabase@3 config diff --remote=tfggkikrzmsvzmbovgjm --workdir supabase/hospedado
npx supabase@3 config push --remote=tfggkikrzmsvzmbovgjm --workdir supabase/hospedado
```

Cada aparelho cria um usuário só uma vez: recarregar e reconectar reaproveitam a
sessão. Janelas anônimas e trocas de navegador contam de novo no limite.

O Supabase recomenda CAPTCHA para a entrada anônima. Ele **não** está integrado:
se for ativado no painel, as entradas param de funcionar.

### Validar o projeto

```bash
npm run validar:supabase    # lê .env.local
```

Usa só a chave publicável, como o aplicativo. Confere o acesso negado, a
autorização do canal Realtime, uma partida de 15 rodadas com 4 equipes
(concorrência, espionagem, pagamento duplicado e conservação) e a exclusão de
salas. **Cria dados reais** (3 salas, que o teste apaga, e 11 usuários
anônimos) e imprime o SQL que remove somente o que sobrar. Não faz parte do
`npm run check`.

`supabase db advisors --linked` mostra, como esperado:

- `auth_allow_anonymous_sign_ins` (aviso, 10 políticas): quem joga são usuários
  anônimos. Todas as políticas exigem ser integrante da sala.
- `rls_enabled_no_policy` (informativo, 5 tabelas fechadas): ninguém as lê
  diretamente.
- `auth_leaked_password_protection` (aviso): opção para logins com senha, que o
  jogo não usa.

### Outro projeto

Para montar o jogo em outro projeto, repita: `supabase link`, `supabase db push`
e o `config push` acima. **Prefira um projeto sem outros aplicativos:** usuários
anônimos recebem o papel `authenticated` e passam a atender às políticas que
confiem apenas nesse papel. Se houver histórico de migrações de outro app, o
`db push` vai acusar versões que não existem nesta pasta. Não use
`migration repair` sem entender o efeito.

No plano Free, o limite documentado do Realtime é de 200 conexões simultâneas e
100 mensagens por segundo no projeto.

### Limpeza

Nada é apagado automaticamente. No dia a dia, use **Apagar sala**. Se o
moderador perdeu o acesso, dá para remover salas antigas no SQL Editor:

```sql
delete from dominacao.rooms where created_at < now() - interval '30 days';
-- Avisos de salas apagadas há muito tempo (os links delas passam a mostrar a
-- mensagem só quando alguém tenta entrar, e o código volta a ficar livre).
delete from dominacao.deleted_rooms where deleted_at < now() - interval '180 days';
```

Salas removidas por SQL não geram o aviso de "apagada pelo moderador".

Usuários anônimos antigos ficam em `auth.users`. Num projeto compartilhado, não
os apague em lote: podem pertencer a outro aplicativo.

## Publicação (GitHub Pages)

Publicado em
https://joaovitorscordeirocontact-cpu.github.io/dominacao-chocolatosa/. O
repositório é **público** (exigência do Pages no GitHub Free): código, imagens e
histórico são visíveis a qualquer pessoa.

Cada push em `main` roda **Publicar no GitHub Pages** (`publicar.yml`), que
confere tipos, lint e testes, gera o site estático e publica. Os testes do banco
rodam em **Verificar**, em paralelo: confira os dois.

| Configuração | Valor |
| --- | --- |
| Settings → Pages → Source | GitHub Actions |
| Variável `PAGES_ENABLED` | `true` (outro valor pausa a publicação) |
| Variável `NEXT_PUBLIC_SUPABASE_URL` | URL do projeto |
| Variável `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | **somente** a chave publicável |

A chave publicável vai no JavaScript do site; isso é esperado, e quem protege os
dados são as permissões no banco. Chaves secretas nunca entram no repositório
nem nas variáveis.

O convite e o QR code usam o endereço em que o moderador está: no site publicado,
apontam para ele. Uma sala criada em `localhost` pertence à identidade do
navegador naquele endereço e não aparece em "Minhas salas" do site publicado.

Mudanças de banco precisam ser aplicadas (`supabase db push`) **antes** do push
do código que depende delas.

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
| `npm test` | Sincronização, reconexão do canal, sala apagada, textos, convites, mascote e perfil |
| `npm run test:db` | Regras, permissões, concorrência, idempotência, conservação e exclusão de salas |
| `npm run validar:supabase` | Valida o projeto hospedado (cria dados reais) |
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

- Na primeira conexão Realtime da história do projeto, uma assinatura falhou uma
  vez com `CHANNEL_ERROR`. Não se repetiu e a causa não foi confirmada. O
  aplicativo tenta de novo e, enquanto isso, consulta o estado periodicamente.

- **Moderador preso à sessão do navegador.** Limpar os dados ou trocar de
  aparelho perde a moderação da sala, inclusive a opção de apagá-la, e não há
  recuperação (só por SQL). Não use janela anônima para moderar.
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
