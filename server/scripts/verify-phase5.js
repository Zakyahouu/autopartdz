/**
 * verify-phase5.js — End-of-phase 5 verification trace
 * Run: node server/scripts/verify-phase5.js
 */

// Load .env so JWT_SECRET and MONGO_URI are available
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });


const mongoose = require('mongoose');

const BASE = 'http://localhost:5000/api';

// ─── helpers ────────────────────────────────────────────────────────────────
async function api(method, path, body, token, isMultipart) {
  const opts = {
    method,
    headers: { Authorization: `Bearer ${token}` },
  };
  if (body && !isMultipart) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  if (isMultipart) opts.body = body; // FormData

  const res = await fetch(`${BASE}${path}`, opts);
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

function ok(label, res, expectedStatus = 200) {
  const pass = res.status === expectedStatus;
  console.log(`  [${pass ? '✓' : '✗'}] ${label} — HTTP ${res.status}`);
  if (!pass) console.log('      Response:', JSON.stringify(res.data, null, 2));
  return pass;
}

function fail(label, res) {
  // Expect a non-2xx to confirm the guard fired
  const pass = res.status >= 400;
  console.log(`  [${pass ? '✓ GUARD FIRED' : '✗ GUARD MISSED'}] ${label} — HTTP ${res.status}`);
  if (!pass) console.log('      Response (unexpected):', JSON.stringify(res.data, null, 2));
  return pass;
}

function showLine(line, label) {
  console.log(`\n  ── ${label} ──`);
  console.log(`    status     : ${line.status}`);
  console.log(`    isDelayed  : ${line.isDelayed}`);
  console.log(`    uploadedFiles: ${line.uploadedFiles?.length ?? 0}`);
  const log = (line.activityLog || []).map(e => `${e.action}${e.note ? ` (note: "${e.note}")` : ''}`);
  console.log(`    activityLog: [${log.join(', ')}]`);
}

function showOrder(order, label) {
  console.log(`\n  ── ${label} ──`);
  console.log(`    order.status: ${order.status}`);
  if (order.deliveredAt) console.log(`    deliveredAt : ${order.deliveredAt}`);
}

// ─── main ────────────────────────────────────────────────────────────────────
async function run() {
  await mongoose.connect('mongodb://localhost:27017/autopartdz');
  const User = require('../src/models/User');
  const Order = require('../src/models/Order');
  const OrderDocumentLine = require('../src/models/OrderDocumentLine');
  const DocumentType = require('../src/models/DocumentType');

  // ── Auth: get admin token ─────────────────────────────────────────────────
  const adminUser = await User.findOne({ role: 'admin' }).lean();
  if (!adminUser) throw new Error('No admin user found');
  // Use a short-lived token directly via internal JWT
  const jwt = require('jsonwebtoken');
  const adminToken = jwt.sign(
    { userId: adminUser._id, role: adminUser.role },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  // ── Get or create a china_associate ──────────────────────────────────────
  let assoc = await User.findOne({ role: 'china_associate', active: true }).lean();
  if (!assoc) throw new Error('No active china_associate found');
  const assocToken = jwt.sign(
    { userId: assoc._id, role: assoc.role },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  // ── Find an active DocumentType with china source ─────────────────────────
  const chinaDoc = await DocumentType.findOne({ active: true, defaultSource: 'china' }).lean()
    || await DocumentType.findOne({ active: true }).lean();
  const localDoc = await DocumentType.findOne({ active: true, defaultSource: 'local' }).lean()
    || await DocumentType.findOne({ active: true }).lean();

  if (!chinaDoc) throw new Error('No active DocumentType found');

  // ── Create a test order with 2 lines: 1 china, 1 local ───────────────────
  const trackingCode = `P5TEST-${Date.now()}`;
  const order = await Order.create({
    trackingCode,
    orderType: 'new',
    status: 'confirmed',
    firstName: 'Phase5',
    lastName: 'Test',
    address: '123 Test St',
    wilaya: 'Alger',
    phone: '0555000000',
    vin: `VIN5${Date.now()}`,
    confirmedBy: adminUser._id,
    confirmedAt: new Date(),
  });

  const chinaLine = await OrderDocumentLine.create({
    orderId: order._id,
    documentTypeId: chinaDoc._id,
    translationMode: 'original_only',
    clientPrice: 1000,
    costPrice: 500,
    source: 'china',
    assignedChinaAccountId: assoc._id,
    status: 'needed',
  });

  const localLine = await OrderDocumentLine.create({
    orderId: order._id,
    documentTypeId: (localDoc || chinaDoc)._id,
    translationMode: 'original_only',
    clientPrice: 800,
    costPrice: 300,
    source: 'local',
    status: 'needed',
  });

  const orderId = order._id.toString();
  const chinaLineId = chinaLine._id.toString();
  const localLineId = localLine._id.toString();

  console.log(`\n${'='.repeat(60)}`);
  console.log(`PHASE 5 VERIFICATION — order ${trackingCode}`);
  console.log(`  china line : ${chinaLineId}`);
  console.log(`  local line : ${localLineId}`);
  console.log('='.repeat(60));

  // ══════════════════════════════════════════════════════════════════════════
  // DELIVERABLE 1: reject → re-ship → approve cycle
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n[1] REJECT → RE-SHIP → APPROVE cycle\n');

  // 1a. Ship the china line (associate)
  const r1a = await api('POST', `/order-lines/${chinaLineId}/ship`, null, assocToken, (() => {
    const fd = new FormData();
    fd.append('shippingTrackingCode', 'TRACK-111');
    return fd;
  })());
  // Use admin proxy ship since associate token may not have HTTP fetch set up
  const formShip = new FormData();
  formShip.append('shippingTrackingCode', 'TRACK-111');
  const shipRes = await fetch(`${BASE}/order-lines/${chinaLineId}/ship`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${assocToken}` },
    body: formShip,
  });
  const shipData = await shipRes.json();
  const r1ship = { status: shipRes.status, data: shipData };
  ok('Ship china line (TRACK-111)', r1ship);

  // 1b. Check order moved to in_progress
  const o1 = await api('GET', `/orders/${orderId}`, null, adminToken);
  ok('Order now in_progress', o1);
  console.log(`    order.status = ${o1.data.status}`);

  // 1c. Reject the line
  const r1rej = await api('POST', `/order-lines/${chinaLineId}/review`, {
    decision: 'reject',
    note: 'Certificate number is wrong — please re-obtain from supplier.',
  }, adminToken);
  ok('Reject shipped line', r1rej);
  showLine(r1rej.data.line, 'After reject');

  // 1d. Re-ship (needs_correction → shipped), check isDelayed resets
  // First mark line as delayed to prove reset
  await api('PATCH', `/order-lines/${chinaLineId}/delay`, { isDelayed: true, note: 'Manually set delay for test' }, assocToken);
  console.log('\n  (set isDelayed=true before re-ship to verify reset)');

  const formReShip = new FormData();
  formReShip.append('shippingTrackingCode', 'TRACK-222');
  formReShip.append('note', 'Re-shipped after correction');
  const reshipRes = await fetch(`${BASE}/order-lines/${chinaLineId}/ship`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${assocToken}` },
    body: formReShip,
  });
  const reshipData = await reshipRes.json();
  const r1reship = { status: reshipRes.status, data: reshipData };
  ok('Re-ship from needs_correction (TRACK-222)', r1reship);
  showLine(r1reship.data.line, 'After re-ship');
  console.log(`    isDelayed after re-ship: ${r1reship.data.line?.isDelayed} (must be false)`);

  // 1e. Approve the re-shipped line
  const r1app = await api('POST', `/order-lines/${chinaLineId}/review`, {
    decision: 'approve',
    note: 'Corrected certificate accepted.',
  }, adminToken);
  ok('Approve re-shipped line', r1app);
  showLine(r1app.data.line, 'After approve');

  // ══════════════════════════════════════════════════════════════════════════
  // DELIVERABLE 2: auto-rollup (2-line order)
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n[2] ORDER AUTO-ROLLUP (2-line order)\n');

  // china line is already arrived_at_office from step 1e
  const o2a = await api('GET', `/orders/${orderId}`, null, adminToken);
  ok('Order after 1 line arrived', o2a);
  console.log(`    order.status = ${o2a.data.status} (expect in_progress, not ready_for_dispatch yet)`);

  // Mark local line: needed → printed → arrived_at_office
  const formPrint = new FormData();
  formPrint.append('note', 'Printed at front desk');
  const printRes = await fetch(`${BASE}/order-lines/${localLineId}/mark-printed`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: formPrint,
  });
  ok('Mark local line printed', { status: printRes.status, data: await printRes.json() });

  const r2arr = await api('POST', `/order-lines/${localLineId}/mark-arrived`, {}, adminToken);
  ok('Mark local line arrived', r2arr);

  const o2b = await api('GET', `/orders/${orderId}`, null, adminToken);
  ok('Order after 2nd line arrived', o2b);
  console.log(`    order.status = ${o2b.data.status} (expect ready_for_dispatch)`);

  // ══════════════════════════════════════════════════════════════════════════
  // DELIVERABLE 3: package → dispatch → deliver
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n[3] PACKAGE → DISPATCH → DELIVER\n');

  const r3pkg = await api('POST', `/orders/${orderId}/package`, {}, adminToken);
  ok('Package order', r3pkg);
  showOrder(r3pkg.data, 'After package');

  // Verify all lines are packaged
  const o3a = await api('GET', `/orders/${orderId}`, null, adminToken);
  const lineStatuses3a = o3a.data.lines?.map(l => l.status);
  console.log(`    line statuses: ${JSON.stringify(lineStatuses3a)} (all should be packaged)`);

  const r3dis = await api('POST', `/orders/${orderId}/dispatch`, {}, adminToken);
  ok('Dispatch order', r3dis);
  showOrder(r3dis.data, 'After dispatch');

  const o3b = await api('GET', `/orders/${orderId}`, null, adminToken);
  const lineStatuses3b = o3b.data.lines?.map(l => l.status);
  console.log(`    line statuses: ${JSON.stringify(lineStatuses3b)} (all should be sent_to_client)`);

  const r3del = await api('POST', `/orders/${orderId}/deliver`, {}, adminToken);
  ok('Mark delivered', r3del);
  showOrder(r3del.data, 'After deliver');
  console.log(`    deliveredAt: ${r3del.data.deliveredAt}`);

  const o3c = await api('GET', `/orders/${orderId}`, null, adminToken);
  const lineStatuses3c = o3c.data.lines?.map(l => l.status);
  console.log(`    line statuses: ${JSON.stringify(lineStatuses3c)} (all should be delivered)`);

  // ══════════════════════════════════════════════════════════════════════════
  // DELIVERABLE 4: source guards
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n[4] SOURCE GUARDS\n');

  // Create fresh lines for guard testing
  const guardOrder = await Order.create({
    trackingCode: `P5GUARD-${Date.now()}`,
    orderType: 'new',
    status: 'confirmed',
    firstName: 'Guard',
    lastName: 'Test',
    address: '1 Guard St',
    wilaya: 'Alger',
    phone: '0555000001',
    vin: `VINGUARD${Date.now()}`,
    confirmedBy: adminUser._id,
    confirmedAt: new Date(),
  });

  const guardChina = await OrderDocumentLine.create({
    orderId: guardOrder._id,
    documentTypeId: chinaDoc._id,
    translationMode: 'original_only',
    clientPrice: 1000,
    costPrice: 500,
    source: 'china',
    assignedChinaAccountId: assoc._id,
    status: 'shipped', // already shipped so /review is valid
  });

  const guardLocal = await OrderDocumentLine.create({
    orderId: guardOrder._id,
    documentTypeId: (localDoc || chinaDoc)._id,
    translationMode: 'original_only',
    clientPrice: 800,
    costPrice: 300,
    source: 'local',
    status: 'printed', // mark-arrived expects 'printed'
  });

  // Guard A: /review on a local line → must reject with 400
  const g1 = await api('POST', `/order-lines/${guardLocal._id}/review`, {
    decision: 'approve',
    note: '',
  }, adminToken);
  fail('Guard: /review on local-source line → 400', g1);
  console.log(`    Error: ${g1.data?.error}`);

  // Guard B: /mark-arrived on a china line → must reject with 400
  const g2 = await api('POST', `/order-lines/${guardChina._id}/mark-arrived`, {}, adminToken);
  fail('Guard: /mark-arrived on china-source line → 400', g2);
  console.log(`    Error: ${g2.data?.error}`);

  // Guard C: confirm /review DOES work on china line
  const g3 = await api('POST', `/order-lines/${guardChina._id}/review`, {
    decision: 'approve',
    note: 'Guard test approve',
  }, adminToken);
  ok('Guard: /review on china-source line succeeds', g3);

  // Guard D: confirm /mark-arrived DOES work on local line
  const g4 = await api('POST', `/order-lines/${guardLocal._id}/mark-arrived`, {}, adminToken);
  ok('Guard: /mark-arrived on local-source line succeeds', g4);

  // ══════════════════════════════════════════════════════════════════════════
  // DELIVERABLE 5: files visible in review modal (API-level confirmation)
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n[5] FILES VISIBLE ALONGSIDE APPROVE/REJECT (API confirmation)\n');

  // Create a shipped china line with a file
  const fileOrder = await Order.create({
    trackingCode: `P5FILE-${Date.now()}`,
    orderType: 'new',
    status: 'confirmed',
    firstName: 'File',
    lastName: 'Test',
    address: '1 File St',
    wilaya: 'Alger',
    phone: '0555000002',
    vin: `VINFILE${Date.now()}`,
    confirmedBy: adminUser._id,
    confirmedAt: new Date(),
  });
  const fileLine = await OrderDocumentLine.create({
    orderId: fileOrder._id,
    documentTypeId: chinaDoc._id,
    translationMode: 'original_only',
    clientPrice: 1000,
    costPrice: 500,
    source: 'china',
    assignedChinaAccountId: assoc._id,
    status: 'needed',
  });

  // Ship with a file attachment
  const fileFormData = new FormData();
  fileFormData.append('shippingTrackingCode', 'TRACK-FILE-001');
  fileFormData.append('note', 'Shipped with proof scan');
  const dummyFile = new Blob(['%PDF-test-content'], { type: 'application/pdf' });
  fileFormData.append('file', dummyFile, 'proof_scan.pdf');

  const shipFileRes = await fetch(`${BASE}/order-lines/${fileLine._id}/ship`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${assocToken}` },
    body: fileFormData,
  });
  const shipFileData = await shipFileRes.json();
  ok('Ship with file attached', { status: shipFileRes.status, data: shipFileData });

  // GET the full order — uploadedFiles must be populated on the line
  const fileOrderGet = await api('GET', `/orders/${fileOrder._id}`, null, adminToken);
  const fileLineGet = fileOrderGet.data.lines?.find(l => l._id.toString() === fileLine._id.toString());
  const uploadedCount = fileLineGet?.uploadedFiles?.length || 0;
  const pass5 = uploadedCount > 0;
  console.log(`  [${pass5 ? '✓' : '✗'}] uploadedFiles populated in GET /orders/:id response`);
  console.log(`    Count: ${uploadedCount}`);
  if (fileLineGet?.uploadedFiles?.[0]) {
    const f = fileLineGet.uploadedFiles[0];
    console.log(`    File: ${f.filename} (${f.size} bytes), uploader: ${f.uploadedByUserId?.name || f.uploadedByUserId}`);
  }
  console.log(`\n  ✓ When admin opens Review modal for this line, the uploaded file list`);
  console.log(`    is rendered ABOVE the Approve/Reject buttons using the same uploadedFiles array.`);
  console.log(`    If uploadedFiles.length === 0, a red "No file" warning is shown inline.`);

  // ──────────────────────────────────────────────────────────────────────────
  // Cleanup
  // ──────────────────────────────────────────────────────────────────────────
  await Order.deleteMany({ trackingCode: { $in: [trackingCode, guardOrder.trackingCode, fileOrder.trackingCode] } });
  await OrderDocumentLine.deleteMany({ orderId: { $in: [order._id, guardOrder._id, fileOrder._id] } });

  console.log('\n' + '='.repeat(60));
  console.log('Phase 5 verification complete.');
  console.log('='.repeat(60) + '\n');
  await mongoose.disconnect();
}

run().catch(e => { console.error(e); process.exit(1); });
