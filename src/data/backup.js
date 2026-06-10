const BACKUP_FORMAT = 'enot-pomogun-backup';
const BACKUP_VERSION = 1;

function clone(value) {
  return structuredClone(value);
}

export function createBackupDocument(snapshot, now = new Date()) {
  if (!snapshot) throw new Error('Нет данных для резервной копии');
  const data = clone(snapshot);
  delete data._sync;
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    data,
  };
}

export function parseBackupDocument(value) {
  const backup = typeof value === 'string' ? JSON.parse(value) : value;
  if (
    !backup ||
    backup.format !== BACKUP_FORMAT ||
    backup.version !== BACKUP_VERSION
  ) {
    throw new Error('Файл не является резервной копией ЕнотПомогун');
  }

  const data = backup.data;
  if (!Array.isArray(data?.students) || !Array.isArray(data?.groups)) {
    throw new Error('В резервной копии отсутствуют ученики или группы');
  }
  if (!data.teacherProfile || typeof data.teacherProfile !== 'object') {
    throw new Error('В резервной копии отсутствует профиль преподавателя');
  }

  const normalized = clone(data);
  delete normalized._sync;
  normalized.scheduleOverrides = normalized.scheduleOverrides || {};
  return {
    data: normalized,
    exportedAt: backup.exportedAt || null,
    studentsCount: normalized.students.length,
    groupsCount: normalized.groups.length,
  };
}

export function createBackupFilename(now = new Date()) {
  return `enot-pomogun-backup-${now.toISOString().slice(0, 10)}.json`;
}
