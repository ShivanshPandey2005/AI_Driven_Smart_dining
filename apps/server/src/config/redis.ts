import Redis from 'ioredis';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
let redisClient: Redis | null = null;
let isRedisAvailable = false;

try {
  console.log(`Connecting to Redis at ${redisUrl}...`);
  redisClient = new Redis(redisUrl, {
    maxRetriesPerRequest: 1,
    retryStrategy(times) {
      if (times > 3) {
        console.warn('Redis: Failed to connect after 3 attempts. Disabling Redis-dependent real-time scaling (falling back to memory adapters).');
        return null; // Stop retrying
      }
      return Math.min(times * 100, 2000);
    }
  });

  redisClient.on('connect', () => {
    console.log('Redis connected successfully.');
    isRedisAvailable = true;
  });

  redisClient.on('error', (err) => {
    // Suppress spamming connection errors to console
    // console.error('Redis Error:', err.message);
    isRedisAvailable = false;
  });
} catch (error) {
  console.warn('Redis connection setup failed. Operating without Redis caching.');
}

export { redisClient, isRedisAvailable };
export default redisClient;
