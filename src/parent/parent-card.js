import { selectLegacyCompatibleSubscription } from '../profile/subscription-profile.js';

export function selectParentCardData({
  store,
  legacyStudent,
  legacyGroups = [],
  legacyEvents = [],
}) {
  if (!legacyStudent) return null;

  const subscription = selectLegacyCompatibleSubscription(
    store,
    legacyStudent.id,
    'main',
  );
  const group =
    store?.groups?.find((item) => item.id === legacyStudent.groupId) ||
    legacyGroups.find((item) => item.id === legacyStudent.groupId);

  const total =
    subscription?.totalSessions ??
    legacyStudent.pack ??
    legacyStudent.lessons?.length ??
    0;
  const remaining =
    subscription?.left ??
    (legacyStudent.lessons || []).filter((lesson) =>
      ['future', 'sick-wait'].includes(lesson.status),
    ).length;

  const lessons = subscription?.lessons || legacyStudent.lessons || [];
  const events = store
    ? store.historyEvents
        .filter(
          (event) =>
            event.studentId === legacyStudent.id &&
            (!subscription || event.subscriptionId === subscription.id),
        )
        .slice()
        .reverse()
        .map((event) => ({
          ...event,
          date: event.occurredAt,
        }))
    : legacyEvents.slice().reverse();

  return {
    student: legacyStudent,
    groupName: group?.name || legacyStudent.group || '',
    subscription: {
      ...legacyStudent,
      ...(subscription || {}),
      paid: subscription?.paidAt || legacyStudent.paid || null,
      totalSessions: total,
      pack: total,
      left: remaining,
      lessons,
      freezeUsed:
        legacyStudent.freezeUsed ??
        legacyStudent.freezeUsedWeeks ??
        subscription?.freezeUsed ??
        0,
      freezeMax:
        legacyStudent.freezeMax ??
        legacyStudent.freezeAllowanceWeeks ??
        subscription?.freezeMax ??
        3,
    },
    remaining,
    total,
    events,
  };
}
