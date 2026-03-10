const apiUrl = 'http://localhost:3001/api/agents/tasks'

async function runTest() {
    console.log('--- TEST 1: WORKFLOW INTENT ---')
    const res1 = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: 'Find restaurants in Manchester' })
    })
    const data1 = await res1.json()
    console.log(JSON.stringify(data1, null, 2))

    console.log('\n--- TEST 2: SINGLE AGENT DISPATCH ---')
    const res2 = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: 'Analyze our latest security patches' })
    })
    const data2 = await res2.json()
    console.log(JSON.stringify(data2, null, 2))
}

runTest()
