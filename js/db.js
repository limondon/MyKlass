import { db, IS_DEMO } from './firebase-config.js';
import { MOCK_STUDENTS, MOCK_GROUPS, MOCK_SUBS, MOCK_EVENTS } from './mock-data.js';

// В демо-режиме все функции работают с локальными массивами
// В реальном режиме — с Firestore

let _students = [...MOCK_STUDENTS];
let _groups = [...MOCK_GROUPS];
let _subs = [...MOCK_SUBS];
let _events = { ...MOCK_EVENTS };

function uid() { return Math.random().toString(36).slice(2); }

// ─── Firestore helpers (только в реальном режиме) ──────────
async function fsImport() {
  return import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
}

// ─── Ученики ───────────────────────────────────────────────
export async function getStudents() {
  if (IS_DEMO) return [..._students].sort((a, b) => a.name.localeCompare(b.name));
  const { collection, getDocs, query, orderBy } = await fsImport();
  const snap = await getDocs(query(collection(db, 'students'), orderBy('name')));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getStudent(id) {
  if (IS_DEMO) return _students.find(s => s.id === id) || null;
  const { doc, getDoc } = await fsImport();
  const snap = await getDoc(doc(db, 'students', id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function addStudent(data) {
  if (IS_DEMO) {
    const s = { id: uid(), parentToken: uid(), ...data };
    _students.push(s);
    _events[s.id] = [];
    return s;
  }
  const { collection, addDoc, serverTimestamp } = await fsImport();
  return addDoc(collection(db, 'students'), { ...data, parentToken: uid(), createdAt: serverTimestamp() });
}

export async function updateStudent(id, data) {
  if (IS_DEMO) {
    const i = _students.findIndex(s => s.id === id);
    if (i >= 0) _students[i] = { ..._students[i], ...data };
    return;
  }
  const { doc, updateDoc } = await fsImport();
  return updateDoc(doc(db, 'students', id), data);
}

export async function deleteStudent(id) {
  if (IS_DEMO) { _students = _students.filter(s => s.id !== id); return; }
  const { doc, deleteDoc } = await fsImport();
  return deleteDoc(doc(db, 'students', id));
}

export async function getStudentByToken(token) {
  if (IS_DEMO) return _students.find(s => s.parentToken === token) || null;
  const { collection, getDocs, query, where } = await fsImport();
  const snap = await getDocs(query(collection(db, 'students'), where('parentToken', '==', token)));
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() };
}

// ─── Группы ────────────────────────────────────────────────
export async function getGroups() {
  if (IS_DEMO) return [..._groups].sort((a, b) => a.name.localeCompare(b.name));
  const { collection, getDocs, query, orderBy } = await fsImport();
  const snap = await getDocs(query(collection(db, 'groups'), orderBy('name')));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getGroup(id) {
  if (IS_DEMO) return _groups.find(g => g.id === id) || null;
  const { doc, getDoc } = await fsImport();
  const snap = await getDoc(doc(db, 'groups', id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function addGroup(data) {
  if (IS_DEMO) { const g = { id: uid(), ...data }; _groups.push(g); return g; }
  const { collection, addDoc, serverTimestamp } = await fsImport();
  return addDoc(collection(db, 'groups'), { ...data, createdAt: serverTimestamp() });
}

export async function updateGroup(id, data) {
  if (IS_DEMO) {
    const i = _groups.findIndex(g => g.id === id);
    if (i >= 0) _groups[i] = { ..._groups[i], ...data };
    return;
  }
  const { doc, updateDoc } = await fsImport();
  return updateDoc(doc(db, 'groups', id), data);
}

export async function deleteGroup(id) {
  if (IS_DEMO) { _groups = _groups.filter(g => g.id !== id); return; }
  const { doc, deleteDoc } = await fsImport();
  return deleteDoc(doc(db, 'groups', id));
}

// ─── Абонементы ────────────────────────────────────────────
export async function getSubscriptions(studentId) {
  if (IS_DEMO) return _subs.filter(s => s.studentId === studentId).sort((a, b) => b.paidDate.localeCompare(a.paidDate));
  const { collection, getDocs, query, where, orderBy } = await fsImport();
  const snap = await getDocs(query(collection(db, 'subscriptions'), where('studentId', '==', studentId), orderBy('paidDate', 'desc')));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getActiveSubscription(studentId) {
  if (IS_DEMO) return _subs.find(s => s.studentId === studentId && s.active) || null;
  const { collection, getDocs, query, where } = await fsImport();
  const snap = await getDocs(query(collection(db, 'subscriptions'), where('studentId', '==', studentId), where('active', '==', true)));
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() };
}

export async function addSubscription(data) {
  if (IS_DEMO) {
    const s = { id: uid(), usedClasses: 0, active: true, ...data };
    _subs.push(s);
    return s;
  }
  const { collection, addDoc, serverTimestamp } = await fsImport();
  return addDoc(collection(db, 'subscriptions'), { ...data, usedClasses: 0, active: true, createdAt: serverTimestamp() });
}

export async function updateSubscription(id, data) {
  if (IS_DEMO) {
    const i = _subs.findIndex(s => s.id === id);
    if (i >= 0) _subs[i] = { ..._subs[i], ...data };
    return;
  }
  const { doc, updateDoc } = await fsImport();
  return updateDoc(doc(db, 'subscriptions', id), data);
}

export async function getAllActiveSubscriptions() {
  if (IS_DEMO) return _subs.filter(s => s.active);
  const { collection, getDocs, query, where } = await fsImport();
  const snap = await getDocs(query(collection(db, 'subscriptions'), where('active', '==', true)));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ─── События ───────────────────────────────────────────────
export async function getEvents(studentId) {
  if (IS_DEMO) return (_events[studentId] || []).sort((a, b) => b.date.localeCompare(a.date));
  const { collection, getDocs, query, where, orderBy } = await fsImport();
  const snap = await getDocs(query(collection(db, 'events'), where('studentId', '==', studentId), orderBy('date', 'desc')));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function addEvent(data) {
  if (IS_DEMO) {
    const ev = { id: uid(), ...data };
    if (!_events[data.studentId]) _events[data.studentId] = [];
    _events[data.studentId].push(ev);
    return ev;
  }
  const { collection, addDoc, serverTimestamp } = await fsImport();
  return addDoc(collection(db, 'events'), { ...data, createdAt: serverTimestamp() });
}

export async function updateEvent(id, data) {
  if (IS_DEMO) {
    for (const sid in _events) {
      const i = _events[sid].findIndex(e => e.id === id);
      if (i >= 0) { _events[sid][i] = { ..._events[sid][i], ...data }; return; }
    }
    return;
  }
  const { doc, updateDoc } = await fsImport();
  return updateDoc(doc(db, 'events', id), data);
}

export async function deleteEvent(id) {
  if (IS_DEMO) {
    for (const sid in _events) {
      _events[sid] = _events[sid].filter(e => e.id !== id);
    }
    return;
  }
  const { doc, deleteDoc } = await fsImport();
  return deleteDoc(doc(db, 'events', id));
}

export async function getEventsByDate(dateStr) {
  if (IS_DEMO) {
    const all = Object.values(_events).flat();
    return all.filter(e => e.date === dateStr);
  }
  const { collection, getDocs, query, where } = await fsImport();
  const snap = await getDocs(query(collection(db, 'events'), where('date', '==', dateStr)));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
