/**
 * Actions — 1o Campeonato FC Football AMLabs
 * All user-triggered event handlers
 */

// ------------------------------------------------------------------
// Browser fingerprint — replaces name prompt for audit log identity
// ------------------------------------------------------------------

/**
 * Generates a stable fingerprint for this browser/device.
 * Used in the audit log as the device identifier.
 * @returns {string} e.g. "PC-3A7F1C2B"
 */
function getBrowserFingerprint() {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  ctx.textBaseline = 'top';
  ctx.font = '14px Arial';
  ctx.fillText('fingerprint', 2, 2);
  const canvasData = canvas.toDataURL();

  const data = [
    navigator.userAgent,
    navigator.language,
    screen.width + 'x' + screen.height,
    screen.colorDepth,
    new Date().getTimezoneOffset(),
    navigator.hardwareConcurrency || 'unknown',
    canvasData.slice(-50)
  ].join('|');

  // Simple hash
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return 'PC-' + Math.abs(hash).toString(16).toUpperCase().slice(0, 8);
}

// Cache fingerprint so it's computed only once per session
let _cachedFingerprint = null;
function getDeviceId() {
  if (!_cachedFingerprint) {
    _cachedFingerprint = getBrowserFingerprint();
  }
  return _cachedFingerprint;
}

/**
 * Returns the best identifier for audit log: admin email if logged in, device fingerprint otherwise.
 */
function getAuditUser() {
  if (typeof currentUser !== 'undefined' && currentUser && currentUser.email) {
    return currentUser.email;
  }
  return getDeviceId();
}

// ------------------------------------------------------------------
// Loading state helper
// ------------------------------------------------------------------

function setLoading(btn, loading) {
  if (!btn) return;
  if (loading) {
    btn.classList.add('btn-loading');
    btn.disabled = true;
    btn._origText = btn.textContent;
  } else {
    btn.classList.remove('btn-loading');
    btn.disabled = false;
  }
}

// ------------------------------------------------------------------
// Teams
// ------------------------------------------------------------------

function submitAddTime() {
  if (typeof isAdmin === 'function' && !isAdmin()) { showToast('Voce precisa estar logado como admin para editar.', 'error'); return; }
  const participante = UI.getFormValue('inputPartTimo');
  const nome = UI.getFormValue('inputNomeTimo');
  let abrev = UI.getFormValue('inputAbrevTimo').replace(/[^A-Za-z]/g, '');
  const cor = document.getElementById('inputCorTimo') ? document.getElementById('inputCorTimo').value : UI.getRandomColor();

  if (!participante) {
    UI.showToast('Informe o nome do participante.', 'error');
    return;
  }

  if (!nome) {
    UI.showToast('Informe o nome do time.', 'error');
    return;
  }

  if (!abrev) {
    abrev = nome.replace(/[aeiouAEIOU\s]/g, '').slice(0, 3).toUpperCase() || nome.slice(0, 3).toUpperCase();
  }

  const state = AppState.load();

  if (state.campeonato.status !== 'configuracao' && state.campeonato.status !== 'grupos') {
    UI.showToast('Nao e possivel adicionar times durante os playoffs.', 'error');
    return;
  }

  if (state.times.some(t => t.nome.toLowerCase() === nome.toLowerCase())) {
    UI.showToast('Ja existe um time com esse nome.', 'error');
    return;
  }

  const novoTime = AppState.addTime(state, { nome, abreviacao: abrev, cor, participante });

  // If tournament is in group stage, regenerate all matches preserving results
  const partidasAntes = state.faseGrupos.partidas.length;
  if (state.campeonato.status === 'grupos') {
    AppState.regenerarFaseGrupos(state);
  }
  const novasPartidas = state.faseGrupos.partidas.length - partidasAntes;

  AppState.save(state);
  AppState.addAuditLog(getAuditUser(), `Adicionou o time "${nome}" (${participante})`, { abreviacao: abrev, cor, participante });

  UI.clearForm('inputPartTimo', 'inputNomeTimo', 'inputAbrevTimo');
  // Reset color to default primary
  const colorInput = document.getElementById('inputCorTimo');
  if (colorInput) colorInput.value = '#6c5ce7';

  const msg = novasPartidas > 0
    ? `Time "${nome}" adicionado! ${novasPartidas} partidas geradas.`
    : `Time "${nome}" adicionado!`;
  UI.showToast(msg, 'success');
  Renderers.times();
  if (novasPartidas > 0) Renderers.partidas();
}

function deleteTime(id) {
  if (typeof isAdmin === 'function' && !isAdmin()) { showToast('Voce precisa estar logado como admin para editar.', 'error'); return; }
  const state = AppState.load();
  const time = AppState.getTimeById(state, id);
  if (!time) return;

  if (state.campeonato.status !== 'configuracao') {
    UI.showToast('Não é possível remover times após o início do campeonato.', 'error');
    return;
  }

  AppState.removeTime(state, id);
  AppState.save(state);
  AppState.addAuditLog(getAuditUser(), `Removeu o time "${time.nome}"`);
  UI.showToast(`Time "${time.nome}" removido.`, 'info');
  Renderers.times();
}

// ------------------------------------------------------------------
// Edit Team
// ------------------------------------------------------------------

function openEditTeamModal(id) {
  if (typeof isAdmin === 'function' && !isAdmin()) { showToast('Apenas o admin pode editar.', 'error'); return; }
  const state = AppState.load();
  const time = AppState.getTimeById(state, id);
  if (!time) return;

  document.getElementById('editTeamId').value = id;
  document.getElementById('editTeamParticipante').value = time.participante || '';
  document.getElementById('editTeamNome').value = time.nome;
  document.getElementById('editTeamAbrev').value = time.abreviacao;
  document.getElementById('editTeamCor').value = time.cor || '#6c5ce7';
  UI.openModal('modalEditTeam');
}
window.openEditTeamModal = openEditTeamModal;

function saveEditTeam() {
  if (typeof isAdmin === 'function' && !isAdmin()) return;
  const id = document.getElementById('editTeamId').value;
  const participante = document.getElementById('editTeamParticipante').value.trim();
  const nome = document.getElementById('editTeamNome').value.trim();
  const abrev = document.getElementById('editTeamAbrev').value.trim().replace(/[^A-Za-z]/g, '').toUpperCase().slice(0, 3);
  const cor = document.getElementById('editTeamCor').value;

  if (!participante || !nome) {
    UI.showToast('Participante e nome do time sao obrigatorios.', 'error');
    return;
  }

  const state = AppState.load();
  const time = state.times.find(t => t.id === id);
  if (!time) return;

  const oldName = time.nome;
  time.participante = participante;
  time.nome = nome;
  time.abreviacao = abrev || time.abreviacao;
  time.cor = cor;

  AppState.save(state);
  AppState.addAuditLog(getAuditUser(), 'Editou time "' + oldName + '"', { novoNome: nome, participante });
  UI.closeModal('modalEditTeam');
  UI.showToast('Time atualizado!', 'success');
  Renderers.times();
}
window.saveEditTeam = saveEditTeam;

// ------------------------------------------------------------------
// Phase Management
// ------------------------------------------------------------------

function gerarFaseGrupos() {
  if (typeof isAdmin === 'function' && !isAdmin()) { showToast('Voce precisa estar logado como admin para editar.', 'error'); return; }
  const state = AppState.load();

  if (state.times.length < 5) {
    UI.showToast('Minimo de 5 times para gerar a fase de grupos. Atualmente: ' + state.times.length + ' time' + (state.times.length !== 1 ? 's' : '') + '.', 'error');
    return;
  }

  const ok = AppState.gerarFaseGrupos(state);
  if (!ok) {
    UI.showToast('Erro ao gerar a fase de grupos.', 'error');
    return;
  }

  AppState.save(state);
  AppState.addAuditLog(getAuditUser(), 'Fase de grupos gerada', { totalPartidas: state.faseGrupos.partidas.length, totalTimes: state.times.length });
  UI.showToast(`Fase de grupos gerada! ${state.faseGrupos.partidas.length} partidas criadas.`, 'success');

  // Navigate to classification
  UI.navigateTo('classificacao');
}

function iniciarPlayoffs() {
  if (typeof isAdmin === 'function' && !isAdmin()) { showToast('Voce precisa estar logado como admin para editar.', 'error'); return; }
  const state = AppState.load();

  if (!canStartPlayoffs(state)) {
    UI.showToast('Conclua todos os jogos da fase de grupos primeiro.', 'error');
    return;
  }

  const ok = AppState.popularPlayoffs(state);
  if (!ok) {
    UI.showToast('Erro ao iniciar os playoffs. Verifique se há pelo menos 4 times classificados.', 'error');
    return;
  }

  AppState.save(state);
  AppState.addAuditLog(getAuditUser(), 'Playoffs iniciados com os 4 classificados');
  UI.showToast('Playoffs iniciados! Chaveamento gerado com os 4 classificados.', 'success');
  UI.navigateTo('bracket');
}

// ------------------------------------------------------------------
// Group Stage Results — inline calendar form
// ------------------------------------------------------------------

/**
 * Saves a group stage result. Called by the score modal (submitScoreModal).
 * @param {string} partidaId
 */
function saveInlineResult(partidaId) {
  if (typeof isAdmin === 'function' && !isAdmin()) { showToast('Voce precisa estar logado como admin para editar.', 'error'); return; }
  const golsAEl = document.getElementById(`inline_golsA_${partidaId}`);
  const golsBEl = document.getElementById(`inline_golsB_${partidaId}`);

  if (!golsAEl || !golsBEl) {
    UI.showToast('Erro ao encontrar campos do placar.', 'error');
    return;
  }

  const golsA = parseInt(golsAEl.value);
  const golsB = parseInt(golsBEl.value);

  if (isNaN(golsA) || isNaN(golsB) || golsA < 0 || golsB < 0) {
    UI.showToast('Informe placar válido (números não negativos).', 'error');
    return;
  }

  if (golsA > 99 || golsB > 99) {
    UI.showToast('Placar maximo permitido: 99.', 'error');
    return;
  }

  const state = AppState.load();
  const partida = state.faseGrupos.partidas.find(p => p.id === partidaId);

  if (!partida) {
    UI.showToast('Partida não encontrada.', 'error');
    return;
  }

  const tA = AppState.getTimeById(state, partida.timeA);
  const tB = AppState.getTimeById(state, partida.timeB);

  partida.golsA = golsA;
  partida.golsB = golsB;
  partida.status = 'concluida';

  AppState.save(state);

  const scoreStr = `${tA ? tA.nome : '?'} ${golsA} x ${golsB} ${tB ? tB.nome : '?'}`;
  AppState.addAuditLog(getAuditUser(), `Registrou resultado: ${scoreStr}`, { partidaId, golsA, golsB, rodada: partida.rodada });
  UI.showToast(`Resultado salvo: ${scoreStr}`, 'success');

  // Re-render relevant sections
  Renderers.classificacao();

  // Check if all matches done — suggest starting playoffs
  const pending = state.faseGrupos.partidas.filter(p => p.status === 'pendente').length;
  if (pending === 0 && state.times.length >= 4) {
    setTimeout(() => {
      UI.showToast('Todos os jogos concluídos! Você pode iniciar os Playoffs.', 'info', 5000);
    }, 500);
  }
}


// ------------------------------------------------------------------
// Playoff Results
// ------------------------------------------------------------------

function savePlayoffResult(matchId) {
  if (typeof isAdmin === 'function' && !isAdmin()) { showToast('Voce precisa estar logado como admin para editar.', 'error'); return; }
  const golsAEl = document.getElementById(`playoff_golsA_${matchId}`);
  const golsBEl = document.getElementById(`playoff_golsB_${matchId}`);

  if (!golsAEl || !golsBEl) {
    UI.showToast('Erro ao encontrar campos do placar.', 'error');
    return;
  }

  const golsA = parseInt(golsAEl.value);
  const golsB = parseInt(golsBEl.value);

  if (isNaN(golsA) || isNaN(golsB) || golsA < 0 || golsB < 0) {
    UI.showToast('Informe placar válido.', 'error');
    return;
  }

  if (golsA > 99 || golsB > 99) {
    UI.showToast('Placar maximo permitido: 99.', 'error');
    return;
  }

  if (golsA === golsB) {
    UI.showToast('Empates não são permitidos nos playoffs. Defina o vencedor por prorrogação ou pênaltis.', 'error');
    return;
  }

  const state = AppState.load();

  // Find match details for audit log
  const ub = state.playoffs.upperBracket;
  const lb = state.playoffs.lowerBracket;
  const allMatches = [ub.sf1, ub.sf2, ub.final, lb.sf, lb.final];
  const match = allMatches.find(m => m.id === matchId);
  const tA = match ? AppState.getTimeById(state, match.timeA) : null;
  const tB = match ? AppState.getTimeById(state, match.timeB) : null;

  const ok = AppState.registrarResultadoPlayoff(state, matchId, golsA, golsB);

  if (!ok) {
    UI.showToast('Erro ao salvar resultado do playoff.', 'error');
    return;
  }

  AppState.save(state);

  const faseLabel = match ? match.fase : matchId;
  const scoreStr = `${tA ? tA.nome : '?'} ${golsA} x ${golsB} ${tB ? tB.nome : '?'}`;
  AppState.addAuditLog(getAuditUser(), `Registrou resultado de playoff: ${scoreStr}`, { matchId, fase: faseLabel, golsA, golsB });
  UI.showToast('Resultado de playoff salvo!', 'success');
  Renderers.bracket();
}

function saveGrandFinalResult() {
  if (typeof isAdmin === 'function' && !isAdmin()) { showToast('Voce precisa estar logado como admin para editar.', 'error'); return; }
  const golsUpperEl = document.getElementById('gfGolsUpper');
  const golsLowerEl = document.getElementById('gfGolsLower');

  if (!golsUpperEl || !golsLowerEl) return;

  const golsUpper = parseInt(golsUpperEl.value);
  const golsLower = parseInt(golsLowerEl.value);

  if (isNaN(golsUpper) || isNaN(golsLower) || golsUpper < 0 || golsLower < 0) {
    UI.showToast('Informe placar válido.', 'error');
    return;
  }

  if (golsUpper > 99 || golsLower > 99) {
    UI.showToast('Placar maximo permitido: 99.', 'error');
    return;
  }

  if (golsUpper === golsLower) {
    UI.showToast('Empates não são permitidos na Grande Final. Defina o vencedor.', 'error');
    return;
  }

  const state = AppState.load();
  const tU = AppState.getTimeById(state, state.playoffs.grandFinal.timeUpper);
  const tL = AppState.getTimeById(state, state.playoffs.grandFinal.timeLower);

  const ok = AppState.registrarResultadoGrandFinal(state, golsUpper, golsLower);

  if (!ok) {
    UI.showToast('Erro ao salvar resultado da Grande Final.', 'error');
    return;
  }

  AppState.save(state);

  const winner = AppState.getTimeById(state, state.playoffs.grandFinal.vencedor);
  const scoreStr = `${tU ? tU.nome : '?'} ${golsUpper} x ${golsLower} ${tL ? tL.nome : '?'}`;
  AppState.addAuditLog(getAuditUser(), `Registrou resultado da Grande Final: ${scoreStr} — Campeão: ${winner ? winner.nome : '?'}`, { golsUpper, golsLower, campeao: winner ? winner.id : null });
  UI.showToast(`\u{1F3C6} ${winner ? winner.nome : '?'} \u00E9 CAMPE\u00C3O!`, 'success', 6000);

  Renderers.bracket();
  Renderers.home();
  UI.updateHeaderBadge('encerrado');
  UI.updateLifecycleBar('encerrado');
}


// ------------------------------------------------------------------
// Reset
// ------------------------------------------------------------------

function confirmReset() {
  UI.openModal('modalReset');
}

function executeReset() {
  if (typeof isAdmin === 'function' && !isAdmin()) { showToast('Voce precisa estar logado como admin para editar.', 'error'); return; }
  AppState.reset();
  UI.closeModal('modalReset');
  UI.showToast('Campeonato resetado com sucesso.', 'info');
  UI.navigateTo('home');
  location.reload();
}

// ------------------------------------------------------------------
// Export data
// ------------------------------------------------------------------

function exportData() {
  const state = AppState.load();
  const auditLog = AppState.loadAuditLog();
  const json = JSON.stringify({ state, auditLog }, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `campeonato-amlabs-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
  UI.showToast('Dados exportados!', 'success');
}

// ------------------------------------------------------------------
// Public Registration
// ------------------------------------------------------------------

async function submitPublicRegistration() {
  const participante = UI.getFormValue('inputInscParticipante');
  const nome = UI.getFormValue('inputInscNome');
  let abrev = UI.getFormValue('inputInscAbrev').replace(/[^A-Za-z]/g, '');
  const cor = document.getElementById('inputInscCor')
    ? document.getElementById('inputInscCor').value
    : UI.getRandomColor();

  if (!participante) {
    UI.showToast('Informe seu nome para identificacao.', 'error');
    return;
  }

  if (!nome) {
    UI.showToast('Informe o nome do time.', 'error');
    return;
  }
  if (!abrev) {
    abrev = nome.replace(/[aeiouAEIOU\s]/g, '').slice(0, 3).toUpperCase()
      || nome.slice(0, 3).toUpperCase();
  }

  const state = AppState.load();
  if (state.campeonato.status !== 'configuracao') {
    UI.showToast('Inscricoes encerradas. O campeonato ja comecou.', 'error');
    return;
  }

  const submitBtn = document.querySelector('#inscricaoFormCard .btn-primary');
  setLoading(submitBtn, true);

  try {
    const registrations = await FirestoreService.loadRegistrations();
    const allNames = [
      ...state.times.map(t => t.nome.toLowerCase()),
      ...registrations.filter(r => r.status === 'pendente').map(r => r.nome.toLowerCase())
    ];
    if (allNames.includes(nome.toLowerCase())) {
      UI.showToast('Ja existe um time ou solicitacao com esse nome.', 'error');
      return;
    }

    await FirestoreService.submitRegistration({
      participante,
      nome,
      abreviacao: abrev.toUpperCase().slice(0, 3),
      cor
    });

    AppState.addAuditLog(getAuditUser(), 'Solicitou inscricao: ' + nome + ' (' + participante + ')', { abreviacao: abrev, participante });

    UI.clearForm('inputInscParticipante', 'inputInscNome', 'inputInscAbrev');
    const colorInput = document.getElementById('inputInscCor');
    if (colorInput) colorInput.value = '#6c5ce7';

    UI.showToast('Solicitacao enviada! Aguarde aprovacao do administrador.', 'success');
    Renderers.inscricoes();
  } finally {
    setLoading(submitBtn, false);
  }
}

async function approveRegistration(id) {
  if (typeof isAdmin === 'function' && !isAdmin()) {
    UI.showToast('Apenas o admin pode aprovar.', 'error');
    return;
  }

  const actionBtns = document.querySelectorAll('.btn-approve, .btn-reject');
  actionBtns.forEach(b => setLoading(b, true));

  try {
    const registrations = await FirestoreService.loadRegistrations();
    const reg = registrations.find(r => r.id === id);
    if (!reg) return;

    const state = AppState.load();
    AppState.addTime(state, { nome: reg.nome, abreviacao: reg.abreviacao, cor: reg.cor, participante: reg.participante || '' });

    if (state.campeonato.status === 'grupos') {
      AppState.regenerarFaseGrupos(state);
    }

    AppState.save(state);

    await FirestoreService.updateRegistration(id, {
      status: 'aprovado',
      resolvidoEm: new Date().toISOString(),
      resolvidoPor: currentUser ? currentUser.email : 'admin'
    });

    AppState.addAuditLog(
      currentUser ? currentUser.email : getDeviceId(),
      'Aprovou inscricao: ' + reg.nome
    );

    UI.showToast('Time "' + reg.nome + '" aprovado e adicionado!', 'success');
    Renderers.inscricoes();
    Renderers.times();
  } finally {
    actionBtns.forEach(b => setLoading(b, false));
  }
}

async function rejectRegistration(id) {
  if (typeof isAdmin === 'function' && !isAdmin()) {
    UI.showToast('Apenas o admin pode rejeitar.', 'error');
    return;
  }

  const actionBtns = document.querySelectorAll('.btn-approve, .btn-reject');
  actionBtns.forEach(b => setLoading(b, true));

  try {
    const registrations = await FirestoreService.loadRegistrations();
    const reg = registrations.find(r => r.id === id);
    if (!reg) return;

    await FirestoreService.updateRegistration(id, {
      status: 'rejeitado',
      resolvidoEm: new Date().toISOString(),
      resolvidoPor: currentUser ? currentUser.email : 'admin'
    });

    AppState.addAuditLog(
      currentUser ? currentUser.email : getDeviceId(),
      'Rejeitou inscricao: ' + reg.nome
    );

    UI.showToast('Inscricao de "' + reg.nome + '" rejeitada.', 'info');
    Renderers.inscricoes();
  } finally {
    actionBtns.forEach(b => setLoading(b, false));
  }
}

// ------------------------------------------------------------------
// Import / Export
// ------------------------------------------------------------------

function importData(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      // Support both old format (plain state) and new format (wrapped)
      if (data.state) {
        localStorage.setItem('campeonato_amlabs_v1', JSON.stringify(data.state));
        if (data.auditLog) localStorage.setItem('campeonato_amlabs_audit_v1', JSON.stringify(data.auditLog));
        if (data.potes) localStorage.setItem('campeonato_amlabs_potes_v1', JSON.stringify(data.potes));
      } else {
        localStorage.setItem('campeonato_amlabs_v1', JSON.stringify(data));
      }
      UI.showToast('Dados importados com sucesso!', 'success');
      location.reload();
    } catch {
      UI.showToast('Arquivo inválido.', 'error');
    }
  };
  reader.readAsText(file);
}
