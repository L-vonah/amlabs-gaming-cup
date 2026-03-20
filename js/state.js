/**
 * State Manager — 1o Campeonato EA Sports FC AMLabs
 * Centralized data layer using localStorage for persistence
 */

const STATE_KEY = 'campeonato_amlabs_v1';
const AUDIT_LOG_KEY = 'campeonato_amlabs_audit_v1';

const DEFAULT_STATE = {
  campeonato: {
    nome: '1º Campeonato EA Sports FC AMLabs 2026',
    edicao: 1,
    temporada: '2026',
    status: 'configuracao' // configuracao | grupos | playoffs | encerrado
  },
  config: {
    pontosPorVitoria: 3,
    pontosPorEmpate: 1,
    pontosPorDerrota: 0,
    classificadosPorGrupo: 4,
    criteriosDesempate: ['pontos', 'vitorias', 'saldoGols', 'golsMarcados', 'confrontoDireto']
  },
  times: [],
  faseGrupos: {
    status: 'aguardando', // aguardando | andamento | concluida
    partidas: []
  },
  playoffs: {
    formato: 'double-elim-4',
    status: 'aguardando', // aguardando | andamento | concluido
    matches: {}
  }
};

// ------------------------------------------------------------------
// Load / Save State
// ------------------------------------------------------------------

// In-memory cache to avoid repeated JSON.parse on every render
let _stateCache = null;

function invalidateCache() {
  _stateCache = null;
  _classificacaoCache = null;
}

function _ensureCache() {
  if (!_stateCache) {
    try {
      const raw = localStorage.getItem(STATE_KEY);
      _stateCache = raw ? JSON.parse(raw) : JSON.parse(JSON.stringify(DEFAULT_STATE));
    } catch (e) {
      console.error('Erro ao carregar estado:', e);
      _stateCache = JSON.parse(JSON.stringify(DEFAULT_STATE));
    }
  }
  return _stateCache;
}

/**
 * Returns a deep clone of state — safe to mutate (used by actions that save).
 */
function loadState() {
  return JSON.parse(JSON.stringify(_ensureCache()));
}

/**
 * Returns the cached state directly — do NOT mutate the returned object.
 * Use this in renderers and read-only code for better performance.
 */
function loadStateReadOnly() {
  return _ensureCache();
}

function saveState(state) {
  try {
    _classificacaoCache = null;
    _stateCache = JSON.parse(JSON.stringify(state));
    localStorage.setItem(STATE_KEY, JSON.stringify(state));

    // Sync to Firestore if configured and admin
    if (typeof FirestoreService !== 'undefined' && FirestoreService.isActive() && UI.checkAdmin()) {
      const firestoreData = convertStateToFirestore(state);
      FirestoreService.saveTournament(firestoreData).then(ok => {
        if (!ok && typeof UI !== 'undefined') {
          UI.showToast('Erro ao sincronizar com o servidor. Dados salvos localmente.', 'error');
        }
      });
    }

    return true;
  } catch (e) {
    console.error('Erro ao salvar estado:', e);
    return false;
  }
}

/**
 * Convert legacy localStorage state to DDD Firestore format.
 */
function convertStateToFirestore(state) {
  return {
    id: typeof TOURNAMENT_ID !== 'undefined' ? TOURNAMENT_ID : 'amlabs-2026',
    metadata: {
      nome: state.campeonato.nome,
      jogo: 'EA Sports FC',
      ano: parseInt(state.campeonato.temporada) || 2026,
      status: state.campeonato.status,
      criadoEm: state._criadoEm || new Date().toISOString(),
      atualizadoEm: new Date().toISOString()
    },
    config: {
      formato: 'grupos+playoffs',
      regrasClassificacao: {
        vitoria: state.config.pontosPorVitoria,
        empate: state.config.pontosPorEmpate,
        derrota: state.config.pontosPorDerrota,
        criteriosDesempate: state.config.criteriosDesempate
      }
    },
    times: state.times,
    faseGrupos: state.faseGrupos,
    playoffs: state.playoffs,
    campeao: _getCampeao(state)
  };
}

/**
 * Convert Firestore DDD format back to legacy state format.
 */
function convertFirestoreToState(data) {
  if (!data) return null;
  return {
    campeonato: {
      nome: data.metadata.nome,
      edicao: 1,
      temporada: String(data.metadata.ano),
      status: data.metadata.status
    },
    config: {
      pontosPorVitoria: data.config.regrasClassificacao.vitoria,
      pontosPorEmpate: data.config.regrasClassificacao.empate,
      pontosPorDerrota: data.config.regrasClassificacao.derrota,
      classificadosPorGrupo: (data.config && data.config.classificadosPorGrupo) || 4,
      criteriosDesempate: data.config.regrasClassificacao.criteriosDesempate
    },
    times: data.times || [],
    faseGrupos: data.faseGrupos || { status: 'aguardando', partidas: [] },
    playoffs: data.playoffs || JSON.parse(JSON.stringify(DEFAULT_STATE.playoffs)),
    _criadoEm: data.metadata.criadoEm
  };
}

function resetState() {
  localStorage.removeItem(STATE_KEY);
  localStorage.removeItem(AUDIT_LOG_KEY);
  return JSON.parse(JSON.stringify(DEFAULT_STATE));
}

// ------------------------------------------------------------------
// Audit Log
// ------------------------------------------------------------------

/**
 * Adds an entry to the audit log.
 * @param {string} usuario - Name of the user making the change
 * @param {string} acao - Short description of the action
 * @param {object} [detalhes] - Optional extra details
 */
function addAuditLog(usuario, acao, detalhes) {
  try {
    const raw = localStorage.getItem(AUDIT_LOG_KEY);
    const logs = raw ? JSON.parse(raw) : [];
    logs.push({
      id: 'log_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      timestamp: new Date().toISOString(),
      usuario: usuario || 'Anonimo',
      acao,
      detalhes: detalhes || null
    });
    // Keep up to 500 entries
    if (logs.length > 500) logs.splice(0, logs.length - 500);
    localStorage.setItem(AUDIT_LOG_KEY, JSON.stringify(logs));

    // Also write to Firestore if available
    if (typeof FirestoreService !== 'undefined' && FirestoreService.isActive()) {
      FirestoreService.addAuditLog(acao, detalhes);
    }
  } catch (e) {
    console.error('Erro ao gravar log de auditoria:', e);
  }
}

function loadAuditLog() {
  try {
    const raw = localStorage.getItem(AUDIT_LOG_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

// ------------------------------------------------------------------
// Teams
// ------------------------------------------------------------------

function addTime(state, { nome, abreviacao, cor, participante }) {
  const id = 'time_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
  const time = { id, nome, abreviacao: abreviacao.replace(/[^A-Za-z]/g, '').toUpperCase().slice(0, 3), cor, participante: participante || '' };
  state.times.push(time);
  return time;
}

function removeTime(state, id) {
  state.times = state.times.filter(t => t.id !== id);
}

function getTimeById(state, id) {
  return state.times.find(t => t.id === id) || null;
}

// ------------------------------------------------------------------
// Round-Robin Schedule Generation
// ------------------------------------------------------------------

/**
 * Generates a round-robin schedule (single round) for all teams.
 * Uses the standard "circle" algorithm to minimize byes.
 */
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function gerarRodadasRoundRobin(times) {
  if (times.length < 2) return [];

  const n = times.length % 2 === 0 ? times.length : times.length + 1;
  const numRodadas = n - 1;
  const partidas = [];

  // Shuffle teams so order and matchups are randomized
  const lista = shuffle([...times.map(t => t.id)]);
  if (times.length % 2 !== 0) lista.push('BYE');

  const fixed = lista[0];
  const rotating = lista.slice(1);

  for (let rodada = 0; rodada < numRodadas; rodada++) {
    const current = [fixed, ...rotating];

    for (let i = 0; i < n / 2; i++) {
      let home = current[i];
      let away = current[n - 1 - i];

      if (home === 'BYE' || away === 'BYE') continue;

      // Randomize home/away
      if (Math.random() < 0.5) [home, away] = [away, home];

      partidas.push({
        id: `rr_${rodada + 1}_${i}`,
        rodada: rodada + 1,
        timeA: home,
        timeB: away,
        golsA: null,
        golsB: null,
        status: 'pendente'
      });
    }

    // Rotate: move last element to position 1 (after fixed)
    rotating.unshift(rotating.pop());
  }

  return partidas;
}

function gerarFaseGrupos(state) {
  if (state.times.length < 2) return false;
  state.faseGrupos.partidas = gerarRodadasRoundRobin(state.times);
  state.faseGrupos.status = 'andamento';
  state.campeonato.status = 'grupos';
  return true;
}

/**
 * Regenerates the entire round-robin schedule preserving existing results.
 * Used when adding a team mid-tournament.
 */
function regenerarFaseGrupos(state) {
  // Save existing results keyed by matchup (sorted team IDs)
  const resultados = {};
  state.faseGrupos.partidas.forEach(p => {
    if (p.status === 'concluida') {
      const key = [p.timeA, p.timeB].sort().join('|');
      resultados[key] = { golsA: p.golsA, golsB: p.golsB, timeA: p.timeA, timeB: p.timeB };
    }
  });

  // Generate fresh schedule with all teams
  const novasPartidas = gerarRodadasRoundRobin(state.times);

  // Restore results
  novasPartidas.forEach(p => {
    const key = [p.timeA, p.timeB].sort().join('|');
    if (resultados[key]) {
      const r = resultados[key];
      // Match the original home/away with goals
      if (p.timeA === r.timeA) {
        p.golsA = r.golsA;
        p.golsB = r.golsB;
      } else {
        p.golsA = r.golsB;
        p.golsB = r.golsA;
      }
      p.status = 'concluida';
    }
  });

  state.faseGrupos.partidas = novasPartidas;
}

// ------------------------------------------------------------------
// Standings Calculation (cached per save cycle)
// ------------------------------------------------------------------

let _classificacaoCache = null;

function calcularClassificacao(state) {
  // Return cached result if state hasn't changed (same reference = readOnly)
  if (_classificacaoCache && state === _ensureCache()) return _classificacaoCache;
  const times = state.times;
  const partidas = state.faseGrupos.partidas.filter(p => p.status === 'concluida');

  const tabela = times.map(t => ({
    id: t.id,
    nome: t.nome,
    abreviacao: t.abreviacao,
    cor: t.cor,
    participante: t.participante || '',
    jogos: 0,
    vitorias: 0,
    empates: 0,
    derrotas: 0,
    golsMarcados: 0,
    golsSofridos: 0,
    saldoGols: 0,
    pontos: 0,
    forma: [] // last 5
  }));

  const idx = {};
  tabela.forEach((t, i) => { idx[t.id] = i; });

  partidas.forEach(p => {
    const ia = idx[p.timeA];
    const ib = idx[p.timeB];
    if (ia === undefined || ib === undefined) return;

    const a = tabela[ia];
    const b = tabela[ib];

    a.jogos++;
    b.jogos++;
    a.golsMarcados += p.golsA;
    a.golsSofridos += p.golsB;
    b.golsMarcados += p.golsB;
    b.golsSofridos += p.golsA;

    if (p.golsA > p.golsB) {
      a.vitorias++;
      a.pontos += state.config.pontosPorVitoria;
      b.derrotas++;
      b.pontos += state.config.pontosPorDerrota;
      a.forma.push('V');
      b.forma.push('D');
    } else if (p.golsA < p.golsB) {
      b.vitorias++;
      b.pontos += state.config.pontosPorVitoria;
      a.derrotas++;
      a.pontos += state.config.pontosPorDerrota;
      b.forma.push('V');
      a.forma.push('D');
    } else {
      a.empates++;
      b.empates++;
      a.pontos += state.config.pontosPorEmpate;
      b.pontos += state.config.pontosPorEmpate;
      a.forma.push('E');
      b.forma.push('E');
    }
  });

  tabela.forEach(t => {
    t.saldoGols = t.golsMarcados - t.golsSofridos;
    t.forma = t.forma.slice(-5); // keep last 5
  });

  // Sort by criteria
  tabela.sort((a, b) => {
    if (b.pontos !== a.pontos) return b.pontos - a.pontos;
    if (b.vitorias !== a.vitorias) return b.vitorias - a.vitorias;
    if (b.saldoGols !== a.saldoGols) return b.saldoGols - a.saldoGols;
    if (b.golsMarcados !== a.golsMarcados) return b.golsMarcados - a.golsMarcados;
    return a.nome.localeCompare(b.nome);
  });

  // Resolve remaining ties by confronto direto (two-team ties only)
  for (let i = 0; i < tabela.length - 1; i++) {
    let j = i + 1;
    while (j < tabela.length &&
      tabela[j].pontos === tabela[i].pontos &&
      tabela[j].vitorias === tabela[i].vitorias &&
      tabela[j].saldoGols === tabela[i].saldoGols &&
      tabela[j].golsMarcados === tabela[i].golsMarcados) {
      j++;
    }
    if (j - i === 2) {
      const a = tabela[i];
      const b = tabela[i + 1];
      const directMatch = partidas.find(p =>
        (p.timeA === a.id && p.timeB === b.id) ||
        (p.timeA === b.id && p.timeB === a.id)
      );
      if (directMatch) {
        const aIsHome = directMatch.timeA === a.id;
        const aGols = aIsHome ? directMatch.golsA : directMatch.golsB;
        const bGols = aIsHome ? directMatch.golsB : directMatch.golsA;
        if (bGols > aGols) {
          [tabela[i], tabela[i + 1]] = [tabela[i + 1], tabela[i]];
        }
      }
    }
    i = j - 1;
  }

  // Cache if reading from the shared cache (readOnly path)
  if (state === _ensureCache()) _classificacaoCache = tabela;
  return tabela;
}

// ------------------------------------------------------------------
// Stats
// ------------------------------------------------------------------

function calcularEstatisticas(state) {
  const grupoPartidas = state.faseGrupos.partidas.filter(p => p.status === 'concluida');

  // Collect playoff matches via format strategy
  let playoffPartidas = [];
  if (state.playoffs && state.playoffs.status !== 'aguardando' && state.playoffs.matches) {
    const format = PlayoffFormats.getSelected(state);
    playoffPartidas = format.getAllMatches(state.playoffs.matches)
      .filter(m => m.vencedor)
      .map(m => ({ timeA: m.timeA, timeB: m.timeB, golsA: m.golsA, golsB: m.golsB, id: m.id, fase: m.fase, penaltyWinner: m.penaltyWinner || null }));
  }

  const allPartidas = [...grupoPartidas, ...playoffPartidas];
  const totalPartidas = allPartidas.length;
  const totalGols = allPartidas.reduce((s, p) => s + p.golsA + p.golsB, 0);
  const mediaGols = totalPartidas > 0 ? (totalGols / totalPartidas).toFixed(2) : 0;
  const maiorGoleada = allPartidas.reduce((best, p) => {
    const diff = Math.abs(p.golsA - p.golsB);
    const total = p.golsA + p.golsB;
    if (diff > best.diff || (diff === best.diff && total > best.total)) {
      return { diff, total, partida: p };
    }
    return best;
  }, { diff: 0, total: 0, partida: null });

  const tabela = calcularClassificacao(state);

  // Add playoff goals to team stats
  playoffPartidas.forEach(p => {
    const idxA = tabela.findIndex(t => t.id === p.timeA);
    const idxB = tabela.findIndex(t => t.id === p.timeB);
    if (idxA !== -1) {
      tabela[idxA].jogos++;
      tabela[idxA].golsMarcados += p.golsA;
      tabela[idxA].golsSofridos += p.golsB;
    }
    if (idxB !== -1) {
      tabela[idxB].jogos++;
      tabela[idxB].golsMarcados += p.golsB;
      tabela[idxB].golsSofridos += p.golsA;
    }
  });

  const topGoleadores = [...tabela].sort((a, b) => b.golsMarcados - a.golsMarcados).slice(0, 5);
  const menosVazados = [...tabela].sort((a, b) => a.golsSofridos - b.golsSofridos).slice(0, 5);

  const partidaMaisGols = allPartidas.reduce((best, p) => {
    const total = p.golsA + p.golsB;
    return total > best.total ? { total, partida: p } : best;
  }, { total: 0, partida: null });

  return { totalPartidas, totalPartidasGrupos: grupoPartidas.length, totalPartidasPlayoffs: playoffPartidas.length, totalGols, mediaGols, maiorGoleada, partidaMaisGols, topGoleadores, menosVazados };
}

// ------------------------------------------------------------------
// Playoffs — format-agnostic operations (delegates to strategy)
// ------------------------------------------------------------------

function popularPlayoffs(state, formatId) {
  const format = PlayoffFormats.get(formatId || state.playoffs.formato);
  const tabela = calcularClassificacao(state);
  if (tabela.length < format.classified) return false;

  const classified = tabela.slice(0, format.classified);
  state.playoffs.formato = format.id;
  state.playoffs.matches = format.defaultMatches();
  format.generateBracket(classified, state.playoffs.matches);
  state.playoffs.status = 'andamento';
  state.campeonato.status = 'playoffs';
  return true;
}

function registrarResultadoPlayoff(state, matchId, golsA, golsB, penaltyWinner) {
  const format = PlayoffFormats.getSelected(state);
  const match = state.playoffs.matches[matchId];
  if (!match) return false;
  if (!match.timeA || !match.timeB) return false;
  if (golsA === golsB && !penaltyWinner) return false;

  const newWinner = golsA !== golsB
    ? (golsA > golsB ? match.timeA : match.timeB)
    : penaltyWinner;
  if (match.vencedor && match.vencedor !== newWinner) {
    format.resetDownstream(state.playoffs.matches, matchId);
  }

  match.golsA = golsA;
  match.golsB = golsB;
  match.vencedor = newWinner;
  match.perdedor = newWinner === match.timeA ? match.timeB : match.timeA;
  match.penaltyWinner = penaltyWinner || null;

  format.propagateResult(state.playoffs.matches);

  // Check if grand final completed
  const gf = format.getGrandFinal(state.playoffs.matches);
  if (gf && gf.vencedor) {
    state.playoffs.status = 'concluido';
    state.campeonato.status = 'encerrado';
  }

  // Revert status if GF winner was cleared
  if (gf && !gf.vencedor && state.campeonato.status === 'encerrado') {
    state.campeonato.status = 'playoffs';
    state.playoffs.status = 'andamento';
  }

  return true;
}

function registrarResultadoGrandFinal(state, golsA, golsB, penaltyWinner) {
  const format = PlayoffFormats.getSelected(state);
  const gf = format.getGrandFinal(state.playoffs.matches);
  if (!gf || !gf.timeA || !gf.timeB) return false;
  if (golsA === golsB && !penaltyWinner) return false;

  const newWinner = golsA !== golsB
    ? (golsA > golsB ? gf.timeA : gf.timeB)
    : penaltyWinner;
  if (gf.vencedor && gf.vencedor !== newWinner) {
    if (state.campeonato.status === 'encerrado') {
      state.campeonato.status = 'playoffs';
      state.playoffs.status = 'andamento';
    }
  }

  gf.golsA = golsA;
  gf.golsB = golsB;
  gf.vencedor = newWinner;
  gf.perdedor = newWinner === gf.timeA ? gf.timeB : gf.timeA;
  gf.penaltyWinner = penaltyWinner || null;
  state.playoffs.status = 'concluido';
  state.campeonato.status = 'encerrado';
  return true;
}

function getDefaultPlayoffs() {
  return JSON.parse(JSON.stringify(DEFAULT_STATE.playoffs));
}

function _getCampeao(state) {
  if (!state.playoffs || !state.playoffs.matches) return null;
  const format = PlayoffFormats.getSelected(state);
  const gf = format.getGrandFinal(state.playoffs.matches);
  return gf ? gf.vencedor : null;
}

// ------------------------------------------------------------------
// Export
// ------------------------------------------------------------------

window.AppState = {
  DEFAULT_STATE,
  load: loadState,
  loadReadOnly: loadStateReadOnly,
  save: saveState,
  reset: resetState,
  addAuditLog,
  loadAuditLog,
  addTime,
  removeTime,
  getTimeById,
  gerarFaseGrupos,
  regenerarFaseGrupos,
  calcularClassificacao,
  calcularEstatisticas,
  popularPlayoffs,
  registrarResultadoPlayoff,
  registrarResultadoGrandFinal,
  getDefaultPlayoffs,
  getCampeao: _getCampeao,
  convertStateToFirestore,
  convertFirestoreToState,
  invalidateCache,
  isFirestoreMode() {
    return typeof FirestoreService !== 'undefined' && FirestoreService.isActive();
  }
};
