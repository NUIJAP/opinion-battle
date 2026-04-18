import Anthropic from "@anthropic-ai/sdk";
import type {
  AiLevel,
  Axes8,
  BattleHistoryEntry,
  GenerateStatementRequest,
  Theme,
} from "@/types";
import { getAiLevelById, tierForId } from "@/lib/ai-levels";

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
      const userPart = r.userInput
        ? `\n   ユーザーの応答: 「${r.userInput}」`
        : "";
      return `ラウンド${r.round}:\n   ${aiStanceName}派の主張: 「${r.aiStatement}」${userPart}`;
    })
    .join("\n");
}

/** Per-character desired length window. */
function lengthWindow(level: AiLevel): { min: number; max: number } {
  switch (level.id) {
    case 1: return { min: 80, max: 120 };
    case 2: return { min: 60, max: 100 };
    case 3: return { min: 120, max: 180 };
    case 4: return { min: 100, max: 160 };
    case 5: return { min: 100, max: 160 };
    case 6: return { min: 140, max: 180 };
    case 7: return { min: 160, max: 200 };
    case 8: return { min: 120, max: 180 };
    case 9: return { min: 140, max: 180 };
    case 10: return { min: 30, max: 60 };
    default: return { min: 120, max: 180 };
  }
}

function statBlock(level: AiLevel): string {
  if (!level.stat_iq) return "";
  return `IQ:${level.stat_iq}/5  悪辣:${level.stat_venom}/5  機知:${level.stat_wit}/5  深慮:${level.stat_depth}/5`;
}

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

function helperSection(helper: AiLevel): string {
  return `【ユーザーの召喚した助太刀獄吏】
${helper.emoji} ${helper.name_jp}: ${helper.tagline}
得意: ${helper.specialty ?? ""}
助言スタイル: ${helper.prompt_hint}
→ ユーザーはこの獄吏の助言を踏まえて応答している、と仮定して評価してよい。`;
}

/** Tier-derived base damage the AI deals to the user with each statement. */
function baseAiDamage(tier: number): number {
  // Tier1 → 8, Tier2 → 12, Tier3 → 16, Tier4 → 20, Tier5 → 25
  const table = [0, 8, 12, 16, 20, 25];
  return table[Math.max(1, Math.min(5, tier))] ?? 10;
}

/** Tier-derived resistance: high-tier AI takes less damage from user input. */
function aiResistanceMultiplier(tier: number): number {
  const table = [0, 1.0, 1.0, 0.85, 0.75, 0.65];
  return table[Math.max(1, Math.min(5, tier))] ?? 1.0;
}

// ============================================================================
// Public types for the wrapped Claude call
// ============================================================================

export interface GenerateStatementResult {
  statement: string;
  tone?: string;
  keyPoint?: string;
  userInputAxes: Axes8 | null;
  userInputStrength: number; // 0-100
  hpDamageToUser: number;
  hpDamageToAi: number;
}

// ============================================================================
// generateAIStatement — Stage B
// ============================================================================

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

  const aiLevel = await getAiLevelById(request.aiLevelId ?? 5);
  const aiTier = aiLevel.tier ?? tierForId(aiLevel.id);
  const { min, max } = lengthWindow(aiLevel);

  const helper =
    request.summonedHelperId != null
      ? await getAiLevelById(request.summonedHelperId)
      : null;

  const userInput = (request.userInput ?? "").trim();
  const isOpening = request.roundNumber === 1 || userInput.length === 0;

  const userTurnSection = isOpening
    ? "（これはラウンド1の初手、もしくはユーザーが入力をスキップした。あなたから先に主張を提示せよ。）"
    : `【ユーザー(${userStanceName}派)の今ラウンドの応答】
「${userInput}」
${helper ? helperSection(helper) : ""}
この応答を上記キャラ性格で受け止め、以下を全て満たす出力を返せ:
- ユーザー応答を 8軸 (data, ethics, emotion, persuasion, flexibility, aggression, calm, humor) で 1-5 評価
- ユーザー応答の総合的な強さを 0-100 で評価 (論理性・具体性・説得力)
- その応答を真正面から受けて、あなたの立場(${aiStanceName}派)を擁護する反撃を放つ`;

  const prompt = `あなたは「論獄」の獄吏。指定された立場を代表し、ユーザーと議論で殴り合う。

【あなたの獄吏キャラクター】
${personaSection(aiLevel)}

【絶対的な振る舞い方】
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

${userTurnSection}

【出力要件】
- statement は ${min}〜${max} 字、上記キャラ口調で
- 同じ論理の繰り返しは避ける
- 誹謗中傷・差別表現は避ける（議論で殴る、人格は殴らない）

【出力形式】
JSON のみ。説明文・コードブロック記号不要。

{
  "statement": "あなたの主張（${min}-${max}字、キャラの口調で）",
  "tone": "強気 / 説得的 / 冷静 / 嘲笑 / 断定 のいずれか",
  "keyPoint": "この主張の最重要ポイント（20字以内）",
  "user_input_axes": ${isOpening ? "null" : `{ "data":1-5, "ethics":1-5, "emotion":1-5, "persuasion":1-5, "flexibility":1-5, "aggression":1-5, "calm":1-5, "humor":1-5 }`},
  "user_input_strength": ${isOpening ? "0" : "0-100 の整数 (ユーザー応答の総合的な強さ)"}
}`;

  // Defaults for fallback path.
  const baseDmg = baseAiDamage(aiTier);

  try {
    const client = getClient();
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 900,
      messages: [{ role: "user", content: prompt }],
    });

    const textBlock = message.content.find((b) => b.type === "text");
    const rawText = textBlock && textBlock.type === "text" ? textBlock.text : "";
    if (!rawText) throw new Error("Empty response from Claude");

    const parsed = extractJson(rawText) as {
      statement?: string;
      tone?: string;
      keyPoint?: string;
      user_input_axes?: Axes8 | null;
      user_input_strength?: number;
    };

    const minFloor = Math.min(40, min);
    if (!parsed.statement || parsed.statement.length < minFloor) {
      throw new Error("Statement too short or missing");
    }

    const userInputAxes = isOpening ? null : (parsed.user_input_axes ?? null);
    const userStrength = isOpening
      ? 0
      : Math.max(0, Math.min(100, parsed.user_input_strength ?? 30));

    // Damage calc.
    // Mitigation: strong user input absorbs damage from AI's rebuttal.
    const mitigation = Math.round(userStrength * 0.10);
    const hpDamageToUser = isOpening
      ? baseDmg
      : Math.max(2, baseDmg - mitigation);

    // User attacks AI: scaled by userStrength × resistance.
    const hpDamageToAi = isOpening
      ? 0
      : Math.round((userStrength / 4) * aiResistanceMultiplier(aiTier));

    return {
      statement: parsed.statement,
      tone: parsed.tone,
      keyPoint: parsed.keyPoint,
      userInputAxes,
      userInputStrength: userStrength,
      hpDamageToUser,
      hpDamageToAi,
    };
  } catch (err) {
    console.error("[generateAIStatement] fallback:", err);
    return {
      statement: aiStanceSummary,
      tone: "冷静",
      keyPoint: "基本主張",
      userInputAxes: null,
      userInputStrength: 0,
      hpDamageToUser: baseDmg,
      hpDamageToAi: 0,
    };
  }
}
