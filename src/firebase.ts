import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
// @ts-ignore - JSON module resolution
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig as any);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth();
