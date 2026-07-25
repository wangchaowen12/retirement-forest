/**
 * Reason Builder
 * --------------
 * Decision Engine 只回答「這棵樹幾分」，這裡負責回答「為什麼是這個分數」。
 * 輸入是 Decision Engine 算好的 breakdown（各項子分數），輸出一組
 * 半技術、但看得懂的理由句子——比 Engine 的原始分數容易讀，但還沒到
 * Forest Guide 那種完全白話、完全不帶術語的程度。Forest Guide 會再把
 * 這裡的東西轉譯成更口語的敘述給 UI。
 *
 *   Decision Engine → 算分數（85）
 *   Reason Builder  → 為什麼是 85（"已修正22%"、"占比仍有缺口"）
 *   Forest Guide    → 講給你聽（"今天建議補神木林"）
 */

const GROUP_OF = {
  果樹園: '果樹園', 神木林: '神木林', 巨木林: '巨木林',
  AI灌木: '灌木區', 多元灌木: '灌木區', 新主題灌木: '灌木區'
};

export function buildReasons(tree, intelligence, breakdown) {
  const group = GROUP_OF[tree.area];
  const risk = tree.fundamentals?.risk || {};
  const reasons = [];

  if (breakdown.weather >= 10) reasons.push(`已修正 ${risk.drawdownPct}%，出現進場機會`);
  if (breakdown.valuation >= 10) reasons.push('目前估值低於自身歷史均值');
  if (breakdown.valuation <= -10) reasons.push('目前估值高於自身歷史均值，非好進場點');
  if (breakdown.blueprint >= 10) reasons.push(`${group}占比仍有缺口`);
  if (breakdown.forestPenalty <= -15) reasons.push(`${group}已明顯超出 Blueprint 目標，依規則降級`);
  else if (breakdown.forestPenalty <= -5) reasons.push(`${group}略微超配，小幅降級`);
  else if (breakdown.blueprint > 0) reasons.push(`${group}明顯不足，優先考慮補齊`);

  if (reasons.length === 0) reasons.push('基本面穩定，暫無明顯加分或扣分因素');
  return reasons;
}
