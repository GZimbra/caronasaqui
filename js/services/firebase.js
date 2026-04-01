// ⚠️ SEGURANÇA: Restrinja esta API key no console do Firebase:
// https://console.firebase.google.com → Configurações do projeto → Credenciais da API
// Em "Restrições de aplicativo" selecione "Referenciadores HTTP" e adicione seu domínio.
// Em "Restrições de API" selecione apenas: Cloud Firestore API, Firebase Auth API, Firebase Storage.

const firebaseConfig = {
  apiKey: "AIzaSyCxpm0fU6_6Fr_6-S5G84fv-bCSoA03mfM",
  authDomain: "caronas-aqui.firebaseapp.com",
  projectId: "caronas-aqui",
  storageBucket: "caronas-aqui.firebasestorage.app",
  messagingSenderId: "204868828602",
  appId: "1:204868828602:web:f485d726b2db297d5c3183"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();
const storage = firebase.storage();