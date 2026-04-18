# 立場 BATTLE — Phase 1.5

社会的テーマでAIと本気の議論対決をするスマホゲーム。**Phase 1.5**: ユーザーがAIに直接反論を打ち返せるクイックリプライ機能追加。

## Stack

- **Next.js 14** (App Router) + **TypeScript** + **Tailwind CSS**
- **Claude API** (`claude-sonnet-4-5`) — via Anthropic SDK
- **Supabase** (PostgreSQL) — schema + RLS + service role for server-side writes
- **Zustand** — game state management

## Project structure

```
opinion-battle/
├── src/
│   ├── app/
│   │   ├── layout.tsx              # Root layout
│   │   ├── page.tsx                # Home (list of 3 themes)
│   │   ├── globals.css
│   │   ├── api/
│   │   │   ├── generate-statement/route.ts   # POST: Claude call
│   │   │   └── save-battle/route.ts          # POST: save result
│   │   ├── game/[themeId]/
│   │   │   ├── page.tsx            # Server component (fetches theme)
│   │   │   └── GameClient.tsx      # Main battle loop (client)
│   │   └── result/[battleId]/
│   │       └── page.tsx            # Result screen
│   ├── components/
│   │   ├── ThemeCard.tsx
│   │   ├── HpBar.tsx
│   │   ├── VoteButtons.tsx
│   │   └── AiStatementBubble.tsx   # With 1-char-at-a-time typing effect
│   ├── lib/
│   │   ├── supabase.ts             # Browser + server clients
│   │   ├── claude.ts               # Server-only Claude wrapper + fallback
│   │   └── scoring.ts              # HP deltas + score formula (§2.1)
│   ├── store/
│   │   └── gameStore.ts            # Zustand store
│   └── types/
│       └── index.ts                # Domain + API contract types
├── supabase/
│   ├── schema.sql                  # Tables + indexes + RLS policies
│   └── seeds/
│       ├── seed-themes.sql         # Fixed 3 themes (recommended)
│       └── seed-themes.ts          # Alternative via `npm run seed`
├── .env.local.example
├── package.json
├── tsconfig.json
├── next.config.js
├── tailwind.config.ts
└── postcss.config.js
```

## Setup (~15 min)

### 1. Install

```bash
npm install
```

### 2. Supabase

1. Create a project at https://supabase.com
2. Open **SQL Editor** and run `supabase/schema.sql`
3. Then run `supabase/seeds/seed-themes.sql` to insert the 3 fixed themes
4. From **Project Settings → API**, copy:
   - `URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` → `SUPABASE_SERVICE_ROLE_KEY` ⚠️ server-only

### 3. Anthropic API key

Create one at https://console.anthropic.com/settings/keys.

### 4. Environment

```bash
cp .env.local.example .env.local
# edit .env.local with the values above
```

### 5. Run

```bash
npm run dev
# open http://localhost:3000
```

You should see 3 themes on the home screen. Click one → choose a stance → battle begins.

## How the battle works

| Phase | What happens |
|---|---|
| 0. Select stance | User picks stance A or B from the theme card |
| 1. Init | User HP = 100, AI HP = 100 (the opposing stance) |
| 2. Round 1 AI statement | `/api/generate-statement` calls Claude with round=1, userAction="none" |
| 3. User votes | 👍 like (+15/-5) · 💡 reference (+8/-3) · 🔥 **反論を打つ** |
| 3b. If 🔥 pressed | **`/api/generate-counters` returns 3 counter-argument cards** (data / logic / ethics angles). User picks one → +30 user HP / -35 AI HP, and Claude sees the full counter in round N+1. |
| 4. Next round | Claude generates the next statement with full history (including user counters) |
| 5. Repeat | Rounds 2-7 |
| 6. Finalize | `calculateScore()` runs, result POSTed to `/api/save-battle`, redirect to `/result/:id` |
| 7. Result screen | Score + **"あなたの決定打" section** highlighting the counters the user threw |

If Claude or Supabase fails, the UX falls back gracefully (stance summary as statement; generic counter options; local result screen without DB id).

## Security notes (important)

- `ANTHROPIC_API_KEY` is **only** used server-side in `/api/generate-statement`. Never prefix it with `NEXT_PUBLIC_`.
- `SUPABASE_SERVICE_ROLE_KEY` is **only** used in server code (`getServerSupabase()`). It bypasses RLS.
- Anon browser clients can only read active themes and battle results (enforced by RLS policies in `schema.sql`).

## Phase 1 deviations from the original spec

These are minor corrections made during implementation:

- **Model**: spec says `claude-sonnet-4-20250514`; we use the current stable alias `claude-sonnet-4-5`.
- **API exposure**: the QUICKSTART example called `api.anthropic.com` directly from the client, which would leak the API key. All Claude calls go through a Next.js API route instead.
- **State**: `battleHistory` was previously passed empty; it's now accumulated in the Zustand store and sent back to Claude on each round, so the AI sees prior exchanges.
- **HP clamping**: user HP is allowed to rise above 100 (the spec shows +15/+20 gains without a ceiling), but visually capped at 100% width for the bar.

## Manual test plan (Day 6-7 of QUICKSTART)

1. ✅ Home loads, 3 themes visible
2. ✅ Click a stance → game starts, round 1 AI statement appears with typing effect
3. ✅ Vote 👍 → HP bars animate, round 2 statement arrives
4. ✅ Vote all three types across 7 rounds → result screen appears
5. ✅ Score ≥ 0, result is one of win/loss/draw, rank shown
6. ✅ Supabase Dashboard → `battles` table has the new row with `battle_history` JSON
7. ✅ "もう1回プレイ" returns to home

## Next: Phase 2 (Week 3-4)

- NewsAPI integration
- Daily theme auto-generation via Vercel Cron (`vercel.json` + `/api/generate-theme`)
- Auth (Supabase Auth) → replace `user_id: null` in battles

Then Phase 3: learning loop + 3rd-stance generation.
