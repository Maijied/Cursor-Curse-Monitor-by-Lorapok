import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDNPHWuLozMLFfd_J15b6byCdaINd_g4PQ",
  authDomain: "cursor-curse-by-lorapok.firebaseapp.com",
  projectId: "cursor-curse-by-lorapok",
  storageBucket: "cursor-curse-by-lorapok.firebasestorage.app",
  messagingSenderId: "437750136123",
  appId: "1:437750136123:web:763af6cfc198cc5ef38b1e",
  measurementId: "G-ZK619CZWHM"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
