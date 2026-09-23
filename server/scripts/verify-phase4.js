const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

const DocumentType = require('../src/models/DocumentType');
const Order = require('../src/models/Order');
const OrderDocumentLine = require('../src/models/OrderDocumentLine');
const User = require('../src/models/User');
const { generateUniqueTrackingCode } = require('../src/utils/trackingCode');

const BASE_URL = 'http://localhost:5000/api';

function createToken(user) {
  return jwt.sign(
    { userId: user._id, role: user.role },
    process.env.JWT_SECRET || 'changeme-jwt-secret-key-32chars!!',
    { expiresIn: '1h' }
  );
}

async function run() {
  console.log('====================================================');
  console.log('  PHASE 4 VERIFICATION SUITE');
  console.log('====================================================\n');

  await mongoose.connect('mongodb://localhost:27017/autopartdz');
  console.log('✓ Connected to MongoDB');

  // Ensure Admin user
  let adminUser = await User.findOne({ role: 'admin' });
  if (!adminUser) {
    adminUser = await User.create({
      name: 'Admin Test',
      email: `admin-test-${Date.now()}@autopartdz.dz`,
      passwordHash: 'dummy-hash',
      role: 'admin',
      active: true,
    });
  }
  const adminToken = createToken(adminUser);
  const adminHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${adminToken}`,
  };

  // Ensure two distinct active China associate users
  let chinaUserA = await User.findOne({ email: 'china.associate.a@autopartdz.dz' });
  if (!chinaUserA) {
    chinaUserA = await User.create({
      name: 'Li Wei (Associate A)',
      email: 'china.associate.a@autopartdz.dz',
      passwordHash: 'dummy-hash',
      role: 'china_associate',
      active: true,
    });
  }
  const tokenA = createToken(chinaUserA);
  const headersA = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${tokenA}`,
  };

  let chinaUserB = await User.findOne({ email: 'china.associate.b@autopartdz.dz' });
  if (!chinaUserB) {
    chinaUserB = await User.create({
      name: 'Zhang Ming (Associate B)',
      email: 'china.associate.b@autopartdz.dz',
      passwordHash: 'dummy-hash',
      role: 'china_associate',
      active: true,
    });
  }
  const tokenB = createToken(chinaUserB);
  const headersB = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${tokenB}`,
  };

  console.log(`✓ Admin User: ${adminUser.name} (${adminUser._id})`);
  console.log(`✓ China Associate A: ${chinaUserA.name} (${chinaUserA._id})`);
  console.log(`✓ China Associate B: ${chinaUserB.name} (${chinaUserB._id})\n`);

  // Create document types for tests
  const docChina = await DocumentType.create({
    code: 'DOC-CH-' + Date.now().toString().slice(-4),
    shortName: 'Export Certificate',
    fullName: 'China Export Certificate of Conformity',
    category: 'Export Compliance',
    defaultSource: 'china',
    hasTranslation: false,
    pricing: { originalOnly: { costPrice: 3000, clientPrice: 7000 } },
    active: true,
  });

  const docLocal = await DocumentType.create({
    code: 'DOC-LOC-' + Date.now().toString().slice(-4),
    shortName: 'Local Receipt',
    fullName: 'Customs Duty Local Payment Receipt',
    category: 'Tax & Customs',
    defaultSource: 'local',
    hasTranslation: false,
    pricing: { originalOnly: { costPrice: 500, clientPrice: 1500 } },
    active: true,
  });

  // =========================================================================
  // TEST 1: PART B — LINE ASSIGNMENT & CONFIRM-GATE
  // =========================================================================
  console.log('────────────────────────────────────────────────────────────');
  console.log('TEST 1: Part B — Line Assignment & Confirm Gate');
  console.log('────────────────────────────────────────────────────────────');

  const trackingCode1 = await generateUniqueTrackingCode();
  const order1 = await Order.create({
    trackingCode: trackingCode1,
    orderType: 'new',
    status: 'pending',
    firstName: 'Tariq',
    lastName: 'Khelifi',
    phone: '+213550112233',
    wilaya: '31 - Oran',
    address: '22 Boulevard Front de Mer, Oran',
    vin: 'WAUZZZF23LA' + Math.floor(100000 + Math.random() * 900000),
    carModel: 'Audi Q5 2022',
  });

  const lineChinaUnassigned = await OrderDocumentLine.create({
    orderId: order1._id,
    documentTypeId: docChina._id,
    translationMode: 'original_only',
    clientPrice: 7000,
    costPrice: 3000,
    source: 'china',
    assignedChinaAccountId: null, // intentionally unassigned!
    status: 'needed',
  });

  console.log(`Created pending order ${order1._id} with unassigned China line ${lineChinaUnassigned._id}`);

  // 1.1 Attempt confirm without assignment -> MUST return 400
  console.log('\n[1.1] Attempting to confirm order with unassigned China line ...');
  const confirmBlockedRes = await fetch(`${BASE_URL}/orders/${order1._id}/confirm`, {
    method: 'PATCH',
    headers: adminHeaders,
    body: JSON.stringify({}),
  });
  const confirmBlockedBody = await confirmBlockedRes.json();
  console.log('HTTP Status:', confirmBlockedRes.status);
  console.log('Response:', confirmBlockedBody.error);

  if (confirmBlockedRes.status === 400 && confirmBlockedBody.error.includes('assigned to an active China associate')) {
    console.log('✓ PASS: Confirm gate blocked unassigned China line with 400!');
  } else {
    console.error('✗ FAIL: Confirm gate did not block unassigned China line properly:', confirmBlockedRes.status, confirmBlockedBody);
    process.exit(1);
  }

  // 1.2 Assign line to China Associate A via PATCH /api/orders/:orderId/lines/:lineId/assign
  console.log('\n[1.2] Calling PATCH /api/orders/:orderId/lines/:lineId/assign with Associate A ...');
  const assignRes = await fetch(`${BASE_URL}/orders/${order1._id}/lines/${lineChinaUnassigned._id}/assign`, {
    method: 'PATCH',
    headers: adminHeaders,
    body: JSON.stringify({ chinaAccountId: chinaUserA._id }),
  });
  const assignBody = await assignRes.json();
  console.log('HTTP Status:', assignRes.status);
  console.log('Assigned line details:');
  console.log(`- Line ID: ${assignBody.line._id}`);
  console.log(`- Assignee: ${assignBody.line.assignedChinaAccountId?.name} (${assignBody.line.assignedChinaAccountId?._id})`);

  if (assignRes.status === 200 && assignBody.line.assignedChinaAccountId?._id === chinaUserA._id.toString()) {
    console.log('✓ PASS: Line successfully assigned to China Associate A!');
  } else {
    console.error('✗ FAIL: Line assignment failed:', assignRes.status, assignBody);
    process.exit(1);
  }

  // 1.3 Confirm order now that assignment is resolved
  console.log('\n[1.3] Confirming order now that China line is assigned ...');
  const confirmSuccessRes = await fetch(`${BASE_URL}/orders/${order1._id}/confirm`, {
    method: 'PATCH',
    headers: adminHeaders,
    body: JSON.stringify({}),
  });
  const confirmSuccessBody = await confirmSuccessRes.json();
  console.log('HTTP Status:', confirmSuccessRes.status);
  if (confirmSuccessRes.status === 200 && confirmSuccessBody.order.status === 'confirmed') {
    console.log('✓ PASS: Order confirmed successfully after assignment!');
  } else {
    console.error('✗ FAIL: Confirm failed:', confirmSuccessRes.status, confirmSuccessBody);
    process.exit(1);
  }

  // =========================================================================
  // TEST 2: PART C — SHARED LINE-PROGRESSION ACTIONS & PERMISSION ISOLATION
  // =========================================================================
  console.log('\n────────────────────────────────────────────────────────────');
  console.log('TEST 2: Part C — Shared Line Actions & Permission Isolation');
  console.log('────────────────────────────────────────────────────────────');

  // Line is assigned to Associate A.
  // 2.1 Associate B tries to ship it -> MUST fail with 403 Forbidden!
  console.log('\n[2.1] Associate B attempts to ship line assigned to Associate A ...');
  const shipForbiddenRes = await fetch(`${BASE_URL}/order-lines/${lineChinaUnassigned._id}/ship`, {
    method: 'POST',
    headers: headersB,
    body: JSON.stringify({ shippingTrackingCode: 'DHL9876543210' }),
  });
  const shipForbiddenBody = await shipForbiddenRes.json();
  console.log('HTTP Status:', shipForbiddenRes.status);
  console.log('Response body:', JSON.stringify(shipForbiddenBody));

  if (shipForbiddenRes.status === 403 && shipForbiddenBody.error.includes('Access denied')) {
    console.log('✓ PASS: Associate B is strictly blocked from acting on Associate A line (403 Forbidden)!');
  } else {
    console.error('✗ FAIL: Expected 403 Forbidden, got:', shipForbiddenRes.status, shipForbiddenBody);
    process.exit(1);
  }

  // 2.2 Admin ships the line (WhatsApp fallback case: Admin not assigned, but can act on ANY line)
  console.log('\n[2.2] Admin ships the line on behalf of China (WhatsApp fallback) ...');
  const adminShipRes = await fetch(`${BASE_URL}/order-lines/${lineChinaUnassigned._id}/ship`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      shippingTrackingCode: 'SF-EXPRESS-889900',
      note: 'Admin recorded tracking received via WeChat/WhatsApp fallback',
    }),
  });
  const adminShipBody = await adminShipRes.json();
  console.log('HTTP Status:', adminShipRes.status);
  console.log('Updated Line Status:', adminShipBody.line.status);
  console.log('Shipping Tracking Code:', adminShipBody.line.shippingTrackingCode);
  console.log('Activity Log length:', adminShipBody.line.activityLog?.length);
  const lastLog = adminShipBody.line.activityLog?.[adminShipBody.line.activityLog.length - 1];
  console.log(`Last Activity Log Entry: action="${lastLog?.action}", actorRole="${lastLog?.actorRole}", note="${lastLog?.note}"`);

  if (adminShipRes.status === 200 && adminShipBody.line.status === 'shipped' && adminShipBody.line.shippingTrackingCode === 'SF-EXPRESS-889900') {
    console.log('✓ PASS: Admin successfully shipped the line on behalf of China associate!');
  } else {
    console.error('✗ FAIL: Admin ship action failed:', adminShipRes.status, adminShipBody);
    process.exit(1);
  }

  // 2.3 Delay toggle test: Associate A marks line as delayed
  console.log('\n[2.3] Associate A toggles delay on their shipped line ...');
  const delayRes = await fetch(`${BASE_URL}/order-lines/${lineChinaUnassigned._id}/delay`, {
    method: 'PATCH',
    headers: headersA,
    body: JSON.stringify({
      isDelayed: true,
      note: 'Flight departure delayed in Guangzhou airport due to typhoon weather',
    }),
  });
  const delayBody = await delayRes.json();
  console.log('HTTP Status:', delayRes.status);
  console.log(`Updated isDelayed: ${delayBody.line.isDelayed}`);

  if (delayRes.status === 200 && delayBody.line.isDelayed === true) {
    console.log('✓ PASS: Line delay successfully toggled to true by assigned associate!');
  } else {
    console.error('✗ FAIL: Toggle delay failed:', delayRes.status, delayBody);
    process.exit(1);
  }

  // 2.4 Mark-printed test: Local line transition
  console.log('\n[2.4] Admin marks local line as printed ...');
  const lineLocal = await OrderDocumentLine.create({
    orderId: order1._id,
    documentTypeId: docLocal._id,
    translationMode: 'original_only',
    clientPrice: 1500,
    costPrice: 500,
    source: 'local',
    status: 'needed',
  });

  const printRes = await fetch(`${BASE_URL}/order-lines/${lineLocal._id}/mark-printed`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ note: 'Printed at Algiers administrative office printer #2' }),
  });
  const printBody = await printRes.json();
  console.log('HTTP Status:', printRes.status);
  console.log('Updated Line Status:', printBody.line.status);

  if (printRes.status === 200 && printBody.line.status === 'printed') {
    console.log('✓ PASS: Local line successfully transitioned to printed!');
  } else {
    console.error('✗ FAIL: Mark printed failed:', printRes.status, printBody);
    process.exit(1);
  }

  // =========================================================================
  // TEST 3: PART D — CHINA-ASSOCIATE PORTAL QUEUE & STRICT ALLOWLIST
  // =========================================================================
  console.log('\n────────────────────────────────────────────────────────────');
  console.log('TEST 3: Part D — China-Associate Lines Queue & Allowlist');
  console.log('────────────────────────────────────────────────────────────');

  // Associate A queries GET /api/china/lines
  console.log('\nCalling GET /api/china/lines as Associate A ...');
  const chinaLinesRes = await fetch(`${BASE_URL}/china/lines`, {
    headers: headersA,
  });
  const chinaLines = await chinaLinesRes.json();
  console.log('HTTP Status:', chinaLinesRes.status);
  console.log(`Returned lines count for Associate A: ${chinaLines.length}`);

  const itemA = chinaLines.find((l) => l.id === lineChinaUnassigned._id.toString());
  console.log('\nActual JSON response entry for assigned line:');
  console.log(JSON.stringify(itemA, null, 2));

  // Leak assertions
  const forbiddenChinaFields = [
    'clientPrice',
    'costPrice',
    'wilaya',
    'address',
    'phone',
    'email',
    'passportNumber',
    'importAgency',
    'firstName',
    'lastName',
    'clientName',
    'note',
    'activityLog',
  ];

  let leakDetected = false;
  for (const field of forbiddenChinaFields) {
    if (itemA[field] !== undefined || (itemA.order && itemA.order[field] !== undefined)) {
      console.error(`✗ LEAK: Field "${field}" found in China response!`);
      leakDetected = true;
    }
  }

  if (!leakDetected && itemA.order.vin && itemA.order.carModel && itemA.documentType.fullName) {
    console.log('✓ PASS: Strict allowlist verified for China portal! NO pricing or client contact info leaked.');
  } else {
    console.error('✗ FAIL: Allowlist check failed.');
    process.exit(1);
  }

  // Check Associate B sees 0 lines (none assigned to B)
  console.log('\nCalling GET /api/china/lines as Associate B ...');
  const chinaLinesBRes = await fetch(`${BASE_URL}/china/lines`, {
    headers: headersB,
  });
  const chinaLinesB = await chinaLinesBRes.json();
  console.log(`Associate B lines count: ${chinaLinesB.length} (Expected: 0)`);
  if (chinaLinesB.length === 0) {
    console.log('✓ PASS: Queue strictly partitions by assignedChinaAccountId!');
  } else {
    console.error('✗ FAIL: Associate B saw lines not assigned to them!');
    process.exit(1);
  }

  // =========================================================================
  // TEST 4: PART A — PUBLIC TRACKING LOOKUP & LEAK AUDIT
  // =========================================================================
  console.log('\n────────────────────────────────────────────────────────────');
  console.log('TEST 4: Part A — Public Tracking Lookup & Leak Audit');
  console.log('────────────────────────────────────────────────────────────');

  // 4.1 Reject trackingCode alone
  console.log('\n[4.1] Calling GET /api/public/orders/track with trackingCode alone ...');
  const trackAloneRes = await fetch(`${BASE_URL}/public/orders/track?trackingCode=${order1.trackingCode}`);
  const trackAloneBody = await trackAloneRes.json();
  console.log('HTTP Status:', trackAloneRes.status);
  console.log('Response:', trackAloneBody.error);

  if (trackAloneRes.status === 400 && trackAloneBody.error.includes('Verification required')) {
    console.log('✓ PASS: Tracking lookup without phone or VIN rejected with 400!');
  } else {
    console.error('✗ FAIL: Code alone was not rejected with 400:', trackAloneRes.status, trackAloneBody);
    process.exit(1);
  }

  // 4.2 Valid tracking lookup with phone
  console.log('\n[4.2] Calling GET /api/public/orders/track with trackingCode + valid phone ...');
  const trackValidRes = await fetch(
    `${BASE_URL}/public/orders/track?trackingCode=${order1.trackingCode}&phone=${encodeURIComponent(order1.phone)}&locale=fr`
  );
  const trackValidBody = await trackValidRes.json();
  console.log('HTTP Status:', trackValidRes.status);
  console.log('Public Tracking Response:');
  console.log(JSON.stringify(trackValidBody, null, 2));

  // Public leak audit
  const publicForbiddenFields = [
    'clientPrice',
    'costPrice',
    'activityLog',
    'shippingTrackingCode',
    'assignedChinaAccountId',
    'uploadedFiles',
    'fileId',
    'confirmedBy',
    'phone',
    'email',
    'address',
    'wilaya',
  ];

  let publicLeak = false;
  for (const field of publicForbiddenFields) {
    if (trackValidBody[field] !== undefined) {
      console.error(`✗ LEAK: Field "${field}" found in top-level public response!`);
      publicLeak = true;
    }
    for (const l of trackValidBody.lines || []) {
      if (l[field] !== undefined) {
        console.error(`✗ LEAK: Field "${field}" found in line response!`);
        publicLeak = true;
      }
    }
  }

  // Verify internal status strings are collapsed to client-friendly enum
  const allowedClientStatuses = ['needed', 'in_progress', 'ready', 'delivered'];
  let statusLeak = false;
  for (const l of trackValidBody.lines || []) {
    if (!allowedClientStatuses.includes(l.status)) {
      console.error(`✗ LEAK: Internal status string "${l.status}" exposed to client!`);
      statusLeak = true;
    }
  }

  if (!publicLeak && !statusLeak) {
    console.log('✓ PASS: Public tracking endpoint NEVER leaks prices, tracking codes, files, or internal statuses!');
    console.log(`  Collapsing verified: Order status "${trackValidBody.orderStatus}", Line 1 status "${trackValidBody.lines[0]?.status}" (internal was "shipped"), Line 2 status "${trackValidBody.lines[1]?.status}" (internal was "printed")`);
  } else {
    console.error('✗ FAIL: Public tracking response leaked data or raw statuses.');
    process.exit(1);
  }

  console.log('\n====================================================');
  console.log('  ALL PHASE 4 BACKEND VERIFICATIONS PASSED!');
  console.log('====================================================\n');

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('Fatal error during verification:', err);
  process.exit(1);
});
