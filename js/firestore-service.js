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

/**
 * Creates a DDD-structured tournament template.
 */
function createTournamentTemplate(name) {
  return {
    id: TOURNAMENT_ID,
    metadata: {
      nome: name || '1\u00BA Campeonato FC Football AMLabs 2026',
      jogo: 'FC Football',
      ano: 2026,
      status: 'configuracao',
      criadoEm: new Date().toISOString(),
      atualizadoEm: new Date().toISOString()
    },
    config: {
      formato: 'grupos+playoffs',
      regrasClassificacao: {
        vitoria: 3,
        empate: 1,
        derrota: 0,
        criteriosDesempate: ['pontos', 'saldoGols', 'golsPro', 'confrontoDireto']
      },
      vantagemFinal: {
        tipo: 'potes',
        descricao: 'Chave superior escolhe pote alto, inferior escolhe pote baixo'
      },
      potes: { alto: [], baixo: [] }
    },
    times: [],
    fases: [],
    campeao: null
  };
}

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
      } else {
        _firestoreCache = null;
      }
      if (onUpdate) onUpdate(_firestoreCache);
    }, (error) => {
      console.error('Firestore listener error:', error);
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
    if (!FIREBASE_CONFIGURED || !isAdmin()) return false;

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
   * Initialize tournament document if it does not exist.
   */
  async initTournament(name) {
    if (!FIREBASE_CONFIGURED || !isAdmin()) return false;

    try {
      const docRef = firebase.firestore()
        .collection(CAMPEONATOS_COLLECTION)
        .doc(TOURNAMENT_ID);

      const doc = await docRef.get();
      if (!doc.exists) {
        await docRef.set(createTournamentTemplate(name));
      }
      return true;
    } catch (error) {
      console.error('Error initializing tournament:', error);
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

  /**
   * Load audit log entries for this tournament.
   */
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
