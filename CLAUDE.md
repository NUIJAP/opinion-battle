# 論獄 (RONGOKU) — Claude Code 引き継ぎ資料

> **このファイルは Claude Code が毎回自動で読む** プロジェクト知識ファイルです。
> 作業を始める前に必ず全文を読み、現状を把握してから計画を立ててください。

## プロジェクト概要

毎朝のニュースをテーマに、AI獄吏たちと議論で戦うダークゲーム。

- **旧称**: 立場BATTLE (opinion-battle) ← コード上ではまだこの名前が残っている
- **現称(暫定)**: 論獄 (RONGOKU)
- **ターゲット**: 20-40代の日本人スマホユーザー
- **プレイ時間**: 1プレイ 60-180秒
- **トーン**: ダーク・挑発的・知的 (ペルソナ5 / ニーチェ / デスノート系)

## 技術スタック

- **フロント**: Next.js 14 App Router + TypeScript + Tailwind CSS
- **DB**: Supabase (PostgreSQL + RLS)
- **AI**: Anthropic SDK (`claude-sonnet-4-5`)
- **State**: Zustand

## 現在のフェーズ

**Phase 2A Stage B (バックエンド+UI 完了 / Supabase 適用待ち)**

### 完了済み
- [x] Phase 1 (MVP): 固定3テーマで AI vs ユーザー議論、Supabase保存まで
- [x] Phase 1.5: クイックリプライ (counter) 機能、結果画面に決定打表示
- [x] Phase 2A Week 1 バックエンド層:
  - DB マイグレーション (`supabase/migrations/phase2a-week1.sql`) — **未適用なら手動適用が必要**
  - ai_levels, user_ranks, anon_users, theme_mastery, daily_matchups テーブル設計済み
  - マッチメイキング (`src/lib/matchmaking.ts`) — 格下1/同格1/格上1配分
  - ランキング (`src/lib/ranking.ts`) — 16段階、RPは減らない
  - anon ユーザー管理 (`src/lib/users.ts`)
  - API: `/api/daily-matchup`, `/api/save-battle` (RP計算対応)
- [x] Phase 2A Stage A — 10体の獄吏キャラへの拡張:
  - DB マイグレーション (`supabase/migrations/phase2a-stage-a.sql`) — **未適用なら手動適用が必要**
    - `ai_levels` の `id between 1 and 5` 制約を削除
    - `tier`, `stat_iq`, `stat_venom`, `stat_wit`, `stat_depth`, `personality`, `specialty`, `weakness`, `appearance`, `catchphrase` カラム追加 (additive)
    - 10体の獄吏 (囁/惰/量/憤/嘲/詭/識/狂/真/黙) を `ON CONFLICT DO UPDATE` で seed (id 1-5 は旧データを上書き)
  - `src/types/index.ts` の `AiLevel` を4軸stat+ペルソナ拡張 (additive optional)
  - `src/lib/ai-levels.ts` の `FALLBACK_AI_LEVELS` を10体に差し替え + `tierForId(id)` ヘルパー追加
  - `src/lib/claude.ts` の prompt をキャラ強化:
    - personality/specialty/weakness/catchphrase/4軸stat を prompt に展開
    - 文字数指定を `lengthWindow(level)` でキャラ別に動的化 (黙=30-60字、識=160-200字 等)
    - counter 生成も相手キャラの弱点を活かす
  - `src/lib/matchmaking.ts` を tier 軸で 10体から選ぶロジックに変更 (1日3体は重複しない)
  - `src/lib/ranking.ts` の `getUserAiLevel` → `getUserTier` (alias 残す)、`calculateRpAward` を tier 基準に
  - `/api/save-battle` を tier 基準に追従
- [x] Phase 2A Stage A UI 層:
  - `src/app/page.tsx` をクライアント化、`/api/daily-matchup` から3マッチアップ取得→表示。anon userId は `localStorage` 永続化 (`rongoku.anonUserId`)
  - 新規コンポーネント: `MatchupCard.tsx` / `AiCharacterBadge.tsx` (compact + card variant) / `RankDisplay.tsx` / `RpBonus.tsx`
  - `src/app/game/[themeId]/page.tsx` を `matchupId`/`aiLevel` searchParams 対応 + サーバー側で `getAiLevelById` 解決
  - `GameClient.tsx` を AiLevel 受け取り対応、HPバー/吹き出しに獄吏名表示、API呼出に `aiLevelId` 付与、save-battle に `matchup_id`/`ai_level_id`/`anon_user_id` 送信、結果を `sessionStorage` (`rongoku.lastBattleResult`) に stash
  - `src/app/result/[battleId]/page.tsx` 上部に `<RpBonus>` を追加 (sessionStorage から RP 獲得値を読み、カウントアップ + RANK UP! バッジ)
- [x] 型チェック (`npx tsc --noEmit`) + 本番ビルド (`npm run build`) 通過

- [x] Phase 2A Stage B — 戦闘モデル全面刷新:
  - DB マイグレーション (`supabase/migrations/phase2a-stage-b.sql`) — **未適用なら手動適用が必要**
    - `themes.topic_axes jsonb` 追加 + 既存3テーマに 8軸重要度 seed
    - `ai_levels` に8軸列追加 (ax_data/ethics/emotion/persuasion/flexibility/aggression/calm/humor) + 10獄吏に再 seed
    - `user_stats` 新規テーブル (anon_user × 8軸 + samples)
    - `battles` に `ended_by_hp_zero` / `helpers_summoned` 列追加
  - 戦闘モデル: 「いいね/参考/反論」3択ボタン + 反論カード を全廃 → ユーザーがテキスト直接入力
  - お助け獄吏システム: 戦闘中の獄吏を除く9体から3体ランダム + テーマ8軸とのコサイン類似度マッチ%表示。召喚で -10HP、ラウンドあたり1体まで
  - HP=0 で即終了 + 全画面演出 (`HpZeroOverlay.tsx`)。AI発言で常時ユーザーHP削れ、ユーザー応答強度で AI HP 削れ + AIダメージ軽減
  - Claude 1呼び出しで「ユーザー応答8軸評価 + AI反撃文 + ダメージ算出」を返す形式に書き直し
  - ユーザー性格8軸 (`user_stats`) を各バトル終了時に染まり更新 (お助け獄吏は半重み)
  - 結果画面に 8軸レーダー (`PersonalityRadar.tsx` SVG) + 性格タイプ (ルールベース、Claude呼ばず) + 相性キャラ表示。samples<5 なら「判定中…」
  - `/api/helper-pick` 新規 / `/api/user-stats` 新規 / `/api/generate-counters` 廃止
  - `CounterChoices.tsx` / `VoteButtons.tsx` / `ThemeCard.tsx` 削除
- [x] 型チェック (`npx tsc --noEmit`) + 本番ビルド (`npm run build`) 通過

### 未完・これからやる
- [ ] Supabase ダッシュボードで未適用のマイグレーションを順に手動適用 (`phase2a-week1.sql` → `phase2a-stage-a.sql` → `phase2a-stage-b.sql`)
- [ ] `npm run dev` で Stage B 実機動作確認:
  - ホームのマッチアップ表示が壊れていないか
  - ゲーム画面: テキスト入力 + お助け獄吏3枠が描画される / マッチ%が出る / 召喚で-10HP
  - HP=0 で即「K.O.」or「敗北」演出 → 結果画面遷移
  - 結果画面: 5戦未満なら「判定中…」、5戦以上で 8軸レーダー + タイプ + 相性キャラ
  - Supabase: `user_stats` が増えていく / `battles.ended_by_hp_zero` / `helpers_summoned` 列が入る
- [ ] (将来 Stage C) スタミナモデル: 1日3スタミナ、広告で回復。お助け召喚をスタミナ消費に切替予定。Claude.ts/scoring.ts に `// TODO: stamina model` メモ済

---

## 獄吏設計 (10体)

Stage A で実装する AI キャラ。**ステータスは4軸: IQ / VENOM / WIT / DEPTH 各 1-5**

### Tier 1 (新米獄吏)

| キャラ | 絵文字 | IQ | 悪辣 | 機知 | 深慮 |
|---|---|---|---|---|---|
| **囁 (ささやき)** | 🌱 | 2 | 1 | 1 | 1 |

- 性格: おどおどした新米、自信なさげ
- 得意: 一般論・抽象論で安全に
- 弱点: 具体例やデータを求められると沈黙
- 外見: 目線を外した小柄な黒ローブ
- 決め台詞: 「...あの、多分それは、違うと思います」

| キャラ | 絵文字 | IQ | 悪辣 | 機知 | 深慮 |
|---|---|---|---|---|---|
| **惰 (だ)** | 🎈 | 1 | 2 | 2 | 1 |

- 性格: だるがる、やる気ない
- 得意: 相手の熱量に冷や水を浴びせる
- 弱点: 熱く語ると付いてこれない
- 外見: 半目、あくびしてる獄吏
- 決め台詞: 「めんどくせ…どうでもよくない？」

### Tier 2

| キャラ | 絵文字 | IQ | 悪辣 | 機知 | 深慮 |
|---|---|---|---|---|---|
| **量 (はかり)** | 📊 | 3 | 2 | 2 | 2 |

- 性格: 統計フェチ、数字を振りかざす
- 得意: グラフと数字で圧倒
- 弱点: サンプルサイズの不備を突かれる
- 外見: 天秤を持つ、眼鏡の獄吏
- 決め台詞: 「87.3%の事例で、貴様は間違っている」

| キャラ | 絵文字 | IQ | 悪辣 | 機知 | 深慮 |
|---|---|---|---|---|---|
| **憤 (ふん)** | 😤 | 2 | 3 | 2 | 1 |

- 性格: 怒りっぽい、感情論で押す
- 得意: 倫理・正義で殴る
- 弱点: 冷静に論理を通されると弱い
- 外見: 炎を纏う、赤いローブ
- 決め台詞: 「お前のような者が、人間の未来を語るな！」

### Tier 3

| キャラ | 絵文字 | IQ | 悪辣 | 機知 | 深慮 |
|---|---|---|---|---|---|
| **嘲 (あざけり)** | 🎭 | 3 | 4 | 5 | 2 |

- 性格: 皮肉屋、見下しが滲む
- 得意: 揚げ足取り、嘲笑で崩す
- 弱点: 真剣な倫理論には効かない
- 外見: 歪んだ微笑みの仮面
- 決め台詞: 「へえ、本気でそう思っているのか」

| キャラ | 絵文字 | IQ | 悪辣 | 機知 | 深慮 |
|---|---|---|---|---|---|
| **詭 (き)** | 🐍 | 4 | 4 | 4 | 3 |

- 性格: 狡猾、論点をすり替える
- 得意: レトリック、論理のすり替え
- 弱点: 真正面から定義を問い直される
- 外見: 蛇を纏う、艶かしい獄吏
- 決め台詞: 「それは貴様の解釈にすぎないな」

### Tier 4

| キャラ | 絵文字 | IQ | 悪辣 | 機知 | 深慮 |
|---|---|---|---|---|---|
| **識 (しき)** | 📜 | 5 | 2 | 3 | 5 |

- 性格: 古典学者、格調高い
- 得意: 哲学・歴史の引用、長期視点
- 弱点: 現代特有の問題には弱い
- 外見: 羊皮紙を持つ老獄吏
- 決め台詞: 「カントが既に2世紀前に答えを出している」

| キャラ | 絵文字 | IQ | 悪辣 | 機知 | 深慮 |
|---|---|---|---|---|---|
| **狂 (きょう)** | 🌀 | 4 | 5 | 3 | 4 |

- 性格: 狂信者、極論で切り込む
- 得意: 極論、白黒論、感情を煽る
- 弱点: グレーゾーンを認めさせると崩壊
- 外見: 目が狂気に光る獄吏
- 決め台詞: 「中間など存在しない。全てか、無か」

### Tier 5 (伝説級)

| キャラ | 絵文字 | IQ | 悪辣 | 機知 | 深慮 |
|---|---|---|---|---|---|
| **真 (しん)** | 👑 | 5 | 4 | 5 | 5 |

- 性格: 論獄の主、冷徹に全てを見抜く
- 得意: ユーザーの思考パターンを先読み
- 弱点: 自らの絶対性を疑わせること
- 外見: 王冠を被った影の獄吏
- 決め台詞: 「では、お前はどう応える？」

| キャラ | 絵文字 | IQ | 悪辣 | 機知 | 深慮 |
|---|---|---|---|---|---|
| **黙 (もく)** | 🕯 | 5 | 5 | 2 | 5 |

- 性格: 最も冷たい獄吏、ほぼ喋らない
- 得意: 短い一言で全てを否定する
- 弱点: 沈黙させると逆に勝ち筋が見える
- 外見: 全身黒ローブ、顔は見えない
- 決め台詞: 「...違う」

---

## Claude プロンプト設計方針 (重要)

`src/lib/claude.ts` の `generateAIStatement` と `generateCounterChoices` で、**キャラの個性をprompt に強く反映する** こと。

### 今までの prompt (Phase 2A Week 1 時点)
```
「あなたのキャラクター」セクションで name_jp と tagline と prompt_hint を渡しているが、
実際に生成される文章はキャラ差が弱い。
```

### Stage A で改善すべきこと
1. **キャラ性格の行動規範を具体的に指示** (例: 「『囁』は語尾を『...と思います』『多分』で終わらせる」)
2. **決め台詞を状況に応じて挟ませる** (最初の一言 or 勝ち気な場面)
3. **使う語彙を制限** (古典派には現代語を使わせない、統計屋には必ず数字を出させる)
4. **文字数もキャラ別** ('黙'は50字以内、'識'は180字など)
5. **反論カード(counter)のトーンもキャラに合わせる** — 嘲相手なら皮肉で返す選択肢を用意する等

---

## ディレクトリ構造

```
opinion-battle/
├── CLAUDE.md                          # ← このファイル
├── README.md
├── UPGRADE.md
├── package.json
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── daily-matchup/       # Phase 2A Week 1 新規
│   │   │   ├── generate-counters/   # Phase 1.5
│   │   │   ├── generate-statement/  # Phase 1 + 2A 拡張済
│   │   │   └── save-battle/         # Phase 2A Week 1 書き直し済
│   │   ├── game/[themeId]/
│   │   │   ├── page.tsx
│   │   │   └── GameClient.tsx       # TODO: matchupId/aiLevelId 対応
│   │   ├── result/[battleId]/
│   │   │   └── page.tsx             # TODO: RP演出
│   │   ├── layout.tsx
│   │   ├── page.tsx                 # TODO: ホーム画面をマッチアップ表示に
│   │   └── globals.css
│   ├── components/
│   │   ├── AiStatementBubble.tsx
│   │   ├── HpBar.tsx
│   │   ├── MatchupCard.tsx          # Stage A
│   │   ├── AiCharacterBadge.tsx     # Stage A (compact / card variant)
│   │   ├── RankDisplay.tsx          # Stage A
│   │   ├── RpBonus.tsx              # Stage A (RP獲得演出, client only)
│   │   ├── TextInputArea.tsx        # Stage B (反論テキスト入力)
│   │   ├── HelperPanel.tsx          # Stage B (3お助け獄吏 + マッチ%)
│   │   ├── HpZeroOverlay.tsx        # Stage B (HP=0 演出, full-screen)
│   │   ├── PersonalityRadar.tsx    # Stage B (8軸レーダー SVG)
│   │   └── PersonalitySection.tsx   # Stage B (判定中 / 性格診断 / 相性キャラ)
│   ├── lib/
│   │   ├── ai-levels.ts             # Stage A: 10体 / Stage B: 8軸対応
│   │   ├── claude.ts                # Stage B: 1呼出で評価+反撃+ダメージ
│   │   ├── affinity.ts              # Stage B: cosineSim / pickHelpers / personalityType / foldDelta
│   │   ├── matchmaking.ts           # Stage A: tier 基準で10体から選ぶ
│   │   ├── ranking.ts               # Stage A: getUserTier + tier基準reward
│   │   ├── scoring.ts               # Stage B: HELPER_SUMMON_HP_COST 追加, judgeResult HP=0対応
│   │   ├── supabase.ts              # Phase 1
│   │   └── users.ts                 # Phase 2A Week 1
│   ├── store/
│   │   └── gameStore.ts             # Stage B: applyRoundResponse / summonHelper
│   ├── app/api/
│   │   ├── daily-matchup/           # Stage A
│   │   ├── generate-statement/      # Stage B (1呼出, ユーザー入力評価込み)
│   │   ├── helper-pick/             # Stage B (新規)
│   │   ├── user-stats/              # Stage B (新規)
│   │   └── save-battle/             # Stage B (HP終了 + user_stats 更新)
│   └── types/
│       └── index.ts                 # Stage B: Axes8 / UserStats / HelperPick / 新BattleRound
└── supabase/
    ├── schema.sql                   # Phase 1
    ├── migrations/
    │   ├── phase2a-week1.sql        # 適用済 (ユーザー側で1回)
    │   ├── phase2a-stage-a.sql      # 適用済 (ユーザー側で1回)
    │   └── phase2a-stage-b.sql      # 未適用ならユーザーがSQL Editorで実行
    └── seeds/
        ├── seed-themes.sql
        └── seed-themes.ts
```

**localStorage / sessionStorage キー**:
- `rongoku.anonUserId` (localStorage) — anon user の UUID
- `rongoku.lastBattleResult` (sessionStorage) — 直前バトルの SaveBattleResponse + aiLevel

**Stage B 戦闘モデル要点**:
- ユーザー入力 → Claude が 8軸評価 (1-5) + 強度 (0-100) + AI反撃文 + 両者HPダメージを1呼出で返す
- AI ダメージ式: `baseAiDamage(tier) - userStrength*0.10` (Tier1=8 → Tier5=25)
- ユーザー → AI ダメージ式: `userStrength/4 * resistance(tier)` (Tier5は0.65倍)
- お助け獄吏 召喚 = -10HP, ラウンド1体まで, 戦闘中の獄吏除く9体から3体ランダム + 各マッチ% (cosine of theme.topic_axes vs ai 8軸)
- HP=0 で即終了 (overlay 1.4秒) → 結果画面遷移
- user_stats 更新: ユーザー入力評価8軸 (重み1) + 召喚した獄吏8軸 (重み0.5) を平均 → foldDelta で running average
- 性格診断: samples<5 で「判定中…」、それ以降 8軸の最高値で SINGLE_TYPE 命名 (8タイプ) + 上位2軸/下位2軸表示 + 8軸最近傍の獄吏を「相性良いキャラ」表示

---

## 重要な設計方針 (絶対に守る)

- **APIキーは絶対にクライアント露出させない** (サーバーサイドのみ)
- **RPは勝利時のみ増加、敗北では減らない** (Duolingo型ソフト設計)
- **エラーは握りつぶさず console.error**、ただし UX は必ずフォールバックで継続する
- **Supabase RLS は必ず有効化**、`SUPABASE_SERVICE_ROLE_KEY` はサーバーサイドのみで使う
- **ALTER 文は additive** (既存行を壊さない、新規カラムは nullable)
- **マイグレーション SQL は冪等** (`IF NOT EXISTS` / `ON CONFLICT` を使う)

## コーディング規約

- 新規ファイルは `src/types/index.ts` の既存型を使う
- import は `@/...` エイリアスを使う
- クライアントコンポーネントは `"use client"` を先頭に
- Claude への prompt は日本語で、キャラの個性を強く反映
- コメントは日本語/英語どちらでもOK、既存コードのスタイルに合わせる

## 禁止事項

- `package.json` の dependencies を断りなく変えない (確認してから)
- `.env.local` を見ない・触らない (秘匿情報、GitHub にも上げない)
- 既存の DB スキーマを破壊するマイグレーションを書かない
- Phase 2A Week 1 の既存ファイルを理由なく大幅改変しない

## 動作確認の流れ

1. `npx tsc --noEmit` (型チェック、エラーなしが必須)
2. `npm run build` (本番ビルド、エラーなしが必須)
3. `npm run dev` でローカル起動
4. Supabase Dashboard で新テーブルにデータが入るか確認
5. 型・ビルド両方 OK になってから git commit

## Git 運用

- main ブランチに直接 push する運用 (1人開発)
- 各タスク完了ごとに commit
- コミットメッセージは日本語でOK、分かりやすく

## 環境変数 (.env.local)

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...  # サーバー専用
ANTHROPIC_API_KEY=sk-ant-...   # サーバー専用
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## 最初にやってほしいこと

1. この `CLAUDE.md` を全文読む
2. `git log --oneline -20` で直近のコミットを確認
3. 以下のキーファイルを読んで現状把握:
   - `src/types/index.ts`
   - `src/lib/ai-levels.ts`
   - `src/lib/claude.ts`
   - `src/lib/matchmaking.ts`
   - `supabase/migrations/phase2a-week1.sql`
4. ユーザーに **Stage A の実装計画を箇条書きで提示** し、承認を得てから実装開始
5. 大きな方針変更は必ずユーザーに確認 (勝手に変えない)
