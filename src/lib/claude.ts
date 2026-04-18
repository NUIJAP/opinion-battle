import Anthropic from "@anthropic-ai/sdk";
import type {
  AiLevel,
  BattleHistoryEntry,
  CounterChoice,
  GenerateCountersRequest,
  GenerateStatementRequest,
  Theme,
  UserAction,
} from "@/types";
import { getAiLevelById } from "@/lib/ai-levels";

const MODEL = "claude-sonnet-4-5";

function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("Missing ANTHROPIC_API_KEY");
  return new Anthropic({ apiKey });
}

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : text;
  const match = body.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No JSON object found in response");
  return JSON.parse(match[0]);
}

function formatHistory(
  history: BattleHistoryEntry[],
  aiStanceName: string
): string {
  if (history.length === 0) return "（まだやり取りはありません）";
  return history
    .map((r) => {
      const counter = r.userCounter
        ? `\n   ユーザーの反論: "${r.userCounter.statement}"`
        : "";
      return `ラウンド${r.round}:\n   ${aiStanceName}派の主張: "${r.aiStatement}"\n   ユーザーの反応: ${r.userAction ?? "未選択"}${counter}`;
    })
    .join("\n");
}

function actionLabel(
  action: UserAction | "none",
  userCounter: CounterChoice | null | undefined
): string {
  switch (action) {
    case "like":
      return "ユーザーはあなたの主張に「いいね」と反応しました。共感された点をさらに深掘りしてください。";
    case "reference":
      return "ユーザーは「参考になる」と評価しました。論拠を補強して、より説得力を高めてください。";
    case "oppose":
      if (userCounter) {
        return `ユーザーは次のように反論してきました: 「${userCounter.statement}」\nこの反論を真正面から受け止めて、それに対する反駁を構築してください。反論の論点を避けずに、新しい論拠・事例・データで応戦してください。`;
      }
      return "ユーザーは強く反発しました。より強気で説得力のある反論を提示してください。";
    case "none":
    default:
      return "これはラウンド1の初手です。立場を明確にした強い主張を提示してください。";
  }
}

/** Per-character desired length window. Pulled from CLAUDE.md / FALLBACK. */
function lengthWindow(level: AiLevel): { min: number; max: number } {
  // Fallbacks for un-seeded rows.
  switch (level.id) {
    case 1: return { min: 80, max: 120 };  // 囁
    case 2: return { min: 60, max: 100 };  // 惰
    case 3: return { min: 120, max: 180 }; // 量
    case 4: return { min: 100, max: 160 }; // 憤
    case 5: return { min: 100, max: 160 }; // 嘲
    case 6: return { min: 140, max: 180 }; // 詭
    case 7: return { min: 160, max: 200 }; // 識
    case 8: return { min: 120, max: 180 }; // 狂
    case 9: return { min: 140, max: 180 }; // 真
    case 10: return { min: 30, max: 60 };  // 黙
    default: return { min: 120, max: 180 };
  }
}

/** Stat block for the prompt. Returns a compact 4-axis line if stats exist. */
function statBlock(level: AiLevel): string {
  if (!level.stat_iq) return "";
  return `IQ:${level.stat_iq}/5  悪辣:${level.stat_venom}/5  機知:${level.stat_wit}/5  深慮:${level.stat_depth}/5`;
}

/** Builds the persona section so the character voice is unmistakable. */
function personaSection(level: AiLevel): string {
  const lines: string[] = [];
  lines.push(`${level.emoji} 名: ${level.name_jp}（獄吏 #${level.id} / Tier ${level.tier ?? "?"}）`);
  if (level.tagline) lines.push(`概要: ${level.tagline}`);
  const stats = statBlock(level);
  if (stats) lines.push(`ステータス: ${stats}`);
  if (level.personality) lines.push(`性格: ${level.personality}`);
  if (level.specialty) lines.push(`得意: ${level.specialty}`);
  if (level.weakness) lines.push(`弱点: ${level.weakness}`);
  if (level.catchphrase) lines.push(`決め台詞(初手 or 勝ち気な場面で1回だけ挟んでよい): 「${level.catchphrase}」`);
  return lines.join("\n");
}

// ============================================================================
// Statement generation
// ============================================================================

export interface GenerateStatementResult {
  statement: string;
  tone?: string;
  keyPoint?: string;
}

export async function generateAIStatement(
  theme: Theme,
  request: GenerateStatementRequest
): Promise<GenerateStatementResult> {
  const userStanceName =
    request.userStanceSide === "a" ? theme.stance_a_name : theme.stance_b_name;
  const aiStanceName =
    request.userStanceSide === "a" ? theme.stance_b_name : theme.stance_a_name;
  const aiStanceSummary =
    request.userStanceSide === "a"
      ? theme.stance_b_summary
      : theme.stance_a_summary;

  // Default to id 5 (嘲, Tier 3) if omitted, matching ai-levels fallback default.
  const aiLevel = await getAiLevelById(request.aiLevelId ?? 5);
  const { min, max } = lengthWindow(aiLevel);

  const prompt = `あなたは「論獄」の獄吏として、以下のテーマで指定された立場を代表し、ユーザーに反論する。

【あなたの獄吏キャラクター】
${personaSection(aiLevel)}

【このキャラクターとしての絶対的な振る舞い方】
${aiLevel.prompt_hint}

【テーマ】
タイトル: ${theme.title}
背景: ${theme.description}

【ユーザーの立場】
${userStanceName}

【あなたが代表する立場】
${aiStanceName}
基本主張: ${aiStanceSummary}

【ここまでのやり取り】
${formatHistory(request.battleHistory, aiStanceName)}

【ユーザーの最新の反応（ラウンド${request.roundNumber}）】
${actionLabel(request.userAction, request.userCounter)}

【出力要件（厳守）】
- 文字数は ${min}〜${max} 字（厳密に — このキャラはこの長さでしか喋らない）
- 上記「キャラクターとしての絶対的な振る舞い方」を最優先で守る（語尾・口調・好む語彙を必ず反映）
- 同じ論理の繰り返しは避ける
- ユーザーが反論してきた場合、その論点を避けずに正面から反駁する
- 誹謗中傷や差別表現は避ける（議論で殴る、人格は殴らない）

【出力形式】
JSON のみ返してください。他の説明文・コードブロック記号は不要。

{
  "statement": "あなたの主張（${min}-${max}字、キャラの口調で）",
  "tone": "強気" または "説得的" または "冷静" または "嘲笑" または "断定",
  "keyPoint": "この主張の最重要ポイント（20字以内）"
}`;

  try {
    const client = getClient();
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 700,
      messages: [{ role: "user", content: prompt }],
    });

    const textBlock = message.content.find((b) => b.type === "text");
    const rawText = textBlock && textBlock.type === "text" ? textBlock.text : "";
    if (!rawText) throw new Error("Empty response from Claude");

    const parsed = extractJson(rawText) as {
      statement?: string;
      tone?: string;
      keyPoint?: string;
    };

    // Looser floor for 黙 (designed for 30字+).
    const minFloor = Math.min(40, min);
    if (!parsed.statement || parsed.statement.length < minFloor) {
      throw new Error("Statement too short or missing");
    }

    return {
      statement: parsed.statement,
      tone: parsed.tone,
      keyPoint: parsed.keyPoint,
    };
  } catch (err) {
    console.error("[generateAIStatement] fallback:", err);
    return {
      statement: aiStanceSummary,
      tone: "冷静",
      keyPoint: "基本主張",
    };
  }
}

// ============================================================================
// Counter-argument generation
// ============================================================================

/**
 * Generates 3 concrete counter-argument options the user can pick from
 * after pressing 🔥 (oppose). Tone of the suggestions is tuned to the
 * AI character the user is currently fighting.
 */
export async function generateCounterChoices(
  theme: Theme,
  request: GenerateCountersRequest
): Promise<CounterChoice[]> {
  const userStanceName =
    request.userStanceSide === "a" ? theme.stance_a_name : theme.stance_b_name;
  const aiStanceName =
    request.userStanceSide === "a" ? theme.stance_b_name : theme.stance_a_name;

  const aiLevel = await getAiLevelById(request.aiLevelId ?? 5);

  const personaContext = `【相手の獄吏】
${aiLevel.emoji} ${aiLevel.name_jp}
${aiLevel.tagline}
弱点: ${aiLevel.weakness ?? "(不明)"}

→ この獄吏の弱点を突く反論カードを優先的に提示してよい。`;

  const prompt = `あなたは議論コーチ。ユーザーが「${aiStanceName}派」の獄吏に反論しようとしている。

${personaContext}

【テーマ】
${theme.title}

【ユーザーの立場】
${userStanceName}

【獄吏(${aiStanceName}派)が今言った主張】
"${request.aiStatement}"

【ここまでのやり取り】
${formatHistory(request.battleHistory, aiStanceName)}

【あなたの仕事】
このAIの主張に対して、ユーザーが選べる反論カードを3つ作る。3つは「攻撃角度」が異なる必要がある:

1. データ/事実で反駁: 具体的な統計・研究・事例でAIの前提を崩す
2. 論理で反駁: AIの論理的欠陥・矛盾・飛躍を指摘する
3. 倫理・価値観で反駁: AIが見落としている人間的・倫理的な側面を突く

【要件】
- 各 statement は 60〜100字（厳密に）。鋭く、具体的に。
- 各 label は 8〜15字で、そのカードの要点を端的に表す
- 上記「相手の獄吏の弱点」を活かす反論を1つは含める
- AIの主張の弱点を実際に突いていること（的外れな反論はダメ）
- ユーザーの立場（${userStanceName}）を擁護する方向であること

【出力形式】
JSON のみ返してください。

{
  "choices": [
    { "id": "c1", "angle": "データで反駁", "label": "短いラベル", "statement": "60-100字の反論" },
    { "id": "c2", "angle": "論理で反駁", "label": "短いラベル", "statement": "60-100字の反論" },
    { "id": "c3", "angle": "倫理で反駁", "label": "短いラベル", "statement": "60-100字の反論" }
  ]
}`;

  try {
    const client = getClient();
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 900,
      messages: [{ role: "user", content: prompt }],
    });

    const textBlock = message.content.find((b) => b.type === "text");
    const rawText = textBlock && textBlock.type === "text" ? textBlock.text : "";
    if (!rawText) throw new Error("Empty response");

    const parsed = extractJson(rawText) as { choices?: CounterChoice[] };
    if (!parsed.choices || parsed.choices.length < 3) {
      throw new Error("Not enough choices");
    }

    return parsed.choices.slice(0, 3).map((c, i) => ({
      id: c.id || `c${i + 1}`,
      label: (c.label ?? "").trim() || `反論${i + 1}`,
      statement: (c.statement ?? "").trim(),
      angle: (c.angle ?? "").trim() || "反駁",
    }));
  } catch (err) {
    console.error("[generateCounterChoices] fallback:", err);
    return [
      {
        id: "c1",
        angle: "データで反駁",
        label: "データを出せ",
        statement:
          "主張の根拠となる具体的なデータや研究結果を示してほしい。印象論ではなく実証的な裏付けが必要だ。",
      },
      {
        id: "c2",
        angle: "論理で反駁",
        label: "論点のすり替え",
        statement:
          "その論理は本題とずれている。前提と結論の間に飛躍があり、異なる論点を混同している。",
      },
      {
        id: "c3",
        angle: "倫理で反駁",
        label: "人間が抜けている",
        statement:
          "その議論には実際に影響を受ける人々の視点が欠けている。効率や理論だけでは語れない問題だ。",
      },
    ];
  }
}
