/**
 * Environment Detection — Campeonatos AMLabs
 * Must be the first script loaded. Exposes APP_ENV, IS_PROD and
 * path helpers that work on both Netlify and GitHub Pages.
 */

const APP_HOST = window.location.hostname;
const IS_FILE_PROTOCOL = window.location.protocol === 'file:';
const IS_GITHUB_PAGES = APP_HOST === 'l-vonah.github.io';

const APP_ENV = (() => {
  if (APP_HOST === 'amlabs-cup.netlify.app' || IS_GITHUB_PAGES) {
    return 'production';
  }
  return 'development'; // localhost, *.netlify.app previews, file://
})();

const IS_PROD = APP_ENV === 'production';
const APP_BASE_PATH = IS_GITHUB_PAGES ? '/amlabs-gaming-cup' : '';

function appPath(path) {
  if (!path) return APP_BASE_PATH || '/';
  if (/^(https?:)?\/\//.test(path)) return path;

  const normalized = path.startsWith('/') ? path : '/' + path;
  return (APP_BASE_PATH || '') + normalized;
}

function getServiceWorkerPath() {
  if (IS_FILE_PROTOCOL) return null;
  return appPath('/sw.js');
}

function getServiceWorkerScope() {
  if (IS_FILE_PROTOCOL) return null;
  return APP_BASE_PATH ? APP_BASE_PATH + '/' : '/';
}

// ------------------------------------------------------------------
// Active Tournament Session
// ------------------------------------------------------------------

const ACTIVE_TOURNAMENT_SESSION_KEY = 'active_tournament_id';

function getActiveTournamentId() {
  return sessionStorage.getItem(ACTIVE_TOURNAMENT_SESSION_KEY);
}

function setActiveTournamentId(uuid) {
  sessionStorage.setItem(ACTIVE_TOURNAMENT_SESSION_KEY, uuid);
}

function clearActiveTournamentId() {
  sessionStorage.removeItem(ACTIVE_TOURNAMENT_SESSION_KEY);
}
