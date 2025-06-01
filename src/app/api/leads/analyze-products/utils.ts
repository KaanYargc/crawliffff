// utils.ts - JSON işleme ve yardımcı işlevler
import { jsonrepair } from 'jsonrepair';
import { Product, CacheRow } from '@/app/api/leads/analyze-products/types';
import better_sqlite3 from 'better-sqlite3';
import path from 'path';

// Cache duration in milliseconds (1 hour)
export const CACHE_TTL = 3600000;

// Initialize SQLite database for caching
const db = better_sqlite3(path.join(process.cwd(), 'data/crawlify.db'));

// Create cache table if it doesn't exist
db.exec(`
  CREATE TABLE IF NOT EXISTS cache (
    key TEXT PRIMARY KEY,
    value TEXT,
    timestamp INTEGER
  )
`);

// Helper function to get cached data
export function getCachedData(key: string): { products: Product[], timestamp: number } | null {
  const row = db.prepare('SELECT value, timestamp FROM cache WHERE key = ?').get(key) as CacheRow;
  if (!row) return null;
  
  try {
    return {
      products: JSON.parse(row.value),
      timestamp: row.timestamp
    };
  } catch (error) {
    console.error('Error parsing cached data:', error);
    return null;
  }
}

// Helper function to set cached data
export function setCachedData(key: string, products: Product[]): void {
  const timestamp = Date.now();
  const stmt = db.prepare('INSERT OR REPLACE INTO cache (key, value, timestamp) VALUES (?, ?, ?)');
  stmt.run(key, JSON.stringify(products), timestamp);
}

// Helper function to clean old cache entries
export function cleanOldCache(): void {
  const expiryTime = Date.now() - CACHE_TTL;
  db.prepare('DELETE FROM cache WHERE timestamp < ?').run(expiryTime);
}

// Try to correctly extract JSON from any text format the API returns
export function extractValidJson(responseText: string): any {
  console.log("==== ATTEMPTING TO EXTRACT VALID JSON ====");
  
  // First, clean up the response text
  let cleanedText = responseText
    .replace(/```json|```/g, '') // Remove code block markers
    .trim();
    
  console.log("Cleaned response text:", cleanedText.substring(0, 100) + "...");
  
  // Try direct parsing first (in case it's already valid JSON)
  try {
    const parsed = JSON.parse(cleanedText);
    console.log("Direct parsing successful");
    return parsed;
  } catch (e: any) {
    console.log("Direct parsing failed:", e.message);
  }
  
  // Try to find a JSON array
  const arrayMatch = cleanedText.match(/\[\s*{[\s\S]*}\s*\]/);
  if (arrayMatch) {
    try {
      const parsed = JSON.parse(arrayMatch[0]);
      console.log("Array extraction successful");
      return parsed;
    } catch (e: any) {
      console.log("Array extraction failed:", e.message);
    }
  }
  
  // Try to find individual product objects
  const objMatches = cleanedText.match(/{\s*"productName"[\s\S]*?}/g);
  if (objMatches && objMatches.length > 0) {
    try {
      const objects = [];
      for (const match of objMatches) {
        try {
          objects.push(JSON.parse(match));
        } catch (e) {
          // Skip invalid objects
        }
      }
      
      if (objects.length > 0) {
        console.log(`Found ${objects.length} valid product objects`);
        return objects;
      }
    } catch (e: any) {
      console.log("Object extraction failed:", e.message);
    }
  }
  
  // Try with jsonrepair
  try {
    const repaired = jsonrepair(cleanedText);
    const parsed = JSON.parse(repaired);
    console.log("JSON repair successful");
    return parsed;
  } catch (e: any) {
    console.log("JSON repair failed:", e.message);
  }
  
  // Last resort: Look for key-value pairs and construct objects
  try {
    const keyValuePairs = cleanedText.match(/"([^"]+)":\s*"([^"]+)"/g);
    if (keyValuePairs && keyValuePairs.length > 0) {
      const obj: Record<string, string> = {};
      keyValuePairs.forEach(pair => {
        const match = pair.match(/"([^"]+)":\s*"([^"]+)"/);
        if (match) {
          obj[match[1]] = match[2];
        }
      });
      
      if ('productName' in obj) {
        console.log("Created object from key-value pairs");
        return [obj];
      }
    }
  } catch (e: any) {
    console.log("Key-value extraction failed:", e.message);
  }
  
  console.log("All JSON extraction methods failed");
  return null;
}

// Simple in-memory cache
export const responseCache = new Map<string, {timestamp: number, products: Product[]}>();

// Session cookie cache to reuse successful sessions
export const cookieCache = new Map<string, {timestamp: number, cookies: any[], localStorage: Record<string, string>}>();
export const COOKIE_TTL = 86400000; // 24 hours

// Create a fallback product for error cases
export function createFallbackProduct(domain: string, url: string, errorMessage: string): Product {
  return {
    productName: "İçerik analiz edilemedi",
    price: "Bulunamadı",
    rating: "",
    businessName: domain,
    description: `Analiz hatası: ${errorMessage}`,
    reviewCount: "",
    url: url,
    imageUrl: ""
  };
}

// Generate a Gemini prompt for product extraction
export function generateGeminiPrompt(html: string, url: string, domain: string): string {
  return `
Bu HTML içeriğini analiz et ve içindeki ürünleri JSON olarak döndür:

${html}

Yanıtını sadece JSON formatında ver, başka açıklama ekleme:
[
  {
    "productName": "Ürünün tam adı",
    "price": "Ürünün fiyatı",
    "rating": "Ürün puanı",
    "businessName": "${domain}",
    "description": "Ürün açıklaması",
    "reviewCount": "Yorum sayısı",
    "url": "${url}",
    "imageUrl": "Resim URL'si"
  }
]
`;
}

// Helper function to validate products array
export function validateProducts(products: any[], domain: string, url: string): Product[] {
  if (!Array.isArray(products)) {
    return [{
      productName: "Geçersiz veri formatı",
      price: "",
      rating: "",
      businessName: domain,
      description: "API'den geçersiz veri formatı alındı.",
      reviewCount: "",
      url: url,
      imageUrl: ""
    }];
  }

  if (products.length === 0) {
    return [{
      productName: "Bu sayfada ürün bulunamadı",
      price: "",
      rating: "",
      businessName: domain,
      description: "Bu URL'de listelenmiş ürün bulunamadı. Lütfen başka bir sayfa deneyin.",
      reviewCount: "",
      url: url,
      imageUrl: ""
    }];
  }

  // Validate and clean each product
  return products.map(product => ({
    productName: String(product.productName || "Ürün Adı Bulunamadı"),
    price: String(product.price || ""),
    rating: String(product.rating || ""),
    businessName: String(product.businessName || domain),
    description: String(product.description || ""),
    reviewCount: String(product.reviewCount || ""),
    url: String(product.url || url),
    imageUrl: String(product.imageUrl || "")
  }));
}