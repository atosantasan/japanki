# Japanki

海外のライト層・旅行者向け「1回1分（5問）、音で覚える」日本語学習 PWA。

## Phase 1

- Next.js (App Router) / TypeScript / Tailwind CSS / Vitest
- next-intl（en, zh-TW, zh-CN, ko, th, fr, de, es）
- Zod による多言語辞書スキーマ
- Supabase DDL（`supabase/migrations/001_init.sql`）
- `shuffleChoices`（正解テキスト基準のシャッフル）

## Scripts

```bash
npm run dev
npm run verify
npm run build
```

運用連絡: japankiadm@gmail.com
