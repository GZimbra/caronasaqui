const DEFAULT_FIREBASE_CONFIG = {
  apiKey: "AIzaSyCxpm0fU6_6Fr_6-S5G84fv-bCSoA03mfM",
  authDomain: "caronas-aqui.firebaseapp.com",
  projectId: "caronas-aqui",
  storageBucket: "caronas-aqui.firebasestorage.app",
  messagingSenderId: "204868828602",
  appId: "1:204868828602:web:f485d726b2db297d5c3183",
};

const firebaseConfig = window.CARONAS_FIREBASE_CONFIG || DEFAULT_FIREBASE_CONFIG;

if (!firebaseConfig?.apiKey || !firebaseConfig?.projectId) {
  throw new Error("Firebase config ausente ou invalida.");
}

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();
const storage = firebase.storage();
