// product-extractor.ts - HTML'den ürün çıkarma işlevleri
import { load } from 'cheerio';
import { Product } from './types';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize the Google Generative AI client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// Helper function to validate product data
export function isValidProductData(productData: Product[] | null): boolean {
  if (!productData || !Array.isArray(productData) || productData.length === 0) {
    return false;
  }
  
  // Check the first product for meaningful data
  const product = productData[0];
  
  // Verify essential fields have valid content
  return (
    product.productName !== "Content Processing Failed" && 
    product.productName !== "Unknown Product" &&
    product.description !== "An error occurred while processing the website content." &&
    product.description !== "Unable to process content with AI. Please try again later." &&
    product.description !== "No description available" &&
    product.description.length > 20 // Ensure description has reasonable length
  );
}

export function getBodyContent(html: string): string {
  try {
    const $ = load(html);
    return $('body').html() || html;
  } catch {
    return html;
  }
}

// Clean and prepare the content for Gemini processing
function prepareContentForGemini(html: string): string {
  try {
    const $ = load(html);
    
    // Remove script and style tags
    $('script, style, noscript, iframe').remove();
    
    // Extract only visible content
    const visibleContent = $('body').text().trim();
    
    // Limit content size to prevent token limits
    const maxTokens = 8000; // Approximately 32,000 characters
    if (visibleContent.length > maxTokens) {
      return visibleContent.substring(0, maxTokens) + "...";
    }
    
    return visibleContent;
  } catch (error) {
    console.error('Error preparing content for Gemini:', error);
    return html;
  }
}

// Process content with Gemini API
async function processWithGemini(content: string, url: string): Promise<Product[]> {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash-latest' });
    
    // Log the content that's being sent to Gemini
    console.log('==== HTML CONTENT BEING SENT TO GEMINI ====');
    console.log(content);
    console.log('============= END OF HTML CONTENT =============');
    
    const prompt = `
    You are an AI assistant specializing in extracting business information from website content.
    
    Please analyze the following website content from ${url} and extract information about:
    
    1. Business name
    2. Main product or service offered
    3. Pricing information (if available)
    4. Customer reviews or ratings (if available)
    5. A concise description of the business
    
    Format your response as a structured JSON object with the following keys:
    {
      "productName": "Main product or service offered",
      "price": "Price information (if available)",
      "rating": "Rating (if available, otherwise empty string)",
      "businessName": "Name of the business",
      "description": "A concise description of the business (1-2 paragraphs)",
      "reviewCount": "Number of reviews (if available, otherwise empty string)",
      "url": "${url}",
      "imageUrl": ""
    }
    
    Only include the JSON object in your response, nothing else.
    
    Website content:
    ${content}
    `;
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const jsonStr = jsonMatch[0];
      const parsedProduct = JSON.parse(jsonStr);
      
      // Ensure all required fields are present
      const product: Product = {
        productName: parsedProduct.productName || "Unknown Product",
        price: parsedProduct.price || "",
        rating: parsedProduct.rating || "",
        businessName: parsedProduct.businessName || new URL(url).hostname,
        description: parsedProduct.description || "No description available",
        reviewCount: parsedProduct.reviewCount || "",
        url: url,
        imageUrl: parsedProduct.imageUrl || ""
      };
      
      return [product];
    }
    
    throw new Error("Failed to parse Gemini response");
    
  } catch (error) {
    console.error('Error processing with Gemini:', error);
    // Return a fallback product if Gemini processing fails
    return [{
      productName: "Content Processing Failed",
      price: "",
      rating: "",
      businessName: new URL(url).hostname,
      description: "Unable to process content with AI. Please try again later.",
      reviewCount: "",
      url: url,
      imageUrl: ""
    }];
  }
}

export async function extractProductsFromHtml(html: string, url: string): Promise<Product[]> {
  try {
    // Prepare content for Gemini processing
    const preparedContent = prepareContentForGemini(html);
    
    // Process with Gemini API
    const products = await processWithGemini(preparedContent, url);
    return products;
  } catch (error) {
    console.error('Error extracting products:', error);
    
    // Fallback to returning raw content if processing fails
    const domain = new URL(url).hostname;
    return [{
      productName: "Content Processing Failed",
      price: "",
      rating: "",
      businessName: domain,
      description: "An error occurred while processing the website content.",
      reviewCount: "",
      url: url,
      imageUrl: ""
    }];
  }
}