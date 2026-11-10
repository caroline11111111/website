export interface OrderRemark {
  id: string;
  orderId: string;
  userId: string;
  content: string;
  createdAt: number;
}

export interface OrderItem {
  id: string;
  productId: string;
  name: string;
  brand: string;
  category: 'Handbags' | 'Watches';
  priceMYR: number;
  imageUrl: string;
}

export interface CustomerOrder {
  id: string;
  userId: string;
  orderId: string;
  orderState: string;
  createdAt: number;
  items: OrderItem[];
}

const ORDERS_KEY = 'app_customer_orders_db';
const REMARKS_KEY = 'app_order_remarks_db';

export const orderService = {
  getOrdersForUser(userId: string): CustomerOrder[] {
    const data = localStorage.getItem(ORDERS_KEY);
    let allOrders: CustomerOrder[] = data ? JSON.parse(data) : [];
    const userOrders = allOrders.filter(o => o.userId === userId);
    
    if (userOrders.length === 0) {
      const mockNewOrders: CustomerOrder[] = [
        {
          id: `ord_${userId}_1`,
          userId,
          orderId: `ORD-2026-001`,
          orderState: 'Processing / 备货中',
          createdAt: Date.now() - 5 * 86400000,
          items: [
            {
              id: 'item-1',
              productId: 'prod-1',
              name: 'Classic Leather Tote',
              brand: 'Brand A',
              category: 'Handbags',
              priceMYR: 12800,
              imageUrl: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=800&auto=format&fit=crop&q=80',
            }
          ]
        },
        {
          id: `ord_${userId}_2`,
          userId,
          orderId: `ORD-2026-002`,
          orderState: 'Shipped / 已发货',
          createdAt: Date.now() - 35 * 86400000,
          items: [
            {
              id: 'item-2',
              productId: 'prod-2',
              name: 'Chronograph Executive Watch',
              brand: 'Brand B',
              category: 'Watches',
              priceMYR: 34500,
              imageUrl: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&auto=format&fit=crop&q=80',
            }
          ]
        }
      ];
      allOrders = [...allOrders, ...mockNewOrders];
      localStorage.setItem(ORDERS_KEY, JSON.stringify(allOrders));
      return mockNewOrders;
    }
    return userOrders;
  },

  getRemarks(): OrderRemark[] {
    const data = localStorage.getItem(REMARKS_KEY);
    return data ? JSON.parse(data) : [];
  },

  addRemark(orderId: string, userId: string, content: string): OrderRemark {
    const trimmed = content.trim();
    if (!trimmed) throw new Error('Remark cannot be empty');

    const remarks = this.getRemarks();
    const newRemark: OrderRemark = {
      id: `rem_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      orderId,
      userId,
      content: trimmed,
      createdAt: Date.now(),
    };

    remarks.push(newRemark);
    localStorage.setItem(REMARKS_KEY, JSON.stringify(remarks));
    return newRemark;
  },

  getRemarksForOrder(orderId: string): OrderRemark[] {
    const remarks = this.getRemarks();
    return remarks.filter(r => r.orderId === orderId).sort((a, b) => a.createdAt - b.createdAt);
  }
};
