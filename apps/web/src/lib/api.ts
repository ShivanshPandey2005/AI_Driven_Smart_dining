const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export async function fetchApi<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${path}`;
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
    ...options,
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorJson;
    try {
      errorJson = JSON.parse(errorText);
    } catch {
      // Ignored
    }
    throw new Error(errorJson?.error || `HTTP error! Status: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export const api = {
  // Menu APIs
  getMenu: () => fetchApi<any[]>('/api/menu'),
  getMenuItem: (id: string) => fetchApi<any>(`/api/menu/${id}`),

  // QR Table Session APIs (primary entry points for QR scan flow)
  joinTableSession: (tableNo: string) =>
    fetchApi<any>(`/api/table/${tableNo}/session`),          // GET — creates or resumes session
  getTableTtl: (tableNo: string) =>
    fetchApi<{ tableNo: string; ttlSeconds: number }>(`/api/table/${tableNo}/ttl`),

  // Session APIs (legacy / direct entry)
  createSession: (tableNo: string, email?: string) =>
    fetchApi<any>('/api/session', {
      method: 'POST',
      body: JSON.stringify({ tableNo, email }),
    }),
  getSession: (sessionId: string) => fetchApi<any>(`/api/session/${sessionId}`),
  completeSession: (sessionId: string) =>
    fetchApi<any>(`/api/session/${sessionId}/complete`, { method: 'POST' }),

  // Cart APIs
  getCart: (sessionId: string) => fetchApi<any[]>(`/api/cart/${sessionId}`),
  addToCart: (sessionId: string, menuItemId: string, quantity: number, notes?: string) =>
    fetchApi<any>('/api/cart', {
      method: 'POST',
      body: JSON.stringify({ sessionId, menuItemId, quantity, notes }),
    }),
  updateCartItem: (cartId: string, quantity: number, notes?: string) =>
    fetchApi<any>(`/api/cart/${cartId}`, {
      method: 'PUT',
      body: JSON.stringify({ quantity, notes }),
    }),
  deleteCartItem: (cartId: string) =>
    fetchApi<any>(`/api/cart/${cartId}`, { method: 'DELETE' }),
  clearCart: (sessionId: string) =>
    fetchApi<any>(`/api/cart/session/${sessionId}`, { method: 'DELETE' }),

  // Order APIs
  placeOrder: (sessionId: string) =>
    fetchApi<any>('/api/orders', {
      method: 'POST',
      body: JSON.stringify({ sessionId }),
    }),
  getOrders: (sessionId: string) => fetchApi<any[]>(`/api/orders/session/${sessionId}`),
  getAllOrders: () => fetchApi<any[]>('/api/orders'),
  updateOrderStatus: (orderId: string, status: string) =>
    fetchApi<any>(`/api/orders/${orderId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),

  // AI Chat APIs
  sendAiMessage: (sessionId: string, message: string) =>
    fetchApi<any>('/api/ai/chat', {
      method: 'POST',
      body: JSON.stringify({ sessionId, message }),
    }),
  getAiHistory: (sessionId: string) => fetchApi<any[]>(`/api/ai/history/${sessionId}`),

  // Mock User APIs
  getUsers: () => fetchApi<any[]>('/api/users'),
};
export default api;
