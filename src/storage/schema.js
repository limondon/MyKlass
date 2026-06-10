export const STORAGE_KEYS = Object.freeze({
  legacy: 'mk_store_v1',
  legacyBackup: 'mk_store_v1_backup_before_v2',
  current: 'mk_store_v2',
  temporary: 'mk_store_v2_migration_temp',
  migrationStatus: 'mk_store_migration_status',
});

export const CURRENT_SCHEMA_VERSION = 2;
export const CURRENT_MIGRATION_REVISION = 3;

export function createEmptyStoreV2(migratedAt, sourceFingerprint = null) {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    meta: {
      migratedAt,
      sourceKey: STORAGE_KEYS.legacy,
      sourceSchemaVersion: 1,
      sourceFingerprint,
      migrationRevision: CURRENT_MIGRATION_REVISION,
    },
    students: [],
    groups: [],
    teacherProfile: {},
    scheduleOverrides: {},
    subscriptions: [],
    lessons: [],
    sessions: [],
    freezePeriods: [],
    transactions: [],
    historyEvents: [],
    migrationIssues: [],
  };
}
