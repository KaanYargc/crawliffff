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

    // Extract domain for context
    let domain = '';
    try {
      domain = new URL(url).hostname.replace('www.', '');
    } catch (error) {
      domain = 'unknown';
    }

    console.log(`Starting analysis for: ${domain}`);
    
    try {
      // Fetch website content and analyze in parallel
      const websiteContent = await fetchWebsiteContent(url);
      
      if (!websiteContent) {
        return NextResponse.json({ 
          error: 'Failed to fetch website content' 
        }, { status: 500 });
      }
      
      // Analyze content with reduced HTML size
      const products = await analyzeWithGemini(websiteContent, url, domain);
      return NextResponse.json({ products });
    } catch (error) {
      console.error("Error in analysis process:", error);
      
      // Return a placeholder product if any part fails
      const fallbackProducts: Product[] = [{
        productName: "İçerik analiz edilemedi",
        price: "Bulunamadı",
        rating: "",
        businessName: domain,
        description: "İçerik işleme hatası. Lütfen daha sonra tekrar deneyin.",
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

// Optimized Gemini analysis function
async function analyzeWithGemini(html: string, url: string, domain: string): Promise<Product[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not defined');
  }
  
  // Extract important parts to reduce content size drastically
  const extractedContent = extractRelevantContent(html);
  
  // Empty product response
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
    // Simplified prompt
    const prompt = `
Sayfadaki ürünleri JSON formatında döndür:
[
  {
    "productName": "Ürün adı",
    "price": "Fiyat",
    "rating": "Puan",
    "businessName": "${domain}",
    "description": "Açıklama",
    "reviewCount": "Değerlendirme sayısı",
    "url": "${url}",
    "imageUrl": "Resim URL"
  }
]
Kurallar:
1. Sadece JSON döndür
2. Ürün bulamazsan boş dizi döndür: []

HTML:
${extractedContent}`;

    // Request payload with smaller content
    const requestPayload = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 4096,
        responseMimeType: "application/json"
      }
    };
    
    // Use flash model
    const model = "gemini-1.5-flash";
    
    console.log(`Calling Gemini API...`);
    const response = await axios({
      method: 'post',
      url: `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      data: requestPayload,
      headers: { 'Content-Type': 'application/json' },
      timeout: 8000 // Reduced timeout for Netlify
    });
    
    if (!response.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
      return emptyProductResponse;
    }
    
    const responseText = response.data.candidates[0].content.parts[0].text.trim();
    
    // Handle empty array
    if (responseText === '[]' || responseText === '[ ]') {
      return emptyProductResponse;
    }
    
    try {
      // Try to repair and parse JSON
      const repairedJson = jsonrepair(responseText);
      const parsedProducts = JSON.parse(repairedJson);
      
      if (Array.isArray(parsedProducts) && parsedProducts.length > 0) {
        return parsedProducts;
      }
      
      return emptyProductResponse;
    } catch (error) {
      console.error("JSON parsing error:", error);
      return emptyProductResponse;
    }
  } catch (error) {
    console.error("Gemini API error:", error);
    return [{
      productName: "API Bağlantı Hatası",
      price: "",
      rating: "",
      businessName: domain,
      description: "Gemini API'ye bağlanırken bir hata oluştu.",
      reviewCount: "",
      url: url,
      imageUrl: ""
    }];
  }
}

// Function to extract only relevant parts of HTML to reduce size
function extractRelevantContent(html: string): string {
  // Max size for HTML to send to API
  const MAX_SIZE = 30000;
  
  if (html.length <= MAX_SIZE) {
    return html;
  }
  
  // First try to extract product sections
  let extractedContent = '';
  
  // Common product section patterns
  const productPatterns = [
    /<div[^>]*class="[^"]*product[^"]*"[^>]*>[\s\S]*?<\/div>/gi,
    /<div[^>]*class="[^"]*item[^"]*"[^>]*>[\s\S]*?<\/div>/gi,
    /<article[^>]*>[\s\S]*?<\/article>/gi,
    /<div[^>]*id="[^"]*product[^"]*"[^>]*>[\s\S]*?<\/div>/gi,
    /<li[^>]*class="[^"]*product[^"]*"[^>]*>[\s\S]*?<\/li>/gi
  ];
  
  // Try each pattern
  for (const pattern of productPatterns) {
    const matches = html.match(pattern);
    if (matches && matches.length > 0) {
      extractedContent = matches.join('\n').substring(0, MAX_SIZE);
      if (extractedContent.length > 1000) {
        return extractedContent;
      }
    }
  }
  
  // If no product sections found, extract main content
  const mainContentPatterns = [
    /<main[^>]*>[\s\S]*?<\/main>/i,
    /<div[^>]*id="content"[^>]*>[\s\S]*?<\/div>/i,
    /<div[^>]*class="[^"]*content[^"]*"[^>]*>[\s\S]*?<\/div>/i,
    /<div[^>]*id="main"[^>]*>[\s\S]*?<\/div>/i
  ];
  
  for (const pattern of mainContentPatterns) {
    const match = html.match(pattern);
    if (match && match[0] && match[0].length > 1000) {
      return match[0].substring(0, MAX_SIZE);
    }
  }
  
  // If all else fails, just take a portion from the middle
  const middle = Math.floor(html.length / 2);
  const start = Math.max(0, middle - (MAX_SIZE / 2));
  return html.substring(start, start + MAX_SIZE);
}