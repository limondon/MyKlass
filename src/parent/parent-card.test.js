import { describe, expect, it } from 'vitest';
import { migrateV1ToV2 } from '../storage/index.js';
import { selectParentCardData } from './parent-card.js';

const student = {
  id: 's1',
  name: 'Кира Новикова',
  groupId: 'g1',
  pack: 6,
  price: 7200,
  paid: '11.05.2026',
  time: '16:00',
  freezeUsed: 1,
  freezeMax: 3,
  lessons: [
    { date: '11.05', status: 'done', note: '' },
    { date: '13.05', status: 'done', note: '' },
    { date: '18.05', status: 'sick', note: '' },
    { date: '20.05', status: 'transfer', note: '' },
    { date: '25.05', status: 'future', note: '' },
    { date: '27.05', status: 'future', note: '' },
  ],
  events: [
    {
      type: 'payment',
      date: '11.05.2026',
      note: 'Оплата · 6 занятий — 7 200 ₽ · СБП',
    },
  ],
};

const groups = [{ id: 'g1', name: 'Букварята' }];

describe('selectParentCardData', () => {
  it('uses v2 slots for the same totals as the teacher profile', () => {
    const store = migrateV1ToV2({ students: [student], groups });
    const card = selectParentCardData({
      store,
      legacyStudent: student,
      legacyGroups: groups,
      legacyEvents: student.events,
    });

    expect(card).toMatchObject({
      groupName: 'Букварята',
      remaining: 4,
      total: 6,
    });
    expect(card.subscription.lessons).toHaveLength(6);
    expect(card.subscription.paid).toBe('11.05.2026');
    expect(card.events[0].date).toBe('11.05.2026');
  });

  it('exposes the legacy freeze allowance until freeze periods move to v2', () => {
    const store = migrateV1ToV2({ students: [student], groups });
    const card = selectParentCardData({
      store,
      legacyStudent: student,
      legacyGroups: groups,
      legacyEvents: student.events,
    });

    expect(card.subscription).toMatchObject({
      freezeUsed: 1,
      freezeMax: 3,
    });
  });

  it('falls back safely when v2 is unavailable', () => {
    const card = selectParentCardData({
      store: null,
      legacyStudent: student,
      legacyGroups: groups,
      legacyEvents: student.events,
    });

    expect(card.remaining).toBe(2);
    expect(card.total).toBe(6);
    expect(card.events).toHaveLength(1);
  });
});
