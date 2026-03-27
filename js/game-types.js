/**
 * Game Types — Campeonatos AMLabs
 * Fixed profiles per game type. Adding a new game = adding a new entry here.
 */

const GAME_TYPES = {
  'futebol-virtual': {
    id: 'futebol-virtual',
    name: 'EA Sports FC',
    icon: '⚽',
    scoreType: 'numeric',
    scoreLabel: 'Gols',
    maxScore: 99,
    drawAllowed: true,
    scoring: { vitoria: 3, empate: 1, derrota: 0 },
    tiebreakers: ['pontos', 'vitorias', 'saldoScore', 'scoreMarcados', 'confrontoDireto'],
    requireAllMatches: true,
    hasStatistics: true,
    penaltyResolution: true,
    columns: {
      empates: true,
      scoreMarcados: { label: 'GP', title: 'Gols Pró' },
      scoreSofridos: { label: 'GC', title: 'Gols Contra' },
      saldo: { label: 'SG', title: 'Saldo de Gols' }
    },
    tiebreakerLabels: ['Pontos', 'Vitórias', 'Saldo de Gols', 'Gols Marcados', 'Confronto Direto'],
    resultLabel: function(scoreA, scoreB) { return scoreA + ' × ' + scoreB; },
    auditResultLabel: function(nomeA, nomeB, scoreA, scoreB) {
      return nomeA + ' ' + scoreA + ' x ' + scoreB + ' ' + nomeB;
    }
  },
  'sinuca': {
    id: 'sinuca',
    name: 'Sinuca',
    icon: '🎱',
    scoreType: 'winner-only',
    scoreLabel: null,
    maxScore: null,
    drawAllowed: false,
    scoring: { vitoria: 2, empate: 0, derrota: 1 },
    tiebreakers: ['pontos', 'vitorias', 'admin'],
    requireAllMatches: false,
    hasStatistics: false,
    penaltyResolution: false,
    columns: {
      empates: false,
      scoreMarcados: null,
      scoreSofridos: null,
      saldo: null
    },
    tiebreakerLabels: ['Pontos', 'Vitórias', 'Seleção Manual'],
    resultLabel: function(scoreA, scoreB, nomeVencedor) { return '✓ ' + nomeVencedor; },
    auditResultLabel: function(nomeA, nomeB, scoreA, scoreB, nomeVencedor) {
      return 'Vitória de ' + nomeVencedor + ' sobre ' + (nomeVencedor === nomeA ? nomeB : nomeA);
    }
  }
};

const DEFAULT_GAME_TYPE = 'futebol-virtual';

/**
 * Get a game type profile by ID. Falls back to default.
 */
function getGameType(gameTypeId) {
  return GAME_TYPES[gameTypeId] || GAME_TYPES[DEFAULT_GAME_TYPE];
}

/**
 * Get the game type for the active tournament from state cache.
 */
function getActiveGameType() {
  if (window.AppState) {
    const state = AppState.loadReadOnly();
    return getGameType(state.campeonato.gameType);
  }
  return GAME_TYPES[DEFAULT_GAME_TYPE];
}

window.GAME_TYPES = GAME_TYPES;
window.DEFAULT_GAME_TYPE = DEFAULT_GAME_TYPE;
window.getGameType = getGameType;
window.getActiveGameType = getActiveGameType;
