import { describe, expect, it } from 'vitest';
import {
  createSubscription,
  DomainError,
  SLOT_STATUS,
} from './index.js';

const ids = [
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000002',
  '00000000-0000-4000-8000-000000000003',
  '00000000-0000-4000-8000-000000000004',
];

function deterministicId() {
  return ids.shift();
}

describe('createSubscription', () => {
  it('creates exactly one paid slot per lesson', () => {
    const subscription = createSubscription(
      {
        studentId: 'student_1',
        lessonCount: 3,
        price: 3600,
        createdAt: '2026-06-07T12:00:00+03:00',
      },
      deterministicId,
    );

    expect(subscription.id).toBe(
      'subscription_00000000-0000-4000-8000-000000000001',
    );
    expect(subscription.slots).toHaveLength(3);
    expect(subscription.slots.every((slot) => slot.status === SLOT_STATUS.AVAILABLE))
      .toBe(true);
    expect(subscription.slots.map((slot) => slot.amount)).toEqual([
      1200, 1200, 1200,
    ]);
  });

  it.each([0, -1, 2.5])('rejects invalid lessonCount %s', (lessonCount) => {
    expect(() =>
      createSubscription({
        studentId: 'student_1',
        lessonCount,
        price: 3600,
      }),
    ).toThrow(DomainError);
  });
});
