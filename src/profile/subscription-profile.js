import { LESSON_STATUS, setLessonStatus } from '../domain/lessons.js';
import { SLOT_STATUS } from '../domain/subscriptions.js';

const LEGACY_TO_DOMAIN = Object.freeze({
  future: LESSON_STATUS.SCHEDULED,
  done: LESSON_STATUS.DONE,
  transfer: LESSON_STATUS.TRANSFER,
  'sick-wait': LESSON_STATUS.SICK_WAIT,
  sick: LESSON_STATUS.SICK,
  freeze: LESSON_STATUS.FREEZE,
  refund: LESSON_STATUS.REFUND,
  'teacher-cancel': LESSON_STATUS.CANCELLED,
  absent: LESSON_STATUS.DONE,
});

const DOMAIN_TO_LEGACY = Object.freeze({
  [LESSON_STATUS.SCHEDULED]: 'future',
  [LESSON_STATUS.DONE]: 'done',
  [LESSON_STATUS.TRANSFER]: 'transfer',
  [LESSON_STATUS.SICK_WAIT]: 'sick-wait',
  [LESSON_STATUS.SICK]: 'sick',
  [LESSON_STATUS.FREEZE]: 'freeze',
  [LESSON_STATUS.REFUND]: 'refund',
  [LESSON_STATUS.CANCELLED]: 'teacher-cancel',
});

function formatLegacyDate(value) {
  const match = String(value || '').match(/^\d{4}-(\d{2})-(\d{2})T/);
  return match ? `${match[2]}.${match[1]}` : '';
}

export function findProfileSubscription(store, studentId, activeSubId = 'main') {
  if (!store) return null;
  return (
    store.subscriptions.find(
      (subscription) =>
        subscription.studentId === studentId &&
        (activeSubId === 'main'
          ? subscription.kind === 'main'
          : subscription.legacySubscriptionId === activeSubId),
    ) || null
  );
}

export function selectSubscriptionSummary(
  store,
  studentId,
  activeSubId = 'main',
) {
  const subscription = findProfileSubscription(
    store,
    studentId,
    activeSubId,
  );
  if (!subscription) return null;

  const slots = subscription.slots || [];
  const used = slots.filter(
    (slot) => slot.status === SLOT_STATUS.CONSUMED,
  ).length;
  const refunded = slots.filter(
    (slot) => slot.status === SLOT_STATUS.REFUNDED,
  ).length;
  const remaining = slots.filter((slot) =>
    [SLOT_STATUS.AVAILABLE, SLOT_STATUS.RESERVED].includes(slot.status),
  ).length;

  return {
    subscription,
    total: subscription.lessonCount,
    used,
    remaining,
    refunded,
  };
}

export function selectLegacyCompatibleSubscription(
  store,
  studentId,
  activeSubId = 'main',
) {
  const summary = selectSubscriptionSummary(store, studentId, activeSubId);
  if (!summary) return null;

  const { subscription } = summary;
  const lessons = store.lessons
    .filter((lesson) => lesson.subscriptionId === subscription.id)
    .sort((a, b) => {
      const slotA = subscription.slots.find(
        (slot) => slot.id === a.slotId,
      )?.position;
      const slotB = subscription.slots.find(
        (slot) => slot.id === b.slotId,
      )?.position;
      return (slotA || 0) - (slotB || 0);
    })
    .map((lesson) => ({
      id: lesson.id,
      date: formatLegacyDate(lesson.scheduledAt),
      scheduledAt: lesson.scheduledAt,
      status: DOMAIN_TO_LEGACY[lesson.status] || lesson.legacyStatus || 'future',
      note: lesson.comment || '',
      slotId: lesson.slotId,
      requiresReview: Boolean(lesson.requiresReview),
    }));

  return {
    ...subscription,
    pack: summary.total,
    totalSessions: summary.total,
    used: summary.used,
    left: summary.remaining,
    refunded: summary.refunded,
    lessons,
  };
}

export function validateLegacyLessonStatusChange({
  store,
  studentId,
  activeSubId = 'main',
  lessonIndex,
  legacyStatus,
  note = '',
  changedAt,
}) {
  const subscription = findProfileSubscription(
    store,
    studentId,
    activeSubId,
  );
  if (!subscription) {
    throw new Error('Subscription not found');
  }

  const lessons = store.lessons
    .filter((lesson) => lesson.subscriptionId === subscription.id)
    .sort((a, b) => {
      const slotA = subscription.slots.find(
        (slot) => slot.id === a.slotId,
      )?.position;
      const slotB = subscription.slots.find(
        (slot) => slot.id === b.slotId,
      )?.position;
      return (slotA || 0) - (slotB || 0);
    });
  const lesson = lessons[lessonIndex];
  const slot = subscription.slots.find((item) => item.id === lesson?.slotId);
  const status = LEGACY_TO_DOMAIN[legacyStatus];

  if (!lesson || !slot) throw new Error('Lesson or slot not found');
  if (!status) throw new Error(`Unsupported legacy status ${legacyStatus}`);

  return setLessonStatus(lesson, slot, {
    status,
    comment: note,
    changedAt,
  });
}
