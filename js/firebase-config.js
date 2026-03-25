/**
 * Firebase Configuration — AMLabs Gaming Cup
 * Selects production or development project based on APP_ENV (set by env.js).
 */

const FIREBASE_CONFIGS = {
  production: {
    apiKey: "AIzaSyDvTVmgRVS_0u3-ThhXdUJRe4gkN9Ys3-o",
    authDomain: "amlabs-gaming-cup-df736.firebaseapp.com",
    projectId: "amlabs-gaming-cup-df736",
    storageBucket: "amlabs-gaming-cup-df736.firebasestorage.app",
    messagingSenderId: "554464614822",
    appId: "1:554464614822:web:07647c72d6cb33be04d767"
  },
  development: {
    apiKey: "AIzaSyA7lxhScgr1IcGhhZNCcW3bGAvszs40D-c",
    authDomain: "amlabs-gaming-cup-dev.firebaseapp.com",
    projectId: "amlabs-gaming-cup-dev",
    storageBucket: "amlabs-gaming-cup-dev.firebasestorage.app",
    messagingSenderId: "5643738291",
    appId: "1:5643738291:web:a88ef530cb8e588acca4c6"
  }
};

const firebaseConfig = IS_PROD
  ? FIREBASE_CONFIGS.production
  : FIREBASE_CONFIGS.development;

// Detect if Firebase is configured (not placeholder)
const FIREBASE_CONFIGURED = true;

if (FIREBASE_CONFIGURED) {
  firebase.initializeApp(firebaseConfig);
  const db = firebase.firestore();
  const auth = firebase.auth();

  db.settings({ cacheSizeBytes: firebase.firestore.CACHE_SIZE_UNLIMITED, merge: true });
  db.enablePersistence({ synchronizeTabs: true }).catch(() => {});
} else {
  console.info('[AMLabs Gaming Cup] Firebase not configured. Running in localStorage mode.');
}
