/**
 * Blueprint Engine
 * ----------------
 * 唯一問題：理想的退休森林應該長什麼樣？
 * 只吃 LifeGoal + BlueprintAssumptions，完全不碰 Trees（不管現況）。
 * 對應文件：Forest Blueprint Engine v1.1
 */

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

export function calculateBlueprint(lifeGoal, assumptions) {
  const { targetTotalAssets, annualCashflowTarget, growthRateTarget, riskTolerance } = lifeGoal;
  const a = assumptions;

  // ① 果樹園規模 = 年現金流目標 ÷ 果樹殖利率假設
  const fruitTarget = annualCashflowTarget / a.fruitYield;

  // ② 成長引擎規模 = 總資產目標 － 果樹園規模（苗圃不參與，見 NurseryBudget）
  const growthEngine = targetTotalAssets - fruitTarget;

  // ③ 韌性下限分配（憲法第五條：不依賴單一樹種，優先滿足，不管報酬率）
  const floors = {
    神木林: targetTotalAssets * a.floorPct.giant,
    巨木林: targetTotalAssets * a.floorPct.large,
    灌木區: targetTotalAssets * a.floorPct.shrub
  };
  const floorSum = floors.神木林 + floors.巨木林 + floors.灌木區;
  const discretionary = Math.max(0, growthEngine - floorSum);

  // ④ 反推整體所需成長率缺口
  const totalGrowthNeeded = targetTotalAssets * growthRateTarget - fruitTarget * a.fruitGrowth;
  const floorContribution =
    floors.神木林 * a.giantGrowth + floors.巨木林 * a.largeGrowth + floors.灌木區 * a.shrubGrowth;
  const discretionaryNeeded = totalGrowthNeeded - floorContribution;

  // ⑤⑥ 解出剩餘額度分給神木林 vs 積極組（巨木＋灌木）的比例 x
  const riskMix = a.riskMix[riskTolerance] || a.riskMix['穩健'];
  const aggrBlended = riskMix.large * a.largeGrowth + riskMix.shrub * a.shrubGrowth;

  let x = 1; // 預設：全部給神木林（最保守解）
  if (discretionary > 0 && aggrBlended !== a.giantGrowth) {
    const neededRate = discretionaryNeeded / discretionary;
    x = (aggrBlended - neededRate) / (aggrBlended - a.giantGrowth);
    x = clamp(x, 0, 1);
  }

  const giantExtra = discretionary * x;
  const aggrExtra = discretionary * (1 - x);

  const targets = {
    果樹園: fruitTarget,
    神木林: floors.神木林 + giantExtra,
    巨木林: floors.巨木林 + aggrExtra * riskMix.large,
    灌木區: floors.灌木區 + aggrExtra * riskMix.shrub
  };

  const totalCheck = Object.values(targets).reduce((s, v) => s + v, 0);

  const targetPct = {};
  Object.keys(targets).forEach(k => { targetPct[k] = (targets[k] / targetTotalAssets) * 100; });

  return {
    targets,       // 各林區目標規模（萬）
    targetPct,     // 各林區目標占比（%）
    totalCheck,    // 應等於 targetTotalAssets
    x,             // 剩餘額度給神木林的比例（0~1），可用來判斷目標是否偏保守/積極
    meta: { fruitTarget, growthEngine, discretionary, totalGrowthNeeded }
  };
}
