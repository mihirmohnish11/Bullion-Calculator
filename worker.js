// Cloudflare Worker — Bullion Price Fetcher
// Fetches gold and silver prices from bullions.co.in/location/pune
// Deploy this at: workers.cloudflare.com

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  // Allow CORS from anywhere (your GitHub Pages app needs this)
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET',
    'Content-Type': 'application/json',
    'Cache-Control': 'max-age=300' // cache 5 minutes
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers });
  }

  try {
    const res = await fetch('https://bullions.co.in/location/pune/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      }
    });

    const html = await res.text();

    // Extract Gold 24K per gram
    // Pattern: Gold 24 Karat row, 1 Gram column
    let goldPerGram = null;
    let silverPerGram = null;

    // Match gold 24K 1 gram price
    // The table has: Gold 24 Karat (Rs ₹) | 14,702 | ...
    const goldMatch = html.match(/Gold 24 Karat[\s\S]*?<td[^>]*>([\d,]+)<\/td>/);
    if (goldMatch) {
      goldPerGram = parseInt(goldMatch[1].replace(/,/g, ''));
    }

    // Match silver 999 1 gram price
    const silverMatch = html.match(/Silver 999 Fine[\s\S]*?<td[^>]*>([\d,]+)<\/td>/);
    if (silverMatch) {
      silverPerGram = parseInt(silverMatch[1].replace(/,/g, ''));
    }

    // Fallback: try the header ticker values
    if (!goldPerGram) {
      // Header shows: 147,020.00 for 10gm
      const headerGold = html.match(/GOLD[\s\S]{0,200}?([\d,]+\.\d+)[\s\S]{0,50}?Rs/);
      if (headerGold) {
        goldPerGram = Math.round(parseFloat(headerGold[1].replace(/,/g, '')) / 10);
      }
    }

    if (!silverPerGram) {
      const headerSilver = html.match(/SILVER[\s\S]{0,200}?([\d,]+\.\d+)[\s\S]{0,50}?Rs/);
      if (headerSilver) {
        silverPerGram = Math.round(parseFloat(headerSilver[1].replace(/,/g, '')) / 1000);
      }
    }

    if (!goldPerGram || !silverPerGram) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Could not parse prices from page',
        timestamp: new Date().toISOString()
      }), { headers, status: 500 });
    }

    return new Response(JSON.stringify({
      success: true,
      gold: goldPerGram,
      silver: silverPerGram,
      unit: 'INR per gram',
      city: 'Pune',
      source: 'bullions.co.in',
      timestamp: new Date().toISOString()
    }), { headers });

  } catch (err) {
    return new Response(JSON.stringify({
      success: false,
      error: err.message,
      timestamp: new Date().toISOString()
    }), { headers, status: 500 });
  }
}
