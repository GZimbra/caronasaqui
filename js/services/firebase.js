const firebaseConfig = window.CARONAS_FIREBASE_CONFIG;

if (!firebaseConfig?.apiKey || !firebaseConfig?.projectId) {
  throw new Error("Firebase config ausente. Crie js/config/firebase-config.js a partir de firebase-config.example.js.");
}

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();
const storage = firebase.storage();
