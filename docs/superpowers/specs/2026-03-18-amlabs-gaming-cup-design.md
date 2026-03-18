# AMLabs Gaming Cup — Design Spec

**Data:** 2026-03-18
**Status:** Aprovado

## Visao Geral

Site estatico hospedado no GitHub Pages para gerenciar campeonatos de futebol virtual (FC Football e outros) da AMLabs. Autenticacao via Firebase Auth (Google Login), dados no Firestore com cache local, permissao de edicao restrita a um admin.

## Arquitetura

```
GitHub Pages (amlabs-gaming-cup)
  |
  +-- Firebase Auth (Google Login)
  |     - Popup Google -> valida token -> retorna email
  |
  +-- Firebase Firestore (Spark Plan - gratuito)
        - campeonatos/{tournamentId} (documento unico por torneio)
        - auditLog/{auto-id} (colecao separada)
        - enablePersistence() para cache offline
```

## Modelo de Dados (DDD)

### Aggregate Root: Tournament

```json
{
  "id": "amlabs-2026",
  "metadata": {
    "nome": "1o Campeonato FC Football AMLabs 2026",
    "jogo": "FC Football",
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
      "criteriosDesempate": ["pontos", "saldoGols", "golsPro", "confrontoDireto"]
    },
    "vantagemFinal": {
      "tipo": "potes",
      "descricao": "Chave superior escolhe pote alto, inferior escolhe pote baixo"
    },
    "potes": { "alto": [], "baixo": [] }
  },
  "times": [
    { "id": "t1", "nome": "...", "abreviacao": "...", "cor": "#..." }
  ],
  "fases": [
    {
      "id": "fase-grupos",
      "tipo": "todos-contra-todos",
      "ordem": 1,
      "config": { "turnoUnico": true, "classificam": 4 },
      "partidas": [
        { "id": "m1", "rodada": 1, "timeA": "t1", "timeB": "t2", "golsA": null, "golsB": null, "status": "pendente" }
      ]
    },
    {
      "id": "fase-playoffs",
      "tipo": "dupla-eliminacao",
      "ordem": 2,
      "config": { "vantagemFinal": "potes" },
      "partidas": [
        { "id": "p1", "chave": "superior", "etapa": "semifinal", "timeA": "t1", "timeB": "t4", "golsA": null, "golsB": null, "status": "pendente" }
      ]
    }
  ],
  "campeao": null
}
```

### AuditLog (cross-cutting)

```json
{
  "torneiId": "amlabs-2026",
  "usuario": "dev.vonah@gmail.com",
  "acao": "Registrou resultado",
  "detalhes": "Time A 3 x 1 Time B",
  "timestamp": "2026-03-18T...",
  "device": "PC-A3F2B1C0"
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
      allow write: if request.auth.token.email == "dev.vonah@gmail.com";
    }
    match /auditLog/{entry} {
      allow write: if request.auth.token.email == "dev.vonah@gmail.com";
    }
  }
}
```

## Fluxo de Autenticacao

- Visitante: ve tudo, sem botoes de edicao
- Admin (dev.vonah@gmail.com): botao discreto no footer, Google Login, libera edicao
- Outro email: toast "Sem permissao", permanece visitante

## Persistencia (Opcao B)

- Firestore com enablePersistence() = cache automatico no IndexedDB
- Leituras: onSnapshot (tempo real)
- Escritas: updateDoc (so admin)
- Offline: site mostra ultimo cache

## Estrutura de Arquivos

```
amlabs-gaming-cup/
  index.html
  css/style.css
  js/
    firebase-config.js    (config Firebase)
    firestore-service.js  (CRUD Firestore + cache)
    auth.js               (login/logout Google)
    state.js              (refatorado para usar FirestoreService)
    ui.js
    renderers.js          (condiciona edicao a auth)
    actions.js            (condiciona acoes a auth)
  assets/
    logo-amlabs.png
  docs/
    README.md
  firestore.rules
```

## Infraestrutura

| Componente | Servico | Custo |
|-----------|---------|-------|
| Hospedagem | GitHub Pages | Gratis |
| Auth | Firebase Auth Spark | Gratis |
| Banco | Firestore Spark | Gratis |
| URL | L-vonah.github.io/amlabs-gaming-cup | Gratis |

## Extensibilidade Futura

- N campeonatos: criar N documentos em campeonatos/
- Formatos: campo config.formato define comportamento
- Fases: array fases[] com N fases em qualquer ordem
- Jogos: metadata.jogo livre
- Roles: expandir rules para roles por torneio
