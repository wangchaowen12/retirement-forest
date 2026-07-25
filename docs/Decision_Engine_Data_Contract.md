# Decision Engine Data Contract v1.4

> 版本常數：`DATA_CONTRACT_VERSION`，定義在 `services/dataProviders/normalize.js`。
> Engine 或 UI 需要判斷「現在系統用哪一版契約」時，讀這個常數，不要寫死字串。

## 版本紀錄

| 版本 | 異動 |
|---|---|
| v1.0 | 初版：定義必填/可選欄位，Provider 直接回傳扁平形狀（`tree.fundamentals.peRatio`） |
| v1.1 | **重大改版**：加入正規化階層（`valuation` / `quality` / `risk` / `scores`），Decision Engine 從此不再直接讀任何第三方 API 欄位名稱；新增 `scores` 區塊，讓 Provider 可以直接提供複合分數（qualityScore / valuationScore / riskScore） |
| v1.2 | 新增 `fundamentals.completeness`（0~100，取代原本二選一的「有沒有資料」），Decision Engine 的資料完整度護欄改成依 completeness 分級決定分數上限 |
| v1.3 | 修正 `dividendYield` 從未被正規化的遺漏；completeness 改成依 `instrumentType`（個股/ETF）採用不同必要欄位；`confidenceCap` 簡化回二段式 |
| v1.4 | **completeness 的必要欄位改成「目前真的穩定抓得到什麼」，不是「理論上重要什麼」**——實測發現 Yahoo 的 `quoteSummary` 端點常態性被擋（`revenueGrowthYoY`／`analystRating` 幾乎永遠是 null），繼續把它們列為必要欄位，只是在懲罰資料源限制，不是真的反映這棵樹可不可信。個股改成只要求證交所/櫃買中心穩定提供的 `peRatio`／`pbRatio`；ETF 改成只要有 `price` 就算資料充足（目前沒找到免費穩定的台股 ETF 基本面來源，改用修正幅度＋Blueprint缺口判斷，不強求基本面分數） |

> ⚠️ 這次改版本身也是個提醒：v1.2 的程式碼已經上線一段時間，但這份文件在被回頭檢查前一直停在 v1.1——版本號要跟著程式碼一起改，不是事後才補，不然 Data Contract 就失去「AI 判斷現在用哪一版」的意義了。

---

這份文件回答一個問題：**如果未來真的用 AI 做每日決策，AI 每天真正需要哪些市場資料？**
不是「現在程式裡已經有哪些欄位」，是「Decision Engine 的判斷邏輯，本質上依賴哪些資訊」。

這份契約分兩層：
1. **Provider 原始契約**（`getMarketData()` 直接回傳的扁平欄位）——不同 Provider 可能有不同的原始欄位名稱，這層只是暫存、除錯用。
2. **正規化形狀**（`tree.fundamentals`）——Decision Engine 唯一會讀的東西，由 `normalize.js` 統一產生，不管背後是誰。

---

## 正規化形狀（Decision Engine 實際讀取的介面）

```
tree.fundamentals = {
  valuation: { pe, peAvg5y, pb },
  quality:   { dividendStreakYears, revenueGrowthYoY, analystRating },
  risk:      { drawdownPct },
  scores:    { qualityScore, valuationScore, riskScore }  // Provider 可直接提供，優先於自算
}
```

`scores` 區塊是這一版新加的：如果 Provider 本身就有算好的複合分數（例如未來 Morningstar
的 Quality/Moat/Stewardship），Decision Engine 會**優先採用**這裡的值，不會自己重算；
沒有值（`null`）才退回用 `valuation`/`quality`/`risk` 現算。這代表 Decision Engine
永遠不需要知道 Morningstar 內部怎麼評分，只需要知道「這裡有一個 87 分」。

---

## 必填（Provider 原始契約 — Decision Engine 現在就會用到）

| 欄位 | 對應 Engine 用途 | 說明 |
|---|---|---|
| `price` | Weather Score、Blueprint 完成率計算 | 現價 |
| `peRatio` | Valuation Score | 本益比 |
| `dividendYield` | 果樹園類樹種的現金流評分 | 現金殖利率 |
| `eps` | 用來算 peRatio（price÷eps） | 每股盈餘 |
| `revenueGrowthYoY` | Fundamental Score（目前是 stub，之後會真正用到） | 營收年增率 |
| `analystRating` | Fundamental Score（之後會用到，目前 stub） | 分析師共識評等（Buy/Hold/Sell） |
| `marketCap` | 森林規模／流動性判斷 | 市值 |
| `pbRatio` | Valuation Score 的輔助指標 | 股價淨值比 |

## 可選（用來讓判斷更細緻，缺了不會讓 Engine 掛掉，只是退回保守）

| 欄位 | 對應 Engine 用途 | 說明 |
|---|---|---|
| `fiftyTwoWeekHigh` / `fiftyTwoWeekLow` | 用來算修正幅度（正規化成 `risk.drawdownPct`） | 52 週高低點 |
| `peHistory5yAvg` | 正規化成 `valuation.peAvg5y` | 5 年本益比均值 |
| `dividendStreakYears` | 正規化成 `quality.dividendStreakYears` | 連續配息年數 |
| `qualityScore` / `valuationScore` / `riskScore` | 正規化成 `scores.*`，Provider 直接提供的複合分數 | 例如 Morningstar |
| `roic` | 進階基本面評分（尚未定義正規化位置） | 投入資本回報率 |
| `freeCashFlow` | 進階基本面評分、股息安全邊際（尚未定義正規化位置） | 自由現金流 |
| `insiderTrading` | 額外風險訊號（尚未定義正規化位置） | 內部人交易 |
| `institutionalOwnership` | 額外風險訊號、籌碼穩定度（尚未定義正規化位置） | 法人持股比例 |
| `debtToEquity` | 財務體質、風險評分（尚未定義正規化位置） | 負債權益比 |

---

## 資料完整度護欄如何跟這張表互動

`decisionEngine.js` 裡的「資料完整度護欄」現在讀 `tree.fundamentals.completeness`（0~100），
不是二選一的「有沒有資料」。`normalize.js` 依實際填了多少關鍵欄位（pe、dividendStreakYears、
peAvg5y…）算出這個分數，再依三段門檻決定這棵樹今天分數的上限：

| completeness | 分數上限 | 意義 |
|---|---|---|
| ≥ 70 | 不設限 | 關鍵欄位大部分齊全，AI 有足夠資訊主動推薦 |
| < 70 | 封頂 69（最高只能到🔵） | 資料不足以支持主動推薦，僅列入觀察——不會有中間地帶，避免文字說「不推薦」但畫面卻顯示金額跟確認按鈕這種矛盾 |

必要欄位依 `instrumentType` 不同（v1.3 新增）：

| instrumentType | 必要欄位 | 原因 |
|---|---|---|
| `stock`（個股） | peRatio、pbRatio | 目前由證交所/櫃買中心穩定提供；revenueGrowthYoY/analystRating 依賴常態性被擋的 Yahoo quoteSummary，先不列為必要 |
| `etf` | 無（只要求 `price` 有值） | 目前沒找到免費穩定的台股 ETF 基本面/殖利率來源，改用修正幅度＋Blueprint缺口判斷 |

> 這兩張清單會隨資料源穩定度調整，不是永久定案。哪天 Yahoo 的 quoteSummary
> 恢復穩定，或找到真的能用的 ETF 殖利率來源，就把對應欄位加回必要清單，
> 讓評分納入更多真實資訊——調整只需要改這裡的 `COMPLETENESS_FIELDS_BY_TYPE`，
> 不用動 Decision Engine。

之後如果決定「沒有 `revenueGrowthYoY` 或 `analystRating` 也該扣分」，只需要在
`normalize.js` 的 completeness 計算邏輯裡多加一個欄位權重，不需要動 Decision Engine、
Data Repository 或任何 Provider。

---

## 目前 Mock Provider 對照表

| 欄位 | Mock 現況 |
|---|---|
| price / peRatio / pbRatio / dividendYield / eps | ✅ 有假資料 |
| analystRating / marketCap | ✅ 有假資料，但 Engine 還沒讀取（等 Fundamental Score 升級） |
| revenueGrowthYoY | ⏳ 目前是 `null`，Mock 階段還沒模擬 |
| fiftyTwoWeekHigh/Low / peHistory5yAvg / dividendStreakYears | ✅ 有假資料，Engine 已在用 |
| qualityScore / valuationScore / riskScore | ⏳ Mock 目前是 `null`，等未來接 Morningstar 這類會直接給分數的來源才會有值 |
| roic / freeCashFlow / insiderTrading / institutionalOwnership / debtToEquity | ⏳ 尚未定義，等真的需要進階分析時再加 |

---

## 之後接真實 API 時的檢查清單

1. 新 Provider（例如 `YahooMarketDataProvider`，已完成第一版，見 `services/dataProviders/market/`）實作 `getMarketData(symbol)`，回傳原始契約欄位
2. 在回傳前呼叫 `normalizeMarketData(raw)`（`services/dataProviders/normalize.js`），附上 `fundamentals`
3. 缺的欄位就回傳 `null`，不要省略欄位本身（保持形狀一致）
4. 只改 `services/dataProviders/market/index.js` 那一行 export，其他檔案不用動
5. 跑一次現有的煙霧測試（`node` 直接 import 六顆 Engine 跑一次），確認分數/訊號沒有出現 `NaN` 或 `undefined`

## Provider 分類架構（目前狀態）

| 分類 | 路徑 | 狀態 |
|---|---|---|
| Market Data | `services/dataProviders/market/` | ✅ Mock 已完成、Yahoo 第一版已寫（需驗證 CORS，見該檔案開頭說明） |
| Fundamental | `services/dataProviders/fundamental/` | ⏳ 介面預留，尚未實作（年度森林健檢會用到） |
| News | `services/dataProviders/news/` | ⏳ 介面預留，尚未實作 |
| Research / AI Research | `services/dataProviders/research/` | ⏳ 介面預留，尚未實作 |
