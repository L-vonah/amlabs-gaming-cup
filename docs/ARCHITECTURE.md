# AMLabs Gaming Cup — Documentação Técnica

> **Objetivo:** Referência completa para qualquer desenvolvedor ou agente que precise entender, modificar ou estender o projeto. Leia este documento ANTES de propor qualquer mudança.
>
> **Última atualização:** 2026-03-24

---

## Sumário

1. [Visão Geral](#1-visão-geral)
2. [Stack Técnica](#2-stack-técnica)
3. [Estrutura de Arquivos](#3-estrutura-de-arquivos)
4. [Entidades e Modelo de Dados](#4-entidades-e-modelo-de-dados)
5. [Ciclo de Vida do Campeonato](#5-ciclo-de-vida-do-campeonato)
6. [Regras de Negócio](#6-regras-de-negócio)
7. [Arquitetura de Módulos](#7-arquitetura-de-módulos)
8. [Fluxo de Dados e Persistência](#8-fluxo-de-dados-e-persistência)
9. [Strategy Pattern — Formatos de Playoff](#9-strategy-pattern--formatos-de-playoff)
10. [Autenticação e Permissões](#10-autenticação-e-permissões)
11. [Infraestrutura e Deploy](#11-infraestrutura-e-deploy)
12. [Segurança](#12-segurança)
13. [Convenções de Código](#13-convenções-de-código)
14. [Limitações Conhecidas](#14-limitações-conhecidas)
15. [Guia para Mudanças](#15-guia-para-mudanças)

---

## 1. Visão Geral

**Nome:** 1º Campeonato EA Sports FC AMLabs 2026
**Propósito:** Site de campeonato interno da empresa AMLabs para funcionários jogarem EA Sports FC entre si.
**URL produção:** https://amlabs-cup.netlify.app
**URL backup:** https://l-vonah.github.io/amlabs-gaming-cup
**Repositório:** GitHub — L-vonah/amlabs-gaming-cup

O sistema gerencia todo o ciclo de um campeonato de futebol virtual: inscrição de times, fase de grupos (round-robin), playoffs com dupla eliminação, e encerramento com campeão.

---

## 2. Stack Técnica

| Componente | Tecnologia |
|-----------|------------|
| Frontend | HTML5 + CSS3 + Vanilla JavaScript (zero frameworks) |
| Fonte tipográfica | Inter (Google Fonts) |
| Persistência local | localStorage + cache em memória |
| Persistência remota | Firebase Firestore (Spark Plan - gratuito) |
| Autenticação | Firebase Auth (Google Login) |
| Offline | Firestore persistence (IndexedDB) + fallback localStorage |
| Hospedagem | Netlify (deploy automático via git push master) |
| Build | Nenhum — arquivos estáticos servidos direto |

**Dependências externas (CDN):**
- Firebase SDK (app, auth, firestore)
- Google Fonts (Inter)

---

## 3. Estrutura de Arquivos

```
campeonato-amlabs/
├── index.html                     # SPA shell — todas as seções, modals, formulários
├── css/
│   └── style.css                  # ~2648 linhas — tema claro AMLabs, responsive
├── js/
│   ├── firebase-config.js         # Inicialização Firebase (28 linhas)
│   ├── auth.js                    # Google Login, isAdmin(), updateAdminUI() (89 linhas)
│   ├── firestore-service.js       # CRUD Firestore + real-time listener (203 linhas)
│   ├── state.js                   # Estado centralizado, lógica de domínio (627 linhas)
│   ├── ui.js                      # Helpers: avatar, toast, modal, nav, escape (240 linhas)
│   ├── playoff-formats.js         # 3 estratégias de playoff — Strategy Pattern (921 linhas)
│   ├── renderers-home.js          # Dashboard home (276 linhas)
│   ├── renderers-matches.js       # Partidas + bracket + preview (612 linhas)
│   ├── renderers.js               # Times, classificação, stats, regras, histórico, inscrições (422 linhas)
│   ├── actions.js                 # Event handlers do admin (621 linhas)
│   └── app.js                     # Bootstrap, score modal, mobile nav (354 linhas)
├── assets/
│   └── logo-amlabs.png            # Logo da empresa
├── firestore.rules                # Regras de segurança Firestore
├── .netlify/
│   └── netlify.toml               # Config deploy
└── docs/
    └── ARCHITECTURE.md            # Este documento
```

### Ordem de Carregamento dos Scripts (crítica)

Os scripts são carregados em sequência no `index.html`. A ordem importa porque cada módulo depende dos anteriores:

```
firebase-config.js → auth.js → firestore-service.js → state.js → ui.js
→ playoff-formats.js → renderers-home.js → renderers-matches.js
→ renderers.js → actions.js → app.js
```

---

## 4. Entidades e Modelo de Dados

### 4.1 State — Objeto Principal

Armazenado em `localStorage` (chave: `campeonato_amlabs_v1`) e sincronizado ao Firestore (doc: `campeonatos/amlabs-2026`).

```javascript
{
  campeonato: {
    nome: '1º Campeonato EA Sports FC AMLabs 2026',
    edicao: 1,
    temporada: '2026',
    status: 'configuracao'  // configuracao | grupos | playoffs | encerrado
  },
  config: {
    pontosPorVitoria: 3,
    pontosPorEmpate: 1,
    pontosPorDerrota: 0,
    classificadosPorGrupo: 4,
    criteriosDesempate: ['pontos', 'vitorias', 'saldoGols', 'golsMarcados', 'confrontoDireto']
  },
  times: [],               // Array de Time
  faseGrupos: {
    status: 'aguardando',   // aguardando | andamento | concluida
    partidas: []            // Array de Partida
  },
  playoffs: {
    formato: 'double-elim-4',
    status: 'aguardando',   // aguardando | andamento | concluido
    matches: {}             // Object<matchId, Match>
  }
}
```

### 4.2 Entidades

#### Time
```javascript
{
  id: 'time_1711234567890_a1b2c',  // gerado com Date.now() + random
  nome: 'São Paulo FC',
  abreviacao: 'SPF',               // 1-3 letras, uppercase, só [A-Za-z]
  cor: '#6c5ce7',                   // hex color
  participante: 'João'             // nome do jogador real
}
```

#### Partida (Fase de Grupos)
```javascript
{
  id: 'rr_1_0',           // formato: rr_{rodada}_{index}
  rodada: 1,
  timeA: 'time_xxx',      // id do time mandante
  timeB: 'time_yyy',      // id do time visitante
  golsA: null,            // null = pendente, number = concluída
  golsB: null,
  status: 'pendente'      // pendente | concluida
}
```

#### Match (Playoffs)
```javascript
{
  id: 'ub-sf1',           // identificador do match no bracket
  fase: 'Semifinal da Chave Superior 1',
  label: '1º vs 4º',
  timeA: null,            // preenchido pela propagação
  timeB: null,
  golsA: null,
  golsB: null,
  vencedor: null,         // id do time vencedor
  perdedor: null,         // id do time perdedor
  penaltyWinner: null     // id do time que venceu nos pênaltis (quando empate)
}
```

#### Inscrição
```javascript
{
  id: 'insc_xxx' | 'firestore-auto-id',
  torneiId: 'amlabs-2026',
  participante: 'João',
  nome: 'São Paulo FC',
  abreviacao: 'SPF',
  cor: '#6c5ce7',
  status: 'pendente',     // pendente | aprovado | rejeitado
  criadoEm: 'ISO date',
  device: 'PC-XXXXXXXX',
  resolvidoEm: null,
  resolvidoPor: null
}
```
**Coleção Firestore:** `inscricoes/`

#### Audit Entry
```javascript
{
  id: 'log_xxx' | 'firestore-auto-id',
  torneiId: 'amlabs-2026',
  timestamp: 'ISO date',
  usuario: 'email ou PC-XXXXXXXX',
  acao: 'Adicionou o time "Real Madrid"',
  detalhes: { abreviacao: 'RMA', cor: '#fff', participante: 'Maria' },
  device: 'PC-XXXXXXXX'
}
```
**localStorage:** `campeonato_amlabs_audit_v1` (máx 500 entradas)
**Coleção Firestore:** `auditLog/`

---

## 5. Ciclo de Vida do Campeonato

```
configuracao ──→ grupos ──→ playoffs ──→ encerrado
     │              │           │
     │              │           └── resetPlayoffs() volta para 'grupos'
     │              │
     │              └── pode adicionar times (regenera partidas)
     │
     └── pode adicionar/remover times e aprovar inscrições
```

### Transições e Gatilhos

| De → Para | Gatilho | Validação |
|-----------|---------|-----------|
| `configuracao` → `grupos` | `gerarFaseGrupos()` | Mínimo 5 times |
| `grupos` → `playoffs` | `iniciarPlayoffs()` | Todos os jogos de grupos concluídos + mínimo N times para o formato |
| `playoffs` → `encerrado` | Grande Final concluída | Automático ao registrar resultado da GF |
| `playoffs` → `grupos` | `resetPlayoffs()` | Admin manual (limpa todos os playoffs) |
| Qualquer → `configuracao` | `executeReset()` | Admin manual (apaga TUDO) |

### O que é permitido em cada status

| Ação | configuracao | grupos | playoffs | encerrado |
|------|:-----------:|:------:|:--------:|:---------:|
| Adicionar time | ✓ | ✓ (regenera partidas) | ✗ | ✗ |
| Remover time | ✓ | ✗ | ✗ | ✗ |
| Editar time | ✓ | ✓ | ✓ | ✓ |
| Registrar resultado grupo | ✗ | ✓ | ✗ | ✗ |
| Registrar resultado playoff | ✗ | ✗ | ✓ | ✓ (editar GF) |
| Aprovar inscrição | ✓ | ✗ | ✗ | ✗ |
| Inscrição pública | ✓ | ✗ | ✗ | ✗ |

---

## 6. Regras de Negócio

### 6.1 Fase de Grupos

- **Formato:** Round-robin (todos contra todos, turno único)
- **Algoritmo:** Circle method com shuffle aleatório dos times e randomização mandante/visitante
- **Mínimo:** 5 times para gerar
- **Times ímpares:** Algoritmo adiciona "BYE" interno e ignora partidas com BYE
- **Regeneração:** Ao adicionar time durante `grupos`, `regenerarFaseGrupos()` gera novo calendário preservando resultados existentes (match por matchup, não por rodada)

### 6.2 Classificação

Critérios de desempate (em ordem):
1. **Pontos** (V=3, E=1, D=0)
2. **Vitórias**
3. **Saldo de Gols** (marcados - sofridos)
4. **Gols Marcados**
5. **Confronto Direto** — SOMENTE quando 2 times estão empatados em TODOS os critérios acima. Não resolve empates de 3+ times.

**Forma:** últimas 5 partidas (V/E/D) calculadas por ordem cronológica de registro.

### 6.3 Playoffs — Regras Comuns

- **Empate não existe:** placar igual obriga selecionar vencedor por pênaltis
- **Propagação individual:** ao concluir um match, o vencedor é imediatamente colocado no próximo match (não espera toda a rodada)
- **Reset downstream:** ao editar resultado de match já concluído, todos os matches dependentes são limpos (resultados E times são removidos)
- **Vantagem da Chave Superior na Grande Final:** o time vindo da Chave Superior tem "vantagem de ban" (regra do jogo, não do sistema)
- **Grande Final:** jogo único, sem repescagem

### 6.4 Inscrição Pública

- Aberta SOMENTE durante `configuracao`
- Qualquer pessoa pode enviar (sem login necessário)
- Validação: nome do time não pode duplicar times existentes NEM inscrições pendentes
- Admin aprova → time é criado automaticamente e adicionado ao state
- Se estado for `grupos`, aprovação também regenera as partidas

### 6.5 Auditoria

- Toda ação que modifica estado gera uma entrada no audit log
- Identificação: email do admin logado OU browser fingerprint (formato `PC-XXXXXXXX`)
- Fingerprint: hash de canvas + userAgent + screen + timezone + cores + CPU cores
- Máximo 500 entradas no localStorage (FIFO)
- Sem limite no Firestore

---

## 7. Arquitetura de Módulos

### 7.1 Camadas

```
┌─────────────────────────────────────────────────────────┐
│                    index.html (Shell)                     │
│  Seções: home, inscricoes, times, classificacao,          │
│          partidas, bracket, estatisticas, regras,         │
│          historico                                         │
│  Modals: score, editTeam, reset, resetPlayoffs,          │
│          playoffEdit                                      │
├─────────────────────────────────────────────────────────┤
│                    ORQUESTRAÇÃO                           │
│  app.js — bootstrap, score modal, mobile nav              │
│  actions.js — event handlers (mutations)                  │
├─────────────────────────────────────────────────────────┤
│                    RENDERIZAÇÃO                           │
│  renderers-home.js — dashboard                            │
│  renderers-matches.js — partidas, bracket, preview        │
│  renderers.js — times, classificação, stats, etc.         │
│  ui.js — helpers (avatar, toast, modal, nav, escape)      │
├─────────────────────────────────────────────────────────┤
│                    DOMÍNIO (lógica pura)                  │
│  state.js — CRUD, round-robin, classificação, playoffs    │
│  playoff-formats.js — 3 estratégias (Strategy Pattern)    │
├─────────────────────────────────────────────────────────┤
│                    INFRAESTRUTURA                         │
│  firebase-config.js — inicialização                       │
│  auth.js — Google Login                                   │
│  firestore-service.js — CRUD remoto + sync                │
└─────────────────────────────────────────────────────────┘
```

### 7.2 Responsabilidade por Módulo

| Módulo | Responsabilidade | Exports (window) |
|--------|------------------|-------------------|
| `firebase-config.js` | Inicializa Firebase, define `FIREBASE_CONFIGURED` | `FIREBASE_CONFIGURED` (global) |
| `auth.js` | Login/logout Google, `isAdmin()`, `updateAdminUI()` | `ADMIN_EMAIL`, `currentUser`, `isAdmin()`, `loginAdmin()`, `logoutAdmin()`, `initAuth()`, `updateAdminUI()` |
| `firestore-service.js` | CRUD Firestore, real-time listener, inscrições | `FirestoreService` |
| `state.js` | Estado centralizado, todas as operações de domínio | `AppState` |
| `ui.js` | Helpers de UI compartilhados | `UI` |
| `playoff-formats.js` | Registry de formatos de playoff | `PlayoffFormats` |
| `renderers-home.js` | `renderHome()` | (contribui para `Renderers`) |
| `renderers-matches.js` | `renderPartidas()`, `renderBracket()`, helpers | (contribui para `Renderers`) + `getSelectedPlayoffFormatId()`, `onFormatChange()` |
| `renderers.js` | Demais renderers + monta objeto `Renderers` | `Renderers` |
| `actions.js` | Handlers: `submitAddTime()`, `deleteTime()`, `saveInlineResult()`, etc. | Funções globais + `getDeviceId()`, `getAuditUser()` |
| `app.js` | Bootstrap, score modal, mobile nav, wrappers | Funções globais |

### 7.3 Objeto `Renderers`

Cada seção da SPA tem um renderer registrado:

```javascript
window.Renderers = {
  home: renderHome,
  times: renderTimes,
  classificacao: renderClassificacao,
  partidas: renderPartidas,
  bracket: renderBracket,
  estatisticas: renderEstatisticas,
  regras: renderRegras,
  historico: renderHistorico,
  inscricoes: renderInscricoes
};
```

O `app.js` sobrescreve `Renderers.home` e `Renderers.classificacao` com wrappers que adicionam lógica extra (ex: mostrar/esconder botão "Iniciar Playoffs").

---

## 8. Fluxo de Dados e Persistência

### 8.1 Padrão de Mutação

```
1. Ação do usuário (click)
2. actions.js: state = AppState.load()    ← deep clone
3. Muta o clone
4. AppState.save(state)                   ← grava localStorage + sync Firestore
5. Renderers.section()                    ← re-renderiza
6.   → AppState.loadReadOnly()            ← retorna referência cacheada (sem clone)
7.   → gera HTML via template literals
8.   → container.innerHTML = html
```

### 8.2 load() vs loadReadOnly()

| Método | Retorno | Performance | Uso |
|--------|---------|-------------|-----|
| `AppState.load()` | Deep clone (seguro para mutar) | Lento (JSON.parse/stringify) | Em `actions.js` antes de mutar |
| `AppState.loadReadOnly()` | Referência do cache em memória | Rápido | Em renderers (somente leitura) |

**IMPORTANTE:** Nunca mute o retorno de `loadReadOnly()`. Isso corromperia o cache.

### 8.3 Cache de Classificação

`calcularClassificacao()` armazena o resultado em `_classificacaoCache`. O cache é invalidado quando `saveState()` é chamado. Funciona comparando referência de objeto (`state === _ensureCache()`), então só funciona com `loadReadOnly()`.

### 8.4 Persistência Dual-Layer

```
                ADMIN                              VISITANTE
                  │                                    │
     AppState.save()                        Firestore onSnapshot
          │                                        │
     localStorage ──→ Firestore (async)       Firestore ──→ localStorage
          │              ▲                         │
     renderiza           │                    renderiza
          │         saveTournament()                │
          ▼              │                         ▼
        [DOM]       (apenas admin)              [DOM]
```

- **Admin:** escreve no localStorage, sincroniza pro Firestore async via `saveTournament()`
- **Visitante:** recebe updates do Firestore via `onSnapshot()`, que sobrescreve o localStorage local
- **Offline:** Firestore persistence (IndexedDB) mantém dados locais. Se Firebase cair, tudo continua funcionando via localStorage

### 8.5 Conversão de Formato

O localStorage usa formato "legado" (flat). O Firestore usa formato "DDD" (com `metadata`, `config.regrasClassificacao`, etc.). Duas funções fazem a conversão:

- `convertStateToFirestore(state)` — legado → DDD (ao salvar)
- `convertFirestoreToState(data)` — DDD → legado (ao receber do listener)

---

## 9. Strategy Pattern — Formatos de Playoff

### 9.1 Interface de um Formato

Todo formato de playoff é um objeto que implementa:

```javascript
{
  id: string,                    // ex: 'double-elim-4'
  name: string,                  // ex: 'Dupla Eliminação — 4 Times'
  classified: number,            // quantos times classifica
  minTeams: number,              // mínimo de times necessário

  classificationTiers: [         // cores na tabela de classificação
    { from, to, cssClass, label, color }
  ],

  // Estrutura
  defaultMatches(): Object,      // cria matches vazios
  generateBracket(teams, matches): void, // popula seeds iniciais

  // Propagação
  propagateResult(matches): void,        // cascata vencedor→próximo
  resetDownstream(matches, matchId): void, // limpa dependentes

  // Queries
  isGrandFinal(matchId): boolean,
  getGrandFinal(matches): Match,
  getAllMatches(matches): Match[],
  getRegularMatches(matches): Match[],
  getMatchMeta(matchId): { bracket, color },

  // Rendering
  renderBracketHTML(state): string,      // HTML do bracket horizontal
  matchImportanceOrder: string[],        // ordenação para tab de partidas
  miniBracketEntries: [{ matchId, phase, color }], // resumo pro dashboard
  previewSlots: [...],                   // preview genérico pré-playoffs
  infoCards: { path, mechanics, advantages }, // textos informativos
  rules: [{ title, icon, items }]        // regras textuais
}
```

### 9.2 Formatos Implementados

#### double-elim-4 (Dupla Eliminação — 4 Times) — PADRÃO

```
Classifica: 4 melhores
Matches: 6

Chave Superior:
  SF1: 1º vs 4º
  SF2: 2º vs 3º
  UB Final: W(SF1) vs W(SF2)

Chave Inferior:
  LB SF: L(SF1) vs L(SF2)
  LB Final: W(LB SF) vs L(UB Final)

Grande Final: W(UB Final) vs W(LB Final)
```

#### play-in-6 (Play-In — 6 Times)

```
Classifica: 6 melhores
Matches: 10

Chave Superior:
  QF1: 3º vs 6º        QF2: 4º vs 5º
  SF1: 1º vs W(QF2)    SF2: 2º vs W(QF1)    ← 1º e 2º têm BYE
  UB Final: W(SF1) vs W(SF2)

Chave Inferior (CRUZADA — evita rematch):
  LB QF1: L(SF1) vs L(QF1)    ← cruzamento invertido
  LB QF2: L(SF2) vs L(QF2)
  LB SF: W(LB QF1) vs W(LB QF2)
  LB Final: W(LB SF) vs L(UB Final)

Grande Final: W(UB Final) vs W(LB Final)
```

#### gauntlet-6 (Escada — 6 Times)

```
Classifica: 6 melhores
Matches: 8

Chave Superior (linear/escada):
  QF: 3º vs 4º
  SF: 2º vs W(QF)         ← 2º tem BYE até aqui
  UB Final: 1º vs W(SF)   ← 1º tem BYE até aqui

Chave Inferior:
  Oitavas: 5º vs 6º       ← PERDEDOR ELIMINADO (sem 2ª chance)
  QF: W(Oitavas) vs L(UB QF)
  SF: W(LB QF) vs L(UB SF)
  LB Final: W(LB SF) vs L(UB Final)

Grande Final: W(UB Final) vs W(LB Final)
```

### 9.3 Registry

```javascript
const PLAYOFF_FORMATS = {
  'double-elim-4': FORMAT_DOUBLE_ELIM_4,
  'play-in-6': FORMAT_PLAY_IN_6,
  'gauntlet-6': FORMAT_GAUNTLET_6
};

window.PlayoffFormats = {
  FORMATS: PLAYOFF_FORMATS,
  DEFAULT: 'double-elim-4',
  get(formatId): Format,
  getSelected(state): Format
};
```

### 9.4 Como Adicionar um Novo Formato

1. Criar objeto seguindo a interface acima em `playoff-formats.js`
2. Adicionar ao `PLAYOFF_FORMATS`
3. O dropdown, preview, bracket e partidas se adaptam automaticamente
4. Garantir que `classificationTiers` cubra todas as posições de 1 até `classified`

---

## 10. Autenticação e Permissões

### 10.1 Modelo

- **Admin único:** `vonah.dev@gmail.com` (hardcoded em `auth.js` e `firestore.rules`)
- **Visitante:** qualquer pessoa que acessar o site (sem login)
- **Modo local:** se Firebase não estiver configurado, auto-admin é ativado

### 10.2 Controle de UI

- Elementos com classe `admin-only` são mostrados/escondidos por `updateAdminUI()`
- Elementos com classe `visitor-only` são o inverso
- Todo handler em `actions.js` verifica `UI.checkAdmin()` antes de executar
- Botão de login é discreto (no footer), para não confundir visitantes

### 10.3 Firestore Rules

```
campeonatos/{id}  — read: público, write: admin
auditLog/{entry}  — read: público, write: admin
inscricoes/{entry} — read: público, create: qualquer um, update/delete: admin
```

---

## 11. Infraestrutura e Deploy

### 11.1 Firebase

```javascript
// firebase-config.js
projectId: 'amlabs-gaming-cup-df736'
authDomain: 'amlabs-gaming-cup-df736.firebaseapp.com'
```

**Coleções:** `campeonatos`, `auditLog`, `inscricoes`
**Doc principal:** `campeonatos/amlabs-2026`
**Plano:** Spark (gratuito)

### 11.2 Netlify

- **Site:** amlabs-cup
- **Branch:** master
- **Build:** nenhum (static)
- **Publish:** `/` (root)
- **Deploy automático:** git push master → Netlify

### 11.3 Chaves de localStorage

| Chave | Conteúdo |
|-------|----------|
| `campeonato_amlabs_v1` | Estado completo do campeonato |
| `campeonato_amlabs_audit_v1` | Log de auditoria local |
| `campeonato_amlabs_inscricoes_v1` | Inscrições (fallback quando Firebase offline) |

---

## 12. Segurança

| Vetor | Proteção |
|-------|----------|
| XSS | `UI.escapeHtml()` em toda renderização de dados do usuário |
| Input injection | Validação: 0-99 gols, abreviação só [A-Za-z], max 3 chars |
| Firestore write | Rules: apenas admin autenticado pode escrever |
| Import malicioso | Limite 5MB, validação de estrutura (campeonato, times, faseGrupos) |
| Delegated clicks | Score buttons usam `data-*` attributes, não `onclick` inline com dados |

---

## 13. Convenções de Código

- **Idioma:** Código em inglês (variáveis, funções), textos UI e regras de negócio em português
- **Módulos:** Cada arquivo exporta um objeto no `window` (AppState, UI, Renderers, PlayoffFormats, FirestoreService)
- **IDs de elementos:** camelCase (`timesGrid`, `bracketContainer`, `modalScore`)
- **IDs de matches:** kebab-case (`ub-sf1`, `lb-final`, `grand-final`)
- **IDs de times:** `time_{timestamp}_{random}`
- **IDs de partidas (grupos):** `rr_{rodada}_{index}`
- **CSS:** Classes kebab-case, variáveis CSS para cores (`--color-primary`, `--color-upper`, etc.)
- **Rendering:** Template literals com HTML inline, sem framework virtual DOM
- **Estado:** Imutabilidade por convenção (clone antes de mutar, nunca muta readOnly)

---

## 14. Limitações Conhecidas

1. **Confronto direto não resolve empates de 3+ times** — apenas entre 2 times empatados em todos os outros critérios
2. **Zero testes automatizados** — sem cobertura de unit ou integration tests
3. **Sem versionamento de schema** — se a estrutura do state mudar, não há migration automática
4. **Admin único hardcoded** — não suporta múltiplos admins
5. **CSS monolítico** — ~2648 linhas sem pré-processador ou módulos
6. **Sem minificação** — JS e CSS servidos sem build step
7. **Sem PWA** — não funciona como app instalável (sem manifest/service worker)
8. **Inscrição pública sem rate limiting** — Firestore rules permitem `create: if true` sem throttle
9. **Texto na classificação hardcoded** — diz "Os 4 primeiros" mesmo quando o formato classifica 6

---

## 15. Guia para Mudanças

### Antes de Qualquer Mudança

1. Leia esta documentação
2. Identifique quais módulos serão afetados
3. Verifique se a mudança quebra o ciclo de vida (seção 5)
4. Verifique se a mudança quebra a interface do Strategy Pattern (seção 9.1)
5. Verifique se a mudança altera a estrutura do state (seção 4)

### Checklist de Impacto

| Tipo de mudança | Áreas afetadas |
|-----------------|----------------|
| Novo formato de playoff | `playoff-formats.js` apenas (Strategy Pattern isola) |
| Nova seção na SPA | `index.html` (HTML) + novo renderer + `Renderers` object + nav |
| Mudar regra de classificação | `state.js` (`calcularClassificacao`) + possível impacto em `renderers.js` |
| Mudar estrutura do state | `state.js` + `firestore-service.js` (conversores) + possivelmente tudo |
| Novo campo no Time | `state.js` + `actions.js` + renderers que mostram times |
| Mudar regra de transição de status | `state.js` + `actions.js` + validações em ambos |
| Mudar CSS/tema | `css/style.css` apenas |

### Mudanças que Quebram Compatibilidade

**CUIDADO** com mudanças que alteram:
- Estrutura do `state` (localStorage de usuários existentes ficará inválido)
- Chaves de localStorage (`campeonato_amlabs_v1`, etc.)
- Formato do doc Firestore (`campeonatos/amlabs-2026`)
- Interface do Strategy Pattern (todos os 3 formatos precisam implementar)
- ID conventions (`rr_`, `time_`, match IDs)

Se necessário, implemente uma função de migração em `state.js` que detecta a versão antiga e converte.
