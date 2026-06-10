import { describe, expect, it } from 'vitest';
import {
  createSessionFromScheduleBlock,
  findLessonIndexForSession,
} from './session.js';

describe('schedule sessions', () => {
  it('creates a dated session from a schedule block', () => {
    const session = createSessionFromScheduleBlock({
      id: 'group_slot_1',
      date: '2026-06-08',
      start: 16,
      end: 17.5,
      groupId: 'g1',
      subject: 'Подготовка',
    });

    expect(session).toMatchObject({
      id: 'session_2026-06-08_group_slot_1',
      groupId: 'g1',
      startsAt: '2026-06-08T16:00:00+03:00',
      endsAt: '2026-06-08T17:30:00+03:00',
    });
  });

  it('finds only a lesson scheduled for the session date', () => {
    const session = createSessionFromScheduleBlock({
      id: 'slot',
      date: '2026-06-08',
      start: 16,
      end: 17,
    });
    const subscription = {
      lessons: [
        { scheduledAt: '2026-06-01T16:00:00+03:00' },
        { scheduledAt: '2026-06-08T16:00:00+03:00' },
      ],
    };

    expect(findLessonIndexForSession(subscription, session)).toBe(1);
  });

  it('does not fall back to the first future lesson', () => {
    const session = createSessionFromScheduleBlock({
      id: 'slot',
      date: '2026-06-10',
      start: 16,
      end: 17,
    });

    expect(
      findLessonIndexForSession(
        {
          lessons: [
            { scheduledAt: '2026-06-01T16:00:00+03:00' },
            { scheduledAt: '2026-06-08T16:00:00+03:00' },
          ],
        },
        session,
      ),
    ).toBe(-1);
  });
});
