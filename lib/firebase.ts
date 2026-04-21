import { initializeApp, getApps } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyB6rsnYkxTBnqBpqKq3YQl6Z6e-YF1LGQU",
  authDomain: "air-jen.firebaseapp.com",
  databaseURL: "https://air-jen-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "air-jen",
  storageBucket: "air-jen.firebasestorage.app",
  messagingSenderId: "52012600847",
  appId: "1:52012600847:web:8aa04b7016389f81265d7a",
  measurementId: "G-Q4ZHHZBS1H",
};

// Prevent duplicate initialization in Next.js dev mode
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const db = getDatabase(app);
