import { chromium } from 'playwright';

async function inspectAdCards() {
  const testUrl = 'https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=BR&q=alfabetizacao&search_type=keyword_unordered&media_type=all';

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    viewport: { width: 1440, height: 1000 },
    locale: 'pt-BR',
  });

  const page = await context.newPage();

  await page.goto(testUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(4000);

  // Scroll to load ads
  for (let s = 0; s < 3; s++) {
    await page.evaluate(() => window.scrollBy(0, 800));
    await page.waitForTimeout(1000);
  }

  const inspection = await page.evaluate(() => {
    const cards: any[] = [];

    // Method 1: Find all elements containing "ID:" or "Biblioteca:" or "Identificação" or ad details buttons
    const allDivs = Array.from(document.querySelectorAll('div'));
    
    // Find video containers
    const videos = Array.from(document.querySelectorAll('video'));
    videos.forEach((v, idx) => {
      let src = v.src || v.currentSrc;
      if (!src) {
        const s = v.querySelector('source');
        if (s) src = s.src;
      }

      // Walk up the DOM to find the container card
      let parent: HTMLElement | null = v.parentElement;
      let cardText = '';
      let cardLinks: string[] = [];
      let depth = 0;

      while (parent && depth < 12) {
        const text = parent.innerText || '';
        if (text.length > 50 && (text.includes('ID') || text.includes('Veiculado') || text.includes('Ativo') || text.includes('Biblioteca') || text.includes('Ver detalhes'))) {
          cardText = text;
          cardLinks = Array.from(parent.querySelectorAll('a')).map(a => a.href);
          break;
        }
        parent = parent.parentElement;
        depth++;
      }

      cards.push({
        type: 'video',
        index: idx,
        videoSrc: src?.substring(0, 80) + '...',
        poster: v.poster?.substring(0, 80) + '...',
        cardTextSample: cardText.substring(0, 300).replace(/\n+/g, ' | '),
        cardLinks: cardLinks.filter(l => l.includes('facebook') || l.includes('ads/library')),
      });
    });

    return {
      totalVideos: videos.length,
      cardsSample: cards.slice(0, 5),
    };
  });

  console.log('Inspection Result:', JSON.stringify(inspection, null, 2));

  await context.close();
  await browser.close();
}

inspectAdCards();
