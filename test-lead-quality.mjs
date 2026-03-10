const apiUrl = 'http://127.0.0.1:3000/api/agents/tasks'

async function runTest() {
    console.log('--- TEST: LEAD QUALITY & FILTERING (Chicago Coffee) ---')
    const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: 'Find coffee in Chicago' })
    })
    const data = await res.json()

    console.log('Logs:')
    data.logs.forEach(log => console.log(`> ${log}`))

    if (data.payload?.rows) {
        console.log('\nPayload Rows (Should be local shops, no Starbucks):')
        data.payload.rows.forEach(r => console.log(`- ${r.Company} (Status: ${r.Status}, Email: ${r.Email})`))
    }
}

runTest()
