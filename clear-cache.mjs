import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function checkAndClear() {
    console.log('Checking research_cache for dubai/hair salon entries...');
    
    // Find matching entries
    const { data: entries, error } = await supabase
        .from('research_cache')
        .select('*')
        .eq('city', 'dubai');

    if (error) {
        console.error('Search error:', error.message);
        return;
    }

    console.log(`Found ${entries?.length || 0} entries for dubai.`);
    
    if (entries && entries.length > 0) {
        for (const entry of entries) {
            console.log(`Key: ${entry.cache_key}, Results: ${entry.raw_data?.length || 0}`);
            if (Array.isArray(entry.raw_data) && entry.raw_data.length === 0) {
                console.log(`Deleting empty entry: ${entry.cache_key}`);
                const { error: delErr } = await supabase
                    .from('research_cache')
                    .delete()
                    .eq('cache_key', entry.cache_key);
                
                if (delErr) console.error('Delete error:', delErr.message);
                else console.log('Successfully deleted empty entry.');
            }
        }
    } else {
        console.log('No entries found for dubai.');
    }
}

checkAndClear().catch(console.error);
