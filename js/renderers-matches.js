/**
 * Renderers — Matches & Bracket
 * Group stage calendar, playoff matches, bracket views
 * All playoff rendering delegates to the format strategy.
 */

// ------------------------------------------------------------------
// MATCHES
// ------------------------------------------------------------------

function renderPartidas() {
  const state = AppState.loadReadOnly();
  const container = document.getElementById('partidasContainer');
  if (!container) return;

  const admin = UI.checkAdmin();
  const hasGrupos = state.faseGrupos.partidas.length > 0;
  const hasPlayoffs = state.campeonato.status === 'playoffs' || state.campeonato.status === 'encerrado';

  if (!hasGrupos) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">&#128197;</div>
        <div class="empty-title">Nenhuma partida gerada</div>
        <div class="empty-desc">Cadastre os times e inicie a fase de grupos para gerar o calend&aacute;rio.</div>
      </div>`;
    return;
  }

  let html = '';
  if (hasPlayoffs) {
    html += `<div class="tab-bar" style="margin-bottom:20px">
      <button class="tab-btn" id="tabPartGrupos" onclick="switchPartidaTab('grupos')">Fase de Grupos</button>
      <button class="tab-btn active" id="tabPartPlayoffs" onclick="switchPartidaTab('playoffs')">Playoffs</button>
    </div>`;
  }

  html += '<div id="partidaTabGrupos"' + (hasPlayoffs ? ' style="display:none"' : '') + '>';
  html += renderPartidasGrupos(state, admin);
  html += '</div>';

  if (hasPlayoffs) {
    html += '<div id="partidaTabPlayoffs">';
    html += renderPartidasPlayoffs(state, admin);
    html += '</div>';
  }

  container.innerHTML = html;
}

let _currentRound = 1;

function navigateRound(delta) {
  const state = AppState.loadReadOnly();
  const rounds = [...new Set(state.faseGrupos.partidas.map(p => p.rodada))].sort((a, b) => a - b);
  const idx = rounds.indexOf(_currentRound) + delta;
  if (idx < 0 || idx >= rounds.length) return;
  _currentRound = rounds[idx];
  const admin = UI.checkAdmin();
  const gruposDiv = document.getElementById('partidaTabGrupos');
  if (gruposDiv) gruposDiv.innerHTML = renderPartidasGrupos(state, admin);
}

function renderPartidasGrupos(state, admin) {
  const partidas = state.faseGrupos.partidas;
  const byRound = {};
  partidas.forEach(p => {
    if (!byRound[p.rodada]) byRound[p.rodada] = [];
    byRound[p.rodada].push(p);
  });

  const rounds = Object.keys(byRound).map(Number).sort((a, b) => a - b);
  if (rounds.length === 0) return '';

  if (!rounds.includes(_currentRound)) _currentRound = rounds[0];

  const doneCount = partidas.filter(p => p.status === 'concluida').length;
  const pendingCount = partidas.length - doneCount;
  const curIdx = rounds.indexOf(_currentRound);
  const isFirst = curIdx === 0;
  const isLast = curIdx === rounds.length - 1;
  const matches = byRound[_currentRound];
  const roundDone = matches.filter(p => p.status === 'concluida').length;

  let html = `<div class="stats-counter-row">
    <span style="font-size:.8rem;color:var(--color-text-muted)">${doneCount} de ${partidas.length} partidas conclu&iacute;das</span>
    ${pendingCount === 0 ? '<span class="completed-badge">Fase de Grupos Conclu&iacute;da!</span>' : ''}
  </div>`;

  html += `<div class="round-pagination">
    <button class="btn-round-nav" onclick="navigateRound(-1)" ${isFirst ? 'disabled' : ''} title="Rodada anterior">&#9664;</button>
    <div class="round-pagination-info">
      <span class="round-pagination-title">Rodada ${_currentRound}</span>
      <span class="round-pagination-sub">${roundDone} de ${matches.length} conclu&iacute;das</span>
    </div>
    <button class="btn-round-nav" onclick="navigateRound(1)" ${isLast ? 'disabled' : ''} title="Pr&oacute;xima rodada">&#9654;</button>
  </div>`;

  html += `<div class="matches-grid">
    ${matches.map(p => renderMatchCardWithAction(p, state, admin)).join('')}
  </div>`;

  return html;
}

// ------------------------------------------------------------------
// PLAYOFF MATCHES — format-agnostic
// ------------------------------------------------------------------

function renderPartidasPlayoffs(state, admin) {
  const format = PlayoffFormats.getSelected(state);
  const matches = state.playoffs.matches;
  if (!matches || Object.keys(matches).length === 0) {
    return '<div class="empty-state"><div class="empty-icon">&#9203;</div><div class="empty-title">Aguardando propaga&ccedil;&atilde;o</div></div>';
  }

  const allEntries = [];
  format.getAllMatches(matches).forEach(m => {
    if (!m.timeA && !m.timeB) return;
    const meta = format.getMatchMeta(m.id);
    const isGF = format.isGrandFinal(m.id);
    allEntries.push({
      match: m,
      concluded: m.vencedor !== null,
      id: m.id,
      isGF,
      color: meta.color,
      bracket: meta.bracket
    });
  });

  // Sort: pending first, then by importance
  const importanceOrder = format.matchImportanceOrder;
  allEntries.sort((a, b) => {
    if (a.concluded !== b.concluded) return a.concluded ? 1 : -1;
    return importanceOrder.indexOf(a.id) - importanceOrder.indexOf(b.id);
  });

  let html = '';
  allEntries.forEach(entry => {
    const m = entry.match;
    const tA = AppState.getTimeById(state, m.timeA);
    const tB = AppState.getTimeById(state, m.timeB);
    const concluded = entry.concluded;
    const nameA = tA ? UI.escapeHtml(tA.nome) : '?';
    const nameB = tB ? UI.escapeHtml(tB.nome) : '?';
    const sc = concluded ? UI.scoreClass(m.golsA, m.golsB) : '';
    const gfAttr = entry.isGF ? '1' : '0';

    let desktopBtn = '';
    let mobileBtn = '';
    if (admin && !concluded) {
      desktopBtn = `<button class="btn btn-sm btn-success admin-only btn-score-action" data-match-id="${m.id}" data-gf="${gfAttr}">Registrar</button>`;
      mobileBtn = desktopBtn;
    } else if (admin && concluded) {
      desktopBtn = `<button class="btn btn-sm btn-secondary admin-only btn-score-action" data-match-id="${m.id}" data-gf="${gfAttr}">Editar</button>`;
      mobileBtn = desktopBtn;
    }

    const partA = tA && tA.participante ? `<span class="team-participant">${UI.escapeHtml(tA.participante)}</span>` : '';
    const partB = tB && tB.participante ? `<span class="team-participant">${UI.escapeHtml(tB.participante)}</span>` : '';

    // Grand final header
    if (entry.isGF) {
      html += `<div style="margin-bottom:8px">
        <div class="playoff-section-header" style="color:var(--color-champion);border-bottom-color:rgba(249,168,37,0.3)">&#127942; Grande Final</div>`;
    }

    html += `<div class="match-card" style="border-left:3px solid ${entry.color};margin-bottom:8px">
      ${!entry.isGF ? '<div class="match-round-badge" style="font-size:.6rem">' + UI.escapeHtml(m.fase) + '</div>' : ''}
      <div class="match-desktop">
        <div class="match-teams">
          <div class="match-team home">
            <div class="match-team-info" style="text-align:right"><span class="team-name-text">${nameA}</span>${partA}</div>
            ${UI.renderAvatar(tA, 24)}
          </div>
          <div class="match-score ${sc}">
            <span class="score-val">${concluded ? m.golsA : '-'}</span>
            <span class="dash">:</span>
            <span class="score-val">${concluded ? m.golsB : '-'}</span>
          </div>
          <div class="match-team away">
            ${UI.renderAvatar(tB, 24)}
            <div class="match-team-info"><span class="team-name-text">${nameB}</span>${partB}</div>
          </div>
        </div>
        <div class="match-action-slot">${desktopBtn}</div>
      </div>
      <div class="match-mobile">
        <div class="match-mobile-row">
          ${UI.renderAvatar(tA, 28)}
          <span class="match-mobile-name">${nameA}</span>
          <span class="match-mobile-score ${concluded && m.golsA > m.golsB ? 'win' : concluded && m.golsA < m.golsB ? 'loss' : ''}">${concluded ? m.golsA : '-'}</span>
        </div>
        <div class="match-mobile-row">
          ${UI.renderAvatar(tB, 28)}
          <span class="match-mobile-name">${nameB}</span>
          <span class="match-mobile-score ${concluded && m.golsB > m.golsA ? 'win' : concluded && m.golsB < m.golsA ? 'loss' : ''}">${concluded ? m.golsB : '-'}</span>
        </div>
        ${mobileBtn ? '<div class="match-mobile-action">' + mobileBtn + '</div>' : ''}
      </div>
    </div>`;

    if (entry.isGF) html += '</div>';
  });

  return html || '<div class="empty-state"><div class="empty-icon">&#9203;</div><div class="empty-title">Aguardando propaga&ccedil;&atilde;o</div></div>';
}

function renderMatchCardWithAction(p, state, admin) {
  const tA = AppState.getTimeById(state, p.timeA);
  const tB = AppState.getTimeById(state, p.timeB);
  const nameA = tA ? UI.escapeHtml(tA.nome) : 'Time A';
  const nameB = tB ? UI.escapeHtml(tB.nome) : 'Time B';
  const concluded = p.status === 'concluida';
  const sc = concluded ? UI.scoreClass(p.golsA, p.golsB) : '';

  const partA = tA && tA.participante ? `<span class="team-participant">${UI.escapeHtml(tA.participante)}</span>` : '';
  const partB = tB && tB.participante ? `<span class="team-participant">${UI.escapeHtml(tB.participante)}</span>` : '';

  let desktopBtn = '';
  let mobileBtn = '';
  if (admin && !concluded) {
    desktopBtn = `<button class="btn btn-sm btn-success admin-only btn-score-action" data-match-id="${p.id}" data-gf="0">Registrar</button>`;
    mobileBtn = desktopBtn;
  } else if (admin && concluded) {
    desktopBtn = `<button class="btn btn-sm btn-secondary admin-only btn-score-action" data-match-id="${p.id}" data-gf="0">Editar</button>`;
    mobileBtn = desktopBtn;
  }

  return `
    <div class="match-card">
      <div class="match-desktop">
        <div class="match-teams">
          <div class="match-team home">
            <div class="match-team-info" style="text-align:right"><span class="team-name-text">${nameA}</span>${partA}</div>
            ${UI.renderAvatar(tA, 24)}
          </div>
          <div class="match-score ${sc}">
            <span class="score-val">${concluded ? p.golsA : '-'}</span>
            <span class="dash">:</span>
            <span class="score-val">${concluded ? p.golsB : '-'}</span>
          </div>
          <div class="match-team away">
            ${UI.renderAvatar(tB, 24)}
            <div class="match-team-info"><span class="team-name-text">${nameB}</span>${partB}</div>
          </div>
        </div>
        <div class="match-action-slot">${desktopBtn}</div>
      </div>
      <div class="match-mobile">
        <div class="match-mobile-row">
          ${UI.renderAvatar(tA, 28)}
          <span class="match-mobile-name">${nameA}${partA ? ' <span class="team-participant">' + UI.escapeHtml(tA.participante) + '</span>' : ''}</span>
          <span class="match-mobile-score ${concluded && p.golsA > p.golsB ? 'win' : concluded && p.golsA < p.golsB ? 'loss' : ''}">${concluded ? p.golsA : '-'}</span>
        </div>
        <div class="match-mobile-row">
          ${UI.renderAvatar(tB, 28)}
          <span class="match-mobile-name">${nameB}${partB ? ' <span class="team-participant">' + UI.escapeHtml(tB.participante) + '</span>' : ''}</span>
          <span class="match-mobile-score ${concluded && p.golsB > p.golsA ? 'win' : concluded && p.golsB < p.golsA ? 'loss' : ''}">${concluded ? p.golsB : '-'}</span>
        </div>
        ${mobileBtn ? '<div class="match-mobile-action">' + mobileBtn + '</div>' : ''}
      </div>
    </div>`;
}

// ------------------------------------------------------------------
// BRACKET — format selector, preview, live bracket
// ------------------------------------------------------------------

function renderBracket() {
  const state = AppState.loadReadOnly();
  const container = document.getElementById('bracketContainer');
  const infoContainer = document.getElementById('bracketInfoCards');
  const titleEl = document.getElementById('bracketTitle');
  if (!container) return;

  const format = PlayoffFormats.getSelected(state);
  const isPrePlayoffs = state.campeonato.status === 'configuracao' || state.campeonato.status === 'grupos';
  const isPlayoffs = state.campeonato.status === 'playoffs' || state.campeonato.status === 'encerrado';

  // Show/hide refazer button
  const refazerBtn = document.getElementById('btnRefazerPlayoffs');
  if (refazerBtn) refazerBtn.style.display = isPlayoffs ? '' : 'none';
  if (typeof updateAdminUI === 'function') updateAdminUI();

  // Update title
  if (titleEl) {
    titleEl.textContent = isPlayoffs ? 'Chaveamento \u2014 ' + format.name : 'Chaveamento';
  }

  // Format selector (admin only, pre-playoffs)
  const selectorContainer = document.getElementById('formatSelectorContainer');
  if (selectorContainer) {
    if (isPrePlayoffs) {
      selectorContainer.style.display = '';
      _renderFormatSelector(state);
    } else {
      selectorContainer.style.display = 'none';
    }
  }

  if (isPrePlayoffs) {
    // Show preview bracket with generic names (no state passed)
    const selectedId = _getSelectedFormatId();
    const previewFormat = PlayoffFormats.get(selectedId);
    container.innerHTML = previewFormat.renderBracketHTML(null);
    if (infoContainer) infoContainer.innerHTML = _renderInfoCards(previewFormat);
  } else {
    // Show live bracket with real team data
    container.innerHTML = format.renderBracketHTML(state);
    if (infoContainer) infoContainer.innerHTML = _renderInfoCards(format);
  }
}

function _getSelectedFormatId() {
  const sel = document.getElementById('playoffFormatSelect');
  return sel ? sel.value : PlayoffFormats.DEFAULT;
}

function _renderFormatSelector(state) {
  const sel = document.getElementById('playoffFormatSelect');
  const warning = document.getElementById('formatWarning');
  const btnGerar = document.getElementById('btnGerarPlayoffs');
  if (!sel) return;

  const currentFormatId = state.playoffs.formato || PlayoffFormats.DEFAULT;

  // Populate dropdown if empty
  if (sel.options.length === 0) {
    Object.values(PlayoffFormats.FORMATS).forEach(f => {
      const opt = document.createElement('option');
      opt.value = f.id;
      opt.textContent = f.name;
      sel.appendChild(opt);
    });
    sel.value = currentFormatId;
  }

  const selectedFormat = PlayoffFormats.get(sel.value);
  const teamCount = state.times.length;
  const groupsDone = state.faseGrupos.partidas.length > 0 &&
    state.faseGrupos.partidas.filter(p => p.status === 'pendente').length === 0;

  let canGenerate = true;
  let warningMsg = '';

  if (teamCount < selectedFormat.classified) {
    canGenerate = false;
    warningMsg = `Este formato classifica ${selectedFormat.classified} times, mas apenas ${teamCount} est&atilde;o cadastrados. Cadastre pelo menos ${selectedFormat.classified} times.`;
  } else if (!groupsDone) {
    canGenerate = false;
    warningMsg = 'Conclua todas as partidas da fase de grupos antes de gerar os playoffs.';
  } else {
    const tabela = AppState.calcularClassificacao(state);
    if (tabela.length < selectedFormat.classified) {
      canGenerate = false;
      warningMsg = `Necess&aacute;rio pelo menos ${selectedFormat.classified} times na classifica&ccedil;&atilde;o.`;
    }
  }

  if (warning) {
    warning.style.display = warningMsg ? '' : 'none';
    warning.innerHTML = warningMsg;
  }
  if (btnGerar) {
    btnGerar.disabled = !canGenerate;
    btnGerar.title = canGenerate ? '' : 'N\u00e3o \u00e9 poss\u00edvel gerar playoffs neste momento';
  }
}

function onFormatChange() {
  const state = AppState.loadReadOnly();
  _renderFormatSelector(state);
  // Re-render preview + info cards
  const container = document.getElementById('bracketContainer');
  const infoContainer = document.getElementById('bracketInfoCards');
  const selectedId = _getSelectedFormatId();
  const previewFormat = PlayoffFormats.get(selectedId);
  if (container) container.innerHTML = previewFormat.renderBracketHTML(null);
  if (infoContainer) infoContainer.innerHTML = _renderInfoCards(previewFormat);
  // Update classification colors
  if (window.Renderers && window.Renderers.classificacao) Renderers.classificacao();
}
window.onFormatChange = onFormatChange;

// ------------------------------------------------------------------
// PREVIEW BRACKET (generic names, pre-playoffs)
// ------------------------------------------------------------------

function _renderPreviewBracket(format) {
  let html = '<div class="preview-bracket">';

  format.previewSlots.forEach(section => {
    const labelClass = section.section; // 'upper', 'lower', 'grand'
    const icon = section.section === 'upper' ? '&#9733;' : section.section === 'lower' ? '&#8595;' : '&#127942;';
    html += `<div class="preview-section">
      <span class="preview-section-label ${labelClass}">${icon} ${UI.escapeHtml(section.title)}</span>`;

    section.phases.forEach(phase => {
      html += `<div class="preview-phase-title">${UI.escapeHtml(phase.name)}</div>`;
      phase.matches.forEach(m => {
        html += `<div class="preview-match">
          <div class="preview-slot">${UI.escapeHtml(m.slotA)}</div>
          <div class="preview-slot">${UI.escapeHtml(m.slotB)}</div>
        </div>`;
      });
      if (phase.note) {
        html += `<div class="preview-phase-note">${UI.escapeHtml(phase.note)}</div>`;
      }
    });

    html += '</div>';
  });

  html += '</div>';
  return html;
}

// ------------------------------------------------------------------
// LIVE BRACKET (during playoffs — mobile-first stacked)
// ------------------------------------------------------------------

function _renderLiveBracketMobile(state, format) {
  const matches = state.playoffs.matches;
  if (!matches || Object.keys(matches).length === 0) {
    return '<div class="empty-state"><div class="empty-icon">&#127942;</div><div class="empty-title">Playoffs ainda n&atilde;o iniciados</div></div>';
  }

  let html = '<div class="bracket-mobile-stack">';

  // Group matches by bracket section
  format.previewSlots.forEach(section => {
    const labelClass = section.section;
    const icon = section.section === 'upper' ? '&#9733;' : section.section === 'lower' ? '&#8595;' : '&#127942;';
    const borderColor = section.section === 'upper' ? 'var(--color-upper)' : section.section === 'lower' ? 'var(--color-lower)' : 'var(--color-champion)';
    const bgStyle = section.section === 'grand' ? 'background:var(--color-champion-bg);' : '';

    html += `<div class="bracket-mobile-section" style="border-left:3px solid ${borderColor};${bgStyle}">
      <div class="bracket-mobile-section-title" style="color:${borderColor}">${icon} ${UI.escapeHtml(section.title)}</div>`;

    section.phases.forEach((phase, phaseIdx) => {
      if (phaseIdx > 0) {
        html += '<div style="margin-top:12px;padding-top:12px;border-top:1px dashed var(--color-border)">';
        html += `<div class="phase-label-small">${UI.escapeHtml(phase.name)}</div>`;
      }

      // Find actual matches for this phase
      phase.matches.forEach((previewMatch, matchIdx) => {
        // Map preview slot index to actual match — use match order within section
        const sectionMatchIds = _getPhaseMatchIds(format, section.section, phase.name);
        const matchId = sectionMatchIds[matchIdx];
        const m = matchId ? matches[matchId] : null;

        if (m) {
          const tipo = section.section === 'grand' ? 'grand' : section.section;
          html += _renderBracketMatch(m, state, tipo);
        }
      });

      if (phaseIdx > 0) html += '</div>';
    });

    if (section.section === 'grand') {
      html += '<div style="font-size:.7rem;color:var(--color-champion);margin-top:8px">&#9733; Chave Superior tem vantagem de ban</div>';
    }

    html += '</div>';
  });

  html += '</div>';
  return html;
}

/**
 * Maps phase names to match IDs for a given format section.
 * This bridges the preview structure to actual match data.
 */
function _getPhaseMatchIds(format, section, phaseName) {
  // Build mapping from miniBracketEntries
  const sectionMatches = format.miniBracketEntries
    .filter(e => {
      const meta = format.getMatchMeta(e.matchId);
      return meta.bracket === section || (section === 'grand' && format.isGrandFinal(e.matchId));
    })
    .map(e => e.matchId);

  // For each phase in previewSlots, count how many matches it has
  const sectionConfig = format.previewSlots.find(s => s.section === section);
  if (!sectionConfig) return sectionMatches;

  let idx = 0;
  for (const phase of sectionConfig.phases) {
    if (phase.name === phaseName) {
      return sectionMatches.slice(idx, idx + phase.matches.length);
    }
    idx += phase.matches.length;
  }
  return [];
}

function _renderBracketMatch(m, state, tipo) {
  const tA = m.timeA ? AppState.getTimeById(state, m.timeA) : null;
  const tB = m.timeB ? AppState.getTimeById(state, m.timeB) : null;

  return `
    <div class="bracket-match ${tipo}-match" style="margin-bottom:8px">
      ${_renderBracketSlot(tA, m.golsA, m.vencedor === m.timeA)}
      ${_renderBracketSlot(tB, m.golsB, m.vencedor === m.timeB)}
    </div>`;
}

function _renderBracketSlot(time, gols, isWinner) {
  if (!time) {
    return '<div class="bracket-slot tbd"><span>A definir</span></div>';
  }
  return `
    <div class="bracket-slot ${isWinner ? 'winner' : ''}">
      ${UI.renderAvatar(time, 22, 'bracket-slot-avatar')}
      <span class="bracket-slot-name">${UI.escapeHtml(time.nome)}</span>
      <span class="bracket-slot-score">${gols !== null ? gols : ''}</span>
    </div>`;
}

// ------------------------------------------------------------------
// INFO CARDS
// ------------------------------------------------------------------

function _renderInfoCards(format) {
  const cards = format.infoCards;
  const rules = format.rules;

  // Rules cards (Chave Superior, Chave Inferior) + info cards
  let html = '';

  // Rules from format (rendered as rule-cards matching the regras page style)
  if (rules && rules.length > 0) {
    html += '<div class="bracket-rules-section">';
    rules.forEach(rule => {
      const borderColor = rule.iconBg === 'icon-bg-purple' ? 'var(--color-upper)' : rule.iconBg === 'icon-bg-orange' ? 'var(--color-lower)' : 'var(--color-text-dim)';
      html += `<div class="info-card" style="border-left:3px solid ${borderColor}">
        <div class="info-card-title" style="color:${borderColor}">${rule.icon} ${rule.title}</div>
        <ul style="list-style:none;padding:0;margin:0">
          ${rule.items.map(item => '<li class="info-card-line" style="padding:2px 0">' + item + '</li>').join('')}
        </ul>
      </div>`;
    });

    // Grand Final advantage card (shared)
    html += `<div class="info-card" style="border-left:3px solid var(--color-champion)">
      <div class="info-card-title" style="color:var(--color-champion)">&#127942; Grande Final</div>
      <ul style="list-style:none;padding:0;margin:0">
        <li class="info-card-line" style="padding:2px 0">Vencedor da <strong>Chave Superior</strong> vs Vencedor da <strong>Chave Inferior</strong>.</li>
        <li class="info-card-line" style="padding:2px 0">Jogo &uacute;nico, sem empate (prorroga&ccedil;&atilde;o/p&ecirc;naltis se necess&aacute;rio).</li>
        <li class="info-card-line" style="padding:2px 0">O time da <strong>Chave Superior</strong> tem <strong>vantagem de ban</strong>.</li>
      </ul>
    </div>`;
    html += '</div>';
  }

  // Info cards (path, mechanics, advantages)
  html += '<div class="bracket-info-cards">';

  // Path card
  html += `<div class="info-card">
    <div class="info-card-title" style="color:var(--color-champion)">Caminho at&eacute; o t&iacute;tulo</div>`;
  cards.path.forEach(p => {
    html += `<div class="info-card-line"><span class="seed">${UI.escapeHtml(p.seed)}</span> &mdash; ${UI.escapeHtml(p.desc)} <span class="games">(${UI.escapeHtml(p.games)})</span></div>`;
  });
  html += '</div>';

  // Mechanics card
  html += `<div class="info-card">
    <div class="info-card-title" style="color:var(--color-upper)">Mec&acirc;nica</div>`;
  cards.mechanics.forEach(m => {
    html += `<div class="info-card-line">${UI.escapeHtml(m)}</div>`;
  });
  html += '</div>';

  // Advantages card
  html += `<div class="info-card">
    <div class="info-card-title" style="color:var(--color-win)">Vantagens</div>`;
  cards.advantages.forEach(a => {
    html += `<div class="info-card-line">${UI.escapeHtml(a)}</div>`;
  });
  html += '</div>';

  html += '</div>';
  return html;
}

// ------------------------------------------------------------------
// HELPERS
// ------------------------------------------------------------------

function canStartPlayoffs(state) {
  const tabela = AppState.calcularClassificacao(state);
  const pending = state.faseGrupos.partidas.filter(p => p.status === 'pendente').length;
  return tabela.length >= 4 && pending === 0;
}

/**
 * Returns the currently selected format ID (from dropdown or state).
 * Used by other modules (actions, app) to determine active format.
 */
function getSelectedPlayoffFormatId() {
  const sel = document.getElementById('playoffFormatSelect');
  if (sel && sel.value) return sel.value;
  const state = AppState.loadReadOnly();
  return state.playoffs.formato || PlayoffFormats.DEFAULT;
}
window.getSelectedPlayoffFormatId = getSelectedPlayoffFormatId;
