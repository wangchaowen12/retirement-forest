/**
 * News Provider（架構預留，尚未實作）
 * -------------------------------------
 * 給未來「今天森林有沒有突發新聞」之類的功能用。現在還不需要實作，
 * 先把介面留著：getNews(symbol) 回傳這棵樹最近的相關新聞列表。
 */
export class NewsProvider {
  // eslint-disable-next-line no-unused-vars
  async getNews(symbol) {
    throw new Error('getNews() 必須由子類別實作（目前尚無實作）');
  }
}
