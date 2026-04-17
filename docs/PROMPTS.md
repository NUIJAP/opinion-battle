# 立場BATTLE - Claude APIプロンプト集

**用途**: Cowork / Next.js API Routes で以下のプロンプトを使用

---

## 📰 1. テーマ自動生成プロンプト

### 入力
- ニュース記事 30件（テキスト形式）
- 日付（YYYY-MM-DD）

### プロンプト

```
あなたはニュース分析者です。以下の最新ニュース30件から、
社会的に「対立する2つの立場」を抽出してください。

【ニュース】
${newsArticles}

【要件】
1. 日本の社会課題として重要で、世論が分かれているテーマを選ぶ
2. 「賛成派」「反対派」という単純な二項対立ではなく、
   本質的な価値観の違いを表現する立場名を付ける
3. 各立場の主張は、ニュース記事の実際の議論に基づく
4. 難易度は 1-5（1=誰でも理解しやすい、5=専門知識必要）を判定

【出力形式】
JSON のみ返してください。他の説明文は不要。

{
  "theme_title": "テーマのタイトル（20字以内）",
  "theme_question": "テーマを問い形で表現（例：〇〇は必要か？）",
  "description": "ニュース背景の簡潔な説明（50-100字）",
  "stance_a_name": "立場Aの名前（例：規制推進派）",
  "stance_a_summary": "立場Aの主張（100-150字。ニュースから抽出）",
  "stance_b_name": "立場Bの名前（例：市場重視派）",
  "stance_b_summary": "立場Bの主張（100-150字。ニュースから抽出）",
  "news_source": "最も関連したニュースのURL or タイトル",
  "difficulty": 難易度（1-5の整数）,
  "key_values": ["立場を分ける根本的な価値観1", "値観2"]
}
```

### 使用例（コード）
```javascript
// Cowork / Next.js で実行
const newsArticles = await fetchNewsAPI();
const prompt = `あなたはニュース分析者です。以下の...`;

const response = await fetch('https://api.anthropic.com/v1/messages', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1000,
    messages: [{
      role: 'user',
      content: prompt + newsArticles
    }]
  })
});

const theme = JSON.parse(response.data.content[0].text);
```

---

## ⚔️ 2. 議論実行プロンプト（ラウンド実行）

### 入力
```
- theme: テーマ（オブジェクト）
- userStance: ユーザーが選んだ立場
- aiStance: 対面するAI立場
- userAction: ユーザーの投票（"like" / "reference" / "oppose"）
- battleHistory: これまでのラウンド履歴（配列）
- roundNumber: 現在のラウンド番号（1-7）
```

### プロンプト

```
あなたは議論のプロです。以下のテーマで、
指定された立場を代表して、強い主張を提示してください。

【テーマ】
タイトル: ${theme.title}
背景: ${theme.description}

【ユーザーの立場】
${userStance}

【あなたが代表する立場】
${aiStance}

【ここまでのやり取り】
${battleHistory.map(r => 
  `ラウンド${r.round}: 
   ${r.aiStance}派の主張: "${r.aiStatement}"
   ユーザーの反応: ${r.userAction}`
).join('\n')}

【ユーザーの最新の反応】
${userAction === 'like' ? 'ユーザーはあなたの主張に「いいね」と反応しました' : 
  userAction === 'oppose' ? 'ユーザーは強く「反発」しました。より説得力のある反論が必要です。' :
  'ユーザーは「参考になる」と評価しました。さらに詳しく説明してください。'}

【要件】
- あなたの主張は 120-180字（厳密に）
- ユーザーの反応を意識した内容（反発なら強気で対抗、いいねなら深掘り）
- 同じ論理の繰り返しは避ける（ラウンド3以降は新しい視点を追加）
- ニュース記事や最新データに基づいた具体的な主張
- 相手の立場の「弱点」を指摘する時は論理的に

【出力形式】
JSON のみ。説明文は不要。

{
  "statement": "あなたの主張（120-180字）",
  "tone": "強気" or "説得的" or "冷静",
  "keyPoint": "この主張の最重要ポイント（20字以内）",
  "countersUserStance": true/false（ユーザーの立場に直接対抗しているか）
}
```

### 使用例（コード）
```javascript
async function generateAIStatement(battleState) {
  const prompt = `あなたは議論のプロです。以下のテーマで...`;
  
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: prompt
      }]
    })
  });

  const aiResponse = JSON.parse(response.data.content[0].text);
  return aiResponse.statement;
}
```

---

## 🧠 3. 学習型AI：パターン分析プロンプト

### 入力
- 過去24時間のバトル結果 50-100件（JSON配列）

### プロンプト

```
あなたはAI学習分析官です。
以下の100件のバトル結果を分析して、
「ユーザーが納得して、スコアが高かった反論パターン」を抽出してください。

【バトルデータ】
${battleResults.map(b => ({
  theme: b.theme,
  userStance: b.userStance,
  aiStance: b.aiStance,
  rounds: b.rounds,
  userFinalHP: b.userFinalHP,
  aiFinalHP: b.aiFinalHP,
  userScore: b.userScore,
  userActions: b.userActions  // "like" / "oppose" / "reference" の配列
})).join('\n\n')}

【分析要件】
1. 「ユーザーが『反発』から『いいね』に転じた」パターンを検出
2. 高スコア（7000点以上）の反論の特徴を抽出
3. 各テーマごとに有効な反論スタイルを分類
4. 「説得力スコア」を 0.0-1.0 で算出

【出力形式】
JSON のみ。

{
  "topPatterns": [
    {
      "rank": 1,
      "pattern": "パターン名（例：経済的損失の具体数字を提示）",
      "description": "このパターンの詳細（50字以内）",
      "effectiveness": 0.87,  // 0.0-1.0
      "successCount": 23,  // 成功した回数
      "applicableThemes": ["AI規制", "生成AI政策"],
      "exampleStatement": "実際に成功した発言例（50字以内）"
    },
    ...（以下Top5まで）
  ],
  "insights": "全体的な洞察（100字以内）"
}
```

### 使用例（Cowork）
```javascript
// Day 1 23:00 に実行
async function analyzeAndLearn() {
  const battles = await db.getBattles({ 
    createdAfter: 24.hoursAgo 
  });
  
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: `あなたはAI学習分析官です...${JSON.stringify(battles)}`
      }]
    })
  });

  const patterns = JSON.parse(response.data.content[0].text).topPatterns;
  
  // patterns を ai_patterns テーブルに保存
  await db.updateAIPatterns(patterns);
  
  // 明日のプロンプトに組み込む
  return patterns;
}
```

---

## 🎭 4. 複数立場自動生成プロンプト

### 入力
- テーマ（既存の賛成派・反対派）
- ユーザーレベル（初級・中級・上級）

### プロンプト

```
あなたは思想分析者です。以下のテーマについて、
「賛成派と反対派の間にある『第3の立場』」を創造してください。

【テーマ】
${theme.title}
賛成派: ${theme.stanceA}
反対派: ${theme.stanceB}

【要件】
1. 「どちらでもない」ではなく、異なる価値観に基づく独立した立場
2. 実在する論者や政治・哲学的な考え方に基づく
3. 賛成派・反対派の「弱点」を補完するような提案を含む
4. ユーザーレベル「${userLevel}」に合わせた複雑さで

【ユーザーレベル別要件】
- 初級: 誰でも理解しやすい視点。「両者の良さを取る」的
- 中級: 実務的な観点。「段階的導入」「部分的規制」など
- 上級: 哲学的・経済学的。複雑なトレードオフを含む

【出力形式】
JSON のみ。

{
  "stance_name": "第3立場の名前（例：段階的規制派）",
  "core_value": "この立場の根本的な価値観（30字以内）",
  "initial_statement": "初期主張（100-150字）",
  "compromise_with_a": "賛成派との共通点（50字以内）",
  "compromise_with_b": "反対派との共通点（50字以内）",
  "unique_proposal": "この立場独自の提案（80字以内）",
  "difficulty_boost": 1  // 難易度上昇値（1-2）
}
```

---

## 🔄 5. ニュース学習：AI戦略の動的プロンプト生成

### 入力
- 学習済みパターン（Top3）
- 今日のテーマ
- ユーザーの立場

### プロンプト

```
あなたは${aiStance}派の代表です。
以下の「ユーザーが過去に納得したパターン」を参考に、
強い主張を用意してください。

【ユーザーが過去に納得した反論パターン】
${learnedPatterns.map(p => 
  `${p.rank}. ${p.pattern}
   （成功事例: "${p.exampleStatement}"）`
).join('\n')}

【今日のテーマ】
${theme.title}
背景: ${theme.description}

【戦略】
これらのパターンを今日のテーマに適応させて、
説得力のある主張を3パターン用意してください。

【出力形式】
JSON のみ。

{
  "initialStatement": "ラウンド1での主張（150字）",
  "adapstedPatterns": [
    {
      "patternName": "使用パターン名",
      "statement": "そのパターンを応用した主張（120字）",
      "expectedImpact": "0.0-1.0"
    }
  ]
}
```

---

## 🎯 6. テーマ難易度判定プロンプト

### 入力
- テーマ全体（タイトル・説明・両立場）

### プロンプト

```
以下のテーマの「難易度」を 1-5 で判定してください。

【テーマ】
${theme.title}
説明: ${theme.description}
${theme.stanceA}派の主張: ${theme.stanceASummary}
${theme.stanceBB}派の主張: ${theme.stanceBSummary}

【判定基準】
1. 中学生でも理解できる基本的テーマ（例：学校の制服廃止）
2. 高校生が議論できるテーマ（例：データ保護法）
3. 大学教養レベル（例：金融規制と経済成長）
4. 専門知識必要（例：量子コンピュータのセキュリティ）
5. 博士号レベルの深い議論（例：AIと人間の自由意志）

【出力】
整数 1-5 のみ
```

---

## 📝 使用上の注意

### トークン効率
- **テーマ生成**: max_tokens = 1000
- **議論実行**: max_tokens = 500
- **学習分析**: max_tokens = 2000
- **複数立場**: max_tokens = 800

### エラーハンドリング
```javascript
try {
  const response = await claudeAPI.call(prompt);
  const json = JSON.parse(response);
  // 検証
  if (!json.statement || json.statement.length < 50) {
    throw new Error("Invalid response");
  }
} catch (e) {
  // フォールバック
  return getPreGeneratedStatement(theme);
}
```

### キャッシング戦略
- テーマは 24時間キャッシュ（ニュース取得は1回/日）
- AI議論は キャッシュ不可（ユーザーごとに異なる）
- パターン学習結果は 24時間キャッシュ

---

## 🔗 参考：Supabase で実行するCloudFunction例

```javascript
// Supabase Edge Function
import Anthropic from '@anthropic-ai/sdk';

export default async function handler(req, context) {
  const client = new Anthropic({
    apiKey: context.env.ANTHROPIC_API_KEY,
  });

  const { action, payload } = req.json();

  if (action === 'generate_theme') {
    // テーマ生成
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{ role: 'user', content: `...${payload.news}` }],
    });
    return new Response(JSON.stringify(response), { status: 200 });
  }

  // 他のアクション...
}
```

---

**最後に**: 各プロンプトは「完全性」よりも「動く」ことを優先に設計しています。本番運用で調整してください。
