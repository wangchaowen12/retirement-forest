/**
 * Normalize
 * ---------
 * Decision Engine Data Contract v1.1 的翻譯層。
 *
 * 這是整個 Provider 架構裡最重要的一個檔案：不管背後是 Yahoo、
 * Polygon、Morningstar 還是 Mock，只要各自的 Provider 在回傳前呼叫
 * normalizeMarketData()，Decision Engine 就永遠只會讀到同一種形狀：
 *
 *   tree.fundamentals.valuation.pe
 *   tree.fundamentals.quality.dividendStreakYears
 *   tree.fundamentals.risk.drawdownPct
 *   tree.fundamentals.scores.qualityScore   ← Provider 可以直接給複合分數
 *
 * Decision Engine 永遠不會看到 peRatio、forwardPE、trailingPE 這種
 * 第三方 API 才有的欄位名稱。哪天 Yahoo 把 forwardPE 改名成
 * trailingPE，只需要改這個檔案裡對應 Provider 的那幾行，Engine
 * 完全不用動。
 *
 * scores 區塊是為了「Provider 本身就能算複合分數」的情境而留的：
 * 例如未來接 Morningstar，它本來就有 Quality/Moat/Stewardship，
 * Decision Engine 不需要知道 Morningstar 怎麼算，只需要讀
 * tree.fundamentals.scores.qualityScore，有值就優先採用，
 * 沒有值（null）就退回自己用 valuation/quality/risk 現算。
 *
 * completeness 是這個檔案的第二個核心概念（Data Contract v1.2 新增）：
 * Decision Engine 不該只問「有沒有資料」（null 或不是 null），而是問
 * 「這份判斷有多少可信度」。今天只有一個 Provider（Yahoo），日後就算
 * 換成 Yahoo + Finnhub + Research Provider 一起餵資料，這裡都只需要
 * 調整「哪些欄位算進可信度」，Decision Engine 讀的永遠是同一個
 * tree.fundamentals.completeness（0~100）。
 */

export const DATA_CONTRACT_VERSION = '1.2';

// 這幾個欄位是 Decision Engine 目前真正會拿來評分的基本面依據。
//
// 注意：peHistory5yAvg（五年本益比均值）跟 dividendStreakYears（連續配息
// 年數）刻意不算在這裡——目前 Yahoo、證交所、Finnhub 三個資料源都沒有
// 提供這兩項，算進分母的話，就算資料全部正確抓到，completeness 也永遠
// 到不了 100%，等於白白扣分。等哪天真的接了會提供這兩項的資料源
// （例如自己算歷史股價，或找到有配息紀錄的 API），再把它們加回來。
const COMPLETENESS_FIELDS = ['peRatio', 'pbRatio', 'revenueGrowthYoY', 'analystRating'];

function calculateCompleteness(raw) {
  if (!raw) return 0;
  const filled = COMPLETENESS_FIELDS.filter(key => raw[key] !== null && raw[key] !== undefined).length;
  return Math.round((filled / COMPLETENESS_FIELDS.length) * 100);
}

/**
 * Future Merge（預留位置，目前是 pass-through，沒有任何合併邏輯）
 * ------------------------------------------------------------
 * 未來如果同時有多個 Provider 各自負責不同欄位（例如 Yahoo 給 price，
 * Finnhub 給 peRatio/pbRatio，Google Sheets 給 dividendStreakYears），
 * 就是在這裡把每個 Provider 回傳的原始資料依照「哪個來源最可靠」
 * 合併成一份，Decision Engine 跟 normalizeMarketData() 都不用改一行。
 *
 * 目前只有一個資料來源，所以這裡什麼都不用做，直接回傳第一份結果。
 *
 * @param {Array<object|null>} providerResults - 各 Provider 回傳的原始資料，目前陣列長度固定是 1
 */
export function mergeMarketData(providerResults) {
  return providerResults?.[0] ?? null;
}

export function normalizeMarketData(raw) {
  if (!raw) {
    return {
      valuation: { pe: null, peAvg5y: null, pb: null },
      quality: { dividendStreakYears: null, revenueGrowthYoY: null, analystRating: null },
      risk: { drawdownPct: null },
      scores: { qualityScore: null, valuationScore: null, riskScore: null },
      completeness: 0
    };
  }

  return {
    valuation: {
      pe: raw.peRatio ?? null,
      peAvg5y: raw.peHistory5yAvg ?? null,
      pb: raw.pbRatio ?? null
    },
    quality: {
      dividendStreakYears: raw.dividendStreakYears ?? null,
      revenueGrowthYoY: raw.revenueGrowthYoY ?? null,
      analystRating: raw.analystRating ?? null
    },
    risk: {
      drawdownPct: (raw.fiftyTwoWeekHigh && raw.price)
        ? Math.round((1 - raw.price / raw.fiftyTwoWeekHigh) * 100)
        : null
    },
    scores: {
      qualityScore: raw.qualityScore ?? null,
      valuationScore: raw.valuationScore ?? null,
      riskScore: raw.riskScore ?? null
    },
    // 0~100，取代原本「有資料/沒資料」的二分法。
    completeness: calculateCompleteness(raw)
  };
}
