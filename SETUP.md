# Настройка проекта

## 1. Создай проект в Firebase

1. Открой https://console.firebase.google.com
2. «Add project» → придумай название (например, `abonements-tracker`)
3. Отключи Google Analytics (не нужно) → Create project

## 2. Включи Firestore

В левом меню: **Firestore Database** → Create database → Start in **production mode** → выбери регион `europe-west` → Enable

## 3. Включи Authentication

В левом меню: **Authentication** → Get started → **Google** → Enable → вставь свой email в «Support email» → Save

## 4. Зарегистрируй веб-приложение

В левом меню: Project settings (шестерёнка) → **Add app** → Web (значок `</>`)
- Введи название, нажми Register
- Скопируй объект `firebaseConfig`

## 5. Вставь конфиг

Открой `js/firebase-config.js` и замени объект `firebaseConfig` своим.

## 6. Укажи свой email как администратор

Открой `js/auth.js` и замени строку:
```js
const ADMIN_EMAIL = 'твой@gmail.com';
```
на свой Google-аккаунт.

## 7. Настрой правила Firestore

В Firebase Console: **Firestore** → **Rules** → вставь содержимое файла `firestore.rules` → Publish

## 8. Задеплой на хостинг

### Вариант А: Firebase Hosting (рекомендую, бесплатно)

```bash
npm install -g firebase-tools
firebase login
firebase init hosting
# Public directory: . (точка)
# Single-page app: No
# Overwrite index.html: No
firebase deploy
```

### Вариант Б: Просто открыть локально через Live Server (VS Code)

Установи расширение **Live Server** в VS Code и открой `index.html`.

## 9. Первый вход

Открой сайт → нажми «Войти через Google» → войди со своего аккаунта.

---

## Структура данных в Firestore

| Коллекция | Что хранит |
|---|---|
| `students` | Ученики (имя, контакт родителя, токен для ссылки) |
| `groups` | Группы (название, дни недели, время) |
| `subscriptions` | Абонементы (сколько занятий, дата оплаты, использовано) |
| `events` | История: занятие / перенос / заморозка |
