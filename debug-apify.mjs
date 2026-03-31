import { scrapeGoogleMaps } from './src/lib/apify.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '.env.local') });

async function debug() {
    console.log('Testing Apify connectivity...');
    console.log('APIFY_TOKEN exists:', !!process.env.APIFY_TOKEN);
    console.log('APIFY_API_TOKEN exists:', !!process.env.APIFY_API_TOKEN);

    const logs = [];
    const results = await scrapeGoogleMaps('hair salon', 'dubai', 1, null, logs);
    
    console.log('Logs:', logs);
    console.log('Results count:', results.length);
    if (results.length > 0) {
        console.log('Sample result:', results[0].name);
    }
}

debug().catch(console.error);
