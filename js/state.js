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
    status: 'aguardando', // aguardando | andamento | concluido
    upperBracket: {
      // Semifinais: 1o vs 4o e 2o vs 3o
      sf1: { id: 'ub-sf1', fase: 'Semifinal da Chave Superior 1', label: '1º vs 4º', timeA: null, timeB: null, golsA: null, golsB: null, vencedor: null, perdedor: null },
      sf2: { id: 'ub-sf2', fase: 'Semifinal da Chave Superior 2', label: '2º vs 3º', timeA: null, timeB: null, golsA: null, golsB: null, vencedor: null, perdedor: null },
      // Final da Chave Superior: vencedores das semis
      final: { id: 'ub-final', fase: 'Final da Chave Superior', label: 'Final Superior', timeA: null, timeB: null, golsA: null, golsB: null, vencedor: null, perdedor: null }
    },
    lowerBracket: {
      // Semifinal Inferior: os 2 perdedores das semis do upper
      sf: { id: 'lb-sf', fase: 'Semifinal da Chave Inferior', label: 'Semifinal Inferior', timeA: null, timeB: null, golsA: null, golsB: null, vencedor: null, perdedor: null },
      // Final Inferior: vencedor da LB Semi vs perdedor da UB Final
      final: { id: 'lb-final', fase: 'Final da Chave Inferior', label: 'Final Inferior', timeA: null, timeB: null, golsA: null, golsB: null, vencedor: null, perdedor: null }
    },
    grandFinal: {
      id: 'grand-final',
      fase: 'Grande Final',
      label: 'Grande Final',
      timeUpper: null, // vem da chave superior (tem vantagem de potes)
      timeLower: null, // vem da chave inferior
      golsUpper: null,
      golsLower: null,
      vencedor: null,
      vantagem: 'upper' // o time da chave superior escolhe do pote superior
    }
  }
};

// ------------------------------------------------------------------
// Load / Save State
// ------------------------------------------------------------------

// In-memory cache to avoid repeated JSON.parse on every render
let _stateCache = null;

function invalidateCache() {
  _stateCache = null;
}

function loadState() {
  try {
    if (_stateCache) return JSON.parse(JSON.stringify(_stateCache));
    const raw = localStorage.getItem(STATE_KEY);
    if (!raw) {
      _stateCache = JSON.parse(JSON.stringify(DEFAULT_STATE));
      return JSON.parse(JSON.stringify(_stateCache));
    }
    _stateCache = JSON.parse(raw);
    return JSON.parse(JSON.stringify(_stateCache));
  } catch (e) {
    console.error('Erro ao carregar estado:', e);
    return JSON.parse(JSON.stringify(DEFAULT_STATE));
  }
}

function saveState(state) {
  try {
    _stateCache = JSON.parse(JSON.stringify(state));
    localStorage.setItem(STATE_KEY, JSON.stringify(state));

    // Sync to Firestore if configured and admin
    if (typeof FirestoreService !== 'undefined' && FirestoreService.isActive() && typeof isAdmin === 'function' && isAdmin()) {
      const firestoreData = convertStateToFirestore(state);
      FirestoreService.saveTournament(firestoreData);
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
    campeao: state.playoffs.grandFinal.vencedor || null
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
      classificadosPorGrupo: 4,
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
// Standings Calculation
// ------------------------------------------------------------------

function calcularClassificacao(state) {
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

  return tabela;
}

// ------------------------------------------------------------------
// Stats
// ------------------------------------------------------------------

function calcularEstatisticas(state) {
  const grupoPartidas = state.faseGrupos.partidas.filter(p => p.status === 'concluida');

  // Collect playoff matches
  const playoffPartidas = [];
  if (state.playoffs && state.playoffs.status !== 'aguardando') {
    const ub = state.playoffs.upperBracket;
    const lb = state.playoffs.lowerBracket;
    const gf = state.playoffs.grandFinal;
    [ub.sf1, ub.sf2, ub.final, lb.sf, lb.final].forEach(m => {
      if (m.vencedor) {
        playoffPartidas.push({ timeA: m.timeA, timeB: m.timeB, golsA: m.golsA, golsB: m.golsB, rodada: 'playoff' });
      }
    });
    if (gf.vencedor) {
      playoffPartidas.push({ timeA: gf.timeUpper, timeB: gf.timeLower, golsA: gf.golsUpper, golsB: gf.golsLower, rodada: 'final' });
    }
  }

  const allPartidas = [...grupoPartidas, ...playoffPartidas];
  const totalPartidas = allPartidas.length;
  const totalGols = allPartidas.reduce((s, p) => s + p.golsA + p.golsB, 0);
  const mediaGols = totalPartidas > 0 ? (totalGols / totalPartidas).toFixed(2) : 0;
  const maiorGoleada = allPartidas.reduce((best, p) => {
    const diff = Math.abs(p.golsA - p.golsB);
    return diff > best.diff ? { diff, partida: p } : best;
  }, { diff: 0, partida: null });

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
// Playoffs Population
// ------------------------------------------------------------------

function popularPlayoffs(state) {
  const tabela = calcularClassificacao(state);
  if (tabela.length < 4) return false;

  const [p1, p2, p3, p4] = tabela;

  // Upper bracket: 1 vs 4, 2 vs 3
  state.playoffs.upperBracket.sf1.timeA = p1.id;
  state.playoffs.upperBracket.sf1.timeB = p4.id;
  state.playoffs.upperBracket.sf2.timeA = p2.id;
  state.playoffs.upperBracket.sf2.timeB = p3.id;

  state.playoffs.status = 'andamento';
  state.campeonato.status = 'playoffs';
  return true;
}

// ------------------------------------------------------------------
// Playoffs Result Registration
// ------------------------------------------------------------------

function registrarResultadoPlayoff(state, matchId, golsA, golsB) {
  const ub = state.playoffs.upperBracket;
  const lb = state.playoffs.lowerBracket;

  const allMatches = [ub.sf1, ub.sf2, ub.final, lb.sf, lb.final];
  const match = allMatches.find(m => m.id === matchId);

  if (!match) return false;
  if (golsA === golsB) return false; // no draws in playoffs

  const newWinner = golsA > golsB ? match.timeA : match.timeB;
  if (match.vencedor && match.vencedor !== newWinner) {
    _resetDownstreamPlayoff(state, matchId);
  }

  match.golsA = golsA;
  match.golsB = golsB;
  match.vencedor = newWinner;
  match.perdedor = golsA > golsB ? match.timeB : match.timeA;

  // Cascade results through bracket
  _propagarResultadoPlayoff(state);
  return true;
}

function _resetDownstreamPlayoff(state, matchId) {
  const ub = state.playoffs.upperBracket;
  const lb = state.playoffs.lowerBracket;
  const gf = state.playoffs.grandFinal;

  function clearMatch(m) {
    m.golsA = null; m.golsB = null;
    m.vencedor = null; m.perdedor = null;
  }
  function clearGF() {
    gf.golsUpper = null; gf.golsLower = null;
    gf.vencedor = null; gf.timeUpper = null; gf.timeLower = null;
  }

  if (matchId === 'ub-sf1' || matchId === 'ub-sf2') {
    clearMatch(ub.final); ub.final.timeA = null; ub.final.timeB = null;
    clearMatch(lb.sf); lb.sf.timeA = null; lb.sf.timeB = null;
    clearMatch(lb.final); lb.final.timeA = null; lb.final.timeB = null;
    clearGF();
  }
  if (matchId === 'ub-final') {
    // Keep lb.sf intact (it doesn't depend on UB final)
    // But lb.final loser side changes, and GF upper side changes
    clearMatch(lb.final); lb.final.timeB = null; // timeB was the UB final loser
    clearGF();
  }
  if (matchId === 'lb-sf') {
    clearMatch(lb.final); lb.final.timeA = null;
    gf.timeLower = null; gf.golsLower = null; gf.golsUpper = null; gf.vencedor = null;
  }
  if (matchId === 'lb-final') {
    gf.timeLower = null; gf.golsLower = null; gf.golsUpper = null; gf.vencedor = null;
  }

  // If we cleared the grand final winner, revert tournament status
  if (gf.vencedor === null && state.campeonato.status === 'encerrado') {
    state.campeonato.status = 'playoffs';
    state.playoffs.status = 'andamento';
  }
}

function _propagarResultadoPlayoff(state) {
  const ub = state.playoffs.upperBracket;
  const lb = state.playoffs.lowerBracket;
  const gf = state.playoffs.grandFinal;

  // After UB SF1 and SF2: populate UB Final and LB SF
  if (ub.sf1.vencedor && ub.sf2.vencedor) {
    ub.final.timeA = ub.sf1.vencedor;
    ub.final.timeB = ub.sf2.vencedor;
  }
  if (ub.sf1.perdedor && ub.sf2.perdedor) {
    // Intelligent matchup: avoid repeat — since both came from different UB SFs this is always a new matchup
    lb.sf.timeA = ub.sf1.perdedor;
    lb.sf.timeB = ub.sf2.perdedor;
  }

  // After LB SF: populate LB Final (winner of LB SF vs loser of UB Final)
  if (lb.sf.vencedor && ub.final.perdedor) {
    lb.final.timeA = lb.sf.vencedor;
    lb.final.timeB = ub.final.perdedor;
  }

  // After UB Final: populate Grand Final (upper side)
  if (ub.final.vencedor) {
    gf.timeUpper = ub.final.vencedor;
  }

  // After LB Final: populate Grand Final (lower side)
  if (lb.final.vencedor) {
    gf.timeLower = lb.final.vencedor;
  }

  // Check if grand final is complete
  if (gf.golsUpper !== null && gf.golsLower !== null) {
    if (gf.golsUpper === gf.golsLower) return; // draw — don't set a winner
    gf.vencedor = gf.golsUpper > gf.golsLower ? gf.timeUpper : gf.timeLower;
    state.playoffs.status = 'concluido';
    state.campeonato.status = 'encerrado';
  }
}

function registrarResultadoGrandFinal(state, golsUpper, golsLower) {
  const gf = state.playoffs.grandFinal;
  if (!gf.timeUpper || !gf.timeLower) return false;

  const newWinner = golsUpper > golsLower ? gf.timeUpper : gf.timeLower;
  if (gf.vencedor && gf.vencedor !== newWinner) {
    if (state.campeonato.status === 'encerrado') {
      state.campeonato.status = 'playoffs';
      state.playoffs.status = 'andamento';
    }
  }
  if (golsUpper === golsLower) return false; // no draw

  gf.golsUpper = golsUpper;
  gf.golsLower = golsLower;
  gf.vencedor = newWinner;
  state.playoffs.status = 'concluido';
  state.campeonato.status = 'encerrado';
  return true;
}

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

function getDefaultPlayoffs() {
  return JSON.parse(JSON.stringify(DEFAULT_STATE.playoffs));
}

// ------------------------------------------------------------------
// Export
// ------------------------------------------------------------------

window.AppState = {
  DEFAULT_STATE,
  load: loadState,
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
  convertStateToFirestore,
  convertFirestoreToState,
  invalidateCache,
  isFirestoreMode() {
    return typeof FirestoreService !== 'undefined' && FirestoreService.isActive();
  }
};
