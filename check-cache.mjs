import { supabaseAdmin } from './src/lib/supabase-admin.ts';

async function check() {
    console.log('Checking cache for dubai/hair salon...');
    try {
        const { data, error } = await supabaseAdmin
            .from('research_cache')
            .select('*')
            .eq('city', 'dubai');

        if (error) {
            console.error('Error fetching cache:', error.message);
            return;
        }

        console.log(`Found ${data?.length || 0} entries for dubai.`);
        data.forEach(entry => {
            console.log(`- Key: ${entry.cache_key}, Results: ${entry.raw_data?.length || 0}`);
        });
    } catch (e) {
        console.error('Fatal error:', e.message);
    }
}

check().catch(console.error);
