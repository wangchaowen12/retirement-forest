/**
 * Market Data Provider — 介面定義
 * --------------------------------
 * 這是 Data Provider 架構裡「市場報價」這一類的介面。除了市場報價，
 * 未來還會有 FundamentalProvider（進階基本面研究）、NewsProvider（新聞）、
 * ResearchProvider（產業研究／AI 分析）——都放在 services/dataProviders/
 * 底下，各自獨立、各自可替換，詳見該資料夾結構。
 *
 * 只有 Data Repository 會呼叫這裡，Engine（Decision / Intelligence / ...）
 * 連 Data Repository 都看不到，更不可能知道資料背後是 Yahoo、Polygon
 * 還是 Mock——資料源只對 Data Repository 一個人負責。
 *
 * 任何 Provider 都必須繼承這個類別，實作同一個方法簽章：
 *
 *   async getMarketData(symbol) -> MarketData | null
 *
 * 回傳形狀分兩部分（完整定義見 docs/Decision_Engine_Data_Contract.md）：
 *   1. 原始契約欄位（price / peRatio / eps / ... ）——除錯、未來擴充用
 *   2. fundamentals（呼叫 normalize.js 的 normalizeMarketData() 產生）
 *      ——Decision Engine 唯一會讀的東西，跟第三方 API 的欄位名稱完全脫鉤：
 *
 *        tree.fundamentals.valuation.pe
 *        tree.fundamentals.quality.dividendStreakYears
 *        tree.fundamentals.risk.drawdownPct
 *        tree.fundamentals.scores.qualityScore   ← Provider 可直接給複合分數
 *
 * 換 Provider（之後接 Yahoo）：只改 services/dataProviders/market/index.js
 * 那一行，其他檔案完全不用動。
 */
export class MarketDataProvider {
  // eslint-disable-next-line no-unused-vars
  async getMarketData(symbol) {
    throw new Error('getMarketData() 必須由子類別實作');
  }

  // 預設實作：一個一個呼叫。有批次 API 或速率限制的 Provider（例如 Yahoo）
  // 可以覆寫這個方法自己優化，呼叫端（Data Repository）完全不用知道差異。
  async getMarketDataBatch(symbols) {
    const results = {};
    for (const symbol of symbols) {
      results[symbol] = await this.getMarketData(symbol);
    }
    return results;
  }
}
