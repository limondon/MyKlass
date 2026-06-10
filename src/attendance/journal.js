import { LESSON_STATUS } from '../domain/lessons.js';

const WEEKDAYS_RU = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
const MONTHS_RU = [
  'ЯНВ',
  'ФЕВ',
  'МАР',
  'АПР',
  'МАЯ',
  'ИЮН',
  'ИЮЛ',
  'АВГ',
  'СЕН',
  'ОКТ',
  'НОЯ',
  'ДЕК',
];

function pad(value) {
  return String(value).padStart(2, '0');
}

function toDateKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parseDateKey(value) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function startOfPeriod(period, now) {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (period === 'month') {
    start.setDate(1);
  } else if (period === 'sem') {
    start.setMonth(start.getMonth() - 4, 1);
  } else {
    start.setDate(start.getDate() - 13);
  }
  return start;
}

function formatPeriodLabel(period, start, end) {
  if (period === 'sem') {
    return `${MONTHS_RU[start.getMonth()]} – ${MONTHS_RU[end.getMonth()]} ${end.getFullYear()}`;
  }
  if (start.getMonth() === end.getMonth()) {
    return `${start.getDate()} – ${end.getDate()} ${MONTHS_RU[end.getMonth()]} ${end.getFullYear()}`;
  }
  return `${start.getDate()} ${MONTHS_RU[start.getMonth()]} – ${end.getDate()} ${MONTHS_RU[end.getMonth()]} ${end.getFullYear()}`;
}

export function lessonToAttendanceMark(lesson) {
  if (!lesson) return '-';
  if (lesson.legacyStatus === 'absent') return 'A';
  if (lesson.status === LESSON_STATUS.DONE) {
    return /опоздан/i.test(lesson.comment || '') ? 'L' : 'P';
  }
  if (lesson.status === LESSON_STATUS.TRANSFER) return 'M';
  if (
    lesson.status === LESSON_STATUS.SICK ||
    lesson.status === LESSON_STATUS.SICK_WAIT
  ) {
    return 'A';
  }
  return '-';
}

export function attendanceMarkToLegacyChange(mark) {
  const changes = {
    P: { status: 'done', note: '' },
    L: { status: 'done', note: 'Опоздание' },
    A: { status: 'absent', note: '' },
    M: { status: 'transfer', note: '' },
    '-': { status: 'future', note: '' },
  };
  return changes[mark] || null;
}

export function selectAttendanceJournal(
  store,
  {
    studentIds = [],
    period = '2w',
    now = new Date(),
    columnLimit = 12,
  } = {},
) {
  if (!store) {
    return { columns: [], rows: [], label: '' };
  }

  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const start = startOfPeriod(period, end);
  const startKey = toDateKey(start);
  const endKey = toDateKey(end);
  const allowedStudents = new Set(studentIds);
  const subscriptions = new Map(
    store.subscriptions.map((subscription) => [subscription.id, subscription]),
  );
  const lessonIndexes = new Map();

  for (const subscription of store.subscriptions) {
    const positions = new Map(
      subscription.slots.map((slot) => [slot.id, slot.position]),
    );
    store.lessons
      .filter((lesson) => lesson.subscriptionId === subscription.id)
      .sort(
        (a, b) =>
          (positions.get(a.slotId) || 0) - (positions.get(b.slotId) || 0),
      )
      .forEach((lesson, index) => lessonIndexes.set(lesson.id, index));
  }

  const relevantLessons = store.lessons.filter((lesson) => {
    const date = lesson.scheduledAt?.slice(0, 10);
    return (
      date &&
      allowedStudents.has(lesson.studentId) &&
      date >= startKey &&
      date <= endKey
    );
  });
  const dates = [...new Set(relevantLessons.map(
    (lesson) => lesson.scheduledAt.slice(0, 10),
  ))]
    .sort()
    .slice(-columnLimit);
  const lessonsByStudentAndDate = new Map();

  for (const lesson of relevantLessons) {
    const key = `${lesson.studentId}:${lesson.scheduledAt.slice(0, 10)}`;
    if (!lessonsByStudentAndDate.has(key)) {
      lessonsByStudentAndDate.set(key, lesson);
    }
  }

  const columns = dates.map((date) => {
    const parsed = parseDateKey(date);
    return {
      date,
      day: String(parsed.getDate()),
      weekday: WEEKDAYS_RU[parsed.getDay()],
      exportLabel: `${WEEKDAYS_RU[parsed.getDay()]} ${pad(parsed.getDate())}.${pad(parsed.getMonth() + 1)}`,
    };
  });
  const rows = studentIds.map((studentId) => ({
    studentId,
    cells: dates.map((date) => {
      const lesson = lessonsByStudentAndDate.get(`${studentId}:${date}`);
      if (!lesson) return { date, mark: '-', editable: false };
      const subscription = subscriptions.get(lesson.subscriptionId);
      return {
        date,
        mark: lessonToAttendanceMark(lesson),
        editable: true,
        lessonId: lesson.id,
        lessonIndex: lessonIndexes.get(lesson.id),
        activeSubId:
          subscription?.kind === 'main'
            ? 'main'
            : subscription?.legacySubscriptionId,
      };
    }),
  }));

  return {
    columns,
    rows,
    label: formatPeriodLabel(period, start, end),
  };
}

export function summarizeAttendance(rows) {
  const marks = rows.flatMap((row) => row.cells.map((cell) => cell.mark));
  const attended = marks.filter((mark) => ['P', 'L', 'M'].includes(mark)).length;
  const absences = marks.filter((mark) => mark === 'A').length;
  const makeups = marks.filter((mark) => mark === 'M').length;
  const late = marks.filter((mark) => mark === 'L').length;
  const total = attended + absences;

  return {
    attended,
    absences,
    makeups,
    late,
    rate: total ? Math.round((attended / total) * 100) : null,
  };
}
