import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config({ path: '.env.local' });

async function checkSchema() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
        console.error("Missing credentials");
        return;
    }

    // Use the PostgREST OpenAPI endpoint to get the full schema
    const response = await fetch(`${supabaseUrl}/rest/v1/?apikey=${serviceRoleKey}`);
    const schema = await response.json();

    const repoDef = schema.definitions.repositories;
    if (!repoDef) {
        console.log("No repositories table found in schema.");
        return;
    }

    console.log("--- EXACT COLUMNS FOR REPOSITORIES ---");
    const columns = Object.keys(repoDef.properties);
    columns.forEach(col => {
        console.log(`- ${col} (${repoDef.properties[col].type})`);
    });

    fs.writeFileSync('repos_schema.json', JSON.stringify(repoDef, null, 2));
}

checkSchema().catch(console.error);
