import { checkWhatsAppRegistration } from './src/lib/utils/whatsapp-lookup'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

async function runTest() {
  const sid = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN

  if (!sid || !token) {
    console.error('Missing TWILIO credentials')
    return
  }

  const testNumbers = [
    { name: 'Valid (Mocked)', phone: '+971522707529' }, // Replace with a real number for live test
    { name: 'Invalid', phone: '+10000000000' }
  ]

  for (const num of testNumbers) {
    console.log(`Testing ${num.name}: ${num.phone}...`)
    const result = await checkWhatsAppRegistration(num.phone, sid, token)
    console.log(`Result:`, result)
  }
}

runTest()
