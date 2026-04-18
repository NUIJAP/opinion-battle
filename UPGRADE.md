# Phase 1 → Phase 1.5 アップグレード手順

既に Phase 1 が動いている場合、**ファイルを上書きするだけ** でアップグレードできます。DB マイグレーションは不要です。

## やること

### 1. 開発サーバーを止める

ターミナルで `Ctrl + C` → `Y` + Enter。

### 2. ファイル一式を上書き

この ZIP を解凍し、**中身を既存の `opinion-battle/` フォルダに上書き** してください。

既存フォルダに以下が変わる/追加されます:

**変更:**
- `src/lib/claude.ts` — counter 生成関数を追加
- `src/lib/scoring.ts` — COUNTER_BONUS_DELTA 追加
- `src/types/index.ts` — 新しい型
- `src/store/gameStore.ts` — phase 管理に書き換え
- `src/app/game/[themeId]/GameClient.tsx` — counter フロー対応
- `src/app/result/[battleId]/page.tsx` — "あなたの決定打" セクション
- `src/components/VoteButtons.tsx` — 「反発」→「反論を打つ」
- `README.md`

**新規:**
- `src/app/api/generate-counters/route.ts`
- `src/components/CounterChoices.tsx`

**`.env.local` は触らない** — Phase 1 の設定がそのまま使えます。

### 3. 依存関係チェック

追加パッケージはないので、`npm install` は不要です。念のため型チェックだけ:

```bash
npx tsc --noEmit
```

エラーが出なければOK。

### 4. 再起動

```bash
npm run dev
```

ブラウザで `Ctrl + Shift + R`。

---

## 動作確認

1. ホーム画面 → テーマ選択 → バトル開始
2. AI 主張が出たら 🔥 **反論を打つ** をタップ
3. 「反論カードを生成中...」の後、**3つの反論候補** (📊データ / 🧩論理 / ❤️倫理) が表示される
4. どれかを選ぶ → AI がそのまま反論を踏まえて新しい主張を返す
5. 7ラウンドやり切ると、結果画面に **「⚔️ あなたの決定打」** セクションが出る
6. Twitter 共有のテキストにも決定打の角度が入る

---

## 面白さのチェックポイント

Phase 1.5 で**「議論してる感」が出るはず**ですが、実際に触って以下を感じるかチェックしてください:

- [ ] 反論カードを読むのが楽しい (カードの質が低いとここで冷める)
- [ ] AI が反論に対して実際に応答している感じがする
- [ ] 「データ/論理/倫理」の3角度で選択の意味が違って感じる
- [ ] 結果画面で自分が打った反論を見返して満足感がある

**もしどれかが弱いと感じたら**、該当箇所の Claude プロンプトを調整します (`src/lib/claude.ts` の `generateCounterChoices` と `generateAIStatement`)。

---

## 次は Phase 2A (観戦・予想機能)

Phase 1.5 で「ソロでも面白い」状態にしてから Phase 2A に進むのが推奨ルートです。
