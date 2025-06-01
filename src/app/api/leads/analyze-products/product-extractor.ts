// product-extractor.ts - HTML'den ürün çıkarma işlevleri
import { Product } from './types';

// Function to directly extract product information from HTML without AI
export async function extractProductsFromHtml(html: string, url: string, domain: string): Promise<Product[]> {
  console.log('Attempting to extract products directly from HTML...');
  
  try {
    // Use JSDOM to parse the HTML
    const { JSDOM } = require('jsdom');
    const dom = new JSDOM(html);
    const document = dom.window.document;
    
    // Try to find product titles/names
    const possibleTitleSelectors = [
      'h1', 
      '.product-name', 
      '.product-title',
      '[itemprop="name"]',
      '.product_title',
      '.product-info-name',
      '.menu-item-title'
    ];
    
    // Try to find product prices
    const possiblePriceSelectors = [
      '.price', 
      '[itemprop="price"]',
      '.product-price',
      '.amount',
      '.menu-item-price'
    ];
    
    // Try to find descriptions
    const possibleDescSelectors = [
      '.product-description', 
      '[itemprop="description"]',
      '.description',
      '.product-short-description',
      '.menu-item-description'
    ];
    
    // Get all potential product elements
    const products: Product[] = [];
    let foundProducts = false;
    
    // First try to find product containers
    const productContainers = Array.from(
      document.querySelectorAll('.product, .product-item, .menu-item, [itemtype*="Product"], .item')
    );
    
    if (productContainers.length > 0) {
      console.log(`Found ${productContainers.length} potential product containers`);
      
      productContainers.forEach((container: Element, index: number) => {
        // Only process first 10 products to avoid overload
        if (index >= 10) return;
        
        let productName = '';
        let price = '';
        let description = '';
        let imageUrl = '';
        
        // Try to find product name
        for (const selector of possibleTitleSelectors) {
          const element = container.querySelector(selector);
          if (element && element.textContent) {
            productName = element.textContent.trim();
            break;
          }
        }
        
        // Try to find price
        for (const selector of possiblePriceSelectors) {
          const element = container.querySelector(selector);
          if (element && element.textContent) {
            price = element.textContent.trim();
            break;
          }
        }
        
        // Try to find description
        for (const selector of possibleDescSelectors) {
          const element = container.querySelector(selector);
          if (element && element.textContent) {
            description = element.textContent.trim();
            break;
          }
        }
        
        // Try to find image
        const imgElement = container.querySelector('img');
        if (imgElement && imgElement.getAttribute('src')) {
          imageUrl = imgElement.getAttribute('src') || '';
        }
        
        if (productName || price) {
          products.push({
            productName: productName || 'Ürün Adı Bulunamadı',
            price: price || '',
            rating: '',
            businessName: domain,
            description: description || '',
            reviewCount: '',
            url: url,
            imageUrl: imageUrl
          });
          
          foundProducts = true;
        }
      });
    }
    
    // If no products found in containers, try looking for individual elements
    if (!foundProducts) {
      console.log('No products found in containers, trying individual elements...');
      
      // Look for titles
      let titles: string[] = [];
      for (const selector of possibleTitleSelectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          titles = Array.from(elements).map((el: Element) => el.textContent?.trim() || '');
          break;
        }
      }
      
      // Look for prices
      let prices: string[] = [];
      for (const selector of possiblePriceSelectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          prices = Array.from(elements).map((el: Element) => el.textContent?.trim() || '');
          break;
        }
      }
      
      // Create products from matching titles and prices
      const count = Math.min(titles.length, prices.length, 10); // Limit to 10 products
      for (let i = 0; i < count; i++) {
        products.push({
          productName: titles[i] || 'Ürün Adı Bulunamadı',
          price: prices[i] || '',
          rating: '',
          businessName: domain,
          description: '',
          reviewCount: '',
          url: url,
          imageUrl: ''
        });
        
        foundProducts = true;
      }
    }
    
    // If we found products, return them
    if (foundProducts && products.length > 0) {
      console.log(`Successfully extracted ${products.length} products directly from HTML`);
      return products;
    }
    
    // If we couldn't find any products, return a placeholder
    console.log('Could not extract products directly from HTML');
    return [{
      productName: "HTML'den ürün çıkarılamadı",
      price: "",
      rating: "",
      businessName: domain,
      description: "Sayfa içeriğinden doğrudan ürün bilgisi alınamadı.",
      reviewCount: "",
      url: url,
      imageUrl: ""
    }];
  } catch (error) {
    console.error('Error in direct HTML extraction:', error);
    
    // Return a placeholder product in case of error
    return [{
      productName: "HTML işleme hatası",
      price: "",
      rating: "",
      businessName: domain,
      description: `HTML işleme hatası: ${error instanceof Error ? error.message : 'Bilinmeyen hata'}`,
      reviewCount: "",
      url: url,
      imageUrl: ""
    }];
  }
}

// Function to extract the most relevant content from a webpage based on domain
export function extractRelevantContent(html: string): string {
  try {
    // JSDOM kullanarak body içeriğini çıkar - regex kullanmadan
    const { JSDOM } = require('jsdom');
    const dom = new JSDOM(html);
    const bodyContent = dom.window.document.body.innerHTML;
    
    // Body içeriği varsa döndür
    if (bodyContent && bodyContent.length > 0) {
      return bodyContent;
    }
    
    // Eğer body içeriği çıkarılamazsa, orijinal HTML'i döndür
    return html;
  } catch (error) {
    console.error('Error extracting content:', error);
    return html; // Hata durumunda orijinal içeriği döndür
  }
}

// Helper function to clean text from HTML
export function cleanText(html: string): string {
  return html
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/&nbsp;/g, ' ') // Replace &nbsp; with spaces
    .replace(/&amp;/g, '&') // Replace &amp; with &
    .replace(/&lt;/g, '<') // Replace &lt; with <
    .replace(/&gt;/g, '>') // Replace &gt; with >
    .replace(/&quot;/g, '"') // Replace &quot; with "
    .replace(/&#39;/g, "'") // Replace &#39; with '
    .replace(/\s+/g, ' ') // Replace multiple spaces with a single space
    .trim(); // Remove leading and trailing spaces
}

// Function to extract body content without using regex
export function extractBodyContent(html: string): string {
  try {
    // Create a DOM parser to parse the HTML properly
    const { JSDOM } = require('jsdom');
    const dom = new JSDOM(html);
    const bodyContent = dom.window.document.body.innerHTML;
    
    // If we got body content, return it
    if (bodyContent && bodyContent.length > 0) {
      console.log(`Extracted body content using DOM parser: ${bodyContent.length} bytes`);
      return bodyContent;
    }
    
    // If DOM parsing failed, return the original HTML
    return html;
  } catch (error) {
    console.error('Error extracting body content with DOM parser:', error);
    return html;
  }
}

// Function to extract products, considering Cloudflare challenges
export function extractProducts(html: string, url: string): Product[] {
  if (!html || typeof html !== 'string') {
    console.log('Invalid HTML content received');
    return [];
  }

  // First get just the body content
  const bodyContent = getBodyContent(html);

  // Check if we're still on a Cloudflare challenge page
  if (bodyContent.includes('cf-browser-verification') || 
      bodyContent.includes('Just a moment...') ||
      bodyContent.includes('Please wait while we verify your browser') ||
      bodyContent.includes('Checking if the site connection is secure')) {
    console.log('Still on Cloudflare challenge page, cannot extract products');
    return [];
  }

  try {
    // Extract the domain for business name
    const domain = new URL(url).hostname;
    const businessName = domain.replace('www.', '');

    // For Lieferando.de specifically
    if (businessName === 'lieferando.de') {
      return extractLieferandoProducts(bodyContent, url);
    }

    // For other domains, try the direct extraction method
    return extractProductsFromHtml(bodyContent, url, businessName);
  } catch (error) {
    console.error('Error extracting products:', error);
    return [];
  }
}

function extractLieferandoProducts(html: string, url: string): Product[] {
  const products: Product[] = [];
  
  try {
    // Parse HTML using JSDOM to get body content
    const { JSDOM } = require('jsdom');
    const dom = new JSDOM(html);
    const bodyContent = dom.window.document.body.innerHTML;

    // Check for common Lieferando.de menu item selectors
    const menuItemSelectors = [
      '.menu-item',
      '.dish-card',
      '[data-qa="menu-product"]',
      '.meal-container',
      '.product-row'
    ];

    // Use the DOM from JSDOM to query elements
    const document = dom.window.document;

    // Try each selector until we find menu items
    for (const selector of menuItemSelectors) {
      const items = document.querySelectorAll(selector);
      if (items.length > 0) {
        items.forEach(item => {
          const product: Product = {
            productName: item.querySelector('.title, .name, h3')?.textContent?.trim() || '',
            price: item.querySelector('.price')?.textContent?.trim()
              .replace(/[^\d,.]/, '')
              .replace(/^/, '€') || '',
            rating: item.querySelector('.rating')?.textContent?.trim() || '',
            businessName: 'lieferando.de',
            description: item.querySelector('.description')?.textContent?.trim() || '',
            reviewCount: item.querySelector('.review-count')?.textContent?.trim()
              .replace(/[^0-9]/g, '') || '',
            url: url,
            imageUrl: item.querySelector('img')?.getAttribute('src') || ''
          };

          if (product.productName || product.description) {
            products.push(product);
          }
        });

        if (products.length > 0) break;
      }
    }
  } catch (error) {
    console.error('Error parsing Lieferando.de HTML:', error);
  }

  return products;
}

// Function to clean and filter body content
function cleanBodyContent(html: string): string {
  try {
    const { JSDOM } = require('jsdom');
    const dom = new JSDOM(html);
    const document = dom.window.document;

    // Remove script and style tags
    const scriptsAndStyles = document.querySelectorAll('script, style, link, meta');
    scriptsAndStyles.forEach(element => element.remove());

    // Remove hidden elements
    const hiddenElements = document.querySelectorAll('[style*="display: none"], [style*="visibility: hidden"], [hidden]');
    hiddenElements.forEach(element => element.remove());

    // Remove Cloudflare-specific elements
    const cloudflareElements = document.querySelectorAll(
      '[class*="cf-"], [id*="cf-"], [class*="challenge"], [id*="challenge"], .footer, #challenge-running'
    );
    cloudflareElements.forEach(element => element.remove());

    // Remove comments
    const removeComments = (node: Node) => {
      for (let i = 0; i < node.childNodes.length; i++) {
        const child = node.childNodes[i];
        if (child.nodeType === 8) {
          node.removeChild(child);
          i--;
        } else if (child.nodeType === 1) {
          removeComments(child);
        }
      }
    };
    removeComments(document.documentElement);

    // Get clean body content
    return document.body.innerHTML;
  } catch (error) {
    console.error('Error cleaning body content:', error);
    return html;
  }
}

// Updated helper function to get clean body content
export function getBodyContent(html: string): string {
  try {
    // First get the raw body content
    const { JSDOM } = require('jsdom');
    const dom = new JSDOM(html);
    const bodyContent = dom.window.document.body.innerHTML;
    
    if (!bodyContent) {
      return html;
    }

    // Clean and filter the content
    const cleanedContent = cleanBodyContent(bodyContent);
    console.log(`Cleaned body content size: ${cleanedContent.length} bytes`);
    
    return cleanedContent;
  } catch (error) {
    console.error('Error extracting body content:', error);
    return html;
  }
}