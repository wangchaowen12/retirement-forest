/**
 * Research Provider（架構預留，尚未實作）
 * ------------------------------------------
 * 涵蓋「ETF 組成、產業排名」這類研究性資料，以及未來可能的
 * AIResearchProvider（用 AI 對公開資料做摘要分析，例如「這棵樹最近的
 * 新聞風向」）。現在還不需要實作，先把介面留著。
 */
export class ResearchProvider {
  // eslint-disable-next-line no-unused-vars
  async getResearch(symbol) {
    throw new Error('getResearch() 必須由子類別實作（目前尚無實作）');
  }
}
