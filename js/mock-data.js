export const MOCK_GROUPS = [
  { id: 'g1', name: 'Младшая группа', days: [1, 3, 5], time: '16:00' },
  { id: 'g2', name: 'Старшая группа', days: [2, 4], time: '18:00' },
];

export const MOCK_STUDENTS = [
  { id: 's1', name: 'Иванова Маша', parentName: 'Ирина', parentPhone: '+79001234567', groupId: 'g1', note: '', parentToken: 'demo-token-1' },
  { id: 's2', name: 'Петров Коля', parentName: 'Андрей', parentPhone: '+79007654321', groupId: 'g1', note: '', parentToken: 'demo-token-2' },
  { id: 's3', name: 'Смирнова Аня', parentName: 'Елена', parentPhone: '+79009876543', groupId: 'g2', note: 'Аллергия на пыль', parentToken: 'demo-token-3' },
  { id: 's4', name: 'Козлов Дима', parentName: 'Сергей', parentPhone: '+79001112233', groupId: 'g2', note: '', parentToken: 'demo-token-4' },
  { id: 's5', name: 'Новикова Соня', parentName: 'Татьяна', parentPhone: '+79005556677', groupId: null, note: 'Индивидуально', parentToken: 'demo-token-5' },
];

export const MOCK_SUBS = [
  { id: 'sub1', studentId: 's1', paidDate: '2026-04-20', totalClasses: 8, usedClasses: 6, amount: 3200, active: true },
  { id: 'sub2', studentId: 's2', paidDate: '2026-05-01', totalClasses: 8, usedClasses: 1, amount: 3200, active: true },
  { id: 'sub3', studentId: 's3', paidDate: '2026-04-15', totalClasses: 8, usedClasses: 7, amount: 3200, active: true },
  { id: 'sub4', studentId: 's4', paidDate: '2026-05-01', totalClasses: 4, usedClasses: 2, amount: 1800, active: true },
  // s5 — нет абонемента
];

export const MOCK_EVENTS = {
  s1: [
    { id: 'e1', studentId: 's1', type: 'lesson', date: '2026-05-05', note: '' },
    { id: 'e2', studentId: 's1', type: 'lesson', date: '2026-04-30', note: '' },
    { id: 'e3', studentId: 's1', type: 'reschedule', date: '2026-04-28', toDate: '2026-05-12', reason: 'Болезнь' },
    { id: 'e4', studentId: 's1', type: 'lesson', date: '2026-04-25', note: '' },
    { id: 'e5', studentId: 's1', type: 'lesson', date: '2026-04-23', note: '' },
    { id: 'e6', studentId: 's1', type: 'freeze', date: '2026-04-10', toDate: '2026-04-18', reason: 'Поездка на море' },
    { id: 'e7', studentId: 's1', type: 'lesson', date: '2026-04-07', note: '' },
  ],
  s2: [
    { id: 'e8', studentId: 's2', type: 'lesson', date: '2026-05-05', note: '' },
  ],
  s3: [
    { id: 'e9', studentId: 's3', type: 'lesson', date: '2026-05-06', note: '' },
    { id: 'e10', studentId: 's3', type: 'lesson', date: '2026-05-01', note: '' },
    { id: 'e11', studentId: 's3', type: 'lesson', date: '2026-04-29', note: '' },
    { id: 'e12', studentId: 's3', type: 'lesson', date: '2026-04-24', note: '' },
    { id: 'e13', studentId: 's3', type: 'lesson', date: '2026-04-22', note: '' },
    { id: 'e14', studentId: 's3', type: 'lesson', date: '2026-04-17', note: '' },
    { id: 'e15', studentId: 's3', type: 'lesson', date: '2026-04-15', note: '' },
  ],
  s4: [
    { id: 'e16', studentId: 's4', type: 'lesson', date: '2026-05-06', note: '' },
    { id: 'e17', studentId: 's4', type: 'lesson', date: '2026-05-01', note: '' },
  ],
  s5: [],
};
