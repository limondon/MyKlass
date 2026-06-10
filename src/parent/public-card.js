const PUBLIC_CARD_VERSION = 1;

export function createParentAccessToken() {
  const bytes = new Uint8Array(24);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
}

export function createPublicParentCard({
  student,
  groupName,
  subscription,
  remaining,
  events = [],
  teacherProfile = {},
  now = new Date(),
}) {
  return {
    version: PUBLIC_CARD_VERSION,
    updatedAt: now.toISOString(),
    student: {
      name: student.name,
      birthDate: student.birthDate || null,
      spine: student.spine || '#1F3A2E',
      group: groupName || '',
    },
    subscription: {
      totalSessions: subscription.totalSessions || 0,
      remaining: remaining || 0,
      paid: subscription.paid || null,
      price: subscription.price || 0,
      freezeUsed: subscription.freezeUsed || 0,
      freezeMax: subscription.freezeMax || 3,
      lessons: (subscription.lessons || []).map((lesson) => ({
        date: lesson.date || '',
        status: lesson.status || 'future',
      })),
    },
    events: events.slice(0, 4).map((event) => ({
      type: event.type || '',
      date: event.date || '',
      note: event.note || '',
    })),
    teacher: {
      name: teacherProfile.name || '',
      paymentUrl: teacherProfile.paymentUrl || '',
    },
  };
}

export function publicCardToLegacyStudent(card) {
  if (!card?.student || !card?.subscription) return null;
  const subscription = card.subscription;
  return {
    id: 'public',
    name: card.student.name,
    birthDate: card.student.birthDate,
    spine: card.student.spine,
    group: card.student.group,
    pack: subscription.totalSessions,
    lessons: subscription.lessons || [],
    paid: subscription.paid,
    price: subscription.price,
    freezeUsed: subscription.freezeUsed,
    freezeMax: subscription.freezeMax,
    events: card.events || [],
  };
}
