import { MarketDataProvider } from './marketDataProvider.js';
import { normalizeMarketData } from '../normalize.js';

/**
 * Yahoo Finance Provider（直接從瀏覽器呼叫，目前不建議使用）
 * -------------------------------------------------------------
 * ⚠️ 這個檔案保留下來當參考，但目前推薦的接法是透過
 * appsScriptMarketDataProvider.js（Forest Data Hub），不是這個檔案。
 * 原因見下方——CORS 問題在瀏覽器端幾乎無解，透過 Apps Script 當
 * 伺服器端代理才是穩定的做法。這裡的 Yahoo 欄位翻譯邏輯已經被
 * 搬到 apps-script/ForestDataHub.gs 裡（在伺服器端執行，不受 CORS 限制）。
 *
 * ⚠️ 部署前務必先看完這段，這不是能不能寫的問題，是能不能「跑」的問題：
 *
 * Yahoo Finance 沒有官方公開 API。這裡串的是被廣泛使用的非官方端點
 * （query1.finance.yahoo.com），有兩個現實限制：
 *
 *   1. 格式不保證穩定——Yahoo 隨時可能調整回傳結構，沒有事先通知，
 *      也沒有官方文件可以查。
 *   2. 從瀏覽器直接呼叫，幾乎一定會被 CORS 擋下來。Yahoo 沒有對任意
 *      網域開放 Access-Control-Allow-Origin，你的 index.html 直接 fetch
 *      這個網址大概率會在瀏覽器主控台看到 CORS 錯誤，不是程式寫錯。
 *
 * 這個檔案我沒辦法在這裡實際跑起來驗證（我的執行環境連不到
 * query1.finance.yahoo.com），邏輯跟正規化寫得盡量正確，但你實際
 * 部署時一定要自己測一次。
 *
 * 建議的解法：透過你現有的 Google Apps Script 當代理伺服器——
 * Apps Script 是伺服器端執行，不受瀏覽器 CORS 限制，讓它幫忙轉發
 * 請求到 Yahoo，再把結果回傳給前端。這樣完全不用改這個檔案的邏輯，
 * 只需要把建構子的 proxyBaseUrl 換成你的 Apps Script Web App 網址：
 *
 *   new YahooMarketDataProvider({ proxyBaseUrl: 'https://script.google.com/macros/s/xxx/exec' })
 *
 * 而且你的 Apps Script 要自己轉發 /v8/finance/chart/{symbol} 跟
 * /v10/finance/quoteSummary/{symbol} 這兩個路徑的請求到 Yahoo。
 */
export class YahooMarketDataProvider extends MarketDataProvider {
  constructor({ proxyBaseUrl } = {}) {
    super();
    this.baseUrl = proxyBaseUrl || 'https://query1.finance.yahoo.com';
  }

  async getMarketData(symbol) {
    try {
      const chartRes = await fetch(`${this.baseUrl}/v8/finance/chart/${encodeURIComponent(symbol)}`);
      if (!chartRes.ok) throw new Error(`chart API 回應 ${chartRes.status}`);
      const chartJson = await chartRes.json();
      const meta = chartJson?.chart?.result?.[0]?.meta;
      if (!meta) return null;

      const summaryRes = await fetch(
        `${this.baseUrl}/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=defaultKeyStatistics,financialData,summaryDetail`
      );
      const stats = summaryRes.ok
        ? (await summaryRes.json())?.quoteSummary?.result?.[0] || {}
        : {};

      // ---- 這裡就是「Provider 把 Yahoo 的欄位名稱翻譯成契約欄位」的地方 ----
      const raw = {
        symbol,
        price: meta.regularMarketPrice ?? null,
        peRatio: stats.summaryDetail?.trailingPE?.raw ?? null,
        pbRatio: stats.defaultKeyStatistics?.priceToBook?.raw ?? null,
        dividendYield: stats.summaryDetail?.dividendYield?.raw ?? null,
        eps: stats.defaultKeyStatistics?.trailingEps?.raw ?? null,
        revenueGrowthYoY: stats.financialData?.revenueGrowth?.raw ?? null,
        analystRating: stats.financialData?.recommendationKey ?? null,
        marketCap: stats.summaryDetail?.marketCap?.raw ?? null,
        fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh ?? null,
        fiftyTwoWeekLow: meta.fiftyTwoWeekLow ?? null,
        // Yahoo 沒有直接提供這兩項，需要額外資料源或自己算歷史均值/配息紀錄，
        // 先誠實回傳 null，讓 Decision Engine 的資料完整度護欄自然接手。
        peHistory5yAvg: null,
        dividendStreakYears: null
      };

      // 再往下才是「翻譯成森林自己的語言」——跟 Mock Provider 用同一個
      // normalizeMarketData()，確保不管資料源是誰，Decision Engine 讀到的
      // 形狀永遠一樣。
      return { ...raw, fundamentals: normalizeMarketData(raw) };
    } catch (err) {
      console.error(`[YahooMarketDataProvider] ${symbol} 取得資料失敗：`, err.message);
      return null; // 失敗就回傳 null，不會讓整個系統掛掉，資料完整度護欄會自動處理
    }
  }
}
