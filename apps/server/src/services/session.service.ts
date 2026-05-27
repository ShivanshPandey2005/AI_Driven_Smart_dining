import { PrismaClient, SessionStatus } from '../generated/client';
import { redisClient, isRedisAvailable } from '../config/redis';
import crypto from 'crypto';

const prisma = new PrismaClient();

const SESSION_TTL_SECONDS = 4 * 60 * 60; // 4 hours

function redisTableKey(tableNo: string) {
  return `table_session:${tableNo}`;
}
function redisSessionKey(sessionId: string) {
  return `session_data:${sessionId}`;
}

export interface TableSession {
  id: string;
  tableNo: string;
  userId: string | null;
  status: string;
  createdAt: string;
  expiresAt: string;   // ISO timestamp 4 hours after creation
  participantCount: number;
}

/**
 * Get or create an active session for a given table number.
 * Uses Redis as the primary cache with PostgreSQL as the source of truth.
 * Each call also refreshes the Redis TTL (keeps the session alive while active).
 */
export async function getOrCreateTableSession(
  tableNo: string,
  userId?: string
): Promise<TableSession> {
  const tableKey = redisTableKey(tableNo);

  // ── 1. Redis Hit ────────────────────────────────────────────────────────
  if (isRedisAvailable && redisClient) {
    const cached = await redisClient.get(tableKey);
    if (cached) {
      const parsed: TableSession = JSON.parse(cached);
      // Bump participant count (multiple users on the same table)
      parsed.participantCount = (parsed.participantCount || 1) + 1;

      // Refresh TTL in Redis — keep 4-hour window rolling from last activity
      await redisClient.setex(tableKey, SESSION_TTL_SECONDS, JSON.stringify(parsed));
      await redisClient.setex(redisSessionKey(parsed.id), SESSION_TTL_SECONDS, JSON.stringify(parsed));

      console.log(`[SessionService] Cache HIT  Table ${tableNo} → session ${parsed.id} (${parsed.participantCount} participants)`);
      return parsed;
    }
  }

  // ── 2. Postgres Lookup ─────────────────────────────────────────────────
  let dbSession = await prisma.session.findFirst({
    where: { tableNo, status: SessionStatus.ACTIVE },
    include: { user: true },
  });

  // ── 3. Create if not found ─────────────────────────────────────────────
  if (!dbSession) {
    dbSession = await prisma.session.create({
      data: {
        tableNo,
        userId: userId || null,
        status: SessionStatus.ACTIVE,
      },
      include: { user: true },
    });
    console.log(`[SessionService] DB CREATE Table ${tableNo} → session ${dbSession.id}`);
  } else {
    console.log(`[SessionService] DB HIT    Table ${tableNo} → session ${dbSession.id}`);
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_SECONDS * 1000);

  const payload: TableSession = {
    id: dbSession.id,
    tableNo: dbSession.tableNo,
    userId: dbSession.userId,
    status: dbSession.status,
    createdAt: dbSession.createdAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    participantCount: 1,
  };

  // ── 4. Populate Redis ──────────────────────────────────────────────────
  if (isRedisAvailable && redisClient) {
    await redisClient.setex(tableKey, SESSION_TTL_SECONDS, JSON.stringify(payload));
    await redisClient.setex(redisSessionKey(payload.id), SESSION_TTL_SECONDS, JSON.stringify(payload));
    console.log(`[SessionService] Cache SET  Table ${tableNo} — expires in 4h`);
  }

  return payload;
}

/**
 * Fetch an existing session by its ID from Redis → Postgres fallback.
 */
export async function getSessionById(sessionId: string): Promise<TableSession | null> {
  const sessionKey = redisSessionKey(sessionId);

  if (isRedisAvailable && redisClient) {
    const cached = await redisClient.get(sessionKey);
    if (cached) return JSON.parse(cached) as TableSession;
  }

  const dbSession = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { user: true },
  });
  if (!dbSession) return null;

  const payload: TableSession = {
    id: dbSession.id,
    tableNo: dbSession.tableNo,
    userId: dbSession.userId,
    status: dbSession.status,
    createdAt: dbSession.createdAt.toISOString(),
    expiresAt: new Date(dbSession.createdAt.getTime() + SESSION_TTL_SECONDS * 1000).toISOString(),
    participantCount: 1,
  };

  if (isRedisAvailable && redisClient) {
    const remaining = Math.max(1, Math.floor((new Date(payload.expiresAt).getTime() - Date.now()) / 1000));
    await redisClient.setex(sessionKey, remaining, JSON.stringify(payload));
  }

  return payload;
}

/**
 * Invalidate a session on checkout/bill payment — clears Redis + marks Postgres completed.
 */
export async function invalidateTableSession(sessionId: string): Promise<void> {
  const dbSession = await prisma.session.findUnique({ where: { id: sessionId } });
  if (!dbSession) return;

  await prisma.session.update({
    where: { id: sessionId },
    data: { status: SessionStatus.COMPLETED },
  });

  if (isRedisAvailable && redisClient) {
    await redisClient.del(redisTableKey(dbSession.tableNo));
    await redisClient.del(redisSessionKey(sessionId));
    console.log(`[SessionService] Cache DEL  Table ${dbSession.tableNo} session ${sessionId} — checked out`);
  }
}

/**
 * Get current TTL (seconds remaining) for a table session from Redis.
 * Returns -1 if Redis is unavailable or session not cached.
 */
export async function getSessionTtl(tableNo: string): Promise<number> {
  if (!isRedisAvailable || !redisClient) return -1;
  return redisClient.ttl(redisTableKey(tableNo));
}
