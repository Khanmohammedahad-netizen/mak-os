import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config({ path: '.env.local' });

async function checkNullConstraints() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
        console.error("Missing credentials");
        return;
    }

    // Use the PostgREST OpenAPI endpoint to see required fields directly
    const response = await fetch(`${supabaseUrl}/rest/v1/?apikey=${serviceRoleKey}`);
    const schema = await response.json();

    const repoDef = schema.definitions.repositories;
    if (!repoDef) {
        console.log("No repositories table found in schema.");
        return;
    }

    console.log("--- REQUIRED FIELDS IN REPOSITORIES ---");
    console.log(repoDef.required || []);

    console.log("\n--- ENUM FOR VISIBILITY ---");
    console.log(repoDef.properties.visibility?.enum || "NO ENUM FOUND");
}

checkNullConstraints().catch(console.error);
