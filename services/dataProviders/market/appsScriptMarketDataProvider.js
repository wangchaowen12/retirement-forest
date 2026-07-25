import { MarketDataProvider } from './marketDataProvider.js';
import { normalizeMarketData, mergeMarketData } from '../normalize.js';

/**
 * Apps Script Market Data Provider（Forest Data Hub Client）
 * ------------------------------------------------------------
 * 這是目前**推薦**的正式資料來源接法：網站只跟你自己的 Google Apps
 * Script Web App 說話（見 apps-script/ForestDataHub.gs），不直接碰
 * Yahoo/Finnhub 這些第三方 API。
 *
 * 為什麼比直接接 Yahoo（yahooMarketDataProvider.js）好：
 *   - Apps Script 是伺服器端執行，UrlFetchApp 呼叫 Yahoo 不受瀏覽器
 *     CORS 限制，不會遇到之前提到的跨網域被擋問題
 *   - 之後想換成 Finnhub、Alpha Vantage、Morningstar，或加入你自己
 *     Google Sheets 裡的資料，只需要改 Apps Script 那一份程式碼，
 *     這個檔案、Data Repository、六顆 Engine 完全不用動
 *   - 跟你原本 Google Sheets + Apps Script 的架構是同一個哲學，不是
 *     另外引入一套新的後端
 *
 * 這個檔案刻意不知道森林名冊的中文名稱長什麼樣——它只認得 symbol
 * （真實股票代號，例如 2330.TW）。中文名稱 ↔ 股票代號的對照，是
 * Data Repository 的 TREE_ROSTER 在管理（持股資料的一部分），不是
 * Provider 的責任。這樣以後森林名冊新增一檔股票，只需要改一個地方。
 *
 * 使用方式：
 *   new AppsScriptMarketDataProvider({ webAppUrl: 'https://script.google.com/macros/s/xxx/exec' })
 */

export class AppsScriptMarketDataProvider extends MarketDataProvider {
  constructor({ webAppUrl } = {}) {
    super();
    if (!webAppUrl) {
      throw new Error('AppsScriptMarketDataProvider 需要 webAppUrl（你部署 Forest Data Hub 後拿到的網址）');
    }
    this.webAppUrl = webAppUrl;
  }

  async getMarketData(symbol) {
    const url = `${this.webAppUrl}?action=getMarketData&symbol=${encodeURIComponent(symbol)}`;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Forest Data Hub 回應 ${res.status}`);
      const raw = await res.json();
      if (!raw || raw.error) {
        console.warn(`[森林除錯] ${symbol} 查無資料或回傳 error：`, raw?.error);
        return null;
      }

      // Future Merge：目前只有這一個 Provider，merge 是 pass-through；
      // 未來多一個資料來源時，這裡改成 mergeMarketData([raw, 第二份原始資料])。
      const merged = mergeMarketData([raw]);
      const fundamentals = normalizeMarketData(merged);
      console.log(`[森林除錯] ${symbol} 完整度：${fundamentals.completeness}%，pe=${merged.peRatio}，pb=${merged.pbRatio}`);

      return { ...merged, symbol, fundamentals };
    } catch (err) {
      console.error(`[森林除錯] ${symbol} 取得資料失敗：`, err.message);
      return null; // 失敗回 null，資料完整度護欄自動接手，不會讓系統掛掉
    }
  }
}
