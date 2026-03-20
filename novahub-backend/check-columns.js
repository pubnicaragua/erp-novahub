const { Pool } = require('pg');
require('dotenv').config();

async function test() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const res = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'Invoice'
    `);
    console.log('Invoice columns:', res.rows.map(r => r.column_name));
  } catch (err) {
    console.error('Failed:', err);
  } finally {
    await pool.end();
  }
}

test();
