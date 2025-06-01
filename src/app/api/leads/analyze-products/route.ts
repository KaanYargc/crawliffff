// route.ts - Ana API rotası
import { NextRequest, NextResponse } from 'next/server';
import { isAuthorized } from '@/lib/utils';
import { fetchWebsiteContent } from './browser-simulator';
import { extractProductsFromHtml, isValidProductData } from './product-extractor';
import { bypassCloudflare, isCloudflareHtml, hasCloudfareCaptcha, validatePostCloudflareContent } from './cloudflare-handler';
import { getSiteConfig, isSiteSupported, handleLieferando } from './site-handlers';
import { extractDomainFromUrl } from './utils';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize the Google Generative AI client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 2000;

// Cache for storing scraped data
const cache = new Map<string, { timestamp: number; products: any[] }>();

// Clean old cache entries
function cleanOldCache() {
  const now = Date.now();
  for (const [url, data] of cache.entries()) {
    if (now - data.timestamp > 3600000) { // 1 hour
      cache.delete(url);
    }
  }
}

// Get cached data for a URL
function getCachedData(url: string) {
  return cache.get(url);
}

// Cache the scraped data
function cacheData(url: string, products: any[]) {
  cache.set(url, {
    timestamp: Date.now(),
    products
  });
}

async function fetchWithRetry(url: string, domain: string, attempt: number = 1): Promise<{ content: string; wasRetry?: boolean; usedRealBrowser?: boolean }> {
  try {
    const siteConfig = getSiteConfig(url);
    
    // For lieferando.de and other sites with known Cloudflare protection,
    // go directly to manual CAPTCHA solving first
    if (domain === 'lieferando.de' || siteConfig?.requiresCloudflareBypass) {
      console.log(`Detected known Cloudflare-protected site (${domain}), trying manual CAPTCHA solving first...`);
      try {
        console.log('Opening browser window for manual CAPTCHA solving...');
        const manualContent = await bypassCloudflare(url, domain);
        
        if (manualContent && manualContent.length > 5000) {
          console.log('Successfully retrieved content after manual CAPTCHA solving');
          // Return the content from manual solving directly, without further validation
          return { 
            content: manualContent, 
            wasRetry: false,
            usedRealBrowser: true
          };
        } else {
          console.log('Manual CAPTCHA solving failed, falling back to automated methods');
        }
      } catch (error) {
        console.log('Error during manual CAPTCHA solving:', error);
      }
    }
    
    // Standard approach - try normal request first if manual solving failed or for other domains
    const { content: initialContent } = await fetchWebsiteContent(url);
    
    // İçerik yoksa hata fırlat
    if (!initialContent) {
      throw new Error('Empty content received from initial request');
    }
    
    // Debug bilgisi olarak log'a yaz
    console.log(`[DEBUG] Domain: ${domain}`);
    console.log(`[DEBUG] Content Length: ${initialContent.length}`);

    // ÖNEMLİ: İlk CAPTCHA kontrolü - çok daha sıkı kontrol
    // Bilinen CAPTCHA gerektirecek özel siteler listesi
    const knownCaptchaSites = ['lieferando.de'];
    const isCaptchaSite = knownCaptchaSites.includes(domain);
    
    // Kesin CAPTCHA belirteçleri
    const definitiveCaptchaMarkers = [
      '<input type="hidden" name="cf-turnstile-response"',
      'id="cf-chl-widget-',
      'challenges.cloudflare.com/turnstile/v0/api.js',
      '<title>Just a moment...</title>',
      'Please complete the security check to access'
    ];
    
    // Kesin belirteçleri kontrol et
    const lowerHtml = initialContent.toLowerCase();
    let foundDefinitiveMarker = false;
    let foundMarker = '';
    
    for (const marker of definitiveCaptchaMarkers) {
      if (lowerHtml.includes(marker.toLowerCase())) {
        foundDefinitiveMarker = true;
        foundMarker = marker;
        break;
      }
    }
    
    // CAPTCHA sayfası olup olmadığına karar ver
    const isTooSmallContent = initialContent.length < 15000; // Tipik CAPTCHA sayfaları küçüktür
    const hasCaptcha = hasCloudfareCaptcha(initialContent, domain);
    
    console.log(`[DEBUG] CAPTCHA Tespit Durumu: ${hasCaptcha ? '✅ CAPTCHA Tespit Edildi' : '❌ CAPTCHA Yok'}`);
    
    if (hasCaptcha) {
      if (isCaptchaSite) {
        console.log(`🔍 CAPTCHA Tespitinin Nedeni: ${domain} bilinen CAPTCHA gerektiren site listesinde`);
      } else if (foundDefinitiveMarker) {
        console.log(`🔍 CAPTCHA Tespitinin Nedeni: Kesin belirteç bulundu: "${foundMarker}"`);
      } else if (isTooSmallContent) {
        console.log(`🔍 CAPTCHA Tespitinin Nedeni: Sayfa boyutu çok küçük (${initialContent.length} byte) ve diğer belirteçler bulundu`);
      }
    }
    
    // Captcha yoksa ve özel siteye göre tarayıcı açılması gerekmiyorsa normal içeriği döndür
    if (!hasCaptcha && !siteConfig?.requiresCloudflareBypass) {
      console.log(`✅ ${domain} sitesinde CAPTCHA tespit edilmedi. Normal içerik kullanılıyor.`);
      return { 
        content: initialContent, 
        wasRetry: false,
        usedRealBrowser: false
      };
    }
    
    // Cloudflare CAPTCHA varsa veya özel site ise, gerçek tarayıcı kullan
    if (hasCaptcha) {
      console.log(`⚠️ ${domain} sitesinde CAPTCHA tespit edildi. Gerçek tarayıcı kullanılıyor...`);
    } else if (siteConfig?.requiresCloudflareBypass) {
      console.log(`⚠️ ${domain} sitesi yapılandırmasında "requiresCloudflareBypass" özelliği etkin. Gerçek tarayıcı kullanılıyor...`);
    }
    
    // Try to bypass with real browser (but not if we already tried manual solving for lieferando.de)
    if (domain !== 'lieferando.de') {
      const { content } = await fetchWithRealBrowser(url);
      
      if (content && content.length > 0) {
        console.log(`🌐 ${domain} sitesinden gerçek tarayıcı ile içerik alındı. Boyut: ${content.length} byte`);
        return { content, usedRealBrowser: true };
      }
    }
    
    console.log(`❌ ${domain} sitesinden gerçek tarayıcı ile geçerli içerik alınamadı.`);
    throw new Error('Failed to get content with real browser');
  } catch (error) {
    if (attempt < MAX_RETRIES) {
      const backoffDelay = INITIAL_BACKOFF_MS * Math.pow(2, attempt - 1);
      console.log(`⚠️ İstek ${attempt}/${MAX_RETRIES} denemede başarısız oldu, ${backoffDelay}ms sonra tekrar deneniyor...`);
      await new Promise(resolve => setTimeout(resolve, backoffDelay));
      return fetchWithRetry(url, domain, attempt + 1);
    }
    throw error;
  }
}

// HTML içeriğinden sadece body kısmını çıkaran yardımcı fonksiyon
function extractBodyContent(html: string): string {
  try {
    // JSDOM veya cheerio gibi bir DOM parser kullanabiliriz, ama bu durumda
    // regex daha hızlı ve basit bir çözüm olabilir
    
    // Body tag'ı içeriğini çıkar
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    
    if (bodyMatch && bodyMatch[1]) {
      let bodyContent = bodyMatch[1].trim();
      
      // JavaScript kodlarını kaldır (<script> tag'lerini temizle)
      bodyContent = bodyContent.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
      
      // Style taglerini de temizle
      bodyContent = bodyContent.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
      
      // Tam body içeriğini konsola yazdır
      console.log("==== CLEANED BODY CONTENT (FULL) ====");
      console.log(bodyContent);
      console.log("==== END OF FULL BODY CONTENT ====");
      
      console.log(`Body content extracted successfully. Original length: ${html.length}, Body-only length: ${bodyContent.length}`);
      return bodyContent;
    }
    
    // Eğer body tag'ı bulunamazsa, tüm HTML'i temizlemeye çalış
    console.log("Body tag'ı bulunamadı, tüm HTML içeriğini temizlemeye çalışıyorum");
    
    // JavaScript ve style kodlarını kaldır
    let cleanedHtml = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    cleanedHtml = cleanedHtml.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
    
    // Diğer potansiyel sorunlu tag'leri de temizleyelim
    cleanedHtml = cleanedHtml.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '');
    cleanedHtml = cleanedHtml.replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, '');
    
    // Tam temizlenmiş içeriği konsola yazdır
    console.log("==== CLEANED HTML CONTENT (FULL) ====");
    console.log(cleanedHtml);
    console.log("==== END OF FULL CLEANED HTML CONTENT ====");
    
    console.log(`Cleaned HTML content (no body tag found). Original length: ${html.length}, Cleaned length: ${cleanedHtml.length}`);
    return cleanedHtml;
  } catch (error) {
    console.error("Body içeriği çıkarma hatası:", error);
    return html;
  }
}

// Gemini'ye HTML içeriğini gönderip analiz ettiren fonksiyon
async function analyzeContentWithGemini(content: string, url: string): Promise<any> {
  try {
    // Gemini modeline erişim sağla
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash-latest' });
    
    // HTML içeriğini temizle ve kısalt (token limitini aşmamak için)
    const cleanedContent = content.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    const maxLength = 30000; // Maksimum karakter sayısı
    const truncatedContent = cleanedContent.length > maxLength 
      ? cleanedContent.substring(0, maxLength) + "..." 
      : cleanedContent;
    
    // Gemini'ye göndereceğimiz prompt - JSON çıktı istiyoruz ve birden fazla ürünü listeliyoruz
    const prompt = `
    Aşağıdaki HTML içeriğini analiz et ve bu web sitesinde sunulan ürünler veya hizmetler hakkında kapsamlı bilgi ver.
    
    Sayfada birden fazla ürün varsa, bunların HEPSİNİ listelemeye çalış (en az 5 ürün bul, eğer sayfada daha fazla ürün varsa).
    
    Her ürün için şu bilgileri çıkarmaya çalış:
    1. İşletme adı (tüm ürünler için aynı olabilir)
    2. Ürün adı
    3. Fiyat bilgisi (varsa)
    4. Müşteri yorumları veya puanları (varsa)
    5. Ürün açıklaması
    6. Ürün görseli URL'si (varsa) - Bu çok önemli, lütfen HTML içeriğinde her ürünün görselini bulmaya çalış
    
    URL: ${url}
    
    HTML İçeriği:
    ${truncatedContent}
    
    Cevabını sadece JSON formatında ver, başka açıklama yapma. Aşağıdaki şemada olmalı:

    {
      "businessName": "İşletme adı",
      "products": [
        {
          "productName": "Birinci ürün adı",
          "price": "Birinci ürün fiyatı (varsa)",
          "rating": "Birinci ürün değerlendirme puanı (varsa)",
          "reviewCount": "Birinci ürün değerlendirme sayısı (varsa)",
          "imageUrl": "Birinci ürün görseli URL'si (varsa, tam URL olmalı, göreceli URL'leri mutlaka tam URL'ye çevir)",
          "description": "Birinci ürün açıklaması"
        },
        {
          "productName": "İkinci ürün adı",
          "price": "İkinci ürün fiyatı (varsa)",
          "rating": "İkinci ürün değerlendirme puanı (varsa)",
          "reviewCount": "İkinci ürün değerlendirme sayısı (varsa)",
          "imageUrl": "İkinci ürün görseli URL'si (varsa, tam URL olmalı, göreceli URL'leri mutlaka tam URL'ye çevir)",
          "description": "İkinci ürün açıklaması"
        },
        // Diğer ürünler de benzer formatta listelenmeli
      ]
    }

    SADECE JSON DÖNDÜR, BAŞKA AÇIKLAMA EKLEME. JSON formatını kesinlikle bozma.
    Lütfen sayfadaki TÜM ürünleri bulmaya çalış (en az 5 ürün).
    `;
    
    // Log işlemi - TAM prompt'u görelim
    console.log("==== GEMİNİ'YE GÖNDERİLEN PROMPT (TAM) ====");
    console.log(prompt);
    console.log("==== PROMPT SONU ====");
    
    // Gemini API'ye istek gönder
    console.log("Gemini API'ye istek gönderiliyor...");
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    // Yanıtı konsola yazdır - TAM yanıtı görelim
    console.log("==== GEMİNİ YANITI (TAM) ====");
    console.log(text);
    console.log("==== GEMİNİ YANIT SONU ====");
    
    // JSON çıktıyı parse et
    try {
      // Metinden JSON'ı çıkar (bazen Gemini, json başında veya sonunda açıklama ekleyebilir)
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const jsonStr = jsonMatch[0];
        const jsonData = JSON.parse(jsonStr);
        
        // Göreceli URL'leri mutlak URL'lere çevir
        if (jsonData.products && Array.isArray(jsonData.products)) {
          jsonData.products = jsonData.products.map((product: any) => {
            if (product.imageUrl && !product.imageUrl.startsWith('http')) {
              const urlObj = new URL(url);
              const baseUrl = `${urlObj.protocol}//${urlObj.host}`;
              
              // Eğer URL "/" ile başlıyorsa doğrudan baseUrl'e ekle
              if (product.imageUrl.startsWith('/')) {
                product.imageUrl = baseUrl + product.imageUrl;
              } else {
                // Değilse, sayfanın bulunduğu dizine göre ekle
                const pathParts = urlObj.pathname.split('/');
                pathParts.pop(); // Son parçayı (dosya adını) kaldır
                const pathPrefix = pathParts.join('/');
                product.imageUrl = baseUrl + pathPrefix + '/' + product.imageUrl;
              }
            }
            return product;
          });
        }
        
        // Eski sürümle uyumluluk için tek ürün olarak gelirse onu da products array'ine çeviriyoruz
        if (!jsonData.products && jsonData.productName) {
          const singleProduct = {
            productName: jsonData.productName || "",
            price: jsonData.price || "",
            rating: jsonData.rating || "",
            reviewCount: jsonData.reviewCount || "",
            imageUrl: jsonData.imageUrl || "",
            description: jsonData.description || ""
          };
          
          jsonData.products = [singleProduct];
        }
        
        return jsonData;
      } else {
        throw new Error("JSON bulunamadı");
      }
    } catch (parseError) {
      console.error("JSON parse hatası:", parseError);
      return {
        businessName: extractDomainFromUrl(url),
        products: [
          {
            productName: "İçerik çözümlenemedi",
            price: "",
            rating: "",
            reviewCount: "",
            imageUrl: "",
            description: "İçerik analiz edilemedi. JSON formatında çıktı alınamadı."
          }
        ]
      };
    }
  } catch (error) {
    console.error("Gemini ile analiz hatası:", error);
    return {
      businessName: extractDomainFromUrl(url),
      products: [
        {
          productName: "Analiz hatası",
          price: "",
          rating: "",
          reviewCount: "",
          imageUrl: "",
          description: "Gemini API ile içerik analiz edilirken bir hata oluştu. Lütfen daha sonra tekrar deneyin."
        }
      ]
    };
  }
}

// Fetch product data from a URL and analyze it with Gemini
export async function POST(req: NextRequest) {
  // Clean old cache entries periodically
  cleanOldCache();

  // Check if user is authorized
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

    // Extract and process URL
    const domain = extractDomainFromUrl(url);
    const siteConfig = getSiteConfig(url);

    console.log(`Starting analysis for: ${domain}`);
    
    // Sadece Lieferando.de için CAPTCHA çözme işlemi uygula
    if (domain === 'lieferando.de') {
      console.log('Using specialized handler for lieferando.de');
      
      // Directly use bypassCloudflare which opens a browser window for manual CAPTCHA solving
      console.log('Opening browser for manual CAPTCHA solving...');
      const content = await bypassCloudflare(url, domain);
      
      if (!content || content.length < 1000) {
        return NextResponse.json({
          error: 'Failed to retrieve valid content from Lieferando',
          message: 'We were unable to access this site due to anti-bot protection. Please try a different URL.'
        }, { status: 400 });
      }
      
      // Sadece body içeriğini çıkar
      const bodyContent = extractBodyContent(content);
      
      // Log the HTML content being sent to Gemini
      console.log("==== HTML CONTENT BEING SENT TO GEMINI ====");
      console.log(`Original length: ${content.length}, Body-only length: ${bodyContent.length}`);
      console.log("============= END OF HTML CONTENT =============");
      
      // Gemini ile içeriği analiz et
      const geminiResponse = await analyzeContentWithGemini(bodyContent, url);
      
      // Return both raw HTML and body-only content
      return NextResponse.json({ 
        success: true, 
        rawHtml: content,
        htmlContent: bodyContent, // Sadece body içeriği gönderiliyor
        source: domain,
        geminiResponse: geminiResponse, // Gerçek Gemini yanıtı
        message: 'Content analyzed with Gemini successfully'
      });
    } else {
      // Diğer tüm domain'ler için basit fetch yöntemi kullan, CAPTCHA tespiti yapma
      console.log(`Using standard fetch approach for ${domain}`);
      
      // Basit bir fetch isteği gönder, CAPTCHA tespiti olmadan
      try {
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1',
            'Cache-Control': 'max-age=0'
          }
        });
        
        // Eğer basit fetch başarısız olursa, multi-stage yaklaşımını kullan
        if (!response.ok) {
          console.log(`Simple fetch failed with status ${response.status}, falling back to fetchWebsiteContent`);
          const { content, error } = await fetchWebsiteContent(url);
          
          if (error || !content || content.length < 1000) {
            return NextResponse.json({
              error: error || 'Failed to retrieve valid content',
              message: 'We were unable to access this site. Please try a different URL.'
            }, { status: 400 });
          }
          
          console.log(`Successfully retrieved content from ${domain} with fallback method, length: ${content.length} bytes`);
          
          // Sadece body içeriğini çıkar
          const bodyContent = extractBodyContent(content);
          console.log(`Extracted body content length: ${bodyContent.length} bytes`);
          
          // Gemini ile içeriği analiz et
          const geminiResponse = await analyzeContentWithGemini(bodyContent, url);
          
          return NextResponse.json({ 
            success: true,
            rawHtml: content,
            htmlContent: bodyContent, // Sadece body içeriği gönderiliyor
            source: domain,
            geminiResponse: geminiResponse, // Gerçek Gemini yanıtı
            message: 'Content analyzed with Gemini successfully'
          });
        }
        
        // Basit fetch başarılı oldu
        const content = await response.text();
        console.log(`Successfully retrieved content from ${domain} with simple fetch, length: ${content.length} bytes`);
        
        // Sadece body içeriğini çıkar
        const bodyContent = extractBodyContent(content);
        console.log(`Extracted body content length: ${bodyContent.length} bytes`);
        
        // Gemini ile içeriği analiz et
        const geminiResponse = await analyzeContentWithGemini(bodyContent, url);
        
        return NextResponse.json({ 
          success: true,
          rawHtml: content,
          htmlContent: bodyContent, // Sadece body içeriği gönderiliyor
          source: domain,
          geminiResponse: geminiResponse, // Gerçek Gemini yanıtı
          message: 'Content analyzed with Gemini successfully'
        });
      } catch (fetchError) {
        console.log(`Error during simple fetch: ${fetchError.message}, falling back to fetchWebsiteContent`);
        
        // Hata durumunda multi-stage yaklaşımını kullan
        const { content, error } = await fetchWebsiteContent(url);
        
        if (error || !content || content.length < 1000) {
          return NextResponse.json({
            error: error || 'Failed to retrieve valid content',
            message: 'We were unable to access this site. Please try a different URL.'
          }, { status: 400 });
        }
        
        console.log(`Successfully retrieved content from ${domain} with fallback method, length: ${content.length} bytes`);
        
        // Sadece body içeriğini çıkar
        const bodyContent = extractBodyContent(content);
        console.log(`Extracted body content length: ${bodyContent.length} bytes`);
        
        // Gemini ile içeriği analiz et
        const geminiResponse = await analyzeContentWithGemini(bodyContent, url);
        
        return NextResponse.json({ 
          success: true,
          rawHtml: content,
          htmlContent: bodyContent, // Sadece body içeriği gönderiliyor
          source: domain,
          geminiResponse: geminiResponse, // Gerçek Gemini yanıtı
          message: 'Content analyzed with Gemini successfully'
        });
      }
    }
  } catch (error: any) {
    console.error('Error processing request:', error);
    
    return NextResponse.json({ 
      error: error.message || 'An error occurred while processing the request' 
    }, { 
      status: 500 
    });
  }
}