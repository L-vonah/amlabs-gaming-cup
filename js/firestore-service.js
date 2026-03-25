/**
 * Firestore Service — AMLabs Gaming Cup
 * CRUD operations for Firestore with DDD structure.
 * Falls back gracefully when Firebase is not configured.
 */

const CAMPEONATOS_COLLECTION = 'campeonatos';
const AUDIT_COLLECTION = 'auditLog';
const INSCRICOES_COLLECTION = 'inscricoes';

function getInscricoesKey() {
  return STORAGE_PREFIX + 'campeonato_' + getActiveTournamentId() + '_inscricoes_v1';
}

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
      .doc(getActiveTournamentId());

    _firestoreListenerUnsubscribe = docRef.onSnapshot((doc) => {
      if (doc.exists) {
        _firestoreCache = doc.data();
        // Sync to localStorage for visitors; skip for admin to avoid overwriting local writes
        const adminLoggedIn = UI.checkAdmin();
        if (!adminLoggedIn && window.AppState && window.AppState.convertFirestoreToState) {
          const legacyState = window.AppState.convertFirestoreToState(_firestoreCache);
          if (legacyState) {
            localStorage.setItem(getStateKey(), JSON.stringify(legacyState));
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
        .doc(getActiveTournamentId())
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
        .doc(getActiveTournamentId())
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
          torneiId: getActiveTournamentId(),
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
      torneiId: getActiveTournamentId(),
      ...data,
      status: 'pendente',
      criadoEm: new Date().toISOString(),
      device: typeof getDeviceId === 'function' ? getDeviceId() : 'unknown',
      resolvidoEm: null,
      resolvidoPor: null
    };

    if (!FIREBASE_CONFIGURED) {
      entry.id = 'insc_' + Date.now();
      const list = JSON.parse(localStorage.getItem(getInscricoesKey()) || '[]');
      list.push(entry);
      localStorage.setItem(getInscricoesKey(), JSON.stringify(list));
      return entry;
    }

    const docRef = await firebase.firestore().collection(INSCRICOES_COLLECTION).add(entry);
    return { id: docRef.id, ...entry };
  },

  async loadRegistrations() {
    if (!FIREBASE_CONFIGURED) {
      return JSON.parse(localStorage.getItem(getInscricoesKey()) || '[]');
    }

    try {
      const snapshot = await firebase.firestore()
        .collection(INSCRICOES_COLLECTION)
        .where('torneiId', '==', getActiveTournamentId())
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
      const list = JSON.parse(localStorage.getItem(getInscricoesKey()) || '[]');
      const idx = list.findIndex(r => r.id === id);
      if (idx >= 0) Object.assign(list[idx], data);
      localStorage.setItem(getInscricoesKey(), JSON.stringify(list));
      return;
    }

    await firebase.firestore().collection(INSCRICOES_COLLECTION).doc(id).update(data);
  },

  async loadAuditLog() {
    if (!FIREBASE_CONFIGURED) return [];

    try {
      const snapshot = await firebase.firestore()
        .collection(AUDIT_COLLECTION)
        .where('torneiId', '==', getActiveTournamentId())
        .orderBy('timestamp', 'desc')
        .limit(200)
        .get();

      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error('Error loading audit log:', error);
      return [];
    }
  },

  /**
   * List all tournaments ordered by creation date (newest first).
   * Returns lightweight metadata only.
   */
  async listTournaments() {
    if (!FIREBASE_CONFIGURED) return [];
    try {
      const snapshot = await firebase.firestore()
        .collection(CAMPEONATOS_COLLECTION)
        .orderBy('metadata.criadoEm', 'desc')
        .get();
      return snapshot.docs.map(doc => ({
        id: doc.id,
        nome: doc.data().metadata?.nome || 'Campeonato',
        jogo: doc.data().metadata?.jogo || '',
        status: doc.data().metadata?.status || 'configuracao',
        criadoEm: doc.data().metadata?.criadoEm || null
      }));
    } catch (error) {
      console.error('Error listing tournaments:', error);
      return [];
    }
  },

  /**
   * Create a new tournament document in Firestore.
   * Returns the generated UUID on success, null on failure.
   */
  async createTournament({ nome, jogo }) {
    if (!FIREBASE_CONFIGURED || !UI.checkAdmin()) return null;

    const uuid = crypto.randomUUID();
    const now = new Date().toISOString();

    const doc = {
      id: uuid,
      _schemaVersion: 1,
      metadata: {
        nome,
        jogo,
        status: 'configuracao',
        criadoEm: now,
        atualizadoEm: now
      },
      config: {
        formato: 'grupos+playoffs',
        classificadosPorGrupo: 4,
        regrasClassificacao: {
          vitoria: 3,
          empate: 1,
          derrota: 0,
          criteriosDesempate: ['pontos', 'vitorias', 'saldoGols', 'golsMarcados', 'confrontoDireto']
        }
      },
      times: [],
      faseGrupos: { status: 'aguardando', partidas: [] },
      playoffs: { formato: 'double-elim-4', status: 'aguardando', matches: {} },
      campeao: null
    };

    try {
      await firebase.firestore()
        .collection(CAMPEONATOS_COLLECTION)
        .doc(uuid)
        .set(doc);
      return uuid;
    } catch (error) {
      console.error('Error creating tournament:', error);
      return null;
    }
  }
};

window.FirestoreService = FirestoreService;
