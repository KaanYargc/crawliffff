// cloudflare-handler.ts - Cloudflare tespiti ve atlatma işlevleri
import { Page } from 'puppeteer';

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
    'www.lieferando.de adresinin devam etmeden önce bağlantınızın güvenliğini gözden geçirmesi gerekiyor'
  ]
};

// Check if HTML contains Cloudflare challenge markers
export function isCloudflareHtml(html: string, domain?: string): boolean {
  if (!html) return false;

  const lowerHtml = html.toLowerCase();
  const patterns = [...CLOUDFLARE_PATTERNS.GENERAL];

  // Add Lieferando-specific patterns for lieferando.de domain
  if (domain === 'lieferando.de') {
    patterns.push(...CLOUDFLARE_PATTERNS.LIEFERANDO);
  }

  // Check for strong indicators (any one of these is enough to confirm Cloudflare)
  const strongIndicators = [
    'cf-browser-verification',
    '_cf_chl_opt',
    'challenge-running',
    ...CLOUDFLARE_PATTERNS.TURNSTILE
  ];

  const hasStrongIndicator = strongIndicators.some(pattern => 
    lowerHtml.includes(pattern.toLowerCase())
  );

  if (hasStrongIndicator) {
    console.log('Strong Cloudflare protection indicator detected');
    return true;
  }

  // For other patterns, require multiple matches for more accuracy
  const matchCount = patterns.reduce((count, pattern) => 
    lowerHtml.includes(pattern.toLowerCase()) ? count + 1 : count, 0
  );

  // Require at least 2 matches for non-Lieferando sites
  const threshold = domain === 'lieferando.de' ? 1 : 2;
  return matchCount >= threshold;
}

// Handle Cloudflare challenges
export async function handleCloudflareChallenge(page: Page): Promise<boolean> {
  try {
    console.log('Attempting to handle Cloudflare challenge...');

    // Wait for challenge element to be available
    const selectors = [
      '#challenge-form',
      '#cf-challenge-running',
      'iframe[src*="cloudflare"]',
      'iframe[src*="turnstile"]',
      '#cf-turnstile',
      '#wBIvQ7'
    ];

    const element = await page.waitForSelector(
      selectors.join(','),
      { timeout: 5000 }
    );

    if (!element) {
      console.log('No Cloudflare challenge elements found');
      return false;
    }

    // Wait for potential automatic challenge completion
    await page.waitForTimeout(5000);

    // Check if challenge is still present
    const challengeStillPresent = await page.evaluate((sels) => {
      return sels.some(selector => document.querySelector(selector) !== null);
    }, selectors);

    if (!challengeStillPresent) {
      console.log('Cloudflare challenge appears to have been solved automatically');
      return true;
    }

    console.log('Challenge still present after wait period');
    return false;
  } catch (error) {
    console.error('Error handling Cloudflare challenge:', error);
    return false;
  }
}