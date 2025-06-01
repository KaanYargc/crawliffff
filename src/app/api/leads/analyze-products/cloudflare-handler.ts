// cloudflare-handler.ts - Cloudflare tespiti ve atlatma işlevleri
import puppeteer, { Browser, Page } from 'puppeteer';
import { fetchWithRealBrowser } from './browser-simulator';
import { extractDomainFromUrl } from './utils';

// Helper function for timeout
async function waitForTimeout(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Cloudflare challenge detection patterns
const CLOUDFLARE_PATTERNS = {
  GENERAL: [
    'cf-browser-verification',
    'Checking if the site connection is secure',
    'Ray ID:',
    'challenge-form',
    'challenge-running',
    '_cf_chl_opt'
  ],
  TURNSTILE: [
    'turnstile-wrapper',
    'cf-turnstile',
    'cf-chl-widget',
    '#wBIvQ7'
  ],
  CAPTCHA: [
    'cf-captcha-container',
    'hcaptcha-box',
    'g-recaptcha'
  ],
  LIEFERANDO: [
    'Just a moment',
    'Please complete the security check to access',
    'Aşağıdaki işlemi tamamlayarak insan olduğunuzu doğrulayın',
    'Es wird bestätigt, dass Sie ein Mensch sind',
    'www.lieferando.de muss die Sicherheit Ihrer Verbindung überprüfen'
  ]
};

// Additional patterns for enhanced detection
const ENHANCED_PATTERNS = {
  // High-confidence patterns (definitive CAPTCHA markers)
  HIGH_CONFIDENCE: [
    '<input type="hidden" name="cf-turnstile-response"',
    'id="cf-chl-widget-',
    'challenges.cloudflare.com/turnstile/v0/api.js',
    '<title>Just a moment...</title>',
    'Please complete the security check to access',
    '<div id="wBIvQ7"',
    'cf_chl_opt.chlApiSt',
  ],
  // Medium-confidence patterns (probably CAPTCHA)
  MEDIUM_CONFIDENCE: [
    'ray id:',
    'challenge-platform',
    'loading-verifying',
    'cf-spinner',
    'challenge-running',
    'verify you are human',
    'turnstile',
  ],
  // Low-confidence patterns (might be CAPTCHA)
  LOW_CONFIDENCE: [
    'cloudflare',
    'security check',
    'lds-ring',
    'main-wrapper',
    'human verification',
  ],
  // Page structure indicators
  PAGE_STRUCTURE: [
    '<body class="no-js">',
    '<div class="main-wrapper">',
    'spacer',
    'cloudflare-app',
  ]
};

// Specific patterns for lieferando.de menu content
const LIEFERANDO_MENU_PATTERNS = {
  MENU_SECTIONS: [
    'speisekarte',
    'menucard',
    'menu-list',
    'restaurant-menu-products',
    'restaurant-menu'
  ],
  RESTAURANT_INFO: [
    'restaurant-name',
    'restaurant-info',
    'restaurant-header'
  ],
  MENU_ITEMS: [
    'dish-card',
    'menu-item',
    'product-name',
    'product-description'
  ]
};

// Check if HTML contains Cloudflare challenge markers
export function isCloudflareHtml(html: string, domain: string): boolean {
  const cloudflareIndicators = [
    'checking your browser',
    'cloudflare',
    'ray id',
    'security check',
    'challenge-form',
    'cf-browser-verification',
    'cf_captcha_kind',
    'jschl-answer',
    '_cf_chl_opt',
    'cf_challenge',
    'human verification'
  ];

  const lowerHtml = html.toLowerCase();
  
  // Check for common Cloudflare indicators
  const hasCloudflareIndicators = cloudflareIndicators.some(indicator => 
    lowerHtml.includes(indicator.toLowerCase())
  );

  // Check for domain-specific patterns
  const domainPatterns: { [key: string]: string[] } = {
    'lieferando.de': [
      'Es wird bestätigt, dass Sie ein Mensch sind',
      'muss die Sicherheit Ihrer Verbindung überprüfen',
      'verifying you are human'
    ]
  };

  const domainSpecificIndicators = domainPatterns[domain] || [];
  const hasDomainSpecificIndicators = domainSpecificIndicators.some(indicator =>
    html.includes(indicator)
  );

  // Check page structure
  const hasTypicalStructure = (
    html.includes('main-wrapper') &&
    html.includes('main-content') &&
    html.includes('spacer')
  );

  // Enhanced detection for dynamic challenges
  const hasDynamicElements = (
    html.includes('loading-verifying') ||
    html.includes('turnstile') ||
    html.includes('cf-spinner') ||
    html.includes('challenge-running')
  );

  return hasCloudflareIndicators || hasDomainSpecificIndicators || (hasTypicalStructure && hasDynamicElements);
}

// Specifically check if Cloudflare CAPTCHA is present using a scoring system
export function hasCloudfareCaptcha(html: string, domain: string, isAfterManualSolving = false): boolean {
  if (!html) return false;
  
  const lowerHtml = html.toLowerCase();
  
  // Check if this is Lieferando.de after manual solving
  if (isAfterManualSolving && domain === 'lieferando.de') {
    // Look for definitive indicators of valid content
    if (lowerHtml.includes('speisekarte') || 
        lowerHtml.includes('restaurant-info') ||
        lowerHtml.includes('menucard') ||
        lowerHtml.includes('dish-')) {
      console.log('✅ Lieferando content appears valid after manual CAPTCHA solving');
      return false; // Not a CAPTCHA page, it's valid content
    }
  }
  
  // Calculate a CAPTCHA score based on detected patterns
  let captchaScore = 0;
  let detectionLog: string[] = [];
  
  // Check for high-confidence patterns (worth 100 points each)
  for (const pattern of ENHANCED_PATTERNS.HIGH_CONFIDENCE) {
    if (lowerHtml.includes(pattern.toLowerCase())) {
      // Reduce score for common false positives after manual solving
      const score = (isAfterManualSolving && 
                    (pattern === '<title>Just a moment...</title>' || 
                     pattern === '<div id="wBIvQ7"')) ? 50 : 100;
      
      captchaScore += score;
      detectionLog.push(`HIGH CONFIDENCE: "${pattern}"`);
    }
  }
  
  // If manual solving has been done, require a higher score to identify as CAPTCHA
  const requiredScore = isAfterManualSolving ? 200 : 100;
  
  // If high-confidence patterns are found beyond the threshold
  if (captchaScore >= requiredScore) {
    console.log(`🔒 CAPTCHA detected with high confidence: Score ${captchaScore}`);
    console.log(`   Evidence: ${detectionLog.join(', ')}`);
    return true;
  }
  
  // Check for medium-confidence patterns (worth 30 points each)
  for (const pattern of ENHANCED_PATTERNS.MEDIUM_CONFIDENCE) {
    if (lowerHtml.includes(pattern.toLowerCase())) {
      captchaScore += 30;
      detectionLog.push(`MEDIUM CONFIDENCE: "${pattern}"`);
    }
  }
  
  // Check for low-confidence patterns (worth 10 points each)
  for (const pattern of ENHANCED_PATTERNS.LOW_CONFIDENCE) {
    if (lowerHtml.includes(pattern.toLowerCase())) {
      captchaScore += 10;
      detectionLog.push(`LOW CONFIDENCE: "${pattern}"`);
    }
  }
  
  // Check for page structure indicators (worth 5 points each)
  for (const pattern of ENHANCED_PATTERNS.PAGE_STRUCTURE) {
    if (lowerHtml.includes(pattern.toLowerCase())) {
      captchaScore += 5;
      detectionLog.push(`PAGE STRUCTURE: "${pattern}"`);
    }
  }
  
  // Content size heuristic - CAPTCHA pages are typically small
  const isSmallPage = html.length < 30000;
  if (isSmallPage) {
    captchaScore += 20;
    detectionLog.push(`SMALL PAGE SIZE: ${html.length} bytes`);
  }
  
  // Domain-specific scoring adjustments
  if (domain === 'lieferando.de') {
    // Check for specific Lieferando CAPTCHA patterns
    for (const pattern of CLOUDFLARE_PATTERNS.LIEFERANDO) {
      if (lowerHtml.includes(pattern.toLowerCase())) {
        captchaScore += 50;
        detectionLog.push(`DOMAIN SPECIFIC: "${pattern}"`);
      }
    }
    
    // If the content is too small for Lieferando, it's likely a CAPTCHA
    if (html.length < 50000) {
      captchaScore += 20;
      detectionLog.push(`LIEFERANDO SPECIFIC: Page too small (${html.length} bytes)`);
    }
  }
  
  // If score is 50 or greater, consider it a CAPTCHA
  const isCaptcha = captchaScore >= 50;
  
  if (isCaptcha) {
    console.log(`🔒 CAPTCHA detected with score: ${captchaScore}`);
    console.log(`   Evidence: ${detectionLog.join(', ')}`);
  } else {
    console.log(`✅ No CAPTCHA detected. Score: ${captchaScore}`);
    if (detectionLog.length > 0) {
      console.log(`   Low confidence patterns: ${detectionLog.join(', ')}`);
    }
  }
  
  return isCaptcha;
}

// Check if the content has actual menu data for lieferando.de
export function hasLieferandoMenuContent(html: string): boolean {
  if (!html) return false;
  
  const lowerHtml = html.toLowerCase();
  
  // Check for presence of menu sections
  const hasMenuSection = LIEFERANDO_MENU_PATTERNS.MENU_SECTIONS
    .some(pattern => lowerHtml.includes(pattern.toLowerCase()));
    
  // Check for restaurant info
  const hasRestaurantInfo = LIEFERANDO_MENU_PATTERNS.RESTAURANT_INFO
    .some(pattern => lowerHtml.includes(pattern.toLowerCase()));
    
  // Check for menu items
  const hasMenuItems = LIEFERANDO_MENU_PATTERNS.MENU_ITEMS
    .some(pattern => lowerHtml.includes(pattern.toLowerCase()));
    
  // Require at least one type of content to consider it valid (less strict)
  const validContentTypes = [hasMenuSection, hasRestaurantInfo, hasMenuItems]
    .filter(Boolean).length;
    
  return validContentTypes >= 1;
}

// Validate content after Cloudflare bypass
export function validatePostCloudflareContent(html: string, domain: string): boolean {
  // Domain-specific content validation
  const domainValidators: { [key: string]: (html: string) => boolean } = {
    'lieferando.de': (html: string) => {
      return (
        html.includes('speisekarte') ||
        html.includes('restaurant-info') ||
        html.includes('menucard') ||
        html.includes('dish-') ||
        html.length > 5000  // Most valid pages are larger than this
      );
    }
  };

  // Use domain-specific validator if available
  if (domainValidators[domain]) {
    return domainValidators[domain](html);
  }

  // Generic validation
  // Check for common indicators that we're past Cloudflare
  const validContentIndicators = [
    'content-wrapper',
    'main-content',
    'navigation',
    'footer',
    'header'
  ];

  const hasValidContent = validContentIndicators.some(indicator =>
    html.toLowerCase().includes(indicator)
  );

  // Check content length - most valid pages are substantial
  const hasSubstantialContent = html.length > 1000;

  // Check for absence of Cloudflare indicators
  const noCloudflareIndicators = !isCloudflareHtml(html, domain);

  return hasValidContent && hasSubstantialContent && noCloudflareIndicators;
}

// Function to bypass Cloudflare using a manual approach with browser window
export async function bypassCloudflare(url: string, domain?: string): Promise<string> {
  const siteDomain = domain || extractDomainFromUrl(url);
  console.log(`Attempting to bypass Cloudflare for domain: ${siteDomain}...`);
  
  // ONLY open visible browser for lieferando.de, use headless for all other domains
  const useVisibleBrowser = siteDomain === 'lieferando.de';
  console.log(`Using ${useVisibleBrowser ? 'visible' : 'headless'} browser for ${siteDomain}`);
  
  let browser: Browser | null = null;
  let page: Page | null = null;
  
  try {
    // Browser launch configuration - headless for all domains except lieferando.de
    browser = await puppeteer.launch({
      headless: useVisibleBrowser ? false : 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
        '--window-size=1200,800'
      ]
    });
    
    page = await browser.newPage();
    
    // Set a desktop viewport
    await page.setViewport({ width: 1200, height: 800 });
    
    // Set a realistic user agent
    const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36';
    await page.setUserAgent(userAgent);
    
    if (useVisibleBrowser) {
      console.log(`Opening browser window for manual CAPTCHA solving...`);
    } else {
      console.log(`Using headless browser for ${siteDomain}...`);
    }
    
    // Navigate to the target URL
    await page.goto(url, { 
      waitUntil: 'networkidle2',
      timeout: 60000 
    });
    
    // Check if we need to solve a CAPTCHA
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
    
    if (!hasCaptcha) {
      console.log(`No CAPTCHA detected, proceeding with content extraction`);
    } else if (useVisibleBrowser) {
      // Only wait for manual solving if using visible browser (lieferando.de)
      console.log('CAPTCHA detected, waiting for manual solving...');
      
      // Check every 5 seconds if the CAPTCHA is still present
      for (let i = 0; i < 24; i++) {
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        const captchaStillPresent = await page.evaluate(() => {
          return Boolean(
            document.querySelector('#turnstile-wrapper') ||
            document.querySelector('.cf-turnstile') ||
            document.querySelector('iframe[src*="challenges.cloudflare.com"]') ||
            document.querySelector('.cf-browser-verification') ||
            document.querySelector('#challenge-form') ||
            document.title.includes('Just a moment...')
          );
        });
        
        if (!captchaStillPresent) {
          console.log('CAPTCHA appears to be solved, continuing...');
          break;
        }
      }
    } else {
      // For non-lieferando sites with CAPTCHA in headless mode, try auto-clicking
      console.log('CAPTCHA detected in headless mode, attempting automatic bypass...');
      
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
    
    // Give extra time for the content to load fully
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Get the cookies (might be needed for future requests)
    const cookies = await page.cookies();
    const cfClearance = cookies.find(cookie => cookie.name === 'cf_clearance');
    
    if (cfClearance) {
      console.log('Successfully bypassed Cloudflare protection');
    }
    
    // For Lieferando, apply domain-specific content verification
    if (siteDomain === 'lieferando.de') {
      const hasValidContent = await page.evaluate(() => {
        return Boolean(
          document.querySelector('.restaurant-menu-products') ||
          document.querySelector('.restaurant-name')
        );
      });
      
      if (hasValidContent) {
        console.log('Found valid Lieferando menu content after CAPTCHA solving!');
      } else {
        console.log('Lieferando content not found even after CAPTCHA solving');
      }
    }
    
    // Get full page content - return the entire HTML without any filtering
    const fullContent = await page.content();
    
    // Only keep browser open for visible browsers (lieferando.de)
    if (useVisibleBrowser) {
      console.log('Keeping browser open for final content loading...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    return fullContent;
  } catch (error) {
    console.error('Error during manual Cloudflare bypass:', error);
    return '';
  } finally {
    // Close the page but keep the browser open for potential reuse
    // This prevents repeated browser launches which can trigger detection
    if (page) {
      try {
        await page.close();
        console.log('Browser closed after delay');
      } catch (err) {
        console.error('Error closing page:', err);
      }
    }
  }
}

// More specialized function for manual CAPTCHA solving
async function bypassCloudflareWithManualSolving(url: string, domain: string): Promise<string> {
  let browser: Browser | null = null;
  let page: Page | null = null;
  let content = '';
  let finalContent = '';
  
  try {
    console.log('Opening browser for manual CAPTCHA solving...');
    
    // Launch browser in non-headless mode so user can see and interact with it
    browser = await puppeteer.launch({
      headless: false, // Must be non-headless for user interaction
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--window-size=1280,800',
        '--disable-features=IsolateOrigins,site-per-process',
        '--disable-web-security',
        '--disable-blink-features=AutomationControlled'
      ],
      defaultViewport: null // Use the window size as viewport
    });
    
    // Create a new page
    page = await browser.newPage();
    
    // Enhanced fingerprint spoofing
    await page.evaluateOnNewDocument(() => {
      // Override navigator properties to appear as a normal browser
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      
      // Add Chrome browser-specific properties
      window.chrome = {
        app: { isInstalled: false },
        runtime: {} as any,
        loadTimes: function() {},
        csi: function() {},
        webstore: {} as any
      };
      
      // Add language and other navigator properties
      Object.defineProperty(navigator, 'languages', { get: () => ['de-DE', 'de', 'en-US', 'en'] });
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
    });
    
    // Set specific headers to appear like a real browser
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Upgrade-Insecure-Requests': '1',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    });
    
    // Navigate to the URL
    console.log(`Navigating to ${url}. Please solve the CAPTCHA if it appears...`);
    
    // Set a longer timeout for user to solve CAPTCHA
    await page.goto(url, { 
      waitUntil: 'networkidle2',
      timeout: 180000 // 3 minutes timeout to give user time to solve CAPTCHA
    });
    
    // Wait for initial page load
    await waitForTimeout(5000);
    
    // Check if we're facing a Cloudflare challenge
    const hasCaptcha = await page.evaluate(() => {
      // Enhanced CAPTCHA detection - checking both visible elements and page title/content
      const captchaElements = Boolean(
        document.querySelector('#turnstile-wrapper') ||
        document.querySelector('.cf-turnstile') ||
        document.querySelector('iframe[src*="challenges.cloudflare.com"]') ||
        document.querySelector('.cf-browser-verification') ||
        document.querySelector('#challenge-form')
      );
      
      // Check for "Just a moment..." title which is a strong indicator of Cloudflare protection
      const hasCloudflareTitle = document.title.includes('Just a moment...');
      
      // Check for other common Cloudflare indicators in text
      const pageText = document.body.innerText;
      const hasCloudflareText = 
        pageText.includes('Verifying you are human') || 
        pageText.includes('needs to review the security') ||
        pageText.includes('Please complete the security check');
        
      return captchaElements || hasCloudflareTitle || hasCloudflareText;
    });
    
    if (hasCaptcha) {
      console.log('Detected Cloudflare CAPTCHA. Please solve it manually in the browser window...');
      
      // Display a message in the console for the user
      console.log('⚠️ MANUAL ACTION REQUIRED: Please solve the CAPTCHA in the opened browser window');
      console.log('The process will continue automatically after you solve the CAPTCHA');
      
      // Wait for the CAPTCHA to be solved (checking periodically)
      let captchaSolved = false;
      const maxWaitTime = 180000; // 3 minutes
      const startTime = Date.now();
      
      while (!captchaSolved && (Date.now() - startTime) < maxWaitTime) {
        // Wait a bit before checking again
        await waitForTimeout(3000);
        
        // Check if we're still on a CAPTCHA page
        captchaSolved = !(await page.evaluate(() => {
          return Boolean(
            document.querySelector('#turnstile-wrapper') ||
            document.querySelector('.cf-turnstile') ||
            document.querySelector('iframe[src*="challenges.cloudflare.com"]') ||
            document.querySelector('.cf-browser-verification') ||
            document.querySelector('#challenge-form')
          );
        }));
        
        if (captchaSolved) {
          console.log('✅ CAPTCHA solved successfully! Proceeding with data extraction...');
          
          // Wait LONGER for the page to fully load after CAPTCHA
          console.log('Waiting for final page to load...');
          await waitForTimeout(25000); // Increased to 25 seconds
          
          // Get current URL after CAPTCHA
          const currentUrl = page.url();
          console.log(`Current URL after CAPTCHA: ${currentUrl}`);
          
          // Store the cookies after CAPTCHA is solved
          const cookies = await page.cookies();
          console.log(`Obtained ${cookies.length} cookies after CAPTCHA solving`);
          
          // Try to get content at this point
          content = await page.content();
          console.log(`Initial content size after CAPTCHA: ${content.length} bytes`);
          
          // Check if we're still on a transition page
          const isTransitionPage = await page.evaluate(() => {
            return document.title.includes('Just a moment...') || 
                  document.body.innerText.includes('Waiting for') ||
                  document.body.innerText.includes('to respond');
          });
          
          if (isTransitionPage) {
            console.log('Still on transition page, waiting longer and reloading...');
            // Wait even longer if we're still on a transition page
            await waitForTimeout(10000);
            
            // Reload the page to try to get past the transition screen
            console.log('Reloading page to get past transition screen...');
            try {
              await page.reload({ waitUntil: 'networkidle2', timeout: 60000 });
              await waitForTimeout(20000); // Increased wait time after reload
              
              // Check for known page elements
              const hasMenuContent = await page.evaluate(() => {
                return Boolean(
                  document.querySelector('.restaurant-name') ||
                  document.querySelector('.dish-card') ||
                  document.querySelector('.menu-category') ||
                  document.querySelector('h1') ||
                  document.querySelector('.restaurant-info')
                );
              });
              
              if (hasMenuContent) {
                console.log('Menu content detected after reload!');
                finalContent = await page.content();
                
                // Log content details
                console.log(`Final content size: ${finalContent.length} bytes`);
                console.log(`Content contains menu elements: ${hasMenuContent}`);
                
                return finalContent;
              }
            } catch (reloadError) {
              console.log('Error during reload, continuing anyway:', reloadError.message);
            }
          } else {
            // If not on transition page, check for actual menu content
            const hasMenuContent = await page.evaluate(() => {
              return Boolean(
                document.querySelector('.restaurant-name') ||
                document.querySelector('.dish-card') ||
                document.querySelector('.menu-category') ||
                document.querySelector('h1.restaurant-name') ||
                document.querySelector('.restaurant-info')
              );
            });
            
            if (hasMenuContent) {
              console.log('Menu content detected after CAPTCHA!');
              finalContent = content;
              
              // Get the final URL
              const finalUrl = page.url();
              console.log(`Final URL with menu content: ${finalUrl}`);
              
              // Keep browser open a bit longer to ensure complete loading
              console.log('Waiting additional time to ensure complete loading...');
              await waitForTimeout(10000);
              
              // Get final content after waiting
              finalContent = await page.content();
              console.log(`Final content size: ${finalContent.length} bytes`);
              
              return finalContent;
            }
          }
          
          // If we get here, we still don't have valid content
          // Try creating a new tab with the cookies
          console.log('Trying with a fresh tab and cookies...');
          const newPage = await browser.newPage();
          
          // Apply same anti-detection measures
          await newPage.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => false });
          });
          
          // Set the cookies from the original page
          for (const cookie of cookies) {
            await newPage.setCookie(cookie);
          }
          
          // Navigate directly to the URL with cookies
          try {
            await newPage.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
            await waitForTimeout(15000); // Wait 15 seconds after navigation
            
            // Get content from new tab
            const newContent = await newPage.content();
            console.log(`New tab content size: ${newContent.length} bytes`);
            
            // Check if new content has menu elements
            const hasNewMenuContent = await newPage.evaluate(() => {
              return Boolean(
                document.querySelector('.restaurant-name') ||
                document.querySelector('.dish-card') ||
                document.querySelector('.menu-category') ||
                document.querySelector('h1') ||
                document.querySelector('.restaurant-info')
              );
            });
            
            if (hasNewMenuContent || newContent.length > 50000) {
              console.log('Successfully retrieved content from new tab with cookies');
              finalContent = newContent;
              
              // Scroll to load all content
              await newPage.evaluate(() => {
                window.scrollTo(0, document.body.scrollHeight / 2);
                setTimeout(() => window.scrollTo(0, document.body.scrollHeight), 1000);
              });
              
              await waitForTimeout(5000);
              
              // Get final content after scrolling
              finalContent = await newPage.content();
            }
            
            // Close the new tab
            await newPage.close().catch(() => {});
            
            if (finalContent.length > 10000) {
              return finalContent;
            }
          } catch (newTabError) {
            console.log('Error with new tab approach:', newTabError.message);
            await newPage.close().catch(() => {});
          }
          
          // Return the best content we have
          return finalContent || content || '';
        }
      }
      
      if (!captchaSolved) {
        console.log('⚠️ Timeout waiting for manual CAPTCHA solving');
      }
    } else {
      console.log('No CAPTCHA detected, proceeding with content extraction');
      
      // Wait to ensure page is fully loaded
      await waitForTimeout(10000);
      
      // Get the page content
      content = await page.content();
      console.log(`Retrieved content size: ${content.length} bytes`);
      
      return content;
    }
    
    return finalContent || content || '';
  } catch (error) {
    console.error('Error in manual CAPTCHA solving process:', error);
    return finalContent || content || '';
  } finally {
    // Keep browser open longer to ensure complete loading, then close it
    console.log('Keeping browser open for final content loading...');
    
    // Close browser after a longer delay to ensure content retrieval
    setTimeout(async () => {
      if (page) await page.close().catch(() => {});
      if (browser) await browser.close().catch(() => {});
      console.log('Browser closed after delay');
    }, 30000); // Increased to 30 seconds to ensure content is fully loaded
  }
}

// Specialized function to bypass Cloudflare with advanced techniques
async function bypassCloudflareWithSpecializedTechniques(url: string, domain: string): Promise<string> {
  let browser: Browser | null = null;
  let page: Page | null = null;
  
  try {
    console.log('Initializing specialized Cloudflare bypass...');
    
    // Launch browser with specific settings to evade detection
    browser = await puppeteer.launch({
      headless: false, // Use non-headless mode for better Cloudflare bypass
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
        '--disable-blink-features=AutomationControlled',
        '--window-size=1920,1080'
      ],
      defaultViewport: null // Use the default viewport of the browser
    });
    
    // Create a new page with special settings
    page = await browser.newPage();
    
    // Advanced fingerprint spoofing
    await page.evaluateOnNewDocument(() => {
      // Override navigator properties to appear as a normal browser
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      
      // Add Chrome browser-specific properties
      window.chrome = {
        app: {
          isInstalled: false,
        },
        runtime: {}
      } as any;
      
      // Add language and other navigator properties
      Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
    });
    
    // Set specific headers to appear like a real browser
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Upgrade-Insecure-Requests': '1'
    });
    
    // Navigate to the URL with a longer timeout
    console.log(`Navigating to ${url} with specialized browser...`);
    await page.goto(url, { 
      waitUntil: 'networkidle2',
      timeout: 90000 // Longer timeout (90 seconds)
    });
    
    // Initial wait for page to load
    await waitForTimeout(5000);
    
    // General approach to handle potential CAPTCHA/challenge
    // Perform human-like interactions (scroll, move mouse)
    await page.mouse.move(100, 100);
    await waitForTimeout(500);
    await page.mouse.move(300, 300, { steps: 10 });
    await waitForTimeout(1000);
    
    // Scroll down and up to simulate human behavior
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
    await waitForTimeout(1000);
    await page.evaluate(() => window.scrollTo(0, 0));
    await waitForTimeout(1000);
    
    // Try tab and enter keys to navigate through page elements
    await page.keyboard.press('Tab');
    await waitForTimeout(500);
    await page.keyboard.press('Tab');
    await waitForTimeout(500);
    
    // Wait longer for auto-pass or loading
    await waitForTimeout(10000);
    
    // Get the page content after interactions
    const content = await page.content();
    
    console.log('Specialized bypass completed, content length:', content.length);
    return content;
  } catch (error) {
    console.error('Error in specialized Cloudflare bypass:', error);
    return '';
  } finally {
    // Clean up resources
    if (page) await page.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
  }
}