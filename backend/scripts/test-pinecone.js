require('dotenv').config();
const { getNamespaceStats } = require('../src/services/pineconeService');

async function test() {
  try {
    const stats = await getNamespaceStats('test-builder');
    console.log('✅ Pinecone connected:', stats);
  } catch (e) {
    console.error('❌ Connection failed:', e.message);
  }
}
test();