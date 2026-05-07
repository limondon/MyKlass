import { auth, IS_DEMO } from './firebase-config.js';

// TODO: впиши свой Google-аккаунт — только он сможет войти как админ
const ADMIN_EMAIL = 'твой@gmail.com';

export function requireAdmin(onReady) {
  if (IS_DEMO) {
    showDemoBanner();
    onReady({ email: 'demo' });
    return;
  }

  const { GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } =
    window.__firebaseAuth || {};

  import('https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js').then(m => {
    m.onAuthStateChanged(auth, user => {
      if (user && user.email === ADMIN_EMAIL) {
        onReady(user);
      } else if (user) {
        m.signOut(auth);
        showAuthError('Доступ только для администратора');
      } else {
        showLoginScreen(m);
      }
    });
  });
}

export async function logout() {
  const m = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js');
  await m.signOut(auth);
  location.reload();
}

function showDemoBanner() {
  const banner = document.createElement('div');
  banner.style.cssText = 'background:#f39c12;color:#fff;text-align:center;padding:8px;font-size:13px;font-weight:600;position:sticky;top:56px;z-index:99';
  banner.textContent = '🔧 Демо-режим — данные ненастоящие. Подключи Firebase чтобы начать работу.';
  document.body.insertAdjacentElement('afterbegin', banner);
}

function showLoginScreen(m) {
  document.body.innerHTML = `
    <div class="login-screen">
      <div class="login-card">
        <div class="login-icon">📋</div>
        <h1>Абонементы</h1>
        <p>Система учёта учеников</p>
        <button class="btn btn-primary" id="loginBtn">
          Войти через Google
        </button>
      </div>
    </div>
  `;
  document.getElementById('loginBtn').addEventListener('click', async () => {
    const provider = new m.GoogleAuthProvider();
    try { await m.signInWithPopup(auth, provider); }
    catch (e) { alert('Ошибка входа: ' + e.message); }
  });
}

function showAuthError(msg) {
  document.body.innerHTML = `
    <div class="login-screen">
      <div class="login-card">
        <div class="login-icon">🔒</div>
        <h1>Нет доступа</h1>
        <p>${msg}</p>
        <button class="btn btn-primary" onclick="location.reload()">Попробовать снова</button>
      </div>
    </div>
  `;
}
