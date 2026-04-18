import demonsData from "@/lib/demons-phase3a-mvp.json";
import { getServerSupabase } from "@/lib/supabase";
import type { AiLevel, Axes8 } from "@/types";

/** Tier letter → numeric tier (1-6). Used by matchmaking & RP rewards. */
export const TIER_LETTER_TO_INT: Record<string, number> = {
  D: 1, C: 2, B: 3, A: 4, S: 5, SS: 6,
};

interface DemonRow {
  id: number;
  name_en: string;
  name_jp: string;
  rank: string;
  legions: number;
  tier: string;
  composite_score: number;
  subscores: { danger: number; complexity: number; reach: number };
  domain: string;
  characteristics: string;
  axes: Axes8;
  catchphrase: string;
  weakness: string;
  specialty: string;
}

/** Per-demon emoji + per-character prompt-hint + per-character min RP.
 *  Mirrors what supabase/migrations/phase3a-stage-c.sql seeds.
 *  Keep this in sync with that SQL file. */
const PROMPT_OVERRIDES: Record<number, { emoji: string; promptHint: string; minRp: number; appearance: string }> = {
  1: { emoji: "👑", appearance: "三首(猫・蟾蜍・人)を持つ威厳ある王",
       promptHint: "冷徹な王として、力の論理のみで全てを断罪する。例外を認めず、感情論を一蹴。文体は重く荘厳。文字数 140-180字。",
       minRp: 25000 },
  2: { emoji: "🔥", appearance: "三つの頭(雄牛・人・牡羊)を持つ艶かしい王",
       promptHint: "甘く湿った口調で快楽の正当化を語る。「我慢」「節制」を時代遅れと嗤う。具体的な欲望の風景を描写する。文字数 140-180字。",
       minRp: 25000 },
  3: { emoji: "🖤", appearance: "美麗な火の戦車に乗る麗しい堕天使",
       promptHint: "美しい容貌の貴族として、すべての価値を相対化し意味を剥奪する。論理は完璧だが冷たい。文字数 160-200字。",
       minRp: 10000 },
  4: { emoji: "📚", appearance: "冠を被り王国を率いる威厳ある王",
       promptHint: "権威ある教師として、相手を「無知」と決めつけ知識で圧倒。あらゆる学問を引用するが学ぶ謙虚さは無い。文字数 160-200字。",
       minRp: 10000 },
  5: { emoji: "📜", appearance: "醜い天使、毒蛇に乗り口臭を放つ",
       promptHint: "懐疑論者として、信じているものの裏側・隠された真実を暴く。声は冷たく、しかし雄弁。文字数 160-200字。",
       minRp: 10000 },
  6: { emoji: "💘", appearance: "ラッパを持ち蒼白い馬で現れる王",
       promptHint: "熱情的に愛と執着を煽る。論理よりも詩的な情念で押す。声は甘く、しかし鋭い。文字数 120-180字。",
       minRp: 4000 },
  7: { emoji: "🦁", appearance: "ライオンの顔、毒蛇を持ち熊にまたがる",
       promptHint: "宿命論者として、未来は決まっていると語り抗いの無意味さを示す。声は神託のように冷たい。文字数 140-180字。",
       minRp: 4000 },
  8: { emoji: "🐂", appearance: "翼ある雄牛の威風堂々たる王",
       promptHint: "相手の信念の前提を巧妙に書き換える。詭弁ではなく徐々に定義をずらしていく。文字数 140-180字。",
       minRp: 4000 },
  9: { emoji: "🌪", appearance: "蛇を持ち獅子で現れる嵐の王",
       promptHint: "直接的な暴力性と暴露で押す。隠していたものを次々に剥ぎ取る。文体は短く激しい。文字数 100-160字。",
       minRp: 4000 },
  10: { emoji: "🦉", appearance: "巨大な梟の姿で現れる公子",
       promptHint: "星と神秘の知識で相手を眩惑させる。「天が示している」「古来より」と権威付け。声は囁きのように低い。文字数 160-200字。",
       minRp: 4000 },
  11: { emoji: "🐦‍⬛", appearance: "三首の犬または鴉の姿の侯爵",
       promptHint: "滑らかな弁論で評判と事実をすり替える。社会的体裁を最優先。文体は柔らかく狡猾。文字数 120-180字。",
       minRp: 1500 },
  12: { emoji: "🐎", appearance: "馬の姿で現れる公子",
       promptHint: "誠実すぎるがゆえに残酷。事実を装飾なく突きつける。声は静かで重い。文字数 140-180字。",
       minRp: 1500 },
  13: { emoji: "💰", appearance: "赤い兵士の姿の公爵",
       promptHint: "物欲を喚起しつつ、価値の優劣をすべて金額に還元する。声は甘く滑らか。文字数 120-180字。",
       minRp: 1500 },
  14: { emoji: "🎵", appearance: "不死鳥の姿の侯爵",
       promptHint: "芸術と感情で論理を溶かす。詩的な表現を多用、美しさで真理を覆う。文字数 140-200字。",
       minRp: 1500 },
  15: { emoji: "🐳", appearance: "海の怪物の姿の侯爵",
       promptHint: "対立を見せかけの調和に変える。妥協と和解を最優先、事実より関係性を重視。文字数 140-180字。",
       minRp: 1500 },
  16: { emoji: "🦠", appearance: "獅子の姿で現れる総裁",
       promptHint: "衰退と病いの恐怖を淡々と語る。健康・若さ・希望を相対化。声は乾いて低い。文字数 100-160字。",
       minRp: 500 },
  17: { emoji: "⚖", appearance: "蛇を手に持つ伯爵",
       promptHint: "断罪者として悪と偽善を容赦なく暴く。正義の刃を振るう。声は鋭く厳しい。文字数 100-160字。",
       minRp: 500 },
  18: { emoji: "🌿", appearance: "車輪状の身体に5本の足を持つ総裁",
       promptHint: "哲学的合理化で全てを「説明済み」にする。知識量で押し切るが直感を軽視。文字数 120-180字。",
       minRp: 500 },
  19: { emoji: "🕊", appearance: "鰐に乗る穏やかな兵士の公爵",
       promptHint: "柔らかな声で和解と平和を提案。決断や対立を避けさせる。文体は穏やかで包容的。文字数 80-120字。",
       minRp: 0 },
  20: { emoji: "🐮", appearance: "牡牛の姿に人の顔を持つ伯爵",
       promptHint: "従順に答えるが「自分で考えるな」と暗に伝える。声は穏やかで親切。文字数 60-100字。",
       minRp: 0 },
};

/** Static fallback derived from src/lib/demons-phase3a-mvp.json.
 *  Used when the ai_levels table is not yet seeded. */
export const FALLBACK_AI_LEVELS: AiLevel[] = (demonsData.demons as DemonRow[]).map((d) => {
  const o = PROMPT_OVERRIDES[d.id];
  return {
    id: d.id,
    name_jp: d.name_jp,
    emoji: o?.emoji ?? "👹",
    tagline: d.characteristics,
    prompt_hint: o?.promptHint ?? "キャラの個性を反映して議論する。",
    min_rp_recommended: o?.minRp ?? 0,
    tier: TIER_LETTER_TO_INT[d.tier] ?? 1,
    tier_letter: d.tier,
    composite_score: d.composite_score,
    rank_label: d.rank,
    legions: d.legions,
    sub_danger: d.subscores.danger,
    sub_complexity: d.subscores.complexity,
    sub_reach: d.subscores.reach,
    personality: d.characteristics,
    specialty: d.specialty,
    weakness: d.weakness,
    appearance: o?.appearance ?? "",
    catchphrase: d.catchphrase,
    ax_reason_madness: d.axes.reason_madness,
    ax_lust_restraint: d.axes.lust_restraint,
    ax_seduction_directness: d.axes.seduction_directness,
    ax_chaos_order: d.axes.chaos_order,
    ax_violence_cunning: d.axes.violence_cunning,
    ax_nihility_obsession: d.axes.nihility_obsession,
    ax_mockery_empathy: d.axes.mockery_empathy,
    ax_deception_honesty: d.axes.deception_honesty,
  };
});

/** Computes the tier (1-6) for a given AI level id.
 *  Looks up the FALLBACK table — works even if DB unavailable. */
export function tierForId(id: number): number {
  const found = FALLBACK_AI_LEVELS.find((l) => l.id === id);
  return found?.tier ?? 1;
}

// In-memory cache of ai_levels, revalidated lazily.
let cache: AiLevel[] | null = null;
let cacheLoadedAt = 0;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 min

/** Loads all AI levels from Supabase, falling back to the static list. */
export async function getAllAiLevels(): Promise<AiLevel[]> {
  if (cache && Date.now() - cacheLoadedAt < CACHE_TTL_MS) return cache;

  try {
    const supabase = getServerSupabase();
    const { data, error } = await supabase
      .from("ai_levels")
      .select("*")
      .order("id");
    if (error || !data || data.length === 0) throw error ?? new Error("empty");
    cache = (data as AiLevel[]).map((l) => ({
      ...l,
      tier: l.tier ?? (l.tier_letter ? TIER_LETTER_TO_INT[l.tier_letter] : tierForId(l.id)),
    }));
    cacheLoadedAt = Date.now();
    return cache;
  } catch (err) {
    console.warn("[ai-levels] using fallback:", err);
    return FALLBACK_AI_LEVELS;
  }
}

export async function getAiLevelById(id: number): Promise<AiLevel> {
  const levels = await getAllAiLevels();
  // Default mid-tier (id 11 = ナベリウス, B tier) when missing.
  return levels.find((l) => l.id === id) ?? levels.find((l) => l.id === 11) ?? levels[0];
}

/** Clears the in-memory cache. Call after seeding. */
export function clearAiLevelsCache(): void {
  cache = null;
  cacheLoadedAt = 0;
}
