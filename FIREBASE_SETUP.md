# Подключение Firebase для «ЕнотПомогун»

Проект использует Firebase Realtime Database и вход преподавателя через Google.

## Текущая конфигурация

- Firebase-проект: `enot-a9038`
- База: `https://enot-a9038-default-rtdb.europe-west1.firebasedatabase.app`
- Путь данных: `workspaces/default`
- Аккаунт преподавателя задаётся в `.env.local`.
- Временный аккаунт разработчика при необходимости добавляется туда же.
- Локальная конфигурация хранится в `.env.local` и не попадает в Git.

## 1. Включить вход через Google

1. Открыть [Firebase Console](https://console.firebase.google.com/).
2. Выбрать проект `Enot`.
3. Открыть `Authentication`.
4. Нажать `Get started`, если раздел ещё не настроен.
5. Открыть вкладку `Sign-in method`.
6. Выбрать `Google`.
7. Включить переключатель `Enable`.
8. Выбрать email поддержки проекта.
9. Нажать `Save`.

## 2. Разрешить локальную разработку

В проектах Firebase, созданных после 28 апреля 2025 года, `localhost` может
отсутствовать в списке разрешённых доменов.

1. Открыть `Authentication` → `Settings`.
2. Найти `Authorized domains`.
3. Если `localhost` отсутствует, нажать `Add domain`.
4. Добавить `localhost`.

Для опубликованного сайта затем нужно добавить его реальный домен.

## 3. Опубликовать правила Realtime Database

Шаблон правил находится в `database.rules.example.json`. Скопируйте его в
локальный файл `database.rules.json`, замените тестовые email и не добавляйте
этот файл в публичный Git. Во время разработки правила разрешают доступ
подтверждённым Google-аккаунтам преподавателя и разработчика.
Поле `scheduleOverrides` не является обязательным: Realtime Database не хранит
пустые объекты, поэтому оно появится после первого изменения расписания.

Вариант через Firebase Console:

1. Открыть `Realtime Database`.
2. Перейти на вкладку `Rules`.
3. Вставить содержимое `database.rules.json`.
4. Нажать `Publish`.

Вариант через Firebase CLI:

```powershell
npx firebase-tools login
npx firebase-tools deploy --only database
```

Перед публикацией нужно убедиться, что активен проект `enot-a9038`.

## 4. Проверить вход

1. Запустить приложение: `npm run dev`.
2. Открыть адрес Vite, например `http://127.0.0.1:4180`.
3. Нажать `Войти через Google`.
4. Выбрать разрешённый Google-аккаунт преподавателя.
5. Убедиться, что открылась CRM и в Realtime Database появился узел
   `workspaces/default`.

Другой Google-аккаунт не должен получить доступ. Перед передачей проекта
заказчику аккаунт разработчика нужно удалить из `.env.local` и правил базы.

## Публичные карточки родителей

Карточки публикуются по случайному токену в `publicCards/{token}`. Читать одну
такую карточку можно без входа, но создавать и обновлять её может только
разрешённый аккаунт преподавателя или разработчика. Публичная запись не содержит
телефон и имя родителя, внутренние заметки и другие карточки учеников.

## Firebase Hosting

Production-сборка публикуется из папки `dist`. Перед первой публикацией:

```powershell
npm test
npm run build
npm run deploy:hosting
```

После публикации Firebase выдаст адрес:

```text
https://enot-a9038.web.app
```

Нужно проверить наличие `enot-a9038.web.app` в `Authentication` → `Settings`
→ `Authorized domains`.

Для локальной проверки production-конфигурации:

```powershell
npm run hosting:serve
```

## Важно

- Не включать публичные правила `.read: true` или `.write: true`.
- Не передавать пароль Google-аккаунта, коды подтверждения или service account.
- Firebase web-конфигурация не является секретом; безопасность обеспечивают
  Authentication и правила Realtime Database.
- Публикация правил через CLI заменяет текущие правила в Firebase Console.
