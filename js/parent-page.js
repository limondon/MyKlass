import { getStudentByToken, getGroup, getActiveSubscription, getEvents } from './db.js';
import { formatDate, classesLeft, groupDaysLabel, todayStr } from './utils.js';

const params = new URLSearchParams(location.search);
const token = params.get('t');

async function load() {
  if (!token) { showNotFound(); return; }
  try {
    const student = await getStudentByToken(token);
    if (!student) { showNotFound(); return; }

    const [group, sub, events] = await Promise.all([
      student.groupId ? getGroup(student.groupId) : Promise.resolve(null),
      getActiveSubscription(student.id),
      getEvents(student.id)
    ]);

    document.getElementById('loadingState').style.display = 'none';
    document.getElementById('pageContent').style.display = '';

    document.getElementById('pStudentName').textContent = student.name;
    document.getElementById('pGroupName').textContent = group ? group.name : 'Индивидуальные занятия';
    document.title = `Абонемент — ${student.name}`;

    // Subscription
    const left = classesLeft(sub);
    const total = sub?.totalClasses || 0;
    const used = sub?.usedClasses || 0;
    const pct = total > 0 ? Math.round((used / total) * 100) : 0;

    document.getElementById('pSubCard').innerHTML = sub ? `
      <div class="sub-card" style="margin-bottom:12px">
        <div class="label">Абонемент</div>
        <div class="value">${left} занятий осталось</div>
        <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
        <div class="sub-row">
          <div class="col"><div class="label">Всего</div><div style="font-weight:700">${total}</div></div>
          <div class="col"><div class="label">Использовано</div><div style="font-weight:700">${used}</div></div>
          <div class="col"><div class="label">Оплачено</div><div style="font-weight:700">${formatDate(sub.paidDate)}</div></div>
        </div>
      </div>` : `
      <div class="card" style="text-align:center;padding:20px;margin-bottom:12px;color:var(--gray-500)">
        <div>Нет активного абонемента</div>
      </div>`;

    // Schedule
    document.getElementById('pSchedule').innerHTML = group
      ? `<div style="font-weight:600">${groupDaysLabel(group.days)}</div><div style="color:var(--gray-500);font-size:13px;margin-top:2px">Время: ${group.time || '—'}</div>`
      : '<div style="color:var(--gray-500)">—</div>';

    // Upcoming (reschedules and freezes in the future)
    const today = todayStr();
    const upcoming = events.filter(e =>
      (e.type === 'reschedule' || e.type === 'freeze') && (e.toDate >= today || e.date >= today)
    ).slice(0, 5);

    document.getElementById('pUpcoming').innerHTML = upcoming.length
      ? upcoming.map(ev => {
        if (ev.type === 'reschedule') return `
          <div style="padding:8px 0;border-bottom:1px solid var(--gray-100)">
            <div style="font-weight:600;font-size:14px">🔄 Перенос: ${formatDate(ev.date)} → ${formatDate(ev.toDate)}</div>
            ${ev.reason ? `<div style="font-size:12px;color:var(--gray-500);margin-top:2px">${ev.reason}</div>` : ''}
          </div>`;
        if (ev.type === 'freeze') return `
          <div style="padding:8px 0;border-bottom:1px solid var(--gray-100)">
            <div style="font-weight:600;font-size:14px">❄️ Заморозка: ${formatDate(ev.date)} — ${formatDate(ev.toDate)}</div>
            ${ev.reason ? `<div style="font-size:12px;color:var(--gray-500);margin-top:2px">${ev.reason}</div>` : ''}
          </div>`;
        return '';
      }).join('')
      : '<div style="color:var(--gray-500);font-size:13px">Нет предстоящих событий</div>';

    // Timeline (last 20 events, read only)
    const timeline = document.getElementById('pTimeline');
    const shown = events.slice(0, 20);
    timeline.innerHTML = shown.length ? shown.map(ev => {
      if (ev.type === 'lesson') return `
        <div class="event-item">
          <div class="event-dot event-dot-lesson">✅</div>
          <div class="event-body">
            <div class="event-title">Занятие</div>
            <div class="event-meta">${formatDate(ev.date)}</div>
            ${ev.note ? `<div class="event-reason">${ev.note}</div>` : ''}
          </div>
        </div>`;
      if (ev.type === 'reschedule') return `
        <div class="event-item">
          <div class="event-dot event-dot-reschedule">🔄</div>
          <div class="event-body">
            <div class="event-title">Перенос: ${formatDate(ev.date)} → ${formatDate(ev.toDate)}</div>
            <div class="event-meta">${formatDate(ev.date)}</div>
            ${ev.reason ? `<div class="event-reason">${ev.reason}</div>` : ''}
          </div>
        </div>`;
      if (ev.type === 'freeze') return `
        <div class="event-item">
          <div class="event-dot event-dot-freeze">❄️</div>
          <div class="event-body">
            <div class="event-title">Заморозка: ${formatDate(ev.date)} — ${formatDate(ev.toDate)}</div>
            <div class="event-meta">${formatDate(ev.date)}</div>
            ${ev.reason ? `<div class="event-reason">${ev.reason}</div>` : ''}
          </div>
        </div>`;
      return '';
    }).join('') : `<div class="card" style="color:var(--gray-500);text-align:center;padding:20px">История пуста</div>`;

  } catch (e) {
    console.error(e);
    showNotFound();
  }
}

function showNotFound() {
  document.getElementById('loadingState').style.display = 'none';
  document.getElementById('notFoundState').style.display = '';
}

load();
