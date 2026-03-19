/**
 * Firebase Configuration — AMLabs Gaming Cup
 * Replace PLACEHOLDER values with your Firebase project config.
 */

const firebaseConfig = {
  apiKey: "AIzaSyDvTVmgRVS_0u3-ThhXdUJRe4gkN9Ys3-o",
  authDomain: "amlabs-gaming-cup-df736.firebaseapp.com",
  projectId: "amlabs-gaming-cup-df736",
  storageBucket: "amlabs-gaming-cup-df736.firebasestorage.app",
  messagingSenderId: "554464614822",
  appId: "1:554464614822:web:07647c72d6cb33be04d767"
};

// Detect if Firebase is configured (not placeholder)
const FIREBASE_CONFIGURED = firebaseConfig.apiKey !== 'PLACEHOLDER';

if (FIREBASE_CONFIGURED) {
  firebase.initializeApp(firebaseConfig);
  const db = firebase.firestore();
  const auth = firebase.auth();

  // Enable offline persistence via settings (avoids deprecation warning)
  db.settings({ cacheSizeBytes: firebase.firestore.CACHE_SIZE_UNLIMITED, merge: true });
  db.enablePersistence({ synchronizeTabs: true }).catch(() => {});
} else {
  console.info('[AMLabs Gaming Cup] Firebase not configured. Running in localStorage mode.');
}
