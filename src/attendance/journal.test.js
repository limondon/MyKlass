import { describe, expect, it } from 'vitest';
import { LESSON_STATUS } from '../domain/lessons.js';
import {
  attendanceMarkToLegacyChange,
  selectAttendanceJournal,
  summarizeAttendance,
} from './journal.js';

function createStore() {
  return {
    subscriptions: [
      {
        id: 'sub-main',
        studentId: 's1',
        kind: 'main',
        legacySubscriptionId: 'main',
        slots: [
          { id: 'slot-1', position: 1 },
          { id: 'slot-2', position: 2 },
          { id: 'slot-3', position: 3 },
        ],
      },
    ],
    lessons: [
      {
        id: 'lesson-1',
        studentId: 's1',
        subscriptionId: 'sub-main',
        slotId: 'slot-1',
        scheduledAt: '2026-06-01T16:00:00+03:00',
        status: LESSON_STATUS.DONE,
        legacyStatus: 'done',
        comment: '',
      },
      {
        id: 'lesson-2',
        studentId: 's1',
        subscriptionId: 'sub-main',
        slotId: 'slot-2',
        scheduledAt: '2026-06-03T16:00:00+03:00',
        status: LESSON_STATUS.DONE,
        legacyStatus: 'absent',
        comment: '',
      },
      {
        id: 'lesson-3',
        studentId: 's1',
        subscriptionId: 'sub-main',
        slotId: 'slot-3',
        scheduledAt: '2026-06-08T16:00:00+03:00',
        status: LESSON_STATUS.SCHEDULED,
        legacyStatus: 'future',
        comment: '',
      },
    ],
  };
}

describe('attendance journal', () => {
  it('uses real lesson dates and excludes future dates', () => {
    const journal = selectAttendanceJournal(createStore(), {
      studentIds: ['s1'],
      now: new Date(2026, 5, 7),
    });

    expect(journal.columns.map((column) => column.date)).toEqual([
      '2026-06-01',
      '2026-06-03',
    ]);
    expect(journal.rows[0].cells.map((cell) => cell.mark)).toEqual(['P', 'A']);
    expect(journal.rows[0].cells[1]).toMatchObject({
      editable: true,
      lessonIndex: 1,
      activeSubId: 'main',
    });
  });

  it('keeps empty cells non-editable when a student had no lesson', () => {
    const journal = selectAttendanceJournal(createStore(), {
      studentIds: ['s1', 's2'],
      now: new Date(2026, 5, 7),
    });

    expect(journal.rows[1].cells).toEqual([
      { date: '2026-06-01', mark: '-', editable: false },
      { date: '2026-06-03', mark: '-', editable: false },
    ]);
  });

  it('maps journal marks back to supported legacy changes', () => {
    expect(attendanceMarkToLegacyChange('L')).toEqual({
      status: 'done',
      note: 'Опоздание',
    });
    expect(attendanceMarkToLegacyChange('A')).toEqual({
      status: 'absent',
      note: '',
    });
  });

  it('calculates summary from real rows', () => {
    expect(
      summarizeAttendance([
        { cells: [{ mark: 'P' }, { mark: 'A' }, { mark: 'M' }, { mark: 'L' }] },
      ]),
    ).toEqual({
      attended: 3,
      absences: 1,
      makeups: 1,
      late: 1,
      rate: 75,
    });
  });
});
