
const axios = require('axios');

async function testApi() {
  try {
    const response = await axios.get('http://localhost:3000/tenants');
    console.log('Response:', response.data);
  } catch (error) {
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    } else {
      console.error('Error:', error.message);
    }
  }
}

testApi();
