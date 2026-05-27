'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useDiningStore } from '../store/diningStore';
import getSocket from './socket';

// ── Unique guest identity  ─────────────────────────────────────────
function getOrCreateGuestId(): string {
  if (typeof window === 'undefined') return 'server';
  let id = sessionStorage.getItem('guestId');
  if (!id) {
    id = `guest_${Math.random().toString(36).slice(2, 9)}`;
    sessionStorage.setItem('guestId', id);
  }
  return id;
}

function getOrCreateGuestName(): string {
  if (typeof window === 'undefined') return 'Guest';
  let name = sessionStorage.getItem('guestName');
  if (!name) {
    const adjectives = ['Royal', 'Silk', 'Spice', 'Golden', 'Pearl', 'Amber'];
    const nouns = ['Tiger', 'Pepper', 'Saffron', 'Lotus', 'Dune', 'Fennel'];
    name = `${adjectives[Math.floor(Math.random() * adjectives.length)]} ${nouns[Math.floor(Math.random() * nouns.length)]}`;
    sessionStorage.setItem('guestName', name);
  }
  return name;
}

// ── Exported identity helpers ──────────────────────────────────────
export const guestId   = typeof window !== 'undefined' ? getOrCreateGuestId()   : '';
export const guestName = typeof window !== 'undefined' ? getOrCreateGuestName() : 'Guest';

// ── Hook ───────────────────────────────────────────────────────────
export function useSocket() {
  const {
    sessionId,
    tableNo,
    setCart,
    addToCartOptimistic,
    updateQuantityOptimistic,
    removeFromCartOptimistic,
    clearCartOptimistic,
    setActiveOrders,
    activeOrders,
  } = useDiningStore();

  const joinedRef = useRef(false);

  // Join the session room with full identity once sessionId is available
  useEffect(() => {
    if (!sessionId || !tableNo || joinedRef.current) return;
    joinedRef.current = true;

    const socket = getSocket();
    socket.emit('join_session', {
      sessionId,
      guestId,
      guestName,
      tableNo,
    });
  }, [sessionId, tableNo]);

  // ── Cart event listeners ─────────────────────────────────────────
  useEffect(() => {
    if (!sessionId) return;
    const socket = getSocket();

    // Another guest added an item
    socket.on('cart:item_added', (data: {
      guestId: string; guestName: string;
      menuItemId: string; menuItemName: string;
      quantity: number; price: number;
    }) => {
      if (data.guestId === guestId) return; // already applied optimistically
      // We don't have the full MenuItem here — trigger a full cart refetch
      // The cart gets re-synced via the api in the consuming component.
      // Emit a synthetic local event so CartDrawer can react:
      window.dispatchEvent(new CustomEvent('cart:remote_changed', { detail: data }));
    });

    socket.on('cart:item_removed', (data: {
      guestId: string; menuItemId: string;
    }) => {
      if (data.guestId === guestId) return;
      removeFromCartOptimistic(data.menuItemId);
      window.dispatchEvent(new CustomEvent('cart:remote_changed', { detail: data }));
    });

    socket.on('cart:item_updated', (data: {
      guestId: string; menuItemId: string; quantity: number;
    }) => {
      if (data.guestId === guestId) return;
      // Compute delta
      const store = useDiningStore.getState();
      const existing = store.cart.find((c) => c.menuItemId === data.menuItemId);
      if (existing) {
        updateQuantityOptimistic(data.menuItemId, data.quantity - existing.quantity);
      }
      window.dispatchEvent(new CustomEvent('cart:remote_changed', { detail: data }));
    });

    socket.on('cart:cleared', (data: { guestName: string }) => {
      clearCartOptimistic();
      window.dispatchEvent(new CustomEvent('cart:remote_changed', { detail: data }));
    });

    // Order events
    socket.on('order:placed', (data: { orderId: string; guestName: string }) => {
      window.dispatchEvent(new CustomEvent('order:remote_placed', { detail: data }));
    });

    socket.on('order:status_changed', (data: { orderId: string; status: string }) => {
      setActiveOrders(
        useDiningStore.getState().activeOrders.map((o) =>
          o.id === data.orderId ? { ...o, status: data.status as any } : o
        )
      );
    });

    return () => {
      socket.off('cart:item_added');
      socket.off('cart:item_removed');
      socket.off('cart:item_updated');
      socket.off('cart:cleared');
      socket.off('order:placed');
      socket.off('order:status_changed');
    };
  }, [sessionId, removeFromCartOptimistic, updateQuantityOptimistic, clearCartOptimistic, setActiveOrders]);

  // ── Emitters ──────────────────────────────────────────────────────
  const emitCartItemAdded = useCallback((
    menuItemId: string, menuItemName: string, quantity: number, price: number
  ) => {
    if (!sessionId) return;
    getSocket().emit('cart:item_added', {
      sessionId, guestId, guestName, menuItemId, menuItemName, quantity, price,
    });
  }, [sessionId]);

  const emitCartItemRemoved = useCallback((menuItemId: string, menuItemName: string) => {
    if (!sessionId) return;
    getSocket().emit('cart:item_removed', {
      sessionId, guestId, guestName, menuItemId, menuItemName,
    });
  }, [sessionId]);

  const emitCartItemUpdated = useCallback((
    menuItemId: string, menuItemName: string, quantity: number
  ) => {
    if (!sessionId) return;
    getSocket().emit('cart:item_updated', {
      sessionId, guestId, guestName, menuItemId, menuItemName, quantity,
    });
  }, [sessionId]);

  const emitCartCleared = useCallback(() => {
    if (!sessionId) return;
    getSocket().emit('cart:cleared', { sessionId, guestName });
  }, [sessionId]);

  const emitOrderPlaced = useCallback((
    orderId: string, tableNo: string, totalAmount: number, itemCount: number
  ) => {
    if (!sessionId) return;
    getSocket().emit('order:placed', {
      sessionId, orderId, tableNo, guestName, totalAmount, itemCount,
    });
  }, [sessionId]);

  const emitOrderStatusUpdated = useCallback((
    targetSessionId: string, orderId: string, status: string
  ) => {
    getSocket().emit('order:status_updated', {
      sessionId: targetSessionId, orderId, status, updatedBy: guestName,
    });
  }, []);

  const emitAiMessage = useCallback((text: string, sender: 'USER' | 'AI') => {
    if (!sessionId) return;
    getSocket().emit('ai:message', { sessionId, guestId, guestName, text, sender });
  }, [sessionId]);

  return {
    guestId,
    guestName,
    emitCartItemAdded,
    emitCartItemRemoved,
    emitCartItemUpdated,
    emitCartCleared,
    emitOrderPlaced,
    emitOrderStatusUpdated,
    emitAiMessage,
  };
}
