/**
 * Fundamental Provider（架構預留，尚未實作）
 * -------------------------------------------
 * 給「年度森林健檢」之類需要更深入基本面研究的功能用，例如：
 * Morningstar 的 Moat、Stewardship、Quality Score，或其他機構研究報告。
 *
 * 現在還不需要實作——這裡先把介面形狀定下來，未來實作時，只要繼承
 * FundamentalProvider 並實作 getFundamentals(symbol)，回傳的資料一樣
 * 會經過 normalize.js 翻譯成 tree.fundamentals.scores.* 讓 Decision
 * Engine 直接使用，不需要改 Decision Engine 或 Data Repository。
 */
export class FundamentalProvider {
  // eslint-disable-next-line no-unused-vars
  async getFundamentals(symbol) {
    throw new Error('getFundamentals() 必須由子類別實作（目前尚無實作）');
  }
}
