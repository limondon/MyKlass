import { describe, expect, it, vi } from 'vitest';
import { createMemoryDocumentRepository } from './document-repository.js';
import { createMirroredDocumentRepository } from './mirrored-document-repository.js';

function createRemote(initial = null) {
  let subscriber;
  let revision = initial == null ? 0 : 1;
  const withSync = (snapshot, nextRevision, clientId = 'other-client') =>
    snapshot == null
      ? null
      : {
          ...snapshot,
          _sync: {
            revision: nextRevision,
            updatedAt: 1000 + nextRevision,
            updatedBy: 'teacher@example.com',
            clientId,
          },
        };
  return {
    clientId: 'test-client',
    save: vi.fn(async (snapshot, { expectedRevision }) => {
      expect(expectedRevision).toBe(revision);
      revision += 1;
      return withSync(snapshot, revision, 'test-client');
    }),
    subscribe: vi.fn((next) => {
      subscriber = next;
      next(withSync(initial, revision));
      return vi.fn();
    }),
    publish(snapshot) {
      revision += 1;
      subscriber(withSync(snapshot, revision));
    },
  };
}

function createDelayedRemote() {
  let subscriber;
  return {
    clientId: 'test-client',
    save: vi.fn(async () => {}),
    subscribe: vi.fn((next) => {
      subscriber = next;
      return vi.fn();
    }),
    publish(snapshot) {
      subscriber({
        ...snapshot,
        _sync: {
          revision: 1,
          updatedAt: 1001,
          updatedBy: 'teacher@example.com',
          clientId: 'other-client',
        },
      });
    },
  };
}

describe('mirrored document repository', () => {
  it('uploads the local snapshot when Firebase is empty', async () => {
    const local = createMemoryDocumentRepository({ students: [{ id: 's1' }] });
    const remote = createRemote(null);

    createMirroredDocumentRepository({ localRepository: local, remote });
    await Promise.resolve();

    expect(remote.save).toHaveBeenCalledWith(
      { students: [{ id: 's1' }] },
      { expectedRevision: 0 },
    );
  });

  it('applies a newer remote snapshot locally', () => {
    const local = createMemoryDocumentRepository({ students: [{ id: 's1' }] });
    const remote = createRemote({ students: [{ id: 's2' }] });
    const repository = createMirroredDocumentRepository({
      localRepository: local,
      remote,
    });
    const subscriber = vi.fn();
    repository.subscribe(subscriber);

    remote.publish({ students: [{ id: 's3' }] });

    expect(local.getSnapshot()).toMatchObject({
      students: [{ id: 's3' }],
      _sync: { revision: 2 },
    });
    expect(subscriber).toHaveBeenCalledWith(
      expect.objectContaining({
        students: [{ id: 's3' }],
        _sync: expect.objectContaining({ revision: 2 }),
      }),
    );
  });

  it('writes locally before starting remote synchronization', () => {
    const local = createMemoryDocumentRepository();
    const remote = createRemote(null);
    const repository = createMirroredDocumentRepository({
      localRepository: local,
      remote,
    });

    repository.save({ students: [{ id: 's1' }] });

    expect(repository.getSnapshot()).toEqual({
      students: [{ id: 's1' }],
    });
    expect(remote.save).toHaveBeenCalled();
  });

  it('does not overwrite existing Firebase data before the first read', () => {
    const local = createMemoryDocumentRepository({
      students: [{ id: 'local' }],
    });
    const remote = createDelayedRemote();
    const repository = createMirroredDocumentRepository({
      localRepository: local,
      remote,
    });

    repository.save({ students: [{ id: 'pending-local' }] });
    expect(remote.save).not.toHaveBeenCalled();

    remote.publish({ students: [{ id: 'cloud' }] });

    expect(remote.save).not.toHaveBeenCalled();
    expect(repository.getSnapshot()).toMatchObject({
      students: [{ id: 'cloud' }],
      _sync: { revision: 1 },
    });
  });

  it('restores the cloud snapshot when a stale write conflicts', async () => {
    const cloudSnapshot = {
      students: [{ id: 'cloud-newer' }],
      _sync: {
        revision: 2,
        updatedAt: 1002,
        updatedBy: 'other@example.com',
        clientId: 'other-client',
      },
    };
    let subscriber;
    const remote = {
      clientId: 'test-client',
      subscribe: vi.fn((next) => {
        subscriber = next;
        next({
          students: [{ id: 'cloud-old' }],
          _sync: {
            revision: 1,
            updatedAt: 1001,
            updatedBy: 'teacher@example.com',
            clientId: 'other-client',
          },
        });
        return vi.fn();
      }),
      save: vi.fn(async () => {
        const error = new Error('conflict');
        error.code = 'sync/conflict';
        error.serverSnapshot = cloudSnapshot;
        throw error;
      }),
      publish(snapshot) {
        subscriber(snapshot);
      },
    };
    const statuses = [];
    const local = createMemoryDocumentRepository();
    const repository = createMirroredDocumentRepository({
      localRepository: local,
      remote,
      onStatus: (status) => statuses.push(status),
    });

    repository.save({ students: [{ id: 'local-change' }] });
    await Promise.resolve();
    await Promise.resolve();

    expect(repository.getSnapshot()).toEqual(cloudSnapshot);
    expect(statuses.at(-1)).toMatchObject({
      state: 'conflict',
      revision: 2,
    });
  });
});
