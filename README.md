# ЕнотПомогун

Веб-приложение для частного педагога: ученики, группы, расписание,
посещаемость, абонементы и карточки для родителей.

## Локальный запуск

```bash
npm install
npm run dev
```

Настройки Firebase берутся из `.env.local`. Используйте `.env.example` как
шаблон. Локальный файл с настройками и резервные копии не добавляются в Git.

## Проверка

```bash
npm test
npm run build
```

## Публикация

Production-сборка публикуется в Firebase Hosting:

```bash
npm run deploy:hosting
```

Рабочий адрес: [enot-a9038.web.app](https://enot-a9038.web.app).

Подробная настройка Firebase описана в
[FIREBASE_SETUP.md](./FIREBASE_SETUP.md).
