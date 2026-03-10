import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testInsert() {
    const { data: users, error: authErr } = await supabase.auth.admin.listUsers();
    if (authErr || !users.users.length) {
        console.log("No users found or auth error:", authErr);
        return;
    }

    const testUserId = users.users[0].id;

    const { data, error } = await supabase
        .from('clients')
        .insert([
            {
                name: 'Test Client schema check',
                owner_id: testUserId
            }
        ])
        .select()
        .single();

    if (error) {
        console.error("EXACT ERROR:", JSON.stringify(error, null, 2));
        fs.writeFileSync('insert_error2.json', JSON.stringify(error, null, 2));
    } else {
        console.log("INSERT SUCCESS:", data);
    }
}

testInsert().catch(console.error);
