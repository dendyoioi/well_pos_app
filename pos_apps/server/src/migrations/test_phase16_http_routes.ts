import * as dotenv from 'dotenv';
dotenv.config();
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

async function testHttpEndpoints() {
  console.log('Testing HTTP Endpoints via Express App with Authentication...');
  const prisma = new PrismaClient();

  const user = await prisma.user.findFirst({
    where: { isActive: true },
    select: { id: true, role: true, outletId: true, tenantId: true },
  });

  if (!user) throw new Error('No active user found in database.');

  const secret = process.env.JWT_SECRET || 'rahasia_super_aman_pos_12345';
  const token = jwt.sign(
    { userId: user.id, role: user.role, outletId: user.outletId },
    secret,
    { expiresIn: '1h' }
  );

  const { default: app } = await import('../index');

  const tenantId = user.tenantId!;
  const port = process.env.PORT || 5001;

  await new Promise((r) => setTimeout(r, 500));
  console.log(`Pinging endpoints on http://localhost:${port}...`);

  const headers = {
    'x-tenant-id': tenantId,
    'Authorization': `Bearer ${token}`,
  };

  // 1. GET /api/products
  const res1 = await fetch(`http://localhost:${port}/api/products`, { headers });
  const json1: any = await res1.json();
  console.log(`1. GET /api/products -> Status: ${res1.status}, Items: ${json1.data?.length}`);

  // 2. GET /api/inventory/low-stock
  const res2 = await fetch(`http://localhost:${port}/api/inventory/low-stock`, { headers });
  const json2: any = await res2.json();
  console.log(`2. GET /api/inventory/low-stock -> Status: ${res2.status}, Items: ${json2.data?.length}`);

  // 3. GET /api/orders
  const res3 = await fetch(`http://localhost:${port}/api/orders`, { headers });
  const json3: any = await res3.json();
  console.log(`3. GET /api/orders -> Status: ${res3.status}, Orders: ${json3.data?.length}`);

  // 4. GET /api/reports/financial
  const res4 = await fetch(`http://localhost:${port}/api/reports/financial`, { headers });
  const json4: any = await res4.json();
  console.log(
    `4. GET /api/reports/financial -> Status: ${res4.status}, GrossSales: Rp ${json4.data?.financialSummary?.totalGrossSales}`
  );

  const allPassed =
    res1.status === 200 &&
    res2.status === 200 &&
    res3.status === 200 &&
    res4.status === 200 &&
    Array.isArray(json1.data) &&
    Array.isArray(json2.data) &&
    Array.isArray(json3.data) &&
    json4.data?.financialSummary !== undefined;

  console.log(`\nHTTP Surface Verification: ${allPassed ? 'ALL PASSED (200 OK)' : 'FAILED'}`);
  await prisma.$disconnect();
  process.exit(allPassed ? 0 : 1);
}

testHttpEndpoints().catch((err) => {
  console.error(err);
  process.exit(1);
});
