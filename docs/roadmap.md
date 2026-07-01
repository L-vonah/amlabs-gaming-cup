# AMLabs Gaming Cup — Roadmap de Features

> **Objetivo:** Registro das features planejadas, com escopo, decisões de design e implicações técnicas já definidas. Leia antes de iniciar qualquer implementação dos módulos abaixo.
>
> **Última atualização:** 2026-07-01

---

## Sumário

1. [M1 — Suporte a Duplas](#m1--suporte-a-duplas)
2. [M2 — PWA + Histórico de Campeões](#m2--pwa--histórico-de-campeões)
3. [M3 — Múltiplos Admins](#m3--múltiplos-admins)
4. [M4 — Perfil do Participante](#m4--perfil-do-participante)
5. [Fora do Escopo](#fora-do-escopo)

---

## M1 — Suporte a Duplas

> **Status:** ✅ Concluído (PR #17).

### Motivação

Campeonatos de sinuca na AMLabs são sempre jogados em duplas sorteadas. O sistema atual trata cada time como tendo um único participante, o que impossibilita representar duplas e o fluxo de sorteio.

### Escopo

- Qualquer tipo de competição (não só sinuca) poderá ter `teamMode: 'duplas'`
- Dois modos de formação: admin define manualmente ou sistema sorteia aleatoriamente
- Jogadores se inscrevem individualmente; admin os pareia via interface de pairing
- Nome e abreviação do time gerados automaticamente a partir dos nomes dos participantes

### Fora do Escopo (M1)

- Triplas ou times com 3+ jogadores
- Drag-and-drop no pairing board (aprimoramento futuro)
- Inscrição pública em pares (inscriptions são sempre individuais)

---

### Modelo de Dados

#### Novos campos no torneio (`campeonato`)

```javascript
campeonato: {
  nome: '',
  gameType: '',            // existente
  teamMode: 'individual',  // NOVO: 'individual' | 'duplas'
  drawMode: 'admin',       // NOVO: 'admin' | 'sorteio' — só relevante quando teamMode = 'duplas'
  status: 'configuracao'
}
```

| `teamMode`   | `drawMode`  | Comportamento |
|-------------|-------------|---------------|
| `individual` | —           | Fluxo atual, sem mudanças |
| `duplas`     | `admin`     | Admin pareia manualmente via pairing board |
| `duplas`     | `sorteio`   | Admin aciona sorteio aleatório; pode re-sortear antes de iniciar |

#### Novos campos no Time (schema v3)

```javascript
{
  id: 'time_xxx',
  nome: 'Lucas & João',       // auto-gerado para duplas; admin pode editar depois
  abreviacao: 'LJ',            // auto-gerado: iniciais dos participantes
  cor: '#6c5ce7',              // aleatória quando auto-gerado
  participante: 'Lucas',       // existente
  participante2: null,         // NOVO: null = torneio individual
}
```

**Retrocompatibilidade:** `participante2: null` para todos os times existentes. Schema v3 migration em `migrateState()`.

**Nota sobre nomes duplicados:** se dois inscritos tiverem o mesmo primeiro nome (ex: dois "Lucas"), o admin edita o nome do time manualmente após o pairing via fluxo existente de edição de time. Não há detecção automática de colisão.

#### Inscrição para duplas

No modo duplas, a inscrição pública é simplificada — o jogador informa apenas seu nome (não informa nome de time, abreviação ou cor, pois esses são gerados após o pairing):

```javascript
{
  id: 'insc_xxx',
  torneiId: '{uuid}',
  participante: 'Lucas',
  status: 'pendente',
  // nome, abreviacao, cor: ausentes em torneios de duplas
}
```

---

### Fluxo de Pairing (UI)

**Fase:** `configuracao` — após admin aprovar inscrições e antes de gerar a fase de grupos.

```
Jogadores aprovados (não pareados)     Duplas formadas
┌──────────────────────────────┐       ┌──────────────────────────┐
│  [ ] Lucas                   │       │  Lucas & João        [✕] │
│  [ ] João                    │  →    │  Maria & Pedro       [✕] │
│  [ ] Maria                   │       └──────────────────────────┘
│  [ ] Pedro                   │
└──────────────────────────────┘
         [Criar Dupla]   [Sortear Todos]
```

**Interações:**
- Admin seleciona 2 jogadores via checkbox → botão "Criar Dupla" ativa → clica → dupla criada
- Botão "Sortear Todos" pareamento aleatório de todos os jogadores pendentes
- Cada dupla criada tem botão [✕] para desfazer (retorna jogadores ao pool)
- Admin pode re-sortear enquanto status = `configuracao`
- Nomes/cores das duplas podem ser editados após criação (fluxo existente de editar time)

**Bloqueio de número ímpar:**
- "Sortear Todos" verifica: se `jogadores_pendentes.length % 2 !== 0` → toast de erro: *"Número ímpar de jogadores. Adicione ou remova um participante antes de sortear."*
- "Criar Dupla" não tem esse problema (sempre seleciona exatamente 2)

---

### Geração Automática de Nome/Abreviação

```javascript
// Nome: "PrimeiroNome1 & PrimeiroNome2"
nome = `${primeiroNome(p1)} & ${primeiroNome(p2)}`

// Abreviação: iniciais maiúsculas, máx 3 chars
abreviacao = (inicial(p1) + inicial(p2)).toUpperCase()  // ex: "LJ"
// Se colisão de abreviação: adiciona segunda letra do segundo nome
```

---

### Impacto nos Módulos Existentes

| Módulo | Impacto |
|--------|---------|
| `state.js` | `migrateState` v3, `calcularClassificacao` sem mudanças (usa time.id), `DEFAULT_STATE` com novos campos |
| `firestore-service.js` | `createTournament()` recebe `teamMode` e `drawMode`; `convertStateToFirestore/FromFirestore` passa novos campos |
| `actions.js` | Nova ação `pairPlayers(p1Id, p2Id)`, `shufflePairs()`, `unpairTeam(teamId)` |
| `renderers.js` | `renderTimes()` exibe `participante2` quando presente; `renderClassificacao()` idem |
| `renderers-home.js` | Mini-classificação e mini-bracket exibem ambos os nomes |
| `campeonato.html` | Nova seção/modal de pairing board |
| `css/style.css` | Estilos do pairing board |
| `portal.js` | `portalCreateTournament()` recebe `teamMode` e `drawMode` |
| `index.html` | Formulário de criação: seletor de `teamMode` (visual cards) e `drawMode` |

---

### Schema Migration v3

```javascript
if (version < 3) {
  // Add participante2 to all times
  if (state.times) {
    state.times.forEach(t => {
      if (t.participante2 === undefined) t.participante2 = null;
    });
  }
  // Add teamMode and drawMode to campeonato
  if (!state.campeonato.teamMode) state.campeonato.teamMode = 'individual';
  if (!state.campeonato.drawMode) state.campeonato.drawMode = 'admin';
}
```

---

## M2 — PWA + Histórico de Campeões

> **Status:** ✅ Concluído (PR #18).

### Motivação

- **PWA:** Participantes acessam o site pelo celular. Instalar como app melhora a experiência e permite visualização offline do bracket.
- **Histórico:** Memória dos campeonatos passados na landing page. Dado já existe no Firestore.

### PWA

**Arquivos novos:**
- `manifest.json` na raiz — nome, ícones, cor de tema, `display: standalone`
- `js/sw.js` — service worker para cache de assets estáticos (HTML, CSS, JS, logo)

**Mudanças em `index.html` e `campeonato.html`:**
- `<link rel="manifest" href="/manifest.json">`
- `<meta name="theme-color">` (cor primária `#6c5ce7`)
- Registro do service worker no bootstrap

**Escopo do cache (offline):**
- Assets estáticos: HTML, CSS, JS, logo, fontes
- Dados do Firestore: já tem cache offline nativo via IndexedDB (Firestore persistence)
- **Não** cacheia atualização em tempo real — offline mostra último estado conhecido

### Histórico de Campeões

**Onde:** Seção nova na landing (`index.html`), abaixo da lista de torneios ativos.

**Dados:** `campeao` já existe em cada doc `campeonatos/{uuid}`. `listTournaments()` em `firestore-service.js` já retorna os torneios — basta incluir `campeao` no retorno e renderizar.

```
🏆 Campeões
──────────────────────────────────────────
Sinuca 2025/1    ⚫ Sinuca    Lucas & João
Sinuca 2024/2    ⚫ Sinuca    Maria & Pedro
──────────────────────────────────────────
```

**Impacto:**
- `firestore-service.js`: adicionar `campeao` ao retorno de `listTournaments()`
- `portal.js`: renderizar seção de histórico
- `css/style.css`: estilos da seção

---

## M3 — Múltiplos Admins

> **Status:** ✅ Concluído (PR #20, 2026-06-30). Emails autorizados: `vonah.dev@gmail.com` e `putumuju93@gmail.com`. ⚠️ Requer deploy manual das `firestore.rules` (`firebase deploy --only firestore:rules`).

### Motivação

Atualmente há um único admin (`vonah.dev@gmail.com`). Será necessário um segundo admin para gerenciar campeonatos de sinuca.

### Design

Substituir `ADMIN_EMAIL` (string) por `ADMIN_EMAILS` (array) em `auth.js`:

```javascript
// auth.js — antes
const ADMIN_EMAIL = 'vonah.dev@gmail.com';

// auth.js — depois
const ADMIN_EMAILS = [
  'vonah.dev@gmail.com',
  'segundo-admin@amlabs.com'   // email a ser definido
];

function isAdmin() {
  return currentUser && ADMIN_EMAILS.includes(currentUser.email);
}
```

**`firestore.rules` também precisa ser atualizado** — a regra de escrita usa o email hardcoded:

```
// Antes
allow write: if request.auth.token.email == 'vonah.dev@gmail.com';

// Depois
allow write: if request.auth.token.email in [
  'vonah.dev@gmail.com',
  'segundo-admin@amlabs.com'
];
```

> **Atenção:** `firestore.rules` requer publicação manual via Firebase Console ou CLI após alteração. Não é um arquivo estático — mudanças no repositório não têm efeito sem redeploy das rules.

### Escopo

- Ambos os admins têm acesso total (sem diferenciação de permissões por torneio)
- Permissões granulares por campeonato estão fora do escopo

---

## M4 — Perfil do Participante

> **Status:** 🔜 Planejado — depende do M1 (concluído).

### Motivação

Dar aos participantes visibilidade do próprio histórico entre campeonatos: em quais competições estiveram, como foram seus resultados, o que está por vir.

### Identificação

**Nome** como identificador principal entre torneios — o admin ajusta nomes duplicados manualmente no momento da criação dos times. Email é um campo adicional opcional a ser introduzido futuramente para maior precisão de identificação (ex: duas pessoas com o mesmo nome), mas não é necessário para o MVP do perfil.

### O que exibir

| Seção | Conteúdo |
|-------|----------|
| **Cabeçalho** | Nome, email, foto (gravatar por email, fallback ao avatar gerado) |
| **Campeonatos** | Lista de torneios em que participou ou está participando (nome, jogo, posição final ou status atual) |
| **Últimas partidas** | Últimos 5 resultados: adversário, placar/vencedor, torneio |
| **Próximas partidas** | Partidas agendadas no(s) torneio(s) ativo(s) |

**Fora do escopo:** estatísticas de artilharia, saldo de gols, ranking entre jogadores.

### Implementação

- Computed client-side: busca todos os torneios via `listTournaments()`, filtra pelo email do participante
- Sem nova coleção no Firestore para MVP
- Escala limitada (adequada para ~20 torneios ao longo dos anos)
- **Ponto de entrada:** clique no nome/avatar de um participante em qualquer lista → abre modal ou página de perfil

### Dependência

**Requer M1 concluído** — o campo `participante2` no time entity é necessário para exibir corretamente duplas no perfil.

---

## Fora do Escopo

Itens deliberadamente excluídos do roadmap:

| Feature | Motivo |
|---------|--------|
| Agenda de partidas | Sem demanda identificada |
| Compartilhamento de resultados | Sem demanda identificada |
| Novos tipos de jogo | Sem previsão de novos jogos |
| Múltiplos grupos (fase suíça, etc.) | Sem demanda para o porte atual |
| Permissões granulares por torneio | Complexidade não justificada (2 admins, ferramenta interna) |
| Drag-and-drop no pairing board | Aprimoramento futuro do M1, não MVP |
| Triplas ou times com 3+ jogadores | Fora do escopo do M1 (pode revisar se houver demanda) |
| Analytics avançado | Escala pequena (6-12 participantes por torneio) |

---

## Ordem de Implementação Recomendada

```
M3 (Multi-admin)     ✅ concluído (PR #20)
        ↓
M1 (Duplas)          ✅ concluído (PR #17)
        ↓
M2 (PWA + Histórico) ✅ concluído (PR #18)
        ↓
M4 (Perfil)          🔜 próximo — depende de M1 (concluído)
```
