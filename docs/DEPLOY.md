# Схема деплоя Great Scene (без секретов)

Документ описывает развёртывание приложения `web/` (Next.js + Prisma + PostgreSQL). **Пароли, ключи API и `SSH_ROOT_PASSWORD` в репозиторий не коммитить.**

## Архитектура на сервере

| Компонент | Назначение |
|-----------|------------|
| Docker | PostgreSQL **только для** great-scene, порт хоста **127.0.0.1:5434** (не пересекается с другими БД на 5433 и т.д.) |
| systemd `great-scene.service` | `next start` на **127.0.0.1:3002** |
| nginx | Отдельный vhost на **8081** → прокси на 3002 (не трогать существующие 80/443/8080 других проектов) |

Публичный URL вида: `http://<IP>:8081/lab` (если firewall провайдера пропускает порт).

## Файлы в репозитории

| Путь | Роль |
|------|------|
| `scripts/deploy/docker-compose.prod.yml` | Postgres в Docker, bind localhost |
| `scripts/deploy/great-scene.service` | Unit systemd |
| `scripts/deploy/nginx-great-scene.conf` | Пример конфига nginx |
| `scripts/deploy/remote-install.sh` | Установка на сервере (после копирования кода в `/opt/great-scene`) |
| `scripts/deploy/env.example` | Шаблон переменных **без** реальных значений |
| `scripts/upload_deploy.py` | Упаковка `web/` + `deploy/`, загрузка по SSH (пароль только из переменной окружения) |
| `scripts/rebuild_remote.py` | Пересборка на сервере без полной переустановки |

## Переменные окружения на сервере

Файл `/opt/great-scene/web/.env` (права `600`), типичное содержимое:

- `DATABASE_URL` — строка подключения к Postgres на **5434**
- `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` — должны совпадать с `docker-compose.prod.yml`
- `GEMINI_API_KEY` — опционально для серверного анализа; ключ в лаборатории можно по-прежнему вводить в браузере

**Не задавайте `NODE_ENV=production` в `.env` до установки зависимостей**, иначе `npm ci` не установит devDependencies, нужные для сборки (Tailwind/PostCSS). В unit systemd `NODE_ENV=production` задаётся отдельно для рантайма.

## Установка зависимостей и сборка

На сервере в скрипте используется:

1. `npm ci --include=dev` — ставятся и dev-зависимости
2. `npx prisma migrate deploy`
3. `NODE_ENV=production npm run build`
4. `npm prune --omit=dev` — опционально, после успешной сборки

## Работа с промптами и тестирование

### Где лежат промпты

1. **Блоки по умолчанию** — код `web/src/lib/prompt-builder/default-blocks.ts` (подписи и текст блоков для новых шаблонов / сидов).
2. **Сборка текста** — `web/src/lib/prompt-builder/assemble.ts`: подстановка `{{FANDOM_CANON}}`, `{{SCENE_DETAIL}}`, `{{EMOTION_NOTES}}`, опционально `{{SUBJECT_ANALYSIS}}`, склейка блоков с весами.
3. **В базе** — таблицы Prisma: шаблоны промптов и блоки (создаются сидом `prisma/seed.ts`, редактируются через UI «Шаблон промпта» и секцию «Блоки промпта» на `/lab`).
4. **Фандом** — канон подставляется в блок с плейсхолдером `{{FANDOM_CANON}}` (страница «Фандомы»).
5. **Сцена** — детали сцены в `{{SCENE_DETAIL}}`, эмоции в `{{EMOTION_NOTES}}` (пул сцен пополняется кнопкой дозагрузки сцен в лаборатории).

### Как собрать и проверить промпт

1. Локально: `docker compose up -d` в корне репозитория, в `web/.env` — `DATABASE_URL`, при необходимости `GEMINI_API_KEY`.
2. `cd web && npm ci && npx prisma migrate deploy && npm run db:seed && npm run dev` — открыть `/lab`.
3. Выбрать фандом и (по желанию) сцену, отредактировать блоки промпта, загрузить фото, при необходимости нажать анализ фото.
4. Нажать **«Сгенерировать изображение»** — в ответе смотреть превью и раскрыть **«Собранный промпт»** для проверки текста.
5. История прогонов — раздел **«Прогоны»** (`/lab/runs`): сравнение и оценки.

Секреты (ключ Gemini) для локальных тестов храните только в `.env` или в поле в браузере (localStorage), не коммитьте.
