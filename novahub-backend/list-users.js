const { Client } = require('pg');
const dotenv = require('dotenv');
dotenv.config();

async function run() {
  console.log('Connecting to:', process.env.DATABASE_URL);
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  await client.connect();

  const res = await client.query('SELECT id, email, role FROM "User"');
  console.log('Total users:', res.rowCount);
  res.rows.forEach(u => console.log(`- ${u.id}: ${u.email} (${u.role})`));

  await client.end();
}

run().catch(console.error);
