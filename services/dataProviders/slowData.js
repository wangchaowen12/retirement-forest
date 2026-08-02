/**
 * Slow Data — 森林智慧的載體
 * ============================
 * 這不是市場資料 Provider（不天天變），是「人＋AI 健檢累積出來的判斷」，
 * 存成資料表的樣子，讓 Decision Engine 可以讀。
 *
 * 在整條運作鏈裡的位置：
 *
 *   TREE_ROSTER（持股，幾乎不變）
 *   Market Data Provider（快資料：今天的 price/PE/PB/殖利率，每天變）
 *   Slow Data（這個檔案：估值錨點/樹種分類/主題曝險，健檢時才變，通常半年~一年一次）
 *         │
 *         ▼
 *   Data Repository 把三者融合：
 *     今天的 PE/PB/殖利率（快）+ 錨點區間（慢）→ 即時算出 valuationScore
 *         │
 *         ▼
 *   Decision Engine（完全不知道這個分數是融合出來的，只看到 scores.valuationScore 有值）
 *
 * 三方協作模式（這是這張表存在的真正理由，不只是技術架構）：
 *   人（健檢、決定要不要接受AI建議）
 *   ＋ AI（提出健檢分析、定期建議更新錨點）
 *   ＋ 森林（把兩者的結論保存下來，每天自動套用在快資料上）
 *   三者的討論成果，最終都要沉澱回這張表，森林才會「記得」健檢學到的東西，
 *   不會每次都要重新討論一次。
 *
 * 更新頻率：預設 nextReviewDue 半年一次；若該樹種觸發規則A（業務模式質變，
 * 例如毛利率非漸進式跳躍），應不等排程、立即回頭檢查——這個「提早觸發」
 * 目前還沒有自動偵測機制，需要人工/AI在每次健檢時自己留意（見待辦5）。
 *
 * valuationMethod 對應的 cheapBound / expensiveBound 意義：
 *   'peer_price_anchor'      → 直接是價格（同業估值換算出的合理價格區間）
 *   'pe_band'                → 本益比倍數（跟自身歷史河流圖比）
 *   'pb_band'                → 淨值比倍數
 *   'nav_pb_band'             → 大盤/追蹤指數層級的淨值比倍數（ETF專用）
 *   'river_chart_qualitative' → 沒有查到精確數字，只有河流圖顏色判斷，
 *                               cheapBound/expensiveBound 留 null，
 *                               改用 riverPosition 給一個粗略分數
 *
 * cheapBound 恆代表「便宜端」，expensiveBound 恆代表「昂貴端」——
 * 不管指標本身方向（例如殖利率是越高越便宜，跟PE相反），這裡固定用
 * 「便宜/昂貴」語意命名，避免呼叫端要自己記方向。
 */

export const SLOW_DATA_LAST_UPDATED = '2026-07-29';

export const SLOW_DATA = {
  '2308.TW': { // 台達電
    analysisCategory: 'growth_tech',
    peerGroup: ['Vertiv', 'Eaton'],
    themeExposure: '半導體/AI供應鏈',
    valuationMethod: 'peer_price_anchor',
    cheapBound: 870,
    expensiveBound: 1410,
    transformationFlag: true, // 規則A觸發：毛利率15%→37.5%非漸進式跳躍，電源零件商→AI基礎設施解決方案商
    lastReviewed: '2026-07-28',
    nextReviewDue: '2027-01-28',
    notes: '用Vertiv(52倍,PEG1.05)/Eaton(32倍)換算，EPS基準27.1元。動能最強但離合理價距離最遠，規則V排行榜排最後。'
  },
  '2345.TW': { // 智邦
    analysisCategory: 'growth_tech',
    peerGroup: ['Arista Networks'],
    themeExposure: '半導體/AI供應鏈',
    valuationMethod: 'peer_price_anchor',
    cheapBound: 1576,
    expensiveBound: 2261,
    transformationFlag: false,
    lastReviewed: '2026-07-29',
    nextReviewDue: '2027-01-29',
    notes: '用Arista Networks換算(正常化5年均值29.8倍/現況Forward PE 42.77倍)，EPS基準52.88元。⚠️股價來源不一致(2340 vs 1590)待確認，方向判斷(偏貴)仍站得住。EPS年增98.58%比Arista更猛，區間可能偏保守。'
  },
  '2330.TW': { // 台積電
    analysisCategory: 'growth_tech',
    peerGroup: [],
    themeExposure: '半導體代工',
    valuationMethod: 'pe_band',
    cheapBound: 15,
    expensiveBound: 29.5,
    transformationFlag: false, // 非質變型，核心業務規模化放大，規則A不適用
    lastReviewed: '2026-07-28',
    nextReviewDue: '2027-01-28',
    notes: '近10年本益比歷史低點約15倍，2021年初高點約29-30倍。2025/11資料顯示河流圖23.4-26.2倍區間為「合理偏高」。PEG式交叉驗證：近5年EPS均成長28%，動能調整後合理錨點約28倍。今日(7/28)26.4倍，偏高但未離譜。'
  },
  '2395.TW': { // 研華
    analysisCategory: 'growth_tech',
    peerGroup: [],
    themeExposure: '工業電腦（消費性科技景氣連動較低）',
    valuationMethod: 'river_chart_qualitative',
    riverPosition: 'red_high',
    cheapBound: null,
    expensiveBound: null,
    transformationFlag: false,
    lastReviewed: '2026-07',
    nextReviewDue: '2027-01',
    notes: '本益比河流圖明確顯示紅色偏高，43.99倍，PB達9.92倍。營收動能真實(6月首破百億)但估值缺乏即時進場理由，建議等回落到黃/藍區。有股票股利需注意稀釋真實殖利率。'
  },
  '9945.TW': { // 潤泰新
    analysisCategory: 'value_traditional',
    peerGroup: [],
    themeExposure: '傳產/不動產（與半導體脫鉤）',
    valuationMethod: 'river_chart_qualitative',
    riverPosition: 'blue_low',
    cheapBound: null,
    expensiveBound: null,
    transformationFlag: false,
    lastReviewed: '2026-07',
    nextReviewDue: '2027-01',
    notes: 'PB河流圖藍色偏低(PB 0.78-0.85倍/PE 7-8.6倍)。業外收益波動大，PB比PE更適用。配息15年、盈餘分配率約30%保守。排行榜保守類別第1名。'
  },
  '2881.TW': { // 富邦金
    analysisCategory: 'financial_holding',
    peerGroup: [],
    themeExposure: '金融（與半導體脫鉤）',
    valuationMethod: 'river_chart_qualitative',
    riverPosition: 'blue_low',
    cheapBound: null,
    expensiveBound: null,
    transformationFlag: false,
    lastReviewed: '2026-07',
    nextReviewDue: '2027-01',
    notes: 'PE河流圖藍色偏低(PE 9-17.68倍，處歷史低檔但不算絕對便宜)。用資本適足率緩衝倍數取代負債比(富邦人壽404.8%/200%=2.02倍緩衝)。配息17年。排行榜保守類別第2名。'
  },
  '2049.TW': { // 上銀
    analysisCategory: 'growth_tech', // 由苗圃/觀察中升級（規則W）
    peerGroup: [],
    themeExposure: '精密機械/半導體設備＋機器人',
    valuationMethod: 'pending', // 待辦：止穩四項已過，但估值位階(河流圖)尚未查證
    cheapBound: null,
    expensiveBound: null,
    transformationFlag: false,
    lastReviewed: '2026-07',
    nextReviewDue: '2026-10', // 較短週期：升級案例，且估值方法尚未補齊，優先回頭確認
    notes: '基本面止穩四項全數通過(連續3季EPS成長創6季新高/機器人營收占比12%/累計營收轉正/BPS連7年成長)。反轉確認型證據，強度高於持續加速型(規則X)。估值河流圖位階尚未查證，是目前最需要優先補齊的一筆。'
  },
  '8234.TW': { // 新漢
    analysisCategory: '苗圃',
    peerGroup: [],
    themeExposure: '半導體設備/邊緣運算（題材與AI相關，基本面尚弱）',
    valuationMethod: 'n/a', // 規則S：估值判斷之前，先確認數據穩不穩定——新漢目前不適用任何估值方法
    cheapBound: null,
    expensiveBound: null,
    transformationFlag: false,
    lastReviewed: '2026-07',
    nextReviewDue: '2026-10', // 苗圃股週期較短，優先觀察本業是否轉虧為盈
    notes: '當季本業虧損(EPS -0.02)，本益比177倍或無法計算，估值判斷本身不適用。財務結構(負債比改善中、流動比率1.34-1.48)及格但不寬裕。苗圃四項止穩檢查2項不符合、2項需查證。'
  },
  '6208.TWO': { // 日揚
    analysisCategory: '苗圃',
    peerGroup: [],
    themeExposure: '半導體設備',
    valuationMethod: 'n/a', // 規則S誕生案例：連專業工具FindBillion都放棄估值判斷
    cheapBound: null,
    expensiveBound: null,
    transformationFlag: false,
    thirdPartyQuality: { source: '富邦證券AI', asOf: '2026-07', score10: 8 }, // 見規則Z：跟我們自己的健檢結論有落差，已查明是權重稀釋，非評分錯誤
    lastReviewed: '2026-07',
    nextReviewDue: '2026-10',
    notes: '累計營收年增率至5月仍為-3.13%，單月數字大起大落(-26%~+30%)。連專業估值工具都表示無法判斷合理股價。苗圃四項止穩檢查0項通過，規則T的反例對照組(BPS穩定但其餘三項不通過)。⚠️富邦AI基本面給8分(見規則Z)：其六構面權重下成長性只佔20%，我們的健檢集中火力在這一項，兩者不衝突，但提醒我們健檢範圍該補齊現金流/營運效率/公司治理三個構面。'
  },
  '0050.TW': { // 0050
    analysisCategory: 'etf',
    peerGroup: [],
    themeExposure: '半導體核心（前10大成分股佔比80.12%，台積電單一權重約60%——規則I：非分散標的）',
    valuationMethod: 'nav_pb_band',
    cheapBound: 1.6,
    expensiveBound: 4.0,
    transformationFlag: false,
    lastReviewed: '2026-07',
    nextReviewDue: '2027-01',
    notes: '大盤淨值比分層觸發計畫：4倍以上暫停/3倍觀察/2.2倍第一層(投1/3)/1.9倍第二層/1.6倍第三層(全押)。溢價/折價是下單時機把關(當時0.2%健康)，不是估值本身。已連配息21年，近5年均殖利率3.64%。規則I發現：買0050約六成的錢等於又買一次台積電，之前「用0050分散」的假設需要修正。'
  }
};

/**
 * 融合快資料（今天的 price/PE/PB/殖利率）跟慢資料（錨點區間），
 * 即時算出 0-100 的估值分數。分數越高＝越便宜。
 *
 * 這個函式的存在，就是「慢資料 + 快資料融合」的具體實作——
 * 錨點半年才變一次，但分數每次呼叫都是用當下最新的快資料重新算。
 *
 * @param {string} symbol
 * @param {object} marketData - Provider 回傳的原始快資料（price/peRatio/pbRatio/dividendYield）
 * @returns {number|null} 0-100，null 代表這棵樹目前沒有可用的慢資料/快資料可以融合
 */
export function computeValuationScore(symbol, marketData) {
  const slow = SLOW_DATA[symbol];
  if (!slow) return null;

  // 河流圖質性判斷不需要任何快資料（不讀price/PE/PB），優先處理，
  // 不然沒有市場報價時會被下面的檢查誤擋掉。
  if (slow.valuationMethod === 'river_chart_qualitative') {
    return { blue_low: 82, yellow_mid: 50, red_high: 15 }[slow.riverPosition] ?? null;
  }

  if (!marketData) return null;

  let currentValue;
  switch (slow.valuationMethod) {
    case 'peer_price_anchor':
      currentValue = marketData.price;
      break;
    case 'pe_band':
      currentValue = marketData.peRatio;
      break;
    case 'pb_band':
    case 'nav_pb_band':
      currentValue = marketData.pbRatio;
      break;
    case 'dividend_yield_band':
      currentValue = marketData.dividendYield;
      break;
    default:
      return null; // 'n/a' 或 'pending'：目前沒有可用的估值方法，回傳 null，讓 Decision Engine 退回自己算
  }

  if (currentValue == null || slow.cheapBound == null || slow.expensiveBound == null) return null;

  const { cheapBound, expensiveBound } = slow;
  const raw = ((expensiveBound - currentValue) / (expensiveBound - cheapBound)) * 100;
  return Math.round(Math.max(0, Math.min(100, raw)));
}

export function getSlowData(symbol) {
  return SLOW_DATA[symbol] || null;
}

/**
 * 把第三方（例如富邦證券AI）提供的複合品質分數，換算成我們的 0-100 刻度。
 * 目前只支援 score10（10分制）換算，未來如果有別的來源用別的刻度，
 * 在這裡加一種換算方式即可，Decision Engine 完全不用改。
 *
 * 這是「不覆蓋，只補位」的設計——只有在我們自己還沒做過深度健檢
 * （valuationMethod 是 'pending' 或完全沒有 entry）的股票，才適合把
 * 第三方分數當「暫時的起點」餵進去；已經深度健檢過的股票（例如日揚），
 * 第三方分數只放在 thirdPartyQuality 供對照，不會自動覆蓋我們自己的結論。
 */
export function computeQualityScore(symbol) {
  const slow = SLOW_DATA[symbol];
  if (!slow?.thirdPartyQuality) return null;
  const { score10 } = slow.thirdPartyQuality;
  if (typeof score10 !== 'number') return null;
  return Math.round(score10 * 10); // 10分制 → 100分制
}
