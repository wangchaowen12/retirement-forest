/**
 * Forest Guide
 * ------------
 * 不是第七顆 Engine，是「呈現層」：Engine 負責分析（算分數），
 * Guide 負責理解（把結果講成人話），UI 只呈現 Guide 的句子。
 *
 * 三層資訊架構：
 *   Layer 1（一眼看到）  conclusion      一句結論
 *   Layer 2（點一下展開）reasons         3~5 個支持結論的理由（可以有少量數字，
 *                                        但數字是用來佐證結論，不是要你自己重新分析）
 *   Layer 3（AI 的推理） reasoningTrace  用自然語言講整個推理過程
 *
 * 這個原則會延續到未來所有 Engine（Opportunity v2、年度森林健檢、API 分析）：
 * Engine Thinking, Human Feeling —— Engine 可以很複雜，但交給 UI 的東西要很簡單。
 */

const FRIENDLY = { 果樹園: '果樹', 神木林: '神木', 巨木林: '巨木', 灌木區: '灌木' };
const AREA_ICON = { 果樹園: '🍎', 神木林: '🌲', 巨木林: '🌳', 灌木區: '🌿' };
const WEATHER_ICON = { 晴天: '☀️', 春雨: '🌦', 修正季: '🌧', 暴風雨: '⛈', 森林火災: '🔥' };
const GROUP_OF = {
  果樹園: '果樹園', 神木林: '神木林', 巨木林: '巨木林',
  AI灌木: '灌木區', 多元灌木: '灌木區', 新主題灌木: '灌木區'
};

/* ---- Layer 1：一句結論 ---- */
function conclusion(today) {
  if (!today.opportunity.verdict) {
    const icon = WEATHER_ICON[today.weather.condition] || '🌤';
    return `${icon} 今天沒有值得放水的機會。`;
  }
  if (!today.candidates.length) {
    return '⚪ 今天雖然有機會，但沒有符合條件的樹可以照顧。';
  }
  const group = GROUP_OF[today.candidates[0].area];
  const icon = AREA_ICON[group] || '🌳';
  return `${icon} 今天建議補${group}。`;
}

/* ---- Layer 2：3~5 個支持結論的理由 ---- */
function reasons(today) {
  const list = [];

  today.issues.slice(0, 2).forEach(iss => {
    if (iss.kind === 'shortfall') {
      const actual = today.intelligence.areaPct[iss.area] || 0;
      const target = today.intelligence.targetPct[iss.area] || 0;
      const pct = target > 0 ? Math.round((actual / target) * 100) : 0;
      list.push(`${iss.area}目前只完成 ${pct}%`);
    } else {
      list.push(`${iss.area}已超出 Blueprint 目標`);
    }
  });

  const stats = today.decisionStats;
  if (stats) {
    if (stats.finalCandidateCount === 0) {
      list.push('今天沒有任何股票同時符合估值與品質條件');
    } else {
      const top = today.candidates[0];
      list.push(`${top.name}同時符合估值與品質條件`);
    }
  } else if (!today.opportunity.verdict) {
    list.push(today.opportunity.reason);
  }

  return list.slice(0, 5);
}

/* ---- Layer 3：AI 的推理過程 ---- */
function reasoningTrace(today) {
  const stats = today.decisionStats;
  if (!stats) {
    return `今天沒有出現符合條件的市場機會（${today.opportunity.reason}），所以沒有進一步檢查候選樹。`;
  }
  let text = `今天一共檢查了 ${stats.totalChecked} 棵樹。`;
  text += `有 ${stats.passedBeforePenalty} 棵基本面與估值符合條件。`;
  if (stats.downgradedCount > 0) {
    text += `其中 ${stats.downgradedCount} 棵位於已超配的${stats.downgradedAreas.join('、')}，因此依 Blueprint 規則降級。`;
  }
  if (stats.finalCandidateCount > 0) {
    text += `最後剩下 ${stats.finalCandidateCount} 棵符合條件，建議優先照顧 ${today.candidates[0].name}。`;
  } else {
    text += '剩下沒有符合條件的候選樹，因此今天建議暫緩投入。';
  }
  return text;
}

/* ---- 單棵樹的白話敘述（Decision 詳細頁用）---- */
function healthSummary(health) {
  if (health >= 80) return '森林狀況良好，持續穩健成長。';
  if (health >= 60) return '森林基礎穩固，還有幾個地方可以再照顧。';
  if (health >= 40) return '森林還在調整期，有幾個明顯需要處理的地方。';
  return '森林目前壓力較大，建議優先處理下面的重點。';
}

const LEAD = {
  '🟢': '目前是值得優先照顧的樹',
  '🟡': '可以考慮分批照顧',
  '🔵': '維持觀察就好，暫不用特別行動',
  '🔴': '暫時不用特別關注'
};

function treeNarrative(entry) {
  if (!entry) return '目前還沒有足夠的資料可以判斷。';
  const group = GROUP_OF[entry.area] || entry.area;
  const label = FRIENDLY[group] || group;
  const b = entry.breakdown || {};
  const noData = (entry.reasons || []).some(r => r.includes('尚無完整基本面'));

  const clauses = [];
  if (b.forestPenalty <= -15) clauses.push(`${label}已經偏多，暫時不建議再加碼`);
  else if (b.forestPenalty <= -5) clauses.push(`${label}稍微偏多，先觀察就好`);
  else if (b.blueprint >= 10) clauses.push(`${label}還有成長空間，適合補齊`);

  if (b.weather >= 10) clauses.push('最近價格修正不小，是個不錯的進場時機');
  if (b.valuation >= 10) clauses.push('目前價格相對划算');
  if (b.valuation <= -10) clauses.push('目前價格偏貴，不是最好的進場點');
  if (noData) clauses.push('目前對它的了解還不夠完整，先列入觀察就好');

  const lead = LEAD[entry.signal] || '';
  const body = clauses.length ? clauses.join('，') : '目前沒有特別突出的理由';
  return `${entry.name}${lead}——${body}。`;
}

export function buildGuide(today) {
  const trees = {};
  Object.values(today.allSignals || {}).forEach(e => { trees[e.name] = treeNarrative(e); });
  (today.candidates || []).forEach(c => { trees[c.name] = treeNarrative(c); });

  return {
    healthSummary: healthSummary(today.health),
    conclusion: conclusion(today),
    reasons: reasons(today),
    reasoningTrace: reasoningTrace(today),
    trees
  };
}
