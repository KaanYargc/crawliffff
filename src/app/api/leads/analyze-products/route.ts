import { NextRequest, NextResponse } from 'next/server';
import axios, { AxiosError } from 'axios';
import { jsonrepair } from 'jsonrepair';
import { isAuthorized } from '@/lib/utils';

// Define error interfaces for better type safety
interface ApiError extends Error {
  response?: {
    status: number;
    statusText: string;
    data: any;
  };
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
    } catch (error) {
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
      const fallbackProducts: Product[] = [{
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
    // HTTP request headers
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
      'Cookie': ''
    };

    console.log(`Sending request with improved headers to: ${url}`);
    
    // Try HEAD request first
    try {
      await axios.head(url, {
        headers,
        timeout: 10000,
        maxRedirects: 5
      });
    } catch (error) {
      const headError = error as ApiError;
      console.log(`HEAD request failed, proceeding with GET anyway: ${headError.message || 'Unknown error'}`);
    }
    
    const response = await axios.get(url, {
      headers,
      timeout: 60000,
      maxRedirects: 5,
      validateStatus: function (status) {
        return status < 500;
      }
    });

    // If 403 Forbidden
    if (response.status === 403) {
      console.log(`Received 403 Forbidden response from ${url}`);
      
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
    const fetchError = error as ApiError;
    console.error('Error fetching website content:', fetchError);
    
    // Return error HTML
    const errorHtml = `
      <html>
        <body>
          <h1>Error Fetching Content</h1>
          <p>Could not retrieve content from ${url}</p>
          <p>Error: ${fetchError.message || 'Unknown error'}</p>
        </body>
      </html>
    `;
    
    return errorHtml;
  }
}

// Function to analyze with Gemini
async function analyzeWithGeminiCurl(html: string, url: string, domain: string): Promise<Product[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not defined in environment variables');
  }
  
  // Limit content size to avoid token limits
  const truncatedHtml = html.length > 100000 ? html.substring(0, 100000) : html;
  
  try {
    // Prompt for analysis
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

    // Request payload
    const requestPayload = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.1,
        topP: 0.95,
        topK: 40,
        maxOutputTokens: 8192,
        responseMimeType: "application/json"
      },
      safetySettings: [
        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
      ]
    };
    
    // Use flash model
    const model = "gemini-1.5-flash";
    
    // Empty product response for reuse
    const emptyProductResponse: Product[] = [{
      productName: "Ürün bulunamadı",
      price: "",
      rating: "",
      businessName: domain,
      description: "Bu sayfada herhangi bir ürün tespit edilemedi.",
      reviewCount: "",
      url: url,
      imageUrl: ""
    }];
    
    try {
      console.log(`Making request to Gemini API with model: ${model}...`);
      
      const response = await axios({
        method: 'post',
        url: `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        data: requestPayload,
        headers: { 'Content-Type': 'application/json' },
        timeout: 120000
      });

      console.log(`Gemini API (${model}) response status:`, response.status);
      
      // Check for valid response structure
      if (!response.data?.candidates?.[0]?.content?.parts?.[0]) {
        console.error("Invalid response structure");
        return emptyProductResponse;
      }
      
      const responsePart = response.data.candidates[0].content.parts[0];
      
      // Check for inline JSON data
      if (responsePart.inlineData?.mimeType === 'application/json') {
        try {
          const jsonData = JSON.parse(responsePart.inlineData.data);
          if (Array.isArray(jsonData)) {
            return jsonData.length > 0 ? jsonData : emptyProductResponse;
          }
        } catch (error) {
          console.error("Error parsing inline JSON data:", error);
        }
      }
      
      // If we have text content
      if (responsePart.text) {
        const responseText = responsePart.text.trim();
        
        // Handle empty array
        if (responseText === '[]' || responseText === '[ ]' || responseText.match(/^\s*\[\s*\]\s*$/)) {
          return emptyProductResponse;
        }
        
        // Try parsing with jsonrepair
        try {
          const repairedJson = jsonrepair(responseText);
          const parsedProducts = JSON.parse(repairedJson);
          
          if (Array.isArray(parsedProducts)) {
            return parsedProducts.length > 0 ? parsedProducts : emptyProductResponse;
          } else {
            return [parsedProducts]; // Wrap in array if not already an array
          }
        } catch (error) {
          // Try extracting JSON using regex
          try {
            const jsonMatch = responseText.match(/\[\s*{[\s\S]*}\s*\]/);
            if (jsonMatch) {
              const extractedProducts = JSON.parse(jsonMatch[0]);
              if (Array.isArray(extractedProducts) && extractedProducts.length > 0) {
                return extractedProducts;
              }
            }
          } catch (jsonError) {
            console.error("JSON extraction failed");
          }
          
          // Return fallback product
          return [{
            productName: "Ürün bilgisi alınamadı",
            price: "",
            rating: "",
            businessName: domain,
            description: "JSON ayıklama işlemi başarısız oldu",
            reviewCount: "",
            url: url,
            imageUrl: ""
          }];
        }
      }
      
      // Fallback for no text content
      return [{
        productName: "API Yanıt Hatası",
        price: "",
        rating: "",
        businessName: domain,
        description: "Gemini API'den geçersiz yanıt alındı",
        reviewCount: "",
        url: url,
        imageUrl: ""
      }];
      
    } catch (error) {
      const apiError = error as ApiError;
      console.error("Error in Gemini API call:", apiError);
      
      if (apiError.response) {
        if (apiError.response.status === 403) {
          throw new Error("API key authentication failed (403 Forbidden)");
        } else if (apiError.response.status === 429) {
          throw new Error("Rate limit exceeded for Gemini API");
        }
      }
      
      throw new Error(`Gemini API error: ${apiError.message || 'Unknown error'}`);
    }
  } catch (error) {
    const outerError = error as Error;
    console.error("Error in Gemini API processing:", outerError);
    throw outerError;
  }
}