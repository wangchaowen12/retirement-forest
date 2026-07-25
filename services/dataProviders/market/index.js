import { MockMarketDataProvider } from './mockMarketDataProvider.js';
import { AppsScriptMarketDataProvider } from './appsScriptMarketDataProvider.js';
// import { YahooMarketDataProvider } from './yahooMarketDataProvider.js'; // 不建議直接用，見該檔案開頭的 CORS 說明

/**
 * 目前唯一啟用的市場資料 Provider。
 *
 * 部署好 apps-script/ForestDataHub.gs 之後，切換成正式資料來源
 * 只需要改成這樣（其他任何檔案都不用動）：
 *
 *   export const marketDataProvider = new AppsScriptMarketDataProvider({
 *     webAppUrl: 'https://script.google.com/macros/s/xxx/exec'
 *   });
 *
 * 這是目前推薦的正式接法，取代直接接 Yahoo（會遇到瀏覽器 CORS 問題）。
 */
export const marketDataProvider = new AppsScriptMarketDataProvider({
  webAppUrl: 'https://script.google.com/macros/s/AKfycbxW1Fu3VX1f79dQiqiZdJ30O9k-RU0SgEK6Riu4HrLbT9J5FYrnrFtLy7o46k_I33Ra/exec'
});
// export const marketDataProvider = new MockMarketDataProvider(); // 保留備用，需要時可切回測試資料
