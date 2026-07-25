import { MarketDataProvider } from './marketDataProvider.js';
import { normalizeMarketData, mergeMarketData } from '../normalize.js';

/**
 * Mock Market Data Provider
 * -------------------------
 * 第一版 Provider，回傳假資料，讓整個系統可以正常運作、開發跟測試。
 * 之後要接 Yahoo/Polygon/Alpha Vantage/Morningstar 時，這個檔案可以整個
 * 刪掉都不影響其他任何地方——只要新 Provider 也實作 getMarketData(symbol)。
 *
 * setScenario() 是 Mock 專屬的「測試用開關」，不屬於正式介面契約
 * （真實的 Yahoo/Polygon Provider 不會有這個方法）。Data Repository 用
 * optional chaining（?.）呼叫它，所以換成真實 Provider 時，這行呼叫
 * 會自動變成無作用，不需要另外刪程式碼。
 */

// 公司基本資料：跟「今天股價多少」無關的部分，維持不變
// key 統一用真實股票代號（跟 dataRepository.js 的 TREE_ROSTER.symbol 一致），
// 不是中文名稱——這樣切換 Mock/AppsScript Provider 時，Data Repository
// 送出去的 symbol 格式永遠一致，不用另外做名稱轉換。
const COMPANY_DATA = {
  GOOGL: { eps: 7.4, dividendPerShare: 0, peHistory5yAvg: 27, fiftyTwoWeekHigh: 205, fiftyTwoWeekLow: 140, analystRating: 'Buy', marketCap: 2.2e12, pbRatio: 6.1 },
  '2330.TW': { eps: 57.2, dividendPerShare: 18.5, peHistory5yAvg: 19, fiftyTwoWeekHigh: 1080, fiftyTwoWeekLow: 800, analystRating: 'Buy', marketCap: 2.67e13, pbRatio: 5.2 },
  '0050.TW': { eps: null, dividendPerShare: 6.2, peHistory5yAvg: null, fiftyTwoWeekHigh: null, fiftyTwoWeekLow: null, analystRating: null, marketCap: null, pbRatio: null, dividendStreakYears: 10 },
  '2395.TW': { eps: 22.1, dividendPerShare: 11, peHistory5yAvg: 15, fiftyTwoWeekHigh: 330, fiftyTwoWeekLow: 240, analystRating: 'Hold', marketCap: 1.9e11, pbRatio: 3.8 },
  '2345.TW': { eps: 38.6, dividendPerShare: 10, peHistory5yAvg: 16, fiftyTwoWeekHigh: 920, fiftyTwoWeekLow: 480, analystRating: 'Hold', marketCap: 6.2e11, pbRatio: 7.5 },
  NVDA: { eps: 4.7, dividendPerShare: 0.04, peHistory5yAvg: 28, fiftyTwoWeekHigh: 150, fiftyTwoWeekLow: 90, analystRating: 'Buy', marketCap: 3.5e12, pbRatio: 12 }
};

// 三種測試情境下的「今天股價」——模擬市場每天不同，其他基本資料不變
const SCENARIO_PRICE = {
  A: { GOOGL: 190, '2330.TW': 1040, '0050.TW': 197, '2395.TW': 315, NVDA: 145, '2345.TW': 850 },
  B: { GOOGL: 160, '2330.TW': 995, '0050.TW': 192, '2395.TW': 300, NVDA: 138, '2345.TW': 850 },
  C: { GOOGL: 160, '2330.TW': 890, '0050.TW': 178, '2395.TW': 265, NVDA: 128, '2345.TW': 850 }
};

export class MockMarketDataProvider extends MarketDataProvider {
  constructor() {
    super();
    this.scenario = 'A';
  }

  // Mock 專屬方法，不在正式介面契約內
  setScenario(scenario) {
    this.scenario = SCENARIO_PRICE[scenario] ? scenario : 'A';
  }

  async getMarketData(symbol) {
    const base = COMPANY_DATA[symbol];
    if (!base) return null;

    const price = (SCENARIO_PRICE[this.scenario] || SCENARIO_PRICE.A)[symbol] ?? null;
    const peRatio = base.eps && price ? Math.round((price / base.eps) * 10) / 10 : null;
    const dividendYield = base.dividendPerShare && price ? Math.round((base.dividendPerShare / price) * 1000) / 10 / 100 : null;

    const raw = {
      symbol,
      price,
      peRatio,
      pbRatio: base.pbRatio,
      dividendYield,
      eps: base.eps,
      revenueGrowthYoY: null, // Mock 階段尚未模擬，之後接真實 API 才會有
      analystRating: base.analystRating,
      marketCap: base.marketCap,
      fiftyTwoWeekHigh: base.fiftyTwoWeekHigh,
      fiftyTwoWeekLow: base.fiftyTwoWeekLow,
      peHistory5yAvg: base.peHistory5yAvg,
      dividendStreakYears: base.dividendStreakYears ?? null
    };

    // Future Merge：目前只有這一個 Provider，merge 是 pass-through。
    const merged = mergeMarketData([raw]);

    // 這一步就是「Provider 負責翻譯」——回傳給 Data Repository 的東西，
    // 同時包含原始契約欄位（除錯/未來擴充用）跟正規化後的 fundamentals
    // （Decision Engine 真正會讀的）。
    return { ...merged, fundamentals: normalizeMarketData(merged) };
  }
}
