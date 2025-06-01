// cache-manager.ts - Website content caching system
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

interface CacheEntry {
  url: string;
  content: string;
  timestamp: number;
  domain: string;
}

interface CacheOptions {
  ttl?: number; // Time-to-live in milliseconds (default: 24 hours)
  maxEntries?: number; // Maximum number of entries to keep in memory cache
  persistToDisk?: boolean; // Whether to persist cache to disk
  cacheDir?: string; // Directory to store cache files
}

class WebsiteCache {
  private cache: Map<string, CacheEntry>;
  private options: Required<CacheOptions>;
  private cacheDir: string;

  constructor(options: CacheOptions = {}) {
    this.cache = new Map<string, CacheEntry>();
    
    // Default options
    this.options = {
      ttl: 24 * 60 * 60 * 1000, // 24 hours by default
      maxEntries: 100,
      persistToDisk: true,
      cacheDir: path.join(process.cwd(), 'data', 'cache'),
      ...options
    };

    this.cacheDir = this.options.cacheDir;
    
    // Create cache directory if it doesn't exist and persistence is enabled
    if (this.options.persistToDisk) {
      this.ensureCacheDir();
      this.loadCacheFromDisk();
    }
  }

  // Generate a hash key for a URL
  private generateKey(url: string): string {
    return crypto.createHash('md5').update(url).digest('hex');
  }

  // Ensure the cache directory exists
  private ensureCacheDir(): void {
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  // Get cache file path for a key
  private getCacheFilePath(key: string): string {
    return path.join(this.cacheDir, `${key}.json`);
  }

  // Load cache from disk when initializing
  private loadCacheFromDisk(): void {
    try {
      if (!fs.existsSync(this.cacheDir)) return;

      const files = fs.readdirSync(this.cacheDir);
      
      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        
        try {
          const filePath = path.join(this.cacheDir, file);
          const content = fs.readFileSync(filePath, 'utf-8');
          const entry = JSON.parse(content) as CacheEntry;
          
          // Only load if not expired
          if (Date.now() - entry.timestamp <= this.options.ttl) {
            const key = file.replace('.json', '');
            this.cache.set(key, entry);
          } else {
            // Delete expired cache files
            fs.unlinkSync(filePath);
          }
        } catch (error) {
          console.error(`Error loading cache file ${file}:`, error);
        }
      }
      
      console.log(`Loaded ${this.cache.size} items from cache`);
    } catch (error) {
      console.error('Error loading cache from disk:', error);
    }
  }

  // Save a cache entry to disk
  private saveToDisk(key: string, entry: CacheEntry): void {
    try {
      if (!this.options.persistToDisk) return;
      
      this.ensureCacheDir();
      const filePath = this.getCacheFilePath(key);
      fs.writeFileSync(filePath, JSON.stringify(entry), 'utf-8');
    } catch (error) {
      console.error('Error saving cache to disk:', error);
    }
  }

  // Get content from cache
  get(url: string): string | null {
    const key = this.generateKey(url);
    const entry = this.cache.get(key);
    
    if (!entry) return null;
    
    // Check if the entry is expired
    if (Date.now() - entry.timestamp > this.options.ttl) {
      this.cache.delete(key);
      if (this.options.persistToDisk) {
        const filePath = this.getCacheFilePath(key);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
      return null;
    }
    
    console.log(`Cache hit for ${url} (age: ${Math.round((Date.now() - entry.timestamp) / 1000 / 60)} minutes)`);
    return entry.content;
  }

  // Store content in cache
  set(url: string, content: string, domain: string): void {
    if (!content || content.length < 100) {
      console.log(`Not caching empty or too small content for ${url}`);
      return;
    }
    
    const key = this.generateKey(url);
    const entry: CacheEntry = {
      url,
      content,
      timestamp: Date.now(),
      domain
    };
    
    // Enforce max entries limit
    if (this.cache.size >= this.options.maxEntries) {
      // Remove the oldest entry
      let oldestKey: string | null = null;
      let oldestTimestamp = Infinity;
      
      for (const [entryKey, cacheEntry] of this.cache.entries()) {
        if (cacheEntry.timestamp < oldestTimestamp) {
          oldestTimestamp = cacheEntry.timestamp;
          oldestKey = entryKey;
        }
      }
      
      if (oldestKey) {
        this.cache.delete(oldestKey);
        if (this.options.persistToDisk) {
          const filePath = this.getCacheFilePath(oldestKey);
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        }
      }
    }
    
    this.cache.set(key, entry);
    console.log(`Cached content for ${url} (${Math.round(content.length / 1024)} KB)`);
    
    if (this.options.persistToDisk) {
      this.saveToDisk(key, entry);
    }
  }

  // Check if URL is in cache and not expired
  has(url: string): boolean {
    const cachedContent = this.get(url);
    return cachedContent !== null;
  }

  // Remove an entry from cache
  delete(url: string): boolean {
    const key = this.generateKey(url);
    const deleted = this.cache.delete(key);
    
    if (deleted && this.options.persistToDisk) {
      const filePath = this.getCacheFilePath(key);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
    
    return deleted;
  }

  // Clear all cache
  clear(): void {
    this.cache.clear();
    
    if (this.options.persistToDisk && fs.existsSync(this.cacheDir)) {
      const files = fs.readdirSync(this.cacheDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          fs.unlinkSync(path.join(this.cacheDir, file));
        }
      }
    }
  }

  // Get cache statistics
  getStats(): { size: number; domains: Record<string, number> } {
    const domains: Record<string, number> = {};
    
    for (const entry of this.cache.values()) {
      domains[entry.domain] = (domains[entry.domain] || 0) + 1;
    }
    
    return {
      size: this.cache.size,
      domains
    };
  }
}

// Create a singleton instance
export const websiteCache = new WebsiteCache({
  ttl: 12 * 60 * 60 * 1000, // 12 hours
  maxEntries: 500,
  persistToDisk: true
});

export default websiteCache;