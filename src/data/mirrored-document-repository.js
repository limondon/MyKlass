function clone(value) {
  return value == null ? value : structuredClone(value);
}

function revisionOf(snapshot) {
  return Number(snapshot?._sync?.revision || 0);
}

export function createMirroredDocumentRepository({
  localRepository,
  remote,
  onStatus = () => {},
}) {
  if (!localRepository || !remote) {
    throw new Error('localRepository and remote are required');
  }

  let localSerialized = JSON.stringify(localRepository.getSnapshot());
  let remoteUnsubscribe = null;
  let remoteReady = false;
  let remoteRevision = 0;
  let pendingSnapshot = null;
  let syncInFlight = false;
  const subscribers = new Set();

  const publish = (snapshot) => {
    subscribers.forEach((subscriber) => subscriber(clone(snapshot)));
  };

  const applyRemoteSnapshot = (snapshot, status = 'connected') => {
    remoteRevision = revisionOf(snapshot);
    const serialized = JSON.stringify(snapshot);
    localSerialized = serialized;
    localRepository.save(snapshot);
    publish(snapshot);
    onStatus({
      state: status,
      revision: remoteRevision,
      savedAt: snapshot?._sync?.updatedAt || null,
      updatedBy: snapshot?._sync?.updatedBy || null,
    });
  };

  const handleConflict = (error) => {
    pendingSnapshot = null;
    syncInFlight = false;
    if (error?.serverSnapshot) {
      applyRemoteSnapshot(error.serverSnapshot, 'conflict');
      return;
    }
    onStatus({ state: 'error', error });
  };

  const drain = () => {
    if (!remoteReady || syncInFlight || !pendingSnapshot) return;

    const snapshot = {
      ...pendingSnapshot,
      ...(remoteRevision
        ? {
            _sync: {
              ...(pendingSnapshot._sync || {}),
              revision: remoteRevision,
            },
          }
        : {}),
    };
    pendingSnapshot = null;
    syncInFlight = true;
    onStatus({ state: 'syncing', revision: remoteRevision });

    Promise.resolve(
      remote.save(snapshot, { expectedRevision: remoteRevision }),
    )
      .then((savedRemoteSnapshot) => {
        syncInFlight = false;
        remoteRevision = revisionOf(savedRemoteSnapshot);

        if (pendingSnapshot) {
          const current = localRepository.getSnapshot();
          localRepository.save({
            ...current,
            _sync: clone(savedRemoteSnapshot._sync),
          });
          drain();
          return;
        }

        localSerialized = JSON.stringify(savedRemoteSnapshot);
        localRepository.save(savedRemoteSnapshot);
        onStatus({
          state: 'connected',
          revision: remoteRevision,
          savedAt: savedRemoteSnapshot?._sync?.updatedAt || Date.now(),
          updatedBy: savedRemoteSnapshot?._sync?.updatedBy || null,
        });
      })
      .catch((error) => {
        if (error?.code === 'sync/conflict') {
          handleConflict(error);
          return;
        }
        pendingSnapshot = snapshot;
        syncInFlight = false;
        onStatus({ state: 'error', error, revision: remoteRevision });
      });
  };

  const connect = () => {
    if (remoteUnsubscribe) return;
    onStatus({ state: 'connecting' });
    remoteUnsubscribe = remote.subscribe(
      (remoteSnapshot) => {
        if (remoteSnapshot == null) {
          remoteReady = true;
          remoteRevision = 0;
          pendingSnapshot =
            pendingSnapshot ?? localRepository.getSnapshot();
          if (pendingSnapshot != null) drain();
          else onStatus({ state: 'connected', revision: 0 });
          return;
        }

        const incomingRevision = revisionOf(remoteSnapshot);
        if (!remoteReady) {
          remoteReady = true;
          pendingSnapshot = null;
          syncInFlight = false;
          applyRemoteSnapshot(remoteSnapshot);
          return;
        }

        if (incomingRevision <= remoteRevision) return;

        if (
          syncInFlight &&
          remoteSnapshot?._sync?.clientId === remote.clientId
        ) {
          remoteRevision = incomingRevision;
          return;
        }

        if (syncInFlight || pendingSnapshot) {
          pendingSnapshot = null;
          syncInFlight = false;
          applyRemoteSnapshot(remoteSnapshot, 'conflict');
          return;
        }

        const serialized = JSON.stringify(remoteSnapshot);
        if (serialized === localSerialized) {
          remoteRevision = incomingRevision;
          return;
        }
        applyRemoteSnapshot(remoteSnapshot);
      },
      (error) => onStatus({ state: 'error', error }),
    );
  };

  connect();

  return {
    kind: 'firebase',
    storage: localRepository.storage,
    key: localRepository.key,

    getSnapshot() {
      return localRepository.getSnapshot();
    },

    save(snapshot) {
      const saved = localRepository.save(snapshot);
      localSerialized = JSON.stringify(saved);
      pendingSnapshot = saved;
      if (!remoteReady) {
        onStatus({ state: 'waiting-for-remote' });
        return saved;
      }
      drain();
      return saved;
    },

    retry() {
      drain();
    },

    subscribe(subscriber) {
      subscribers.add(subscriber);
      return () => subscribers.delete(subscriber);
    },

    destroy() {
      remoteUnsubscribe?.();
      remoteUnsubscribe = null;
      subscribers.clear();
    },
  };
}
