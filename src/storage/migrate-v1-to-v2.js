import { LESSON_STATUS } from '../domain/lessons.js';
import { SLOT_STATUS } from '../domain/subscriptions.js';
import { createEmptyStoreV2 } from './schema.js';
import { validateLegacyStore, validateStoreV2 } from './validation.js';

const STATUS_MAP = Object.freeze({
  future: LESSON_STATUS.SCHEDULED,
  done: LESSON_STATUS.DONE,
  absent: LESSON_STATUS.DONE,
  transfer: LESSON_STATUS.TRANSFER,
  'sick-wait': LESSON_STATUS.SICK_WAIT,
  sick: LESSON_STATUS.SICK,
  freeze: LESSON_STATUS.FREEZE,
  refund: LESSON_STATUS.REFUND,
  'teacher-cancel': LESSON_STATUS.CANCELLED,
});

const REVIEW_STATUSES = new Set([
  LESSON_STATUS.TRANSFER,
  LESSON_STATUS.SICK,
  LESSON_STATUS.FREEZE,
]);

function pad(value) {
  return String(value).padStart(2, '0');
}

function parseLegacyFullDate(value) {
  const match = String(value || '').match(
    /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/,
  );
  if (!match) return null;
  return {
    day: Number(match[1]),
    month: Number(match[2]),
    year: Number(match[3]),
  };
}

function parseLegacyShortDate(value) {
  const match = String(value || '').match(/^(\d{1,2})\.(\d{1,2})$/);
  if (!match) return null;
  return { day: Number(match[1]), month: Number(match[2]) };
}

function isValidDateParts({ day, month, year }) {
  if (month < 1 || month > 12 || day < 1) return false;
  return day <= new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function toIsoDateTime(parts, time, timezoneOffset) {
  const [hours = '00', minutes = '00'] = String(time || '00:00').split(':');
  if (!isValidDateParts(parts)) return null;
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(hours)}:${pad(minutes)}:00${timezoneOffset}`;
}

function resolveLessonDates(lessons, paidAt, time, timezoneOffset) {
  const paymentDate = parseLegacyFullDate(paidAt);
  let year = paymentDate?.year || new Date().getFullYear();
  let previousMonth = null;

  return lessons.map((lesson) => {
    const full = parseLegacyFullDate(lesson.date);
    if (full) {
      year = full.year;
      previousMonth = full.month;
      return toIsoDateTime(full, time, timezoneOffset);
    }

    const short = parseLegacyShortDate(lesson.date);
    if (!short) return null;
    if (previousMonth !== null && short.month < previousMonth - 6) {
      year += 1;
    }
    previousMonth = short.month;
    return toIsoDateTime({ ...short, year }, time, timezoneOffset);
  });
}

function mapSlotStatus(lessonStatus) {
  if (lessonStatus === LESSON_STATUS.DONE) return SLOT_STATUS.CONSUMED;
  if (lessonStatus === LESSON_STATUS.REFUND) return SLOT_STATUS.REFUNDED;
  return SLOT_STATUS.RESERVED;
}

function parseMoney(note) {
  const match = String(note || '').match(/([\d\s]+)\s*₽/);
  if (!match) return null;
  const amount = Number(match[1].replace(/\s/g, ''));
  return Number.isFinite(amount) ? amount : null;
}

function parsePaymentMethod(note) {
  const parts = String(note || '')
    .split('·')
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.length >= 3 ? parts.at(-1) : null;
}

function migrateEvents(student, subscriptionId, events, store) {
  for (const [index, event] of (events || []).entries()) {
    const id = `history_${student.id}_${subscriptionId}_${index + 1}`;
    const historyEvent = {
      id,
      studentId: student.id,
      subscriptionId,
      type: event.type || 'note',
      occurredAt: event.date || null,
      note: event.note || '',
      source: 'legacy-v1',
    };
    store.historyEvents.push(historyEvent);

    if (!['payment', 'payment-pending', 'refund'].includes(event.type)) {
      continue;
    }

    store.transactions.push({
      id: `transaction_${student.id}_${subscriptionId}_${index + 1}`,
      studentId: student.id,
      subscriptionId,
      type: event.type === 'refund' ? 'refund' : 'payment',
      status: event.type === 'payment-pending' ? 'pending' : 'completed',
      amount: parseMoney(event.note),
      paidAt: event.date || null,
      method: parsePaymentMethod(event.note),
      slotIds: [],
      comment: event.note || '',
      sourceEventId: id,
    });
  }
}

function migrateSubscription(
  student,
  legacySubscription,
  subscriptionId,
  store,
  options,
) {
  const legacyLessons = legacySubscription.lessons || [];
  const lessonCount = Math.max(
    Number(legacySubscription.pack) || 0,
    legacyLessons.length,
  );
  if (lessonCount <= 0) return;

  const dates = resolveLessonDates(
    legacyLessons,
    legacySubscription.paid,
    legacySubscription.time || student.time,
    options.timezoneOffset,
  );
  const slots = [];
  const migratedLessons = [];

  for (let index = 0; index < lessonCount; index += 1) {
    const legacyLesson = legacyLessons[index] || null;
    const slotId = `slot_${subscriptionId}_${index + 1}`;
    const lessonId = legacyLesson
      ? `lesson_${subscriptionId}_${index + 1}`
      : null;
    const status = legacyLesson
      ? STATUS_MAP[legacyLesson.status] || LESSON_STATUS.SCHEDULED
      : null;

    slots.push({
      id: slotId,
      subscriptionId,
      position: index + 1,
      status: status ? mapSlotStatus(status) : SLOT_STATUS.AVAILABLE,
      lessonId,
      consumedAt: status === LESSON_STATUS.DONE ? dates[index] : null,
      refundedAt: status === LESSON_STATUS.REFUND ? dates[index] : null,
      amount:
        Number.isFinite(Number(legacySubscription.price)) && lessonCount > 0
          ? Number(legacySubscription.price) / lessonCount
          : null,
    });

    if (!legacyLesson) continue;
    if (!dates[index]) {
      store.migrationIssues.push({
        id: `issue_invalid_date_${lessonId}`,
        entityType: 'lesson',
        entityId: lessonId,
        code: 'INVALID_LEGACY_DATE',
        message: `Не удалось преобразовать дату ${legacyLesson.date}`,
      });
    }

    if (REVIEW_STATUSES.has(status)) {
      store.migrationIssues.push({
        id: `issue_status_${lessonId}`,
        entityType: 'lesson',
        entityId: lessonId,
        code: 'REPLACEMENT_LINK_REQUIRED',
        message: `Статус ${legacyLesson.status} требует проверки связанного занятия`,
      });
    }

    migratedLessons.push({
      id: lessonId,
      studentId: student.id,
      groupId: student.groupId || null,
      sessionId: null,
      subscriptionId,
      slotId,
      subject:
        legacySubscription.subject ||
        student.subject ||
        'Подготовка к школе',
      scheduledAt: dates[index],
      status,
      comment: legacyLesson.note || '',
      replacesLessonId: null,
      replacementLessonId: null,
      completedAt: status === LESSON_STATUS.DONE ? dates[index] : null,
      legacyStatus: legacyLesson.status,
      requiresReview: REVIEW_STATUSES.has(status) || !dates[index],
    });
  }

  store.subscriptions.push({
    id: subscriptionId,
    legacySubscriptionId: legacySubscription.id || 'main',
    kind: legacySubscription === student ? 'main' : 'extra',
    studentId: student.id,
    subject:
      legacySubscription.subject || student.subject || 'Подготовка к школе',
    lessonCount,
    price: Number(legacySubscription.price) || 0,
    paidAt: legacySubscription.paid || null,
    createdAt: legacySubscription.paid || null,
    status: legacySubscription.status || student.status || 'active',
    days: legacySubscription.days || student.days || [],
    time: legacySubscription.time || student.time || '',
    slots,
    legacyQueue: legacySubscription.queuedPack || null,
    legacyArchivedLessons: legacySubscription.archivedLessons || [],
  });
  store.lessons.push(...migratedLessons);
  migrateEvents(
    student,
    subscriptionId,
    legacySubscription.events || [],
    store,
  );
}

function migrateStudent(student, groupIds, store) {
  const groupId = student.groupId || null;
  const hasKnownGroup = !groupId || groupIds.has(groupId);
  if (!hasKnownGroup) {
    store.migrationIssues.push({
      id: `issue_unknown_group_${student.id}`,
      entityType: 'student',
      entityId: student.id,
      code: 'UNKNOWN_GROUP',
      message: `Группа ${groupId} не найдена; ученик перенесён без группы`,
    });
  }

  return {
    id: student.id,
    name: student.name || '',
    shortName: student.short || '',
    birthDate: student.birthDate || null,
    parentName: student.parent || '',
    parentPhone: student.phone || '',
    groupId: hasKnownGroup ? groupId : null,
    legacyGroupId: hasKnownGroup ? null : groupId,
    status: student.status || 'active',
    joinedAt: student.joined || null,
    avatarColor: student.spine || null,
    scores: student.scores || {},
    notes: student.notes || '',
    notesList: student.notesList || [],
    contacts: student.contacts || [],
    freezeAllowanceWeeks: Number(student.freezeMax) || 3,
    freezeUsedWeeks: Number(student.freezeUsed) || 0,
    legacySchedule: {
      days: student.days || [],
      time: student.time || '',
    },
  };
}

export function migrateV1ToV2(
  legacyStore,
  {
    migratedAt = new Date().toISOString(),
    timezoneOffset = '+03:00',
    sourceFingerprint = null,
  } = {},
) {
  validateLegacyStore(legacyStore);
  const store = createEmptyStoreV2(migratedAt, sourceFingerprint);
  store.groups = legacyStore.groups.map((group) => ({ ...group }));
  store.teacherProfile = { ...(legacyStore.teacherProfile || {}) };
  store.scheduleOverrides = structuredClone(
    legacyStore.scheduleOverrides || {},
  );
  const groupIds = new Set(store.groups.map((group) => group.id));
  store.students = legacyStore.students.map((student) =>
    migrateStudent(student, groupIds, store),
  );

  for (const student of legacyStore.students) {
    migrateSubscription(student, student, `subscription_${student.id}_main`, store, {
      timezoneOffset,
    });
    for (const [index, extra] of (student.extraSubs || []).entries()) {
      migrateSubscription(
        student,
        extra,
        `subscription_${student.id}_extra_${index + 1}`,
        store,
        { timezoneOffset },
      );
    }
  }

  return validateStoreV2(store);
}
