const { Pool } = require('pg');
require('dotenv').config();

async function test() {
  console.log('Testing connection to:', process.env.DATABASE_URL);
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const res = await pool.query('SELECT NOW()');
    console.log('Success:', res.rows[0]);
  } catch (err) {
    console.error('Failed:', err);
  } finally {
    await pool.end();
  }
}

test();
