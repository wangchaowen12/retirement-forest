/**
 * Forest Intelligence Engine
 * --------------------------
 * 唯一做「比較」與「下判斷」的地方：拿 Blueprint（理想）跟 Trees（現況）比較，
 * 算出森林健康分數、依嚴重度排序的問題清單、目前管理階段。
 * 對應文件：Forest Intelligence Engine v1.0
 */

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

const GROUP_OF = {
  果樹園: '果樹園', 神木林: '神木林', 巨木林: '巨木林',
  AI灌木: '灌木區', 多元灌木: '灌木區', 新主題灌木: '灌木區',
  苗圃: '苗圃'
};

export function analyzeForest(trees, blueprint, lifeGoal, assumptions) {
  const totalValue = trees.reduce((s, t) => s + t.marketValue, 0);

  const grouped = {};
  trees.forEach(t => {
    const g = GROUP_OF[t.area] || t.area;
    grouped[g] = (grouped[g] || 0) + t.marketValue;
  });

  const areaPct = {};
  Object.keys(blueprint.targets).forEach(g => { areaPct[g] = ((grouped[g] || 0) / totalValue) * 100; });

  // ---- 集中度：最大單一持股 ----
  const nonNursery = trees.filter(t => t.area !== '苗圃');
  const maxTree = nonNursery.reduce((a, b) => (a.marketValue > b.marketValue ? a : b));
  const maxPct = (maxTree.marketValue / totalValue) * 100;
  const concentrationScore = clamp(100 - Math.max(0, maxPct - 10) * 2, 0, 100);

  // ---- 韌性：各林區偏離 Blueprint 允許區間的程度（容忍帶 ±5pp）----
  let deviation = 0;
  Object.keys(blueprint.targetPct).forEach(g => {
    const target = blueprint.targetPct[g];
    const tol = 5;
    if (areaPct[g] < target - tol) deviation += (target - tol) - areaPct[g];
    if (areaPct[g] > target + tol) deviation += areaPct[g] - (target + tol);
  });
  const resilienceScore = clamp(100 - deviation, 0, 100);

  // ---- 現金流：果樹園現況預期年化現金流 ÷ 年現金流目標 ----
  const fruitValue = grouped['果樹園'] || 0;
  const cashflowScore = clamp(((fruitValue * assumptions.fruitYield) / lifeGoal.annualCashflowTarget) * 100, 0, 100);

  // ---- 成長：目前組合加權預期成長率 ÷ Blueprint 成長率目標 ----
  const growthOf = {
    果樹園: assumptions.fruitGrowth, 神木林: assumptions.giantGrowth,
    巨木林: assumptions.largeGrowth, 灌木區: assumptions.shrubGrowth, 苗圃: 0.15
  };
  const weightedGrowth = Object.keys(grouped).reduce((s, g) => s + grouped[g] * (growthOf[g] || 0), 0) / totalValue;
  const growthScore = clamp((weightedGrowth / lifeGoal.growthRateTarget) * 100, 0, 100);

  // ---- 多元化：最大林區占比 ----
  const areasExclNursery = Object.keys(grouped).filter(g => g !== '苗圃');
  const maxAreaVal = Math.max(...areasExclNursery.map(g => grouped[g]));
  const maxAreaPct = (maxAreaVal / totalValue) * 100;
  const diversificationScore = clamp(100 - Math.max(0, maxAreaPct - 20) * 2, 0, 100);

  const scores = {
    concentration: Math.round(concentrationScore),
    resilience: Math.round(resilienceScore),
    cashflow: Math.round(cashflowScore),
    growth: Math.round(growthScore),
    diversification: Math.round(diversificationScore)
  };
  // DNA 五項子分數目前均權（20% ×5）。權重不寫死於邏輯之外，未來可由 AI
  // 依實際決策品質提出調整建議（見 DNAScoreWeights，AI 主導、人確認）。
  const WEIGHTS = { concentration: 0.2, resilience: 0.2, cashflow: 0.2, growth: 0.2, diversification: 0.2 };
  const health = Math.round(Object.keys(scores).reduce((s, k) => s + scores[k] * WEIGHTS[k], 0));

  // ---- 問題清單（依嚴重度排序，首頁只顯示前 2~3 項，Engine 內部保留完整排序）----
  // Problem Merge：果樹園不足跟現金流不足本質上是同一件事（現金流不足的
  // 根本原因就是果樹園還沒長到位），合併成一則，避免首頁重複描述。
  const issues = [];
  const fruitTarget = blueprint.targetPct['果樹園'] || 0;
  const fruitRatio = fruitTarget > 0 ? (areaPct['果樹園'] / fruitTarget) * 100 : 0;

  // 在目前的公式下，現金流分數＝果樹園市值 × 殖利率 ÷ 現金流目標，
  // 所以「現金流不足」在數學上永遠跟「果樹園不足」同源，一律合併成一則。
  if (cashflowScore < 50) {
    issues.push({
      severity: 3, kind: 'shortfall', area: '果樹園', title: '🍎 果樹園不足',
      detail: `目前完成率 ${Math.round(fruitRatio)}%，導致退休現金流僅達目標 ${Math.round(cashflowScore)}%`
    });
  }

  Object.keys(blueprint.targetPct).forEach(g => {
    if (g === '果樹園') return;
    const target = blueprint.targetPct[g];
    const ratio = target > 0 ? (areaPct[g] / target) * 100 : 0;
    if (ratio > 150) {
      issues.push({
        severity: 2, kind: 'concentration', area: g, title: `🌳 ${g}過度集中`,
        detail: `${maxTree.name}占森林總資產 ${maxPct.toFixed(1)}%，${g}達 Blueprint 目標的 ${Math.round(ratio)}%`
      });
    } else if (ratio < 50) {
      issues.push({ severity: 1, kind: 'shortfall', area: g, title: `🌲 ${g}不足`, detail: `完成率僅 ${Math.round(ratio)}%，離 Blueprint 目標仍有距離` });
    }
  });
  issues.sort((a, b) => b.severity - a.severity);

  // ---- 管理階段（任務型，不是完成率切點）----
  let managementStage = 'Alignment';
  const cashflowResilientEnough = cashflowScore >= 100 && resilienceScore >= 90;
  if (lifeGoal.retired || cashflowResilientEnough) managementStage = 'Stewardship';
  else if (resilienceScore >= 90) managementStage = 'Resilience';

  return {
    totalValue, grouped, areaPct, targetPct: blueprint.targetPct,
    scores, health, issues: issues.slice(0, 3), managementStage,
    maxTree: maxTree.name, maxPct
  };
}
