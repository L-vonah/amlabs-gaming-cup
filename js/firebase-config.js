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

  // Enable offline persistence (Option B)
  db.enablePersistence({ synchronizeTabs: true }).catch((err) => {
    if (err.code === 'failed-precondition') {
      console.warn('Firestore persistence: multiple tabs open, only one can enable.');
    } else if (err.code === 'unimplemented') {
      console.warn('Firestore persistence not supported in this browser.');
    }
  });
} else {
  console.info('[AMLabs Gaming Cup] Firebase not configured. Running in localStorage mode.');
}
