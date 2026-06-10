import { describe, expect, it } from 'vitest';
import {
  ensureV2Migration,
  migrateV1ToV2,
  STORAGE_KEYS,
} from './index.js';

class MemoryStorage {
  constructor(entries = {}) {
    this.values = new Map(Object.entries(entries));
    this.failOnKey = null;
  }

  getItem(key) {
    return this.values.has(key) ? this.values.get(key) : null;
  }

  setItem(key, value) {
    if (key === this.failOnKey) throw new Error(`Cannot write ${key}`);
    this.values.set(key, String(value));
  }

  removeItem(key) {
    this.values.delete(key);
  }
}

const legacyStore = {
  teacherProfile: {
    name: 'Анна Сергеевна',
    role: 'репетитор',
    defaultPrice: 1600,
    paymentUrl: 'https://pay.example/test',
  },
  scheduleOverrides: {
    '2026-06-08': {
      cancelled: ['group_slot_1'],
      extra: [],
    },
  },
  groups: [
    {
      id: 'group_1',
      name: 'Букварята',
      days: [1, 3],
      time: '16:00',
    },
  ],
  students: [
    {
      id: 'student_1',
      name: 'Кира Новикова',
      groupId: 'group_1',
      subject: 'Подготовка к школе',
      pack: 3,
      price: 3600,
      paid: '28.12.2025',
      days: [1, 3],
      time: '16:00',
      status: 'active',
      freezeUsed: 1,
      freezeMax: 3,
      lessons: [
        { date: '29.12', status: 'done', note: '' },
        { date: '05.01', status: 'transfer', note: 'Нужна отработка' },
        { date: '07.01', status: 'future', note: '' },
      ],
      events: [
        {
          type: 'payment',
          date: '28.12.2025',
          note: 'Оплата · 3 занятия — 3 600 ₽ · СБП',
        },
      ],
    },
  ],
};

describe('migrateV1ToV2', () => {
  it('creates subscriptions, slots, lessons and transactions without losing entities', () => {
    const migrated = migrateV1ToV2(legacyStore, {
      migratedAt: '2026-06-07T12:00:00.000Z',
    });

    expect(migrated.schemaVersion).toBe(2);
    expect(migrated.students).toHaveLength(1);
    expect(migrated.groups).toHaveLength(1);
    expect(migrated.subscriptions).toHaveLength(1);
    expect(migrated.subscriptions[0].slots).toHaveLength(3);
    expect(migrated.lessons).toHaveLength(3);
    expect(migrated.transactions[0]).toMatchObject({
      type: 'payment',
      status: 'completed',
      amount: 3600,
      method: 'СБП',
    });
    expect(migrated.teacherProfile).toEqual(legacyStore.teacherProfile);
    expect(migrated.scheduleOverrides).toEqual(
      legacyStore.scheduleOverrides,
    );
  });

  it('restores the year across a December to January boundary', () => {
    const migrated = migrateV1ToV2(legacyStore);

    expect(migrated.lessons.map((lesson) => lesson.scheduledAt)).toEqual([
      '2025-12-29T16:00:00+03:00',
      '2026-01-05T16:00:00+03:00',
      '2026-01-07T16:00:00+03:00',
    ]);
  });

  it('flags ambiguous replacement statuses for review', () => {
    const migrated = migrateV1ToV2(legacyStore);

    expect(migrated.migrationIssues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'REPLACEMENT_LINK_REQUIRED',
          entityId: 'lesson_subscription_student_1_main_2',
        }),
      ]),
    );
  });

  it('preserves a dangling group reference as a migration issue', () => {
    const migrated = migrateV1ToV2({
      ...legacyStore,
      students: [{ ...legacyStore.students[0], groupId: 'deleted_group' }],
    });

    expect(migrated.students[0]).toMatchObject({
      groupId: null,
      legacyGroupId: 'deleted_group',
    });
    expect(migrated.migrationIssues[0].code).toBe('UNKNOWN_GROUP');
  });
});

describe('ensureV2Migration', () => {
  it('backs up v1, verifies v2 and keeps the source untouched', () => {
    const original = JSON.stringify(legacyStore);
    const storage = new MemoryStorage({ [STORAGE_KEYS.legacy]: original });

    const result = ensureV2Migration({
      storage,
      now: () => '2026-06-07T12:00:00.000Z',
    });

    expect(result.status).toBe('completed');
    expect(storage.getItem(STORAGE_KEYS.legacy)).toBe(original);
    expect(storage.getItem(STORAGE_KEYS.legacyBackup)).toBe(original);
    expect(JSON.parse(storage.getItem(STORAGE_KEYS.current)).schemaVersion).toBe(
      2,
    );
    expect(storage.getItem(STORAGE_KEYS.temporary)).toBeNull();
  });

  it('is idempotent when a valid v2 store already exists', () => {
    const storage = new MemoryStorage({
      [STORAGE_KEYS.legacy]: JSON.stringify(legacyStore),
    });
    ensureV2Migration({
      storage,
      now: () => '2026-06-07T12:00:00.000Z',
    });
    const serialized = storage.getItem(STORAGE_KEYS.current);

    const result = ensureV2Migration({ storage });

    expect(result.status).toBe('ready');
    expect(storage.getItem(STORAGE_KEYS.current)).toBe(serialized);
    expect(storage.getItem(STORAGE_KEYS.legacyBackup)).not.toBeNull();
  });

  it('refreshes v2 when the still-active legacy store changes', () => {
    const storage = new MemoryStorage({
      [STORAGE_KEYS.legacy]: JSON.stringify(legacyStore),
    });
    ensureV2Migration({ storage });
    const changedLegacy = {
      ...legacyStore,
      students: [
        ...legacyStore.students,
        {
          id: 'student_2',
          name: 'Новый ученик',
          pack: 0,
          lessons: [],
        },
      ],
    };
    storage.setItem(STORAGE_KEYS.legacy, JSON.stringify(changedLegacy));

    const result = ensureV2Migration({ storage });

    expect(result.status).toBe('completed');
    expect(result.store.students).toHaveLength(2);
    expect(result.store.meta.sourceFingerprint).toMatch(/^fnv1a-/);
  });

  it('refreshes v2 when migration rules receive a new revision', () => {
    const storage = new MemoryStorage({
      [STORAGE_KEYS.legacy]: JSON.stringify(legacyStore),
    });
    ensureV2Migration({ storage });
    const stale = JSON.parse(storage.getItem(STORAGE_KEYS.current));
    stale.meta.migrationRevision = 1;
    delete stale.subscriptions[0].kind;
    storage.setItem(STORAGE_KEYS.current, JSON.stringify(stale));

    const result = ensureV2Migration({ storage });

    expect(result.status).toBe('completed');
    expect(result.store.meta.migrationRevision).toBe(3);
    expect(result.store.subscriptions[0].kind).toBe('main');
  });

  it('does not publish partial v2 data when a write fails', () => {
    const original = JSON.stringify(legacyStore);
    const storage = new MemoryStorage({ [STORAGE_KEYS.legacy]: original });
    storage.failOnKey = STORAGE_KEYS.current;

    const result = ensureV2Migration({ storage });

    expect(result.status).toBe('failed');
    expect(result.legacyKeyPreserved).toBe(true);
    expect(storage.getItem(STORAGE_KEYS.current)).toBeNull();
    expect(storage.getItem(STORAGE_KEYS.temporary)).toBeNull();
    expect(storage.getItem(STORAGE_KEYS.legacyBackup)).toBe(original);
  });

  it('waits when the legacy store has not been initialized yet', () => {
    const result = ensureV2Migration({ storage: new MemoryStorage() });
    expect(result.status).toBe('waiting-for-legacy-data');
  });
});
