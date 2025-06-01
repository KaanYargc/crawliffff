// site-handlers.ts - Site-specific configurations and handlers
import { Page } from 'puppeteer';
import { validatePostCloudflareContent, hasCloudfareCaptcha, bypassCloudflare } from './cloudflare-handler';
import { fetchWithRealBrowser } from './browser-simulator';

interface SiteConfig {
  name: string;
  domains: string[];
  customHeaders?: Record<string, string>;
  requiresCloudflareBypass?: boolean;
  bypassStrategy?: 'puppeteer-real-browser' | 'standard';
  contentValidation?: (html: string) => boolean;
  beforeNavigation?: (page: Page) => Promise<void>;
  afterNavigation?: (page: Page) => Promise<void>;
  extractCustomData?: (html: string, url: string) => Promise<any>;
  userAgent?: string;
  customScripts?: string[];
  maxBypassAttempts?: number;
  waitBetweenAttempts?: number;
}

// Generic site configuration
const genericConfig: SiteConfig = {
  name: 'Generic',
  domains: ['*'],
  requiresCloudflareBypass: false,
  contentValidation: (html: string) => {
    return !html.includes('cf-browser-verification') && !html.includes('challenge-running');
  },
  maxBypassAttempts: 2,
  waitBetweenAttempts: 3000
};

// Lieferando.de site configuration
const lieferandoConfig: SiteConfig = {
  name: 'Lieferando',
  domains: ['lieferando.de'],
  requiresCloudflareBypass: true,
  bypassStrategy: 'puppeteer-real-browser',
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  customHeaders: {
    'Accept-Language': 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7',
    'Referer': 'https://www.google.com/',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'sec-ch-ua': '"Chromium";v="122", "Google Chrome";v="122", "Not:A-Brand";v="99"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"'
  },
  contentValidation: (html: string) => {
    // Enhanced content validation for Lieferando
    if (!html || html.length < 1000) return false;
    
    // Check for Cloudflare challenge page indicators
    const cloudflareIndicators = [
      'Just a moment...',
      'Verifying you are human',
      'challenge-running',
      'cf-browser-verification',
      'turnstile'
    ];
    
    // If any Cloudflare indicators are present, it's not valid content
    if (cloudflareIndicators.some(indicator => html.includes(indicator))) {
      console.log('❌ Lieferando content validation failed: Cloudflare indicators present');
      return false;
    }
    
    // Check for positive menu content indicators
    const menuIndicators = [
      'speisekarte',
      'restaurant-info',
      'menucard',
      'dish-',
      'menu-item',
      'product-name',
      'product-description'
    ];
    
    const hasMenuIndicators = menuIndicators.some(indicator => 
      html.toLowerCase().includes(indicator.toLowerCase())
    );
    
    if (hasMenuIndicators) {
      console.log('✅ Lieferando content validation passed: Menu indicators found');
      return true;
    }
    
    // If we get here, the page isn't a Cloudflare challenge but also doesn't have menu indicators
    // Check if it's a reasonable size for a real page
    if (html.length > 50000) {
      console.log('✅ Lieferando content validation passed based on content size');
      return true;
    }
    
    console.log('❌ Lieferando content validation failed: No menu indicators found');
    return false;
  },
  maxBypassAttempts: 3,
  waitBetweenAttempts: 5000,
  beforeNavigation: async (page: Page) => {
    // Add additional anti-detection measures before navigation
    await page.evaluateOnNewDocument(() => {
      // Override properties even more extensively
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
      Object.defineProperty(navigator, 'languages', { get: () => ['de-DE', 'de', 'en-US', 'en'] });
      
      // Add Chrome browser-specific properties
      window.chrome = {
        app: { isInstalled: false },
        runtime: {} as any,
        loadTimes: function() {},
        csi: function() {},
        // @ts-ignore
        webstore: {}
      };
      
      // More anti-fingerprinting
      const originalQuery = window.navigator.permissions.query;
      // @ts-ignore - We're intentionally returning a simplified object to avoid detection
      window.navigator.permissions.query = (parameters: any) => 
        parameters.name === 'notifications' 
          ? Promise.resolve({ state: Notification.permission, name: parameters.name, onchange: null } as PermissionStatus) 
          : originalQuery(parameters);
    });
  },
  afterNavigation: async (page: Page) => {
    // Wait longer for Lieferando page to fully load
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // Additional scroll behavior to trigger lazy loading
    await page.evaluate(() => {
      window.scrollTo(0, 300);
      setTimeout(() => window.scrollTo(0, 600), 500);
      setTimeout(() => window.scrollTo(0, 900), 1000);
      setTimeout(() => window.scrollTo(0, 0), 1500);
    });
    
    // Wait for potential menu items to load
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
};

// Map to store site configurations
const siteConfigs = new Map<string, SiteConfig>([
  ['*', genericConfig],
  ['lieferando.de', lieferandoConfig]
]);

// Function to get site configuration based on URL
export function getSiteConfig(url: string): SiteConfig {
  try {
    const domain = new URL(url).hostname.replace('www.', '');
    
    // Özel site yapılandırmasını kontrol et
    for (const [configDomain, config] of siteConfigs.entries()) {
      if (domain.includes(configDomain) && configDomain !== '*') {
        console.log(`Found custom configuration for domain: ${domain}`);
        return config;
      }
    }
    
    // Eşleşme bulunamazsa generic yapılandırmayı kullan
    return genericConfig;
  } catch (error) {
    console.error('Error parsing URL:', error);
    return genericConfig;
  }
}

// Function to check if a URL is supported
export function isSiteSupported(url: string): boolean {
  try {
    const domain = new URL(url).hostname.replace('www.', '');
    
    // Doğrudan eşleşme kontrolü
    for (const configDomain of siteConfigs.keys()) {
      if (domain.includes(configDomain) && configDomain !== '*') {
        return true;
      }
    }
    
    // Generic handler varsayılan olarak tüm URL'leri destekler
    return true;
  } catch (error) {
    console.error('Error checking if site is supported:', error);
    return true;
  }
}

// Custom handler for Lieferando.de
export async function handleLieferando(url: string): Promise<string> {
  console.log('Found custom configuration for domain: lieferando.de');
  
  // First try Cloudflare manual CAPTCHA solving approach
  console.log('Detected known Cloudflare-protected site (lieferando.de), trying manual CAPTCHA solving first...');
  const manualContent = await bypassCloudflare(url, 'lieferando.de');
  
  // Validate the content using looser criteria specifically for Lieferando
  if (manualContent && manualContent.length > 8000) {
    console.log('Found valid Lieferando menu content after CAPTCHA solving!');
    
    // Return the content even if it still has some Cloudflare indicators
    // as long as it contains restaurant-specific elements
    if (manualContent.includes('restaurant-name') || 
        manualContent.includes('dish-card') || 
        manualContent.includes('menu-category') ||
        manualContent.includes('speisekarte')) {
      return manualContent;
    }
    
    // If content doesn't have specific restaurant indicators but is large enough,
    // it may still be valid content - especially for Lieferando
    if (manualContent.length > 50000) {
      console.log('Content large enough to be valid. Size:', manualContent.length, 'bytes');
      return manualContent;
    }
    
    // Check for indicators that this is still a Cloudflare page
    if (manualContent.includes('Just a moment') && 
        manualContent.includes('Checking if the site connection is secure')) {
      console.log('❌ Lieferando content validation failed: Still on Cloudflare page');
      console.log('Invalid content received for lieferando.de');
    } else {
      // Content passes basic validation
      return manualContent;
    }
  }
  
  console.log('Manual CAPTCHA solving did not yield valid content, trying alternative method...');
  
  // Try multiple fallback methods
  try {
    // Attempt 1: Standard browser simulation
    console.log('Attempt 1: Using standard browser simulation...');
    const { content } = await fetchWithRealBrowser(url);
    
    if (content && content.length > 8000) {
      // Validate the content
      if (!hasCloudfareCaptcha(content, 'lieferando.de')) {
        console.log('Successfully bypassed Cloudflare for lieferando.de with browser simulation');
        return content;
      } else {
        console.log('❌ Content still contains Cloudflare indicators, trying next method');
      }
    }
    
    // Attempt 2: Try again with a different approach
    console.log('Attempt 2: Using alternate browser settings...');
    // Use fetchWithRealBrowser with custom options
    const { content: alternateContent } = await fetchWithRealBrowser(url, {
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
      extraHeaders: {
        'Accept-Language': 'de-DE,de;q=0.9,en;q=0.8',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      },
      extraWaitTime: 15000 // Wait longer
    });
    
    if (alternateContent && alternateContent.length > 8000) {
      console.log('Successfully retrieved content with alternate browser settings');
      return alternateContent;
    }
    
    // If we've gotten this far, both methods failed
    console.log('❌ All automated methods failed to retrieve valid content');
    
    // Return the largest content we got, if any
    if (manualContent && manualContent.length > 0) {
      console.log('Returning manual content as last resort');
      return manualContent;
    } else if (content && content.length > 0) {
      console.log('Returning content from first attempt as last resort');
      return content;
    } else if (alternateContent && alternateContent.length > 0) {
      console.log('Returning content from second attempt as last resort');
      return alternateContent;
    }
    
  } catch (error) {
    console.error('Error fetching Lieferando content:', error);
  }
  
  console.log('Failed to get valid content from lieferando.de');
  return '';
}

// Custom handler for Lieferando.de - simplified to just return raw HTML
export async function handleLieferandoRaw(url: string, content?: string): Promise<{ success: boolean, products: any[], message?: string, htmlContent?: string, rawHtml?: string }> {
  console.log('Using specialized handler for lieferando.de');
  
  if (!content) {
    console.log('No content provided for Lieferando handler');
    return { success: false, products: [], message: 'No content provided' };
  }
  
  // Return the full HTML content directly without parsing or filtering
  return { 
    success: true, 
    products: [],
    htmlContent: content,
    rawHtml: content, // Include the raw HTML as requested
    message: 'Raw HTML content extracted as requested' 
  };
}