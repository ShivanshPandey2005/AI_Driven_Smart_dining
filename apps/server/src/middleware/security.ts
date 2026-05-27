import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

// ==========================================
// 1. Zod Validation Schemas
// ==========================================
export const aiChatSchema = z.object({
  sessionId: z.string().uuid('Invalid Session UUID format'),
  message: z.string().min(1, 'Message cannot be empty').max(500, 'Message too long (max 500 chars)'),
});

export const cartItemSchema = z.object({
  sessionId: z.string().uuid('Invalid Session UUID format'),
  menuItemId: z.string().cuid('Invalid Menu Item ID format'),
  quantity: z.number().int().positive().max(50, 'Max quantity per dish is 50'),
  notes: z.string().max(100, 'Notes too long').optional(),
});

export const orderPlacementSchema = z.object({
  sessionId: z.string().uuid('Invalid Session UUID format'),
  name: z.string().min(2, 'Name must be at least 2 characters').max(50, 'Name too long'),
  phone: z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format'),
  otp: z.string().length(6, 'OTP must be exactly 6 digits'),
});

// ==========================================
// 2. API Validation Middleware
// ==========================================
export const validateBody = (schema: z.ZodSchema) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = await schema.parseAsync(req.body);
      next();
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Validation failed',
          details: err.errors.map(e => ({ field: e.path.join('.'), message: e.message })),
        });
      }
      return res.status(500).json({ error: 'Internal validation error' });
    }
  };
};

// ==========================================
// 3. Sanitized AI Inputs & Prompt Injection Defense
// ==========================================
export const sanitizeAndDefendAI = (req: Request, res: Response, next: NextFunction) => {
  if (req.body && typeof req.body.message === 'string') {
    let msg = req.body.message;

    // A. Sanitize HTML/Script injection tags
    msg = msg
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');

    // B. Prompt Injection Detection Patterns
    const injectionPatterns = [
      /ignore previous/i,
      /system prompt/i,
      /system override/i,
      /you are now a/i,
      /instead of your instructions/i,
      /bypass safety/i,
      /forget rules/i,
      /disregard/i,
      /acting as/i,
      /dan mode/i
    ];

    const hasInjection = injectionPatterns.some(pattern => pattern.test(msg));

    if (hasInjection) {
      console.warn(`[SECURITY WARNING] Potential Prompt Injection detected from IP: ${req.ip}`);
      // Sanitized defense override
      req.body.message = "[Prompt Injection Attempt Deflected: Requesting friendly food reminder instead.] Hi Zara, can you recommend your best chef special spicy dish?";
      return next();
    }

    req.body.message = msg;
  }
  next();
};

// ==========================================
// 4. In-Memory Adaptive Rate Limiter
// ==========================================
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

export const rateLimiter = (limit: number = 60, windowMs: number = 60 * 1000) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip || 'anonymous';
    const now = Date.now();
    const record = rateLimitMap.get(key);

    if (!record) {
      rateLimitMap.set(key, { count: 1, resetTime: now + windowMs });
      return next();
    }

    if (now > record.resetTime) {
      // Window expired, reset
      rateLimitMap.set(key, { count: 1, resetTime: now + windowMs });
      return next();
    }

    record.count++;
    if (record.count > limit) {
      return res.status(429).json({
        error: 'Too many requests',
        retryAfterSeconds: Math.ceil((record.resetTime - now) / 1000),
      });
    }

    next();
  };
};

// ==========================================
// 5. HttpOnly Cookies Secure Session Helpers
// ==========================================
export const setSessionCookie = (res: Response, sessionId: string) => {
  res.cookie('table_session_id', sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 4 * 60 * 60 * 1000, // 4 hours TTL matching Redis session expiry
  });
};

export const clearSessionCookie = (res: Response) => {
  res.clearCookie('table_session_id');
};
