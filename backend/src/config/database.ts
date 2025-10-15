import { Pool, PoolConfig } from 'pg';
import { createClient } from 'redis';
import dotenv from 'dotenv';
import { logger } from '../utils/logger';

dotenv.config();

// PostgreSQL Configuration
const poolConfig: PoolConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'clubrrrr',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  max: 20, // Maximum number of clients
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};

export const pool = new Pool(poolConfig);

// Test database connection
pool.on('connect', () => {
  logger.info('✅ Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  logger.error('❌ Unexpected error on idle client', err);
  process.exit(-1);
});

// Redis Configuration
export const redisClient = createClient({
  socket: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379')
  },
  password: process.env.REDIS_PASSWORD || undefined
});

redisClient.on('error', (err) => {
  logger.error('Redis Client Error', err);
});

redisClient.on('connect', () => {
  logger.info('✅ Connected to Redis');
});

// Connect to Redis
(async () => {
  try {
    await redisClient.connect();
  } catch (error) {
    logger.error('Failed to connect to Redis:', error);
  }
})();

// Helper function to query database
export const query = async (text: string, params?: any[]) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    logger.debug('Executed query', { text, duration, rows: res.rowCount });
    return res;
  } catch (error) {
    logger.error('Database query error:', error);
    throw error;
  }
};

// Helper function to get a client from pool for transactions
export const getClient = async () => {
  const client = await pool.connect();
  return client;
};

// Cache helpers
export const cache = {
  get: async (key: string) => {
    try {
      return await redisClient.get(key);
    } catch (error) {
      logger.error(`Cache GET error for key ${key}:`, error);
      return null;
    }
  },
  
  set: async (key: string, value: string, expireSeconds?: number) => {
    try {
      if (expireSeconds) {
        await redisClient.setEx(key, expireSeconds, value);
      } else {
        await redisClient.set(key, value);
      }
    } catch (error) {
      logger.error(`Cache SET error for key ${key}:`, error);
    }
  },
  
  del: async (key: string) => {
    try {
      await redisClient.del(key);
    } catch (error) {
      logger.error(`Cache DEL error for key ${key}:`, error);
    }
  },
  
  flush: async () => {
    try {
      await redisClient.flushAll();
    } catch (error) {
      logger.error('Cache FLUSH error:', error);
    }
  }
};

export default { pool, redisClient, query, getClient, cache };
