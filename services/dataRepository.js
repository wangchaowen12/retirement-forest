/**
 * Data Repository
 * ----------------
 * 全站唯一允許碰「原始資料」的地方，而且原始資料其實有兩種不同來源：
 *
 *   ① 持股資料（森林名冊）——你實際擁有哪些樹、股數多少。
 *      未來來自 Google Sheets，跟股價無關，不會因為市場變動而變。
 *
 *   ② 市場報價（Market Data Provider）——這棵樹今天股價、本益比、殖利率多少。
 *      未來來自 Yahoo / Polygon / Alpha Vantage / Morningstar，天天在變。
 *
 * getTrees() 的工作就是把這兩種資料合併成 Engine 要用的形狀。
 * Engine 完全不知道①來自 Sheets、②來自哪個市場資料商——這兩件事
 * 都只有這個檔案知道。
 *
 * TODO（之後串真實資料時）：
 *   TREE_ROSTER              → fetch(APPS_SCRIPT_URL + '?action=getTrees')
 *   getLifeGoal()             → fetch(...action=getLifeGoal)
 *   getBlueprintAssumptions() → fetch(...action=getAssumptions)
 *   getWaterPool()            → fetch(...action=getWaterPool)
 *   marketDataProvider        → 見 services/marketData/index.js，換 Provider 不用改這裡任何一行
 */

import { marketDataProvider } from './dataProviders/market/index.js';
import { normalizeMarketData, calculateCompleteness } from './dataProviders/normalize.js';
import { getSlowData, computeValuationScore } from './dataProviders/slowData.js';

// ---- 人生目標（LifeGoal）----
export async function getLifeGoal() {
  return {
    targetTotalAssets: 6000,
    annualCashflowTarget: 70,
    growthRateTarget: 0.06,
    riskTolerance: '穩健',
    retired: false
  };
}

// ---- 假設參數（BlueprintAssumptions，未來走 AI 建議／人確認流程）----
export async function getBlueprintAssumptions() {
  return {
    fruitYield: 0.04,
    fruitGrowth: 0.02,
    giantGrowth: 0.08,
    largeGrowth: 0.12,
    shrubGrowth: 0.16,
    floorPct: { giant: 0.15, large: 0.10, shrub: 0.05 },
    riskMix: {
      保守: { large: 0.70, shrub: 0.30 },
      穩健: { large: 0.55, shrub: 0.45 },
      積極: { large: 0.40, shrub: 0.60 }
    },
    nurseryAnnualBudget: 10
  };
}

// ---- 蓄水池 ----
export async function getWaterPool() {
  return { balance: 60 };
}

// ---- 森林名冊：持股資料，跟市場報價無關 ----
//
// symbol 是查詢 Market Data Provider 用的真實股票代號（.TW=上市／.TWO=上櫃／
// 無後綴=美股），name 是森林裡顯示用的中文名稱，兩者刻意分開——森林的
// "本質"是這棵樹叫什麼，"symbol" 只是拿去問資料源的查詢鍵，未來就算
// 換一個完全不同的資料源、代號格式不一樣，也不會動到 name 或任何顯示邏輯。
//
// ⚠️ 代號正確性：以下已用網路搜尋逐一查證交易所別（上市/上櫃），但建議
// 你自己在 Google/Yahoo股市 上再核對一次數字本身，畢竟這攸關抓到的是
// 不是同一家公司的資料，錯了不會報錯、只會默默抓到別家公司或抓不到。
// instrumentType：'stock'（個股）或 'etf'。這是「這棵樹是什麼」的本質，
// 不是市場報價，所以放在這裡（跟 species 一樣屬於持股資料），不是
// Provider 該知道的事。normalize.js 會依這個欄位決定用哪套完整度標準。
const TREE_ROSTER = [
  { symbol: '0050.TW', name: '0050', area: '果樹園', species: '神木果樹', instrumentType: 'etf', marketValue: 452 },
  { symbol: '0056.TW', name: '0056', area: '果樹園', species: '成熟果樹', instrumentType: 'etf', marketValue: 81 },
  { symbol: '00850.TW', name: '00850', area: '果樹園', species: '成熟果樹', instrumentType: 'etf', marketValue: 42 },
  { symbol: '2707.TW', name: '晶華', area: '果樹園', species: '成熟果樹', instrumentType: 'stock', marketValue: 53 },
  { symbol: '2881.TW', name: '富邦金', area: '果樹園', species: '成熟果樹', instrumentType: 'stock', marketValue: 13 },
  { symbol: '2884.TW', name: '玉山金', area: '果樹園', species: '成熟果樹', instrumentType: 'stock', marketValue: 11 },
  { symbol: '2330.TW', name: '台積電', area: '神木林', species: '神木', instrumentType: 'stock', marketValue: 1230 },
  { symbol: 'GOOGL', name: 'Google', area: '神木林', species: '神木', instrumentType: 'stock', marketValue: 19 },
  { symbol: 'NVDA', name: 'NVDA', area: '神木林', species: '神木', instrumentType: 'stock', marketValue: 50 },
  { symbol: 'QQQM', name: 'QQQM', area: '神木林', species: '神木', instrumentType: 'etf', marketValue: 22 },
  { symbol: '2308.TW', name: '台達電', area: '巨木林', species: '巨木', instrumentType: 'stock', marketValue: 174 },
  { symbol: '2345.TW', name: '智邦', area: '巨木林', species: '巨木', instrumentType: 'stock', marketValue: 1463 },
  { symbol: '2317.TW', name: '鴻海', area: '巨木林', species: '巨木', instrumentType: 'stock', marketValue: 54 },
  { symbol: '2395.TW', name: '研華', area: '巨木林', species: '巨木', instrumentType: 'stock', marketValue: 62 },
  { symbol: '00830.TW', name: '00830', area: 'AI灌木', species: '灌木', instrumentType: 'etf', marketValue: 124 },
  { symbol: '0052.TW', name: '0052', area: 'AI灌木', species: '灌木', instrumentType: 'etf', marketValue: 23 },
  { symbol: '3374.TWO', name: '精材', area: 'AI灌木', species: '灌木', instrumentType: 'stock', marketValue: 25 },
  { symbol: '3231.TW', name: '緯創', area: 'AI灌木', species: '灌木', instrumentType: 'stock', marketValue: 14 },
  { symbol: '4952.TW', name: '凌通', area: '多元灌木', species: '灌木', instrumentType: 'stock', marketValue: 72 },
  { symbol: '9945.TW', name: '潤泰新', area: '多元灌木', species: '灌木', instrumentType: 'stock', marketValue: 62 },
  { symbol: '1722.TW', name: '台肥', area: '多元灌木', species: '灌木', instrumentType: 'stock', marketValue: 18 },
  { symbol: '009819.TW', name: '009819', area: '新主題灌木', species: '灌木', instrumentType: 'etf', marketValue: 29 },
  { symbol: 'IBIT', name: 'IBIT', area: '新主題灌木', species: '灌木', instrumentType: 'etf', marketValue: 0.9 },
  { symbol: '2049.TW', name: '上銀', area: '新主題灌木', species: '灌木', instrumentType: 'stock', marketValue: 1 },
  { symbol: '6208.TWO', name: '日揚', area: '苗圃', species: '苗圃', instrumentType: 'stock', marketValue: 17 },
  { symbol: '8234.TW', name: '新漢', area: '苗圃', species: '苗圃', instrumentType: 'stock', marketValue: 6 } // 補上：健檢過但原始名冊漏收錄
];

export async function getTrees(scenario = 'A') {
  // 開發測試專用：只有 Mock Provider 才有 setScenario()，用 optional chaining
  // 呼叫，未來換成正式 Provider 之後，這行自動變成無作用，
  // 不需要另外刪程式碼或改呼叫端。
  marketDataProvider.setScenario?.(scenario);

  const symbols = TREE_ROSTER.map(t => t.symbol);
  const marketDataMap = await marketDataProvider.getMarketDataBatch(symbols);

  return TREE_ROSTER.map(t => {
    const marketData = marketDataMap[t.symbol];
    // Provider 已經負責翻譯（見 normalizeMarketData），這裡只是取用；
    // 查無資料時用同一個函式產生空殼形狀，Decision Engine 不用另外判斷 undefined。
    const fundamentals = marketData?.fundamentals || normalizeMarketData(null);

    // completeness 要看 instrumentType 才知道該用哪套標準（個股 vs ETF），
    // 這個資訊只有 Data Repository 知道（TREE_ROSTER 的一部分），
    // Provider 回傳時給的是保守預設值，這裡用正確的標準覆寫一次。
    fundamentals.completeness = calculateCompleteness(marketData, t.instrumentType);

    // 慢資料 × 快資料融合：錨點（半年~一年才變）+ 今天的price/PE/PB（每天變）
    // → 即時算出 valuationScore。Decision Engine 已經寫好「有這個分數就優先
    // 採用」的邏輯（規則K的介面設計），這裡不用動 decisionEngine.js 一行。
    const valuationScore = computeValuationScore(t.symbol, marketData);
    if (valuationScore != null) fundamentals.scores.valuationScore = valuationScore;

    // slowData 原樣附上，供 UI／Forest Guide 需要引用「這是根據什麼健檢結論」
    // 時使用（例如：peerGroup、notes），Decision Engine 不需要讀這個欄位。
    return { ...t, fundamentals, marketData, slowData: getSlowData(t.symbol) };
  });
}

// ---- 森林天氣（目前用手動情境模擬 Opportunity Engine 的輸入）----
export async function getWeather(scenario = 'A') {
  const table = {
    A: { condition: '晴天', label: '☀️ 晴天，無明顯修正' },
    B: { condition: '修正季', label: '🌧️ 修正季，優質股開始回檔' },
    C: { condition: '暴風雨', label: '⛈️ 暴風雨，市場恐慌' }
  };
  return table[scenario] || table.A;
}
