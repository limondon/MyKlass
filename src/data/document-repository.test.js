import { describe, expect, it, vi } from 'vitest';
import {
  createLocalDocumentRepository,
  createMemoryDocumentRepository,
} from './document-repository.js';

function createStorage() {
  const values = new Map();
  return {
    getItem: vi.fn((key) => values.get(key) ?? null),
    setItem: vi.fn((key, value) => values.set(key, value)),
  };
}

describe('document repositories', () => {
  it('round-trips a JSON document through local storage', () => {
    const storage = createStorage();
    const repository = createLocalDocumentRepository({
      storage,
      key: 'store',
      eventTarget: null,
    });

    repository.save({ students: [{ id: 's1' }] });

    expect(repository.getSnapshot()).toEqual({
      students: [{ id: 's1' }],
    });
  });

  it('returns null for invalid stored JSON', () => {
    const storage = createStorage();
    storage.setItem('store', '{broken');
    const repository = createLocalDocumentRepository({
      storage,
      key: 'store',
      eventTarget: null,
    });

    expect(repository.getSnapshot()).toBeNull();
  });

  it('publishes external snapshots in the memory adapter', () => {
    const repository = createMemoryDocumentRepository();
    const subscriber = vi.fn();
    repository.subscribe(subscriber);

    repository.publish({ students: [] });

    expect(subscriber).toHaveBeenCalledWith({ students: [] });
  });
});
