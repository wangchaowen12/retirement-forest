/**
 * Normalize
 * ---------
 * Decision Engine Data Contract v1.3 的翻譯層。
 *
 * 這是整個 Provider 架構裡最重要的一個檔案：不管背後是 Yahoo、
 * Polygon、Morningstar 還是 Mock，只要各自的 Provider 在回傳前呼叫
 * normalizeMarketData()，Decision Engine 就永遠只會讀到同一種形狀：
 *
 *   tree.fundamentals.valuation.pe
 *   tree.fundamentals.quality.dividendYield   ← v1.3 新增，之前漏掉了
 *   tree.fundamentals.risk.drawdownPct
 *   tree.fundamentals.scores.qualityScore     ← Provider 可以直接給複合分數
 *
 * Decision Engine 永遠不會看到 peRatio、forwardPE、trailingPE 這種
 * 第三方 API 才有的欄位名稱。哪天 Yahoo 把 forwardPE 改名成
 * trailingPE，只需要改這個檔案裡對應 Provider 的那幾行，Engine
 * 完全不用動。
 *
 * completeness（Data Contract v1.2 新增，v1.3 改成依 instrumentType 判斷）：
 * 個股跟 ETF 該看的指標本來就不一樣——個股看本益比/營收成長，
 * ETF 通常沒有意義的本益比，該看的是殖利率。用同一張欄位清單判斷
 * 「資料夠不夠完整」，會讓 ETF 永遠被判定資料不足。這裡改成依
 * instrumentType 給不同的欄位清單，但輸出形狀（0~100 一個數字）
 * 完全不變，Decision Engine 不需要知道這裡面的差異。
 *
 * ⚠️ instrumentType 是 Data Repository 的 TREE_ROSTER 才知道的資訊
 * （這是「這棵樹是什麼」的本質，不是市場報價），所以 completeness
 * 的計算刻意不放在 Provider 內部自動觸發，而是由 Data Repository
 * 在拿到 Provider 回傳的原始資料後，自己呼叫 calculateCompleteness()
 * 決定要用哪張欄位清單——Provider 不需要、也不應該知道森林名冊
 * 怎麼分類。
 */

export const DATA_CONTRACT_VERSION = '1.3';

// 個股：看本益比、股價淨值比、營收成長、分析師評等。
// ETF：這些公司財務指標大多沒有意義（ETF 是一籃子持股，沒有單一
// 「本益比」的標準定義），改成看殖利率——這對果樹類 ETF（0050/0056/
// 00850）尤其重要，退休森林本來就是靠這些 ETF 的殖利率提供現金流。
// 這裡的原則是：只要求「目前真的穩定抓得到」的欄位，不要求「理論上
// 重要但目前抓不到」的欄位——不然 completeness 只是在懲罰資料源的
// 限制，不是真的在反映「這棵樹值不值得信任」。
//
// stock：peRatio/pbRatio 目前由證交所/櫃買中心穩定提供；
//   revenueGrowthYoY/analystRating 依賴 Yahoo quoteSummary，這支
//   端點目前常被擋（見除錯記錄），先不列為必要欄位，等哪天真的穩定
//   抓得到，或換了別的資料源，再加回來。
// etf：目前沒有找到免費又穩定的台股 ETF 基本面/殖利率資料源
//   （證交所的本益比清單通常不含 ETF）。與其要求一個現在拿不到的
//   欄位、讓所有 ETF 永遠卡在 0%，不如老實承認：ETF 現在只要有
//   股價（幾乎必定有）就算資料充足，改用修正幅度＋Blueprint缺口
//   判斷，不強求基本面分數。
const COMPLETENESS_FIELDS_BY_TYPE = {
  stock: ['peRatio', 'pbRatio'],
  etf: []
};

export function calculateCompleteness(raw, instrumentType = 'stock') {
  if (!raw) return 0;
  const fields = COMPLETENESS_FIELDS_BY_TYPE[instrumentType] || COMPLETENESS_FIELDS_BY_TYPE.stock;
  if (fields.length === 0) return raw.price != null ? 100 : 0;
  const filled = fields.filter(key => raw[key] !== null && raw[key] !== undefined).length;
  return Math.round((filled / fields.length) * 100);
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

/**
 * @param {object|null} raw - Provider 回傳的原始契約欄位
 * @returns fundamentals 形狀。注意這裡不再自動算 completeness——
 *   Data Repository 拿到這個回傳值後，會自己呼叫 calculateCompleteness()
 *   並依 instrumentType 覆寫 fundamentals.completeness。
 */
export function normalizeMarketData(raw) {
  if (!raw) {
    return {
      valuation: { pe: null, peAvg5y: null, pb: null },
      quality: { dividendYield: null, dividendStreakYears: null, revenueGrowthYoY: null, analystRating: null },
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
      dividendYield: raw.dividendYield ?? null,
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
    // 預設值，這裡不知道 instrumentType，用 stock 的欄位清單當保守預設；
    // Data Repository 會在合併 TREE_ROSTER 之後，用正確的 instrumentType 覆寫這個值。
    completeness: calculateCompleteness(raw, 'stock')
  };
}
