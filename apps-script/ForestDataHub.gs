/**
 * Forest Data Hub — Google Apps Script
 * =====================================
 * 退休森林唯一的資料入口。網站永遠只跟這支 Web App 說話，不管背後今天
 * 是 Yahoo、Finnhub、Morningstar、AI 摘要、還是你自己的 Google Sheets——
 * 網站完全不知道，也不需要知道。
 *
 * 部署步驟：
 *   1. 在你現有的 Apps Script 專案裡新增一個檔案（例如 ForestDataHub.gs），
 *      把這份程式碼整個貼進去
 *   2. 上方選單「部署」→「新增部署作業」
 *      類型選「網頁應用程式」
 *      執行身分：我（你自己的帳號）
 *      具有存取權的使用者：任何人
 *   3. 部署後會拿到一個網址，長得像：
 *      https://script.google.com/macros/s/AKfycb.../exec
 *      把這個網址貼到網站的 services/dataProviders/market/index.js
 *
 * 網站呼叫方式（GET）：
 *   {WEB_APP_URL}?action=getMarketData&symbol=2330
 *
 * 回傳格式（跟現有 Mock/Yahoo Provider 的原始契約欄位一致，網站端會用
 * 同一套 normalizeMarketData() 處理，不需要另外寫轉換邏輯）：
 * {
 *   symbol, price, peRatio, pbRatio, dividendYield, eps,
 *   revenueGrowthYoY, analystRating, marketCap,
 *   fiftyTwoWeekHigh, fiftyTwoWeekLow, peHistory5yAvg, dividendStreakYears
 * }
 *
 * ⚠️ 我沒辦法在這裡實際部署驗證（沒有你 Google 帳號的執行環境），
 * 邏輯依照 Yahoo 目前的回應格式寫，實際部署後請先用瀏覽器直接打開
 * Web App 網址＋參數（例如 ?action=getMarketData&symbol=2330）確認
 * 回傳的 JSON 長相符合預期，再接回網站。
 */

function doGet(e) {
  var action = e.parameter.action;

  if (action === 'getMarketData') {
    var symbol = e.parameter.symbol;
    if (!symbol) return jsonResponse_({ error: 'missing symbol' });
    var data = getMarketDataFromYahoo_(symbol);
    if (data) {
      var fundamentals = getFundamentals_(symbol);
      // Yahoo 負責 price／52 週高低點；基本面（PE/PB/殖利率）改成看代號
      // 結尾決定要問誰：.TW → 證交所官方 API，.TWO → 櫃買中心官方 API，
      // 其他（美股）→ Finnhub。Yahoo 抓得到的先保留，抓不到的才用這裡補上。
      if (fundamentals) {
        data.peRatio = data.peRatio ?? fundamentals.peRatio ?? null;
        data.pbRatio = data.pbRatio ?? fundamentals.pbRatio ?? null;
        data.dividendYield = data.dividendYield ?? fundamentals.dividendYield ?? null;
      }
    }
    return jsonResponse_(data);
  }

  // 除錯用：直接看 Finnhub 回傳的原始 metric 物件，確認欄位名稱有沒有跑掉。
  // 用法：{WEB_APP_URL}?action=debugFinnhub&symbol=NVDA
  if (action === 'debugFinnhub') {
    return jsonResponse_(getFinnhubRawMetric_(e.parameter.symbol));
  }

  return jsonResponse_({ error: 'unknown action: ' + action });
}

/**
 * 目前唯一的資料來源實作：Yahoo Finance 非官方端點。
 * 之後想換成 Finnhub / Alpha Vantage / Morningstar，只需要改這個函式
 * 內部的邏輯，回傳的形狀維持一樣，doGet() 跟網站端完全不用改。
 */
function getMarketDataFromYahoo_(symbol) {
  try {
    var chartUrl = 'https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(symbol);
    var chartRes = UrlFetchApp.fetch(chartUrl, { muteHttpExceptions: true });
    var chartJson = JSON.parse(chartRes.getContentText());
    var meta = chartJson && chartJson.chart && chartJson.chart.result && chartJson.chart.result[0]
      ? chartJson.chart.result[0].meta
      : null;
    if (!meta) return null;

    var summaryUrl = 'https://query1.finance.yahoo.com/v10/finance/quoteSummary/' + encodeURIComponent(symbol)
      + '?modules=defaultKeyStatistics,financialData,summaryDetail';
    var summaryRes = UrlFetchApp.fetch(summaryUrl, { muteHttpExceptions: true });
    var summaryJson = JSON.parse(summaryRes.getContentText());
    var stats = summaryJson && summaryJson.quoteSummary && summaryJson.quoteSummary.result
      ? summaryJson.quoteSummary.result[0]
      : {};

    return {
      symbol: symbol,
      price: meta.regularMarketPrice || null,
      peRatio: getPath_(stats, 'summaryDetail.trailingPE.raw'),
      pbRatio: getPath_(stats, 'defaultKeyStatistics.priceToBook.raw'),
      dividendYield: getPath_(stats, 'summaryDetail.dividendYield.raw'),
      eps: getPath_(stats, 'defaultKeyStatistics.trailingEps.raw'),
      revenueGrowthYoY: getPath_(stats, 'financialData.revenueGrowth.raw'),
      analystRating: getPath_(stats, 'financialData.recommendationKey'),
      marketCap: getPath_(stats, 'summaryDetail.marketCap.raw'),
      fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh || null,
      fiftyTwoWeekLow: meta.fiftyTwoWeekLow || null,
      // Yahoo 沒有直接提供這兩項，未來可以另外接資料源，或自己用歷史股價/
      // 配息紀錄算，先誠實回傳 null，網站端的資料完整度護欄會自動處理。
      peHistory5yAvg: null,
      dividendStreakYears: null
    };
  } catch (err) {
    Logger.log('getMarketDataFromYahoo_ 失敗：' + err);
    return null;
  }
}

// 安全取巢狀欄位，任何一層是 undefined/null 都直接回傳 null，不會噴錯
function getPath_(obj, path) {
  var parts = path.split('.');
  var cur = obj;
  for (var i = 0; i < parts.length; i++) {
    if (cur === null || cur === undefined) return null;
    cur = cur[parts[i]];
  }
  return cur === undefined ? null : cur;
}

/**
 * 基本面資料 Dispatcher
 * ---------------------
 * 依照代號結尾決定要問誰要 PE／PB／殖利率：
 *   .TW  → 台灣證券交易所 OpenAPI（上市，完全免費、不用 API Key）
 *   .TWO → 證券櫃檯買賣中心 OpenAPI（上櫃，完全免費、不用 API Key）
 *   其他（美股，例如 NVDA、GOOGL）→ Finnhub（免費版涵蓋美股）
 */
function getFundamentals_(symbol) {
  try {
    if (symbol.indexOf('.TWO') !== -1) {
      return getFundamentalsFromTPEx_(symbol.replace('.TWO', ''));
    }
    if (symbol.indexOf('.TW') !== -1) {
      return getFundamentalsFromTWSE_(symbol.replace('.TW', ''));
    }
    return getFundamentalsFromFinnhub_(symbol);
  } catch (err) {
    Logger.log('getFundamentals_(' + symbol + ') 失敗：' + err);
    return null;
  }
}

/**
 * 上市股票／ETF：台灣證券交易所官方 OpenAPI
 * https://openapi.twse.com.tw/v1/exchangeReport/BWIBBU_ALL
 * 回傳全市場清單，這裡依 Code 篩出這一檔。完全免費、不用申請 Key。
 *
 * 用 CacheService 快取整份清單 10 分鐘——不然森林裡每一檔上市股票
 * 都會重新抓一次「全市場」清單（現在的名冊有 15+ 檔上市股票，等於
 * 同一份幾千筆的資料在同一次巡林裡被下載十幾次），既浪費 Apps Script
 * 的執行時間額度，也拖慢每次打開網站的速度。
 */
function getFundamentalsFromTWSE_(code) {
  var list = getCachedList_('twse_bwibbu', 'https://openapi.twse.com.tw/v1/exchangeReport/BWIBBU_ALL');
  if (!list || !list.length) return null;

  var row = null;
  for (var i = 0; i < list.length; i++) {
    if (list[i].Code === code) { row = list[i]; break; }
  }
  if (!row) return null; // 例如純 ETF 常常沒有本益比，屬正常現象

  return {
    peRatio: toNumberOrNull_(row.PEratio),
    pbRatio: toNumberOrNull_(row.PBratio),
    dividendYield: toNumberOrNull_(row.DividendYield)
  };
}

/**
 * 上櫃股票：證券櫃檯買賣中心（TPEx）官方 OpenAPI
 * https://www.tpex.org.tw/openapi/v1/tpex_mainboard_peratio_analysis
 * 完全免費、不用申請 Key。同樣用快取避免重複下載整份清單。
 *
 * ⚠️ TPEx 這支 API 的欄位名稱，我沒辦法在這裡實際呼叫驗證（環境限制），
 * 是依照網路上其他開發者的使用紀錄推測的。如果部署後你的上櫃持股
 * （例如「精材」「日揚」）PE/PB 還是抓不到，麻煩用瀏覽器打開
 * {WEB_APP_URL}?action=debugTaiwanFundamentals&symbol=3374.TWO 這種
 * 除錯方式看一下實際欄位長怎樣，告訴我，我再校正欄位名稱。
 */
function getFundamentalsFromTPEx_(code) {
  var list = getCachedList_('tpex_peratio', 'https://www.tpex.org.tw/openapi/v1/tpex_mainboard_peratio_analysis');
  if (!list || !list.length) return null;

  var row = null;
  for (var i = 0; i < list.length; i++) {
    var thisCode = firstDefined_(list[i], ['Code', 'SecuritiesCompanyCode', 'CompanyCode', 'StockCode']);
    if (thisCode === code) { row = list[i]; break; }
  }
  if (!row) return null;

  return {
    peRatio: toNumberOrNull_(firstDefined_(row, ['PeRatio', 'PEratio', 'PriceEarningRatio'])),
    pbRatio: toNumberOrNull_(firstDefined_(row, ['PbRatio', 'PBratio', 'PriceBookRatio'])),
    dividendYield: toNumberOrNull_(firstDefined_(row, ['DividendYieldRatio', 'DividendYield', 'YieldRatio']))
  };
}

/**
 * 抓一份「全市場清單」並快取 10 分鐘。Apps Script 的 CacheService 有
 * 100KB 的單筆大小限制，這兩份清單可能超過，所以自動切成多段存、
 * 讀取時再拼回去；任何一步失敗就直接重新下載，不會讓整個請求掛掉。
 */
function getCachedList_(cacheKey, url) {
  var cache = CacheService.getScriptCache();
  try {
    var cachedMeta = cache.get(cacheKey + '_meta');
    if (cachedMeta) {
      var chunkCount = Number(cachedMeta);
      var chunks = [];
      for (var i = 0; i < chunkCount; i++) {
        var chunk = cache.get(cacheKey + '_' + i);
        if (chunk === null) { chunks = null; break; } // 有一段過期了，整份當作沒快取
        chunks.push(chunk);
      }
      if (chunks) return JSON.parse(chunks.join(''));
    }
  } catch (err) {
    Logger.log('讀取快取失敗，改重新下載：' + err);
  }

  var res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  var list = JSON.parse(res.getContentText());

  try {
    var text = JSON.stringify(list);
    var CHUNK_SIZE = 90000; // 留一點餘裕給 100KB 限制
    var count = Math.ceil(text.length / CHUNK_SIZE);
    var toStore = {};
    for (var j = 0; j < count; j++) {
      toStore[cacheKey + '_' + j] = text.substring(j * CHUNK_SIZE, (j + 1) * CHUNK_SIZE);
    }
    toStore[cacheKey + '_meta'] = String(count);
    cache.putAll(toStore, 600); // 快取 10 分鐘
  } catch (err) {
    Logger.log('寫入快取失敗（不影響這次請求本身）：' + err);
  }

  return list;
}

/**
 * 美股：Finnhub 免費版
 * https://finnhub.io/docs/api/company-basic-financials
 * 需要先到 finnhub.io 免費申請 API Key，存進「專案設定 →指令碼屬性」，
 * 屬性名稱設為 FINNHUB_API_KEY。
 */
function getFundamentalsFromFinnhub_(symbol) {
  var apiKey = PropertiesService.getScriptProperties().getProperty('FINNHUB_API_KEY');
  if (!apiKey) {
    Logger.log('尚未設定 FINNHUB_API_KEY，美股基本面資料先略過');
    return null;
  }
  var metric = getFinnhubRawMetric_(symbol, apiKey);
  if (!metric) return null;

  return {
    peRatio: toNumberOrNull_(metric.peBasicExclExtraTTM ?? metric.peTTM),
    pbRatio: toNumberOrNull_(metric.pbAnnual ?? metric.pbQuarterly),
    dividendYield: toNumberOrNull_(metric.dividendYieldIndicatedAnnual ?? metric.currentDividendYieldTTM)
  };
}

function getFinnhubRawMetric_(symbol, apiKeyParam) {
  var apiKey = apiKeyParam || PropertiesService.getScriptProperties().getProperty('FINNHUB_API_KEY');
  if (!apiKey) return { error: '尚未設定 FINNHUB_API_KEY' };
  var url = 'https://finnhub.io/api/v1/stock/metric?symbol=' + encodeURIComponent(symbol) + '&metric=all&token=' + apiKey;
  var res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  var json = JSON.parse(res.getContentText());
  return json && json.metric ? json.metric : null;
}

// 依序嘗試多個候選欄位名稱，回傳第一個有值的（用來因應不同官方 API 欄位命名不一致）
function firstDefined_(obj, keys) {
  for (var i = 0; i < keys.length; i++) {
    if (obj[keys[i]] !== undefined && obj[keys[i]] !== null && obj[keys[i]] !== '') return obj[keys[i]];
  }
  return null;
}

// 政府/交易所 API 常把數字包成字串（例如 "15.23" 或 "--"），統一轉成數字或 null
function toNumberOrNull_(value) {
  if (value === null || value === undefined || value === '' || value === '--' || value === 'N/A') return null;
  var num = Number(value);
  return isNaN(num) ? null : num;
}

function jsonResponse_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
