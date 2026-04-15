import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { BetaAnalyticsDataClient } from '@google-analytics/data';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(cookieParser());

// GA4 Proxy Route
app.get('/api/analytics/data', async (req, res) => {
  console.log('Received request for /api/analytics/data');
  try {
    const propertyId = '527976762'; // From the URL
    if (!process.env.GA4_SERVICE_ACCOUNT_JSON) {
        console.error('GA4 credentials not configured');
        return res.status(500).json({ error: 'GA4 credentials not configured' });
    }
    const analyticsDataClient = new BetaAnalyticsDataClient({
        credentials: JSON.parse(process.env.GA4_SERVICE_ACCOUNT_JSON)
    });

    const [response] = await analyticsDataClient.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
      metrics: [{ name: 'activeUsers' }],
      dimensions: [{ name: 'date' }],
    });

    res.json(response);
  } catch (error) {
    console.error('GA4 error:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// Music Proxy Routes
const MONOCHROME_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache'
};

app.get('/api/music/monochrome/search', async (req, res) => {
  try {
    const query = req.query.s as string;
    if (!query) return res.status(400).json({ error: 'Query required' });
    
    console.log(`Monochrome search for: ${query}`);

    const monochromeMirrors = [
      `https://api.monochrome.tf/search/?s=${encodeURIComponent(query)}`
    ];

    let lastError = null;

    for (const url of monochromeMirrors) {
      // Add a small delay between trying different mirrors
      await new Promise(resolve => setTimeout(resolve, 500));
      let retries = 1; // Reduced retries
      while (retries > 0) {
        try {
          console.log(`Trying Monochrome mirror (Retries left: ${retries}): ${url}`);
          const response = await axios.get(url, { 
            headers: MONOCHROME_HEADERS,
            timeout: 3000, // Reduced timeout
            validateStatus: (status) => true // Allow all status codes to handle 503 gracefully
          });

          const contentType = response.headers['content-type'] || '';
          console.log(`Monochrome mirror ${url} returned status ${response.status} with content-type ${contentType}`);
          
          if (response.status === 200) {
            if (contentType.includes('application/json')) {
              console.log('Monochrome search success');
              return res.json(response.data);
            } else {
              console.error(`Monochrome search failed with status 200. Content-Type: ${contentType}. Body snippet: ${typeof response.data === 'string' ? response.data.substring(0, 100) : 'non-string body'}`);
              lastError = new Error(`Monochrome search failed with status 200 but returned ${contentType} instead of application/json`);
            }
          } else {
            lastError = new Error(`Monochrome mirror returned status ${response.status}`);
          }
          
          console.debug(`Monochrome mirror ${url} returned status ${response.status} with content-type ${contentType}`);
          // If not 200, it's a failure, but we want to retry if retries > 0
          retries--;
          if (retries > 0) await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s before retry
          continue; // Continue the while loop
        } catch (e: any) {
          lastError = e;
          // Only log as debug to reduce noise
          console.debug(`Monochrome mirror attempt failed: ${url}. Error: ${e.message}`);
          retries--;
          if (retries > 0) await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s before retry
        }
      }
    }

    // SILENT FALLBACK TO SAAVN IF MONOCHROME FAILS
    // Fallback removed per user request
    res.status(503).json({ 
      error: 'Monochrome music search API failed', 
      details: lastError?.message || 'Service Unavailable' 
    });
  } catch (error) {
    console.error('Music search proxy error:', error);
    res.status(500).json({ error: 'Failed to fetch music' });
  }
});

app.get('/api/music/monochrome/track/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const quality = req.query.quality || 'HIGH';
    
    const monochromeTrackMirrors = [
      `https://ohio.monochrome.tf/track/?id=${id}&quality=${quality}`,
      `https://virginia.monochrome.tf/track/?id=${id}&quality=${quality}`,
      `https://frankfurt.monochrome.tf/track/?id=${id}&quality=${quality}`
    ];

    for (const url of monochromeTrackMirrors) {
      // Add a small delay between trying different mirrors
      await new Promise(resolve => setTimeout(resolve, 500));
      let retries = 1; // Reduced retries to fail faster
      while (retries > 0) {
        try {
          console.log(`Trying Monochrome track mirror (Retries left: ${retries}): ${url}`);
          const response = await axios.get(url, { 
            headers: MONOCHROME_HEADERS,
            timeout: 3000, // Reduced timeout
            validateStatus: (status) => true // Allow all status codes to handle 503 gracefully
          });
          
          const contentType = response.headers['content-type'] || '';
          if (response.status === 200 && contentType.includes('application/json')) {
            console.log('Monochrome track success');
            return res.json(response.data);
          }
          
          console.debug(`Monochrome track mirror ${url} returned status ${response.status} with content-type ${contentType}`);
          // If not 200, it's a failure, but we want to retry if retries > 0
          retries--;
          if (retries > 0) await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s before retry
          continue; // Continue the while loop
        } catch (e: any) {
          console.debug(`Monochrome track mirror attempt failed: ${url}. Error: ${e.message}`);
          retries--;
          if (retries > 0) await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }

    // If it's a Saavn ID (numeric or alphanumeric from Saavn), we might need a different endpoint
    // but the client usually knows which one to call. 
    // Fallback removed per user request

    res.status(503).json({ error: 'Failed to fetch track details from Monochrome' });
  } catch (error) {
    console.error('Track proxy error:', error);
    res.status(500).json({ error: 'Failed to fetch track details' });
  }
});

// Session configuration for iframe compatibility
app.use(session({
  secret: process.env.SESSION_SECRET || 'secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: true,
    sameSite: 'none',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));


// Web Proxy Route removed


async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';
  console.log(`Starting server in ${isProd ? 'production' : 'development'} mode...`);

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // In production, serve static files from dist
    app.use(express.static('dist'));
    // Catch-all for SPA in production
    app.get('*all', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
