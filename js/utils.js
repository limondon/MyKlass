export const DAYS = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
export const DAYS_FULL = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];

export function formatDate(dateStr) {
  if (!dateStr) return '—';
  const [y, m, d] = dateStr.split('-');
  return `${d}.${m}.${y}`;
}

export function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export function dateToStr(date) {
  return date.toISOString().slice(0, 10);
}

export function addDays(dateStr, n) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + n);
  return dateToStr(d);
}

export function classesLeft(sub) {
  if (!sub) return 0;
  return sub.totalClasses - sub.usedClasses;
}

export function subStatus(sub) {
  if (!sub) return 'none';
  const left = classesLeft(sub);
  if (left <= 0) return 'expired';
  if (left <= 2) return 'warning';
  return 'ok';
}

export function phoneLink(phone) {
  if (!phone) return '';
  const clean = phone.replace(/\D/g, '');
  return `tel:+${clean}`;
}

export function whatsappLink(phone) {
  if (!phone) return '';
  const clean = phone.replace(/\D/g, '');
  return `https://wa.me/${clean}`;
}

export function groupDaysLabel(days) {
  if (!days || !days.length) return '—';
  return days.map(d => DAYS[d]).join(', ');
}

export function showToast(msg, type = 'success') {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.className = `toast toast-${type} show`;
  setTimeout(() => toast.classList.remove('show'), 3000);
}

export function confirm(msg) {
  return window.confirm(msg);
}
