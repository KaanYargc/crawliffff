// route.ts - Ana API rotası
import { NextRequest, NextResponse } from 'next/server';
import { isAuthorized } from '@/lib/utils';
import { isCloudflareHtml, detectAndHandleCloudflareChallenges } from './cloudflare-handler';
import { extractProductsFromHtml, getBodyContent } from './product-extractor';
import { extractValidJson, getCachedData, setCachedData, cleanOldCache, validateProducts } from './utils';
import { ApiError, Product } from './types';
import { fetchWebsiteContent } from './browser-simulator';

// Maximum number of retries for Cloudflare challenges
const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 2000; // Start with 2 second delay

async function fetchWithRetry(url: string, domain: string, attempt: number = 1): Promise<{ content: string; wasRetry?: boolean }> {
  try {
    const { content } = await fetchWebsiteContent(url);
    
    if (!content) {
      throw new Error('Empty content received');
    }

    if (isCloudflareHtml(content, domain)) {
      if (attempt >= MAX_RETRIES) {
        throw new Error(`Maximum retries (${MAX_RETRIES}) reached`);
      }

      // Calculate exponential backoff delay
      const backoffDelay = INITIAL_BACKOFF_MS * Math.pow(2, attempt - 1);
      console.log(`Cloudflare challenge detected, attempt ${attempt}/${MAX_RETRIES}. Waiting ${backoffDelay}ms before retry...`);
      
      // Wait for backoff period
      await new Promise(resolve => setTimeout(resolve, backoffDelay));
      
      // Recursive retry with incremented attempt counter
      return fetchWithRetry(url, domain, attempt + 1);
    }

    return { content, wasRetry: attempt > 1 };
  } catch (error) {
    if (attempt < MAX_RETRIES) {
      const backoffDelay = INITIAL_BACKOFF_MS * Math.pow(2, attempt - 1);
      console.log(`Fetch failed on attempt ${attempt}/${MAX_RETRIES}, retrying in ${backoffDelay}ms...`);
      await new Promise(resolve => setTimeout(resolve, backoffDelay));
      return fetchWithRetry(url, domain, attempt + 1);
    }
    throw error;
  }
}

export async function POST(req: NextRequest) {
  // Clean old cache entries periodically
  cleanOldCache();

  // Check if user is authenticated
  const authorized = await isAuthorized(req);
  if (!authorized) {
    return NextResponse.json({ 
      error: 'Yetkisiz erişim. Lütfen giriş yapın.' 
    }, { status: 401 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('GEMINI_API_KEY environment variable is not defined');
    return NextResponse.json({ 
      error: 'API key configuration error' 
    }, { status: 500 });
  }

  try {
    const { url } = await req.json();
    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    // Check cache
    const cachedData = getCachedData(url);
    
    // Use cache if valid and not expired
    if (cachedData && (Date.now() - cachedData.timestamp < 3600000)) {
      console.log(`Cache hit for URL: ${url}, returning cached result from ${new Date(cachedData.timestamp).toISOString()}`);
      return NextResponse.json({ 
        products: cachedData.products,
        fromCache: true,
        cachedAt: new Date(cachedData.timestamp).toISOString()
      });
    }
    
    console.log(`Cache miss for URL: ${url}, fetching new data...`);

    // Extract domain for context
    const domain = new URL(url).hostname.replace('www.', '');
    console.log(`Starting analysis for: ${domain}`);

    // Fetch website content with retry mechanism
    try {
      const { content, wasRetry } = await fetchWithRetry(url, domain);
      
      // If we got here after retries, proceed with content processing
      const bodyContent = getBodyContent(content);
      console.log(`Got body content, size: ${bodyContent.length} bytes`);

      // Prepare prompt with only body content
      const prompt = `Bu HTML içeriğini analiz et ve içindeki ürünleri JSON olarak döndür:\n\n${bodyContent}\n\nYanıtını sadece JSON formatında ver, başka açıklama ekleme:\n[
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
      ]`;

      console.log('==== GEMİNİ\'YE GÖNDERİLEN PROMPT ====\n\n' + prompt + '\n\n==== PROMPT SONU ====');

      try {
        const response = await fetch('https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey
          },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.1,
              topK: 32,
              topP: 0.9,
              maxOutputTokens: 8192
            }
          })
        });

        if (!response.ok) {
          throw new Error(`API request failed with status ${response.status}`);
        }

        const data = await response.json();
        if (!data?.candidates?.[0]?.content?.parts?.[0]?.text) {
          throw new Error('Invalid API response structure');
        }

        const responseText = data.candidates[0].content.parts[0].text.trim();
        console.log("Raw API response:", responseText.substring(0, 100) + "...");

        // Handle empty response
        if (!responseText || responseText === '[]' || responseText === '[ ]') {
          const emptyProducts: Product[] = [];
          setCachedData(url, emptyProducts);
          return NextResponse.json({ products: emptyProducts });
        }

        // Extract and validate products
        const extractedProducts = extractValidJson(responseText);
        if (extractedProducts && Array.isArray(extractedProducts)) {
          const validatedProducts = validateProducts(extractedProducts, domain, url);
          setCachedData(url, validatedProducts);
          return NextResponse.json({ products: validatedProducts });
        }

        // Fallback to direct HTML extraction if JSON parsing fails
        console.log('Attempting direct HTML extraction...');
        const directProducts = await extractProductsFromHtml(content, url, domain);
        setCachedData(url, directProducts);
        return NextResponse.json({ 
          products: directProducts,
          directExtraction: true 
        });

      } catch (error) {
        console.error('API or extraction error:', error);
        const fallbackProducts = [{
          productName: "İşlem Hatası",
          price: "",
          rating: "",
          businessName: domain,
          description: `Hata: ${error instanceof Error ? error.message : 'Bilinmeyen hata'}`,
          reviewCount: "",
          url: url,
          imageUrl: ""
        }];

        return NextResponse.json({ 
          products: fallbackProducts,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    } catch (error) {
      // Special handling for Cloudflare errors after retries
      if (error instanceof Error && error.message.includes('Maximum retries')) {
        return NextResponse.json({
          products: [{
            productName: "Site Cloudflare Korumalı",
            price: "",
            rating: "",
            businessName: domain,
            description: "Bu site Cloudflare tarafından korunuyor ve 3 denemeye rağmen içeriğe erişilemedi. Lütfen birkaç dakika bekleyip tekrar deneyin.",
            reviewCount: "",
            url: url,
            imageUrl: ""
          }],
          error: "Cloudflare protection could not be bypassed after maximum retries",
          retryAttempts: MAX_RETRIES
        });
      }

      console.error('Request processing error:', error);
      return NextResponse.json({ 
        error: 'Failed to process request',
        message: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Request processing error:', error);
    return NextResponse.json({ 
      error: 'Failed to process request',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}