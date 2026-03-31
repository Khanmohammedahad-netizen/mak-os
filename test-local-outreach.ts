import { parseTaskInput } from './src/lib/task-parser';
import { runOutreachPipeline } from './src/lib/outreach-engine';
import { supabaseAdmin } from './src/lib/supabase-admin';
import * as dotenv from 'dotenv';
dotenv.config();

async function test() {
    const categories = ["hair salon"];
    const region = "dubai";
    const logs: string[] = [];

    console.log("Starting script...");
    const result = await runOutreachPipeline(categories, region, supabaseAdmin, { maxResults: 20 });
    console.log("Result:");
    console.log(JSON.stringify(result, null, 2));
}

test().catch(console.error);
