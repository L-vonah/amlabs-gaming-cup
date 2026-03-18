/**
 * Renderers — 1o Campeonato FC Football AMLabs
 * All page-specific rendering functions
 */

// ------------------------------------------------------------------
// HOME
// ------------------------------------------------------------------

function renderHome() {
  const state = AppState.load();
  const tabela = AppState.calcularClassificacao(state);
  const partidas = state.faseGrupos.partidas;
  const concluidas = partidas.filter(p => p.status === 'concluida').length;

  document.getElementById('homeStatTimes').textContent = state.times.length;
  document.getElementById('homeStatPartidas').textContent = partidas.length;
  document.getElementById('homeStatConcluidas').textContent = concluidas;
  document.getElementById('homeStatGols').textContent =
    partidas.filter(p => p.status === 'concluida').reduce((s, p) => s + p.golsA + p.golsB, 0);

  UI.updateHeaderBadge(state.campeonato.status);
  UI.updateLifecycleBar(state.campeonato.status);

  // Champion banner — shown prominently when tournament is finished
  const championBanner = document.getElementById('championBanner');
  if (championBanner) {
    if (state.campeonato.status === 'encerrado' && state.playoffs.grandFinal.vencedor) {
      const winner = AppState.getTimeById(state, state.playoffs.grandFinal.vencedor);
      const gf = state.playoffs.grandFinal;
      championBanner.style.display = 'block';
      championBanner.innerHTML = `
        <div class="champion-banner">
          <div class="champion-glow"></div>
          <div class="champion-content">
            <div class="champion-trophy">
              <span class="champion-trophy-icon">&#127942;</span>
            </div>
            <div class="champion-label">CAMPEAO DO CAMPEONATO 2026</div>
            <div class="champion-name">${winner ? winner.nome : '?'}</div>
            ${winner ? `<div class="champion-avatar-wrapper">${UI.renderAvatar(winner, 80)}</div>` : ''}
            <div class="champion-score">${gf.golsUpper} &times; ${gf.golsLower} &mdash; Grande Final</div>
            <div class="champion-badge">1&ordm; Campeonato FC Football AMLabs 2026</div>
          </div>
        </div>`;
    } else {
      championBanner.style.display = 'none';
    }
  }

  // Last results
  const lastResults = partidas.filter(p => p.status === 'concluida').slice(-3).reverse();
  const container = document.getElementById('homeLastResults');
  if (container) {
    if (lastResults.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="empty-icon">&#9917;</div><div class="empty-title">Nenhum resultado ainda</div><div class="empty-desc">Registre resultados na aba Resultados</div></div>';
    } else {
      container.innerHTML = lastResults.map(p => renderMatchCard(p, state)).join('');
    }
  }

  // Leader card
  const leaderEl = document.getElementById('homeLeader');
  if (leaderEl) {
    if (tabela.length === 0) {
      leaderEl.innerHTML = '<div class="text-dim text-sm" style="padding:16px">Aguardando cadastro de times...</div>';
    } else {
      const leader = tabela[0];
      leaderEl.innerHTML = `
        <div style="display:flex;align-items:center;gap:16px;padding:20px 24px">
          ${UI.renderAvatar(leader, 48)}
          <div>
            <div style="font-weight:800;font-size:1.1rem">${leader.nome}</div>
            <div style="color:var(--color-text-muted);font-size:0.875rem">${leader.pontos} pts &bull; ${leader.vitorias}V ${leader.empates}E ${leader.derrotas}D</div>
          </div>
          <div style="margin-left:auto;font-size:2rem;font-weight:800;color:var(--color-champion)">1&deg;</div>
        </div>`;
    }
  }
}

// ------------------------------------------------------------------
// TEAMS
// ------------------------------------------------------------------

function renderTimes() {
  const state = AppState.load();
  const container = document.getElementById('timesGrid');
  const count = document.getElementById('timesCount');

  if (count) count.textContent = `${state.times.length} time${state.times.length !== 1 ? 's' : ''}`;

  if (!container) return;

  if (state.times.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <div class="empty-icon">&#128101;</div>
        <div class="empty-title">Nenhum time cadastrado</div>
        <div class="empty-desc">Adicione os times participantes usando o formulário ao lado.</div>
      </div>`;
    return;
  }

  container.innerHTML = state.times.map(t => `
    <div class="team-card">
      ${UI.renderAvatar(t, 44, 'team-card-avatar')}
      <div class="team-card-info">
        <div class="team-card-name">${t.nome}</div>
        <div class="team-card-abbr">${t.abreviacao}</div>
      </div>
      <div class="team-card-actions admin-only">
        <button class="btn-icon" onclick="deleteTime('${t.id}')" title="Remover time">&#x2715;</button>
      </div>
    </div>`).join('');

  // Update generate button state
  const genBtn = document.getElementById('btnGerarGrupos');
  if (genBtn) {
    genBtn.disabled = state.times.length < 2 || state.campeonato.status !== 'configuracao';
    genBtn.title = state.times.length < 2 ? 'Adicione pelo menos 2 times' : '';
  }
}

// ------------------------------------------------------------------
// CLASSIFICATION TABLE
// ------------------------------------------------------------------

function renderClassificacao() {
  const state = AppState.load();
  const tabela = AppState.calcularClassificacao(state);
  const container = document.getElementById('tabelaClassificacao');
  if (!container) return;

  const qualify = state.config.classificadosPorGrupo;

  if (tabela.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">&#128202;</div>
        <div class="empty-title">Tabela vazia</div>
        <div class="empty-desc">Cadastre times e inicie a fase de grupos para ver a classificação.</div>
      </div>`;
    return;
  }

  container.innerHTML = `
    <div class="classification-table-wrapper">
      <table class="classification-table">
        <thead>
          <tr>
            <th colspan="2">Time</th>
            <th class="text-center">J</th>
            <th class="text-center">V</th>
            <th class="text-center">E</th>
            <th class="text-center">D</th>
            <th class="text-center">GP</th>
            <th class="text-center">GC</th>
            <th class="text-center">SG</th>
            <th class="text-center">Pts</th>
            <th>Forma</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${tabela.map((t, i) => {
            const isQualified = i < qualify;
            const sgClass = t.saldoGols > 0 ? 'stat-positive' : t.saldoGols < 0 ? 'stat-negative' : 'stat-neutral';
            return `
              <tr class="${isQualified ? 'qualified' : ''}">
                <td>
                  <div class="pos-cell">
                    <span class="pos-number ${isQualified ? 'top' : ''}">${i + 1}</span>
                  </div>
                </td>
                <td>
                  <div class="team-name-cell">
                    ${UI.renderAvatar(t, 28)}
                    <div>
                      <div class="team-name-text">${t.nome}</div>
                    </div>
                  </div>
                </td>
                <td class="text-center text-muted">${t.jogos}</td>
                <td class="text-center stat-positive" style="font-weight:700">${t.vitorias}</td>
                <td class="text-center stat-neutral">${t.empates}</td>
                <td class="text-center stat-negative">${t.derrotas}</td>
                <td class="text-center">${t.golsMarcados}</td>
                <td class="text-center">${t.golsSofridos}</td>
                <td class="text-center ${sgClass}" style="font-weight:700">${UI.signedNumber(t.saldoGols)}</td>
                <td class="text-center"><span class="stat-pts">${t.pontos}</span></td>
                <td>
                  <div class="form-badges">
                    ${t.forma.map(f => `<span class="form-badge ${f}">${f}</span>`).join('')}
                  </div>
                </td>
                <td>${isQualified ? '<span class="qualified-label">Classif.</span>' : ''}</td>
              </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
    <div style="padding:12px 24px;border-top:1px solid var(--color-border);display:flex;align-items:center;gap:16px;font-size:0.8rem;color:var(--color-text-dim)">
      <span style="display:flex;align-items:center;gap:6px"><span style="display:inline-block;width:12px;height:12px;border-radius:2px;background:var(--color-win);opacity:.6"></span>Classificado para os Playoffs (Top ${qualify})</span>
      <span>&bull; Desempate: Pontos &rarr; Vit&oacute;rias &rarr; Saldo de Gols &rarr; Gols Marcados</span>
    </div>`;
}

// ------------------------------------------------------------------
// MATCHES
// ------------------------------------------------------------------

function renderPartidas() {
  const state = AppState.load();
  const partidas = state.faseGrupos.partidas;
  const container = document.getElementById('partidasContainer');
  if (!container) return;

  if (partidas.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">&#128197;</div>
        <div class="empty-title">Nenhuma partida gerada</div>
        <div class="empty-desc">Cadastre os times e inicie a fase de grupos para gerar o calendário.</div>
      </div>`;
    return;
  }

  // Group by round
  const byRound = {};
  partidas.forEach(p => {
    if (!byRound[p.rodada]) byRound[p.rodada] = [];
    byRound[p.rodada].push(p);
  });

  container.innerHTML = Object.entries(byRound).map(([rodada, matches]) => `
    <div style="margin-bottom:24px">
      <div style="font-size:0.75rem;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--color-text-dim);margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid var(--color-border)">
        Rodada ${rodada}
      </div>
      <div class="matches-grid">
        ${matches.map(p => renderMatchCard(p, state)).join('')}
      </div>
    </div>`).join('');
}

function renderMatchCard(p, state) {
  const tA = AppState.getTimeById(state, p.timeA);
  const tB = AppState.getTimeById(state, p.timeB);
  const nameA = tA ? tA.nome : 'Time A';
  const nameB = tB ? tB.nome : 'Time B';
  const concluded = p.status === 'concluida';
  const sc = concluded ? UI.scoreClass(p.golsA, p.golsB) : '';

  return `
    <div class="match-card">
      <div class="match-round-badge">Rod. ${p.rodada}</div>
      <div class="match-teams">
        <div class="match-team home">
          <span class="team-name-text">${nameA}</span>
          ${UI.renderAvatar(tA, 24)}
        </div>
        <div class="match-score ${sc}">
          <span class="score-val">${concluded ? p.golsA : '-'}</span>
          <span class="dash">:</span>
          <span class="score-val">${concluded ? p.golsB : '-'}</span>
        </div>
        <div class="match-team away">
          ${UI.renderAvatar(tB, 24)}
          <span class="team-name-text">${nameB}</span>
        </div>
      </div>
      <span class="match-status-badge ${p.status}">${concluded ? 'Conclul&#237;da' : 'Pendente'}</span>
    </div>`;
}

// ------------------------------------------------------------------
// REGISTER RESULTS — inline calendar layout for grupos and playoffs
// ------------------------------------------------------------------

function renderRegistrar() {
  const state = AppState.load();
  renderInlineGroupsCalendar(state);
  populatePlayoffResultsSection(state);
}

/**
 * Renders ALL group stage matches as an inline calendar with score inputs.
 * Both pending and concluded matches are shown. Concluded matches show the
 * existing score pre-filled and allow re-editing.
 */
function renderInlineGroupsCalendar(state) {
  const container = document.getElementById('gruposFormContainer');
  if (!container) return;

  const partidas = state.faseGrupos.partidas;

  if (partidas.length === 0) {
    if (state.campeonato.status === 'configuracao') {
      container.innerHTML = `<div class="empty-state"><div class="empty-icon">&#9917;</div><div class="empty-title">Fase de grupos não iniciada</div><div class="empty-desc">Vá para Times e gere o calendário da fase de grupos.</div></div>`;
    } else {
      container.innerHTML = `<div class="empty-state"><div class="empty-icon">&#10003;</div><div class="empty-title">Todos os jogos concluídos!</div><div class="empty-desc">Inicie os Playoffs para continuar.</div></div>`;
    }
    return;
  }

  // Group by round
  const byRound = {};
  partidas.forEach(p => {
    if (!byRound[p.rodada]) byRound[p.rodada] = [];
    byRound[p.rodada].push(p);
  });

  const pendingCount = partidas.filter(p => p.status === 'pendente').length;
  const doneCount = partidas.filter(p => p.status === 'concluida').length;

  let html = `
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;flex-wrap:wrap">
      <span style="font-size:.8rem;color:var(--color-text-muted)">${doneCount} de ${partidas.length} partidas concluídas</span>
      ${pendingCount === 0
        ? `<span style="font-size:.8rem;font-weight:700;color:var(--color-win);background:var(--color-win-bg);padding:3px 10px;border-radius:10px;border:1px solid rgba(0,184,148,0.3)">Fase de Grupos Concluída!</span>`
        : `<span style="font-size:.8rem;color:var(--color-text-dim)">${pendingCount} pendente${pendingCount !== 1 ? 's' : ''}</span>`
      }
    </div>`;

  Object.entries(byRound).forEach(([rodada, matches]) => {
    html += `
      <div style="margin-bottom:28px">
        <div style="font-size:.75rem;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--color-text-dim);margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid var(--color-border)">
          Rodada ${rodada}
        </div>
        <div style="display:flex;flex-direction:column;gap:8px">
          ${matches.map(p => renderInlineMatchRow(p, state)).join('')}
        </div>
      </div>`;
  });

  container.innerHTML = html;
}

/**
 * Renders a single match row with inline score inputs.
 * Concluded matches show existing scores pre-filled.
 */
function renderInlineMatchRow(p, state) {
  const tA = AppState.getTimeById(state, p.timeA);
  const tB = AppState.getTimeById(state, p.timeB);
  const nameA = tA ? tA.nome : 'Time A';
  const nameB = tB ? tB.nome : 'Time B';
  const concluded = p.status === 'concluida';
  const valA = concluded ? p.golsA : 0;
  const valB = concluded ? p.golsB : 0;

  // Score highlight for concluded matches
  let scoreColorA = '';
  let scoreColorB = '';
  if (concluded) {
    if (p.golsA > p.golsB) {
      scoreColorA = 'color:var(--color-win);';
      scoreColorB = 'color:var(--color-loss);';
    } else if (p.golsB > p.golsA) {
      scoreColorA = 'color:var(--color-loss);';
      scoreColorB = 'color:var(--color-win);';
    } else {
      scoreColorA = scoreColorB = 'color:#b8860b;';
    }
  }

  const statusDot = concluded
    ? `<span style="width:8px;height:8px;border-radius:50%;background:var(--color-win);flex-shrink:0;margin-right:4px" title="Concluída"></span>`
    : `<span style="width:8px;height:8px;border-radius:50%;background:var(--color-border);flex-shrink:0;margin-right:4px" title="Pendente"></span>`;

  return `
    <div style="background:var(--color-surface);border:1px solid ${concluded ? 'var(--color-border)' : 'var(--color-border)'};border-radius:var(--radius);padding:12px 16px;display:grid;grid-template-columns:1fr auto 1fr auto;align-items:center;gap:12px;transition:all var(--transition)"
      onmouseover="this.style.borderColor='var(--color-border-light)';this.style.boxShadow='0 2px 8px rgba(0,0,0,0.06)'"
      onmouseout="this.style.borderColor='${concluded ? 'var(--color-border)' : 'var(--color-border)'}';this.style.boxShadow=''">

      <!-- Time A (home) -->
      <div style="display:flex;align-items:center;gap:8px;justify-content:flex-end">
        <span style="font-weight:600;font-size:.9rem;color:var(--color-text)">${nameA}</span>
        ${UI.renderAvatar(tA, 24)}
      </div>

      <!-- Score inputs -->
      <div style="display:flex;align-items:center;gap:6px;flex-shrink:0">
        ${statusDot}
        <input type="number" id="inline_golsA_${p.id}" min="0" max="99" value="${valA}"
          style="width:52px;text-align:center;background:var(--color-surface-2);border:1px solid var(--color-border);border-radius:var(--radius);color:var(--color-text);padding:6px 4px;font-size:1.1rem;font-weight:800;font-family:var(--font-main);${scoreColorA}"
          onfocus="this.style.borderColor='var(--color-primary)';this.style.boxShadow='0 0 0 2px var(--color-primary-glow)'"
          onblur="this.style.borderColor='var(--color-border)';this.style.boxShadow=''">
        <span style="font-size:.8rem;font-weight:700;color:var(--color-text-dim)">x</span>
        <input type="number" id="inline_golsB_${p.id}" min="0" max="99" value="${valB}"
          style="width:52px;text-align:center;background:var(--color-surface-2);border:1px solid var(--color-border);border-radius:var(--radius);color:var(--color-text);padding:6px 4px;font-size:1.1rem;font-weight:800;font-family:var(--font-main);${scoreColorB}"
          onfocus="this.style.borderColor='var(--color-primary)';this.style.boxShadow='0 0 0 2px var(--color-primary-glow)'"
          onblur="this.style.borderColor='var(--color-border)';this.style.boxShadow=''">
      </div>

      <!-- Time B (away) -->
      <div style="display:flex;align-items:center;gap:8px;justify-content:flex-start">
        ${UI.renderAvatar(tB, 24)}
        <span style="font-weight:600;font-size:.9rem;color:var(--color-text)">${nameB}</span>
      </div>

      <!-- Save button -->
      <div>
        <button class="btn btn-sm ${concluded ? 'btn-secondary' : 'btn-success'}"
          onclick="saveInlineResult('${p.id}')"
          style="${concluded ? '' : 'background:var(--color-win);color:#fff;border:none;'}">
          ${concluded ? 'Editar' : 'Salvar'}
        </button>
      </div>
    </div>`;
}

// Keep populateMatchSelects for backward compat (used in index.html inline script)
function populateMatchSelects(state) {
  const select = document.getElementById('selectPartida');
  if (!select) return;
  const pendentes = state.faseGrupos.partidas.filter(p => p.status === 'pendente');
  select.innerHTML = '<option value="">-- Selecione uma partida --</option>';
  if (pendentes.length === 0) {
    const opt = document.createElement('option');
    opt.disabled = true;
    opt.textContent = 'Todas as partidas concluídas';
    select.appendChild(opt);
    return;
  }
  const byRound = {};
  pendentes.forEach(p => {
    if (!byRound[p.rodada]) byRound[p.rodada] = [];
    byRound[p.rodada].push(p);
  });
  Object.entries(byRound).forEach(([rodada, matches]) => {
    const group = document.createElement('optgroup');
    group.label = `Rodada ${rodada}`;
    matches.forEach(p => {
      const tA = AppState.getTimeById(state, p.timeA);
      const tB = AppState.getTimeById(state, p.timeB);
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = `${tA ? tA.nome : '?'} vs ${tB ? tB.nome : '?'}`;
      group.appendChild(opt);
    });
    select.appendChild(group);
  });
}

// Keep renderUnifiedGroupMatchForm stub for backward compat
function renderUnifiedGroupMatchForm(state) {
  return '';
}

function populatePlayoffResultsSection(state) {
  const container = document.getElementById('playoffResultsContainer');
  if (!container) return;

  if (state.campeonato.status !== 'playoffs' && state.campeonato.status !== 'encerrado') {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">&#127942;</div><div class="empty-title">Playoffs ainda não iniciados</div><div class="empty-desc">Conclua a fase de grupos para iniciar os playoffs.</div></div>`;
    return;
  }

  const ub = state.playoffs.upperBracket;
  const lb = state.playoffs.lowerBracket;
  const gf = state.playoffs.grandFinal;

  const playoffMatches = [
    { ...ub.sf1, tipo: 'upper', disponivel: !ub.sf1.vencedor && ub.sf1.timeA && ub.sf1.timeB },
    { ...ub.sf2, tipo: 'upper', disponivel: !ub.sf2.vencedor && ub.sf2.timeA && ub.sf2.timeB },
    { ...ub.final, tipo: 'upper', disponivel: !ub.final.vencedor && ub.final.timeA && ub.final.timeB },
    { ...lb.sf, tipo: 'lower', disponivel: !lb.sf.vencedor && lb.sf.timeA && lb.sf.timeB },
    { ...lb.final, tipo: 'lower', disponivel: !lb.final.vencedor && lb.final.timeA && lb.final.timeB }
  ];

  const pendentes = playoffMatches.filter(m => m.disponivel);
  const concluidas = playoffMatches.filter(m => m.vencedor);

  let html = '';

  if (gf.timeUpper && gf.timeLower && !gf.vencedor) {
    const tU = AppState.getTimeById(state, gf.timeUpper);
    const tL = AppState.getTimeById(state, gf.timeLower);
    const potes = AppState.loadPotes();
    const potesConfigurados = potes.superior.length > 0 || potes.inferior.length > 0;

    html += `
      <div class="card mb-24" style="border-color:rgba(249,168,37,0.4);border-left:3px solid var(--color-champion)">
        <div class="card-header">
          <span class="card-title">&#127942; Grande Final</span>
          <span class="bracket-label grand">Grande Final</span>
        </div>
        <div class="card-body">
          <div class="highlight-box" style="margin-bottom:16px">
            <span>&#9733;</span>
            <span><strong>Vantagem da Chave Superior:</strong> ${tU ? tU.nome : '?'} (chega sem derrota) escolhe seu time ${potesConfigurados ? 'do <strong>pote superior</strong>' : 'livremente'}. ${tL ? tL.nome : '?'} (Chave Inferior) escolhe ${potesConfigurados ? 'do <strong>pote inferior</strong>' : 'dentre os restantes'}.</span>
          </div>
          <div class="unified-match-form">
            <div class="unified-score-row">
              <div class="unified-team-side">
                ${UI.renderAvatar(tU, 36)}
                <div>
                  <span class="unified-team-name">${tU ? tU.nome : '?'}</span>
                  <span style="display:block;font-size:.7rem;background:var(--color-upper-bg);color:var(--color-upper);padding:2px 7px;border-radius:10px;font-weight:700;margin-top:2px;text-align:center">CHAVE SUPERIOR</span>
                </div>
              </div>
              <div class="unified-score-inputs">
                <input type="number" id="gfGolsUpper" min="0" max="99" value="0" class="score-input">
                <span class="vs-divider">x</span>
                <input type="number" id="gfGolsLower" min="0" max="99" value="0" class="score-input">
              </div>
              <div class="unified-team-side unified-team-side-right">
                <div>
                  <span class="unified-team-name">${tL ? tL.nome : '?'}</span>
                  <span style="display:block;font-size:.7rem;background:var(--color-lower-bg);color:var(--color-lower);padding:2px 7px;border-radius:10px;font-weight:700;margin-top:2px;text-align:center">CHAVE INFERIOR</span>
                </div>
                ${UI.renderAvatar(tL, 36)}
              </div>
            </div>
            <div class="unified-form-footer">
              <span style="font-size:.75rem;color:var(--color-text-dim)">Empates não permitidos. Use prorrogação ou pênaltis.</span>
              <button class="btn btn-success" onclick="saveGrandFinalResult()">Salvar Grande Final</button>
            </div>
          </div>
        </div>
      </div>`;
  }

  if (gf.vencedor) {
    const winner = AppState.getTimeById(state, gf.vencedor);
    html += `
      <div class="card mb-24" style="border-color:rgba(249,168,37,.4);background:var(--color-champion-bg)">
        <div class="card-body" style="text-align:center;padding:32px">
          <div style="font-size:2.5rem;margin-bottom:12px">&#127942;</div>
          <div style="font-size:1.5rem;font-weight:800;color:var(--color-champion)">${winner ? winner.nome : '?'}</div>
          <div style="color:var(--color-text-muted);margin-top:4px">Campe&atilde;o do ${state.campeonato.nome}</div>
          <div style="margin-top:12px;font-size:0.9rem;font-weight:700">${gf.golsUpper} x ${gf.golsLower} &mdash; Grande Final</div>
        </div>
      </div>`;
  }

  if (pendentes.length > 0) {
    html += `<div class="section-header"><h3 class="section-title" style="font-size:.95rem">Partidas Disponíveis para Registro</h3></div>`;
    html += pendentes.map(m => renderPlayoffMatchForm(m, state)).join('');
  }

  if (concluidas.length > 0) {
    html += `
      <div class="section-header mt-24"><h3 class="section-title" style="font-size:.95rem">Resultados Registrados</h3></div>
      <div class="matches-grid">
        ${concluidas.map(m => renderPlayoffMatchCard(m, state)).join('')}
      </div>`;
  }

  container.innerHTML = html || '<div class="empty-state"><div class="empty-icon">&#8987;</div><div class="empty-title">Aguardando propagação</div><div class="empty-desc">Os próximos jogos serão definidos após os resultados anteriores.</div></div>';
}

/**
 * Renders a unified playoff match input card, matching the layout of the grupos form.
 */
function renderPlayoffMatchForm(m, state) {
  const tA = AppState.getTimeById(state, m.timeA);
  const tB = AppState.getTimeById(state, m.timeB);
  const colorVar = m.tipo === 'upper' ? 'var(--color-upper)' : 'var(--color-lower)';
  const colorBg = m.tipo === 'upper' ? 'var(--color-upper-bg)' : 'var(--color-lower-bg)';
  const labelText = m.tipo === 'upper' ? 'Chave Superior' : 'Chave Inferior';
  const labelClass = m.tipo === 'upper' ? 'upper' : 'lower';

  return `
    <div class="card mb-16" style="border-left:3px solid ${colorVar}">
      <div class="card-header">
        <span class="card-title" style="font-size:.9rem">${m.fase}</span>
        <span class="bracket-label ${labelClass}">${labelText}</span>
      </div>
      <div class="card-body">
        <div class="unified-match-form">
          <div class="unified-score-row">
            <div class="unified-team-side">
              ${UI.renderAvatar(tA, 32)}
              <span class="unified-team-name">${tA ? tA.nome : '?'}</span>
            </div>
            <div class="unified-score-inputs">
              <input type="number" id="playoff_golsA_${m.id}" min="0" max="99" value="0" class="score-input">
              <span class="vs-divider">x</span>
              <input type="number" id="playoff_golsB_${m.id}" min="0" max="99" value="0" class="score-input">
            </div>
            <div class="unified-team-side unified-team-side-right">
              <span class="unified-team-name">${tB ? tB.nome : '?'}</span>
              ${UI.renderAvatar(tB, 32)}
            </div>
          </div>
          <div class="unified-form-footer">
            <span style="font-size:.75rem;color:var(--color-text-dim)">Empates não permitidos. Use prorrogação ou pênaltis.</span>
            <button class="btn btn-success" onclick="savePlayoffResult('${m.id}')">Salvar</button>
          </div>
        </div>
      </div>
    </div>`;
}

function renderPlayoffMatchCard(m, state) {
  const tA = AppState.getTimeById(state, m.timeA);
  const tB = AppState.getTimeById(state, m.timeB);
  const sc = UI.scoreClass(m.golsA, m.golsB);

  return `
    <div class="match-card">
      <div class="match-round-badge" style="font-size:.65rem">${m.fase}</div>
      <div class="match-teams">
        <div class="match-team home">
          <span class="team-name-text">${tA ? tA.nome : '?'}</span>
          ${UI.renderAvatar(tA, 24)}
        </div>
        <div class="match-score ${sc}">
          <span class="score-val">${m.golsA}</span>
          <span class="dash">:</span>
          <span class="score-val">${m.golsB}</span>
        </div>
        <div class="match-team away">
          ${UI.renderAvatar(tB, 24)}
          <span class="team-name-text">${tB ? tB.nome : '?'}</span>
        </div>
      </div>
      <span class="match-status-badge concluida">Conclu&#237;da</span>
    </div>`;
}

// ------------------------------------------------------------------
// BRACKET (Chaveamento)
// ------------------------------------------------------------------

function renderBracket() {
  const state = AppState.load();
  const container = document.getElementById('bracketContainer');
  if (!container) return;

  if (state.campeonato.status === 'configuracao' || state.campeonato.status === 'grupos') {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">&#127942;</div>
        <div class="empty-title">Playoffs ainda não iniciados</div>
        <div class="empty-desc">Conclua a fase de grupos com pelo menos 4 times classificados.</div>
        ${state.campeonato.status === 'grupos' && canStartPlayoffs(state) ? `<button class="btn btn-primary mt-16" onclick="iniciarPlayoffs()">Iniciar Playoffs</button>` : ''}
      </div>`;
    return;
  }

  const ub = state.playoffs.upperBracket;
  const lb = state.playoffs.lowerBracket;
  const gf = state.playoffs.grandFinal;

  container.innerHTML = `
    <div class="bracket-container">
      <!-- CHAVE SUPERIOR -->
      <div style="margin-bottom:8px">
        <span class="bracket-label upper">&#9733; Chave Superior &mdash; sem derrota</span>
      </div>
      <div style="display:grid;grid-template-columns:1fr 48px 1fr 48px 1fr;gap:0;align-items:center;min-width:800px;margin-bottom:32px">
        <!-- Semifinais -->
        <div style="display:flex;flex-direction:column;gap:16px">
          <div style="font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--color-text-dim);text-align:center;padding-bottom:8px;border-bottom:1px solid var(--color-border)">Semifinal</div>
          ${renderBracketMatch(ub.sf1, state, 'upper')}
          ${renderBracketMatch(ub.sf2, state, 'upper')}
        </div>
        <div class="bracket-connector" style="display:flex;flex-direction:column;align-items:center;gap:32px;padding-top:40px">
          <div style="width:2px;height:64px;background:var(--color-border)"></div>
        </div>
        <!-- Final Superior -->
        <div style="display:flex;flex-direction:column;justify-content:center">
          <div style="font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--color-text-dim);text-align:center;padding-bottom:8px;border-bottom:1px solid var(--color-border);margin-bottom:48px">Final Superior</div>
          ${renderBracketMatch(ub.final, state, 'upper')}
        </div>
        <div class="bracket-connector" style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding-top:40px">
          <div style="width:2px;height:48px;background:var(--color-border)"></div>
        </div>
        <!-- Grande Final placeholder -->
        <div style="display:flex;flex-direction:column;justify-content:center">
          <div style="font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--color-champion);text-align:center;padding-bottom:8px;border-bottom:1px solid rgba(249,168,37,.3);margin-bottom:48px">Grande Final</div>
          ${renderGrandFinalBracket(gf, state)}
        </div>
      </div>

      <hr class="bracket-divider">

      <!-- CHAVE INFERIOR -->
      <div style="margin-bottom:8px">
        <span class="bracket-label lower">&#8595; Chave Inferior &mdash; segunda chance</span>
      </div>
      <div style="display:grid;grid-template-columns:1fr 48px 1fr;gap:0;align-items:center;min-width:500px;max-width:700px;margin-bottom:16px">
        <!-- Semifinal Inferior -->
        <div>
          <div style="font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--color-text-dim);text-align:center;padding-bottom:8px;border-bottom:1px solid var(--color-border);margin-bottom:12px">Semifinal Inferior</div>
          ${renderBracketMatch(lb.sf, state, 'lower')}
        </div>
        <div class="bracket-connector" style="display:flex;align-items:center;justify-content:center;padding-top:24px">
          <div style="width:2px;height:44px;background:var(--color-border)"></div>
        </div>
        <!-- Final Inferior -->
        <div>
          <div style="font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--color-text-dim);text-align:center;padding-bottom:8px;border-bottom:1px solid var(--color-border);margin-bottom:12px">Final Inferior</div>
          ${renderBracketMatch(lb.final, state, 'lower')}
        </div>
      </div>

      <div class="bracket-advantage-note">
        <span>&#9733;</span>
        <span><strong>Vantagem na Grande Final:</strong> O time que chegou pela Chave Superior (sem derrota) tem direito de escolher com qual time/configura&ccedil;&atilde;o deseja jogar.</span>
      </div>
    </div>`;
}

function renderBracketMatch(m, state, tipo) {
  const tA = m.timeA ? AppState.getTimeById(state, m.timeA) : null;
  const tB = m.timeB ? AppState.getTimeById(state, m.timeB) : null;

  return `
    <div class="bracket-match ${tipo}-match" style="margin-bottom:8px">
      ${renderBracketSlot(tA, m.golsA, m.vencedor === m.timeA)}
      ${renderBracketSlot(tB, m.golsB, m.vencedor === m.timeB)}
    </div>`;
}

function renderBracketSlot(time, gols, isWinner) {
  if (!time) {
    return `<div class="bracket-slot tbd"><span>A definir</span></div>`;
  }
  return `
    <div class="bracket-slot ${isWinner ? 'winner' : ''}">
      ${UI.renderAvatar(time, 22, 'bracket-slot-avatar')}
      <span class="bracket-slot-name">${time.nome}</span>
      <span class="bracket-slot-score">${gols !== null ? gols : ''}</span>
    </div>`;
}

function renderGrandFinalBracket(gf, state) {
  const tU = gf.timeUpper ? AppState.getTimeById(state, gf.timeUpper) : null;
  const tL = gf.timeLower ? AppState.getTimeById(state, gf.timeLower) : null;

  return `
    <div class="bracket-match grand-match">
      <div class="bracket-slot ${gf.vencedor === gf.timeUpper ? 'winner' : ''}">
        ${tU ? UI.renderAvatar(tU, 22, 'bracket-slot-avatar') : ''}
        <span class="bracket-slot-name ${!tU ? 'tbd' : ''}">${tU ? tU.nome : 'A definir'}</span>
        ${tU ? `<span style="font-size:.6rem;background:var(--color-upper-bg);color:var(--color-upper);padding:1px 5px;border-radius:8px;font-weight:700;margin-right:4px">CS</span>` : ''}
        <span class="bracket-slot-score">${gf.golsUpper !== null ? gf.golsUpper : ''}</span>
      </div>
      <div class="bracket-slot ${gf.vencedor === gf.timeLower ? 'winner' : ''}">
        ${tL ? UI.renderAvatar(tL, 22, 'bracket-slot-avatar') : ''}
        <span class="bracket-slot-name ${!tL ? 'tbd' : ''}">${tL ? tL.nome : 'A definir'}</span>
        ${tL ? `<span style="font-size:.6rem;background:var(--color-lower-bg);color:var(--color-lower);padding:1px 5px;border-radius:8px;font-weight:700;margin-right:4px">CI</span>` : ''}
        <span class="bracket-slot-score">${gf.golsLower !== null ? gf.golsLower : ''}</span>
      </div>
    </div>`;
}

// ------------------------------------------------------------------
// STATS
// ------------------------------------------------------------------

function renderEstatisticas() {
  const state = AppState.load();
  const stats = AppState.calcularEstatisticas(state);

  // Overview cards
  const els = {
    totalPartidas: document.getElementById('statTotalPartidas'),
    totalGols: document.getElementById('statTotalGols'),
    mediaGols: document.getElementById('statMediaGols'),
    totalTimes: document.getElementById('statTotalTimes')
  };
  if (els.totalPartidas) els.totalPartidas.textContent = stats.totalPartidas;
  if (els.totalGols) els.totalGols.textContent = stats.totalGols;
  if (els.mediaGols) els.mediaGols.textContent = stats.mediaGols;
  if (els.totalTimes) els.totalTimes.textContent = state.times.length;

  // Top scorers (by team)
  const topGolsEl = document.getElementById('statTopGols');
  if (topGolsEl) {
    if (stats.topGoleadores.length === 0) {
      topGolsEl.innerHTML = '<div class="empty-state" style="padding:24px"><div class="empty-title">Sem dados ainda</div></div>';
    } else {
      topGolsEl.innerHTML = stats.topGoleadores.map((t, i) => `
        <div class="top-list-item">
          <span class="top-rank ${i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : ''}">${i + 1}&deg;</span>
          ${UI.renderAvatar(t, 28)}
          <div class="flex-1">
            <div class="top-list-name">${t.nome}</div>
            <div class="top-list-sub">${t.jogos} jogos</div>
          </div>
          <div>
            <div class="top-list-value">${t.golsMarcados}</div>
            <div class="top-list-sub">gols</div>
          </div>
        </div>`).join('');
    }
  }

  // Best defense
  const topDefEl = document.getElementById('statTopDef');
  if (topDefEl) {
    if (stats.menosVazados.length === 0) {
      topDefEl.innerHTML = '<div class="empty-state" style="padding:24px"><div class="empty-title">Sem dados ainda</div></div>';
    } else {
      topDefEl.innerHTML = stats.menosVazados.map((t, i) => `
        <div class="top-list-item">
          <span class="top-rank ${i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : ''}">${i + 1}&deg;</span>
          ${UI.renderAvatar(t, 28)}
          <div class="flex-1">
            <div class="top-list-name">${t.nome}</div>
            <div class="top-list-sub">${t.jogos} jogos</div>
          </div>
          <div>
            <div class="top-list-value" style="color:var(--color-win)">${t.golsSofridos}</div>
            <div class="top-list-sub">sofridos</div>
          </div>
        </div>`).join('');
    }
  }

  // Biggest win
  const goleadaEl = document.getElementById('statGoleada');
  if (goleadaEl) {
    if (!stats.maiorGoleada.partida) {
      goleadaEl.innerHTML = '<div class="text-dim text-sm" style="padding:16px 0">Sem partidas concluídas</div>';
    } else {
      const p = stats.maiorGoleada.partida;
      const tA = AppState.getTimeById(state, p.timeA);
      const tB = AppState.getTimeById(state, p.timeB);
      goleadaEl.innerHTML = `
        <div class="match-card">
          <div class="match-round-badge">Rod. ${p.rodada}</div>
          <div class="match-teams">
            <div class="match-team home">${tA ? tA.nome : '?'}${UI.renderAvatar(tA, 24)}</div>
            <div class="match-score ${UI.scoreClass(p.golsA, p.golsB)}">
              <span class="score-val">${p.golsA}</span>
              <span class="dash">:</span>
              <span class="score-val">${p.golsB}</span>
            </div>
            <div class="match-team away">${UI.renderAvatar(tB, 24)}${tB ? tB.nome : '?'}</div>
          </div>
        </div>`;
    }
  }
}

// ------------------------------------------------------------------
// RULES (Regras) — includes potes configuration
// ------------------------------------------------------------------

function renderRegras() {
  const state = AppState.load();
  const potes = AppState.loadPotes();
  renderPotesConfig(state, potes);
}

function renderPotesConfig(state, potes) {
  const container = document.getElementById('potesConfigContainer');
  if (!container) return;

  if (state.times.length === 0) {
    container.innerHTML = '<div class="text-dim text-sm" style="padding:8px 0">Nenhum time cadastrado ainda. Adicione os times primeiro.</div>';
    return;
  }

  const rows = state.times.map(t => {
    const isSup = potes.superior.includes(t.id);
    const isInf = potes.inferior.includes(t.id);
    return `
      <div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--color-border)">
        ${UI.renderAvatar(t, 28)}
        <span style="flex:1;font-weight:600;font-size:.9rem">${t.nome}</span>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:.8rem;color:var(--color-upper)">
          <input type="radio" name="pote_${t.id}" id="pote_sup_${t.id}" value="superior" ${isSup ? 'checked' : ''}>
          Pote Superior
        </label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:.8rem;color:var(--color-lower)">
          <input type="radio" name="pote_${t.id}" id="pote_inf_${t.id}" value="inferior" ${isInf ? 'checked' : ''}>
          Pote Inferior
        </label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:.8rem;color:var(--color-text-dim)">
          <input type="radio" name="pote_${t.id}" id="pote_none_${t.id}" value="none" ${!isSup && !isInf ? 'checked' : ''}>
          Nenhum
        </label>
      </div>`;
  }).join('');

  container.innerHTML = rows + `
    <div style="margin-top:16px">
      <button class="btn btn-primary" onclick="savePotesConfig()">Salvar Configuração de Potes</button>
    </div>`;
}

// ------------------------------------------------------------------
// AUDIT LOG (Histórico)
// ------------------------------------------------------------------

function renderHistorico() {
  const logs = AppState.loadAuditLog();
  const container = document.getElementById('historicoContainer');
  if (!container) return;

  if (logs.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">&#128203;</div>
        <div class="empty-title">Nenhuma alteração registrada</div>
        <div class="empty-desc">As ações realizadas no campeonato aparecerão aqui com data, hora e responsável.</div>
      </div>`;
    return;
  }

  // Show newest first
  const sorted = [...logs].reverse();

  container.innerHTML = `
    <div class="audit-log">
      ${sorted.map(entry => {
        const dt = new Date(entry.timestamp);
        const dateStr = dt.toLocaleDateString('pt-BR');
        const timeStr = dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        return `
          <div class="audit-entry">
            <div class="audit-meta">
              <span class="audit-user">${entry.usuario}</span>
              <span class="audit-datetime">${dateStr} às ${timeStr}</span>
            </div>
            <div class="audit-action">${entry.acao}</div>
            ${entry.detalhes ? `<div class="audit-details">${Object.entries(entry.detalhes).map(([k, v]) => `<span>${k}: <strong>${v}</strong></span>`).join(' &bull; ')}</div>` : ''}
          </div>`;
      }).join('')}
    </div>`;
}

// ------------------------------------------------------------------
// Export
// ------------------------------------------------------------------

window.Renderers = {
  home: renderHome,
  times: renderTimes,
  classificacao: renderClassificacao,
  partidas: renderPartidas,
  registrar: renderRegistrar,
  bracket: renderBracket,
  estatisticas: renderEstatisticas,
  regras: renderRegras,
  historico: renderHistorico
};

// Helpers used by actions
function canStartPlayoffs(state) {
  const tabela = AppState.calcularClassificacao(state);
  const pending = state.faseGrupos.partidas.filter(p => p.status === 'pendente').length;
  return tabela.length >= 4 && pending === 0;
}
