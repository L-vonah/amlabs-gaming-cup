/**
 * Firestore Service — Campeonatos AMLabs
 * CRUD operations for Firestore. Single source of truth — no localStorage.
 */

const CAMPEONATOS_COLLECTION = 'campeonatos';
const AUDIT_COLLECTION = 'auditLog';
const INSCRICOES_COLLECTION = 'inscricoes';
const DELETE_BATCH_SIZE = 200;

// Cached tournament data from Firestore listener
let _firestoreCache = null;
let _firestoreListenerUnsubscribe = null;

async function deleteQueryInChunks(query, onProgress) {
  let deleted = 0;

  while (true) {
    const snapshot = await query.limit(DELETE_BATCH_SIZE).get();
    if (snapshot.empty) break;

    const batch = firebase.firestore().batch();
    snapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();

    deleted += snapshot.size;
    if (onProgress) onProgress(deleted);
  }

  return deleted;
}

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

    const participant = typeof data.participante === 'string'
      ? data.participante.trim().replace(/\s+/g, ' ')
      : '';
    const nome = typeof data.nome === 'string'
      ? data.nome.trim().replace(/\s+/g, ' ')
      : null;
    const abreviacao = typeof data.abreviacao === 'string'
      ? data.abreviacao.replace(/[^A-Za-z]/g, '').toUpperCase().slice(0, 3)
      : null;
    const cor = typeof data.cor === 'string' && /^#[0-9A-Fa-f]{6}$/.test(data.cor)
      ? data.cor
      : null;

    const entry = {
      torneiId: getActiveTournamentId(),
      participante: participant,
      nome,
      abreviacao,
      cor,
      status: 'pendente',
      criadoEm: new Date().toISOString(),
      device: typeof getDeviceId === 'function' ? getDeviceId() : 'PC-UNKNOWN',
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

  async clearAllRegistrations() {
    if (!FIREBASE_CONFIGURED) return;
    const query = firebase.firestore()
      .collection(INSCRICOES_COLLECTION)
      .where('torneiId', '==', getActiveTournamentId());
    await deleteQueryInChunks(query);
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
      return snapshot.docs.map(doc => {
        const data = doc.data();
        const times = data.times || [];
        const campeaoRaw = data.campeao || null;
        // campeaoRaw may be a team ID (legacy) or already a name (new saves)
        const campeaoTime = campeaoRaw ? times.find(t => t.id === campeaoRaw) : null;
        const campeao = campeaoTime ? campeaoTime.nome : campeaoRaw;
        return {
          id: doc.id,
          nome: data.metadata?.nome || 'Campeonato',
          gameType: data.metadata?.gameType || 'futebol-virtual',
          teamMode: data.metadata?.teamMode || 'individual',
          status: data.metadata?.status || 'configuracao',
          criadoEm: data.metadata?.criadoEm || null,
          timesCount: times.length,
          campeao
        };
      });
    } catch (error) {
      console.error('Error listing tournaments:', error);
      return [];
    }
  },

  /**
   * Create a new tournament document in Firestore.
   */
  async createTournament({ nome, gameType, teamMode = 'individual' }) {
    if (!FIREBASE_CONFIGURED || !UI.checkAdmin()) return null;

    const gt = getGameType(gameType);
    const uuid = crypto.randomUUID();
    const now = new Date().toISOString();

    const doc = {
      id: uuid,
      _schemaVersion: 3,
      metadata: {
        nome,
        gameType: gt.id,
        teamMode,
        status: 'configuracao',
        criadoEm: now,
        atualizadoEm: now
      },
      config: {
        classificadosPorGrupo: 4
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
  },

  /**
   * Permanently delete a tournament and all its related data.
   * Cleans: campeonatos/{uuid}, inscricoes (by torneiId), auditLog (by torneiId).
   */
  async deleteTournament(uuid, onProgress) {
    if (!FIREBASE_CONFIGURED || !UI.checkAdmin()) return false;

    try {
      const db = firebase.firestore();
      const report = (stage, deletedCount) => {
        if (typeof onProgress === 'function') {
          onProgress({ stage, deletedCount });
        }
      };

      report('inscricoes', 0);
      await deleteQueryInChunks(
        db.collection(INSCRICOES_COLLECTION).where('torneiId', '==', uuid),
        count => report('inscricoes', count)
      );

      report('auditLog', 0);
      await deleteQueryInChunks(
        db.collection(AUDIT_COLLECTION).where('torneiId', '==', uuid),
        count => report('auditLog', count)
      );

      await db.collection(CAMPEONATOS_COLLECTION).doc(uuid).delete();
      report('campeonato', 1);
      return true;
    } catch (error) {
      console.error('Error deleting tournament:', error);
      return false;
    }
  }
};

window.FirestoreService = FirestoreService;
