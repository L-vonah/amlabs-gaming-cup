/**
 * Firebase Configuration — AMLabs Gaming Cup
 * Replace PLACEHOLDER values with your Firebase project config.
 */

const firebaseConfig = {
  apiKey: "PLACEHOLDER",
  authDomain: "PLACEHOLDER.firebaseapp.com",
  projectId: "PLACEHOLDER",
  storageBucket: "PLACEHOLDER.appspot.com",
  messagingSenderId: "PLACEHOLDER",
  appId: "PLACEHOLDER"
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
