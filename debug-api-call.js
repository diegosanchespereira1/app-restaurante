// Debug script to trace the exact API call and response
const fetch = require('node-fetch')

async function debugApiCall() {
  const backendUrl = 'http://localhost:3000'
  const endpoint = '/api/ifood/pending-orders'
  
  console.log('=== Debugging API Call ===')
  console.log('Backend URL:', backendUrl)
  console.log('Endpoint:', endpoint)
  console.log('Full URL:', `${backendUrl}${endpoint}`)
  console.log('')
  
  try {
    console.log('1. Testing direct fetch...')
    const response = await fetch(`${backendUrl}${endpoint}`)
    
    console.log('Response status:', response.status)
    console.log('Response headers:', Object.fromEntries(response.headers.entries()))
    
    const text = await response.text()
    console.log('Raw response text:', text)
    
    try {
      const data = JSON.parse(text)
      console.log('Parsed JSON:', JSON.stringify(data, null, 2))
    } catch (parseError) {
      console.log('Response is not JSON:', parseError.message)
    }
    
  } catch (error) {
    console.error('Fetch error:', error.message)
  }
  
  console.log('')
  console.log('2. Testing other endpoints...')
  
  const testEndpoints = [
    '/health',
    '/api/ifood/status',
    '/api/ifood/config',
    '/api/printer/test'
  ]
  
  for (const testEndpoint of testEndpoints) {
    try {
      console.log(`Testing ${testEndpoint}...`)
      const response = await fetch(`${backendUrl}${testEndpoint}`)
      const data = await response.json()
      console.log(`  Status: ${response.status}, Success: ${data.success || 'N/A'}`)
    } catch (error) {
      console.log(`  Error: ${error.message}`)
    }
  }
}

debugApiCall()