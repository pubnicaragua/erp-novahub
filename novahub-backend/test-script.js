require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const http = require('http');

const prisma = new PrismaClient();

function base64url(str) {
  return Buffer.from(str).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

async function main() {
  const user = await prisma.user.findFirst();
  if (!user) return console.log('No user found');
  
  const payload = {
    sub: user.id,
    email: user.email,
    clientTenantId: user.clientTenantId,
    role: user.role
  };

  const encodedHeader = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const encodedPayload = base64url(JSON.stringify(payload));
  const signatureInput = `${encodedHeader}.${encodedPayload}`;
  const secret = 'super-secret-novahub-key-123';
  const signature = crypto.createHmac('sha256', secret).update(signatureInput).digest('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const token = `${signatureInput}.${signature}`;

  const data1 = JSON.stringify({ name: "Test Supplier API", code: "PROV123", contactName: "Juan" });
  
  console.log('Sending supplier...');
  
  const req1 = http.request({
    hostname: 'localhost', port: 3000, path: '/api/purchases/suppliers', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': data1.length, 'Authorization': `Bearer ${token}` }
  }, res => {
    let body = ''; res.on('data', c => body += c); res.on('end', () => console.log('Supplier Response:', res.statusCode, body));
  });
  req1.write(data1); req1.end();

  const data2 = JSON.stringify({ name: "Test Customer API", code: "CLI123", contactName: "Pedro" });

  const req2 = http.request({
    hostname: 'localhost', port: 3000, path: '/api/sales/customers', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': data2.length, 'Authorization': `Bearer ${token}` }
  }, res => {
    let body = ''; res.on('data', c => body += c); res.on('end', () => console.log('Customer Response:', res.statusCode, body));
  });
  req2.write(data2); req2.end();
}

main().catch(console.error).finally(() => prisma.$disconnect());
