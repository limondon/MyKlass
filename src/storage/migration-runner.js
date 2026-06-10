import { migrateV1ToV2 } from './migrate-v1-to-v2.js';
import {
  CURRENT_MIGRATION_REVISION,
  CURRENT_SCHEMA_VERSION,
  STORAGE_KEYS,
} from './schema.js';
import { validateStoreV2 } from './validation.js';

function parseJson(value, label) {
  try {
    return JSON.parse(value);
  } catch (error) {
    throw new Error(`${label} contains invalid JSON`, { cause: error });
  }
}

function setAndVerify(storage, key, value, validator) {
  const serialized = JSON.stringify(value);
  storage.setItem(key, serialized);
  const saved = storage.getItem(key);
  if (saved === null) {
    throw new Error(`Storage did not persist ${key}`);
  }
  return validator(parseJson(saved, key));
}

export function fingerprintStorageValue(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

export function ensureV2Migration({
  storage,
  now = () => new Date().toISOString(),
  timezoneOffset = '+03:00',
} = {}) {
  if (!storage) {
    return { status: 'unavailable', schemaVersion: null };
  }

  const legacyRaw = storage.getItem(STORAGE_KEYS.legacy);
  const sourceFingerprint = legacyRaw
    ? fingerprintStorageValue(legacyRaw)
    : null;
  const currentRaw = storage.getItem(STORAGE_KEYS.current);
  if (currentRaw) {
    try {
      const current = validateStoreV2(
        parseJson(currentRaw, STORAGE_KEYS.current),
      );
      if (
        !legacyRaw ||
        (
          current.meta.sourceFingerprint === sourceFingerprint &&
          current.meta.migrationRevision === CURRENT_MIGRATION_REVISION
        )
      ) {
        return {
          status: 'ready',
          schemaVersion: current.schemaVersion,
          store: current,
        };
      }
    } catch (error) {
      return {
        status: 'failed',
        schemaVersion: null,
        message: 'Existing v2 storage is invalid',
        legacyKeyPreserved: storage.getItem(STORAGE_KEYS.legacy) !== null,
        error,
      };
    }
  }

  if (!legacyRaw) {
    return { status: 'waiting-for-legacy-data', schemaVersion: null };
  }

  const migratedAt = now();

  try {
    if (!storage.getItem(STORAGE_KEYS.legacyBackup)) {
      storage.setItem(STORAGE_KEYS.legacyBackup, legacyRaw);
      if (storage.getItem(STORAGE_KEYS.legacyBackup) !== legacyRaw) {
        throw new Error('Legacy backup verification failed');
      }
    }

    const legacy = parseJson(legacyRaw, STORAGE_KEYS.legacy);
    const migrated = migrateV1ToV2(legacy, {
      migratedAt,
      timezoneOffset,
      sourceFingerprint,
    });

    setAndVerify(
      storage,
      STORAGE_KEYS.temporary,
      migrated,
      validateStoreV2,
    );
    const saved = setAndVerify(
      storage,
      STORAGE_KEYS.current,
      migrated,
      validateStoreV2,
    );

    const status = {
      status: 'completed',
      schemaVersion: CURRENT_SCHEMA_VERSION,
      migratedAt,
      issueCount: saved.migrationIssues.length,
      legacyKeyPreserved: true,
      backupKey: STORAGE_KEYS.legacyBackup,
    };
    storage.setItem(STORAGE_KEYS.migrationStatus, JSON.stringify(status));
    storage.removeItem(STORAGE_KEYS.temporary);

    return { ...status, store: saved };
  } catch (error) {
    storage.removeItem(STORAGE_KEYS.temporary);
    const status = {
      status: 'failed',
      schemaVersion: null,
      migratedAt,
      message: error instanceof Error ? error.message : String(error),
      legacyKeyPreserved: storage.getItem(STORAGE_KEYS.legacy) === legacyRaw,
    };
    try {
      storage.setItem(STORAGE_KEYS.migrationStatus, JSON.stringify(status));
    } catch {
      // The caller receives the failure even when storage is completely full.
    }
    return { ...status, error };
  }
}

export function readLegacyBackup(storage) {
  return storage?.getItem(STORAGE_KEYS.legacyBackup) || null;
}
