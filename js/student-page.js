import { requireAdmin, logout } from './auth.js';
import { getStudent, updateStudent, deleteStudent, getGroup, getGroups, getSubscriptions, getActiveSubscription, addSubscription, getEvents, addEvent, deleteEvent } from './db.js';
import { DAYS, formatDate, todayStr, classesLeft, subStatus, groupDaysLabel, showToast } from './utils.js';

const params = new URLSearchParams(location.search);
const studentId = params.get('id');

let student = null, group = null, groups = [], activeSub = null, events = [];

requireAdmin(async () => {
  if (!studentId) { location.href = 'index.html'; return; }
  document.getElementById('app').style.display = '';
  await loadAll();
  renderPage();
  setupModals();
});

async function loadAll() {
  [student, groups, activeSub, events] = await Promise.all([
    getStudent(studentId),
    getGroups(),
    getActiveSubscription(studentId),
    getEvents(studentId)
  ]);
  if (!student) { location.href = 'index.html'; return; }
  group = student.groupId ? groups.find(g => g.id === student.groupId) : null;
}

function renderPage() {
  document.getElementById('pageTitle').textContent = student.name;

  // Subscription card
  const left = classesLeft(activeSub);
  const total = activeSub?.totalClasses || 0;
  const used = activeSub?.usedClasses || 0;
  const pct = total > 0 ? Math.round((used / total) * 100) : 0;
  const status = subStatus(activeSub);

  document.getElementById('subCard').innerHTML = activeSub ? `
    <div class="sub-card" style="margin-bottom:16px">
      <div class="label">Абонемент</div>
      <div class="value">${left} занятий осталось</div>
      <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
      <div class="sub-row">
        <div class="col"><div class="label">Всего</div><div style="font-weight:700">${total}</div></div>
        <div class="col"><div class="label">Использовано</div><div style="font-weight:700">${used}</div></div>
        <div class="col"><div class="label">Оплачено</div><div style="font-weight:700">${formatDate(activeSub.paidDate)}</div></div>
      </div>
      ${activeSub.amount ? `<div style="margin-top:8px;opacity:.75;font-size:13px">💰 ${activeSub.amount.toLocaleString('ru-RU')} ₽</div>` : ''}
    </div>` : `
    <div class="card" style="text-align:center;padding:24px;margin-bottom:16px;color:var(--gray-500)">
      <div style="font-size:32px;margin-bottom:8px">💳</div>
      <div>Нет активного абонемента</div>
    </div>`;

  // Schedule
  document.getElementById('scheduleBlock').innerHTML = group ? `
    <div style="font-weight:700;font-size:15px;margin-bottom:4px">${group.name}</div>
    <div style="color:var(--gray-500);font-size:13px">${groupDaysLabel(group.days)} · ${group.time || '—'}</div>
    ${student.note ? `<div style="margin-top:10px;font-size:13px;border-top:1px solid var(--gray-100);padding-top:10px;color:var(--gray-700)">${student.note}</div>` : ''}
  ` : `<div style="color:var(--gray-500);font-size:13px">Не привязан к группе${student.note ? `<br><br>${student.note}` : ''}</div>`;

  // Parent link
  const parentUrl = `${location.origin}${location.pathname.replace('student.html','parent.html')}?t=${student.parentToken}`;
  document.getElementById('parentLink').value = parentUrl;

  // Timeline
  const timeline = document.getElementById('timeline');
  if (!events.length) {
    timeline.innerHTML = `<div class="card" style="color:var(--gray-500);text-align:center;padding:24px">История пуста</div>`;
    return;
  }

  timeline.innerHTML = events.map(ev => {
    if (ev.type === 'lesson') return `
      <div class="event-item">
        <div class="event-dot event-dot-lesson">✅</div>
        <div class="event-body">
          <div class="event-title">Занятие проведено</div>
          <div class="event-meta">${formatDate(ev.date)}</div>
          ${ev.note ? `<div class="event-reason">${ev.note}</div>` : ''}
        </div>
        <button class="btn btn-ghost btn-icon" onclick="deleteEv('${ev.id}')" title="Удалить">✕</button>
      </div>`;
    if (ev.type === 'reschedule') return `
      <div class="event-item">
        <div class="event-dot event-dot-reschedule">🔄</div>
        <div class="event-body">
          <div class="event-title">Перенос: ${formatDate(ev.date)} → ${formatDate(ev.toDate)}</div>
          <div class="event-meta">${formatDate(ev.date)}</div>
          ${ev.reason ? `<div class="event-reason">${ev.reason}</div>` : ''}
        </div>
        <button class="btn btn-ghost btn-icon" onclick="deleteEv('${ev.id}')" title="Удалить">✕</button>
      </div>`;
    if (ev.type === 'freeze') return `
      <div class="event-item">
        <div class="event-dot event-dot-freeze">❄️</div>
        <div class="event-body">
          <div class="event-title">Заморозка: ${formatDate(ev.date)} — ${formatDate(ev.toDate)}</div>
          <div class="event-meta">${formatDate(ev.date)}</div>
          ${ev.reason ? `<div class="event-reason">${ev.reason}</div>` : ''}
        </div>
        <button class="btn btn-ghost btn-icon" onclick="deleteEv('${ev.id}')" title="Удалить">✕</button>
      </div>`;
    return '';
  }).join('');
}

window.deleteEv = async (id) => {
  if (!confirm('Удалить запись?')) return;
  const ev = events.find(e => e.id === id);
  if (ev?.type === 'lesson' && activeSub) {
    const { updateSubscription } = await import('./db.js');
    await updateSubscription(activeSub.id, { usedClasses: Math.max(0, activeSub.usedClasses - 1) });
  }
  await deleteEvent(id);
  await loadAll();
  renderPage();
  showToast('Удалено');
};

// ─── Modals ───────────────────────────────────────────────
function setupModals() {
  // Edit student
  document.getElementById('editStudentBtn').addEventListener('click', () => {
    const sel = document.getElementById('esGroupId');
    sel.innerHTML = '<option value="">— Без группы —</option>' +
      groups.map(g => `<option value="${g.id}" ${g.id === student.groupId ? 'selected' : ''}>${g.name}</option>`).join('');
    document.getElementById('esName').value = student.name;
    document.getElementById('esParentName').value = student.parentName || '';
    document.getElementById('esParentPhone').value = student.parentPhone || '';
    document.getElementById('esNote').value = student.note || '';
    openModal('editStudentModal');
  });
  document.getElementById('editStudentCancel').addEventListener('click', () => closeModal('editStudentModal'));
  document.getElementById('editStudentSave').addEventListener('click', async () => {
    const name = document.getElementById('esName').value.trim();
    if (!name) return showToast('Введите имя', 'error');
    await updateStudent(studentId, {
      name,
      parentName: document.getElementById('esParentName').value.trim(),
      parentPhone: document.getElementById('esParentPhone').value.trim(),
      groupId: document.getElementById('esGroupId').value || null,
      note: document.getElementById('esNote').value.trim()
    });
    closeModal('editStudentModal');
    await loadAll(); renderPage();
    showToast('Сохранено');
  });
  document.getElementById('deleteStudentBtn').addEventListener('click', async () => {
    if (!confirm(`Удалить ученика ${student.name}? Это действие необратимо.`)) return;
    await deleteStudent(studentId);
    location.href = 'index.html';
  });

  // New subscription
  document.getElementById('newSubBtn').addEventListener('click', () => {
    document.getElementById('subPaidDate').value = todayStr();
    document.getElementById('subTotal').value = '8';
    document.getElementById('subAmount').value = '';
    document.getElementById('subNote').value = '';
    openModal('subModal');
  });
  document.getElementById('subModalCancel').addEventListener('click', () => closeModal('subModal'));
  document.getElementById('subModalSave').addEventListener('click', async () => {
    const paidDate = document.getElementById('subPaidDate').value;
    const total = Number(document.getElementById('subTotal').value);
    if (!paidDate || !total) return showToast('Заполните обязательные поля', 'error');
    if (activeSub) {
      const { updateSubscription } = await import('./db.js');
      await updateSubscription(activeSub.id, { active: false });
    }
    await addSubscription({
      studentId,
      paidDate,
      totalClasses: total,
      amount: Number(document.getElementById('subAmount').value) || null,
      note: document.getElementById('subNote').value.trim()
    });
    closeModal('subModal');
    await loadAll(); renderPage();
    showToast('Абонемент добавлен');
  });

  // Add lesson
  document.getElementById('addLessonBtn').addEventListener('click', () => {
    document.getElementById('lDate').value = todayStr();
    document.getElementById('lNote').value = '';
    openModal('lessonModal');
  });
  document.getElementById('lessonModalCancel').addEventListener('click', () => closeModal('lessonModal'));
  document.getElementById('lessonModalSave').addEventListener('click', async () => {
    const date = document.getElementById('lDate').value;
    if (!date) return showToast('Выберите дату', 'error');
    if (!activeSub) return showToast('Нет активного абонемента', 'error');
    await addEvent({ studentId, type: 'lesson', date, note: document.getElementById('lNote').value.trim() });
    const { updateSubscription } = await import('./db.js');
    await updateSubscription(activeSub.id, { usedClasses: activeSub.usedClasses + 1 });
    closeModal('lessonModal');
    await loadAll(); renderPage();
    showToast('Занятие отмечено ✅');
  });

  // Reschedule
  document.getElementById('addRescheduleBtn').addEventListener('click', () => {
    document.getElementById('rFrom').value = todayStr();
    document.getElementById('rTo').value = '';
    document.getElementById('rReason').value = '';
    openModal('rescheduleModal');
  });
  document.getElementById('rescheduleModalCancel').addEventListener('click', () => closeModal('rescheduleModal'));
  document.getElementById('rescheduleModalSave').addEventListener('click', async () => {
    const from = document.getElementById('rFrom').value;
    const to = document.getElementById('rTo').value;
    if (!from || !to) return showToast('Заполните даты', 'error');
    await addEvent({ studentId, type: 'reschedule', date: from, toDate: to, reason: document.getElementById('rReason').value.trim() });
    closeModal('rescheduleModal');
    await loadAll(); renderPage();
    showToast('Перенос записан 🔄');
  });

  // Freeze
  document.getElementById('addFreezeBtn').addEventListener('click', () => {
    document.getElementById('fFrom').value = todayStr();
    document.getElementById('fTo').value = '';
    document.getElementById('fReason').value = '';
    openModal('freezeModal');
  });
  document.getElementById('freezeModalCancel').addEventListener('click', () => closeModal('freezeModal'));
  document.getElementById('freezeModalSave').addEventListener('click', async () => {
    const from = document.getElementById('fFrom').value;
    const to = document.getElementById('fTo').value;
    if (!from || !to) return showToast('Заполните даты', 'error');
    await addEvent({ studentId, type: 'freeze', date: from, toDate: to, reason: document.getElementById('fReason').value.trim() });
    closeModal('freezeModal');
    await loadAll(); renderPage();
    showToast('Заморозка записана ❄️');
  });

  // Copy link
  document.getElementById('copyLinkBtn').addEventListener('click', () => {
    navigator.clipboard.writeText(document.getElementById('parentLink').value);
    showToast('Ссылка скопирована 📋');
  });
}

function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }
document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-overlay')) e.target.classList.remove('open');
});
