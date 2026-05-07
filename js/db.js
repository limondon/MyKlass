import { db } from './firebase-config.js';
import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  getDoc, getDocs, query, where, orderBy, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

// ─── Ученики ───────────────────────────────────────────────
export async function getStudents() {
  const snap = await getDocs(query(collection(db, 'students'), orderBy('name')));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getStudent(id) {
  const snap = await getDoc(doc(db, 'students', id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function addStudent(data) {
  const token = crypto.randomUUID();
  return addDoc(collection(db, 'students'), { ...data, parentToken: token, createdAt: serverTimestamp() });
}

export async function updateStudent(id, data) {
  return updateDoc(doc(db, 'students', id), data);
}

export async function deleteStudent(id) {
  return deleteDoc(doc(db, 'students', id));
}

export async function getStudentByToken(token) {
  const snap = await getDocs(query(collection(db, 'students'), where('parentToken', '==', token)));
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() };
}

// ─── Группы ────────────────────────────────────────────────
export async function getGroups() {
  const snap = await getDocs(query(collection(db, 'groups'), orderBy('name')));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getGroup(id) {
  const snap = await getDoc(doc(db, 'groups', id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function addGroup(data) {
  return addDoc(collection(db, 'groups'), { ...data, createdAt: serverTimestamp() });
}

export async function updateGroup(id, data) {
  return updateDoc(doc(db, 'groups', id), data);
}

export async function deleteGroup(id) {
  return deleteDoc(doc(db, 'groups', id));
}

// ─── Абонементы ────────────────────────────────────────────
export async function getSubscriptions(studentId) {
  const snap = await getDocs(query(
    collection(db, 'subscriptions'),
    where('studentId', '==', studentId),
    orderBy('paidDate', 'desc')
  ));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getActiveSubscription(studentId) {
  const snap = await getDocs(query(
    collection(db, 'subscriptions'),
    where('studentId', '==', studentId),
    where('active', '==', true)
  ));
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() };
}

export async function addSubscription(data) {
  return addDoc(collection(db, 'subscriptions'), {
    ...data,
    usedClasses: 0,
    active: true,
    createdAt: serverTimestamp()
  });
}

export async function updateSubscription(id, data) {
  return updateDoc(doc(db, 'subscriptions', id), data);
}

// ─── События (занятия, переносы, заморозки) ────────────────
export async function getEvents(studentId) {
  const snap = await getDocs(query(
    collection(db, 'events'),
    where('studentId', '==', studentId),
    orderBy('date', 'desc')
  ));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getEventsByDate(dateStr) {
  const snap = await getDocs(query(
    collection(db, 'events'),
    where('date', '==', dateStr)
  ));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function addEvent(data) {
  return addDoc(collection(db, 'events'), { ...data, createdAt: serverTimestamp() });
}

export async function updateEvent(id, data) {
  return updateDoc(doc(db, 'events', id), data);
}

export async function deleteEvent(id) {
  return deleteDoc(doc(db, 'events', id));
}

// ─── Все активные абонементы (для дашборда) ─────────────────
export async function getAllActiveSubscriptions() {
  const snap = await getDocs(query(
    collection(db, 'subscriptions'),
    where('active', '==', true)
  ));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
