import { create } from 'zustand';

export type UserRole = 'CUSTOMER' | 'STAFF' | 'KITCHEN' | 'ADMIN';

export interface MenuItem {
  id: string;
  name: string;
  category: string;
  price: number;
  description: string;
  imageUrl: string;
  tags: string[];
  allergens: string[];
  available: boolean;
  popularScore: number;
  complementaryItems: string[];
}

export interface CartItem {
  id?: string;
  menuItemId: string;
  menuItem: MenuItem;
  quantity: number;
  notes?: string;
}

export interface Order {
  id: string;
  sessionId: string;
  status: 'PENDING' | 'PREPARING' | 'READY' | 'SERVED' | 'CANCELLED';
  totalAmount: number;
  createdAt: string;
  items: {
    id: string;
    quantity: number;
    price: number;
    notes?: string;
    menuItem: MenuItem;
  }[];
}

interface DiningState {
  // Session & Table State
  tableNo: string | null;
  sessionId: string | null;
  sessionExpiresAt: string | null;   // ISO timestamp from Redis TTL
  ttlSeconds: number;                // seconds remaining (updated on join)
  setSession: (tableNo: string, sessionId: string, expiresAt?: string, ttlSeconds?: number) => void;
  clearSession: () => void;

  // Active Role State (For elegant live demo switcher)
  role: UserRole;
  setRole: (role: UserRole) => void;

  // UI States
  isCartOpen: boolean;
  setIsCartOpen: (open: boolean) => void;

  // Local/Optimistic Cart State
  cart: CartItem[];
  setCart: (items: CartItem[]) => void;
  addToCartOptimistic: (item: MenuItem, notes?: string) => void;
  updateQuantityOptimistic: (menuItemId: string, change: number) => void;
  removeFromCartOptimistic: (menuItemId: string) => void;
  clearCartOptimistic: () => void;

  // Tracking Active Orders
  activeOrders: Order[];
  setActiveOrders: (orders: Order[]) => void;
  addOrder: (order: Order) => void;
}

export const useDiningStore = create<DiningState>((set) => ({
  tableNo: null,
  sessionId: null,
  sessionExpiresAt: null,
  ttlSeconds: 0,
  setSession: (tableNo, sessionId, expiresAt, ttlSeconds) =>
    set({ tableNo, sessionId, sessionExpiresAt: expiresAt ?? null, ttlSeconds: ttlSeconds ?? 0 }),
  clearSession: () => set({ tableNo: null, sessionId: null, sessionExpiresAt: null, ttlSeconds: 0, cart: [], activeOrders: [] }),

  role: 'CUSTOMER',
  setRole: (role) => set({ role }),

  isCartOpen: false,
  setIsCartOpen: (open) => set({ isCartOpen: open }),

  cart: [],
  setCart: (cart) => set({ cart }),
  addToCartOptimistic: (item, notes) => set((state) => {
    const existing = state.cart.find((c) => c.menuItemId === item.id);
    if (existing) {
      return {
        cart: state.cart.map((c) =>
          c.menuItemId === item.id ? { ...c, quantity: c.quantity + 1, notes: notes || c.notes } : c
        ),
      };
    }
    return {
      cart: [...state.cart, { menuItemId: item.id, menuItem: item, quantity: 1, notes }],
    };
  }),
  updateQuantityOptimistic: (menuItemId, change) => set((state) => {
    return {
      cart: state.cart
        .map((c) => (c.menuItemId === menuItemId ? { ...c, quantity: Math.max(1, c.quantity + change) } : c))
        .filter((c) => c.quantity > 0),
    };
  }),
  removeFromCartOptimistic: (menuItemId) => set((state) => ({
    cart: state.cart.filter((c) => c.menuItemId !== menuItemId),
  })),
  clearCartOptimistic: () => set({ cart: [] }),

  activeOrders: [],
  setActiveOrders: (activeOrders) => set({ activeOrders }),
  addOrder: (order) => set((state) => ({ activeOrders: [order, ...state.activeOrders] })),
}));
