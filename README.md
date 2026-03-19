# AMLabs Gaming Cup

Plataforma web para gerenciar campeonatos de futebol virtual da AMLabs. Atualmente rodando o **1o Campeonato EA Sports FC AMLabs 2026**.

## Sobre

Site estatico hospedado no GitHub Pages com autenticacao via Firebase (Google Login) e dados no Firestore. Qualquer pessoa pode visualizar o campeonato; apenas o administrador pode editar.

### Formato do Campeonato

1. **Fase de Grupos** — Todos contra todos (turno unico, sem ida e volta)
2. **Playoffs** — Os 4 melhores classificados entram em chaveamento de dupla eliminacao:
   - Chave Superior: 1o vs 4o e 2o vs 3o
   - Chave Inferior: perdedores tem segunda chance
   - Grande Final: vencedor da Chave Superior vs vencedor da Chave Inferior
3. **Vantagem na Final** — O time que chega pela Chave Superior (sem derrota) escolhe times de pote superior; o que chega pela Inferior escolhe de pote inferior

### Criterios de Classificacao

| Criterio | Valor |
|----------|-------|
| Vitoria | 3 pontos |
| Empate | 1 ponto |
| Derrota | 0 pontos |
| Desempate | Pontos > Vitorias > Saldo de Gols > Gols Marcados > Confronto Direto |

## Arquitetura

```
GitHub Pages (site estatico)
  |
  +-- Firebase Auth (Google Login)
  |     - Apenas vonah.dev@gmail.com pode editar
  |     - Visitantes veem tudo sem login
  |
  +-- Firebase Firestore (banco de dados)
        - campeonatos/{tournamentId} (dados do torneio)
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
    state.js                 Gerenciamento de estado
    ui.js                    Helpers de UI
    renderers.js             Renderizacao por secao
    actions.js               Handlers de eventos
  assets/
    logo-amlabs.png          Logo AMLabs
  firestore.rules            Regras de seguranca do Firestore
  docs/                      Specs e documentacao tecnica
```

### Modelo de Dados (DDD)

O campeonato e um **aggregate root** auto-contido:

```json
{
  "id": "amlabs-2026",
  "metadata": { "nome", "jogo", "ano", "status" },
  "config": { "formato", "regrasClassificacao", "vantagemFinal", "potes" },
  "times": [...],
  "faseGrupos": { "partidas": [...] },
  "playoffs": { "upperBracket", "lowerBracket", "grandFinal" },
  "campeao": null
}
```

Preparado para suportar N campeonatos no futuro (cada torneio e um documento independente).

## Como Configurar

### Pre-requisitos

- Conta Google
- Node.js instalado
- Firebase CLI: `npm install -g firebase-tools`
- GitHub CLI: `gh` (opcional, para deploy)

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

### 4. Deploy no GitHub Pages

```bash
# Ja configurado neste repo
git push origin master
# GitHub Pages serve automaticamente do branch master
```

URL: `https://L-vonah.github.io/amlabs-gaming-cup/`

## Como Usar

### Visitante (qualquer pessoa)

- Acessa o site e visualiza todas as informacoes
- Classificacao, partidas, chaveamento, estatisticas
- Nao precisa de login

### Administrador

1. Clica no botao **Admin** no rodape
2. Faz login com Google (vonah.dev@gmail.com)
3. Botoes de edicao aparecem:
   - Cadastrar/remover times
   - Gerar fase de grupos
   - Registrar resultados
   - Iniciar playoffs
   - Configurar potes
4. Todas as alteracoes sao registradas no historico de auditoria

## Infraestrutura e Custos

| Servico | Uso | Custo |
|---------|-----|-------|
| GitHub Pages | Hospedagem do site | Gratis |
| Firebase Auth (Spark) | Login Google | Gratis (ilimitado) |
| Firestore (Spark) | Banco de dados | Gratis (50k leituras/dia) |
| Total | | **R$ 0,00/mes** |

## Desenvolvimento

### Modo Local (sem Firebase)

Se `firebase-config.js` tiver PLACEHOLDERs, o site roda em modo local usando localStorage. Todos os controles de edicao ficam habilitados. Basta abrir `index.html` no navegador.

### Modo Producao (com Firebase)

Com as credenciais do Firebase configuradas, o site usa Firestore como fonte de verdade com cache offline. Apenas o admin autenticado pode editar.

## Extensibilidade

O modelo de dados DDD permite:
- **Multiplos campeonatos**: criar novos documentos em `campeonatos/`
- **Novos formatos**: campo `config.formato` define o comportamento
- **Novos jogos**: `metadata.jogo` aceita qualquer titulo
- **Roles**: expandir regras do Firestore para multiplos admins
- **Fases customizadas**: array `fases[]` suporta N fases em qualquer ordem
