/**
 * verify-phase6.js
 * Verification suite for Phase 6: China Portal Mobile-First Redesign
 *
 * Checks:
 *   1. GET /api/china/lines — auth, allowlist fields, no price leak
 *   2. POST /order-lines/:id/attach — real multipart, transition needed->attached
 *   3. Rejection banner data path: lastRejectionNote present in GET response
 *   4. Associate access guard: unassigned associate gets 403 on attach
 *   5. Admin can see all delegated lines
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
// Node 18+: native fetch + FormData + Blob — no npm form-data needed
// (npm form-data streams cause 'Unexpected end of form' with multer/busboy)

const Order = require('../src/models/Order');
const OrderDocumentLine = require('../src/models/OrderDocumentLine');
const DocumentType = require('../src/models/DocumentType');
const User = require('../src/models/User');
const CarCategory = require('../src/models/CarCategory');

const BASE_URL = 'http://localhost:5000/api';

let passed = 0;
let failed = 0;
const failures = [];

function pass(label) {
  console.log(`  PASS  ${label}`);
  passed++;
}

function fail(label, detail) {
  console.log(`  FAIL  ${label}`);
  if (detail) console.log(`        -> ${detail}`);
  failed++;
  failures.push({ label, detail });
}

async function apiGet(urlPath, token) {
  const res = await fetch(`${BASE_URL}${urlPath}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  let body;
  try { body = await res.json(); } catch { body = null; }
  return { status: res.status, body };
}

async function apiPostMultipart(urlPath, token, fields, fileBuffer, filename) {
  // Use native FormData (Node 18+) — npm form-data streams cause busboy errors
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  if (fileBuffer) {
    const blob = new Blob([fileBuffer], { type: 'image/jpeg' });
    form.append('file', blob, filename);
  }

  const res = await fetch(`${BASE_URL}${urlPath}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      // Do NOT set Content-Type manually — native fetch sets it with the correct boundary
    },
    body: form,
  });
  let body;
  try { body = await res.json(); } catch { body = null; }
  return { status: res.status, body };
}

function makeJpegBuffer() {
  // Minimal valid JPEG (~60 bytes, 1x1 white pixel)
  return Buffer.from(
    'ffd8ffe000104a46494600010100000100010000ffdb0043000808080808080808080808080808080808080808080808080808080808080808080808080808080808080808080808080808080808080808080808080808ffc00011080001000103011100021101031101ffc4001f0000010501010101010100000000000000000102030405060708090a0bffda000c03010002110311003f00f93fffd9',
    'hex'
  );
}

const createdOrderIds = [];
const createdLineIds = [];

async function run() {
  console.log('========================================================');
  console.log('  PHASE 6 CHINA PORTAL VERIFICATION SUITE');
  console.log('========================================================\n');

  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/autopartdz');
  console.log('Connected to MongoDB\n');

  const jwt = require('jsonwebtoken');
  const JWT_SECRET = process.env.JWT_SECRET || 'secret';

  const admin = await User.findOne({ role: 'admin', active: true });
  if (!admin) throw new Error('No active admin user — run seedAdmin first.');
  const adminToken = jwt.sign({ userId: admin._id, role: admin.role }, JWT_SECRET, { expiresIn: '1h' });

  let assocA = await User.findOne({ role: 'china_associate', active: true });
  if (!assocA) {
    assocA = await User.create({
      name: 'Phase6 AssocA',
      email: `p6-assocA-${Date.now()}@test.invalid`,
      passwordHash: 'hashed-placeholder',
      role: 'china_associate',
      active: true,
    });
  }
  let assocB = await User.findOne({ role: 'china_associate', active: true, _id: { $ne: assocA._id } });
  if (!assocB) {
    assocB = await User.create({
      name: 'Phase6 AssocB',
      email: `p6-assocB-${Date.now()}@test.invalid`,
      passwordHash: 'hashed-placeholder',
      role: 'china_associate',
      active: true,
    });
  }
  const assocAToken = jwt.sign({ userId: assocA._id, role: assocA.role }, JWT_SECRET, { expiresIn: '1h' });
  const assocBToken = jwt.sign({ userId: assocB._id, role: assocB.role }, JWT_SECRET, { expiresIn: '1h' });

  console.log(`Admin:       ${admin.email}`);
  console.log(`Associate A: ${assocA.email}`);
  console.log(`Associate B: ${assocB.email}\n`);

  const docType = await DocumentType.findOne({ active: true });
  if (!docType) throw new Error('No active DocumentType — seed catalog first.');
  const category = await CarCategory.findOne({ active: true });
  if (!category) throw new Error('No active CarCategory — seed catalog first.');

  const testOrder = await Order.create({
    trackingCode: `P6TEST${Date.now()}`,
    orderType: 'new',
    vin: `P6VIN${Date.now()}`.slice(0, 17).toUpperCase(),
    carModel: 'Phase6 Verify Car',
    carCategoryId: category._id,
    firstName: 'Phase6',
    lastName: 'Client',
    phone: '0600000000',
    address: '1 Rue Test, Alger',
    wilaya: 'Alger',
    status: 'confirmed',
  });
  createdOrderIds.push(testOrder._id);

  const lineA = await OrderDocumentLine.create({
    orderId: testOrder._id,
    documentTypeId: docType._id,
    translationMode: 'original_only',
    clientPrice: 1000,
    costPrice: 500,
    source: 'china',
    status: 'needed',
    assignedAssociateId: assocA._id,
    lastRejectionNote: 'Document was blurry — please resubmit',
    rejectedAt: new Date(),
  });
  createdLineIds.push(lineA._id);

  const lineB = await OrderDocumentLine.create({
    orderId: testOrder._id,
    documentTypeId: docType._id,
    translationMode: 'original_only',
    clientPrice: 1000,
    costPrice: 500,
    source: 'china',
    status: 'needed',
    assignedAssociateId: assocA._id,
  });
  createdLineIds.push(lineB._id);

  console.log(`Test order: ${testOrder.trackingCode}`);
  console.log(`Line A (has rejectionNote): ${lineA._id}`);
  console.log(`Line B (clean needed):      ${lineB._id}\n`);

  const jpegBuf = makeJpegBuffer();

  // ════════════════════════════════════════════════════════════════════════════
  console.log('------------------------------------------------------------');
  console.log('TEST 1: GET /api/china/lines — basic auth, returns array');
  console.log('------------------------------------------------------------');

  const r1 = await apiGet('/china/lines', assocAToken);
  if (r1.status !== 200) {
    fail('GET /china/lines -> 200', `Got ${r1.status}: ${JSON.stringify(r1.body)}`);
    throw new Error('Cannot continue without GET /china/lines working');
  }
  pass('GET /china/lines -> 200');
  if (!Array.isArray(r1.body)) fail('Response is array', `Got ${typeof r1.body}`);
  else pass('Response is an array');

  // ════════════════════════════════════════════════════════════════════════════
  console.log('\n------------------------------------------------------------');
  console.log('TEST 2: Line A (rejected) present in queue with rejection data');
  console.log('------------------------------------------------------------');

  const foundLineA = r1.body.find((l) => l.id === lineA._id.toString());
  if (!foundLineA) {
    fail('Line A in assocA queue', 'Not found in response');
  } else {
    pass('Line A present in assocA queue');

    if ('clientPrice' in foundLineA || 'costPrice' in foundLineA) {
      fail('No price fields leaked', `Keys: ${Object.keys(foundLineA).join(', ')}`);
    } else {
      pass('No clientPrice / costPrice leaked');
    }

    if (foundLineA.lastRejectionNote === 'Document was blurry — please resubmit') {
      pass(`lastRejectionNote present: "${foundLineA.lastRejectionNote}"`);
    } else {
      fail('lastRejectionNote correct value', `Got: ${JSON.stringify(foundLineA.lastRejectionNote)}`);
    }

    if (foundLineA.rejectedAt) pass(`rejectedAt present: ${foundLineA.rejectedAt}`);
    else fail('rejectedAt present', `Got: ${foundLineA.rejectedAt}`);

    const required = ['id', 'documentType', 'translationMode', 'order', 'status', 'trackingCode', 'uploadedFiles', 'createdAt'];
    for (const f of required) {
      if (f in foundLineA) pass(`Field "${f}" present`);
      else fail(`Field "${f}" present`, 'Missing from response');
    }

    const ord = foundLineA.order || {};
    for (const f of ['trackingCode', 'vin', 'carModel']) {
      if (f in ord) pass(`order.${f} present`);
      else fail(`order.${f} present`, 'Missing');
    }

    if ('clientPhone' in ord || 'address' in ord || 'clientName' in ord) {
      fail('No PII in order sub-object', `Keys: ${Object.keys(ord).join(', ')}`);
    } else {
      pass('No PII (phone/address/name) in order sub-object');
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  console.log('\n------------------------------------------------------------');
  console.log('TEST 3: AssocB does NOT see AssocA lines (isolation)');
  console.log('------------------------------------------------------------');

  const r3 = await apiGet('/china/lines', assocBToken);
  if (r3.status !== 200) {
    fail('GET /china/lines as assocB -> 200', `Got ${r3.status}`);
  } else {
    pass('GET /china/lines as assocB -> 200');
    const bSeesA = r3.body.find((l) => l.id === lineA._id.toString());
    if (bSeesA) fail('AssocB cannot see AssocA lines', 'Line A found in assocB queue — isolation broken');
    else pass('AssocB does not see AssocA lines (isolation OK)');
  }

  // ════════════════════════════════════════════════════════════════════════════
  console.log('\n------------------------------------------------------------');
  console.log('TEST 4: Unauthenticated GET /api/china/lines -> 401/403');
  console.log('------------------------------------------------------------');

  const r4 = await apiGet('/china/lines', 'not-a-token');
  if (r4.status === 401 || r4.status === 403) {
    pass(`Unauthenticated request rejected (${r4.status})`);
  } else {
    fail('Unauthenticated rejected', `Got ${r4.status}`);
  }

  // ════════════════════════════════════════════════════════════════════════════
  console.log('\n------------------------------------------------------------');
  console.log('TEST 5: POST /order-lines/:id/attach — multipart, needed -> attached');
  console.log('------------------------------------------------------------');

  const r5 = await apiPostMultipart(
    `/order-lines/${lineB._id}/attach`,
    assocAToken,
    { trackingCode: 'P6-WAYBILL-001', note: 'Phase6 verify attach' },
    jpegBuf,
    'phase6-verify.jpg'
  );

  if (r5.status !== 200) {
    fail('POST /order-lines/:id/attach -> 200', `Got ${r5.status}: ${JSON.stringify(r5.body)}`);
  } else {
    pass('POST /order-lines/:id/attach -> 200');
    const line = r5.body && r5.body.line;
    if (!line) {
      fail('Response contains line object', `Body: ${JSON.stringify(r5.body)}`);
    } else {
      if (line.status === 'attached') pass('Line status -> "attached"');
      else fail('Line status -> "attached"', `Got: "${line.status}"`);

      if (Array.isArray(line.uploadedFiles) && line.uploadedFiles.length > 0)
        pass(`uploadedFiles populated (${line.uploadedFiles.length} file)`);
      else fail('uploadedFiles populated', `Got: ${JSON.stringify(line.uploadedFiles)}`);

      const noNote = line.lastRejectionNote === null || line.lastRejectionNote === undefined || line.lastRejectionNote === '';
      if (noNote) pass('lastRejectionNote is null/empty on clean attach');
      else fail('lastRejectionNote cleared', `Got: "${line.lastRejectionNote}"`);
    }
  }

  const lineBDb = await OrderDocumentLine.findById(lineB._id);
  if (lineBDb.status === 'attached') pass('DB: lineB.status = "attached"');
  else fail('DB: lineB.status = "attached"', `DB has: "${lineBDb.status}"`);
  if (lineBDb.uploadedFiles.length > 0) pass(`DB: uploadedFiles has ${lineBDb.uploadedFiles.length} entry`);
  else fail('DB: uploadedFiles populated', 'Empty in DB');

  // ════════════════════════════════════════════════════════════════════════════
  console.log('\n------------------------------------------------------------');
  console.log('TEST 6: POST attach on rejected lineA — clears lastRejectionNote');
  console.log('------------------------------------------------------------');

  const r6 = await apiPostMultipart(
    `/order-lines/${lineA._id}/attach`,
    assocAToken,
    {},
    jpegBuf,
    'phase6-resubmit.jpg'
  );
  if (r6.status !== 200) {
    fail('POST attach on rejected lineA -> 200', `Got ${r6.status}: ${JSON.stringify(r6.body)}`);
  } else {
    pass('POST attach on rejected lineA -> 200');
    const line = r6.body && r6.body.line;
    const noNote = !line || line.lastRejectionNote === null || line.lastRejectionNote === undefined || line.lastRejectionNote === '';
    if (noNote) pass('lastRejectionNote cleared after re-attach');
    else fail('lastRejectionNote cleared', `Got: "${line && line.lastRejectionNote}"`);
    const noRejectedAt = !line || line.rejectedAt === null || line.rejectedAt === undefined;
    if (noRejectedAt) pass('rejectedAt cleared after re-attach');
    else fail('rejectedAt cleared', `Got: "${line && line.rejectedAt}"`);
  }

  // ════════════════════════════════════════════════════════════════════════════
  console.log('\n------------------------------------------------------------');
  console.log('TEST 7: AssocB attach to AssocA line -> 403');
  console.log('------------------------------------------------------------');

  const lineC = await OrderDocumentLine.create({
    orderId: testOrder._id,
    documentTypeId: docType._id,
    translationMode: 'original_only',
    clientPrice: 1000,
    costPrice: 500,
    source: 'china',
    status: 'needed',
    assignedAssociateId: assocA._id,
  });
  createdLineIds.push(lineC._id);

  const r7 = await apiPostMultipart(
    `/order-lines/${lineC._id}/attach`,
    assocBToken,
    {},
    jpegBuf,
    'phase6-unauthorized.jpg'
  );
  if (r7.status === 403) pass('AssocB attach to AssocA line -> 403 (correctly denied)');
  else fail('AssocB attach to AssocA line -> 403', `Got ${r7.status}: ${JSON.stringify(r7.body)}`);

  // ════════════════════════════════════════════════════════════════════════════
  console.log('\n------------------------------------------------------------');
  console.log('TEST 8: Admin GET /api/china/lines sees all delegated lines');
  console.log('------------------------------------------------------------');

  const r8 = await apiGet('/china/lines', adminToken);
  if (r8.status !== 200) {
    fail('Admin GET /china/lines -> 200', `Got ${r8.status}`);
  } else {
    pass('Admin GET /china/lines -> 200');
    if (!Array.isArray(r8.body)) {
      fail('Admin response is array', `Type: ${typeof r8.body}`);
    } else {
      pass(`Admin response is array (${r8.body.length} lines)`);
      const foundC = r8.body.find((l) => l.id === lineC._id.toString());
      if (foundC) pass('Admin can see lineC (delegated, needed)');
      else fail('Admin sees lineC', 'Not found in admin response');
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  console.log('\n========================================================');
  console.log(`  RESULTS: ${passed} passed, ${failed} failed`);
  console.log('========================================================');
  if (failures.length > 0) {
    console.log('\nFAILURES:');
    failures.forEach((f) => {
      console.log(`  FAIL ${f.label}`);
      if (f.detail) console.log(`    -> ${f.detail}`);
    });
  } else {
    console.log('\n  All tests passed. Phase 6 verified clean.');
  }

  // Cleanup
  console.log('\n-- Cleanup --');
  await OrderDocumentLine.deleteMany({ _id: { $in: createdLineIds } });
  console.log(`  Deleted ${createdLineIds.length} test lines`);
  await Order.deleteMany({ _id: { $in: createdOrderIds } });
  console.log(`  Deleted ${createdOrderIds.length} test orders\n`);

  await mongoose.disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error('\nFATAL:', err.message || err);
  process.exit(1);
});
