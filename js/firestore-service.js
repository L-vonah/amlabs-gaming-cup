/**
 * Firestore Service — AMLabs Gaming Cup
 * CRUD operations for Firestore with DDD structure.
 * Falls back gracefully when Firebase is not configured.
 */

const TOURNAMENT_ID = 'amlabs-2026';
const CAMPEONATOS_COLLECTION = 'campeonatos';
const AUDIT_COLLECTION = 'auditLog';
const INSCRICOES_COLLECTION = 'inscricoes';
const INSCRICOES_LOCAL_KEY = 'campeonato_amlabs_inscricoes_v1';

// Cached tournament data from Firestore listener
let _firestoreCache = null;
let _firestoreListenerUnsubscribe = null;

const FirestoreService = {
  isActive() {
    return FIREBASE_CONFIGURED;
  },

  /**
   * Start listening to tournament changes in real-time.
   */
  startListener(onUpdate) {
    if (!FIREBASE_CONFIGURED) return;

    const docRef = firebase.firestore()
      .collection(CAMPEONATOS_COLLECTION)
      .doc(TOURNAMENT_ID);

    _firestoreListenerUnsubscribe = docRef.onSnapshot((doc) => {
      if (doc.exists) {
        _firestoreCache = doc.data();
        // Sync to localStorage for visitors; skip for admin to avoid overwriting local writes
        const adminLoggedIn = UI.checkAdmin();
        if (!adminLoggedIn && window.AppState && window.AppState.convertFirestoreToState) {
          const legacyState = window.AppState.convertFirestoreToState(_firestoreCache);
          if (legacyState) {
            localStorage.setItem('campeonato_amlabs_v1', JSON.stringify(legacyState));
            if (window.AppState.invalidateCache) window.AppState.invalidateCache();
          }
        }
      } else {
        _firestoreCache = null;
      }
      if (onUpdate) onUpdate(_firestoreCache);
    }, (error) => {
      console.error('Firestore listener error:', error);
      if (typeof UI !== 'undefined') {
        UI.showToast('Erro de conexão com o servidor. Usando dados locais.', 'error');
      }
    });
  },

  /**
   * Load tournament data. Returns cached Firestore data or fetches once.
   */
  async loadTournament() {
    if (!FIREBASE_CONFIGURED) return null;

    if (_firestoreCache) return _firestoreCache;

    try {
      const doc = await firebase.firestore()
        .collection(CAMPEONATOS_COLLECTION)
        .doc(TOURNAMENT_ID)
        .get();

      if (doc.exists) {
        _firestoreCache = doc.data();
        return _firestoreCache;
      }
      return null;
    } catch (error) {
      console.error('Error loading tournament:', error);
      return null;
    }
  },

  getCachedData() {
    return _firestoreCache;
  },

  /**
   * Save full tournament state to Firestore. Only works if admin.
   */
  async saveTournament(data) {
    if (!FIREBASE_CONFIGURED || !UI.checkAdmin()) return false;

    try {
      data.metadata = data.metadata || {};
      data.metadata.atualizadoEm = new Date().toISOString();

      await firebase.firestore()
        .collection(CAMPEONATOS_COLLECTION)
        .doc(TOURNAMENT_ID)
        .set(data, { merge: false });

      return true;
    } catch (error) {
      console.error('Error saving tournament:', error);
      return false;
    }
  },

  /**
   * Add audit log entry to Firestore.
   */
  async addAuditLog(action, details) {
    if (!FIREBASE_CONFIGURED) return;

    try {
      await firebase.firestore()
        .collection(AUDIT_COLLECTION)
        .add({
          torneiId: TOURNAMENT_ID,
          usuario: currentUser ? currentUser.email : 'unknown',
          acao: action,
          detalhes: details || null,
          timestamp: new Date().toISOString(),
          device: getDeviceId()
        });
    } catch (error) {
      console.error('Error adding audit log:', error);
    }
  },

  // ----- Registration (Inscricoes) -----

  async submitRegistration(data) {
    const entry = {
      torneiId: TOURNAMENT_ID,
      ...data,
      status: 'pendente',
      criadoEm: new Date().toISOString(),
      device: typeof getDeviceId === 'function' ? getDeviceId() : 'unknown',
      resolvidoEm: null,
      resolvidoPor: null
    };

    if (!FIREBASE_CONFIGURED) {
      entry.id = 'insc_' + Date.now();
      const list = JSON.parse(localStorage.getItem(INSCRICOES_LOCAL_KEY) || '[]');
      list.push(entry);
      localStorage.setItem(INSCRICOES_LOCAL_KEY, JSON.stringify(list));
      return entry;
    }

    const docRef = await firebase.firestore().collection(INSCRICOES_COLLECTION).add(entry);
    return { id: docRef.id, ...entry };
  },

  async loadRegistrations() {
    if (!FIREBASE_CONFIGURED) {
      return JSON.parse(localStorage.getItem(INSCRICOES_LOCAL_KEY) || '[]');
    }

    try {
      const snapshot = await firebase.firestore()
        .collection(INSCRICOES_COLLECTION)
        .where('torneiId', '==', TOURNAMENT_ID)
        .orderBy('criadoEm', 'desc')
        .get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error('Error loading registrations:', error);
      return [];
    }
  },

  async updateRegistration(id, data) {
    if (!FIREBASE_CONFIGURED) {
      const list = JSON.parse(localStorage.getItem(INSCRICOES_LOCAL_KEY) || '[]');
      const idx = list.findIndex(r => r.id === id);
      if (idx >= 0) Object.assign(list[idx], data);
      localStorage.setItem(INSCRICOES_LOCAL_KEY, JSON.stringify(list));
      return;
    }

    await firebase.firestore().collection(INSCRICOES_COLLECTION).doc(id).update(data);
  },

  async loadAuditLog() {
    if (!FIREBASE_CONFIGURED) return [];

    try {
      const snapshot = await firebase.firestore()
        .collection(AUDIT_COLLECTION)
        .where('torneiId', '==', TOURNAMENT_ID)
        .orderBy('timestamp', 'desc')
        .limit(200)
        .get();

      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error('Error loading audit log:', error);
      return [];
    }
  }
};

window.FirestoreService = FirestoreService;
