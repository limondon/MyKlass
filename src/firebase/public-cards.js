import { getFirebaseApp } from './app.js';

async function getDatabaseContext(firebaseConfig) {
  const [app, sdk] = await Promise.all([
    getFirebaseApp(firebaseConfig),
    import('firebase/database'),
  ]);
  return { sdk, database: sdk.getDatabase(app) };
}

export async function publishPublicParentCard({
  firebaseConfig,
  token,
  card,
  waitForAccess,
}) {
  await waitForAccess();
  const { sdk, database } = await getDatabaseContext(firebaseConfig);
  await sdk.set(sdk.ref(database, `publicCards/${token}`), card);
}

export async function readPublicParentCard({ firebaseConfig, token }) {
  const { sdk, database } = await getDatabaseContext(firebaseConfig);
  const snapshot = await sdk.get(
    sdk.ref(database, `publicCards/${token}`),
  );
  return snapshot.exists() ? snapshot.val() : null;
}

export async function revokePublicParentCard({
  firebaseConfig,
  token,
  waitForAccess,
}) {
  await waitForAccess();
  const { sdk, database } = await getDatabaseContext(firebaseConfig);
  await sdk.remove(sdk.ref(database, `publicCards/${token}`));
}
