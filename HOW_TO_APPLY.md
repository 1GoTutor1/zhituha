# Как применить всё (3 шага)

## Шаг 1 — фронт в VS Code
```bash
cd путь/до/твоего/репо
git apply --whitespace=fix FINAL_BUNDLE.patch
npm run build   # должно собраться без ошибок
git add -A && git commit -m "visual 00-х + экономика кофе + фикс подписки" && git push
```
Vercel задеплоит автоматически.

## Шаг 2 — база (без этого кофе даст 500, а не 410!)
Supabase → SQL Editor → вставить содержимое supabase_schema.sql ЦЕЛИКОМ → Run.
(начинается с блока drop function — лечит ошибку 42P13)

## Шаг 3 — env на Vercel (Settings → Environment Variables)
BOT_TOKEN, SUPABASE_URL/VITE_SUPABASE_URL, SUPABASE_ANON_KEY,
SUPABASE_SERVICE_ROLE_KEY, WEBHOOK_SECRET, ADMIN_TG_ID=1565288214
