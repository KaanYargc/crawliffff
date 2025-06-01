// browser-simulator.ts - Web sitelerinden veri çekme işlevleri
import puppeteer, { Browser, Page } from 'puppeteer';
import { hasCloudfareCaptcha, isCloudflareHtml, bypassCloudflare } from './cloudflare-handler';
import { extractDomainFromUrl } from './utils';

// Helper function for timeout since page.waitForTimeout may not be available
async function waitForTimeout(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Configuration for different browser simulation strategies
const BROWSER_CONFIG = {
  // Default browser configuration
  DEFAULT: {
    headless: 'new',
    args: [
      '--no-sandbox', 
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
      '--window-size=1920,1080',
    ],
    defaultViewport: { width: 1920, height: 1080 }
  },
  // Enhanced configuration for CAPTCHA bypass
  ENHANCED: {
    headless: false,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process',
      '--window-size=1920,1080',
      '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'
    ],
    defaultViewport: { width: 1920, height: 1080 }
  },
  // Browser fingerprint randomization parameters
  FINGERPRINT_PARAMS: [
    '--disable-features=site-per-process',
    '--disable-blink-features=AutomationControlled',
    '--user-data-dir=/tmp/chrome-data'
  ]
};

// Custom user agents to rotate through
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36 Edg/123.0.0.0',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
];

// Session storage for keeping track of browser instances
let browserInstance: Browser | null = null;

// Domain-specific handlers for special cases
const DOMAIN_HANDLERS: Record<string, (page: Page) => Promise<void>> = {
  'lieferando.de': async (page: Page) => {
    // Wait for the menu to load
    await page.waitForSelector('.restaurant-menu-products', { timeout: 15000 }).catch(() => {});
    // Accept cookies if the dialog appears
    await page.evaluate(() => {
      const cookieButton = document.querySelector('.cookie-consent-accept-button');
      if (cookieButton) (cookieButton as HTMLElement).click();
    });
    // Additional wait to ensure content loads fully
    await waitForTimeout(2000);
  },
  'yelp.com': async (page: Page) => {
    // Accept cookies if present
    await page.evaluate(() => {
      const cookieButtons = Array.from(document.querySelectorAll('button')).filter(el => 
        el.textContent?.includes('Accept') || el.textContent?.includes('I Agree')
      );
      if (cookieButtons.length) (cookieButtons[0] as HTMLElement).click();
    });
    // Wait for business details to load
    await page.waitForSelector('.biz-page-header', { timeout: 10000 }).catch(() => {});
  }
};

// Get a random user agent from our list
function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

// Initialize a browser instance with enhanced settings to avoid detection
async function initBrowser(enhanced = false, domain?: string): Promise<Browser> {
  if (browserInstance) {
    return browserInstance;
  }

  // Determine if we should use visible browser or headless
  let config = BROWSER_CONFIG.DEFAULT;
  
  if (enhanced) {
    // ONLY use visible browser for lieferando.de
    if (domain === 'lieferando.de') {
      config = BROWSER_CONFIG.ENHANCED; // This uses headless: false
    } else {
      // For all other domains, use headless even with enhanced settings
      config = {
        ...BROWSER_CONFIG.DEFAULT,
        args: [
          ...BROWSER_CONFIG.DEFAULT.args,
          ...BROWSER_CONFIG.FINGERPRINT_PARAMS,
          `--user-agent=${getRandomUserAgent()}`
        ]
      };
    }
  }

  browserInstance = await puppeteer.launch(config);
  
  // Set up cleanup on process exit
  process.on('exit', async () => {
    if (browserInstance) {
      await browserInstance.close();
      browserInstance = null;
    }
  });

  return browserInstance;
}

// Basic fetch function using fetch API
async function basicFetch(url: string): Promise<string> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': getRandomUserAgent(),
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

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    return await response.text();
  } catch (error) {
    console.error(`Error in basicFetch for ${url}:`, error);
    return '';
  }
}

// Standard fetch with Puppeteer
export async function fetchWithPuppeteer(url: string): Promise<{ content: string; error?: string }> {
  let browser: Browser | null = null;
  let page: Page | null = null;

  try {
    // Initialize browser
    browser = await initBrowser();
    
    // Create a new page
    page = await browser.newPage();

    // Set a random user agent
    await page.setUserAgent(getRandomUserAgent());

    // Set extra HTTP headers
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    });

    // Navigate to the URL with timeout
    await page.goto(url, { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });

    // Apply domain-specific handlers if applicable
    const domain = extractDomainFromUrl(url);
    if (domain && DOMAIN_HANDLERS[domain]) {
      await DOMAIN_HANDLERS[domain](page);
    }

    // Wait for potential dynamic content to load
    await waitForTimeout(2000);

    // Get the page content
    const content = await page.content();

    // Check if there's a Cloudflare challenge
    if (isCloudflareHtml(content, domain)) {
      return { 
        content: '',
        error: 'Cloudflare challenge detected' 
      };
    }

    return { content };
  } catch (error) {
    console.error(`Error fetching with Puppeteer for ${url}:`, error);
    return { content: '', error: String(error) };
  } finally {
    if (page) await page.close().catch(() => {});
    // We don't close the browser to reuse it
  }
}

// Enhanced fetch with puppeteer-real-browser
export async function fetchWithRealBrowser(
  url: string, 
  options?: {
    userAgent?: string;
    extraHeaders?: Record<string, string>;
    extraWaitTime?: number;
    disableJS?: boolean;
  }
): Promise<{ content: string; error?: string }> {
  let browser: Browser | null = null;
  let page: Page | null = null;
  const domain = extractDomainFromUrl(url);

  try {
    // Initialize browser with enhanced settings - pass the domain to ensure proper headless mode
    browser = await initBrowser(true, domain);
    
    // Create a new page
    page = await browser.newPage();

    // Randomize fingerprint
    await page.evaluateOnNewDocument(() => {
      // Override the navigator properties
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false
      });
      
      // Override user agent
      window.navigator.chrome = {
        runtime: {} as any
      };
      
      // Add language
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en', 'de-DE', 'de']
      });
      
      // Spoof plugins
      Object.defineProperty(navigator, 'plugins', {
        get: () => {
          return [
            {
              name: 'Chrome PDF Plugin',
              description: 'Portable Document Format',
              filename: 'internal-pdf-viewer',
              length: 1
            },
            {
              name: 'Chrome PDF Viewer',
              description: '',
              filename: 'chrome-pdf-viewer',
              length: 1
            },
            {
              name: 'Native Client',
              description: '',
              filename: 'internal-nacl-plugin',
              length: 1
            }
          ];
        }
      });
    });

    // Set viewport with realistic screen resolution
    await page.setViewport({ width: 1920, height: 1080 });

    // Set a user agent - either provided or random
    const userAgent = options?.userAgent || getRandomUserAgent();
    await page.setUserAgent(userAgent);

    // Set cookies
    await page.setCookie({
      name: 'cf_clearance',
      value: 'random_value_' + Date.now(),
      domain: extractDomainFromUrl(url),
      httpOnly: true,
      secure: true
    });
    
    // Set additional cookies for Lieferando if that's the domain
    if (domain === 'lieferando.de') {
      await page.setCookie({
        name: 'lftcksssn',
        value: 'true',
        domain: 'lieferando.de',
        path: '/'
      });
    }

    // Set extra HTTP headers - combine default with any provided headers
    const defaultHeaders = {
      'Accept-Language': 'en-US,en;q=0.9,de-DE;q=0.8,de;q=0.7',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Upgrade-Insecure-Requests': '1',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache'
    };
    
    await page.setExtraHTTPHeaders({
      ...defaultHeaders,
      ...(options?.extraHeaders || {})
    });

    // Disable JavaScript if requested
    if (options?.disableJS) {
      await page.setJavaScriptEnabled(false);
    }

    // Configure additional protection evasion
    await page.evaluateOnNewDocument(() => {
      // Override more navigator properties
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      Object.defineProperty(navigator, 'platform', { get: () => 'Win32' });
      
      // Override Permissions API
      const originalQuery = window.navigator.permissions.query;
      // @ts-ignore
      window.navigator.permissions.query = (parameters) => {
        if (parameters.name === 'notifications') {
          return Promise.resolve({ state: 'denied', onchange: null, name: '' });
        }
        return originalQuery(parameters);
      };
      
      // Spoof additional browser features to appear more human-like
      // @ts-ignore
      window.navigator.mediaDevices = { enumerateDevices: () => Promise.resolve([]) };
    });

    // Navigate to the URL with timeout and wait for content to load
    console.log(`Navigating to ${url} with custom browser settings...`);
    await page.goto(url, { 
      waitUntil: 'networkidle2',
      timeout: 60000 
    });

    // Apply domain-specific handlers if applicable
    if (domain && DOMAIN_HANDLERS[domain]) {
      await DOMAIN_HANDLERS[domain](page);
    }

    // Wait longer for dynamic content - use custom wait time if provided
    const waitTime = options?.extraWaitTime || 3000;
    await waitForTimeout(waitTime);

    // Scroll through the page to trigger lazy loading content
    try {
      // More human-like scrolling behavior
      await page.evaluate(() => {
        const totalHeight = document.body.scrollHeight;
        let scrolled = 0;
        const scrollStep = 300;
        
        function smoothScroll() {
          if (scrolled < totalHeight) {
            window.scrollBy(0, scrollStep);
            scrolled += scrollStep;
            setTimeout(smoothScroll, 100);
          } else {
            // Scroll back up
            window.scrollTo(0, 0);
          }
        }
        
        smoothScroll();
      });
      
      // Wait for scrolling to complete
      await waitForTimeout(2000);
      
    } catch (error) {
      console.error('Error during scrolling:', error);
      // Continue even if scrolling fails
    }

    // Final wait to ensure all content is loaded
    await waitForTimeout(2000);

    // Check if we're on a page with CAPTCHA
    const hasCaptcha = await page.evaluate(() => {
      return Boolean(
        document.querySelector('#turnstile-wrapper') ||
        document.querySelector('.cf-turnstile') ||
        document.querySelector('iframe[src*="challenges.cloudflare.com"]') ||
        document.querySelector('.cf-browser-verification') ||
        document.querySelector('#challenge-form') ||
        document.title.includes('Just a moment...')
      );
    });
    
    if (hasCaptcha) {
      console.log('CAPTCHA detected on page, trying final bypass techniques...');
      
      // Try clicking any buttons that might be present
      await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        buttons.forEach(button => {
          if (button.innerText.includes('Continue') || 
              button.innerText.includes('I am human') ||
              button.innerText.includes('Verify')) {
            (button as HTMLElement).click();
          }
        });
      });
      
      // Wait a bit after clicking
      await waitForTimeout(5000);
    }

    // Get the page content
    const content = await page.content();
    
    // Log content size
    console.log(`Retrieved content size: ${content.length} bytes`);

    // Return the full HTML content without any validation or filtering
    // This ensures we get the complete body content for Gemini
    return { content };
  } catch (error) {
    console.error(`Error fetching with real browser for ${url}:`, error);
    return { content: '', error: `Error fetching with real browser for ${url}: ${String(error)}` };
  } finally {
    if (page) {
      try {
        await page.close();
      } catch (err) {
        console.error('Error closing page:', err);
      }
    }
    // We don't close the browser to reuse it
  }
}

// Enhanced fetch with headless browser - modified version of fetchWithRealBrowser that always uses headless mode
export async function fetchWithHeadlessEnhancedBrowser(
  url: string, 
  options?: {
    userAgent?: string;
    extraHeaders?: Record<string, string>;
    extraWaitTime?: number;
    disableJS?: boolean;
  }
): Promise<{ content: string; error?: string }> {
  let browser: Browser | null = null;
  let page: Page | null = null;

  try {
    // Create a custom browser config with headless mode enabled
    const headlessConfig = {
      headless: 'new', // Always use headless mode
      args: [
        ...BROWSER_CONFIG.DEFAULT.args,
        ...BROWSER_CONFIG.FINGERPRINT_PARAMS,
      ],
      defaultViewport: { width: 1920, height: 1080 }
    };

    // Launch browser with headless config
    browser = await puppeteer.launch(headlessConfig);
    
    // Create a new page
    page = await browser.newPage();

    // Randomize fingerprint - same as fetchWithRealBrowser
    await page.evaluateOnNewDocument(() => {
      // Override the navigator properties
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false
      });
      
      // Override user agent
      window.navigator.chrome = {
        runtime: {} as any
      };
      
      // Add language
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en', 'de-DE', 'de']
      });
      
      // Spoof plugins
      Object.defineProperty(navigator, 'plugins', {
        get: () => {
          return [
            {
              name: 'Chrome PDF Plugin',
              description: 'Portable Document Format',
              filename: 'internal-pdf-viewer',
              length: 1
            },
            {
              name: 'Chrome PDF Viewer',
              description: '',
              filename: 'chrome-pdf-viewer',
              length: 1
            },
            {
              name: 'Native Client',
              description: '',
              filename: 'internal-nacl-plugin',
              length: 1
            }
          ];
        }
      });
    });

    // Set viewport with realistic screen resolution
    await page.setViewport({ width: 1920, height: 1080 });

    // Set a user agent - either provided or random
    const userAgent = options?.userAgent || getRandomUserAgent();
    await page.setUserAgent(userAgent);

    // Set cookies
    await page.setCookie({
      name: 'cf_clearance',
      value: 'random_value_' + Date.now(),
      domain: extractDomainFromUrl(url),
      httpOnly: true,
      secure: true
    });
    
    // Set extra HTTP headers - combine default with any provided headers
    const defaultHeaders = {
      'Accept-Language': 'en-US,en;q=0.9,de-DE;q=0.8,de;q=0.7',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Upgrade-Insecure-Requests': '1',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache'
    };
    
    await page.setExtraHTTPHeaders({
      ...defaultHeaders,
      ...(options?.extraHeaders || {})
    });

    // Disable JavaScript if requested
    if (options?.disableJS) {
      await page.setJavaScriptEnabled(false);
    }

    // Configure additional protection evasion
    await page.evaluateOnNewDocument(() => {
      // Override more navigator properties
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      Object.defineProperty(navigator, 'platform', { get: () => 'Win32' });
      
      // Override Permissions API
      const originalQuery = window.navigator.permissions.query;
      // @ts-ignore
      window.navigator.permissions.query = (parameters) => {
        if (parameters.name === 'notifications') {
          return Promise.resolve({ state: 'denied', onchange: null, name: '' });
        }
        return originalQuery(parameters);
      };
      
      // Spoof additional browser features to appear more human-like
      // @ts-ignore
      window.navigator.mediaDevices = { enumerateDevices: () => Promise.resolve([]) };
    });

    // Navigate to the URL with timeout and wait for content to load
    console.log(`Navigating to ${url} with headless enhanced browser...`);
    await page.goto(url, { 
      waitUntil: 'networkidle2',
      timeout: 60000 
    });

    // Apply domain-specific handlers if applicable
    const domain = extractDomainFromUrl(url);
    if (domain && DOMAIN_HANDLERS[domain]) {
      await DOMAIN_HANDLERS[domain](page);
    }

    // Wait longer for dynamic content - use custom wait time if provided
    const waitTime = options?.extraWaitTime || 3000;
    await waitForTimeout(waitTime);

    // Scroll through the page to trigger lazy loading content
    try {
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight / 2);
        setTimeout(() => {
          window.scrollTo(0, document.body.scrollHeight);
        }, 500);
        setTimeout(() => {
          window.scrollTo(0, 0);
        }, 1000);
      });
      
      // Wait for scrolling to complete
      await waitForTimeout(1500);
    } catch (error) {
      console.error('Error during scrolling:', error);
    }

    // Get the page content
    const content = await page.content();
    
    // Log content size
    console.log(`Retrieved content size: ${content.length} bytes`);

    return { content };
  } catch (error) {
    console.error(`Error fetching with headless enhanced browser for ${url}:`, error);
    return { content: '', error: `Error fetching with headless browser: ${String(error)}` };
  } finally {
    if (page) await page.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
  }
}

// Multi-stage fetch strategy with fallbacks
export async function fetchWebsiteContent(url: string): Promise<{ content: string; error?: string }> {
  console.log(`Fetching content from: ${url}`);
  
  // Extract domain for domain-specific handling
  const domain = extractDomainFromUrl(url);

  // ONLY for lieferando.de, go directly to manual CAPTCHA solving with visible browser
  if (domain === 'lieferando.de') {
    console.log(`Detected lieferando.de, using manual CAPTCHA solving with visible browser...`);
    try {
      console.log('Opening browser window for manual CAPTCHA solving...');
      const bypassContent = await bypassCloudflare(url, domain);
      
      if (bypassContent) {
        console.log('Successfully retrieved content after manual CAPTCHA solving');
        return { content: bypassContent };
      } else {
        console.log('Manual CAPTCHA solving failed, falling back to automated methods');
      }
    } catch (error) {
      console.log('Error during manual CAPTCHA solving:', error);
    }
  }
  
  // For all other domains, use headless approaches only
  // Stage 1: Try basic fetch first (fastest, least resource-intensive)
  try {
    console.log('Stage 1: Attempting basic fetch...');
    const basicContent = await basicFetch(url);
    
    // Check if we got a Cloudflare challenge
    if (!basicContent || isCloudflareHtml(basicContent, domain) || hasCloudfareCaptcha(basicContent, domain)) {
      console.log('Basic fetch encountered Cloudflare protection, moving to Stage 2');
    } else {
      console.log('Stage 1 successful: Got content with basic fetch');
      return { content: basicContent };
    }
  } catch (error) {
    console.log('Stage 1 failed:', error);
  }
  
  // Stage 2: Try standard Puppeteer (headless)
  try {
    console.log('Stage 2: Attempting standard Puppeteer fetch...');
    const { content, error } = await fetchWithPuppeteer(url);
    
    if (error || !content || isCloudflareHtml(content, domain) || hasCloudfareCaptcha(content, domain)) {
      console.log('Standard Puppeteer encountered Cloudflare protection, moving to Stage 3');
    } else {
      console.log('Stage 2 successful: Got content with standard Puppeteer');
      return { content };
    }
  } catch (error) {
    console.log('Stage 2 failed:', error);
  }
  
  // Stage 3: Try puppeteer with enhanced settings but still headless
  try {
    console.log('Stage 3: Attempting fetch with enhanced browser simulation (headless)...');
    // Use a modified version of fetchWithRealBrowser that ensures headless mode
    const { content, error } = await fetchWithRealBrowser(url, { userAgent: getRandomUserAgent() });
    
    if (error || !content || hasCloudfareCaptcha(content, domain)) {
      console.log('Enhanced headless browser simulation failed to bypass Cloudflare');
    } else {
      console.log('Stage 3 successful: Got content with enhanced headless browser simulation');
      return { content };
    }
  } catch (error) {
    console.log('Stage 3 failed:', error);
  }
  
  // No manual CAPTCHA solving for other domains
  console.log('All stages failed to bypass Cloudflare protection');
  return { 
    content: '',
    error: 'Failed to bypass protection after multiple attempts' 
  };
}