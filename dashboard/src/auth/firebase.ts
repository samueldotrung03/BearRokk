// Firebase project "Bearok". These values identify the project to Google; they are not secrets
// and are meant to ship in the page.
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const app = initializeApp({
  apiKey: 'AIzaSyC_fyQBWuZVtDv3FlTb5am37MKnqPsFMmo',
  authDomain: 'bearok-ef3fa.firebaseapp.com',
  projectId: 'bearok-ef3fa',
  appId: '1:757878768633:web:7672529b2231577705f328',
});

export const auth = getAuth(app);

/** Where the agent backend runs. Set VITE_API_URL to point somewhere other than this machine. */
export const API_URL: string = import.meta.env.VITE_API_URL ?? 'http://localhost:8787';
