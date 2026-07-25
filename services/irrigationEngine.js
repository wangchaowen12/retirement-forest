/**
 * Irrigation Engine
 * -----------------
 * 唯一問題：該投入多少？輸入是 Decision Engine 的合格樹清單（含 decisionScore）
 * + Opportunity Engine 的今日可釋出金額。分配總額永遠不超過 releaseAmount。
 *
 * 用 decisionScore 直接當分配權重——Blueprint 缺口跟森林集中度的修正
 * 已經算進分數裡了，這裡不需要再重算一次配置缺口。
 */

export function allocateIrrigation(candidates, releaseAmount) {
  if (!candidates.length || releaseAmount <= 0) return [];

  const totalScore = candidates.reduce((s, c) => s + c.score, 0);

  return candidates
    .map(c => ({ ...c, amount: Math.round(((releaseAmount * c.score) / totalScore) * 10) / 10 }))
    .sort((a, b) => b.amount - a.amount);
}
