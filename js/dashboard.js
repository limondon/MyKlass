import { requireAdmin, logout } from './auth.js';
import { getStudents, getAllActiveSubscriptions, getGroups, addStudent, updateStudent, deleteStudent, addGroup, updateGroup } from './db.js';
import { DAYS, DAYS_FULL, formatDate, todayStr, groupDaysLabel, classesLeft, subStatus, showToast } from './utils.js';

let students = [], groups = [], activeSubs = [];
let editingStudentId = null, editingGroupId = null;

requireAdmin(async () => {
  document.getElementById('app').style.display = '';
  document.getElementById('logoutBtn').addEventListener('click', logout);
  setupTabs();
  await loadAll();
  renderToday();
  renderStudents();
  renderGroups();
  setupStudentModal();
  setupGroupModal();
});

async function loadAll() {
  [students, groups, activeSubs] = await Promise.all([
    getStudents(),
    getGroups(),
    getAllActiveSubscriptions()
  ]);
}

// ─── Tabs ─────────────────────────────────────────────────
function setupTabs() {
  document.querySelectorAll('.nav-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      ['today', 'students', 'groups'].forEach(t => {
        document.getElementById(`tab-${t}`).style.display = btn.dataset.tab === t ? '' : 'none';
      });
    });
  });
}

// ─── Today ────────────────────────────────────────────────
function renderToday() {
  const today = new Date();
  const dayOfWeek = today.getDay();
  document.getElementById('todayDate').textContent = today.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
  document.getElementById('todayDay').textContent = DAYS_FULL[dayOfWeek];

  const todayGroups = groups.filter(g => g.days && g.days.includes(dayOfWeek));
  const container = document.getElementById('todayGroups');

  if (!todayGroups.length) {
    container.innerHTML = `<div class="card" style="color:var(--gray-500);text-align:center;padding:24px">Занятий нет</div>`;
  } else {
    container.innerHTML = todayGroups.map(g => {
      const groupStudents = students.filter(s => s.groupId === g.id);
      return `
        <div class="card" style="margin-bottom:8px">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
            <div style="font-weight:700;font-size:16px">${g.name}</div>
            <span class="badge badge-group">${g.time || '—'}</span>
          </div>
          ${groupStudents.length ? groupStudents.map(s => {
            const sub = activeSubs.find(sb => sb.studentId === s.id);
            const status = subStatus(sub);
            const left = classesLeft(sub);
            return `<div style="display:flex;align-items:center;justify-content:space-between;padding:6px 0;border-top:1px solid var(--gray-100)">
              <a href="student.html?id=${s.id}" style="font-weight:500;color:inherit;text-decoration:none">${s.name}</a>
              <span class="badge badge-${status}">${left > 0 ? `${left} занятий` : 'Нет абонемента'}</span>
            </div>`;
          }).join('') : '<div style="color:var(--gray-500);font-size:13px">Нет учеников в группе</div>'}
        </div>`;
    }).join('');
  }

  // Expiring
  const expiring = activeSubs.filter(s => classesLeft(s) <= 2);
  const expiringContainer = document.getElementById('expiringList');
  if (!expiring.length) {
    expiringContainer.innerHTML = `<div style="color:var(--gray-500);font-size:14px;padding:8px 0">Всё в порядке</div>`;
  } else {
    expiringContainer.innerHTML = expiring.map(sub => {
      const student = students.find(s => s.id === sub.studentId);
      if (!student) return '';
      const left = classesLeft(sub);
      return `<a href="student.html?id=${student.id}" class="student-item">
        <div class="student-avatar" style="background:${left <= 0 ? '#e74c3c' : '#f39c12'}">${student.name[0]}</div>
        <div class="student-info">
          <div class="student-name">${student.name}</div>
          <div class="student-meta">${left <= 0 ? 'Абонемент закончился' : `Осталось ${left} занятия`}</div>
        </div>
        <span class="badge badge-${left <= 0 ? 'expired' : 'warning'}">${left <= 0 ? '!' : left}</span>
      </a>`;
    }).join('');
  }
}

// ─── Students ─────────────────────────────────────────────
function studentColor(name) {
  const colors = ['#6c63ff','#e74c3c','#27ae60','#f39c12','#3498db','#9b59b6','#1abc9c','#e67e22'];
  let hash = 0;
  for (const c of name) hash = c.charCodeAt(0) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function renderStudents() {
  const container = document.getElementById('studentsList');
  if (!students.length) {
    container.innerHTML = `<div class="empty-state"><div class="icon">👤</div><p>Нет учеников. Добавьте первого!</p></div>`;
    return;
  }
  container.innerHTML = students.map(s => {
    const sub = activeSubs.find(sb => sb.studentId === s.id);
    const status = subStatus(sub);
    const left = classesLeft(sub);
    const group = groups.find(g => g.id === s.groupId);
    return `<a href="student.html?id=${s.id}" class="student-item">
      <div class="student-avatar" style="background:${studentColor(s.name)}">${s.name[0]}</div>
      <div class="student-info">
        <div class="student-name">${s.name}</div>
        <div class="student-meta">${group ? group.name : 'Без группы'}${s.parentName ? ` · ${s.parentName}` : ''}</div>
      </div>
      <span class="badge badge-${status}">${status === 'none' ? 'Нет абонемента' : `${left} зан.`}</span>
    </a>`;
  }).join('');
}

// ─── Groups ───────────────────────────────────────────────
function renderGroups() {
  const container = document.getElementById('groupsList');
  if (!groups.length) {
    container.innerHTML = `<div class="empty-state"><div class="icon">👥</div><p>Нет групп. Создайте первую!</p></div>`;
    return;
  }
  container.innerHTML = groups.map(g => {
    const count = students.filter(s => s.groupId === g.id).length;
    return `<div class="card" style="display:flex;align-items:center;gap:12px;cursor:pointer" onclick="openEditGroup('${g.id}')">
      <div style="flex:1">
        <div style="font-weight:700;font-size:16px">${g.name}</div>
        <div style="font-size:13px;color:var(--gray-500);margin-top:2px">${groupDaysLabel(g.days)} · ${g.time || '—'} · ${count} чел.</div>
      </div>
      <span style="font-size:20px">✏️</span>
    </div>`;
  }).join('');
}

window.openEditGroup = (id) => {
  editingGroupId = id;
  const g = groups.find(g => g.id === id);
  if (!g) return;
  document.getElementById('groupModalTitle').textContent = 'Редактировать группу';
  document.getElementById('gName').value = g.name;
  document.getElementById('gTime').value = g.time || '';
  document.querySelectorAll('#gDayChips .day-chip').forEach(chip => {
    chip.classList.toggle('selected', (g.days || []).includes(Number(chip.dataset.day)));
  });
  openModal('groupModal');
};

// ─── Student modal ─────────────────────────────────────────
function setupStudentModal() {
  document.getElementById('addStudentBtn').addEventListener('click', () => {
    editingStudentId = null;
    document.getElementById('studentModalTitle').textContent = 'Новый ученик';
    ['sName','sParentName','sParentPhone','sNote'].forEach(id => document.getElementById(id).value = '');
    populateGroupSelect('sGroupId');
    openModal('studentModal');
  });
  document.getElementById('studentModalCancel').addEventListener('click', () => closeModal('studentModal'));
  document.getElementById('studentModalSave').addEventListener('click', saveStudent);
}

async function saveStudent() {
  const name = document.getElementById('sName').value.trim();
  if (!name) return showToast('Введите имя ученика', 'error');
  const data = {
    name,
    parentName: document.getElementById('sParentName').value.trim(),
    parentPhone: document.getElementById('sParentPhone').value.trim(),
    groupId: document.getElementById('sGroupId').value || null,
    note: document.getElementById('sNote').value.trim()
  };
  try {
    if (editingStudentId) {
      await updateStudent(editingStudentId, data);
      showToast('Сохранено');
    } else {
      await addStudent(data);
      showToast('Ученик добавлен');
    }
    closeModal('studentModal');
    await loadAll();
    renderStudents();
    renderToday();
  } catch (e) {
    showToast('Ошибка: ' + e.message, 'error');
  }
}

// ─── Group modal ───────────────────────────────────────────
function setupGroupModal() {
  const chipsContainer = document.getElementById('gDayChips');
  DAYS.forEach((day, i) => {
    const chip = document.createElement('button');
    chip.className = 'day-chip';
    chip.textContent = day;
    chip.dataset.day = i;
    chip.addEventListener('click', () => chip.classList.toggle('selected'));
    chipsContainer.appendChild(chip);
  });

  document.getElementById('addGroupBtn').addEventListener('click', () => {
    editingGroupId = null;
    document.getElementById('groupModalTitle').textContent = 'Новая группа';
    document.getElementById('gName').value = '';
    document.getElementById('gTime').value = '';
    document.querySelectorAll('#gDayChips .day-chip').forEach(c => c.classList.remove('selected'));
    openModal('groupModal');
  });
  document.getElementById('groupModalCancel').addEventListener('click', () => closeModal('groupModal'));
  document.getElementById('groupModalSave').addEventListener('click', saveGroup);
}

async function saveGroup() {
  const name = document.getElementById('gName').value.trim();
  if (!name) return showToast('Введите название группы', 'error');
  const days = [...document.querySelectorAll('#gDayChips .day-chip.selected')].map(c => Number(c.dataset.day));
  const data = { name, days, time: document.getElementById('gTime').value };
  try {
    if (editingGroupId) {
      await updateGroup(editingGroupId, data);
      showToast('Группа сохранена');
    } else {
      await addGroup(data);
      showToast('Группа создана');
    }
    closeModal('groupModal');
    await loadAll();
    renderGroups();
    renderToday();
  } catch (e) {
    showToast('Ошибка: ' + e.message, 'error');
  }
}

// ─── Helpers ──────────────────────────────────────────────
function populateGroupSelect(selectId) {
  const sel = document.getElementById(selectId);
  sel.innerHTML = '<option value="">— Без группы —</option>' +
    groups.map(g => `<option value="${g.id}">${g.name}</option>`).join('');
}

function openModal(id) {
  document.getElementById(id).classList.add('open');
}
function closeModal(id) {
  document.getElementById(id).classList.remove('open');
}

document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('open');
  }
});
