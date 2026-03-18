/**
 * UI Helpers — 1o Campeonato FC Football AMLabs
 * Rendering utilities shared across all pages
 */

// ------------------------------------------------------------------
// Color utilities
// ------------------------------------------------------------------

const PRESET_COLORS = [
  '#6c5ce7', '#e84393', '#e17055', '#00b894', '#fdcb6e',
  '#0984e3', '#00cec9', '#d63031', '#a29bfe', '#fab1a0',
  '#74b9ff', '#55efc4', '#fd79a8', '#636e72', '#ffeaa7'
];

function getRandomColor() {
  return PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)];
}

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 108, g: 92, b: 231 };
}

// ------------------------------------------------------------------
// Avatar
// ------------------------------------------------------------------

function renderAvatar(time, size = 28, className = '') {
  if (!time) return `<div class="team-avatar ${className}" style="width:${size}px;height:${size}px;background:#dee2e6;font-size:${Math.floor(size*0.35)}px"></div>`;
  const abbr = (time.abreviacao || time.nome.slice(0, 3)).toUpperCase();
  const rgb = hexToRgb(time.cor || '#6c5ce7');
  return `<div class="team-avatar ${className}" style="width:${size}px;height:${size}px;background:${time.cor || '#6c5ce7'};box-shadow:0 0 0 1px rgba(${rgb.r},${rgb.g},${rgb.b},0.3);font-size:${Math.floor(size*0.35)}px">${abbr.slice(0,3)}</div>`;
}

// ------------------------------------------------------------------
// Toast notifications
// ------------------------------------------------------------------

function showToast(message, type = 'info', duration = 3200) {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const icons = { success: '✓', error: '✕', info: 'i' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span style="font-weight:800;opacity:.8">${icons[type] || 'i'}</span>${message}`;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'fadeOut 0.3s ease forwards';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ------------------------------------------------------------------
// Modal
// ------------------------------------------------------------------

function openModal(id) {
  const overlay = document.getElementById(id);
  if (overlay) overlay.classList.add('open');
}

function closeModal(id) {
  const overlay = document.getElementById(id);
  if (overlay) overlay.classList.remove('open');
}

// Close modal on overlay click
document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('open');
  }
});

// ------------------------------------------------------------------
// Navigation
// ------------------------------------------------------------------

function navigateTo(section) {
  document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));

  const target = document.getElementById('section-' + section);
  if (target) target.classList.add('active');

  const navLink = document.querySelector(`[data-nav="${section}"]`);
  if (navLink) navLink.classList.add('active');

  window.location.hash = section;

  // Trigger section render
  if (window.Renderers && window.Renderers[section]) {
    window.Renderers[section]();
  }
}

// ------------------------------------------------------------------
// Status badge
// ------------------------------------------------------------------

function getStatusLabel(status) {
  const map = {
    configuracao: 'Inscrição',
    grupos: 'Fase de Grupos',
    playoffs: 'Playoffs',
    encerrado: 'Encerrado'
  };
  return map[status] || status;
}

function updateHeaderBadge(status) {
  const badge = document.getElementById('headerStatusBadge');
  if (badge) {
    badge.className = `badge-status ${status}`;
    badge.textContent = getStatusLabel(status);
  }
}

// ------------------------------------------------------------------
// Lifecycle bar
// ------------------------------------------------------------------

function updateLifecycleBar(status) {
  const steps = ['configuracao', 'grupos', 'playoffs', 'encerrado'];
  const currentIdx = steps.indexOf(status);

  steps.forEach((step, i) => {
    const dot = document.querySelector(`.lifecycle-step[data-step="${step}"]`);
    const line = document.querySelector(`.lifecycle-line[data-after="${step}"]`);

    if (!dot) return;
    dot.classList.remove('done', 'active');

    if (i < currentIdx) dot.classList.add('done');
    else if (i === currentIdx) dot.classList.add('active');

    if (line) {
      line.classList.toggle('done', i < currentIdx);
    }
  });
}

// ------------------------------------------------------------------
// Form helpers
// ------------------------------------------------------------------

function getFormValue(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : '';
}

function clearForm(...ids) {
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
}

// ------------------------------------------------------------------
// Number sign helper
// ------------------------------------------------------------------

function signedNumber(n) {
  if (n > 0) return `+${n}`;
  return String(n);
}

// ------------------------------------------------------------------
// Match score class
// ------------------------------------------------------------------

function scoreClass(golsA, golsB) {
  if (golsA === null || golsB === null) return '';
  if (golsA > golsB) return 'winner-a';
  if (golsB > golsA) return 'winner-b';
  return 'draw';
}

// ------------------------------------------------------------------
// Exports
// ------------------------------------------------------------------

window.UI = {
  getRandomColor,
  renderAvatar,
  showToast,
  openModal,
  closeModal,
  navigateTo,
  updateHeaderBadge,
  updateLifecycleBar,
  getFormValue,
  clearForm,
  signedNumber,
  scoreClass,
  getStatusLabel,
  PRESET_COLORS
};
