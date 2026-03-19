/**
 * Authentication — AMLabs Gaming Cup
 * Google Login via Firebase Auth. Only admin can edit.
 */

const ADMIN_EMAIL = 'vonah.dev@gmail.com';
let currentUser = null;

function isAdmin() {
  return currentUser && currentUser.email === ADMIN_EMAIL;
}

function initAuth() {
  if (!FIREBASE_CONFIGURED) {
    // In localStorage mode, show admin controls by default (local use)
    currentUser = { email: ADMIN_EMAIL, displayName: 'Admin Local' };
    updateAdminUI();
    return;
  }

  firebase.auth().onAuthStateChanged((user) => {
    currentUser = user;
    updateAdminUI();
    // Re-render active section
    const active = document.querySelector('.nav-link.active');
    if (active) active.click();
  });
}

async function loginAdmin() {
  if (!FIREBASE_CONFIGURED) {
    UI.showToast('Firebase nao configurado. Modo local ativo.', 'info');
    return;
  }

  try {
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    const result = await firebase.auth().signInWithPopup(provider);

    if (result.user.email !== ADMIN_EMAIL) {
      UI.showToast('Sem permissao de edicao. Apenas o administrador pode editar.', 'error');
      await firebase.auth().signOut();
      return false;
    }

    UI.showToast('Login realizado com sucesso!', 'success');
    return true;
  } catch (error) {
    if (error.code !== 'auth/popup-closed-by-user') {
      UI.showToast('Erro ao fazer login: ' + error.message, 'error');
    }
    return false;
  }
}

async function logoutAdmin() {
  if (!FIREBASE_CONFIGURED) return;

  try {
    await firebase.auth().signOut();
    UI.showToast('Logout realizado.', 'info');
  } catch (error) {
    UI.showToast('Erro ao fazer logout: ' + error.message, 'error');
  }
}

function updateAdminUI() {
  const adminElements = document.querySelectorAll('.admin-only');
  const visitorElements = document.querySelectorAll('.visitor-only');
  const adminBtn = document.getElementById('adminLoginBtn');
  const adminInfo = document.getElementById('adminInfo');

  if (isAdmin()) {
    adminElements.forEach(el => el.style.display = '');
    visitorElements.forEach(el => el.style.display = 'none');
    if (adminBtn) adminBtn.style.display = 'none';
    if (adminInfo) {
      adminInfo.style.display = 'flex';
      const emailEl = adminInfo.querySelector('.admin-email');
      if (emailEl) emailEl.textContent = currentUser.email;
    }
  } else {
    adminElements.forEach(el => el.style.display = 'none');
    visitorElements.forEach(el => el.style.display = '');
    if (adminBtn) adminBtn.style.display = '';
    if (adminInfo) adminInfo.style.display = 'none';
  }
}
