import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBEyqUrS5LaV2p2PUf4W5deWR_3adPQ5Ts",
  authDomain: "queue-project1.firebaseapp.com",
  projectId: "queue-project1",
  storageBucket: "queue-project1.firebasestorage.app",
  messagingSenderId: "812777303003",
  appId: "1:812777303003:web:66b7c85484045578dd95fe",
  measurementId: "G-Y5Y16987RE",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
