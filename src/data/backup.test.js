import { describe, expect, it } from 'vitest';
import {
  createBackupDocument,
  createBackupFilename,
  parseBackupDocument,
} from './backup.js';

const snapshot = {
  students: [{ id: 's1' }],
  groups: [{ id: 'g1' }],
  teacherProfile: { name: 'Анна' },
  scheduleOverrides: {},
  _sync: { revision: 7 },
};

describe('backup documents', () => {
  it('exports data without synchronization metadata', () => {
    const backup = createBackupDocument(
      snapshot,
      new Date('2026-06-09T10:00:00.000Z'),
    );
    expect(backup.format).toBe('enot-pomogun-backup');
    expect(backup.data._sync).toBeUndefined();
  });

  it('validates and normalizes an imported backup', () => {
    const parsed = parseBackupDocument(createBackupDocument(snapshot));
    expect(parsed.studentsCount).toBe(1);
    expect(parsed.groupsCount).toBe(1);
    expect(parsed.data.scheduleOverrides).toEqual({});
  });

  it('rejects unrelated JSON files', () => {
    expect(() => parseBackupDocument({ students: [] })).toThrow(
      'не является резервной копией',
    );
  });

  it('creates a dated filename', () => {
    expect(
      createBackupFilename(new Date('2026-06-09T10:00:00.000Z')),
    ).toBe('enot-pomogun-backup-2026-06-09.json');
  });
});
