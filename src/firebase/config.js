export function readFirebaseConfig(env = import.meta.env) {
  return {
    apiKey: env.VITE_FIREBASE_API_KEY || '',
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || '',
    projectId: env.VITE_FIREBASE_PROJECT_ID || '',
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || '',
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
    appId: env.VITE_FIREBASE_APP_ID || '',
    measurementId: env.VITE_FIREBASE_MEASUREMENT_ID || '',
    databaseURL: env.VITE_FIREBASE_DATABASE_URL || '',
  };
}

export function getFirebaseRuntimeConfig(env = import.meta.env) {
  const firebase = readFirebaseConfig(env);
  const requested =
    String(env.VITE_DATA_REPOSITORY || 'local').toLowerCase() === 'firebase';
  const allowedEmails = String(env.VITE_FIREBASE_ALLOWED_EMAILS || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  const missing = [
    ['apiKey', firebase.apiKey],
    ['authDomain', firebase.authDomain],
    ['projectId', firebase.projectId],
    ['appId', firebase.appId],
    ['databaseURL', firebase.databaseURL],
    ['allowedEmails', allowedEmails.length],
  ]
    .filter(([, value]) => !value)
    .map(([field]) => field);

  return {
    requested,
    enabled: requested && missing.length === 0,
    firebase,
    databasePath:
      String(env.VITE_FIREBASE_DATABASE_PATH || 'workspaces/default')
        .replace(/^\/+|\/+$/g, ''),
    allowedEmails,
    missing,
    reason: requested && missing.length
      ? `Firebase disabled: missing ${missing.join(', ')}`
      : null,
  };
}
