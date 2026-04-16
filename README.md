# Great Scene — generation lab

Исследовательский стенд для отладки вписывания человека в эпичные сцены выбранных вселенных: блоки промпта, пул сцен (до 50 на фандом), анализ фото, генерация через **Gemini Pro Image** (`gemini-3-pro-image-preview`), mock-кошелёк (ledger) под будущую Robokassa.

## Быстрый старт

1. Поднимите PostgreSQL, например из корня репозитория:

   ```bash
   docker compose up -d
   ```

   По умолчанию порт **54321** (см. `docker-compose.yml`). При необходимости поменяйте порт и `DATABASE_URL` в `web/.env`.

2. Установка и миграции:

   ```bash
   cd web
   npm install
   npx prisma migrate dev
   npm run db:seed
   ```

3. Запуск UI:

   ```bash
   npm run dev
   ```

   Откройте [http://localhost:3000/lab](http://localhost:3000/lab), вставьте **Gemini API key** (хранится только в `localStorage` в браузере).

## Структура

- `web/` — Next.js App Router, API routes, Prisma.
- `web/prisma/schema.prisma` — модели: фото, анализ, фандомы, сцены, шаблоны промпта, прогоны, ревью, кошелёк/транзакции.
- `docker-compose.yml` — локальный Postgres.

## Полезное

- Пополнение mock-баланса: `/lab/settings`.
- История и сравнение прогонов: `/lab/runs`.
- Сцены: сначала **Ensure +10 scenes** на странице Prompt Lab (нужен ключ и текстовая модель для JSON-сцен).
