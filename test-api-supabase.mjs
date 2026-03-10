const apiUrl = 'http://127.0.0.1:3000/api/agents/tasks'

async function runTest() {
    console.log('--- TEST: REAL DATA SCRAPE + SUPABASE (Chicago) ---')
    const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: 'Find restaurants in Chicago' })
    })
    const data = await res.json()

    console.log('Logs:')
    data.logs.forEach(log => console.log(`> ${log}`))

    if (data.payload?.rows) {
        console.log('\nPayload Rows:')
        data.payload.rows.forEach(r => console.log(`- ${r.Company} (${r.Source})`))
    }
}

runTest()
