import { describe, expect, it, vi } from 'vitest';
import { createAppStore } from './app-store.js';
import { createMemoryDocumentRepository } from './document-repository.js';

const seed = {
  students: [
    {
      id: 's1',
      groupId: 'g1',
      days: [1],
      lessons: [
        { date: '01.06', status: 'done', note: '' },
        { date: '08.06', status: 'future', note: '' },
      ],
    },
  ],
  groups: [{ id: 'g1', name: 'Букварята' }],
};

describe('app store repository contract', () => {
  it('seeds an empty repository and recalculates used lessons', () => {
    const repository = createMemoryDocumentRepository();
    const store = createAppStore({ repository, seed });

    expect(store.getStudent('s1').used).toBe(1);
    expect(repository.getSnapshot().students[0].used).toBe(1);
    expect(repository.getSnapshot().initialized).toBe(true);
  });

  it('keeps an explicitly initialized database empty', () => {
    const repository = createMemoryDocumentRepository({
      initialized: true,
      groups: [{ id: 'test', name: 'Тестовая группа' }],
      teacherProfile: { name: 'Анна' },
    });
    const store = createAppStore({ repository, seed });

    expect(store.students).toEqual([]);
    expect(store.groups).toHaveLength(1);
    expect(repository.getSnapshot().students).toEqual([]);
  });

  it('persists updates and notifies subscribers', () => {
    const repository = createMemoryDocumentRepository(seed);
    const onCommit = vi.fn();
    const subscriber = vi.fn();
    const store = createAppStore({ repository, seed, onCommit });
    store.subscribe(subscriber);

    store.updateStudent('s1', { status: 'freeze' });

    expect(repository.getSnapshot().students[0].status).toBe('freeze');
    expect(onCommit).toHaveBeenCalledOnce();
    expect(subscriber).toHaveBeenCalledOnce();
  });

  it('keeps the existing store API for groups and extra subscriptions', () => {
    const repository = createMemoryDocumentRepository(seed);
    const store = createAppStore({
      repository,
      seed,
      createId: () => 'fixed',
    });

    store.addExtraSub('s1', { subject: 'Чтение', lessons: [] });
    store.addGroup({ id: 'g2', name: 'Считалочки' });

    expect(store.getStudent('s1').extraSubs[0].id).toBe('esub_fixed');
    expect(store.getGroupName('g2')).toBe('Считалочки');
  });

  it('applies external repository snapshots for future cloud sync', () => {
    const repository = createMemoryDocumentRepository(seed);
    const subscriber = vi.fn();
    const onExternalChange = vi.fn();
    const store = createAppStore({
      repository,
      seed,
      onExternalChange,
    });
    store.subscribe(subscriber);

    repository.publish({
      ...seed,
      students: [{ ...seed.students[0], status: 'freeze' }],
    });

    expect(store.getStudent('s1').status).toBe('freeze');
    expect(onExternalChange).toHaveBeenCalledOnce();
    expect(subscriber).toHaveBeenCalledOnce();
  });

  it('imports legacy schedule overrides when the document has none', () => {
    const repository = createMemoryDocumentRepository(seed);
    const legacyScheduleOverrides = {
      '2026-06-08': { cancelled: ['slot-1'], extra: [] },
    };
    const store = createAppStore({
      repository,
      seed,
      legacyScheduleOverrides,
    });

    expect(store.scheduleOverrides).toEqual(legacyScheduleOverrides);
    expect(repository.getSnapshot().scheduleOverrides).toEqual(
      legacyScheduleOverrides,
    );
  });

  it('persists schedule changes through the shared repository', () => {
    const repository = createMemoryDocumentRepository({
      ...seed,
      scheduleOverrides: {},
    });
    const store = createAppStore({ repository, seed });

    store.updateScheduleOverrides((overrides) => ({
      ...overrides,
      '2026-06-09': { extra: [{ id: 'extra-1' }] },
    }));

    expect(repository.getSnapshot().scheduleOverrides).toEqual({
      '2026-06-09': { extra: [{ id: 'extra-1' }] },
    });
  });

  it('imports and persists the teacher profile', () => {
    const repository = createMemoryDocumentRepository(seed);
    const legacyTeacherProfile = {
      name: 'Анна Сергеевна',
      defaultPrice: 1600,
      paymentUrl: '',
    };
    const store = createAppStore({
      repository,
      seed,
      legacyTeacherProfile,
    });

    store.updateTeacherProfile({
      defaultPrice: 1800,
      paymentUrl: 'https://pay.example/test',
    });

    expect(store.teacherProfile).toMatchObject({
      name: 'Анна Сергеевна',
      defaultPrice: 1800,
      paymentUrl: 'https://pay.example/test',
    });
    expect(repository.getSnapshot().teacherProfile.defaultPrice).toBe(1800);
  });

  it('fills a partial stored teacher profile from legacy defaults', () => {
    const repository = createMemoryDocumentRepository({
      ...seed,
      teacherProfile: { paymentUrl: 'https://pay.example/test' },
    });
    const store = createAppStore({
      repository,
      seed,
      legacyTeacherProfile: {
        name: 'Анна Сергеевна',
        role: 'репетитор',
        defaultPrice: 1600,
        paymentUrl: '',
      },
    });

    expect(store.teacherProfile).toEqual({
      name: 'Анна Сергеевна',
      role: 'репетитор',
      defaultPrice: 1600,
      paymentUrl: 'https://pay.example/test',
    });
  });

  it('replaces the whole document when restoring a backup', () => {
    const repository = createMemoryDocumentRepository(seed);
    const store = createAppStore({ repository, seed });

    store.replaceDocument({
      students: [{ ...seed.students[0], id: 'restored' }],
      groups: [{ id: 'restored-group', name: 'Новая группа' }],
      teacherProfile: { name: 'Новый педагог' },
      scheduleOverrides: {},
    });

    expect(store.students[0].id).toBe('restored');
    expect(store.groups[0].id).toBe('restored-group');
    expect(repository.getSnapshot().teacherProfile.name).toBe('Новый педагог');
  });
});
