export interface OrderItem {
  id: string;
  productId: string;
  name: string;
  brand: string;
  priceMYR: number;
  quantity: number;
  imageUrl: string;
}

export interface Order {
  id: string;
  userId: string;
  items: OrderItem[];
  totalPriceMYR: number;
  shippingAddress: string;
  status: string;
  createdAt: string;
}

export const orderService = {
  // 从 localStorage 统一读取订单列表
  getOrders: (): Order[] => {
    try {
      const data = localStorage.getItem('ccc_orders_list');
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('Error loading orders from localStorage:', e);
      return [];
    }
  },

  // 创建订单并写入 localStorage
  createOrder: (orderData: Omit<Order, 'id' | 'status' | 'createdAt'>): Order => {
    const newOrder: Order = {
      ...orderData,
      id: `ORD-${Date.now().toString().slice(-6)}`,
      status: 'Processing',
      createdAt: new Date().toISOString(),
    };
    const existing = orderService.getOrders();
    const updated = [newOrder, ...existing];
    localStorage.setItem('ccc_orders_list', JSON.stringify(updated));
    return newOrder;
  }
};
