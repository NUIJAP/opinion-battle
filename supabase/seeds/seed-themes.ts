/**
 * Alternative to running supabase/seeds/seed-themes.sql directly.
 *
 * Usage:
 *   1. Ensure .env.local has NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
 *   2. Ensure schema.sql has been applied
 *   3. npm run seed
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const THEMES = [
  {
    title: "AI規制は必要か？",
    description:
      "生成AIの急速な普及で、著作権・雇用・偽情報などの懸念が広がる一方、過度な規制はイノベーションを阻害するという議論もある。",
    stance_a_name: "規制推進派",
    stance_b_name: "市場重視派",
    stance_a_summary:
      "AIの進化は速すぎる。著作権侵害や偽情報、雇用破壊が社会を壊す前に、政府主導で明確なルール設計が必要だ。民間任せでは間に合わない。",
    stance_b_summary:
      "規制はイノベーションを殺す。AIの恩恵は医療・教育・経済で既に実証済み。市場と現場の自律的な調整に委ねた方が結果的に社会は豊かになる。",
    difficulty: 2,
    active: true,
  },
  {
    title: "SNS年齢制限は必要か？",
    description:
      "若年層のメンタルヘルス悪化がSNS利用と関連づけられ、各国で16歳未満のSNS利用制限が議論されている。一方で、表現の自由や情報アクセスの権利との衝突も指摘される。",
    stance_a_name: "制限賛成派",
    stance_b_name: "自由重視派",
    stance_a_summary:
      "子どものうつ病・自殺率はSNS普及後に急増した。発達段階にある脳に対する害は明白で、年齢制限は酒やタバコと同様の当然の保護措置だ。",
    stance_b_summary:
      "子どもから情報と繋がりを奪うのは過剰反応。問題は使い方の教育であって、一律禁止は貧困層や性的少数者など孤立しがちな子を追い詰める。",
    difficulty: 2,
    active: true,
  },
  {
    title: "リモートワークは義務化すべきか？",
    description:
      "通勤ラッシュや地方過疎、CO2排出の観点から、一定業種のリモートワーク義務化案が浮上。生産性や組織文化の観点から反論も根強い。",
    stance_a_name: "リモート義務派",
    stance_b_name: "オフィス回帰派",
    stance_a_summary:
      "通勤は生涯で数千時間の損失、都市集中は地方を疲弊させる。リモート可能な職種の義務化は、環境・地方創生・個人の自由すべてに寄与する。",
    stance_b_summary:
      "対面の偶発的な会話が組織の創造性を生む。若手の育成もリモートでは限界がある。選択肢として残すべきだが、義務化は組織文化を壊す。",
    difficulty: 1,
    active: true,
  },
] as const;

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error(
      "Missing env: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
    );
    process.exit(1);
  }
  const supabase = createClient(url, key, {
    auth: { persistSession: false },
  });

  console.log(`Seeding ${THEMES.length} themes...`);
  const { data, error } = await supabase
    .from("themes")
    .upsert(THEMES as unknown as Record<string, unknown>[], {
      onConflict: "title",
    })
    .select("id, title");

  if (error) {
    console.error("Seed failed:", error);
    process.exit(1);
  }
  console.log("Seeded:");
  data?.forEach((t) => console.log(`  - ${t.title}  (${t.id})`));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
