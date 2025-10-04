import { Provider } from '@nestjs/common';
import * as admin from 'firebase-admin';
import * as path from 'path';

// Initialize Firebase Admin immediately when module loads
const serviceAccountPath = path.join(process.cwd(), 'firebase-keys.json');
console.log('🔥 Loading Firebase credentials from:', serviceAccountPath);

try {
  const serviceAccount = require(serviceAccountPath);
  console.log('✅ Firebase credentials loaded for project:', serviceAccount.project_id);
  
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log('✅ Firebase Admin initialized successfully');
  }
} catch (error) {
  console.error('❌ Failed to initialize Firebase Admin:', error);
  throw error;
}

export const FirebaseAdminProvider: Provider = {
  provide: 'FIREBASE_ADMIN',
  useFactory: () => {
    return admin;
  },
};
