import { describe, expect, it } from 'vitest';
import {
  conductLesson,
  DomainError,
  LESSON_STATUS,
  scheduleLesson,
  SLOT_STATUS,
  transferLesson,
} from './index.js';

const slot = {
  id: 'slot_1',
  subscriptionId: 'subscription_1',
  position: 1,
  status: SLOT_STATUS.AVAILABLE,
  lessonId: null,
  consumedAt: null,
};

const lessonInput = {
  id: 'lesson_1',
  studentId: 'student_1',
  groupId: 'group_1',
  subscriptionId: 'subscription_1',
  slotId: 'slot_1',
  scheduledAt: '2026-06-08T16:00:00+03:00',
};

describe('lesson lifecycle', () => {
  it('reserves a slot when a lesson is scheduled', () => {
    const result = scheduleLesson(lessonInput, slot);

    expect(result.lesson.status).toBe(LESSON_STATUS.SCHEDULED);
    expect(result.slot).toMatchObject({
      status: SLOT_STATUS.RESERVED,
      lessonId: 'lesson_1',
    });
  });

  it('conducts a lesson and consumes its slot exactly once', () => {
    const scheduled = scheduleLesson(lessonInput, slot);
    const completedAt = '2026-06-08T17:00:00+03:00';
    const completed = conductLesson(
      scheduled.lesson,
      scheduled.slot,
      completedAt,
    );

    expect(completed.lesson).toMatchObject({
      status: LESSON_STATUS.DONE,
      completedAt,
    });
    expect(completed.slot).toMatchObject({
      status: SLOT_STATUS.CONSUMED,
      consumedAt: completedAt,
      lessonId: 'lesson_1',
    });
    expect(() =>
      conductLesson(completed.lesson, completed.slot, completedAt),
    ).toThrowError(
      expect.objectContaining({ code: 'LESSON_ALREADY_DONE' }),
    );
  });

  it('keeps the original lesson and moves the same slot to a replacement', () => {
    const scheduled = scheduleLesson(lessonInput, slot);
    const result = transferLesson(
      scheduled.lesson,
      scheduled.slot,
      {
        scheduledAt: '2026-06-12T16:00:00+03:00',
        comment: 'Отработка после пропуска',
      },
      () => '00000000-0000-4000-8000-000000000099',
    );

    expect(result.originalLesson).toMatchObject({
      id: 'lesson_1',
      status: LESSON_STATUS.TRANSFER,
      replacementLessonId:
        'lesson_00000000-0000-4000-8000-000000000099',
    });
    expect(result.replacementLesson).toMatchObject({
      slotId: 'slot_1',
      replacesLessonId: 'lesson_1',
      status: LESSON_STATUS.SCHEDULED,
    });
    expect(result.slot).toMatchObject({
      status: SLOT_STATUS.RESERVED,
      lessonId: 'lesson_00000000-0000-4000-8000-000000000099',
    });
  });

  it('requires timezone-aware ISO dates', () => {
    expect(() =>
      scheduleLesson(
        { ...lessonInput, scheduledAt: '08.06.2026 16:00' },
        slot,
      ),
    ).toThrowError(
      expect.objectContaining({ code: 'INVALID_DATE_TIME' }),
    );
  });

  it('does not transfer a completed lesson', () => {
    const scheduled = scheduleLesson(lessonInput, slot);
    const completed = conductLesson(
      scheduled.lesson,
      scheduled.slot,
      '2026-06-08T17:00:00+03:00',
    );

    expect(() =>
      transferLesson(completed.lesson, completed.slot, {
        scheduledAt: '2026-06-12T16:00:00+03:00',
      }),
    ).toThrow(DomainError);
  });
});
