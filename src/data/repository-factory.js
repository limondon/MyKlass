import { getFirebaseRuntimeConfig } from '../firebase/config.js';
import { createFirebaseRealtimeRemote } from '../firebase/realtime-remote.js';
import { createLocalDocumentRepository } from './document-repository.js';
import { createMirroredDocumentRepository } from './mirrored-document-repository.js';

export function createDataRepository({
  storage,
  key,
  env = import.meta.env,
  eventTarget = globalThis,
  waitForAccess,
  onStatus = () => {},
}) {
  const localRepository = createLocalDocumentRepository({
    storage,
    key,
    eventTarget,
  });
  const runtime = getFirebaseRuntimeConfig(env);

  if (!runtime.enabled) {
    onStatus({
      state: 'local',
      reason: runtime.reason,
      missing: runtime.requested ? runtime.missing : [],
    });
    return localRepository;
  }

  const remote = createFirebaseRealtimeRemote({
    firebaseConfig: runtime.firebase,
    databasePath: runtime.databasePath,
    waitForAccess,
  });
  return createMirroredDocumentRepository({
    localRepository,
    remote,
    onStatus,
  });
}
