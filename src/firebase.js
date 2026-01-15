import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyDcNyxUTdc-EhVEM7-XLEOftvMjUPnzkxM",
  authDomain: "eongroup-crm.firebaseapp.com",
  projectId: "eongroup-crm",
  storageBucket: "eongroup-crm.firebasestorage.app",
  messagingSenderId: "383510284907",
  appId: "1:383510284907:web:2eb38df02ee1eeb8bbbf2e"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const auth = getAuth(app);

// Segunda instancia de Firebase para crear usuarios sin afectar la sesión actual
const secondaryApp = initializeApp(firebaseConfig, 'secondary');
export const secondaryAuth = getAuth(secondaryApp);
