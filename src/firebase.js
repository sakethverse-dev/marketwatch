import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDjjYRSiYl8YJZXN_k_dYZZbs2Kq9beGIc",
  authDomain: "haptic-1d9d4.firebaseapp.com",
  projectId: "haptic-1d9d4",
  storageBucket: "haptic-1d9d4.firebasestorage.app",
  messagingSenderId: "810632720888",
  appId: "1:810632720888:web:707df552993869d6b1e60d",
  measurementId: "G-TED88Z46B0"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);

export { auth, db };
