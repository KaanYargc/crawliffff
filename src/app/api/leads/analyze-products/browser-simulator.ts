// browser-simulator.ts - Tarayıcı simülasyonu ve insan davranışı işlevleri
import puppeteer, { Page } from 'puppeteer';
import puppeteerExtra from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import AdblockerPlugin from 'puppeteer-extra-plugin-adblocker';

// Initialize plugins
puppeteerExtra.use(StealthPlugin());
puppeteerExtra.use(AdblockerPlugin({ blockTrackers: true }));

// Generate a random user agent
export function getRandomUserAgent(): string {
  const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
  ];
  return userAgents[Math.floor(Math.random() * userAgents.length)];
}

// Get realistic headers for requests
export function getRealisticHeaders(referer: string = 'https://www.google.com/'): Record<string, string> {
  return {
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9,tr;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Sec-CH-UA': '"Not=A?Brand";v="99", "Chromium";v="122"',
    'Sec-CH-UA-Mobile': '?0',
    'Sec-CH-UA-Platform': '"Windows"',
    'Referer': referer
  };
}

// Apply stealth techniques to the page
export async function applyAdvancedStealth(page: Page): Promise<void> {
  await page.evaluateOnNewDocument(() => {
    // Define chrome object without type checking
    // @ts-ignore
    window.chrome = {
      runtime: {
        // @ts-ignore
        OnInstalledReason: {
          // @ts-ignore
          CHROME_UPDATE: 'chrome_update',
          // @ts-ignore
          INSTALL: 'install',
          // @ts-ignore
          SHARED_MODULE_UPDATE: 'shared_module_update',
          // @ts-ignore
          UPDATE: 'update'
        }
      }
    };

    // Add language and platform
    Object.defineProperty(navigator, 'languages', {
      get: () => ['en-US', 'en', 'tr'],
    });

    Object.defineProperty(navigator, 'platform', {
      get: () => 'Win32',
    });

    // Hide automation flags
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined,
    });
  });
}

// Simulate human-like scrolling
export async function humanLikeScrolling(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await new Promise<void>((resolve) => {
      const totalHeight = document.body.scrollHeight;
      let scrolled = 0;
      
      const scroll = () => {
        const scrollAmount = Math.floor(Math.random() * 200) + 100;
        window.scrollBy(0, scrollAmount);
        scrolled += scrollAmount;
        
        const pause = Math.floor(Math.random() * 1000) + 500;
        
        if (scrolled >= totalHeight * 0.8) {
          setTimeout(() => {
            window.scrollTo(0, 0);
            resolve();
          }, 1000);
          return;
        }
        
        setTimeout(scroll, pause);
      };
      
      setTimeout(scroll, 1000);
    });
  });
}

// Simulate real browser behavior
export async function simulateRealBrowser(page: Page): Promise<void> {
  await page.evaluate(() => {
    const basicFeatures = {
      deviceMemory: 8,
      hardwareConcurrency: 8,
      platform: 'Win32',
      userAgent: navigator.userAgent,
    };

    Object.entries(basicFeatures).forEach(([key, value]) => {
      if (!(key in navigator)) {
        Object.defineProperty(navigator, key, { value });
      }
    });
  });
}

// Export fetchWebsiteContent function
export async function fetchWebsiteContent(url: string): Promise<{ content: string }> {
  const browser = await puppeteerExtra.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--window-size=1920,1080',
      '--disable-gpu'
    ]
  });

  try {
    const page = await browser.newPage();
    
    await applyAdvancedStealth(page);
    await simulateRealBrowser(page);
    
    await page.setExtraHTTPHeaders(getRealisticHeaders());
    
    await page.goto(url, {
      waitUntil: ['networkidle0', 'domcontentloaded'],
      timeout: 30000
    });

    await humanLikeScrolling(page);
    const content = await page.content();
    
    return { content };
  } catch (error) {
    console.error('Error fetching website content:', error);
    return { content: '' };
  } finally {
    await browser.close();
  }
}