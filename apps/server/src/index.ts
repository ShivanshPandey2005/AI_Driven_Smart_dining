import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import { PrismaClient, SessionStatus, OrderStatus, SenderType } from './generated/client';
import { createAdapter } from '@socket.io/redis-adapter';
import { setupSocketHandlers } from './socket/socket.handler';
import { redisClient, isRedisAvailable } from './config/redis';
import { AiService } from './services/ai.service';
import {
  getOrCreateTableSession,
  getSessionById,
  invalidateTableSession,
  getSessionTtl,
} from './services/session.service';

dotenv.config();

const app = express();
const server = http.createServer(app);
const prisma = new PrismaClient();

const PORT = process.env.PORT || 5000;

// Enable CORS
app.use(cors({
  origin: '*', // For development flexibility
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Initialize Socket.io
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Configure Socket.io Redis adapter if Redis is online
if (isRedisAvailable && redisClient) {
  const pubClient = redisClient;
  const subClient = redisClient.duplicate();
  io.adapter(createAdapter(pubClient, subClient));
  console.log('Socket.io: Multi-instance Redis adapter configured.');
} else {
  console.log('Socket.io: Single-instance in-memory adapter configured.');
}

// Hook up Socket listeners
setupSocketHandlers(io);

// ==========================================
// REST API ENDPOINTS
// ==========================================

// 1. Menu Items Routes
app.get('/api/menu', async (req, res) => {
  try {
    const items = await prisma.menuItem.findMany({
      orderBy: { popularScore: 'desc' }
    });
    res.json(items);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/menu/:id', async (req, res) => {
  try {
    const item = await prisma.menuItem.findUnique({
      where: { id: req.params.id }
    });
    if (!item) return res.status(404).json({ error: 'Menu item not found' });
    res.json(item);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 2. Session Routes — powered by SessionService (Redis + Postgres)

// QR scan entry point: GET /api/table/:tableNo/session
// Called by the /table/[tableId] frontend page on QR scan.
// Creates the session if none exists, returns existing one with TTL info.
app.get('/api/table/:tableNo/session', async (req, res) => {
  const { tableNo } = req.params;
  try {
    const session = await getOrCreateTableSession(tableNo);
    const ttl = await getSessionTtl(tableNo);
    res.json({ ...session, ttlSeconds: ttl });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Legacy POST route kept for compatibility with direct table-no entry from home page
app.post('/api/session', async (req, res) => {
  const { tableNo, email } = req.body;
  if (!tableNo) return res.status(400).json({ error: 'Table number is required' });
  try {
    const session = await getOrCreateTableSession(tableNo);
    const ttl = await getSessionTtl(tableNo);
    res.json({ ...session, ttlSeconds: ttl });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET session by ID — Redis-first lookup
app.get('/api/session/:id', async (req, res) => {
  try {
    const session = await getSessionById(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    res.json(session);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Mark session complete (checkout) — invalidates Redis cache
app.post('/api/session/:id/complete', async (req, res) => {
  try {
    await invalidateTableSession(req.params.id);
    res.json({ success: true, message: 'Session closed and cache invalidated.' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// TTL probe — lets the frontend show a countdown or warn on expiry
app.get('/api/table/:tableNo/ttl', async (req, res) => {
  try {
    const ttl = await getSessionTtl(req.params.tableNo);
    res.json({ tableNo: req.params.tableNo, ttlSeconds: ttl });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 3. Cart Routes
app.get('/api/cart/:sessionId', async (req, res) => {
  try {
    const items = await prisma.cartItem.findMany({
      where: { sessionId: req.params.sessionId },
      include: { menuItem: true }
    });
    res.json(items);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/cart', async (req, res) => {
  const { sessionId, menuItemId, quantity, notes } = req.body;
  if (!sessionId || !menuItemId) {
    return res.status(400).json({ error: 'sessionId and menuItemId are required' });
  }

  try {
    // Check if item already exists in session's cart
    const existing = await prisma.cartItem.findFirst({
      where: { sessionId, menuItemId }
    });

    let item;
    if (existing) {
      item = await prisma.cartItem.update({
        where: { id: existing.id },
        data: { 
          quantity: existing.quantity + (quantity || 1),
          notes: notes !== undefined ? notes : existing.notes
        },
        include: { menuItem: true }
      });
    } else {
      item = await prisma.cartItem.create({
        data: { sessionId, menuItemId, quantity: quantity || 1, notes },
        include: { menuItem: true }
      });
    }

    res.json(item);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/cart/:id', async (req, res) => {
  const { quantity, notes } = req.body;
  try {
    const item = await prisma.cartItem.update({
      where: { id: req.params.id },
      data: { quantity, notes },
      include: { menuItem: true }
    });
    res.json(item);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/cart/:id', async (req, res) => {
  try {
    await prisma.cartItem.delete({
      where: { id: req.params.id }
    });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/cart/session/:sessionId', async (req, res) => {
  try {
    await prisma.cartItem.deleteMany({
      where: { sessionId: req.params.sessionId }
    });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 4. Orders Routes
app.post('/api/orders', async (req, res) => {
  const { sessionId } = req.body;
  if (!sessionId) return res.status(400).json({ error: 'sessionId is required' });

  try {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: { user: true }
    });
    if (!session) return res.status(404).json({ error: 'Active session not found' });

    // Fetch items currently in the cart
    const cartItems = await prisma.cartItem.findMany({
      where: { sessionId },
      include: { menuItem: true }
    });

    if (cartItems.length === 0) {
      return res.status(400).json({ error: 'Cart is empty. Cannot place order.' });
    }

    // Compute total amount
    const totalAmount = cartItems.reduce((acc, curr) => {
      return acc + (curr.quantity * curr.menuItem.price);
    }, 0);

    // Create the order
    const order = await prisma.order.create({
      data: {
        sessionId,
        userId: session.userId,
        status: OrderStatus.PENDING,
        totalAmount,
        items: {
          create: cartItems.map(item => ({
            menuItemId: item.menuItemId,
            quantity: item.quantity,
            price: item.menuItem.price,
            notes: item.notes
          }))
        }
      },
      include: {
        items: { include: { menuItem: true } }
      }
    });

    // Clear the cart
    await prisma.cartItem.deleteMany({ where: { sessionId } });

    res.json(order);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/orders/session/:sessionId', async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      where: { sessionId: req.params.sessionId },
      include: {
        items: { include: { menuItem: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(orders);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/orders', async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      include: {
        session: true,
        items: { include: { menuItem: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(orders);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.patch('/api/orders/:id/status', async (req, res) => {
  const { status } = req.body;
  try {
    const order = await prisma.order.update({
      where: { id: req.params.id },
      data: { status: status as OrderStatus },
      include: { session: true }
    });
    res.json(order);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 5. AI Chat / Assistant Routes
app.post('/api/ai/chat', async (req, res) => {
  const { sessionId, message } = req.body;
  if (!sessionId || !message) {
    return res.status(400).json({ error: 'sessionId and message are required' });
  }

  try {
    // Save user message to database
    await prisma.aiMessage.create({
      data: {
        sessionId,
        sender: SenderType.USER,
        text: message
      }
    });

    // Generate response using LangChain / Fallback engine
    const replyText = await AiService.generateResponse(sessionId, message);

    // Save AI response to database
    const replyMessage = await prisma.aiMessage.create({
      data: {
        sessionId,
        sender: SenderType.AI,
        text: replyText
      }
    });

    res.json(replyMessage);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/ai/history/:sessionId', async (req, res) => {
  try {
    const history = await prisma.aiMessage.findMany({
      where: { sessionId: req.params.sessionId },
      orderBy: { createdAt: 'asc' }
    });
    res.json(history);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 6. Users Routes (Mock roles switching & display)
app.get('/api/users', async (req, res) => {
  try {
    const users = await prisma.user.findMany();
    res.json(users);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Root check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date() });
});

// Boot server
server.listen(PORT, () => {
  console.log(`==================================================`);
  console.log(`🚀 Smart Dining API is live on: http://localhost:${PORT}`);
  console.log(`==================================================`);
});
