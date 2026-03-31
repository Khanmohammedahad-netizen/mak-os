import { parseTaskInput } from './src/lib/task-parser.js';
import { runOutreachPipeline } from './src/lib/outreach-engine.js';
import { supabaseAdmin } from './src/lib/supabase-admin.js';

async function test() {
    const categories = ["hair salon"];
    const region = "dubai";
    const logs = [];

    console.log("Starting script...");
    const result = await runOutreachPipeline(categories, region, supabaseAdmin, { maxResults: 20 });
    console.log("Result:", result);
}

test().catch(console.error);
