// One Firebase Admin app for the whole backend: used to verify sign-in tokens and for Firestore.
import { readFileSync } from 'node:fs';
import { cert, initializeApp, type App } from 'firebase-admin/app';
import { config } from './config.ts';

let app: App | null | undefined;

/** Null when neither a service account nor a project id is configured. */
export function firebaseApp(): App | null {
  if (app !== undefined) return app;
  if (config.firebaseServiceAccount) {
    app = initializeApp({ credential: cert(JSON.parse(readFileSync(config.firebaseServiceAccount, 'utf8'))) });
  } else if (config.firebaseWeb.projectId) {
    // Verifying sign-in tokens only needs the project id.
    app = initializeApp({ projectId: config.firebaseWeb.projectId });
  } else {
    app = null;
  }
  return app;
}
