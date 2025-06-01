import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { jsonrepair } from 'jsonrepair';
import { isAuthorized } from '@/lib/utils';

// Define error interfaces for better type safety
interface ApiError extends Error {
  response?: {
    status: number;
    statusText: string;
    data: any;
  };
  code?: string;
}

// Define product interface
interface Product {
  productName: string;
  price: string;
  rating: string;
  businessName: string;
  description: string;
  reviewCount: string;
  url: string;
  imageUrl: string;
}

// Simple in-memory cache
const responseCache = new Map<string, {timestamp: number, products: Product[]}>();
const CACHE_TTL = 3600000; // 1 hour in milliseconds

export async function POST(req: NextRequest) {
  // Check if user is authenticated
  const authorized = await isAuthorized(req);
  if (!authorized) {
    return NextResponse.json({ 
      error: 'Yetkisiz erişim. Lütfen giriş yapın.' 
    }, { status: 401 });
  }

  try {
    const { url } = await req.json();

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    // Check cache
    const cacheKey = url;
    const cachedResponse = responseCache.get(cacheKey);
    
    // Use cache if valid
    if (cachedResponse && (Date.now() - cachedResponse.timestamp < CACHE_TTL)) {
      console.log(`Cache hit for URL: ${url}, returning cached result from ${new Date(cachedResponse.timestamp).toISOString()}`);
      
      return NextResponse.json({ 
        products: cachedResponse.products,
        fromCache: true,
        cachedAt: new Date(cachedResponse.timestamp).toISOString()
      });
    }
    
    console.log(`Cache miss for URL: ${url}, fetching new data...`);

    // Extract domain for context
    let domain = '';
    try {
      domain = new URL(url).hostname.replace('www.', '');
    } catch (error) {
      domain = 'unknown';
    }

    console.log(`Starting analysis for: ${domain}`);
    
    try {
      // Timing measurement
      const startTime = Date.now();
      
      // Fetch website content
      console.log(`[${new Date().toISOString()}] Fetching website content...`);
      const websiteContent = await fetchWebsiteContent(url);
      const fetchTime = Date.now() - startTime;
      console.log(`[${new Date().toISOString()}] Website content fetched in ${fetchTime}ms, size: ${websiteContent.length} bytes`);
      
      if (!websiteContent) {
        return NextResponse.json({ 
          error: 'Failed to fetch website content' 
        }, { status: 500 });
      }
      
      // Analyze with Gemini - use chunking for large content
      console.log(`[${new Date().toISOString()}] Starting Gemini analysis...`);
      const analysisStartTime = Date.now();
      
      // Extract product sections first to reduce content size
      const extractedContent = extractRelevantContent(websiteContent);
      console.log(`Extracted content size: ${extractedContent.length} bytes (reduced by ${Math.round((1 - extractedContent.length / websiteContent.length) * 100)}%)`);
      
      // Analyze the extracted content
      const products = await analyzeWithGemini(extractedContent, url, domain);
      
      const analysisTime = Date.now() - analysisStartTime;
      const totalTime = Date.now() - startTime;
      
      console.log(`[${new Date().toISOString()}] Gemini analysis completed in ${analysisTime}ms`);
      console.log(`Total processing time: ${totalTime}ms`);
      
      // Debug: Log the products response
      console.log("=== AI ANALYSIS RESULT ===");
      console.log(JSON.stringify(products, null, 2));
      console.log("=== END OF AI ANALYSIS ===");
      
      // Cache the result
      responseCache.set(cacheKey, {
        timestamp: Date.now(),
        products: products
      });
      
      // Create a formatted table for console output
      if (products && products.length > 0) {
        console.log("\nFormatted Table Output:");
        console.log("Görsel\tÜrün Adı\tFiyat\tİşletme\tPuan\tİnceleme Sayısı");
        products.forEach(product => {
          console.log(`${product.imageUrl ? 'Var' : 'Görsel yok'}\t${product.productName || 'N/A'}\t${product.price || 'N/A'}\t${product.businessName || 'N/A'}\t${product.rating || 'N/A'}\t${product.reviewCount || 'N/A'}`);
        });
      }
      
      return NextResponse.json({ 
        products,
        timing: {
          fetchTime,
          analysisTime,
          totalTime
        }
      });
    } catch (error) {
      console.error("Error in analysis process:", error);
      
      // Return a placeholder product if any part fails
      const fallbackProducts: Product[] = [{
        productName: "İçerik analiz edilemedi",
        price: "Bulunamadı",
        rating: "",
        businessName: domain,
        description: `Analiz hatası: ${error instanceof Error ? error.message : 'Bilinmeyen hata'}`,
        reviewCount: "",
        url: url,
        imageUrl: ""
      }];
      
      // Log the fallback product
      console.log("=== FALLBACK RESULT ===");
      console.log("Görsel\tÜrün Adı\tFiyat\tİşletme\tPuan\tİnceleme Sayısı");
      console.log(`Görsel yok\t${fallbackProducts[0].productName}\t${fallbackProducts[0].price}\t${domain}\t\tN/A`);
      
      return NextResponse.json({ 
        products: fallbackProducts,
        error: "API analiz hatası",
        errorDetails: error instanceof Error ? error.message : "Unknown error"
      });
    }
  } catch (error) {
    console.error('Error processing request:', error);
    return NextResponse.json({ 
      error: 'Failed to analyze products' 
    }, { status: 500 });
  }
}

// Function to fetch website content with reduced timeout
async function fetchWebsiteContent(url: string): Promise<string> {
  try {
    // Reduced HTTP request headers
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7'
    };

    // No HEAD request to save time
    const response = await axios.get(url, {
      headers,
      timeout: 8000, // Reduced timeout for Netlify
      maxRedirects: 3,
      validateStatus: function (status) {
        return status < 500;
      }
    });

    // If 403 Forbidden or other error
    if (response.status !== 200) {
      console.log(`Received ${response.status} response from ${url}`);
      return `<html><body><h1>${response.status} - Could not access content</h1><p>URL: ${url}</p></body></html>`;
    }

    console.log(`Fetched content size: ${response.data.length} bytes`);
    return response.data;
  } catch (error) {
    const fetchError = error as ApiError;
    console.error('Error fetching website:', fetchError.message);
    return `<html><body><h1>Error Fetching Content</h1><p>Could not retrieve content from ${url}</p></body></html>`;
  }
}

// Function to extract only relevant parts of HTML to reduce size
function extractRelevantContent(html: string): string {
  // Max size for HTML to send to API - increased to capture more content including recommended products
  const MAX_SIZE = 50000;
  
  // First, try to extract just the body content
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch && bodyMatch[1]) {
    const bodyContent = bodyMatch[1];
    console.log(`Extracted body content: ${bodyContent.length} bytes`);
    
    // Boyut limiti daha yüksek - daha fazla içerik göndermek için
    if (bodyContent.length > MAX_SIZE) {
      console.log(`Body content too large, extracting first ${MAX_SIZE} bytes`);
      return bodyContent.substring(0, MAX_SIZE);
    } else {
      return bodyContent;
    }
  }
  
  // Body bulunamazsa, orijinal HTML'in başlangıç kısmını kullan
  console.log(`Could not find body tag, using original HTML`);
  return html.substring(0, MAX_SIZE);
}

// Optimized Gemini analysis function
async function analyzeWithGemini(html: string, url: string, domain: string): Promise<Product[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not defined');
  }
  
  try {
    // Comprehensive prompt to extract all products including recommended ones
    const prompt = `
Bu e-ticaret sayfasındaki TÜM ürünleri analiz et ve bilgilerini çıkart.

Bu bir ${domain} sayfasıdır.

ANA ÜRÜN ve "Benzer Ürünler", "Bunlar da İlginizi Çekebilir", "Önerilen Ürünler", "Bu Ürünü Alanlar Bunu da Aldı" gibi bölümlerdeki TÜM ürünleri ayrı ayrı listele.

Lütfen aşağıdaki JSON formatında cevap ver:
[
  {
    "productName": "Ürünün tam adı",
    "price": "Ürünün fiyatı (TL, ₺, $ vb. ile birlikte)",
    "rating": "Ürün değerlendirme puanı (5 üzerinden)",
    "businessName": "${domain}",
    "description": "Ürünün kısa açıklaması veya özellikleri",
    "reviewCount": "Değerlendirme/yorum sayısı",
    "url": "Ürünün tam URL'si (veya ana ürün için: ${url})",
    "imageUrl": "Ürün resminin URL'si",
    "isMainProduct": "(true/false) Ana ürün mü yoksa önerilen/benzer ürün mü"
  },
  {
    // İkinci ürün
  },
  // vb. sayfadaki tüm ürünler için
]

ÖNEMLİ: Sayfada bulunan TÜM ürünleri listele, hiçbir ürünü atlama. 
Her bir ürün için yukarıdaki tüm alanları doldurmaya çalış.
Ürün açıklaması ve özelliklerini kısa tut (1-2 cümle).
Fiyat bilgisini tam olarak bul (indirimli fiyat varsa onu kullan).
Ürün puanını 5 üzerinden değerlendirme şeklinde ver.
Ürün URL'si yoksa, yalnızca ana ürün için mevcut URL'yi kullan.

Aşağıdaki HTML içeriğini analiz et:
${html}`;

    // Request payload - simplified to minimize processing time
    const requestPayload = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0,
        maxOutputTokens: 2048,
        responseMimeType: "application/json"
      }
    };
    
    // Use the Gemini 1.5 Flash model
    const model = "gemini-1.5-flash";
    
    console.log(`[${new Date().toISOString()}] Calling Gemini API with HTML size: ${html.length} bytes...`);
    
    try {
      // Use a shorter timeout
      const response = await axios({
        method: 'post',
        url: `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        data: requestPayload,
        headers: { 'Content-Type': 'application/json' },
        timeout: 25000 // 25 seconds timeout for complex pages
      });
      
      console.log(`[${new Date().toISOString()}] Gemini API responded with status: ${response.status}`);
      
      if (!response.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
        console.error("Invalid API response structure:", JSON.stringify(response.data, null, 2));
        // Boş ürün dizisi döndür
        return [];
      }
      
      const responseText = response.data.candidates[0].content.parts[0].text.trim();
      
      // Handle empty array - doğrudan boş dizi döndür
      if (responseText === '[]' || responseText === '[ ]') {
        console.log("API returned empty array, no products found");
        return [];
      }
      
      try {
        // Try to repair and parse JSON
        const repairedJson = jsonrepair(responseText);
        const parsedProducts = JSON.parse(repairedJson);
        
        if (Array.isArray(parsedProducts)) {
          console.log(`Successfully parsed ${parsedProducts.length} products from API response`);
          return parsedProducts;
        }
        
        console.log("No products found in parsed response");
        // Boş dizi döndür
        return [];
      } catch (error) {
        console.error("JSON parsing error:", error);
        console.error("Response text:", responseText.substring(0, 200) + "...");
        
        // JSON parse edilemezse, ham metni ürün olarak döndür
        return [{
          productName: "Yapay Zeka Ham Çıktısı",
          price: "",
          rating: "",
          businessName: domain,
          description: responseText.substring(0, 500), // İlk 500 karakteri açıklama olarak kullan
          reviewCount: "",
          url: url,
          imageUrl: ""
        }];
      }
    } catch (apiError) {
      const error = apiError as ApiError;
      console.error("Gemini API request failed:", error.message);
      
      // For timeout errors, try fallback extraction
      if (error.code === 'ECONNABORTED') {
        console.log("API timeout - attempting to extract product information directly from HTML...");
        return extractProductsFromHtml(html, url, domain);
      }
      
      if (error.response) {
        console.error("API Error Status:", error.response.status);
        console.error("API Error Data:", JSON.stringify(error.response.data || {}, null, 2));
      }
      
      throw new Error(`Gemini API error: ${error.message}`);
    }
  } catch (error) {
    console.error("Error in Gemini processing:", error);
    throw error;
  }
}

// Fallback function with direct HTML parsing for timeout situations
function extractProductsFromHtml(html: string, url: string, domain: string): Product[] {
  console.log("Using improved fallback extraction...");
  
  try {
    // URL'den ürün adını çıkarmaya çalış
    let productName = "";
    try {
      const urlParts = url.split('/');
      const lastPart = urlParts[urlParts.length - 1];
      
      // URL'den ürün adını çıkar (özellikle akakce.com için)
      if (lastPart.includes('.html')) {
        const namePart = lastPart.split('.html')[0];
        if (namePart.includes(',')) {
          const productPart = namePart.split(',')[0];
          productName = productPart
            .replace(/-/g, ' ')
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
        }
      }
    } catch (e) {
      console.error("Error extracting product name from URL:", e);
    }
    
    // Eğer URL'den ürün adı çıkarılamazsa, alan adını kullan
    if (!productName) {
      productName = `${domain} Ürünü`;
    }
    
    const product: Product = {
      productName: productName,
      price: "Zaman aşımı nedeniyle belirlenemedi",
      rating: "",
      businessName: domain,
      description: "Yapay zeka analiz süresi aşıldı. URL ve sayfa başlığından ürün bilgileri çıkarıldı.",
      reviewCount: "",
      url: url,
      imageUrl: ""
    };
    
    console.log("Returning improved fallback product with name from URL");
    return [product];
  } catch (error) {
    console.error("Error in fallback extraction:", error);
    
    // Herhangi bir hata durumunda basit yanıt
    const product: Product = {
      productName: "API zaman aşımı",
      price: "",
      rating: "",
      businessName: domain,
      description: "Yapay zeka yanıt vermedi, lütfen daha sonra tekrar deneyin.",
      reviewCount: "",
      url: url,
      imageUrl: ""
    };
    
    console.log("Returning simple fallback product due to error");
    return [product];
  }
}