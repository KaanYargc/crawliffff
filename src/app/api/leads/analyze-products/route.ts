import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import * as fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as os from 'os';
import { jsonrepair } from 'jsonrepair';

const execPromise = promisify(exec);

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    // Fetch the website content
    console.log(`Fetching content from: ${url}`);
    const websiteContent = await fetchWebsiteContent(url);

    if (!websiteContent) {
      return NextResponse.json({ error: 'Failed to fetch website content' }, { status: 500 });
    }

    // Extract domain for context
    let domain = '';
    try {
      domain = new URL(url).hostname.replace('www.', '');
    } catch (e) {
      domain = 'unknown';
    }

    console.log(`Analyzing content for: ${domain}`);
    
    try {
      // Process HTML with Gemini API
      const products = await analyzeWithGeminiCurl(websiteContent, url, domain);
      return NextResponse.json({ products });
    } catch (error) {
      console.error("Error analyzing with Gemini:", error);
      
      // Return a placeholder product if Gemini fails
      const fallbackProducts = [{
        productName: "HTML içeriği işlenemedi",
        price: "Bulunamadı",
        rating: "",
        businessName: domain,
        description: "Gemini API bağlantı sorunu nedeniyle içerik analiz edilemedi.",
        reviewCount: "",
        url: url,
        imageUrl: ""
      }];
      
      return NextResponse.json({ 
        products: fallbackProducts,
        error: "API analiz hatası"
      });
    }
  } catch (error) {
    console.error('Error processing request:', error);
    return NextResponse.json({ error: 'Failed to analyze products' }, { status: 500 });
  }
}

// Function to fetch website content
async function fetchWebsiteContent(url: string): Promise<string> {
  try {
    // İyileştirilmiş HTTP istek başlıkları - bot korumasını aşmak için daha gerçekçi başlıklar
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'sec-ch-ua': '"Not A(Brand";v="99", "Google Chrome";v="120", "Chromium";v="120"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Windows"',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1',
      'Referer': 'https://www.google.com/',
      'Cookie': ''  // Boş cookie başlığı ekle
    };

    console.log(`Sending request with improved headers to: ${url}`);
    
    // Önce HEAD isteği ile kontrol et
    try {
      await axios.head(url, {
        headers,
        timeout: 10000,
        maxRedirects: 5
      });
    } catch (headError) {
      console.log(`HEAD request failed, proceeding with GET anyway: ${headError.message}`);
    }
    
    const response = await axios.get(url, {
      headers,
      timeout: 60000, // Timeout süresini 1 dakikaya çıkardık
      maxRedirects: 5,
      validateStatus: function (status) {
        return status < 500; // 500 altındaki tüm kodları kabul et
      }
    });

    // Eğer 403 hatası alındıysa ve yemeksepeti için
    if (response.status === 403) {
      console.log(`Received 403 Forbidden response from ${url}`);
      
      // Temel HTML şablonu döndür
      const basicHtml = `
        <html>
          <body>
            <h1>403 Forbidden - Content Not Accessible</h1>
            <p>The site at ${url} returned a 403 Forbidden error.</p>
            <p>This site may have anti-scraping protections in place.</p>
          </body>
        </html>
      `;
      
      return basicHtml;
    }

    console.log(`Successfully fetched content with size: ${response.data.length} bytes`);
    
    return response.data;
  } catch (error) {
    console.error('Error fetching website content:', error);
    
    // Hata durumunda temel HTML şablonu döndür
    const errorHtml = `
      <html>
        <body>
          <h1>Error Fetching Content</h1>
          <p>Could not retrieve content from ${url}</p>
          <p>Error: ${error.message}</p>
        </body>
      </html>
    `;
    
    return errorHtml;
  }
}

// Function to analyze with Gemini using direct API call instead of curl
async function analyzeWithGeminiCurl(html: string, url: string, domain: string): Promise<any[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not defined in environment variables');
  }
  
  // Limit content size to avoid token limits
  const truncatedHtml = html.length > 100000 ? html.substring(0, 100000) : html;
  
  try {
    // Tüm siteler için genel bir prompt kullanılıyor - site özel kontrolü yok
    const prompt = `
HTML sayfasını analiz et ve içindeki TÜM ürünleri bul. Bu bir e-ticaret, restoran, yemek, market veya herhangi bir ürün satan sayfa olabilir.

İçerikten bulunan TÜM ürünlerin bilgilerini çıkar ve aşağıdaki JSON formatında döndür:

[
  {
    "productName": "Ürün adı",
    "price": "Fiyat (rakam ve para birimi, örn: 150 TL)",
    "rating": "Varsa değerlendirme puanı",
    "businessName": "İşletme/mağaza/marka adı",
    "description": "Ürün açıklaması",
    "reviewCount": "Varsa değerlendirme sayısı",
    "url": "${url}",
    "imageUrl": "Varsa ürün resmi URL'si"
  },
  {
    // İkinci ürün
  },
  {
    // Üçüncü ürün, vb.
  }
]

Önemli kurallar:
1. Sayfadaki TÜM ürünleri bul ve listele
2. Her ürün için fiyat ve resim URL'si bilgilerini mutlaka ekle
3. Kategori sayfası, arama sonuçları, "benzer ürünler" bölümleri gibi birden fazla ürün içeren tüm bölümleri tara
4. Ürünler arasında karşılaştırma yapma, her ürünü ayrı bir şekilde listele
5. Eğer hiçbir ürün bulamazsan boş dizi döndür: []
6. SADECE JSON döndür, başka açıklama ekleme
7. JSON'ın geçerli olduğundan emin ol

HTML:
${truncatedHtml}`;

    // Create request payload with more precise settings
    const requestPayload = {
      contents: [
        {
          parts: [
            {
              text: prompt
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.1,  // Daha kesin sonuçlar için düşük sıcaklık
        topP: 0.95,
        topK: 40,
        maxOutputTokens: 8192,
        responseMimeType: "application/json"  // JSON yanıt iste
      },
      safetySettings: [
        {
          category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
          threshold: "BLOCK_NONE"
        },
        {
          category: "HARM_CATEGORY_HATE_SPEECH",
          threshold: "BLOCK_NONE"
        },
        {
          category: "HARM_CATEGORY_HARASSMENT",
          threshold: "BLOCK_NONE"
        },
        {
          category: "HARM_CATEGORY_DANGEROUS_CONTENT",
          threshold: "BLOCK_NONE"
        }
      ]
    };
    
    // Sadece flash modelini kullan
    const model = "gemini-1.5-flash";
    
    try {
      console.log(`Making request to Gemini API with model: ${model}...`);
      
      const response = await axios({
        method: 'post',
        url: `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        data: requestPayload,
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 120000 // 2 dakikaya çıkarılmış zaman aşımı
      });

      console.log(`Gemini API (${model}) response status:`, response.status);
      console.log("Gemini API response headers:", JSON.stringify(response.headers));
      
      // Process the response and extract products
      if (response.data && 
          response.data.candidates && 
          response.data.candidates[0] && 
          response.data.candidates[0].content && 
          response.data.candidates[0].content.parts && 
          response.data.candidates[0].content.parts[0]) {
            
        const responsePart = response.data.candidates[0].content.parts[0];
        
        // Check if the response is already in JSON format (from responseMimeType setting)
        if (responsePart.inlineData && responsePart.inlineData.mimeType === 'application/json') {
          console.log("Received direct JSON response from Gemini");
          try {
            const jsonData = JSON.parse(responsePart.inlineData.data);
            if (Array.isArray(jsonData)) {
              if (jsonData.length === 0) {
                return [{
                  productName: "Ürün bulunamadı",
                  price: "",
                  rating: "",
                  businessName: domain,
                  description: "Bu sayfada herhangi bir ürün tespit edilemedi.",
                  reviewCount: "",
                  url: url,
                  imageUrl: ""
                }];
              }
              return jsonData;
            }
          } catch (error) {
            console.error("Error parsing inline JSON data:", error);
          }
        }
        
        // If not direct JSON or parsing failed, fall back to text parsing
        if (responsePart.text) {
          const responseText = responsePart.text.trim();
          console.log("Raw response text (first 200 chars):", responseText.substring(0, 200));
          
          // Create a common empty product response
          const emptyProductResponse = [{
            productName: "Ürün bulunamadı",
            price: "",
            rating: "",
            businessName: domain,
            description: "Bu sayfada herhangi bir ürün tespit edilemedi.",
            reviewCount: "",
            url: url,
            imageUrl: ""
          }];
          
          // Special handling for empty array response as raw text
          if (responseText === '[]' || responseText === '[ ]' || 
              responseText.match(/^\s*\[\s*\]\s*$/)) {
            console.log("Empty array detected in raw response. Returning 'no products found' message");
            return emptyProductResponse;
          }
          
          // Try parsing JSON with jsonrepair library
          try {
            console.log("Attempting to repair and parse JSON with jsonrepair");
            // First, try to repair the JSON using jsonrepair
            const repairedJson = jsonrepair(responseText);
            const parsedProducts = JSON.parse(repairedJson);
            
            // Verify we have a valid array
            if (Array.isArray(parsedProducts)) {
              console.log("Successfully parsed as JSON array with", parsedProducts.length, "items");
              
              // Handle empty array case after parsing
              if (parsedProducts.length === 0) {
                console.log("Empty array detected after parsing. Returning 'no products found' message");
                return emptyProductResponse;
              }
              
              // Return valid products
              return parsedProducts;
            } else {
              console.log("Repaired JSON is not an array, wrapping in array");
              // If it's an object but not an array, wrap it in an array
              return [parsedProducts];
            }
          } catch (error) {
            console.error("JSON repair and parsing failed:", error.message);
            
            // Try extracting JSON with a more aggressive approach - find anything that looks like JSON
            try {
              // Look for anything that starts with [ and ends with ]
              const jsonMatch = responseText.match(/\[\s*{[\s\S]*}\s*\]/);
              if (jsonMatch) {
                const possibleJson = jsonMatch[0];
                console.log("Found potential JSON array:", possibleJson.substring(0, 100) + "...");
                const extractedProducts = JSON.parse(possibleJson);
                if (Array.isArray(extractedProducts) && extractedProducts.length > 0) {
                  console.log("Successfully extracted JSON array with", extractedProducts.length, "items");
                  return extractedProducts;
                }
              }
            } catch (jsonError) {
              console.error("JSON extraction failed:", jsonError.message);
            }
            
            // Return a fallback product with error information
            return [{
              productName: "Ürün bilgisi alınamadı",
              price: "",
              rating: "",
              businessName: domain,
              description: "JSON ayıklama işlemi başarısız oldu: " + error.message,
              reviewCount: "",
              url: url,
              imageUrl: ""
            }];
          }
        } else {
          console.error("Response has no text content:", JSON.stringify(response.data, null, 2));
          return [{
            productName: "API Yanıt Hatası",
            price: "",
            rating: "",
            businessName: domain,
            description: "Gemini API'den metin içermeyen bir yanıt alındı.",
            reviewCount: "",
            url: url,
            imageUrl: ""
          }];
        }
      } else {
        console.error("Invalid response structure:", JSON.stringify(response.data, null, 2));
        return [{
          productName: "API Yanıt Hatası",
          price: "",
          rating: "",
          businessName: domain,
          description: "Gemini API'den geçersiz yanıt yapısı alındı.",
          reviewCount: "",
          url: url,
          imageUrl: ""
        }];
      }
    } catch (error) {
      // Detaylı hata yönetimi
      console.error("Error in Gemini API call:", error);
      
      // If it's an API error with a response
      if (error.response) {
        console.error("Gemini API Error Response:", {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data
        });
        
        // If it's an authentication error, provide more specific information
        if (error.response.status === 403) {
          throw new Error("API key authentication failed (403 Forbidden). Please check your GEMINI_API_KEY environment variable.");
        } else if (error.response.status === 429) {
          throw new Error("Rate limit exceeded for Gemini API. Consider upgrading your API quota or implementing rate limiting.");
        }
      }
      
      throw error;
    }
  } catch (error) {
    console.error("Error in Gemini API processing:", error);
    throw error;
  }
}