import { assertIsoDateTime } from './dates.js';
import { DomainError } from './errors.js';
import { createId } from './ids.js';
import { consumeSlot, reserveSlot, SLOT_STATUS } from './subscriptions.js';

export const LESSON_STATUS = Object.freeze({
  SCHEDULED: 'scheduled',
  DONE: 'done',
  TRANSFER: 'transfer',
  SICK_WAIT: 'sick-wait',
  SICK: 'sick',
  FREEZE: 'freeze',
  REFUND: 'refund',
  CANCELLED: 'cancelled',
});

export function createLesson(
  {
    id,
    studentId,
    groupId = null,
    sessionId = null,
    subscriptionId,
    slotId,
    scheduledAt,
    subject = 'Подготовка к школе',
    status = LESSON_STATUS.SCHEDULED,
    comment = '',
    replacesLessonId = null,
  },
  randomUUID,
) {
  if (!studentId || !subscriptionId || !slotId) {
    throw new DomainError(
      'LESSON_RELATION_REQUIRED',
      'studentId, subscriptionId and slotId are required',
    );
  }

  return {
    id: id || createId('lesson', randomUUID),
    studentId,
    groupId,
    sessionId,
    subscriptionId,
    slotId,
    subject,
    scheduledAt: assertIsoDateTime(scheduledAt),
    status,
    comment,
    replacesLessonId,
    replacementLessonId: null,
    completedAt: null,
  };
}

export function scheduleLesson(input, slot, randomUUID) {
  const lesson = createLesson(input, randomUUID);
  return {
    lesson,
    slot: reserveSlot(slot, lesson.id),
  };
}

export function conductLesson(lesson, slot, completedAt) {
  assertIsoDateTime(completedAt, 'completedAt');

  if (lesson.status === LESSON_STATUS.DONE) {
    throw new DomainError('LESSON_ALREADY_DONE', 'Lesson is already completed');
  }
  if (lesson.slotId !== slot.id) {
    throw new DomainError(
      'LESSON_SLOT_MISMATCH',
      'Lesson and slot do not match',
    );
  }

  return {
    lesson: {
      ...lesson,
      status: LESSON_STATUS.DONE,
      completedAt,
    },
    slot: consumeSlot(slot, lesson.id, completedAt),
  };
}

export function setLessonStatus(
  lesson,
  slot,
  { status, comment = '', changedAt },
) {
  if (!Object.values(LESSON_STATUS).includes(status)) {
    throw new DomainError('INVALID_LESSON_STATUS', `Unknown status ${status}`);
  }
  if (lesson.slotId !== slot.id) {
    throw new DomainError(
      'LESSON_SLOT_MISMATCH',
      'Lesson and slot do not match',
    );
  }

  if (status === LESSON_STATUS.DONE) {
    return conductLesson(lesson, slot, changedAt);
  }

  if (status === LESSON_STATUS.REFUND) {
    return {
      lesson: {
        ...lesson,
        status,
        comment,
        completedAt: null,
      },
      slot: {
        ...slot,
        status: SLOT_STATUS.REFUNDED,
        lessonId: lesson.id,
        consumedAt: null,
        refundedAt: changedAt || null,
      },
    };
  }

  return {
    lesson: {
      ...lesson,
      status,
      comment,
      completedAt: null,
    },
    slot: {
      ...slot,
      status: SLOT_STATUS.RESERVED,
      lessonId: lesson.id,
      consumedAt: null,
      refundedAt: null,
    },
  };
}

export function transferLesson(
  lesson,
  slot,
  { scheduledAt, comment = '', reason = LESSON_STATUS.TRANSFER },
  randomUUID,
) {
  if (
    ![
      LESSON_STATUS.SCHEDULED,
      LESSON_STATUS.SICK_WAIT,
      LESSON_STATUS.SICK,
    ].includes(lesson.status)
  ) {
    throw new DomainError(
      'LESSON_NOT_TRANSFERABLE',
      `Lesson with status ${lesson.status} cannot be transferred`,
    );
  }
  if (lesson.slotId !== slot.id || slot.status === SLOT_STATUS.CONSUMED) {
    throw new DomainError(
      'LESSON_SLOT_MISMATCH',
      'Transfer requires the original unconsumed slot',
    );
  }

  const replacement = createLesson(
    {
      studentId: lesson.studentId,
      groupId: lesson.groupId,
      subscriptionId: lesson.subscriptionId,
      slotId: lesson.slotId,
      scheduledAt,
      subject: lesson.subject,
      comment,
      replacesLessonId: lesson.id,
    },
    randomUUID,
  );

  return {
    originalLesson: {
      ...lesson,
      status: reason,
      replacementLessonId: replacement.id,
      comment: comment || lesson.comment,
    },
    replacementLesson: replacement,
    slot: reserveSlot(
      { ...slot, status: SLOT_STATUS.AVAILABLE, lessonId: null },
      replacement.id,
    ),
  };
}
