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

const STORAGE_KEY = 'ccc_orders_list';

export const orderService = {
  // 获取所有订单
  getOrders: (): Order[] => {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('Failed to parse orders from localStorage:', e);
      return [];
    }
  },

  // 创建并持久化新订单
  createOrder: (orderData: Omit<Order, 'id' | 'status' | 'createdAt'>): Order => {
    const newOrder: Order = {
      ...orderData,
      id: `ORD-${Date.now().toString().slice(-6)}`,
      status: 'Processing',
      createdAt: new Date().toISOString(),
    };
    
    const existingOrders = orderService.getOrders();
    const updatedOrders = [newOrder, ...existingOrders];
    
    // 强制写入 localStorage
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedOrders));
    console.log('Order successfully saved to localStorage:', newOrder);
    
    return newOrder;
  }
};
