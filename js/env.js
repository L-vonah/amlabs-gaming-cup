/**
 * Environment Detection — AMLabs Gaming Cup
 * Must be the first script loaded. Exposes APP_ENV, IS_PROD, STORAGE_PREFIX.
 */

const APP_ENV = (() => {
  const host = window.location.hostname;
  if (host === 'amlabs-cup.netlify.app' || host === 'l-vonah.github.io') {
    return 'production';
  }
  return 'development'; // localhost, *.netlify.app previews, file://
})();

const IS_PROD = APP_ENV === 'production';

// Prefix for localStorage keys. Prevents dev data from colliding with prod
// when the same browser has both environments open simultaneously.
const STORAGE_PREFIX = IS_PROD ? '' : 'dev_';

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
