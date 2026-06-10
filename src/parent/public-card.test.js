import { describe, expect, it } from 'vitest';
import {
  createPublicParentCard,
  publicCardToLegacyStudent,
} from './public-card.js';

describe('public parent card', () => {
  it('publishes only the parent-facing student fields', () => {
    const card = createPublicParentCard({
      student: {
        name: 'Лиза Морозова',
        birthDate: '15.03.2020',
        spine: '#123456',
        phone: '+7 999 000-00-00',
        parent: 'Ольга Морозова',
      },
      groupName: 'Подготовка к школе',
      subscription: {
        totalSessions: 8,
        price: 9600,
        lessons: [{ date: '15.05', status: 'done', note: 'private' }],
      },
      remaining: 7,
    });

    expect(card.student).not.toHaveProperty('phone');
    expect(card.student).not.toHaveProperty('parent');
    expect(card.subscription.lessons[0]).not.toHaveProperty('note');
  });

  it('converts a public card for the existing read-only view', () => {
    const student = publicCardToLegacyStudent({
      student: { name: 'Лиза Морозова', group: 'Группа' },
      subscription: {
        totalSessions: 4,
        lessons: [{ date: '15.05', status: 'future' }],
      },
      events: [],
    });

    expect(student.name).toBe('Лиза Морозова');
    expect(student.pack).toBe(4);
  });
});
