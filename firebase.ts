
import { initializeApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
import { getFirestore, Firestore } from "firebase/firestore";

// ============================================================================
// FIREBASE CONFIGURATION
// ============================================================================

const firebaseConfig = {
  apiKey: "AIzaSyBMrJBmbiGpnevUIXK88SeTrbhSjAaejV0",
  authDomain: "quizzy-app-7b2ed.firebaseapp.com",
  projectId: "quizzy-app-7b2ed",
  storageBucket: "quizzy-app-7b2ed.firebasestorage.app",
  messagingSenderId: "805021386230",
  appId: "1:805021386230:web:0e023e6893ca523acdf3d7"
};

// ============================================================================
// INITIALIZATION LOGIC
// ============================================================================

let app;
let auth: Auth | undefined;
let db: Firestore | undefined;

try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  console.log("Firebase initialized successfully");
} catch (error) {
  console.error("Firebase Initialization Error:", error);
}

export { auth, db };