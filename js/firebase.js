import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";

import {
  getAuth
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
  getFirestore
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBZehAJk3lMWsOAwrG4-qT24_abBIfGJHs",
  authDomain: "reparo-v1.firebaseapp.com",
  projectId: "reparo-v1",
  storageBucket: "reparo-v1.firebasestorage.app",
  messagingSenderId: "830095721173",
  appId: "1:830095721173:web:c5e670fbc94e7cc42b185c"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;
