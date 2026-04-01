# AMLabs Gaming Cup

Plataforma web para gerenciar campeonatos internos da AMLabs. Suporta **EA Sports FC** (futebol virtual com placar numérico) e **Sinuca** (partidas por vitória/derrota).

**Site:** https://amlabs-cup.netlify.app
**Backup:** https://l-vonah.github.io/amlabs-gaming-cup/

> Para detalhes sobre arquitetura, modelo de dados, regras de negocio e guia de mudancas, veja [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Sobre

Site estatico hospedado no Netlify com autenticacao via Firebase (Google Login) e dados no Firestore. Qualquer pessoa pode visualizar o campeonato; apenas o administrador pode editar.

### Tipos de Jogo

| Aspecto | EA Sports FC | Sinuca |
|---------|-------------|--------|
| Placar | Numerico (golsA x golsB) | Apenas vencedor |
| Empate | Possivel nos grupos | Nao existe |
| Pontuacao | V=3, E=1, D=0 | V=2, D=1 |
| Desempate | Pontos > Vitorias > Saldo > Gols > Confronto | Pontos > Vitorias > Admin seleciona |
| Estatisticas | Artilheiros, goleadas, defesa | Nenhuma |
| Jogos pendentes | Todos obrigatorios para playoffs | Pode iniciar com pendentes |
| Penaltis (playoff) | Sim | Nao |

### Formato do Campeonato

1. **Fase de Grupos** — Todos contra todos (turno unico)
2. **Playoffs** — 5 formatos configuraveis:
   - **Eliminacao Simples (4 times)** — SF + Final
   - **Eliminacao Simples (8 times)** — QF + SF + Final
   - **Dupla Eliminacao (4 times)** — Chaves superior e inferior, grande final
   - **Play-In (6 times)** — 1o e 2o com bye nas quartas
   - **Escada/Gauntlet (6 times)** — Cascata linear

## Stack

```
Frontend:   HTML5 + CSS3 + Vanilla JavaScript (sem frameworks)
Auth:       Firebase Authentication (Google Login)
Banco:      Firebase Firestore (Spark Plan - gratuito)
Hosting:    Netlify (deploy automatico) + GitHub Pages (backup)
Build:      Nenhum — arquivos estaticos
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

O GitHub Pages esta ativo como fallback caso os creditos do Netlify acabem. Deploy automatico de todo push no master, sem limite de creditos.

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
   - Escolher formato de playoff e iniciar
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

### Documentacao Tecnica

Para detalhes sobre arquitetura, modelo de dados, regras de negocio, e orientacoes para modificar o codigo:

**[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**
