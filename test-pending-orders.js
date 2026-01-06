// Simple test script to verify the pending-orders endpoint
const fetch = require('node-fetch')

async function testPendingOrders() {
  const backendUrl = 'http://localhost:3000' // Adjust as needed
  
  try {
    console.log('Testing pending-orders endpoint...')
    
    const response = await fetch(`${backendUrl}/api/ifood/pending-orders`)
    console.log('Response status:', response.status)
    console.log('Response headers:', Object.fromEntries(response.headers.entries()))
    
    const data = await response.json()
    console.log('Response data:', JSON.stringify(data, null, 2))
    
    if (data.success) {
      console.log(`✅ Success! Found ${data.orders?.length || 0} pending orders`)
    } else {
      console.log('❌ Error:', data.message || data.error)
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message)
  }
}

testPendingOrders()