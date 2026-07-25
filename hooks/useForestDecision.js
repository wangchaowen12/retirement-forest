/**
 * useForestDecision
 * -----------------
 * React 元件唯一該用的資料入口。元件不需要知道 Engine 怎麼運作，
 * 只需要：const { today, loading } = useForestDecision(scenario)
 */

export function useForestDecision(scenario) {
  const { useState, useEffect } = window.React;
  const [today, setToday] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    import('../services/forestService.js').then(({ getTodayDecision }) => {
      getTodayDecision(scenario).then(result => {
        if (!cancelled) { setToday(result); setLoading(false); }
      });
    });
    return () => { cancelled = true; };
  }, [scenario]);

  return { today, loading };
}
