import { createClient } from "redis";
import { REDIS_URL } from "../config.js";

let redis;
const useMemory = REDIS_URL === "memory" || process.env.NODE_ENV === "test";
if (useMemory) {
  const store = new Map();
  redis = {
    isOpen: true,
    async connect() {},
    async set(key, value, opts) { store.set(key, value); if (opts?.EX) setTimeout(() => store.delete(key), opts.EX * 1000); },
    async get(key) { return store.get(key) || null; },
    async del(key) { store.delete(key); },
    async incr(key) {
      const cur = parseInt(store.get(key) || "0", 10);
      const next = Number.isFinite(cur) ? cur + 1 : 1;
      store.set(key, String(next));
      return next;
    },
  };
} else {
  redis = createClient({
    url: REDIS_URL,
  });
}

export async function connectRedis() {
  try {
    if (!redis.isOpen) {
      await redis.connect();
    }
  } catch (e) {
    const store = new Map();
    redis = {
      isOpen: true,
      async connect() {},
      async set(key, value, opts) { store.set(key, value); if (opts?.EX) setTimeout(() => store.delete(key), opts.EX * 1000); },
      async get(key) { return store.get(key) || null; },
      async del(key) { store.delete(key); },
      async incr(key) {
        const cur = parseInt(store.get(key) || "0", 10);
        const next = Number.isFinite(cur) ? cur + 1 : 1;
        store.set(key, String(next));
        return next;
      },
    };
  }
}

export { redis };
