/**
 * redisService.js
 * ----------------
 * Centralised Redis client for PropAgent.AI.
 * Handles: session caching, API rate limiting, lead data caching,
 *          price alert queues, and ephemeral dashboard snapshots.
 *
 * FILE: database/redis/redisService.js
 *   (Also symlinked/imported from backend/src/services/redisService.js)
 *
 * Dependencies:
 *   npm install ioredis connect-redis express-session
 */

const Redis = require('ioredis');

// ─── Singleton Redis client ───────────────────────────────────────────────────
let _client = null;

function getClient() {
  if (_client) return _client;

  _client = new Redis({
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB || '0'),
    // Retry strategy: exponential backoff up to 30 seconds
    retryStrategy: (times) => Math.min(times * 200, 30_000),
    enableReadyCheck: true,
    maxRetriesPerRequest: 3,
    lazyConnect: false,
  });

  _client.on('connect', () => console.log('[Redis] Connected'));
  _client.on('error', (err) => console.error('[Redis] Error:', err.message));
  _client.on('reconnecting', () => console.log('[Redis] Reconnecting...'));

  return _client;
}

const redis = getClient();

// ─── TTL constants (seconds) ──────────────────────────────────────────────────
const TTL = {
  SESSION: 60 * 60 * 24 * 7,     // 7 days
  DASHBOARD: 60 * 5,             // 5 minutes (CRM dashboard stats)
  BUILDER_CONFIG: 60 * 30,       // 30 minutes (builder settings)
  RATE_LIMIT_WINDOW: 60,         // 1 minute window for API rate limiting
  CHAT_CONTEXT: 60 * 60 * 2,    // 2 hours (conversation context cache)
  ALERT_COOLDOWN: 60 * 60 * 24, // 24 hours (prevent duplicate alert emails)
};

// ─── KEY NAMESPACING ──────────────────────────────────────────────────────────
const key = {
  session: (sid)          => `session:${sid}`,
  dashboard: (builderId)  => `dash:${builderId}`,
  builderCfg: (builderId) => `cfg:${builderId}`,
  rateLimit: (ip, route)  => `rl:${ip}:${route}`,
  chatCtx: (sessionId)    => `chat:${sessionId}`,
  alertCooldown: (alertId)=> `alert_cd:${alertId}`,
  monthlyReport: (builderId, month) => `report:${builderId}:${month}`,
};

// ─── CACHE HELPERS ────────────────────────────────────────────────────────────

/**
 * Get a cached JSON value.
 * Returns null if key doesn't exist or has expired.
 */
async function get(cacheKey) {
  try {
    const val = await redis.get(cacheKey);
    return val ? JSON.parse(val) : null;
  } catch (err) {
    console.warn('[Redis] get error:', err.message);
    return null;
  }
}

/**
 * Set a JSON value with optional TTL (seconds).
 */
async function set(cacheKey, data, ttlSeconds = TTL.DASHBOARD) {
  try {
    await redis.set(cacheKey, JSON.stringify(data), 'EX', ttlSeconds);
  } catch (err) {
    console.warn('[Redis] set error:', err.message);
  }
}

/**
 * Delete a cache key immediately (e.g. after data update).
 */
async function del(cacheKey) {
  try {
    await redis.del(cacheKey);
  } catch (err) {
    console.warn('[Redis] del error:', err.message);
  }
}

/**
 * Invalidate all dashboard caches for a builder.
 * Call this after a new lead is created or settings change.
 */
async function invalidateBuilder(builderId) {
  await Promise.all([
    del(key.dashboard(builderId)),
    del(key.builderCfg(builderId)),
  ]);
}

// ─── RATE LIMITER ─────────────────────────────────────────────────────────────

/**
 * Sliding-window rate limiter using Redis INCR + EXPIRE.
 *
 * @param {string} ip       - Caller's IP address
 * @param {string} route    - Route identifier e.g. 'chat', 'upload'
 * @param {number} limit    - Max requests per window
 * @param {number} window   - Window size in seconds (default: 60)
 * @returns {{ allowed: boolean, remaining: number, resetIn: number }}
 */
async function rateLimit(ip, route, limit = 30, window = TTL.RATE_LIMIT_WINDOW) {
  const k = key.rateLimit(ip, route);
  try {
    const current = await redis.incr(k);
    if (current === 1) {
      // First request in this window — set expiry
      await redis.expire(k, window);
    }
    const ttl = await redis.ttl(k);
    return {
      allowed: current <= limit,
      remaining: Math.max(0, limit - current),
      resetIn: ttl,
      current,
    };
  } catch (err) {
    console.warn('[Redis] rateLimit error:', err.message);
    return { allowed: true, remaining: limit, resetIn: window }; // Fail open
  }
}

// ─── CHAT CONTEXT CACHE ───────────────────────────────────────────────────────

/**
 * Save recent conversation history so the chat API doesn't need to
 * reload from MongoDB on every single message in a session.
 */
async function setChatContext(sessionId, messages) {
  await set(key.chatCtx(sessionId), messages, TTL.CHAT_CONTEXT);
}

async function getChatContext(sessionId) {
  return get(key.chatCtx(sessionId));
}

async function clearChatContext(sessionId) {
  await del(key.chatCtx(sessionId));
}

// ─── ALERT COOLDOWN ───────────────────────────────────────────────────────────

/**
 * Mark an alert as "recently notified" so we don't spam the visitor.
 * Returns true if we can send (not in cooldown), false if we should skip.
 */
async function checkAndSetAlertCooldown(alertId) {
  const k = key.alertCooldown(alertId);
  try {
    const exists = await redis.exists(k);
    if (exists) return false; // In cooldown, do not send
    await redis.set(k, '1', 'EX', TTL.ALERT_COOLDOWN);
    return true;
  } catch (err) {
    return true; // Fail open — send the alert
  }
}

// ─── BUILDER CONFIG CACHE ─────────────────────────────────────────────────────

/**
 * Cache a builder's config object (brand name, tone, language, plan).
 * Avoids a MongoDB hit on every chat message.
 */
async function getBuilderConfig(builderId) {
  return get(key.builderCfg(builderId));
}

async function setBuilderConfig(builderId, config) {
  await set(key.builderCfg(builderId), config, TTL.BUILDER_CONFIG);
}

// ─── EXPRESS-SESSION STORE FACTORY ───────────────────────────────────────────

/**
 * Returns a connect-redis session store for use in server.js.
 *
 * Usage in server.js:
 *   const { createSessionStore } = require('./services/redisService');
 *   app.use(session({ store: createSessionStore(), secret: '...', resave: false }));
 */
function createSessionStore() {
  const { createClient } = require('redis');
  const { RedisStore } = require('connect-redis');

  // connect-redis needs a separate node-redis v4 client
  const sessionClient = createClient({
    socket: {
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: parseInt(process.env.REDIS_PORT || '6379'),
    },
    password: process.env.REDIS_PASSWORD || undefined,
  });
  sessionClient.connect().catch(console.error);

  return new RedisStore({ client: sessionClient, ttl: TTL.SESSION });
}

module.exports = {
  redis,          // Raw ioredis client for custom queries
  get,
  set,
  del,
  rateLimit,
  invalidateBuilder,
  setChatContext,
  getChatContext,
  clearChatContext,
  checkAndSetAlertCooldown,
  getBuilderConfig,
  setBuilderConfig,
  createSessionStore,
  TTL,
  key,
};