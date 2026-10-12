/**
 * Simple in-memory cache implementation
 * For production, use Redis for distributed caching
 */

class Cache {
  constructor() {
    this.cache = new Map();
    this.defaultTTL = 300; // 5 minutes default
  }

  /**
   * Get value from cache
   */
  get(key) {
    const item = this.cache.get(key);
    
    if (!item) {
      return null;
    }

    // Check if expired
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }

    return item.value;
  }

  /**
   * Set value in cache
   */
  set(key, value, ttl = this.defaultTTL) {
    const expiry = Date.now() + (ttl * 1000);
    this.cache.set(key, { value, expiry });
  }

  /**
   * Delete value from cache
   */
  delete(key) {
    return this.cache.delete(key);
  }

  /**
   * Clear all cache
   */
  clear() {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }

  /**
   * Clean expired entries
   */
  cleanExpired() {
    const now = Date.now();
    for (const [key, item] of this.cache.entries()) {
      if (now > item.expiry) {
        this.cache.delete(key);
      }
    }
  }
}

// Create singleton instance
const cache = new Cache();

// Clean expired entries every 5 minutes
setInterval(() => {
  cache.cleanExpired();
}, 5 * 60 * 1000);

/**
 * Cache middleware for Express routes
 */
const cacheMiddleware = (ttl = 300) => {
  return (req, res, next) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    const key = `cache:${req.originalUrl}:${JSON.stringify(req.query)}`;
    const cached = cache.get(key);

    if (cached) {
      return res.json(cached);
    }

    // Store original json method
    const originalJson = res.json.bind(res);

    // Override json method to cache response
    res.json = function(data) {
      // Only cache successful responses
      if (res.statusCode === 200) {
        cache.set(key, data, ttl);
      }
      return originalJson(data);
    };

    next();
  };
};

module.exports = {
  cache,
  cacheMiddleware
};

