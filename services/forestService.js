/**
 * Forest Service
 * --------------
 * 全站唯一入口。React（或任何未來的前端）只需要呼叫：
 *
 *     const today = await getTodayDecision();
 *
 * 就能拿到當天所有判斷結果，完全不需要知道 Google Sheets、Blueprint
 * 公式、DNA 分數怎麼算的。這一層把六顆引擎串起來：
 *
 *   Data Repository → Blueprint → Intelligence → Opportunity → Decision → Irrigation
 */

import { getLifeGoal, getBlueprintAssumptions, getTrees, getWaterPool, getWeather } from './dataRepository.js';
import { calculateBlueprint } from './blueprintEngine.js';
import { analyzeForest } from './forestIntelligenceEngine.js';
import { evaluateOpportunity } from './opportunityEngine.js';
import { decideTrees } from './decisionEngine.js';
import { allocateIrrigation } from './irrigationEngine.js';
import { buildGuide } from './forestGuide.js';

export async function getTodayDecision(scenario = 'A') {
  const [lifeGoal, assumptions, trees, waterPool, weather] = await Promise.all([
    getLifeGoal(),
    getBlueprintAssumptions(),
    getTrees(scenario),
    getWaterPool(),
    getWeather(scenario)
  ]);

  const blueprint = calculateBlueprint(lifeGoal, assumptions);
  const intelligence = analyzeForest(trees, blueprint, lifeGoal, assumptions);
  const opportunity = evaluateOpportunity(waterPool, weather, intelligence);

  const decision = opportunity.verdict
    ? decideTrees(trees, intelligence, opportunity)
    : { all: [], candidates: [], notRecommendedSample: [], stats: null };

  const irrigated = allocateIrrigation(decision.candidates, opportunity.releaseAmount);

  const allSignals = {};
  decision.all.forEach(e => { allSignals[e.name] = e; });

  const result = {
    lifeGoal,
    assumptions,
    trees,
    blueprint,
    intelligence,
    opportunity,
    health: intelligence.health,
    issues: intelligence.issues,
    managementStage: intelligence.managementStage,
    candidates: irrigated,
    notRecommended: decision.notRecommendedSample,
    decisionStats: decision.stats,
    allSignals,
    poolTotal: waterPool.balance,
    weather
  };

  result.guide = buildGuide(result);
  return result;
}
