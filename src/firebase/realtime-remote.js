import { getFirebaseApp } from './app.js';

export function createFirebaseRealtimeRemote({
  firebaseConfig,
  databasePath,
  waitForAccess = () => Promise.resolve(),
}) {
  let referencePromise;
  const clientId =
    globalThis.crypto?.randomUUID?.() ||
    `client-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const getReference = async () => {
    if (!referencePromise) {
      referencePromise = Promise.all([
        getFirebaseApp(firebaseConfig),
        import('firebase/database'),
        waitForAccess(),
      ]).then(([app, databaseSdk, user]) => {
        const database = databaseSdk.getDatabase(app);
        return {
          databaseSdk,
          documentRef: databaseSdk.ref(database, databasePath),
          user,
        };
      });
    }
    return referencePromise;
  };

  return {
    clientId,

    async save(snapshot, { expectedRevision = 0 } = {}) {
      const { databaseSdk, documentRef, user } = await getReference();
      const result = await databaseSdk.runTransaction(
        documentRef,
        (current) => {
          const currentRevision = Number(current?._sync?.revision || 0);
          if (currentRevision !== expectedRevision) return;
          return {
            ...snapshot,
            _sync: {
              revision: currentRevision + 1,
              updatedAt: Date.now(),
              updatedBy: user?.email || '',
              clientId,
            },
          };
        },
        { applyLocally: false },
      );

      if (!result.committed) {
        const error = new Error(
          'Данные были изменены на другом устройстве',
        );
        error.code = 'sync/conflict';
        error.serverSnapshot = result.snapshot.val();
        throw error;
      }

      return result.snapshot.val();
    },

    subscribe(onSnapshot, onError) {
      let active = true;
      let unsubscribe = null;

      getReference()
        .then(({ databaseSdk, documentRef }) => {
          if (!active) return;
          unsubscribe = databaseSdk.onValue(
            documentRef,
            (snapshot) =>
              onSnapshot(snapshot.exists() ? snapshot.val() : null),
            onError,
          );
        })
        .catch(onError);

      return () => {
        active = false;
        unsubscribe?.();
      };
    },
  };
}
