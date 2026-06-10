import { CURRENT_SCHEMA_VERSION } from './schema.js';

export class StorageValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'StorageValidationError';
  }
}

function requireArray(store, field) {
  if (!Array.isArray(store[field])) {
    throw new StorageValidationError(`${field} must be an array`);
  }
}

function requireObjectIfPresent(store, field) {
  if (
    store[field] !== undefined &&
    (
      store[field] === null ||
      typeof store[field] !== 'object' ||
      Array.isArray(store[field])
    )
  ) {
    throw new StorageValidationError(`${field} must be an object`);
  }
}

function assertUniqueIds(items, field) {
  const ids = new Set();
  for (const item of items) {
    if (!item?.id) {
      throw new StorageValidationError(`${field} contains an item without id`);
    }
    if (ids.has(item.id)) {
      throw new StorageValidationError(`${field} contains duplicate id ${item.id}`);
    }
    ids.add(item.id);
  }
  return ids;
}

export function validateLegacyStore(store) {
  if (!store || typeof store !== 'object') {
    throw new StorageValidationError('Legacy store must be an object');
  }
  requireArray(store, 'students');
  requireArray(store, 'groups');
  assertUniqueIds(store.students, 'students');
  assertUniqueIds(store.groups, 'groups');
  return store;
}

export function validateStoreV2(store) {
  if (!store || store.schemaVersion !== CURRENT_SCHEMA_VERSION) {
    throw new StorageValidationError(
      `Expected schema version ${CURRENT_SCHEMA_VERSION}`,
    );
  }

  for (const field of [
    'students',
    'groups',
    'subscriptions',
    'lessons',
    'sessions',
    'freezePeriods',
    'transactions',
    'historyEvents',
    'migrationIssues',
  ]) {
    requireArray(store, field);
  }
  requireObjectIfPresent(store, 'teacherProfile');
  requireObjectIfPresent(store, 'scheduleOverrides');

  const studentIds = assertUniqueIds(store.students, 'students');
  const groupIds = assertUniqueIds(store.groups, 'groups');
  const subscriptionIds = assertUniqueIds(
    store.subscriptions,
    'subscriptions',
  );
  const lessonIds = assertUniqueIds(store.lessons, 'lessons');
  const slotIds = new Set();

  for (const subscription of store.subscriptions) {
    if (!studentIds.has(subscription.studentId)) {
      throw new StorageValidationError(
        `Subscription ${subscription.id} references unknown student`,
      );
    }
    if (!Array.isArray(subscription.slots)) {
      throw new StorageValidationError(
        `Subscription ${subscription.id} has no slots array`,
      );
    }
    if (subscription.slots.length !== subscription.lessonCount) {
      throw new StorageValidationError(
        `Subscription ${subscription.id} slot count does not match lessonCount`,
      );
    }
    for (const slot of subscription.slots) {
      if (!slot.id || slotIds.has(slot.id)) {
        throw new StorageValidationError(`Invalid or duplicate slot ${slot.id}`);
      }
      if (slot.subscriptionId !== subscription.id) {
        throw new StorageValidationError(
          `Slot ${slot.id} references another subscription`,
        );
      }
      slotIds.add(slot.id);
    }
  }

  for (const student of store.students) {
    if (student.groupId && !groupIds.has(student.groupId)) {
      throw new StorageValidationError(
        `Student ${student.id} references unknown group`,
      );
    }
  }

  for (const lesson of store.lessons) {
    if (!studentIds.has(lesson.studentId)) {
      throw new StorageValidationError(
        `Lesson ${lesson.id} references unknown student`,
      );
    }
    if (!subscriptionIds.has(lesson.subscriptionId)) {
      throw new StorageValidationError(
        `Lesson ${lesson.id} references unknown subscription`,
      );
    }
    if (!slotIds.has(lesson.slotId)) {
      throw new StorageValidationError(
        `Lesson ${lesson.id} references unknown slot`,
      );
    }
  }

  for (const subscription of store.subscriptions) {
    for (const slot of subscription.slots) {
      if (slot.lessonId && !lessonIds.has(slot.lessonId)) {
        throw new StorageValidationError(
          `Slot ${slot.id} references unknown lesson`,
        );
      }
    }
  }

  return store;
}
