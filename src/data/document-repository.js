function clone(value) {
  return value == null ? value : structuredClone(value);
}

export function createLocalDocumentRepository({
  storage,
  key,
  eventTarget = globalThis,
}) {
  if (!storage || !key) {
    throw new Error('storage and key are required');
  }

  const subscribers = new Set();

  return {
    kind: 'local',
    storage,
    key,

    getSnapshot() {
      try {
        const raw = storage.getItem(key);
        return raw ? JSON.parse(raw) : null;
      } catch {
        return null;
      }
    },

    save(snapshot) {
      storage.setItem(key, JSON.stringify(snapshot));
      return clone(snapshot);
    },

    subscribe(subscriber) {
      subscribers.add(subscriber);
      const onStorage = (event) => {
        if (event.storageArea !== storage || event.key !== key || !event.newValue) {
          return;
        }
        try {
          subscriber(JSON.parse(event.newValue));
        } catch {
          // Ignore incomplete or invalid external writes.
        }
      };
      eventTarget?.addEventListener?.('storage', onStorage);
      return () => {
        subscribers.delete(subscriber);
        eventTarget?.removeEventListener?.('storage', onStorage);
      };
    },
  };
}

export function createMemoryDocumentRepository(initialSnapshot = null) {
  let snapshot = clone(initialSnapshot);
  const subscribers = new Set();

  return {
    kind: 'memory',

    getSnapshot() {
      return clone(snapshot);
    },

    save(nextSnapshot) {
      snapshot = clone(nextSnapshot);
      return clone(snapshot);
    },

    publish(nextSnapshot) {
      snapshot = clone(nextSnapshot);
      subscribers.forEach((subscriber) => subscriber(clone(snapshot)));
    },

    subscribe(subscriber) {
      subscribers.add(subscriber);
      return () => subscribers.delete(subscriber);
    },
  };
}
