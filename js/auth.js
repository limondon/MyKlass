import { auth } from './firebase-config.js';
import {
  GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';

// TODO: впиши свой Google-аккаунт — только он сможет войти как админ
const ADMIN_EMAIL = 'твой@gmail.com';

export function requireAdmin(onReady) {
  onAuthStateChanged(auth, user => {
    if (user && user.email === ADMIN_EMAIL) {
      onReady(user);
    } else if (user) {
      signOut(auth);
      showAuthError('Доступ только для администратора');
    } else {
      showLoginScreen();
    }
  });
}

export async function loginWithGoogle() {
  const provider = new GoogleAuthProvider();
  try {
    await signInWithPopup(auth, provider);
  } catch (e) {
    showAuthError('Не удалось войти: ' + e.message);
  }
}

export async function logout() {
  await signOut(auth);
  location.reload();
}

function showLoginScreen() {
  document.body.innerHTML = `
    <div class="login-screen">
      <div class="login-card">
        <div class="login-icon">📋</div>
        <h1>Абонементы</h1>
        <p>Система учёта учеников</p>
        <button class="btn btn-primary" id="loginBtn">
          <svg width="18" height="18" viewBox="0 0 18 18"><path fill="#fff" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18z"/><path fill="#fff" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2.01c-.72.48-1.63.68-2.7.68-2.08 0-3.84-1.4-4.47-3.29H1.88v2.08A8 8 0 0 0 8.98 17z"/><path fill="#fff" d="M4.51 10.44A4.8 4.8 0 0 1 4.26 9c0-.5.1-.98.25-1.44V5.48H1.88A8 8 0 0 0 .98 9c0 .78.14 1.56.4 2.28l2.7-1.84h-.57z"/><path fill="#fff" d="M8.98 3.58c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 0 0 8.98 1a8 8 0 0 0-7.1 4.28l2.63 2.04c.63-1.89 2.39-3.74 4.47-3.74z"/></svg>
          Войти через Google
        </button>
      </div>
    </div>
  `;
  document.getElementById('loginBtn').addEventListener('click', loginWithGoogle);
}

function showAuthError(msg) {
  document.body.innerHTML = `
    <div class="login-screen">
      <div class="login-card">
        <div class="login-icon">🔒</div>
        <h1>Нет доступа</h1>
        <p>${msg}</p>
        <button class="btn btn-primary" id="loginBtn">Войти другим аккаунтом</button>
      </div>
    </div>
  `;
  document.getElementById('loginBtn').addEventListener('click', loginWithGoogle);
}
