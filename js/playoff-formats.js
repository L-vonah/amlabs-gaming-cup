/**
 * Playoff Formats — Strategy Pattern Registry
 * Each format defines its own bracket structure, propagation, rendering, and rules.
 * Adding a new format = adding a new object to PLAYOFF_FORMATS.
 */

// ------------------------------------------------------------------
// Shared helpers
// ------------------------------------------------------------------

function _newMatch(id, fase, label) {
  return { id, fase, label, timeA: null, timeB: null, golsA: null, golsB: null, vencedor: null, perdedor: null };
}

function _clearMatch(m) {
  m.golsA = null; m.golsB = null; m.vencedor = null; m.perdedor = null;
}

function _clearMatchFull(m) {
  _clearMatch(m); m.timeA = null; m.timeB = null;
}

function _collectConcludedMatches(matches) {
  return Object.values(matches)
    .filter(m => m.vencedor)
    .map(m => ({ timeA: m.timeA, timeB: m.timeB, golsA: m.golsA, golsB: m.golsB, id: m.id, fase: m.fase }));
}

// ------------------------------------------------------------------
// Format: Dupla Eliminação — 4 Times (current)
// ------------------------------------------------------------------

const FORMAT_DOUBLE_ELIM_4 = {
  id: 'double-elim-4',
  name: 'Dupla Eliminação — 4 Times',
  classified: 4,
  minTeams: 4,

  classificationTiers: [
    { from: 1, to: 4, cssClass: 'classified-green', label: 'Classificado', color: 'var(--color-win)' }
  ],

  defaultMatches() {
    return {
      'ub-sf1': _newMatch('ub-sf1', 'Semifinal da Chave Superior 1', '1º vs 4º'),
      'ub-sf2': _newMatch('ub-sf2', 'Semifinal da Chave Superior 2', '2º vs 3º'),
      'ub-final': _newMatch('ub-final', 'Final da Chave Superior', 'Final Superior'),
      'lb-sf': _newMatch('lb-sf', 'Semifinal da Chave Inferior', 'Semifinal Inferior'),
      'lb-final': _newMatch('lb-final', 'Final da Chave Inferior', 'Final Inferior'),
      'grand-final': _newMatch('grand-final', 'Grande Final', 'Grande Final')
    };
  },

  generateBracket(rankedTeams, matches) {
    const [p1, p2, p3, p4] = rankedTeams;
    matches['ub-sf1'].timeA = p1.id;
    matches['ub-sf1'].timeB = p4.id;
    matches['ub-sf2'].timeA = p2.id;
    matches['ub-sf2'].timeB = p3.id;
  },

  propagateResult(matches) {
    const ubSf1 = matches['ub-sf1'];
    const ubSf2 = matches['ub-sf2'];
    const ubFinal = matches['ub-final'];
    const lbSf = matches['lb-sf'];
    const lbFinal = matches['lb-final'];
    const gf = matches['grand-final'];

    // UB SF winners → UB Final
    if (ubSf1.vencedor && ubSf2.vencedor) {
      ubFinal.timeA = ubSf1.vencedor;
      ubFinal.timeB = ubSf2.vencedor;
    }
    // UB SF losers → LB SF
    if (ubSf1.perdedor && ubSf2.perdedor) {
      lbSf.timeA = ubSf1.perdedor;
      lbSf.timeB = ubSf2.perdedor;
    }
    // LB SF winner + UB Final loser → LB Final
    if (lbSf.vencedor && ubFinal.perdedor) {
      lbFinal.timeA = lbSf.vencedor;
      lbFinal.timeB = ubFinal.perdedor;
    }
    // UB Final winner → GF (timeA = upper side)
    if (ubFinal.vencedor) {
      gf.timeA = ubFinal.vencedor;
    }
    // LB Final winner → GF (timeB = lower side)
    if (lbFinal.vencedor) {
      gf.timeB = lbFinal.vencedor;
    }
  },

  resetDownstream(matches, matchId) {
    const ubFinal = matches['ub-final'];
    const lbSf = matches['lb-sf'];
    const lbFinal = matches['lb-final'];
    const gf = matches['grand-final'];

    if (matchId === 'ub-sf1' || matchId === 'ub-sf2') {
      _clearMatchFull(ubFinal);
      _clearMatchFull(lbSf);
      _clearMatchFull(lbFinal);
      _clearMatchFull(gf);
    }
    if (matchId === 'ub-final') {
      _clearMatch(lbFinal); lbFinal.timeB = null;
      _clearMatchFull(gf);
    }
    if (matchId === 'lb-sf') {
      _clearMatch(lbFinal); lbFinal.timeA = null;
      _clearMatch(gf); gf.timeB = null;
    }
    if (matchId === 'lb-final') {
      _clearMatch(gf); gf.timeB = null;
    }
  },

  isGrandFinal(matchId) {
    return matchId === 'grand-final';
  },

  getGrandFinal(matches) {
    return matches['grand-final'];
  },

  getAllMatches(matches) {
    return Object.values(matches);
  },

  getRegularMatches(matches) {
    return Object.values(matches).filter(m => m.id !== 'grand-final');
  },

  // Order of matches for partidas tab (most important first for pending sort)
  matchImportanceOrder: ['grand-final', 'lb-final', 'lb-sf', 'ub-final', 'ub-sf1', 'ub-sf2'],

  // Match metadata for rendering (which bracket, color)
  getMatchMeta(matchId) {
    const meta = {
      'ub-sf1': { bracket: 'upper', color: 'var(--color-upper)' },
      'ub-sf2': { bracket: 'upper', color: 'var(--color-upper)' },
      'ub-final': { bracket: 'upper', color: 'var(--color-upper)' },
      'lb-sf': { bracket: 'lower', color: 'var(--color-lower)' },
      'lb-final': { bracket: 'lower', color: 'var(--color-lower)' },
      'grand-final': { bracket: 'grand', color: 'var(--color-champion)' }
    };
    return meta[matchId] || { bracket: 'upper', color: 'var(--color-upper)' };
  },

  // Mini bracket for home dashboard
  miniBracketEntries: [
    { matchId: 'ub-sf1', phase: 'SF CS1', color: 'var(--color-upper)' },
    { matchId: 'ub-sf2', phase: 'SF CS2', color: 'var(--color-upper)' },
    { matchId: 'ub-final', phase: 'Final CS', color: 'var(--color-upper)' },
    { matchId: 'lb-sf', phase: 'SF CI', color: 'var(--color-lower)' },
    { matchId: 'lb-final', phase: 'Final CI', color: 'var(--color-lower)' },
    { matchId: 'grand-final', phase: 'GF', color: 'var(--color-champion)' }
  ],

  // Preview bracket with generic names (shown before playoffs start)
  previewSlots: [
    { section: 'upper', title: 'Chave Superior', phases: [
      { name: 'Semifinal', matches: [
        { slotA: '1º Colocado', slotB: '4º Colocado' },
        { slotA: '2º Colocado', slotB: '3º Colocado' }
      ]},
      { name: 'Final Superior', matches: [
        { slotA: 'Vencedor SF1', slotB: 'Vencedor SF2' }
      ]}
    ]},
    { section: 'lower', title: 'Chave Inferior', phases: [
      { name: 'Semifinal Inferior', matches: [
        { slotA: 'Perdedor SF1', slotB: 'Perdedor SF2' }
      ]},
      { name: 'Final Inferior', matches: [
        { slotA: 'Vencedor LB SF', slotB: 'Perdedor UB Final' }
      ]}
    ]},
    { section: 'grand', title: 'Grande Final', phases: [
      { name: 'Grande Final', matches: [
        { slotA: 'Vencedor UB Final (CS)', slotB: 'Vencedor LB Final (CI)' }
      ]}
    ]}
  ],

  infoCards: {
    path: [
      { seed: '1º-2º', desc: 'UB SF → UB Final → GF', games: '3 jogos mín' },
      { seed: '3º-4º', desc: 'UB SF → UB Final → GF', games: '3 jogos mín' }
    ],
    mechanics: [
      'Upper: SF (1ºvs4º, 2ºvs3º) → Final → Grande Final',
      'Perdedores do Upper caem para a Chave Inferior',
      'Lower: SF (perdedores) → Final (vs perdedor UB Final)',
      'Todos os 4 times têm dupla eliminação'
    ],
    advantages: [
      '1º e 2º — Enfrentam seeds mais fracos na SF',
      'Chave Superior — Vantagem de ban na Grande Final'
    ]
  },

  rules: [
    {
      title: 'Chave Superior (sem derrota)',
      icon: '★',
      iconBg: 'icon-bg-purple',
      items: [
        'Os 4 classificados entram diretamente na Chave Superior.',
        '<strong>Semifinal 1:</strong> 1º colocado vs 4º colocado',
        '<strong>Semifinal 2:</strong> 2º colocado vs 3º colocado',
        'Os vencedores das semifinais disputam a <strong>Final Superior</strong>.',
        'O vencedor da Final Superior avança diretamente para a <strong>Grande Final</strong>.',
        'Os perdedores caem para a <strong>Chave Inferior</strong>.'
      ]
    },
    {
      title: 'Chave Inferior (Segunda Chance)',
      icon: '↓',
      iconBg: 'icon-bg-orange',
      items: [
        'Os <strong>perdedores das semifinais da Chave Superior</strong> disputam a Semifinal Inferior.',
        'O vencedor da Semifinal Inferior enfrenta o <strong>perdedor da Final Superior</strong> na Final Inferior.',
        'O vencedor da Final Inferior conquista sua vaga na <strong>Grande Final</strong>.',
        'Qualquer derrota na Chave Inferior elimina o time definitivamente.'
      ]
    }
  ]
};

// ------------------------------------------------------------------
// Format: Play-In — 6 Times
// ------------------------------------------------------------------

const FORMAT_PLAY_IN_6 = {
  id: 'play-in-6',
  name: 'Play-In — 6 Times',
  classified: 6,
  minTeams: 6,

  classificationTiers: [
    { from: 1, to: 2, cssClass: 'classified-green-dark', label: 'BYE — Semifinal', color: 'var(--color-win)' },
    { from: 3, to: 4, cssClass: 'classified-yellow-dark', label: 'Quartas de Final', color: '#b8860b' },
    { from: 5, to: 6, cssClass: 'classified-yellow-light', label: 'Quartas de Final', color: '#d4a843' }
  ],

  defaultMatches() {
    return {
      'ub-qf1': _newMatch('ub-qf1', 'Quartas da Chave Superior 1', '3º vs 6º'),
      'ub-qf2': _newMatch('ub-qf2', 'Quartas da Chave Superior 2', '4º vs 5º'),
      'ub-sf1': _newMatch('ub-sf1', 'Semifinal da Chave Superior 1', '1º vs Venc. QF2'),
      'ub-sf2': _newMatch('ub-sf2', 'Semifinal da Chave Superior 2', '2º vs Venc. QF1'),
      'ub-final': _newMatch('ub-final', 'Final da Chave Superior', 'Final Superior'),
      'lb-qf1': _newMatch('lb-qf1', 'Quartas da Chave Inferior 1', 'Perd. SF1 vs Perd. QF(3v6)'),
      'lb-qf2': _newMatch('lb-qf2', 'Quartas da Chave Inferior 2', 'Perd. SF2 vs Perd. QF(4v5)'),
      'lb-sf': _newMatch('lb-sf', 'Semifinal da Chave Inferior', 'Semifinal Inferior'),
      'lb-final': _newMatch('lb-final', 'Final da Chave Inferior', 'Final Inferior'),
      'grand-final': _newMatch('grand-final', 'Grande Final', 'Grande Final')
    };
  },

  generateBracket(rankedTeams, matches) {
    const [p1, p2, p3, p4, p5, p6] = rankedTeams;
    matches['ub-qf1'].timeA = p3.id;
    matches['ub-qf1'].timeB = p6.id;
    matches['ub-qf2'].timeA = p4.id;
    matches['ub-qf2'].timeB = p5.id;
    matches['ub-sf1'].timeA = p1.id;  // 1st has bye
    matches['ub-sf2'].timeA = p2.id;  // 2nd has bye
  },

  propagateResult(matches) {
    const ubQf1 = matches['ub-qf1'];
    const ubQf2 = matches['ub-qf2'];
    const ubSf1 = matches['ub-sf1'];
    const ubSf2 = matches['ub-sf2'];
    const ubFinal = matches['ub-final'];
    const lbQf1 = matches['lb-qf1'];
    const lbQf2 = matches['lb-qf2'];
    const lbSf = matches['lb-sf'];
    const lbFinal = matches['lb-final'];
    const gf = matches['grand-final'];

    // UB QF winners → UB SF (timeB, since timeA is the bye seed)
    if (ubQf2.vencedor) ubSf1.timeB = ubQf2.vencedor;  // 1st vs W(4v5)
    if (ubQf1.vencedor) ubSf2.timeB = ubQf1.vencedor;  // 2nd vs W(3v6)

    // UB SF winners → UB Final
    if (ubSf1.vencedor && ubSf2.vencedor) {
      ubFinal.timeA = ubSf1.vencedor;
      ubFinal.timeB = ubSf2.vencedor;
    }

    // LB QF: crossed — SF loser vs QF loser from opposite side
    if (ubSf1.perdedor && ubQf1.perdedor) {
      lbQf1.timeA = ubSf1.perdedor;
      lbQf1.timeB = ubQf1.perdedor;  // SF1 loser vs QF1 loser (3v6 side)
    }
    if (ubSf2.perdedor && ubQf2.perdedor) {
      lbQf2.timeA = ubSf2.perdedor;
      lbQf2.timeB = ubQf2.perdedor;  // SF2 loser vs QF2 loser (4v5 side)
    }

    // LB SF: QF winners
    if (lbQf1.vencedor && lbQf2.vencedor) {
      lbSf.timeA = lbQf1.vencedor;
      lbSf.timeB = lbQf2.vencedor;
    }

    // LB Final: LB SF winner vs UB Final loser
    if (lbSf.vencedor && ubFinal.perdedor) {
      lbFinal.timeA = lbSf.vencedor;
      lbFinal.timeB = ubFinal.perdedor;
    }

    // Grand Final
    if (ubFinal.vencedor) gf.timeA = ubFinal.vencedor;
    if (lbFinal.vencedor) gf.timeB = lbFinal.vencedor;
  },

  resetDownstream(matches, matchId) {
    const ubSf1 = matches['ub-sf1'];
    const ubSf2 = matches['ub-sf2'];
    const ubFinal = matches['ub-final'];
    const lbQf1 = matches['lb-qf1'];
    const lbQf2 = matches['lb-qf2'];
    const lbSf = matches['lb-sf'];
    const lbFinal = matches['lb-final'];
    const gf = matches['grand-final'];

    if (matchId === 'ub-qf1') {
      ubSf2.timeB = null; _clearMatch(ubSf2);
      _clearMatchFull(ubFinal);
      _clearMatchFull(lbQf1); _clearMatchFull(lbQf2);
      _clearMatchFull(lbSf); _clearMatchFull(lbFinal); _clearMatchFull(gf);
    }
    if (matchId === 'ub-qf2') {
      ubSf1.timeB = null; _clearMatch(ubSf1);
      _clearMatchFull(ubFinal);
      _clearMatchFull(lbQf1); _clearMatchFull(lbQf2);
      _clearMatchFull(lbSf); _clearMatchFull(lbFinal); _clearMatchFull(gf);
    }
    if (matchId === 'ub-sf1') {
      _clearMatchFull(ubFinal);
      _clearMatchFull(lbQf1);
      _clearMatchFull(lbSf); _clearMatchFull(lbFinal); _clearMatchFull(gf);
    }
    if (matchId === 'ub-sf2') {
      _clearMatchFull(ubFinal);
      _clearMatchFull(lbQf2);
      _clearMatchFull(lbSf); _clearMatchFull(lbFinal); _clearMatchFull(gf);
    }
    if (matchId === 'ub-final') {
      _clearMatch(lbFinal); lbFinal.timeB = null;
      _clearMatchFull(gf);
    }
    if (matchId === 'lb-qf1') {
      _clearMatch(lbSf); lbSf.timeA = null;
      _clearMatchFull(lbFinal); _clearMatchFull(gf);
    }
    if (matchId === 'lb-qf2') {
      _clearMatch(lbSf); lbSf.timeB = null;
      _clearMatchFull(lbFinal); _clearMatchFull(gf);
    }
    if (matchId === 'lb-sf') {
      _clearMatch(lbFinal); lbFinal.timeA = null;
      _clearMatch(gf); gf.timeB = null;
    }
    if (matchId === 'lb-final') {
      _clearMatch(gf); gf.timeB = null;
    }
  },

  isGrandFinal(matchId) { return matchId === 'grand-final'; },
  getGrandFinal(matches) { return matches['grand-final']; },
  getAllMatches(matches) { return Object.values(matches); },
  getRegularMatches(matches) { return Object.values(matches).filter(m => m.id !== 'grand-final'); },

  matchImportanceOrder: ['grand-final', 'lb-final', 'lb-sf', 'lb-qf1', 'lb-qf2', 'ub-final', 'ub-sf1', 'ub-sf2', 'ub-qf1', 'ub-qf2'],

  getMatchMeta(matchId) {
    if (matchId === 'grand-final') return { bracket: 'grand', color: 'var(--color-champion)' };
    if (matchId.startsWith('lb-')) return { bracket: 'lower', color: 'var(--color-lower)' };
    return { bracket: 'upper', color: 'var(--color-upper)' };
  },

  miniBracketEntries: [
    { matchId: 'ub-qf1', phase: 'QF CS1', color: 'var(--color-upper)' },
    { matchId: 'ub-qf2', phase: 'QF CS2', color: 'var(--color-upper)' },
    { matchId: 'ub-sf1', phase: 'SF CS1', color: 'var(--color-upper)' },
    { matchId: 'ub-sf2', phase: 'SF CS2', color: 'var(--color-upper)' },
    { matchId: 'ub-final', phase: 'Final CS', color: 'var(--color-upper)' },
    { matchId: 'lb-qf1', phase: 'QF CI1', color: 'var(--color-lower)' },
    { matchId: 'lb-qf2', phase: 'QF CI2', color: 'var(--color-lower)' },
    { matchId: 'lb-sf', phase: 'SF CI', color: 'var(--color-lower)' },
    { matchId: 'lb-final', phase: 'Final CI', color: 'var(--color-lower)' },
    { matchId: 'grand-final', phase: 'GF', color: 'var(--color-champion)' }
  ],

  previewSlots: [
    { section: 'upper', title: 'Chave Superior', phases: [
      { name: 'Quartas de Final', matches: [
        { slotA: '3º Colocado', slotB: '6º Colocado' },
        { slotA: '4º Colocado', slotB: '5º Colocado' }
      ], note: '1º e 2º não jogam nesta fase' },
      { name: 'Semifinal', matches: [
        { slotA: '1º Colocado (BYE)', slotB: 'Vencedor (4º vs 5º)' },
        { slotA: '2º Colocado (BYE)', slotB: 'Vencedor (3º vs 6º)' }
      ]},
      { name: 'Final Superior', matches: [
        { slotA: 'Vencedor Semi 1', slotB: 'Vencedor Semi 2' }
      ]}
    ]},
    { section: 'lower', title: 'Chave Inferior — Cruzada', phases: [
      { name: 'Quartas Cruzadas', matches: [
        { slotA: 'Perdedor UB SF1', slotB: 'Perdedor UB QF (3ºvs6º)' },
        { slotA: 'Perdedor UB SF2', slotB: 'Perdedor UB QF (4ºvs5º)' }
      ], note: 'Cruzamento invertido: evita rematch imediato' },
      { name: 'Semifinal Inferior', matches: [
        { slotA: 'Vencedor LB QF 1', slotB: 'Vencedor LB QF 2' }
      ]},
      { name: 'Final Inferior', matches: [
        { slotA: 'Vencedor LB SF', slotB: 'Perdedor UB Final' }
      ]}
    ]},
    { section: 'grand', title: 'Grande Final', phases: [
      { name: 'Grande Final', matches: [
        { slotA: 'Vencedor UB Final (CS)', slotB: 'Vencedor LB Final (CI)' }
      ]}
    ]}
  ],

  infoCards: {
    path: [
      { seed: '1º-2º', desc: 'UB SF → UB Final → GF', games: '3 jogos mín' },
      { seed: '3º-4º', desc: 'UB QF → UB SF → UB Final → GF', games: '4 jogos mín' },
      { seed: '5º-6º', desc: 'UB QF → (perde) → LB → GF', games: '5 jogos mín' }
    ],
    mechanics: [
      'Upper tem QF → SF → Final (1º e 2º entram na SF com bye)',
      '4 perdedores do Upper caem para LB Quartas cruzadas',
      'Perdedor da UB Final entra na LB Final',
      'Todos os 6 times têm dupla eliminação'
    ],
    advantages: [
      '1º e 2º — BYE nas Quartas (entram na Semifinal)',
      'Chave Superior — Vantagem de ban na Grande Final'
    ]
  },

  rules: [
    {
      title: 'Chave Superior (com bye)',
      icon: '★',
      iconBg: 'icon-bg-purple',
      items: [
        'Os 6 classificados entram na Chave Superior.',
        '<strong>Quartas:</strong> 3º vs 6º e 4º vs 5º (1º e 2º têm bye).',
        '<strong>Semifinal:</strong> 1º vs Vencedor(4ºvs5º) e 2º vs Vencedor(3ºvs6º).',
        'Vencedores das Semifinais disputam a <strong>Final Superior</strong>.',
        'Perdedores caem para a <strong>Chave Inferior</strong>.'
      ]
    },
    {
      title: 'Chave Inferior — Cruzada',
      icon: '↓',
      iconBg: 'icon-bg-orange',
      items: [
        'Os 4 perdedores do Upper disputam as <strong>Quartas Cruzadas</strong>.',
        'Cruzamento invertido: perdedor da SF enfrenta perdedor da QF do lado oposto (evita rematch).',
        'Vencedores das LB Quartas disputam a <strong>Semifinal Inferior</strong>.',
        'Vencedor da LB SF enfrenta o <strong>perdedor da Final Superior</strong> na Final Inferior.',
        'Qualquer derrota na Chave Inferior elimina o time.'
      ]
    }
  ]
};

// ------------------------------------------------------------------
// Format: Escada (Gauntlet) — 6 Times
// ------------------------------------------------------------------

const FORMAT_GAUNTLET_6 = {
  id: 'gauntlet-6',
  name: 'Escada (Gauntlet) — 6 Times',
  classified: 6,
  minTeams: 6,

  classificationTiers: [
    { from: 1, to: 1, cssClass: 'classified-green-dark', label: 'UB Final — 2 jogos mín', color: 'var(--color-win)' },
    { from: 2, to: 2, cssClass: 'classified-green-light', label: 'UB R2 — 3 jogos mín', color: '#2ecc71' },
    { from: 3, to: 4, cssClass: 'classified-yellow-dark', label: 'UB R1 — Dupla eliminação', color: '#b8860b' },
    { from: 5, to: 6, cssClass: 'classified-yellow-light', label: 'LB R1 — Sem 2ª chance', color: '#d4a843' }
  ],

  defaultMatches() {
    return {
      'ub-r1': _newMatch('ub-r1', 'Upper Bracket Round 1', '3º vs 4º'),
      'ub-r2': _newMatch('ub-r2', 'Upper Bracket Round 2', '2º vs Venc. R1'),
      'ub-final': _newMatch('ub-final', 'Final da Chave Superior', '1º vs Venc. R2'),
      'lb-r1': _newMatch('lb-r1', 'Lower Bracket Round 1', '5º vs 6º'),
      'lb-r2': _newMatch('lb-r2', 'Lower Bracket Round 2', 'Venc. LB R1 vs Perd. UB R1'),
      'lb-r3': _newMatch('lb-r3', 'Lower Bracket Round 3', 'Venc. LB R2 vs Perd. UB R2'),
      'lb-final': _newMatch('lb-final', 'Final da Chave Inferior', 'Venc. LB R3 vs Perd. UB Final'),
      'grand-final': _newMatch('grand-final', 'Grande Final', 'Grande Final')
    };
  },

  generateBracket(rankedTeams, matches) {
    const [p1, p2, p3, p4, p5, p6] = rankedTeams;
    matches['ub-r1'].timeA = p3.id;
    matches['ub-r1'].timeB = p4.id;
    matches['ub-r2'].timeA = p2.id;  // 2nd has bye to R2
    matches['ub-final'].timeA = p1.id;  // 1st has bye to Final
    matches['lb-r1'].timeA = p5.id;
    matches['lb-r1'].timeB = p6.id;
  },

  propagateResult(matches) {
    const ubR1 = matches['ub-r1'];
    const ubR2 = matches['ub-r2'];
    const ubFinal = matches['ub-final'];
    const lbR1 = matches['lb-r1'];
    const lbR2 = matches['lb-r2'];
    const lbR3 = matches['lb-r3'];
    const lbFinal = matches['lb-final'];
    const gf = matches['grand-final'];

    // UB R1 winner → UB R2 (timeB)
    if (ubR1.vencedor) ubR2.timeB = ubR1.vencedor;
    // UB R2 winner → UB Final (timeB)
    if (ubR2.vencedor) ubFinal.timeB = ubR2.vencedor;

    // UB R1 loser → LB R2
    if (ubR1.perdedor && lbR1.vencedor) {
      lbR2.timeA = lbR1.vencedor;
      lbR2.timeB = ubR1.perdedor;
    }
    // UB R2 loser → LB R3
    if (ubR2.perdedor && lbR2.vencedor) {
      lbR3.timeA = lbR2.vencedor;
      lbR3.timeB = ubR2.perdedor;
    }
    // UB Final loser → LB Final
    if (ubFinal.perdedor && lbR3.vencedor) {
      lbFinal.timeA = lbR3.vencedor;
      lbFinal.timeB = ubFinal.perdedor;
    }

    // Grand Final
    if (ubFinal.vencedor) gf.timeA = ubFinal.vencedor;
    if (lbFinal.vencedor) gf.timeB = lbFinal.vencedor;
  },

  resetDownstream(matches, matchId) {
    const ubR2 = matches['ub-r2'];
    const ubFinal = matches['ub-final'];
    const lbR2 = matches['lb-r2'];
    const lbR3 = matches['lb-r3'];
    const lbFinal = matches['lb-final'];
    const gf = matches['grand-final'];

    if (matchId === 'ub-r1') {
      ubR2.timeB = null; _clearMatch(ubR2);
      ubFinal.timeB = null; _clearMatch(ubFinal);
      _clearMatchFull(lbR2); _clearMatchFull(lbR3);
      _clearMatchFull(lbFinal); _clearMatchFull(gf);
    }
    if (matchId === 'ub-r2') {
      ubFinal.timeB = null; _clearMatch(ubFinal);
      _clearMatchFull(lbR3); _clearMatchFull(lbFinal); _clearMatchFull(gf);
    }
    if (matchId === 'ub-final') {
      _clearMatch(lbFinal); lbFinal.timeB = null;
      _clearMatchFull(gf);
    }
    if (matchId === 'lb-r1') {
      _clearMatch(lbR2); lbR2.timeA = null;
      _clearMatchFull(lbR3); _clearMatchFull(lbFinal); _clearMatchFull(gf);
    }
    if (matchId === 'lb-r2') {
      _clearMatch(lbR3); lbR3.timeA = null;
      _clearMatchFull(lbFinal); _clearMatchFull(gf);
    }
    if (matchId === 'lb-r3') {
      _clearMatch(lbFinal); lbFinal.timeA = null;
      _clearMatch(gf); gf.timeB = null;
    }
    if (matchId === 'lb-final') {
      _clearMatch(gf); gf.timeB = null;
    }
  },

  isGrandFinal(matchId) { return matchId === 'grand-final'; },
  getGrandFinal(matches) { return matches['grand-final']; },
  getAllMatches(matches) { return Object.values(matches); },
  getRegularMatches(matches) { return Object.values(matches).filter(m => m.id !== 'grand-final'); },

  matchImportanceOrder: ['grand-final', 'lb-final', 'lb-r3', 'lb-r2', 'lb-r1', 'ub-final', 'ub-r2', 'ub-r1'],

  getMatchMeta(matchId) {
    if (matchId === 'grand-final') return { bracket: 'grand', color: 'var(--color-champion)' };
    if (matchId.startsWith('lb-')) return { bracket: 'lower', color: 'var(--color-lower)' };
    return { bracket: 'upper', color: 'var(--color-upper)' };
  },

  miniBracketEntries: [
    { matchId: 'ub-r1', phase: 'UB R1', color: 'var(--color-upper)' },
    { matchId: 'ub-r2', phase: 'UB R2', color: 'var(--color-upper)' },
    { matchId: 'ub-final', phase: 'UB Final', color: 'var(--color-upper)' },
    { matchId: 'lb-r1', phase: 'LB R1', color: 'var(--color-lower)' },
    { matchId: 'lb-r2', phase: 'LB R2', color: 'var(--color-lower)' },
    { matchId: 'lb-r3', phase: 'LB R3', color: 'var(--color-lower)' },
    { matchId: 'lb-final', phase: 'LB Final', color: 'var(--color-lower)' },
    { matchId: 'grand-final', phase: 'GF', color: 'var(--color-champion)' }
  ],

  previewSlots: [
    { section: 'upper', title: 'Chave Superior (Escada)', phases: [
      { name: 'UB Round 1', matches: [
        { slotA: '3º Colocado', slotB: '4º Colocado' }
      ], note: '1º e 2º não jogam nesta fase' },
      { name: 'UB Round 2', matches: [
        { slotA: '2º Colocado (BYE)', slotB: 'Vencedor UB R1' }
      ]},
      { name: 'UB Final', matches: [
        { slotA: '1º Colocado (BYE)', slotB: 'Vencedor UB R2' }
      ]}
    ]},
    { section: 'lower', title: 'Chave Inferior', phases: [
      { name: 'LB Round 1', matches: [
        { slotA: '5º Colocado', slotB: '6º Colocado' }
      ], note: 'Perdedor eliminado (sem 2ª chance)' },
      { name: 'LB Round 2', matches: [
        { slotA: 'Vencedor LB R1', slotB: 'Perdedor UB R1' }
      ]},
      { name: 'LB Round 3', matches: [
        { slotA: 'Vencedor LB R2', slotB: 'Perdedor UB R2' }
      ]},
      { name: 'LB Final', matches: [
        { slotA: 'Vencedor LB R3', slotB: 'Perdedor UB Final' }
      ]}
    ]},
    { section: 'grand', title: 'Grande Final', phases: [
      { name: 'Grande Final', matches: [
        { slotA: 'Vencedor UB Final (CS)', slotB: 'Vencedor LB Final (CI)' }
      ]}
    ]}
  ],

  infoCards: {
    path: [
      { seed: '1º', desc: 'UB Final → GF', games: '2 jogos mín' },
      { seed: '2º', desc: 'UB R2 → UB Final → GF', games: '3 jogos mín' },
      { seed: '3º-4º', desc: 'UB R1 → UB R2 → UB Final → GF', games: '4 jogos mín' },
      { seed: '5º-6º', desc: 'LB R1 → R2 → R3 → LB Final → GF', games: '5 jogos mín' }
    ],
    mechanics: [
      'Upper sobe em degraus — cada seed entra num nível',
      'Perdedor do Upper cai para o próximo round da Lower',
      'Lower recebe um novo adversário a cada round',
      '1º-4º têm dupla eliminação, 5º-6º têm apenas 1 chance'
    ],
    advantages: [
      '1º — BYE até a UB Final (só 2 jogos)',
      '2º — BYE até a UB R2 (só 3 jogos)',
      'Chave Superior — Vantagem de ban na Grande Final'
    ]
  },

  rules: [
    {
      title: 'Chave Superior (Escada)',
      icon: '★',
      iconBg: 'icon-bg-purple',
      items: [
        '<strong>Round 1:</strong> 3º vs 4º (1º e 2º têm bye).',
        '<strong>Round 2:</strong> 2º vs Vencedor do R1.',
        '<strong>UB Final:</strong> 1º vs Vencedor do R2.',
        'Perdedores caem para a Chave Inferior no round correspondente.',
        '1º só entra na UB Final — mínimo 2 jogos para o título.'
      ]
    },
    {
      title: 'Chave Inferior',
      icon: '↓',
      iconBg: 'icon-bg-orange',
      items: [
        '<strong>LB R1:</strong> 5º vs 6º (perdedor eliminado, sem 2ª chance).',
        '<strong>LB R2:</strong> Vencedor LB R1 vs Perdedor UB R1.',
        '<strong>LB R3:</strong> Vencedor LB R2 vs Perdedor UB R2.',
        '<strong>LB Final:</strong> Vencedor LB R3 vs Perdedor UB Final.',
        'Qualquer derrota na Lower elimina o time.'
      ]
    }
  ]
};

// ------------------------------------------------------------------
// Registry
// ------------------------------------------------------------------

const PLAYOFF_FORMATS = {
  'double-elim-4': FORMAT_DOUBLE_ELIM_4,
  'play-in-6': FORMAT_PLAY_IN_6,
  'gauntlet-6': FORMAT_GAUNTLET_6
};

const DEFAULT_PLAYOFF_FORMAT = 'double-elim-4';

function getPlayoffFormat(formatId) {
  return PLAYOFF_FORMATS[formatId] || PLAYOFF_FORMATS[DEFAULT_PLAYOFF_FORMAT];
}

function getSelectedFormat(state) {
  const formatId = (state.playoffs && state.playoffs.formato) || DEFAULT_PLAYOFF_FORMAT;
  return getPlayoffFormat(formatId);
}

window.PlayoffFormats = {
  FORMATS: PLAYOFF_FORMATS,
  DEFAULT: DEFAULT_PLAYOFF_FORMAT,
  get: getPlayoffFormat,
  getSelected: getSelectedFormat
};
