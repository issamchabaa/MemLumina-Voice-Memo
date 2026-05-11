import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";

// Replace with actual config
const firebaseConfig = {
  apiKey: "AIzaSyCg8zsClXgKzsgtw7mX5n99vS1Ne8eewa8",
  authDomain: "sheep-db1.firebaseapp.com",
  projectId: "sheep-db1",
  storageBucket: "sheep-db1.firebasestorage.app",
  messagingSenderId: "31297412046",
  appId: "1:31297412046:web:6f86d08263c262a907299f"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app);
