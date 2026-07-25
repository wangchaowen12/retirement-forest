/**
 * Opportunity Engine
 * ------------------
 * 唯一問題：今天要不要出手？不看任何單一股票，只看蓄水池、天氣、森林整體狀態。
 */

const WEATHER_RELEASE_PCT = {
  晴天: 0, 春雨: 10, 修正季: 20, 暴風雨: 20, 森林火災: 30
};

export function evaluateOpportunity(waterPool, weather, intelligence) {
  const releasePct = WEATHER_RELEASE_PCT[weather.condition] ?? 0;
  const verdict = releasePct > 0 && waterPool.balance > 0;
  const releaseAmount = verdict ? Math.round((waterPool.balance * releasePct) / 100) : 0;

  const factors = [
    { label: '蓄水池水位', value: `${waterPool.balance >= 30 ? '充足' : '普通'}（${waterPool.balance}萬）` },
    { label: '森林天氣', value: weather.label }
  ];

  const reason = verdict
    ? `${weather.label}，且蓄水池水位${waterPool.balance}萬，值得放水補齊配置缺口。`
    : '沒有明顯修正，今天沒有值得出手的機會。';

  return { verdict, releasePct, releaseAmount, factors, reason };
}
