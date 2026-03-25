/**
 * Firestore Service — Campeonatos AMLabs
 * CRUD operations for Firestore. Single source of truth — no localStorage.
 */

const CAMPEONATOS_COLLECTION = 'campeonatos';
const AUDIT_COLLECTION = 'auditLog';
const INSCRICOES_COLLECTION = 'inscricoes';

// Cached tournament data from Firestore listener
let _firestoreCache = null;
let _firestoreListenerUnsubscribe = null;

const FirestoreService = {
  isActive() {
    return FIREBASE_CONFIGURED;
  },

  /**
   * Start real-time listener. Returns a Promise that resolves on first snapshot.
   * Subsequent snapshots trigger onUpdate callback and feed AppState cache.
   */
  startListener(onUpdate) {
    if (!FIREBASE_CONFIGURED) return Promise.reject(new Error('Firebase not configured'));

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Timeout loading tournament data')), 10000);
      let firstSnapshot = true;

      const docRef = firebase.firestore()
        .collection(CAMPEONATOS_COLLECTION)
        .doc(getActiveTournamentId());

      _firestoreListenerUnsubscribe = docRef.onSnapshot((doc) => {
        if (doc.exists) {
          _firestoreCache = doc.data();
          if (window.AppState && window.AppState.feedFromFirestore) {
            window.AppState.feedFromFirestore(_firestoreCache);
          }
        } else {
          _firestoreCache = null;
        }

        if (firstSnapshot) {
          firstSnapshot = false;
          clearTimeout(timeout);
          if (doc.exists) {
            resolve(_firestoreCache);
          } else {
            reject(new Error('Tournament not found'));
          }
        }

        if (onUpdate) onUpdate(_firestoreCache);
      }, (error) => {
        console.error('Firestore listener error:', error);
        if (firstSnapshot) {
          firstSnapshot = false;
          clearTimeout(timeout);
          reject(error);
        }
        if (onUpdate) onUpdate(null, error);
      });
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
    if (!FIREBASE_CONFIGURED) return null;

    const entry = {
      torneiId: getActiveTournamentId(),
      ...data,
      status: 'pendente',
      criadoEm: new Date().toISOString(),
      device: typeof getDeviceId === 'function' ? getDeviceId() : 'unknown',
      resolvidoEm: null,
      resolvidoPor: null
    };

    const docRef = await firebase.firestore().collection(INSCRICOES_COLLECTION).add(entry);
    return { id: docRef.id, ...entry };
  },

  async loadRegistrations() {
    if (!FIREBASE_CONFIGURED) return [];

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
    if (!FIREBASE_CONFIGURED) return;
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
