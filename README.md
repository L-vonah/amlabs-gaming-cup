# AMLabs Gaming Cup

Plataforma web para gerenciar campeonatos de futebol virtual da AMLabs. Atualmente rodando o **1o Campeonato EA Sports FC AMLabs 2026**.

**Site:** https://amlabs-cup.netlify.app
**Backup:** https://l-vonah.github.io/amlabs-gaming-cup/

## Sobre

Site estatico hospedado no Netlify com autenticacao via Firebase (Google Login) e dados no Firestore. Qualquer pessoa pode visualizar o campeonato; apenas o administrador pode editar.

### Formato do Campeonato

1. **Fase de Grupos** — Todos contra todos (turno unico, sem ida e volta)
2. **Playoffs** — Os 4 melhores classificados entram em chaveamento de dupla eliminacao:
   - Chave Superior: 1o vs 4o e 2o vs 3o
   - Chave Inferior: perdedores tem segunda chance
   - Grande Final: vencedor da Chave Superior vs vencedor da Chave Inferior
3. **Vantagem na Final** — O time que chega pela Chave Superior (sem derrota) escolhe a configuracao de jogo

### Criterios de Classificacao

| Criterio | Valor |
|----------|-------|
| Vitoria | 3 pontos |
| Empate | 1 ponto |
| Derrota | 0 pontos |
| Desempate | Pontos > Vitorias > Saldo de Gols > Gols Marcados > Confronto Direto |

## Arquitetura

```
Netlify (hospedagem + deploy automatico)
  |
  +-- Firebase Auth (Google Login)
  |     - Apenas vonah.dev@gmail.com pode editar
  |     - Visitantes veem tudo sem login
  |
  +-- Firebase Firestore (banco de dados)
        - campeonatos/{tournamentId} (dados do torneio)
        - inscricoes/{auto-id} (solicitacoes de inscricao)
        - auditLog/{auto-id} (historico de alteracoes)
        - Cache offline via enablePersistence()
```

### Estrutura de Arquivos

```
amlabs-gaming-cup/
  index.html                 Pagina principal (SPA)
  css/style.css              Estilos (tema claro AMLabs)
  js/
    firebase-config.js       Configuracao do Firebase
    auth.js                  Login/logout Google
    firestore-service.js     CRUD Firestore + cache
    state.js                 Gerenciamento de estado + classificacao + estatisticas
    ui.js                    Helpers de UI (toast, modal, avatar, navegacao)
    renderers-home.js        Home: dashboard, banner campeao, mini tabela/bracket
    renderers-matches.js     Partidas: fase de grupos, playoffs, bracket desktop/mobile
    renderers.js             Times, classificacao, estatisticas, regras, historico, inscricoes
    actions.js               Handlers de eventos do usuario
    app.js                   Bootstrap: navegacao, score modal, mobile bar, inicializacao
  assets/
    logo-amlabs.png          Logo AMLabs
  firestore.rules            Regras de seguranca do Firestore
```

### Ordem de Carregamento (importante)

```
firebase-config.js → auth.js → firestore-service.js → state.js → ui.js
→ renderers-matches.js → renderers-home.js → renderers.js → actions.js → app.js
```

Todos os scripts usam o escopo global. A ordem importa porque cada arquivo depende dos anteriores.

### Modelo de Dados

O campeonato e um **aggregate root** auto-contido:

```json
{
  "id": "amlabs-2026",
  "metadata": { "nome", "jogo", "ano", "status" },
  "config": { "formato", "regrasClassificacao" },
  "times": [...],
  "faseGrupos": { "partidas": [...] },
  "playoffs": { "upperBracket", "lowerBracket", "grandFinal" },
  "campeao": null
}
```

## Deploy

O site usa **Netlify** conectado ao repositorio GitHub. Todo push na branch `master` dispara um deploy automatico.

### Deploy automatico (producao)

```bash
git push origin master
# Netlify detecta o push e faz deploy automaticamente
# URL: https://amlabs-cup.netlify.app
```

### Deploy de teste (preview)

**Opcao 1 — Via Pull Request (recomendado):**

```bash
git checkout -b minha-feature
# ... faz alteracoes ...
git push -u origin minha-feature
gh pr create --title "minha feature"
# Netlify gera uma URL de preview automaticamente no PR
```

O Netlify comenta no PR com o link de preview. Ideal para revisar antes de mergear.

**Opcao 2 — Deploy manual via CLI:**

```bash
# Draft (URL temporaria, nao afeta producao)
npx netlify deploy --dir=.

# Producao (substitui o site ao vivo)
npx netlify deploy --dir=. --prod
```

### Configuracao do Netlify

- **Site:** amlabs-cup
- **URL:** https://amlabs-cup.netlify.app
- **Repo:** L-vonah/amlabs-gaming-cup
- **Branch de producao:** master
- **Build command:** nenhum (site estatico)
- **Publish directory:** `/` (raiz do repo)

### Backup (GitHub Pages)

O GitHub Pages esta ativo como fallback caso os creditos do Netlify acabem. Ele faz deploy automatico de todo push no master, sem limite de creditos.

- **URL:** https://l-vonah.github.io/amlabs-gaming-cup/
- Nao tem preview por PR
- Requer `l-vonah.github.io` autorizado no Firebase Auth

## Como Configurar (do zero)

### Pre-requisitos

- Conta Google
- Node.js instalado
- Netlify CLI: `npm install -g netlify-cli`

### 1. Criar Projeto Firebase

```bash
firebase login
firebase projects:create amlabs-gaming-cup --display-name "AMLabs Gaming Cup"
```

### 2. Ativar Auth e Firestore

No [Firebase Console](https://console.firebase.google.com/):

1. **Authentication** > Sign-in method > Ativar **Google**
2. **Firestore Database** > Create database > Start in **production mode**
3. **Rules** > Copiar o conteudo de `firestore.rules` e publicar

### 3. Obter Config do Firebase

No Firebase Console > Project Settings > General > Your apps > Web app:

1. Registrar um app web
2. Copiar o objeto `firebaseConfig`
3. Colar em `js/firebase-config.js` substituindo os PLACEHOLDERs

### 4. Deploy

```bash
git push origin master
# Netlify faz deploy automaticamente
```

## Como Usar

### Visitante (qualquer pessoa)

- Acessa o site e visualiza todas as informacoes
- Classificacao, partidas, chaveamento, estatisticas
- Nao precisa de login

### Administrador

1. Clica no botao **Admin** no rodape
2. Faz login com Google (vonah.dev@gmail.com)
3. Botoes de edicao aparecem:
   - Cadastrar/editar/remover times
   - Gerar fase de grupos
   - Registrar/editar resultados
   - Iniciar playoffs
   - Refazer playoffs
4. Todas as alteracoes sao registradas no historico de auditoria

### Inscricao Publica

Na fase de configuracao, qualquer pessoa pode enviar uma solicitacao de inscricao. O admin aprova ou rejeita pelo painel.

## Infraestrutura e Custos

| Servico | Uso | Custo |
|---------|-----|-------|
| Netlify | Hospedagem + deploy + previews | Gratis |
| Firebase Auth (Spark) | Login Google | Gratis (ilimitado) |
| Firestore (Spark) | Banco de dados | Gratis (50k leituras/dia) |
| Total | | **R$ 0,00/mes** |

## Desenvolvimento

### Modo Local (sem Firebase)

Se `firebase-config.js` tiver PLACEHOLDERs, o site roda em modo local usando localStorage. Todos os controles de edicao ficam habilitados. Basta abrir `index.html` no navegador.

### Modo Producao (com Firebase)

Com as credenciais do Firebase configuradas, o site usa Firestore como fonte de verdade com cache offline. Apenas o admin autenticado pode editar.
