# AMLabs Gaming Cup — Design Spec

**Data:** 2026-03-18
**Status:** Aprovado
**Atualizado:** 2026-03-19

## Visao Geral

Site estatico hospedado no Netlify para gerenciar campeonatos de futebol virtual (EA Sports FC e outros) da AMLabs. Autenticacao via Firebase Auth (Google Login), dados no Firestore com cache local, permissao de edicao restrita a um admin.

## Arquitetura

```
Netlify (amlabs-cup.netlify.app)
  |
  +-- Deploy automatico via GitHub (push to master)
  +-- Preview URLs automaticas por PR
  |
  +-- Firebase Auth (Google Login)
  |     - Popup Google -> valida token -> retorna email
  |
  +-- Firebase Firestore (Spark Plan - gratuito)
        - campeonatos/{tournamentId} (documento unico por torneio)
        - inscricoes/{auto-id} (solicitacoes de inscricao)
        - auditLog/{auto-id} (colecao separada)
        - enablePersistence() para cache offline
```

## Modelo de Dados (DDD)

### Aggregate Root: Tournament

```json
{
  "id": "amlabs-2026",
  "metadata": {
    "nome": "1o Campeonato EA Sports FC AMLabs 2026",
    "jogo": "EA Sports FC",
    "ano": 2026,
    "status": "configuracao|grupos|playoffs|encerrado",
    "criadoEm": "timestamp",
    "atualizadoEm": "timestamp"
  },
  "config": {
    "formato": "grupos+playoffs",
    "regrasClassificacao": {
      "vitoria": 3,
      "empate": 1,
      "derrota": 0,
      "criteriosDesempate": ["pontos", "vitorias", "saldoGols", "golsMarcados", "confrontoDireto"]
    }
  },
  "times": [
    { "id": "t1", "nome": "...", "abreviacao": "...", "cor": "#...", "participante": "..." }
  ],
  "faseGrupos": {
    "status": "aguardando|andamento|concluida",
    "partidas": [
      { "id": "rr_1_0", "rodada": 1, "timeA": "t1", "timeB": "t2", "golsA": null, "golsB": null, "status": "pendente" }
    ]
  },
  "playoffs": {
    "status": "aguardando|andamento|concluido",
    "upperBracket": {
      "sf1": { "id": "ub-sf1", "timeA": null, "timeB": null, "golsA": null, "golsB": null, "vencedor": null, "perdedor": null },
      "sf2": { "id": "ub-sf2", "..." : "..." },
      "final": { "id": "ub-final", "..." : "..." }
    },
    "lowerBracket": {
      "sf": { "id": "lb-sf", "..." : "..." },
      "final": { "id": "lb-final", "..." : "..." }
    },
    "grandFinal": {
      "id": "grand-final",
      "timeUpper": null, "timeLower": null,
      "golsUpper": null, "golsLower": null,
      "vencedor": null, "vantagem": "upper"
    }
  },
  "campeao": null
}
```

### AuditLog (cross-cutting)

```json
{
  "torneiId": "amlabs-2026",
  "usuario": "vonah.dev@gmail.com",
  "acao": "Registrou resultado",
  "detalhes": { "partidaId": "rr_1_0", "golsA": 3, "golsB": 1 },
  "timestamp": "2026-03-18T...",
  "device": "PC-A3F2B1C0"
}
```

### Inscricoes

```json
{
  "torneiId": "amlabs-2026",
  "participante": "Joao",
  "nome": "Barcelona FC",
  "abreviacao": "BAR",
  "cor": "#6c5ce7",
  "status": "pendente|aprovado|rejeitado",
  "criadoEm": "timestamp",
  "resolvidoEm": null,
  "resolvidoPor": null
}
```

## Firestore Rules

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read: if true;
    }
    match /campeonatos/{id} {
      allow write: if request.auth.token.email == "vonah.dev@gmail.com";
    }
    match /auditLog/{entry} {
      allow write: if request.auth.token.email == "vonah.dev@gmail.com";
    }
    match /inscricoes/{entry} {
      allow create: if true;
      allow update, delete: if request.auth.token.email == "vonah.dev@gmail.com";
    }
  }
}
```

## Fluxo de Autenticacao

- Visitante: ve tudo, sem botoes de edicao
- Admin (vonah.dev@gmail.com): botao discreto no footer, Google Login, libera edicao
- Outro email: toast "Sem permissao", permanece visitante

## Persistencia

- Firestore com enablePersistence() = cache automatico no IndexedDB
- Leituras: onSnapshot (tempo real) para visitantes
- Escritas: set/update (so admin), com sync localStorage -> Firestore
- Offline: site mostra ultimo cache do localStorage
- Admin escrevendo: localStorage primeiro, sync async para Firestore

## Estrutura de Arquivos

```
amlabs-gaming-cup/
  index.html                 Pagina principal (SPA)
  css/style.css              Estilos
  js/
    firebase-config.js       Config Firebase
    auth.js                  Login/logout Google
    firestore-service.js     CRUD Firestore + listener tempo real
    state.js                 Estado, classificacao, estatisticas, playoffs
    ui.js                    Helpers (toast, modal, avatar, navegacao, checkAdmin)
    renderers-home.js        Home: dashboard, banner, mini bracket/tabela
    renderers-matches.js     Partidas, playoffs, bracket desktop/mobile
    renderers.js             Times, classificacao, stats, regras, historico, inscricoes
    actions.js               Handlers de eventos
    app.js                   Bootstrap, score modal, mobile bar
  assets/
    logo-amlabs.png
  firestore.rules
```

## Infraestrutura

| Componente | Servico | Custo |
|-----------|---------|-------|
| Hospedagem + Deploy | Netlify | Gratis |
| Auth | Firebase Auth Spark | Gratis |
| Banco | Firestore Spark | Gratis |
| URL | amlabs-cup.netlify.app | Gratis |
