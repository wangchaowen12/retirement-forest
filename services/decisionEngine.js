/**
 * Decision Engine
 * ---------------
 * 唯一問題：哪些樹值得灌溉？不決定金額（那是 Irrigation Engine 的事）。
 * 不負責「為什麼」（那是 reasonBuilder.js 的事，見底部 import）。
 *
 * 重要規則：這個檔案永遠不會出現 peRatio、forwardPE、trailingPE 這種
 * 第三方 API 的欄位名稱。所有讀取都經過 Data Contract v1.1 的正規化
 * 形狀：tree.fundamentals.valuation / quality / risk / scores。
 * 哪天 Yahoo 改欄位名稱，只需要改 dataProviders/normalize.js，
 * 這個檔案一個字都不用動。
 *
 * 核心輸出是 decisionScore（0~100），訊號燈是分數的呈現方式，不是判斷本身：
 *   85+     🟢 優先灌溉
 *   70~84   🟡 分批灌溉
 *   50~69   🔵 持續觀察
 *   50以下  🔴 暫緩投入
 */

import { buildReasons } from './reasonBuilder.js';

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

const GROUP_OF = {
  果樹園: '果樹園', 神木林: '神木林', 巨木林: '巨木林',
  AI灌木: '灌木區', 多元灌木: '灌木區', 新主題灌木: '灌木區'
};

/* ---- 評分模組（各自獨立，未來可個別替換）---- */

// 如果 Provider 本身就能給複合品質分數（例如未來 Morningstar 的
// Quality Score），優先採用；沒有的話才用中性偏正的基準分數頂著，
// 等真正接上財報 API 後這裡才會有自己的計算邏輯。
function calculateFundamentalScore(tree) {
  const qualityScore = tree.fundamentals?.scores?.qualityScore;
  if (qualityScore != null) return Math.round(clamp((qualityScore - 50) * 0.4, -20, 20));
  return 12;
}

function calculateValuationScore(tree) {
  const valuationScore = tree.fundamentals?.scores?.valuationScore;
  if (valuationScore != null) return Math.round(clamp((valuationScore - 50) * 0.4, -20, 20));

  const valuation = tree.fundamentals?.valuation || {};
  if (valuation.pe && valuation.peAvg5y) {
    const ratio = valuation.pe / valuation.peAvg5y;
    return Math.round(clamp((1 - ratio) * 60, -20, 20));
  }
  const streak = tree.fundamentals?.quality?.dividendStreakYears;
  if (typeof streak === 'number') return streak >= 5 ? 10 : 0;
  return 0;
}

function calculateWeatherScore(tree) {
  const dd = tree.fundamentals?.risk?.drawdownPct || 0;
  return Math.round(clamp(dd - 5, -10, 20));
}

function calculateOpportunityScore(opportunity) {
  return Math.round(clamp((opportunity.releasePct || 0) / 2, 0, 15));
}

function calculateBlueprintScore(tree, intelligence) {
  const group = GROUP_OF[tree.area];
  const actual = intelligence.areaPct[group] || 0;
  const target = intelligence.targetPct[group] || 0;
  const gap = target - actual;
  return Math.round(clamp(gap * 1.5, -15, 20));
}

function calculateForestPenalty(tree, intelligence) {
  const group = GROUP_OF[tree.area];
  const actual = intelligence.areaPct[group] || 0;
  const target = intelligence.targetPct[group] || 0;
  if (!target) return 0;
  const ratio = (actual / target) * 100;
  if (ratio > 150) return -Math.min(40, Math.round((ratio - 150) * 0.25) + 20);
  if (ratio > 110) return -8;
  return 0;
}

function toSignal(score) {
  if (score >= 85) return '🟢';
  if (score >= 70) return '🟡';
  if (score >= 50) return '🔵';
  return '🔴';
}

/* ---- 合成：Decision Score ---- */
function calculateDecisionScore(tree, intelligence, opportunity) {
  const base = 50;
  const fundamental = calculateFundamentalScore(tree);
  const valuation = calculateValuationScore(tree);
  const weather = calculateWeatherScore(tree);
  const opp = calculateOpportunityScore(opportunity);
  const blueprint = calculateBlueprintScore(tree, intelligence);
  const forestPenalty = calculateForestPenalty(tree, intelligence);

  const preRaw = base + fundamental + valuation + weather + opp + blueprint;
  const preScore = Math.round(clamp(preRaw, 0, 100));
  const score = Math.round(clamp(preRaw + forestPenalty, 0, 100));

  return {
    score, preScore,
    signal: toSignal(score), preSignal: toSignal(preScore),
    breakdown: { fundamental, valuation, weather, opportunity: opp, blueprint, forestPenalty }
  };
}

// 資料完整度護欄：把 completeness（0~100）換算成這棵樹今天分數的上限。
// 可信度越低，代表我們其實越不了解這家公司，就算林區缺口再大，
// 也不該被動地推上🟢——用分級取代原本「有資料/沒資料」的二分法，
// 但護欄背後的精神完全沒變。這幾個門檻是唯一跟 completeness 掛勾的
// 地方，之後不管資料源是 Yahoo 還是 Finnhub，這裡都不用改。
function confidenceCap(confidence) {
  if (confidence >= 70) return 100; // 資料足夠完整，不額外設限
  if (confidence >= 40) return 84;  // 資料部分齊全，先別放到最高的🟢
  return 69;                        // 資料明顯不足，僅列入觀察
}

function evaluateTree(tree, intelligence, opportunity) {
  let { score, preScore, breakdown } = calculateDecisionScore(tree, intelligence, opportunity);

  const confidence = tree.fundamentals?.completeness ?? 0;
  const cap = confidenceCap(confidence);
  let dataCapped = false;
  if (score > cap) { score = cap; dataCapped = true; }
  if (preScore > cap) preScore = cap;

  const signal = toSignal(score);
  const preSignal = toSignal(preScore);
  const reasons = buildReasons(tree, intelligence, breakdown);
  if (dataCapped) reasons.push(`目前資料完整度僅 ${confidence}%，暫不主動推薦，僅列入觀察`);

  const downgradedByForest = (preSignal === '🟢' || preSignal === '🟡') && (signal === '🔴' || signal === '🔵');

  return { name: tree.name, area: tree.area, species: tree.species, score, signal, confidence, preScore, preSignal, downgradedByForest, breakdown, reasons };
}

export function decideTrees(trees, intelligence, opportunity) {
  const evaluated = trees
    .filter(t => t.species !== '苗圃')
    .map(t => evaluateTree(t, intelligence, opportunity))
    .sort((a, b) => b.score - a.score);

  const candidates = evaluated.filter(e => e.signal === '🟢' || e.signal === '🟡');
  const notRecommendedSample = evaluated
    .filter(e => e.signal === '🔴')
    .concat(evaluated.filter(e => e.signal === '🔵').slice(0, 2))
    .slice(0, 3);

  const passedBeforePenalty = evaluated.filter(e => e.preSignal === '🟢' || e.preSignal === '🟡');
  const downgraded = evaluated.filter(e => e.downgradedByForest);
  const downgradedAreas = [...new Set(downgraded.map(e => GROUP_OF[e.area]))];

  const stats = {
    totalChecked: evaluated.length,
    passedBeforePenalty: passedBeforePenalty.length,
    downgradedCount: downgraded.length,
    downgradedAreas,
    finalCandidateCount: candidates.length
  };

  return { all: evaluated, candidates, notRecommendedSample, stats };
}
