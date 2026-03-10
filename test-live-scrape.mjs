async function testScrape(region = 'Chicago', amenity = 'restaurant') {
    console.log(`Testing scrape for ${amenity} in ${region}...`)
    try {
        // 1. Geocode
        const coordRes = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(region)}&format=json&limit=1`, {
            headers: { 'User-Agent': 'MAK-OS-Agent/1.0' }
        })
        const coordData = await coordRes.json()
        console.log('Geocode result:', coordData[0] ? `lat: ${coordData[0].lat}, lon: ${coordData[0].lon}` : 'No results')

        if (coordData && coordData.length > 0) {
            const lat = parseFloat(coordData[0].lat)
            const lon = parseFloat(coordData[0].lon)

            // 2. Overpass
            const query = `
                [out:json][timeout:15];
                node["amenity"~"${amenity}|cafe|bar"](around:8000, ${lat}, ${lon});
                out 5;
            `
            const overpassRes = await fetch('https://overpass-api.de/api/interpreter', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: `data=${encodeURIComponent(query)}`
            })
            const overpassData = await overpassRes.json()
            console.log('Overpass count:', overpassData.elements ? overpassData.elements.length : 0)

            if (overpassData.elements) {
                overpassData.elements.forEach(el => {
                    console.log(`- ${el.tags.name} (${el.tags.website || 'No website'})`)
                })
            }
        }
    } catch (e) {
        console.error('Error:', e.message)
    }
}

testScrape('Manchester', 'restaurant')
testScrape('Chicago', 'restaurant')
