# Dominação Chocolatosa · Topa ou Arrisca?

Primeira versão **visual e navegável** do jogo presencial de equipes. É uma
demonstração local: sem servidor, banco de dados, login ou conexão entre aparelhos.

## Como executar

Requer Node.js 22.18 ou mais recente.

```bash
npm install
npm run dev        # http://localhost:3000
```

Versão de produção: `npm run build && npm start`.

Para abrir no celular (mesma rede Wi-Fi), use `http://IP-DO-COMPUTADOR:3000`.
Cada aparelho terá a sua própria demonstração, sem sincronização.

| Comando | O que faz |
| --- | --- |
| `npm run check` | Tipos, lint, testes e build |
| `npm test` | Testes das regras (representante, contador, maletas, bônus, persistência) |
| `npm run assets` | Regera `public/assets/` a partir de `image-assets/` (requer Python 3 e Pillow) |

## Telas

| Rota | Tela |
| --- | --- |
| `/` | Abertura |
| `/personagem` | Mascote: nome, cor e acessórios |
| `/fabrica` | Capitão, nome, modelo e fundo da fábrica |
| `/lobby` | Equipe, participações e representante |
| `/palco` | 60 maletas e confronto (visão do capitão) |
| `/moderador` | Comandos da demonstração |
| `/telao` | Composição para a sala |

O botão **Demo · trocar visão** alterna entre capitão, moderador e telão.
Os dados ficam no `localStorage`. Janelas do **mesmo navegador** acompanham umas
às outras (útil para moderador no computador e telão numa segunda tela).

## Organização

```
image-assets/            originais (não são alterados)
scripts/preparar-assets.py
public/assets/           recortes gerados
src/app/                 rotas (App Router)
src/components/          mascot, character, factory, lobby, stage, moderator, screen, home, demo, ui
src/lib/                 tipos, catálogo, dados fictícios, regras puras e estado local
src/data/accessory-layout.json   posição de cada acessório no mascote
src/app/globals.css      tokens visuais, materiais e fundos das fábricas
tests/
```

## O que é só demonstração

- Participantes, as três outras fábricas e as participações iniciais são fictícios.
- Os valores das maletas são fictícios e fixos por número (`caseResult` em
  `src/lib/stage.ts`). Não são o baralho nem a economia do jogo.
- Escolher maletas pelas outras fábricas, inverter, trocar e dar bônus são
  controles de demonstração. Não há permissões reais: qualquer pessoa abre
  `/moderador`.
- A "batalha pelas cartas" apenas trava a escolha e conta a participação.

## Limitações dos assets

- **Bigode e barba:** no molde há pouco espaço entre olhos e boca, então eles
  cobrem parte do sorriso. O bigode também encosta nos óculos.
- **Cabelo longo e capa:** são peças só frontais. Cobrem parte dos braços ou do
  corpo.
- **Combinações:** não há versões dos cabelos adaptadas a chapéus. As peças são
  sobrepostas em camadas.
- **Cores do corpo:** foram geradas por script a partir do molde branco.
- **Resolução:** as fábricas têm cerca de 350–400 px e o mascote cerca de 500 px.
  Num telão grande podem perder nitidez. Para a versão final, convém exportar
  em pelo menos o dobro.
- **Abertura:** usa recortes sem texto da referência (laterais e base). No celular,
  a onda superior é desenhada em SVG.
