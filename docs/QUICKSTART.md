# 立場BATTLE - クイックスタートガイド

**所要時間**: セットアップ 30分 + 実装開始  
**対象**: Next.js + Claude API + Supabase での実装

---

## 🚀 Phase 0: 環境構築（Day 0）

### 0.1 前提条件の確認

```bash
✓ Node.js 18+ インストール済み
✓ Git インストール済み
✓ GitHub アカウント持っている
✓ Vercel アカウント持っている（デプロイ用）
✓ Anthropic API キー取得済み
✓ Supabase アカウント作成済み
```

### 0.2 リポジトリ初期化

```bash
# 1. Next.js プロジェクト作成
npx create-next-app@latest opinion-battle --typescript --tailwind

cd opinion-battle

# 2. 必要なライブラリをインストール
npm install @supabase/supabase-js zustand react-query axios

# 3. .env.local を作成
cat > .env.local << 'EOF'
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
ANTHROPIC_API_KEY=your_anthropic_api_key
NEXT_PUBLIC_APP_URL=http://localhost:3000
EOF

# 4. Git 初期化
git init
git add .
git commit -m "Initial commit: Next.js + Supabase setup"
```

### 0.3 Supabase セットアップ

```sql
-- Supabase SQL Editor で実行

-- 1. themes テーブル
CREATE TABLE themes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(200) NOT NULL,
  description TEXT,
  stance_a VARCHAR(500),
  stance_b VARCHAR(500),
  stance_a_name VARCHAR(100),
  stance_b_name VARCHAR(100),
  news_url VARCHAR(500),
  news_date TIMESTAMP,
  difficulty INT CHECK (difficulty BETWEEN 1 AND 5),
  created_at TIMESTAMP DEFAULT NOW(),
  active BOOLEAN DEFAULT true
);

-- 2. users テーブル
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(100),
  total_score INT DEFAULT 0,
  win_count INT DEFAULT 0,
  loss_count INT DEFAULT 0,
  battle_count INT DEFAULT 0,
  streak_days INT DEFAULT 0,
  last_played TIMESTAMP,
  pro_member BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 3. battles テーブル
CREATE TABLE battles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  theme_id UUID REFERENCES themes(id),
  user_stance VARCHAR(100),
  final_user_hp INT,
  final_ai_hp INT,
  result VARCHAR(50),
  score INT,
  rounds_won INT,
  battle_history JSONB,
  player_count INT,
  created_at TIMESTAMP DEFAULT NOW(),
  played_duration_seconds INT
);

-- インデックス作成（パフォーマンス向上）
CREATE INDEX idx_themes_active ON themes(active);
CREATE INDEX idx_battles_user_id ON battles(user_id);
CREATE INDEX idx_battles_created_at ON battles(created_at DESC);
```

---

## 📅 Phase 1: MVP実装（Week 1-2）

### Day 1: フロント基本UI

#### ファイル構成
```
src/
├── app/
│   ├── page.tsx (ホーム画面)
│   ├── game/
│   │   └── [themeId].tsx (ゲーム画面)
│   └── result/
│       └── [battleId].tsx (結果画面)
├── components/
│   ├── ThemeCard.tsx
│   ├── BattleScreen.tsx
│   └── ResultScreen.tsx
├── lib/
│   ├── supabase.ts (Supabase クライアント)
│   └── claude.ts (Claude API ラッパー)
└── store/
    └── gameStore.ts (Zustand ストア)
```

#### 実装例: ホーム画面（src/app/page.tsx）

```typescript
'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import ThemeCard from '@/components/ThemeCard';

interface Theme {
  id: string;
  title: string;
  description: string;
  stance_a_name: string;
  stance_b_name: string;
  difficulty: number;
}

export default function Home() {
  const [currentTheme, setCurrentTheme] = useState<Theme | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTheme = async () => {
      const { data, error } = await supabase
        .from('themes')
        .select('*')
        .eq('active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error) console.error(error);
      else setCurrentTheme(data);
      setLoading(false);
    };

    fetchTheme();
  }, []);

  if (loading) return <div className="flex justify-center items-center h-screen">Loading...</div>;

  return (
    <div className="w-full max-w-md mx-auto p-4">
      <h1 className="text-2xl font-bold text-center mb-6">立場 BATTLE</h1>

      {currentTheme && (
        <ThemeCard theme={currentTheme} />
      )}

      <div className="mt-6 text-center text-sm text-gray-500">
        <p>今月スコア: 45,820 | ストリーク: 7日 🔥</p>
      </div>
    </div>
  );
}
```

#### 実装例: ThemeCard.tsx

```typescript
import Link from 'next/link';

interface ThemeCardProps {
  theme: {
    id: string;
    title: string;
    stance_a_name: string;
    stance_b_name: string;
  };
}

export default function ThemeCard({ theme }: ThemeCardProps) {
  return (
    <div className="border border-gray-300 rounded-lg p-6 bg-white">
      <h2 className="text-xl font-bold mb-4">{theme.title}</h2>

      <div className="space-y-3">
        <Link
          href={`/game/${theme.id}?stance=a`}
          className="block w-full bg-blue-500 text-white py-3 rounded-lg text-center font-semibold hover:bg-blue-600"
        >
          {theme.stance_a_name}を選ぶ
        </Link>

        <Link
          href={`/game/${theme.id}?stance=b`}
          className="block w-full bg-red-500 text-white py-3 rounded-lg text-center font-semibold hover:bg-red-600"
        >
          {theme.stance_b_name}を選ぶ
        </Link>
      </div>
    </div>
  );
}
```

### Day 2: ゲーム画面 + Claude 連携

#### ゲーム画面（src/app/game/[themeId].tsx）

```typescript
'use client';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { generateAIStatement } from '@/lib/claude';

interface GameState {
  userHP: number;
  aiHP: number;
  round: number;
  aiStatement: string;
  isLoading: boolean;
}

export default function GameScreen({ params }: { params: { themeId: string } }) {
  const searchParams = useSearchParams();
  const userStance = searchParams.get('stance');
  const [gameState, setGameState] = useState<GameState>({
    userHP: 100,
    aiHP: 100,
    round: 1,
    aiStatement: '',
    isLoading: false,
  });
  const [theme, setTheme] = useState<any>(null);

  useEffect(() => {
    const fetchTheme = async () => {
      const { data } = await supabase
        .from('themes')
        .select('*')
        .eq('id', params.themeId)
        .single();
      setTheme(data);
    };
    fetchTheme();
  }, []);

  // ゲーム開始時に初期AI文を生成
  useEffect(() => {
    if (theme && gameState.round === 1 && !gameState.aiStatement) {
      generateInitialStatement();
    }
  }, [theme]);

  const generateInitialStatement = async () => {
    setGameState(prev => ({ ...prev, isLoading: true }));
    
    const aiStance = userStance === 'a' ? theme.stance_b_name : theme.stance_a_name;
    const statement = await generateAIStatement({
      theme,
      userStance: userStance === 'a' ? theme.stance_a_name : theme.stance_b_name,
      aiStance,
      userAction: 'none',
      battleHistory: [],
      roundNumber: 1,
    });

    setGameState(prev => ({
      ...prev,
      aiStatement: statement,
      isLoading: false,
    }));
  };

  const handleUserAction = (action: 'like' | 'reference' | 'oppose') => {
    // HP更新
    let hpChange = 0;
    let aiHPChange = 0;
    if (action === 'like') {
      hpChange = 15;
      aiHPChange = -5;
    } else if (action === 'reference') {
      hpChange = 8;
      aiHPChange = -3;
    } else {
      hpChange = 20;
      aiHPChange = -20;
    }

    const newUserHP = Math.max(0, gameState.userHP + hpChange);
    const newAIHP = Math.max(0, gameState.aiHP + aiHPChange);

    setGameState(prev => ({
      ...prev,
      userHP: newUserHP,
      aiHP: newAIHP,
    }));

    // 次ラウンドへ
    if (gameState.round < 7) {
      generateNextStatement(action);
    } else {
      // ゲーム終了、結果画面へ
      // TODO: スコア計算＆リダイレクト
    }
  };

  const generateNextStatement = async (userAction: string) => {
    setGameState(prev => ({ ...prev, isLoading: true }));

    const aiStance = userStance === 'a' ? theme.stance_b_name : theme.stance_a_name;
    const statement = await generateAIStatement({
      theme,
      userStance: userStance === 'a' ? theme.stance_a_name : theme.stance_b_name,
      aiStance,
      userAction,
      battleHistory: [], // 簡略化
      roundNumber: gameState.round + 1,
    });

    setGameState(prev => ({
      ...prev,
      aiStatement: statement,
      round: prev.round + 1,
      isLoading: false,
    }));
  };

  if (!theme) return <div>Loading...</div>;

  return (
    <div className="w-full max-w-md mx-auto p-4">
      {/* HP表示 */}
      <div className="mb-6">
        <div className="flex justify-between mb-2">
          <span className="text-sm font-semibold">あなた</span>
          <span className="text-sm font-semibold">AI</span>
        </div>
        <div className="flex gap-2">
          <div className="flex-1 bg-gray-200 rounded-full h-6">
            <div
              className="bg-blue-500 h-full rounded-full transition-all"
              style={{ width: `${gameState.userHP}%` }}
            />
          </div>
          <div className="flex-1 bg-gray-200 rounded-full h-6">
            <div
              className="bg-red-500 h-full rounded-full transition-all"
              style={{ width: `${gameState.aiHP}%` }}
            />
          </div>
        </div>
      </div>

      {/* AI主張表示 */}
      <div className="border border-gray-300 rounded-lg p-4 mb-6 min-h-24">
        <p className="text-sm text-gray-600 mb-2">Round {gameState.round}/7</p>
        {gameState.isLoading ? (
          <p className="text-gray-500">生成中...</p>
        ) : (
          <p className="text-base leading-relaxed">{gameState.aiStatement}</p>
        )}
      </div>

      {/* 投票ボタン */}
      <div className="flex gap-4 justify-center">
        <button
          onClick={() => handleUserAction('like')}
          disabled={gameState.isLoading}
          className="px-6 py-3 bg-green-500 text-white rounded-lg font-semibold hover:bg-green-600 disabled:bg-gray-400"
        >
          👍
        </button>
        <button
          onClick={() => handleUserAction('reference')}
          disabled={gameState.isLoading}
          className="px-6 py-3 bg-yellow-500 text-white rounded-lg font-semibold hover:bg-yellow-600 disabled:bg-gray-400"
        >
          ☝️
        </button>
        <button
          onClick={() => handleUserAction('oppose')}
          disabled={gameState.isLoading}
          className="px-6 py-3 bg-red-500 text-white rounded-lg font-semibold hover:bg-red-600 disabled:bg-gray-400"
        >
          👎
        </button>
      </div>
    </div>
  );
}
```

### Day 3: Claude API ラッパー + スコア計算

#### Claude API ラッパー（src/lib/claude.ts）

```typescript
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

interface GenerateStatementInput {
  theme: any;
  userStance: string;
  aiStance: string;
  userAction: string;
  battleHistory: any[];
  roundNumber: number;
}

export async function generateAIStatement(input: GenerateStatementInput): Promise<string> {
  const {
    theme,
    userStance,
    aiStance,
    userAction,
    battleHistory,
    roundNumber,
  } = input;

  const prompt = `あなたは議論のプロです。以下のテーマで、
指定された立場を代表して、強い主張を提示してください。

【テーマ】
タイトル: ${theme.title}
背景: ${theme.description}

【ユーザーの立場】
${userStance}

【あなたが代表する立場】
${aiStance}

【ユーザーの最新の反応】
${userAction === 'like' ? 'いいね' : userAction === 'oppose' ? '反発（強い対抗意見が必要）' : '参考になる'}

【要件】
- 主張は 120-180字
- 新しい視点を追加（同じ論理の繰り返しなし）
- ニュース記事や最新データに基づく

【出力】
JSON のみ（説明文不要）
{
  "statement": "あなたの主張（120-180字）"
}
`;

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const responseText =
      message.content[0].type === 'text' ? message.content[0].text : '';
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Invalid response format');

    const parsed = JSON.parse(jsonMatch[0]);
    return parsed.statement || 'エラー：主張の生成に失敗しました';
  } catch (error) {
    console.error('Claude API error:', error);
    return 'AI対手が考え中...';
  }
}
```

#### スコア計算（src/lib/scoring.ts）

```typescript
export interface ScoreInput {
  finalUserHP: number;
  finalAIHP: number;
  roundsWon: number;
  playerCount: number;
  winStreak: number;
}

export function calculateScore(input: ScoreInput): number {
  const { finalUserHP, roundsWon, playerCount, winStreak } = input;

  const baseScore = finalUserHP * 100;
  const playerBonus = playerCount * 10;
  const roundBonus = roundsWon * 50;
  const multiplier = 1 + winStreak * 0.5;

  return Math.round((baseScore + playerBonus + roundBonus) * multiplier);
}
```

### Day 4-5: Supabase 接続・全体統合

#### Supabase クライアント（src/lib/supabase.ts）

```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ヘルパー関数
export async function saveTheme(theme: any) {
  return await supabase.from('themes').insert([theme]);
}

export async function saveBattle(battle: any) {
  return await supabase.from('battles').insert([battle]);
}

export async function updateUserScore(userId: string, scoreIncrease: number) {
  const { data: user } = await supabase
    .from('users')
    .select('total_score, win_count')
    .eq('id', userId)
    .single();

  return await supabase
    .from('users')
    .update({
      total_score: (user?.total_score || 0) + scoreIncrease,
      win_count: (user?.win_count || 0) + 1,
      updated_at: new Date(),
    })
    .eq('id', userId);
}
```

### Day 6-7: テスト・微調整

```bash
# 開発サーバー起動
npm run dev

# ブラウザで http://localhost:3000 を開く
# 手動テスト実施

# テストケース
1. ホーム → テーマ選択 → ゲーム開始
2. 投票 3回 → 結果表示
3. スコア計算の確認
4. Supabase へのデータ保存確認（Dashboard で確認）
```

---

## 📊 Phase 2: ニュース連携（Week 3-4）

### ニュース取得 + テーマ自動生成（src/pages/api/generate-theme.ts）

```typescript
import { NextApiRequest, NextApiResponse } from 'next';
import Anthropic from '@anthropic-ai/sdk';
import { supabase } from '@/lib/supabase';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

async function fetchNews() {
  // NewsAPI から最新記事30件取得
  const response = await fetch(
    `https://newsapi.org/v2/everything?q=AI+規制+生成AI&language=ja&sortBy=publishedAt&pageSize=30`,
    {
      headers: {
        'X-Api-Key': process.env.NEWS_API_KEY!,
      },
    }
  );
  const data = await response.json();
  return data.articles;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const articles = await fetchNews();
    const newsText = articles
      .map((a: any) => `${a.title}: ${a.description}`)
      .join('\n\n');

    // Claude でテーマ生成
    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [
        {
          role: 'user',
          content: `あなたはニュース分析者です。以下の最新ニュース30件から、
社会的に対立する2つの立場を抽出してください。

【ニュース】
${newsText}

【要件】
1. 日本の社会課題として重要で、世論が分かれているテーマ
2. 各立場の主張はニュース記事に基づく
3. 難易度は 1-5

【出力】JSON のみ
{
  "theme_title": "...",
  "stance_a_name": "...",
  "stance_a_summary": "...",
  "stance_b_name": "...",
  "stance_b_summary": "...",
  "difficulty": 2
}`,
        },
      ],
    });

    const responseText =
      message.content[0].type === 'text' ? message.content[0].text : '';
    const themeData = JSON.parse(responseText);

    // Supabase に保存
    const { data } = await supabase.from('themes').insert([
      {
        ...themeData,
        description: `最新ニュース（${new Date().toLocaleDateString()}）`,
        news_date: new Date(),
        active: true,
      },
    ]);

    res.status(200).json({ success: true, data });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to generate theme' });
  }
}
```

### Vercel Cron 設定（vercel.json）

```json
{
  "crons": [{
    "path": "/api/generate-theme",
    "schedule": "0 6 * * *"
  }]
}
```

---

## 🔄 Phase 3: 学習 + 複数立場（Week 5-6）

### 学習実行スクリプト（src/pages/api/learn.ts）

```typescript
// 毎日23:00 に実行
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { data: battles } = await supabase
    .from('battles')
    .select('*')
    .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000));

  const battleSummary = JSON.stringify(battles);

  const message = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    messages: [
      {
        role: 'user',
        content: `以下のバトルデータを分析して、
ユーザーが納得した反論パターンをTop3抽出してください。

${battleSummary}

【出力】JSON
{
  "topPatterns": [
    {
      "rank": 1,
      "pattern": "...",
      "effectiveness": 0.87
    }
  ]
}`,
      },
    ],
  });

  // パターンを保存
  const patterns = JSON.parse(message.content[0].text);
  await supabase.from('ai_patterns').upsert(patterns.topPatterns);

  res.status(200).json({ success: true });
}
```

---

## ✅ チェックリスト

### 環境構築
- [ ] Node.js 18+ インストール
- [ ] GitHub リポ初期化
- [ ] Supabase プロジェクト作成
- [ ] Claude API キー取得
- [ ] .env.local 設定

### Week 1
- [ ] Next.js 基本UI（ホーム・ゲーム・結果）
- [ ] Claude API 連携（議論生成）
- [ ] Supabase テーブル作成・接続
- [ ] スコア計算ロジック
- [ ] 手動プレイテスト（3回以上）

### Week 2
- [ ] ニュース自動取得（NewsAPI）
- [ ] テーマ自動生成テスト
- [ ] Vercel デプロイ
- [ ] ユーザーテスト開始

### Week 3+
- [ ] 学習ループ実装
- [ ] 複数立場生成
- [ ] ランキング機能
- [ ] SNS共有機能

---

## 🐛 デバッグTips

### Claude API がエラーを返す
```javascript
// レスポンス形式を確認
console.log(JSON.stringify(message, null, 2));

// プロンプトが長すぎないか確認（max_tokens を増やす）
```

### Supabase に接続できない
```bash
# 環境変数を確認
echo $NEXT_PUBLIC_SUPABASE_URL
echo $NEXT_PUBLIC_SUPABASE_ANON_KEY

# テーブルが作成されているか確認（Supabase Dashboard）
```

### テーマが配信されない
```bash
# Vercel Logs を確認
vercel logs <project-name>

# 手動でAPI呼び出し
curl -X POST http://localhost:3000/api/generate-theme
```

---

## 🎯 成功の定義

**Week 1 終了時点**
- ✅ 3つのテーマで実際にゲームが遊べる
- ✅ スコア計算が正確
- ✅ Supabase に履歴が保存される

**Week 2 終了時点**
- ✅ 毎日新しいテーマが配信される
- ✅ Vercel でデプロイできている
- ✅ 5人以上のテストユーザーがプレイしている

**Week 3+ で Phase 2/3 へ**

---

**質問があれば、PROJECT_SPEC.md + PROMPTS.md を参照。
それでも不明な場合は Cowork で相談してください。**
