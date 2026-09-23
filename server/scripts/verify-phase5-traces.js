/**
 * verify-phase5-traces.js
 * Two supplemental traces for Phase 5 pre-merge review:
 *   Trace A: mark-printed triggers recomputeOrderStatus (confirmed → in_progress)
 *   Trace B: fulfillment guards reject out-of-order calls
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const mongoose = require('mongoose');
const BASE = 'http://localhost:5000/api';

// ─── helpers ─────────────────────────────────────────────────────────────────
async function api(method, path, body, token, formData) {
  const opts = { method, headers: { Authorization: `Bearer ${token}` } };
  if (formData) {
    opts.body = formData;
  } else if (body) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(`${BASE}${path}`, opts);
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

function check(label, res, expected = 200) {
  const pass = res.status === expected;
  console.log(`  [${pass ? '✓' : '✗'}] ${label} — HTTP ${res.status}`);
  if (!pass) console.log('      Body:', JSON.stringify(res.data));
  return pass;
}

function guardCheck(label, res) {
  const pass = res.status === 400;
  console.log(`  [${pass ? '✓ GUARD FIRED' : '✗ GUARD MISSED'}] ${label} — HTTP ${res.status}`);
  console.log(`      Error: ${res.data?.error || '(none)'}`);
  return pass;
}

// ─── main ────────────────────────────────────────────────────────────────────
async function run() {
  await mongoose.connect('mongodb://localhost:27017/autopartdz');

  const User            = require('../src/models/User');
  const Order           = require('../src/models/Order');
  const OrderDocumentLine = require('../src/models/OrderDocumentLine');
  const DocumentType    = require('../src/models/DocumentType');
  const jwt             = require('jsonwebtoken');

  const adminUser = await User.findOne({ role: 'admin' }).lean();
  if (!adminUser) throw new Error('No admin found');
  const adminToken = jwt.sign(
    { userId: adminUser._id, role: adminUser.role },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  const localDoc = await DocumentType.findOne({ active: true, defaultSource: 'local' }).lean()
    || await DocumentType.findOne({ active: true }).lean();
  if (!localDoc) throw new Error('No active DocumentType found');

  // ══════════════════════════════════════════════════════════════════════════
  // TRACE A: mark-printed triggers confirmed → in_progress
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n' + '='.repeat(60));
  console.log('TRACE A: mark-printed triggers recomputeOrderStatus');
  console.log('='.repeat(60));

  // Create a confirmed order with a single local line (status: needed)
  const orderA = await Order.create({
    trackingCode: `P5TRA-${Date.now()}`,
    orderType: 'new',
    status: 'confirmed',        // starts at confirmed
    firstName: 'TraceA',
    lastName: 'Test',
    address: '1 Trace St',
    wilaya: 'Alger',
    phone: '0550000001',
    vin: `VINA${Date.now()}`,
    confirmedBy: adminUser._id,
    confirmedAt: new Date(),
  });

  const lineA = await OrderDocumentLine.create({
    orderId: orderA._id,
    documentTypeId: localDoc._id,
    translationMode: 'original_only',
    clientPrice: 800,
    costPrice: 300,
    source: 'local',
    status: 'needed',           // starts at needed
  });

  console.log(`\n  Order created: ${orderA.trackingCode}`);
  console.log(`  Initial order.status : ${orderA.status}  (confirmed)`);
  console.log(`  Initial line.status  : ${lineA.status}   (needed)`);

  // GET order before — confirm it's still at 'confirmed'
  const beforeA = await api('GET', `/orders/${orderA._id}`, null, adminToken);
  check('GET order before mark-printed', beforeA);
  console.log(`  order.status before  : ${beforeA.data.status}`);
  console.log(`  line.status  before  : ${beforeA.data.lines?.[0]?.status}`);

  // Call mark-printed
  const fdA = new FormData();
  fdA.append('note', 'Printed at front desk — trace A');
  const printRes = await fetch(`${BASE}/order-lines/${lineA._id}/mark-printed`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: fdA,
  });
  const printData = await printRes.json();
  check('POST /mark-printed (local line, status: needed)', { status: printRes.status, data: printData });
  console.log(`  line.status  after   : ${printData.line?.status}   (printed)`);

  // GET order after — must now be in_progress
  const afterA = await api('GET', `/orders/${orderA._id}`, null, adminToken);
  check('GET order after mark-printed', afterA);
  console.log(`  order.status after   : ${afterA.data.status}   (expect in_progress)`);

  const traceAPassed = afterA.data.status === 'in_progress';
  console.log(`\n  ${traceAPassed ? '✓ PASS' : '✗ FAIL'}: mark-printed alone flipped order confirmed → in_progress`);

  // ══════════════════════════════════════════════════════════════════════════
  // TRACE B: fulfillment guards reject out-of-order calls
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n' + '='.repeat(60));
  console.log('TRACE B: fulfillment guards (out-of-order rejection)');
  console.log('='.repeat(60));

  // Order sitting at ready_for_dispatch — attempt /dispatch (skipping /package) → 400
  const orderB1 = await Order.create({
    trackingCode: `P5TRB1-${Date.now()}`,
    orderType: 'new',
    status: 'ready_for_dispatch',   // never packaged
    firstName: 'TraceB1',
    lastName: 'Test',
    address: '2 Guard St',
    wilaya: 'Alger',
    phone: '0550000002',
    vin: `VINB1${Date.now()}`,
    confirmedBy: adminUser._id,
    confirmedAt: new Date(),
  });

  console.log(`\n  Order B1: ${orderB1.trackingCode} — status: ${orderB1.status}`);
  console.log('  Attempting POST /dispatch (requires packaged, not ready_for_dispatch)…');

  const b1 = await api('POST', `/orders/${orderB1._id}/dispatch`, {}, adminToken);
  guardCheck('POST /dispatch on ready_for_dispatch order → must be 400', b1);

  // Order sitting at packaged — attempt /deliver (skipping /dispatch) → 400
  const orderB2 = await Order.create({
    trackingCode: `P5TRB2-${Date.now()}`,
    orderType: 'new',
    status: 'packaged',             // never dispatched
    firstName: 'TraceB2',
    lastName: 'Test',
    address: '3 Guard St',
    wilaya: 'Alger',
    phone: '0550000003',
    vin: `VINB2${Date.now()}`,
    confirmedBy: adminUser._id,
    confirmedAt: new Date(),
  });

  console.log(`\n  Order B2: ${orderB2.trackingCode} — status: ${orderB2.status}`);
  console.log('  Attempting POST /deliver (requires sent_to_client, not packaged)…');

  const b2 = await api('POST', `/orders/${orderB2._id}/deliver`, {}, adminToken);
  guardCheck('POST /deliver on packaged order → must be 400', b2);

  // Confirm the correct sequence still works (sanity check)
  console.log('\n  Sanity check: correct sequence on B1 order…');
  const pkgB1 = await api('POST', `/orders/${orderB1._id}/package`, {}, adminToken);
  check('POST /package (ready_for_dispatch → packaged)', pkgB1);
  const disB1 = await api('POST', `/orders/${orderB1._id}/dispatch`, {}, adminToken);
  check('POST /dispatch (packaged → sent_to_client)', disB1);
  const delB1 = await api('POST', `/orders/${orderB1._id}/deliver`, {}, adminToken);
  check('POST /deliver (sent_to_client → delivered)', delB1);
  console.log(`  Final order status: ${delB1.data.orderStatus}`);

  // ── Cleanup ───────────────────────────────────────────────────────────────
  await Order.deleteMany({
    trackingCode: { $in: [orderA.trackingCode, orderB1.trackingCode, orderB2.trackingCode] },
  });
  await OrderDocumentLine.deleteMany({ orderId: orderA._id });

  console.log('\n' + '='.repeat(60));
  console.log('Supplemental traces complete.');
  console.log('='.repeat(60) + '\n');
  await mongoose.disconnect();
}

run().catch(e => { console.error(e); process.exit(1); });
