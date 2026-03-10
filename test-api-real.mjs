const apiUrl = 'http://localhost:3001/api/agents/tasks'

async function runTest() {
    console.log('--- TEST: REAL DATA SCRAPE (London) ---')
    const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: 'Find restaurants in London' })
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
