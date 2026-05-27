import { Server, Socket } from 'socket.io';

// In-memory session participant registry
// Maps sessionId → Set of { socketId, guestName, guestId, joinedAt }
interface Participant {
  socketId: string;
  guestId: string;
  guestName: string;
  joinedAt: string;
  tableNo: string;
}

const sessionParticipants = new Map<string, Map<string, Participant>>();

function getParticipants(sessionId: string): Participant[] {
  const map = sessionParticipants.get(sessionId);
  return map ? Array.from(map.values()) : [];
}

export const setupSocketHandlers = (io: Server) => {
  console.log('[Socket.io] Registering event listeners...');

  io.on('connection', (socket: Socket) => {
    console.log(`[Socket.io] Client connected: ${socket.id}`);

    // ──────────────────────────────────────────────────────────────────
    // PRESENCE — Join session room with guest identity
    // ──────────────────────────────────────────────────────────────────
    socket.on('join_session', (data: {
      sessionId: string;
      guestId: string;
      guestName: string;
      tableNo: string;
    }) => {
      // Support legacy string calls (just sessionId)
      const sessionId = typeof data === 'string' ? data : data.sessionId;
      const guestId   = typeof data === 'string' ? socket.id : data.guestId;
      const guestName = typeof data === 'string' ? 'Guest' : data.guestName;
      const tableNo   = typeof data === 'string' ? '?' : data.tableNo;

      socket.join(sessionId);
      // Tag socket with session so we can clean up on disconnect
      (socket as any)._sessionId = sessionId;
      (socket as any)._guestId   = guestId;

      // Register participant
      if (!sessionParticipants.has(sessionId)) {
        sessionParticipants.set(sessionId, new Map());
      }
      sessionParticipants.get(sessionId)!.set(socket.id, {
        socketId: socket.id,
        guestId,
        guestName,
        joinedAt: new Date().toISOString(),
        tableNo,
      });

      const participants = getParticipants(sessionId);
      console.log(`[Socket.io] ${guestName} joined Table ${tableNo} | ${participants.length} at table`);

      // Broadcast updated participant list to everyone in the session
      io.to(sessionId).emit('session:participants_updated', {
        sessionId,
        participants,
        tableNo,
      });
    });

    // Join kitchen room (staff/chef screens)
    socket.on('join_kitchen', () => {
      socket.join('kitchen_room');
      console.log(`[Socket.io] Kitchen client joined: ${socket.id}`);
    });

    // ──────────────────────────────────────────────────────────────────
    // CART — Granular real-time cart events
    // ──────────────────────────────────────────────────────────────────

    // cart:item_added — broadcast to all other table members
    socket.on('cart:item_added', (data: {
      sessionId: string;
      guestId: string;
      guestName: string;
      menuItemId: string;
      menuItemName: string;
      quantity: number;
      price: number;
    }) => {
      console.log(`[Cart] ${data.guestName} added ${data.quantity}x ${data.menuItemName}`);
      socket.to(data.sessionId).emit('cart:item_added', data);
    });

    // cart:item_removed
    socket.on('cart:item_removed', (data: {
      sessionId: string;
      guestId: string;
      guestName: string;
      menuItemId: string;
      menuItemName: string;
    }) => {
      console.log(`[Cart] ${data.guestName} removed ${data.menuItemName}`);
      socket.to(data.sessionId).emit('cart:item_removed', data);
    });

    // cart:item_updated (qty or notes changed)
    socket.on('cart:item_updated', (data: {
      sessionId: string;
      guestId: string;
      guestName: string;
      menuItemId: string;
      menuItemName: string;
      quantity: number;
    }) => {
      console.log(`[Cart] ${data.guestName} updated ${data.menuItemName} → qty ${data.quantity}`);
      socket.to(data.sessionId).emit('cart:item_updated', data);
    });

    // cart:cleared — someone cleared the whole cart
    socket.on('cart:cleared', (data: { sessionId: string; guestName: string }) => {
      socket.to(data.sessionId).emit('cart:cleared', data);
    });

    // ──────────────────────────────────────────────────────────────────
    // AI — Real-time AI message relay
    // ──────────────────────────────────────────────────────────────────
    socket.on('ai:message', (data: {
      sessionId: string;
      guestId: string;
      guestName: string;
      text: string;
      sender: 'USER' | 'AI';
    }) => {
      // Relay AI messages to everyone at the table (shared chat experience)
      socket.to(data.sessionId).emit('ai:message', data);
    });

    // ──────────────────────────────────────────────────────────────────
    // ORDERS — Placement and status lifecycle
    // ──────────────────────────────────────────────────────────────────
    socket.on('order:placed', (data: {
      sessionId: string;
      orderId: string;
      tableNo: string;
      guestName: string;
      totalAmount: number;
      itemCount: number;
    }) => {
      console.log(`[Order] ${data.guestName} placed order #${data.orderId.slice(-6)} at Table ${data.tableNo}`);

      // Notify kitchen dashboard
      io.to('kitchen_room').emit('order:new_incoming', {
        orderId: data.orderId,
        tableNo: data.tableNo,
        sessionId: data.sessionId,
        guestName: data.guestName,
        totalAmount: data.totalAmount,
        itemCount: data.itemCount,
      });

      // Notify all table members (so tracker shows immediately)
      io.to(data.sessionId).emit('order:placed', {
        orderId: data.orderId,
        guestName: data.guestName,
        totalAmount: data.totalAmount,
      });
    });

    // Kitchen advances order status
    socket.on('order:status_updated', (data: {
      sessionId: string;
      orderId: string;
      status: string;
      updatedBy: string;
    }) => {
      console.log(`[Order] #${data.orderId.slice(-6)} → ${data.status} (by ${data.updatedBy})`);

      // Notify the table
      io.to(data.sessionId).emit('order:status_changed', {
        orderId: data.orderId,
        status: data.status,
      });

      // Sync all kitchen screens
      io.to('kitchen_room').emit('order:status_synced', {
        orderId: data.orderId,
        status: data.status,
      });
    });

    // ──────────────────────────────────────────────────────────────────
    // DISCONNECT — Clean up participant registry
    // ──────────────────────────────────────────────────────────────────
    socket.on('disconnect', () => {
      const sessionId = (socket as any)._sessionId;
      if (sessionId && sessionParticipants.has(sessionId)) {
        const map = sessionParticipants.get(sessionId)!;
        const leaving = map.get(socket.id);
        map.delete(socket.id);

        if (map.size === 0) {
          sessionParticipants.delete(sessionId);
        } else {
          // Broadcast updated participant list
          io.to(sessionId).emit('session:participants_updated', {
            sessionId,
            participants: getParticipants(sessionId),
          });
        }

        if (leaving) {
          console.log(`[Socket.io] ${leaving.guestName} left Table ${leaving.tableNo}`);
          // Announce departure to remaining members
          io.to(sessionId).emit('session:guest_left', {
            guestId: leaving.guestId,
            guestName: leaving.guestName,
          });
        }
      }
      console.log(`[Socket.io] Client disconnected: ${socket.id}`);
    });
  });
};
