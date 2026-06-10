import { describe, expect, it } from 'vitest';
import { migrateV1ToV2 } from '../storage/index.js';
import {
  selectLegacyCompatibleSubscription,
  selectSubscriptionSummary,
  validateLegacyLessonStatusChange,
} from './subscription-profile.js';

const legacy = {
  groups: [{ id: 'g1', name: 'Группа' }],
  students: [
    {
      id: 's1',
      name: 'Кира',
      groupId: 'g1',
      pack: 6,
      price: 7200,
      paid: '11.05.2026',
      time: '16:00',
      lessons: [
        { date: '11.05', status: 'done', note: '' },
        { date: '13.05', status: 'done', note: '' },
        { date: '18.05', status: 'sick', note: '' },
        { date: '20.05', status: 'transfer', note: '' },
        { date: '25.05', status: 'future', note: '' },
        { date: '27.05', status: 'future', note: '' },
      ],
      events: [],
    },
  ],
};

describe('profile subscription selectors', () => {
  it('counts every unconsumed paid slot as remaining', () => {
    const store = migrateV1ToV2(legacy);
    const summary = selectSubscriptionSummary(store, 's1');

    expect(summary).toMatchObject({
      total: 6,
      used: 2,
      remaining: 4,
      refunded: 0,
    });
  });

  it('provides the totalSessions compatibility field for the existing UI', () => {
    const store = migrateV1ToV2(legacy);
    const subscription = selectLegacyCompatibleSubscription(store, 's1');

    expect(subscription.totalSessions).toBe(6);
    expect(subscription.left).toBe(4);
    expect(subscription.lessons[0]).toMatchObject({
      date: '11.05',
      status: 'done',
    });
  });

  it('validates completion through the domain slot rules', () => {
    const store = migrateV1ToV2(legacy);
    const result = validateLegacyLessonStatusChange({
      store,
      studentId: 's1',
      lessonIndex: 4,
      legacyStatus: 'done',
      changedAt: '2026-05-25T17:00:00+03:00',
    });

    expect(result.lesson.status).toBe('done');
    expect(result.slot.status).toBe('consumed');
  });

  it('releases a consumed slot when a lesson status is corrected', () => {
    const store = migrateV1ToV2(legacy);
    const result = validateLegacyLessonStatusChange({
      store,
      studentId: 's1',
      lessonIndex: 0,
      legacyStatus: 'sick-wait',
      changedAt: '2026-05-11T17:00:00+03:00',
    });

    expect(result.lesson.status).toBe('sick-wait');
    expect(result.slot.status).toBe('reserved');
    expect(result.slot.consumedAt).toBeNull();
  });
});
