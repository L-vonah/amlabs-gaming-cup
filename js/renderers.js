/**
 * Renderers — Teams, Classification, Stats, Rules, History, Registration
 * Also exports the unified Renderers object
 */

// ------------------------------------------------------------------
// TEAMS
// ------------------------------------------------------------------

function renderTimes() {
  const state = AppState.loadReadOnly();
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
        <div class="team-card-name">${UI.escapeHtml(t.nome)}</div>
        <div class="team-card-abbr">${UI.escapeHtml(t.participante || '')}</div>
      </div>
      <div class="team-card-actions admin-only">
        <button class="btn-icon" onclick="openEditTeamModal('${t.id}')" title="Editar time">&#9998;</button>
        <button class="btn-icon" onclick="deleteTime('${t.id}')" title="Remover time">&#x2715;</button>
      </div>
    </div>`).join('');

  // Update generate button state
  const genBtn = document.getElementById('btnGerarGrupos');
  if (genBtn) {
    genBtn.disabled = state.times.length < 5 || state.campeonato.status !== 'configuracao';
    genBtn.title = state.times.length < 5 ? 'Minimo de 5 times para iniciar' : '';
  }

  if (typeof updateAdminUI === 'function') updateAdminUI();
}

// ------------------------------------------------------------------
// CLASSIFICATION TABLE
// ------------------------------------------------------------------

function renderClassificacao() {
  const state = AppState.loadReadOnly();
  const tabela = AppState.calcularClassificacao(state);
  const container = document.getElementById('tabelaClassificacao');
  if (!container) return;

  // Get classification tiers from selected format
  const formatId = typeof getSelectedPlayoffFormatId === 'function' ? getSelectedPlayoffFormatId() : (state.playoffs.formato || PlayoffFormats.DEFAULT);
  const format = PlayoffFormats.get(formatId);
  const tiers = format.classificationTiers;
  const qualify = format.classified;

  function getTierForPosition(pos) {
    return tiers.find(t => pos >= t.from && pos <= t.to) || null;
  }

  if (tabela.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">&#128202;</div>
        <div class="empty-title">Tabela vazia</div>
        <div class="empty-desc">Cadastre times e inicie a fase de grupos para ver a classificação.</div>
      </div>`;
    return;
  }

  const gt = getGameType(state.campeonato.gameType);
  const cols = gt.columns;

  container.innerHTML = `
    <div class="classification-table-wrapper">
      <table class="classification-table">
        <thead>
          <tr>
            <th colspan="2">Time</th>
            <th class="text-center">J</th>
            <th class="text-center">V</th>
            ${cols.empates ? '<th class="text-center">E</th>' : ''}
            <th class="text-center">D</th>
            ${cols.scoreMarcados ? '<th class="text-center">' + cols.scoreMarcados.label + '</th>' : ''}
            ${cols.scoreSofridos ? '<th class="text-center">' + cols.scoreSofridos.label + '</th>' : ''}
            ${cols.saldo ? '<th class="text-center">' + cols.saldo.label + '</th>' : ''}
            <th class="text-center">Pts</th>
            <th>Forma</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${tabela.map((t, i) => {
            const pos = i + 1;
            const tier = getTierForPosition(pos);
            const tierClass = tier ? tier.cssClass : '';
            const sgClass = t.saldoScore > 0 ? 'stat-positive' : t.saldoScore < 0 ? 'stat-negative' : 'stat-neutral';
            return `
              <tr class="${tierClass}">
                <td>
                  <div class="pos-cell">
                    <span class="pos-number ${tier ? 'top' : ''}" ${tier ? 'style="color:' + tier.color + '"' : ''}>${pos}</span>
                  </div>
                </td>
                <td>
                  <div class="team-name-cell">
                    ${UI.renderAvatar(t, 28)}
                    <div>
                      <div class="team-name-text">${UI.escapeHtml(t.nome)}</div>
                      ${t.participante ? '<div class="team-participant-sub">' + UI.escapeHtml(t.participante) + '</div>' : ''}
                    </div>
                  </div>
                </td>
                <td class="text-center text-muted">${t.jogos}</td>
                <td class="text-center stat-positive" style="font-weight:700">${t.vitorias}</td>
                ${cols.empates ? '<td class="text-center stat-neutral">' + t.empates + '</td>' : ''}
                <td class="text-center stat-negative">${t.derrotas}</td>
                ${cols.scoreMarcados ? '<td class="text-center">' + t.scoreMarcados + '</td>' : ''}
                ${cols.scoreSofridos ? '<td class="text-center">' + t.scoreSofridos + '</td>' : ''}
                ${cols.saldo ? '<td class="text-center ' + sgClass + '" style="font-weight:700">' + UI.signedNumber(t.saldoScore) + '</td>' : ''}
                <td class="text-center"><span class="stat-pts">${t.pontos}</span></td>
                <td>
                  <div class="form-badges">
                    ${t.forma.map(f => `<span class="form-badge ${f}">${f}</span>`).join('')}
                  </div>
                </td>
                <td>${tier ? '<span class="qualified-label" style="color:' + tier.color + ';border-color:' + tier.color + '">' + UI.escapeHtml(tier.label) + '</span>' : ''}</td>
              </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
    <div class="classification-tier-legend">
      ${tiers.map(tier => `<div class="tier-legend-item"><span class="tier-legend-dot" style="background:${tier.color}"></span>${UI.escapeHtml(tier.label)} (${tier.from === tier.to ? tier.from + '&ordm;' : tier.from + '&ordm;-' + tier.to + '&ordm;'})</div>`).join('')}
      <span>&bull; Desempate: ${gt.tiebreakerLabels.join(' &rarr; ')}</span>
    </div>`;
}

// ------------------------------------------------------------------
// STATS
// ------------------------------------------------------------------

function renderEstatisticas() {
  const state = AppState.loadReadOnly();
  const gt = getGameType(state.campeonato.gameType);

  // Hide statistics entirely for game types that don't have them
  if (!gt.hasStatistics) {
    ['statTotalPartidas','statTotalGols','statMediaGols','statTotalTimes','statTopGols','statTopDef','statGoleada','statMaisGols'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        const card = el.closest('.card');
        if (card) card.style.display = 'none';
      }
    });
    return;
  }

  const stats = AppState.calcularEstatisticas(state);

  // Overview cards
  const els = {
    totalPartidas: document.getElementById('statTotalPartidas'),
    totalGols: document.getElementById('statTotalGols'),
    mediaGols: document.getElementById('statMediaGols'),
    totalTimes: document.getElementById('statTotalTimes')
  };
  if (els.totalPartidas) els.totalPartidas.textContent = stats.totalPartidas;
  if (els.totalGols) els.totalGols.textContent = stats.totalScore;
  if (els.mediaGols) els.mediaGols.textContent = stats.mediaScore;
  if (els.totalTimes) els.totalTimes.textContent = state.times.length;

  // Top scorers (by team)
  const topGolsEl = document.getElementById('statTopGols');
  if (topGolsEl) {
    if (stats.topScorers.length === 0) {
      topGolsEl.innerHTML = '<div class="empty-state" style="padding:24px"><div class="empty-title">Sem dados ainda</div></div>';
    } else {
      topGolsEl.innerHTML = stats.topScorers.map((t, i) => `
        <div class="stat-rank-item">
          <span class="stat-rank-pos ${i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : ''}">${i + 1}</span>
          ${UI.renderAvatar(t, 36)}
          <div class="stat-rank-info">
            <div class="stat-rank-name">${UI.escapeHtml(t.nome)}</div>
            ${t.participante ? '<div class="stat-rank-participant">' + UI.escapeHtml(t.participante) + '</div>' : ''}
          </div>
          <div class="stat-rank-numbers">
            <span class="stat-rank-value" style="color:var(--color-primary)">${t.scoreMarcados}</span>
            <span class="stat-rank-label">${t.jogos}J</span>
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
        <div class="stat-rank-item">
          <span class="stat-rank-pos ${i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : ''}">${i + 1}</span>
          ${UI.renderAvatar(t, 36)}
          <div class="stat-rank-info">
            <div class="stat-rank-name">${UI.escapeHtml(t.nome)}</div>
            ${t.participante ? '<div class="stat-rank-participant">' + UI.escapeHtml(t.participante) + '</div>' : ''}
          </div>
          <div class="stat-rank-numbers">
            <span class="stat-rank-value" style="color:var(--color-win)">${t.scoreSofridos}</span>
            <span class="stat-rank-label">${t.jogos}J</span>
          </div>
        </div>`).join('');
    }
  }

  // Biggest win
  const goleadaEl = document.getElementById('statGoleada');
  if (goleadaEl) {
    if (!stats.maiorVitoria.partida) {
      goleadaEl.innerHTML = '<div class="text-dim text-sm" style="padding:16px 0">Sem partidas concluídas</div>';
    } else {
      const p = stats.maiorVitoria.partida;
      const tA = AppState.getTimeById(state, p.timeA);
      const tB = AppState.getTimeById(state, p.timeB);
      const pWinA = p.penaltyWinner === p.timeA;
      const pWinB = p.penaltyWinner === p.timeB;
      goleadaEl.innerHTML = `
        <div class="stat-match-row">
          ${UI.renderAvatar(tA, 28)}
          <span class="stat-match-name ${(p.scoreA || 0) > (p.scoreB || 0) || pWinA ? 'winner' : ''}">${tA ? UI.escapeHtml(tA.nome) : '?'}</span>
          <span class="stat-match-score">${pWinA ? '<span class="penalty-tag">P</span>' : ''}${p.scoreA}</span>
          <span class="bracket-mini-separator">:</span>
          <span class="stat-match-score">${p.scoreB}${pWinB ? '<span class="penalty-tag">P</span>' : ''}</span>
          <span class="stat-match-name ${(p.scoreB || 0) > (p.scoreA || 0) || pWinB ? 'winner' : ''}" style="text-align:right">${tB ? UI.escapeHtml(tB.nome) : '?'}</span>
          ${UI.renderAvatar(tB, 28)}
        </div>
        <div class="stat-match-note">Diferen&ccedil;a de ${Math.abs((p.scoreA || 0) - (p.scoreB || 0))} gol${Math.abs((p.scoreA || 0) - (p.scoreB || 0)) !== 1 ? 's' : ''}</div>`;
    }
  }

  // Match with most goals
  const maisGolsEl = document.getElementById('statMaisGols');
  if (maisGolsEl) {
    if (!stats.partidaMaisScore || !stats.partidaMaisScore.partida) {
      maisGolsEl.innerHTML = '<div class="text-dim text-sm" style="padding:16px 0">Sem partidas conclu&iacute;das</div>';
    } else {
      const p = stats.partidaMaisScore.partida;
      const tA = AppState.getTimeById(state, p.timeA);
      const tB = AppState.getTimeById(state, p.timeB);
      const mgPA = p.penaltyWinner === p.timeA;
      const mgPB = p.penaltyWinner === p.timeB;
      maisGolsEl.innerHTML = `
        <div class="stat-match-row">
          ${UI.renderAvatar(tA, 28)}
          <span class="stat-match-name ${(p.scoreA || 0) > (p.scoreB || 0) || mgPA ? 'winner' : ''}">${tA ? UI.escapeHtml(tA.nome) : '?'}</span>
          <span class="stat-match-score">${mgPA ? '<span class="penalty-tag">P</span>' : ''}${p.scoreA}</span>
          <span class="bracket-mini-separator">:</span>
          <span class="stat-match-score">${p.scoreB}${mgPB ? '<span class="penalty-tag">P</span>' : ''}</span>
          <span class="stat-match-name ${(p.scoreB || 0) > (p.scoreA || 0) || mgPB ? 'winner' : ''}" style="text-align:right">${tB ? UI.escapeHtml(tB.nome) : '?'}</span>
          ${UI.renderAvatar(tB, 28)}
        </div>
        <div class="stat-match-note">${stats.partidaMaisScore.total} gols na partida</div>`;
    }
  }
}

// ------------------------------------------------------------------
// RULES (Regras)
// ------------------------------------------------------------------

function renderRegras() {
  const container = document.getElementById('rulesGridContainer');
  if (!container) return;

  const state = AppState.loadReadOnly();
  const gt = getGameType(state.campeonato.gameType);
  const scoring = gt.scoring;

  let html = '';

  // Fase de Grupos — universal but scoring adapted
  const scoringDesc = gt.drawAllowed
    ? 'Vit\u00f3ria vale <strong>' + scoring.vitoria + ' pontos</strong>, empate vale <strong>' + scoring.empate + ' ponto</strong> para cada time, derrota vale <strong>' + scoring.derrota + ' pontos</strong>.'
    : 'Vit\u00f3ria vale <strong>' + scoring.vitoria + ' pontos</strong>, derrota vale <strong>' + scoring.derrota + ' ponto(s)</strong>. N\u00e3o h\u00e1 empate.';

  html += `<div class="rule-card">
    <div class="rule-card-header">
      <div class="rule-icon icon-bg-blue" style="width:40px;height:40px;border-radius:var(--radius)">&#9917;</div>
      <h3 class="rule-card-title">Fase de Grupos</h3>
    </div>
    <ul class="rule-list">
      <li>Todos os times participam em um \u00fanico grupo, jogando em sistema todos contra todos (round-robin).</li>
      <li>Turno \u00fanico: cada par de times se enfrenta uma vez.</li>
      <li>${scoringDesc}</li>
      <li>Os melhores colocados se classificam para os Playoffs (quantidade depende do formato escolhido).</li>
    </ul>
  </div>`;

  // Criterios de desempate — adapted per game type
  html += `<div class="rule-card">
    <div class="rule-card-header">
      <div class="rule-icon icon-bg-yellow" style="width:40px;height:40px;border-radius:var(--radius)">&#9878;</div>
      <h3 class="rule-card-title">Crit\u00e9rios de Desempate</h3>
    </div>
    <ul class="rule-list">
      ${gt.tiebreakerLabels.map((label, i) => '<li>' + (i + 1) + '\u00ba crit\u00e9rio: <strong>' + UI.escapeHtml(label) + '</strong></li>').join('')}
    </ul>
  </div>`;

  // Formato dos Playoffs — universal
  const playoffTieDesc = gt.penaltyResolution
    ? '<strong>Empates n\u00e3o s\u00e3o permitidos</strong>. Em caso de empate, utiliza-se prorroga\u00e7\u00e3o e/ou p\u00eanaltis.'
    : 'Cada partida tem um vencedor. N\u00e3o h\u00e1 empate nos playoffs.';

  html += `<div class="rule-card">
    <div class="rule-card-header">
      <div class="rule-icon icon-bg-green" style="width:40px;height:40px;border-radius:var(--radius)">&#128204;</div>
      <h3 class="rule-card-title">Formato dos Playoffs</h3>
    </div>
    <ul class="rule-list">
      <li>Todos os jogos dos playoffs s\u00e3o decididos em jogo \u00fanico.</li>
      <li>${playoffTieDesc}</li>
      <li>O formato e as regras das chaves est\u00e3o detalhados na <strong>tela de Chaveamento</strong>.</li>
    </ul>
  </div>`;

  // Game-specific rules
  if (gt.id === 'futebol-virtual') {
    // Grande Final & Vantagem
    html += `<div class="rule-card">
      <div class="rule-card-header">
        <div class="rule-icon icon-bg-yellow" style="width:40px;height:40px;border-radius:var(--radius)">&#127942;</div>
        <h3 class="rule-card-title">Grande Final &amp; Vantagem</h3>
      </div>
      <ul class="rule-list">
        <li>Disputa entre o vencedor da <strong>Chave Superior</strong> e o vencedor da <strong>Chave Inferior</strong>.</li>
        <li>Jogo \u00fanico, sem empate (prorroga\u00e7\u00e3o/p\u00eanaltis se necess\u00e1rio).</li>
        <li>O jogador da <strong>Chave Superior</strong> (sem derrota) escolhe qual vantagem de ban aplicar.</li>
      </ul>
      <div class="highlight-box" style="margin-top:12px">
        <span>&#9733;</span>
        <span><strong>Exemplos de vantagem:</strong> advers\u00e1rio s\u00f3 pode usar times de 4&#9733; ou menos, ban de 3 jogadores do time advers\u00e1rio, entre outras op\u00e7\u00f5es customiz\u00e1veis.</span>
      </div>
      <div class="highlight-box" style="margin-top:8px">
        <span>!</span>
        <span>Esta regra pode ser alterada durante o campeonato, mediante <strong>consenso dos participantes</strong>.</span>
      </div>
    </div>`;

    // Configuracao de Jogo
    html += `<div class="rule-card">
      <div class="rule-card-header">
        <div class="rule-icon icon-bg-purple" style="width:40px;height:40px;border-radius:var(--radius)">&#127918;</div>
        <h3 class="rule-card-title">Configura\u00e7\u00e3o de Jogo</h3>
      </div>
      <ul class="rule-list">
        <li>Dura\u00e7\u00e3o: <strong>6 minutos por tempo</strong>.</li>
        <li>Sele\u00e7\u00e3o de times: <strong>livre em todas as fases</strong>. Cada jogador pode escolher qualquer time a cada partida, inclusive repetir.</li>
      </ul>
    </div>`;

    // Problema Tecnico
    html += `<div class="rule-card">
      <div class="rule-card-header">
        <div class="rule-icon icon-bg-orange" style="width:40px;height:40px;border-radius:var(--radius)">&#9888;</div>
        <h3 class="rule-card-title">Problema T\u00e9cnico / Desconex\u00e3o</h3>
      </div>
      <ul class="rule-list">
        <li><strong>1\u00ba tempo + diferen\u00e7a menor que 3 gols:</strong> partida recome\u00e7a do zero.</li>
        <li><strong>1\u00ba tempo + diferen\u00e7a de 3 gols ou mais:</strong> vale o placar parcial, jogo encerrado.</li>
        <li><strong>2\u00ba tempo:</strong> vale o placar parcial, jogo encerrado.</li>
        <li><strong>Desconex\u00e3o intencional:</strong> derrota por WO (3\u00d70).</li>
      </ul>
    </div>`;

    // Desistencia
    html += `<div class="rule-card">
      <div class="rule-card-header">
        <div class="rule-icon icon-bg-orange" style="width:40px;height:40px;border-radius:var(--radius)">&#128683;</div>
        <h3 class="rule-card-title">Desist\u00eancia</h3>
      </div>
      <ul class="rule-list">
        <li>Partidas <strong>j\u00e1 jogadas</strong>: se o advers\u00e1rio venceu com placar melhor que 3\u00d70, mant\u00e9m. Caso contr\u00e1rio, o resultado \u00e9 alterado para <strong>3\u00d70</strong> a favor do advers\u00e1rio.</li>
        <li>Partidas <strong>pendentes</strong>: WO de 3\u00d70 para o advers\u00e1rio.</li>
      </ul>
    </div>`;
  } else if (gt.id === 'sinuca') {
    // Regras de Jogo — Sinuca
    html += `<div class="rule-card">
      <div class="rule-card-header">
        <div class="rule-icon icon-bg-purple" style="width:40px;height:40px;border-radius:var(--radius)">&#127921;</div>
        <h3 class="rule-card-title">Regras de Jogo</h3>
      </div>
      <ul class="rule-list">
        <li>Cada dupla deve jogar contra todas as outras duplas (todos contra todos).</li>
        <li>A cada jogo realizado a dupla ganha <strong>1 ponto</strong>. Em caso de vit\u00f3ria, ganha <strong>mais 1 ponto</strong> (total 2).</li>
        <li>Modalidade: <strong>bola 1</strong> \u2014 cada time \u00e9 par ou \u00edmpar, devendo matar a bola 1 por \u00faltimo para vencer.</li>
        <li>N\u00e3o h\u00e1 placar num\u00e9rico \u2014 apenas vit\u00f3ria ou derrota.</li>
      </ul>
    </div>`;

    // Bola Branca e Mesa
    html += `<div class="rule-card">
      <div class="rule-card-header">
        <div class="rule-icon icon-bg-blue" style="width:40px;height:40px;border-radius:var(--radius)">&#9898;</div>
        <h3 class="rule-card-title">Bola Branca e Mesa</h3>
      </div>
      <ul class="rule-list">
        <li>A bola branca sempre come\u00e7a no <strong>centro da marca desenhada na mesa</strong> e retorna para l\u00e1 caso seja morta ou derrubada.</li>
        <li>Se a bola branca cair fora da mesa, o time que a derrubou \u00e9 penalizado como se tivesse matado a bola branca.</li>
        <li>Se uma bola (exceto a branca) cair fora da mesa, <strong>n\u00e3o h\u00e1 penalidade</strong>. A bola deve ser colocada de volta na mesa, encostada na tabela do lado oposto \u00e0 onde a bola 1 iniciou.</li>
      </ul>
    </div>`;

    // Regra da Última Chance
    html += `<div class="rule-card">
      <div class="rule-card-header">
        <div class="rule-icon icon-bg-yellow" style="width:40px;height:40px;border-radius:var(--radius)">&#9888;</div>
        <h3 class="rule-card-title">\u00daltima Chance</h3>
      </div>
      <ul class="rule-list">
        <li>Se um time est\u00e1 prestes a vencer e acidentalmente mata a bola 1 cometendo uma <strong>falta</strong> (ex: matar a bola branca, matar bola do advers\u00e1rio), o time advers\u00e1rio ganha uma <strong>\u00faltima chance</strong>.</li>
        <li>Se o advers\u00e1rio conseguir matar todas as bolas restantes na mesa, ele vence.</li>
        <li>O time que cometeu a falta ainda \u00e9 penalizado normalmente pela falta cometida.</li>
      </ul>
    </div>`;

    // Partidas Pendentes
    html += `<div class="rule-card">
      <div class="rule-card-header">
        <div class="rule-icon icon-bg-green" style="width:40px;height:40px;border-radius:var(--radius)">&#128197;</div>
        <h3 class="rule-card-title">Partidas Pendentes</h3>
      </div>
      <ul class="rule-list">
        <li>Partidas n\u00e3o realizadas dentro do prazo s\u00e3o <strong>ignoradas</strong> \u2014 ningu\u00e9m ganha ponto.</li>
        <li>Os playoffs podem ser iniciados mesmo com jogos pendentes.</li>
        <li>As rodadas finais ser\u00e3o realizadas durante a <strong>confraterniza\u00e7\u00e3o anual da empresa</strong>.</li>
      </ul>
    </div>`;
  }

  // Prazo e Organizacao — universal
  html += `<div class="rule-card">
    <div class="rule-card-header">
      <div class="rule-icon icon-bg-blue" style="width:40px;height:40px;border-radius:var(--radius)">&#128197;</div>
      <h3 class="rule-card-title">Prazo e Organiza\u00e7\u00e3o</h3>
    </div>
    <ul class="rule-list">
      <li>Os jogadores se organizam livremente para jogar suas partidas, em qualquer ordem de rodada.</li>
      <li>N\u00e3o h\u00e1 prazo fixo por rodada. O admin decide caso a caso se necess\u00e1rio aplicar WO.</li>
    </ul>
  </div>`;

  // Registro de Resultado — universal
  html += `<div class="rule-card">
    <div class="rule-card-header">
      <div class="rule-icon icon-bg-green" style="width:40px;height:40px;border-radius:var(--radius)">&#128172;</div>
      <h3 class="rule-card-title">Registro de Resultado</h3>
    </div>
    <ul class="rule-list">
      <li>Ap\u00f3s cada partida, os jogadores informam o resultado via <strong>Microsoft Teams</strong>.</li>
      <li>O admin registra o placar no sistema com base nas informa\u00e7\u00f5es dos jogadores.</li>
    </ul>
  </div>`;

  container.innerHTML = html;
}

// ------------------------------------------------------------------
// AUDIT LOG (Histórico)
// ------------------------------------------------------------------

async function renderHistorico() {
  const container = document.getElementById('historicoContainer');
  if (!container) return;

  container.innerHTML = '<div style="text-align:center;padding:24px;color:var(--color-text-muted)">Carregando...</div>';
  const logs = await AppState.loadAuditLog();

  if (logs.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">&#128203;</div>
        <div class="empty-title">Nenhuma alteração registrada</div>
        <div class="empty-desc">As ações realizadas no campeonato aparecerão aqui com data, hora e responsável.</div>
      </div>`;
    return;
  }

  const sorted = logs; // Already ordered desc from Firestore

  container.innerHTML = `
    <div class="audit-log">
      ${sorted.map(entry => {
        const dt = new Date(entry.timestamp);
        const dateStr = dt.toLocaleDateString('pt-BR');
        const timeStr = dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        return `
          <div class="audit-entry">
            <div class="audit-meta">
              <span class="audit-user">${UI.escapeHtml(entry.usuario)}</span>
              <span class="audit-datetime">${dateStr} às ${timeStr}</span>
            </div>
            <div class="audit-action">${UI.escapeHtml(entry.acao)}</div>
            ${entry.detalhes ? `<div class="audit-details">${Object.entries(entry.detalhes).map(([k, v]) => `<span>${UI.escapeHtml(k)}: <strong>${UI.escapeHtml(String(v))}</strong></span>`).join(' &bull; ')}</div>` : ''}
          </div>`;
      }).join('')}
    </div>`;
}

// ------------------------------------------------------------------
// INSCRICOES (Public Registration)
// ------------------------------------------------------------------

async function renderInscricoes() {
  const state = AppState.loadReadOnly();
  const container = document.getElementById('inscricoesContainer');
  if (!container) return;

  const registrations = await FirestoreService.loadRegistrations();
  const pendentes = registrations.filter(r => r.status === 'pendente');
  const aprovados = registrations.filter(r => r.status === 'aprovado');
  const rejeitados = registrations.filter(r => r.status === 'rejeitado');
  const isOpen = state.campeonato.status === 'configuracao';
  const admin = UI.checkAdmin();

  let html = '';

  // Status banner
  if (isOpen) {
    html += '<div class="status-banner open"><span>&#9989;</span> Inscri&ccedil;&otilde;es abertas! Cadastre seu time abaixo.</div>';
  } else {
    html += '<div class="status-banner closed"><span>&#128683;</span> Inscri&ccedil;&otilde;es encerradas. O campeonato j&aacute; come&ccedil;ou. Contate o administrador.</div>';
  }

  // Pending requests
  if (pendentes.length > 0) {
    html += '<div class="section-header"><h3 class="section-title"><span class="section-title-icon icon-bg-yellow">&#9203;</span> Aguardando Aprovacao (' + pendentes.length + ')</h3></div>';
    html += '<div style="display:flex;flex-direction:column;gap:8px;margin-bottom:24px">';
    html += pendentes.map(r => renderRegistrationCard(r, 'pendente', admin)).join('');
    html += '</div>';
  }

  // Enrolled teams
  if (state.times.length > 0) {
    html += '<div class="section-header"><h3 class="section-title"><span class="section-title-icon icon-bg-green">&#9989;</span> Times Inscritos (' + state.times.length + ')</h3></div>';
    html += '<div class="teams-grid mb-24">';
    html += state.times.map(t => '<div class="team-card"><div style="display:flex;align-items:center;gap:12px">' + UI.renderAvatar(t, 36) + '<div><div class="team-card-name">' + UI.escapeHtml(t.nome) + '</div><div class="team-card-abbr">' + UI.escapeHtml(t.abreviacao) + (t.participante ? ' &bull; ' + UI.escapeHtml(t.participante) : '') + '</div></div></div></div>').join('');
    html += '</div>';
  } else if (pendentes.length === 0) {
    html += '<div class="empty-state"><div class="empty-icon">&#128101;</div><div class="empty-title">Nenhum time inscrito ainda</div><div class="empty-desc">Seja o primeiro a inscrever seu time!</div></div>';
  }

  // Rejected (admin only)
  if (admin && rejeitados.length > 0) {
    html += '<div class="section-header"><h3 class="section-title" style="font-size:.9rem;color:var(--color-text-dim)">Rejeitados (' + rejeitados.length + ')</h3></div>';
    html += '<div style="display:flex;flex-direction:column;gap:8px;margin-bottom:24px">';
    html += rejeitados.map(r => renderRegistrationCard(r, 'rejeitado', false)).join('');
    html += '</div>';
  }

  container.innerHTML = html;

  // Hide form when closed
  const formCard = document.getElementById('inscricaoFormCard');
  if (formCard) {
    formCard.style.display = isOpen ? '' : 'none';
  }
}

function renderRegistrationCard(r, status, showActions) {
  const statusColors = {
    pendente: { bg: 'var(--color-draw-bg)', color: '#b8860b', border: 'rgba(253,203,110,0.4)', label: 'Aguardando' },
    aprovado: { bg: 'var(--color-win-bg)', color: 'var(--color-win)', border: 'rgba(0,184,148,0.3)', label: 'Aprovado' },
    rejeitado: { bg: 'var(--color-loss-bg)', color: 'var(--color-loss)', border: 'rgba(232,67,147,0.3)', label: 'Rejeitado' }
  };
  const s = statusColors[status];
  const avatar = { nome: r.nome, abreviacao: r.abreviacao, cor: r.cor };

  const meta = UI.escapeHtml(r.abreviacao) + (r.participante ? ' &bull; ' + UI.escapeHtml(r.participante) : '') + ' &bull; ' + new Date(r.criadoEm).toLocaleDateString('pt-BR');
  const actions = showActions
    ? `<div style="display:flex;gap:6px"><button class="btn btn-sm btn-success" onclick="approveRegistration('${r.id}')">Aprovar</button><button class="btn btn-sm btn-secondary" onclick="rejectRegistration('${r.id}')">Rejeitar</button></div>`
    : '';

  return `<div class="registration-card">
    ${UI.renderAvatar(avatar, 36)}
    <div class="registration-card-info">
      <div class="registration-card-name">${UI.escapeHtml(r.nome)}</div>
      <div class="registration-card-meta">${meta}</div>
    </div>
    <span class="registration-card-badge" style="background:${s.bg};color:${s.color};border:1px solid ${s.border}">${s.label}</span>
    ${actions}
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
  bracket: renderBracket,
  estatisticas: renderEstatisticas,
  regras: renderRegras,
  historico: renderHistorico,
  inscricoes: renderInscricoes
};

// Helpers used by actions
