const STATS_KEY = 'app_bag_stats';

export const bagStatsService = {
  recordAddToCart(productId: string) {
    const data = localStorage.getItem(STATS_KEY);
    const stats: Record<string, number> = data ? JSON.parse(data) : {};
    stats[productId] = (stats[productId] || 0) + 1;
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  },

  getStats(productId: string): number {
    const data = localStorage.getItem(STATS_KEY);
    const stats: Record<string, number> = data ? JSON.parse(data) : {};
    return stats[productId] || 0;
  }
};
