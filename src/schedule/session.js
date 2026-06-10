import { assertIsoDateTime } from '../domain/dates.js';

function timeFromHours(value) {
  const hours = Math.floor(value);
  const minutes = Math.round((value - hours) * 60);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function createSessionFromScheduleBlock(
  block,
  timezoneOffset = '+03:00',
) {
  if (!block?.date) {
    throw new Error('A concrete schedule date is required');
  }

  const startsAt = assertIsoDateTime(
    `${block.date}T${timeFromHours(block.start)}:00${timezoneOffset}`,
    'startsAt',
  );
  const endsAt = assertIsoDateTime(
    `${block.date}T${timeFromHours(block.end)}:00${timezoneOffset}`,
    'endsAt',
  );

  return {
    id: `session_${block.date}_${block.id}`,
    scheduleBlockId: block.id,
    groupId: block.groupId || null,
    studentId: block.studentId || null,
    subject: block.subject || 'Занятие',
    startsAt,
    endsAt,
    status: block.canceled ? 'cancelled' : 'scheduled',
  };
}

export function findLessonIndexForSession(subscription, session) {
  if (!subscription || !session) return -1;
  const sessionDate = session.startsAt.slice(0, 10);
  return (subscription.lessons || []).findIndex(
    (lesson) => lesson.scheduledAt?.slice(0, 10) === sessionDate,
  );
}
