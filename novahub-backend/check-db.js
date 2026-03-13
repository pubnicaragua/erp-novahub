const { Client } = require('pg');
const bcrypt = require('bcrypt');

async function run() {
  const client = new Client({
    connectionString: "postgresql://postgres.ytaesdisjrppifvgumip:BcadoPbEC5C6b0yg@aws-1-us-east-1.pooler.supabase.com:5432/postgres"
  });
  await client.connect();

  const res = await client.query('SELECT * FROM "User" WHERE email = $1', ['superadmin@novahub.com']);
  if (res.rows.length === 0) {
    console.log('User not found');
  } else {
    const user = res.rows[0];
    console.log('User found:', JSON.stringify(user, null, 2));
    const match = await bcrypt.compare('admin123', user.passwordHash);
    console.log('Password match "admin123":', match);
  }

  await client.end();
}

run().catch(console.error);
