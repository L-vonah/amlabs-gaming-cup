/**
 * Actions — Campeonatos AMLabs
 * All user-triggered event handlers
 */

// ------------------------------------------------------------------
// Tournament Selection
// ------------------------------------------------------------------

/**
 * Enter a tournament by UUID. Navigates to campeonato.html.
 */
function enterTournament(uuid) {
  setActiveTournamentId(uuid);
  window.location.href = 'campeonato.html';
}
window.enterTournament = enterTournament;

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
  if (!UI.checkAdmin()) { UI.showToast('Voc\u00ea precisa estar logado como admin para editar.', 'error'); return; }
  const participante = UI.getFormValue('inputPartTimo');
  const nome = UI.getFormValue('inputNomeTimo');
  let abrev = UI.getFormValue('inputAbrevTimo').replace(/[^A-Za-z]/g, '');
  const cor = document.getElementById('inputCorTimo') ? document.getElementById('inputCorTimo').value : UI.getRandomColor();

  // Clear previous error highlights
  const elPart = document.getElementById('inputPartTimo');
  const elNome = document.getElementById('inputNomeTimo');
  if (elPart) elPart.style.borderColor = '';
  if (elNome) elNome.style.borderColor = '';

  if (!participante) {
    if (elPart) elPart.style.borderColor = 'var(--color-loss)';
    UI.showToast('Informe o nome do participante.', 'error');
    return;
  }

  if (!nome) {
    if (elNome) elNome.style.borderColor = 'var(--color-loss)';
    UI.showToast('Informe o nome do time.', 'error');
    return;
  }

  if (!abrev) {
    abrev = nome.replace(/[aeiouAEIOU\s]/g, '').slice(0, 3).toUpperCase() || nome.slice(0, 3).toUpperCase();
  }

  const state = AppState.load();

  if (state.campeonato.status !== 'configuracao' && state.campeonato.status !== 'grupos') {
    UI.showToast('N\u00e3o \u00e9 poss\u00edvel adicionar times durante os playoffs.', 'error');
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
  // Reset color to a new random color
  const colorInput = document.getElementById('inputCorTimo');
  if (colorInput) colorInput.value = UI.getRandomColor();

  const msg = novasPartidas > 0
    ? `Time "${nome}" adicionado! ${novasPartidas} partidas geradas.`
    : `Time "${nome}" adicionado!`;
  UI.showToast(msg, 'success');
  Renderers.times();
  if (novasPartidas > 0) Renderers.partidas();
}

function deleteTime(id) {
  if (!UI.checkAdmin()) { UI.showToast('Voc\u00ea precisa estar logado como admin para editar.', 'error'); return; }
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
  if (!UI.checkAdmin()) { UI.showToast('Apenas o admin pode editar.', 'error'); return; }
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
  if (!UI.checkAdmin()) return;
  const id = document.getElementById('editTeamId').value;
  const participante = document.getElementById('editTeamParticipante').value.trim();
  const nome = document.getElementById('editTeamNome').value.trim();
  const abrev = document.getElementById('editTeamAbrev').value.trim().replace(/[^A-Za-z]/g, '').toUpperCase().slice(0, 3);
  const cor = document.getElementById('editTeamCor').value;

  const inputPart = document.getElementById('editTeamParticipante');
  const inputNome = document.getElementById('editTeamNome');
  inputPart.style.borderColor = '';
  inputNome.style.borderColor = '';

  if (!participante || !nome) {
    if (!participante) inputPart.style.borderColor = 'var(--color-loss)';
    if (!nome) inputNome.style.borderColor = 'var(--color-loss)';
    UI.showToast('Participante e nome do time s\u00e3o obrigat\u00f3rios.', 'error');
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
  if (!UI.checkAdmin()) { UI.showToast('Voc\u00ea precisa estar logado como admin para editar.', 'error'); return; }
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
  if (!UI.checkAdmin()) { UI.showToast('Voc\u00ea precisa estar logado como admin para editar.', 'error'); return; }
  const state = AppState.load();
  const formatId = typeof getSelectedPlayoffFormatId === 'function' ? getSelectedPlayoffFormatId() : PlayoffFormats.DEFAULT;

  if (!canStartPlayoffs(state)) {
    UI.showToast('Conclua todos os jogos da fase de grupos primeiro.', 'error');
    return;
  }

  const ok = AppState.popularPlayoffs(state, formatId);
  if (!ok) {
    const reqFormat = PlayoffFormats.get(formatId);
    UI.showToast('Erro ao iniciar os playoffs. Verifique se h\u00e1 pelo menos ' + reqFormat.classified + ' times classificados.', 'error');
    return;
  }

  const format = PlayoffFormats.get(formatId);
  AppState.save(state);
  AppState.addAuditLog(getAuditUser(), 'Playoffs iniciados (' + format.name + ') com os ' + format.classified + ' classificados');
  UI.showToast('Playoffs iniciados! ' + format.name + ' com os ' + format.classified + ' classificados.', 'success');
  UI.navigateTo('bracket');
}

// ------------------------------------------------------------------
// Group Stage Results — inline calendar form
// ------------------------------------------------------------------

/**
 * Saves a group stage result. Called by the score modal (submitScoreModal).
 * Supports both numeric scores (EA Sports FC) and winner-only (Sinuca).
 */
function saveInlineResult(partidaId, scoreA, scoreB, winnerSide) {
  if (!UI.checkAdmin()) { UI.showToast('Voc\u00ea precisa estar logado como admin para editar.', 'error'); return; }

  const gt = getActiveGameType();

  if (gt.scoreType === 'numeric') {
    if (isNaN(scoreA) || isNaN(scoreB) || scoreA < 0 || scoreB < 0) {
      UI.showToast('Informe placar válido (números não negativos).', 'error');
      return;
    }
    if (gt.maxScore && (scoreA > gt.maxScore || scoreB > gt.maxScore)) {
      UI.showToast('Placar máximo permitido: ' + gt.maxScore + '.', 'error');
      return;
    }
  }

  const state = AppState.load();

  if (state.campeonato.status === 'playoffs' || state.campeonato.status === 'encerrado') {
    UI.showToast('N\u00e3o \u00e9 poss\u00edvel editar partidas da fase de grupos durante os playoffs. Refaça os playoffs primeiro.', 'error');
    return;
  }

  const partida = state.faseGrupos.partidas.find(p => p.id === partidaId);
  if (!partida) {
    UI.showToast('Partida não encontrada.', 'error');
    return;
  }

  const tA = AppState.getTimeById(state, partida.timeA);
  const tB = AppState.getTimeById(state, partida.timeB);

  partida.scoreA = gt.scoreType === 'numeric' ? scoreA : null;
  partida.scoreB = gt.scoreType === 'numeric' ? scoreB : null;
  partida.status = 'concluida';

  // Set vencedor
  if (gt.scoreType === 'numeric') {
    if (scoreA > scoreB) partida.vencedor = partida.timeA;
    else if (scoreB > scoreA) partida.vencedor = partida.timeB;
    else partida.vencedor = null; // draw
  } else {
    partida.vencedor = winnerSide === 'A' ? partida.timeA : partida.timeB;
  }

  AppState.save(state);

  const nomeA = tA ? tA.nome : '?';
  const nomeB = tB ? tB.nome : '?';
  const nomeVencedor = partida.vencedor ? (partida.vencedor === partida.timeA ? nomeA : nomeB) : null;
  const auditStr = gt.auditResultLabel(nomeA, nomeB, scoreA, scoreB, nomeVencedor);
  AppState.addAuditLog(getAuditUser(), 'Registrou resultado: ' + auditStr, { partidaId, scoreA, scoreB, rodada: partida.rodada });
  UI.showToast('Resultado salvo: ' + auditStr, 'success');

  Renderers.classificacao();

  // Check if all matches done — suggest starting playoffs (only if required)
  if (gt.requireAllMatches) {
    const pending = state.faseGrupos.partidas.filter(p => p.status === 'pendente').length;
    if (pending === 0 && state.times.length >= 4) {
      setTimeout(() => {
        UI.showToast('Todos os jogos concluídos! Você pode iniciar os Playoffs.', 'info', 5000);
      }, 500);
    }
  }
}


// ------------------------------------------------------------------
// Playoff Results
// ------------------------------------------------------------------

function savePlayoffResult(matchId, scoreA, scoreB, penaltyWinner, winnerSide) {
  if (!UI.checkAdmin()) { UI.showToast('Voc\u00ea precisa estar logado como admin para editar.', 'error'); return; }

  const gt = getActiveGameType();

  if (gt.scoreType === 'numeric') {
    if (isNaN(scoreA) || isNaN(scoreB) || scoreA < 0 || scoreB < 0) {
      UI.showToast('Informe placar válido.', 'error');
      return;
    }
    if (gt.maxScore && (scoreA > gt.maxScore || scoreB > gt.maxScore)) {
      UI.showToast('Placar máximo permitido: ' + gt.maxScore + '.', 'error');
      return;
    }
  }

  const state = AppState.load();

  const match = state.playoffs.matches ? state.playoffs.matches[matchId] : null;
  const tA = match ? AppState.getTimeById(state, match.timeA) : null;
  const tB = match ? AppState.getTimeById(state, match.timeB) : null;

  let ok;
  if (gt.scoreType !== 'numeric' && winnerSide) {
    // Winner-only: use dummy scores for the registrar function
    ok = AppState.registrarResultadoPlayoff(state, matchId,
      winnerSide === 'A' ? 1 : 0,
      winnerSide === 'B' ? 1 : 0,
      null);
    // Override scores back to null (display only)
    if (ok && match) { match.scoreA = null; match.scoreB = null; }
  } else {
    const effPenalty = gt.penaltyResolution ? penaltyWinner : null;
    ok = AppState.registrarResultadoPlayoff(state, matchId, scoreA, scoreB, effPenalty);
  }

  if (!ok) {
    UI.showToast('Erro ao salvar resultado do playoff.', 'error');
    return;
  }

  AppState.save(state);

  const nomeA = tA ? tA.nome : '?';
  const nomeB = tB ? tB.nome : '?';
  const nomeVencedor = match && match.vencedor ? (match.vencedor === match.timeA ? nomeA : nomeB) : null;
  const auditStr = gt.auditResultLabel(nomeA, nomeB, scoreA, scoreB, nomeVencedor);
  AppState.addAuditLog(getAuditUser(), 'Registrou resultado playoff: ' + auditStr, { matchId });
  UI.showToast('Resultado salvo: ' + auditStr, 'success');
  Renderers.bracket();
  Renderers.home();
}

// ------------------------------------------------------------------
// Reset
// ------------------------------------------------------------------

function confirmReset() {
  UI.openModal('modalReset');
}

function executeReset() {
  if (!UI.checkAdmin()) { UI.showToast('Voc\u00ea precisa estar logado como admin para editar.', 'error'); return; }
  AppState.reset();
  UI.closeModal('modalReset');
  UI.showToast('Campeonato resetado com sucesso.', 'info');
  UI.navigateTo('home');
  location.reload();
}

// ------------------------------------------------------------------
// Export data
// ------------------------------------------------------------------

async function exportData() {
  const state = AppState.load();
  const auditLog = await AppState.loadAuditLog();
  const exportObj = { state, auditLog, exportDate: new Date().toISOString(), version: '2.0' };
  const json = JSON.stringify(exportObj, null, 2);
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
    UI.showToast('Informe seu nome para identifica\u00e7\u00e3o.', 'error');
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

    AppState.addAuditLog(getAuditUser(), 'Solicitou inscri\u00e7\u00e3o:' + nome + ' (' + participante + ')', { abreviacao: abrev, participante });

    UI.clearForm('inputInscParticipante', 'inputInscNome', 'inputInscAbrev');
    const colorInput = document.getElementById('inputInscCor');
    if (colorInput) colorInput.value = UI.getRandomColor();

    UI.showToast('Solicita\u00e7\u00e3o enviada! Aguarde aprova\u00e7\u00e3o do administrador.', 'success');
    Renderers.inscricoes();
  } finally {
    setLoading(submitBtn, false);
  }
}

async function approveRegistration(id) {
  if (!UI.checkAdmin()) {
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
      'Aprovou inscri\u00e7\u00e3o:' + reg.nome
    );

    UI.showToast('Time "' + reg.nome + '" aprovado e adicionado!', 'success');
    Renderers.inscricoes();
    Renderers.times();
  } finally {
    actionBtns.forEach(b => setLoading(b, false));
  }
}

async function rejectRegistration(id) {
  if (!UI.checkAdmin()) {
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
      'Rejeitou inscri\u00e7\u00e3o:' + reg.nome
    );

    UI.showToast('Inscri\u00e7\u00e3o de "' + reg.nome + '" rejeitada.', 'info');
    Renderers.inscricoes();
  } finally {
    actionBtns.forEach(b => setLoading(b, false));
  }
}

// ------------------------------------------------------------------
// Reset Playoffs
// ------------------------------------------------------------------

function resetPlayoffs() {
  if (!UI.checkAdmin()) {
    UI.showToast('Apenas o admin pode resetar.', 'error');
    return;
  }
  UI.openModal('modalResetPlayoffs');
}

function executeResetPlayoffs() {
  UI.closeModal('modalResetPlayoffs');
  const state = AppState.load();
  state.playoffs = JSON.parse(JSON.stringify(AppState.getDefaultPlayoffs()));
  state.campeonato.status = 'grupos';
  AppState.save(state);
  AppState.addAuditLog(getAuditUser(), 'Resetou os playoffs');
  UI.showToast('Playoffs resetados!', 'success');
  Renderers.bracket();
  Renderers.home();
  Renderers.partidas();
}
window.resetPlayoffs = resetPlayoffs;

// ------------------------------------------------------------------
// Import / Export
// ------------------------------------------------------------------

async function importData(event) {
  if (!UI.checkAdmin()) return;
  const file = event.target.files[0];
  if (!file) return;

  if (file.size > 5 * 1024 * 1024) {
    UI.showToast('Arquivo muito grande. Limite: 5MB.', 'error');
    return;
  }

  try {
    const text = await file.text();
    const data = JSON.parse(text);

    const stateObj = data.state || data;
    if (!stateObj || typeof stateObj !== 'object' ||
        !stateObj.campeonato || typeof stateObj.campeonato !== 'object' ||
        !Array.isArray(stateObj.times) ||
        !stateObj.faseGrupos || typeof stateObj.faseGrupos !== 'object') {
      UI.showToast('Arquivo inválido: estrutura não reconhecida.', 'error');
      return;
    }

    // Save to Firestore via AppState
    AppState.save(stateObj);
    UI.showToast('Dados importados com sucesso!', 'success');
    location.reload();
  } catch (err) {
    console.error('Import error:', err);
    UI.showToast('Erro ao importar: ' + err.message, 'error');
  }
}
