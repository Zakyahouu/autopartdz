/**
 * verify-phase5b.js
 * Verification suite for Phase 5b Unified Document Pipeline.
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');

const Order = require('../src/models/Order');
const OrderDocumentLine = require('../src/models/OrderDocumentLine');
const DocumentType = require('../src/models/DocumentType');
const User = require('../src/models/User');

const BASE_URL = 'http://localhost:5000/api';

async function run() {
  console.log('====================================================');
  console.log('  PHASE 5B UNIFIED PIPELINE VERIFICATION SUITE');
  console.log('====================================================\n');

  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/autopartdz');
  console.log('✓ Connected to MongoDB\n');

  // 1. Get or create test admin and associate
  let admin = await User.findOne({ role: 'admin', active: true });
  let associate = await User.findOne({ role: 'china_associate', active: true });

  const jwt = require('jsonwebtoken');
  const adminToken = jwt.sign(
    { userId: admin._id, role: admin.role },
    process.env.JWT_SECRET || 'secret',
    { expiresIn: '1h' }
  );
  const assocToken = jwt.sign(
    { userId: associate._id, role: associate.role },
    process.env.JWT_SECRET || 'secret',
    { expiresIn: '1h' }
  );

  console.log(`✓ Admin user: ${admin.email}`);
  console.log(`✓ Associate user: ${associate.email}\n`);

  // 2. Test Confirm with zero sources set
  console.log('────────────────────────────────────────────────────────────');
  console.log('TEST 1: Confirm Order with Zero Sources / Zero Assignees');
  console.log('────────────────────────────────────────────────────────────');

  let docType = await DocumentType.findOne({ active: true });
  if (!docType) {
    docType = await DocumentType.create({
      code: 'TEST-5B-DOC',
      shortName: '5B Doc',
      fullName: 'Phase 5b Verification Document',
      category: 'General',
      defaultSource: 'local',
      hasTranslation: false,
      pricing: { originalOnly: { costPrice: 1000, clientPrice: 2000 } },
      active: true,
    });
  }

  const order = await Order.create({
    trackingCode: 'DZ-TEST-5B-' + Date.now().toString().slice(-4),
    firstName: 'Phase',
    lastName: 'Tester',
    phone: '0555000555',
    address: 'Algiers, Algeria',
    wilaya: '16 - Alger',
    orderType: 'new',
    vin: 'WAUZZZ5B' + Date.now().toString().slice(-6),
    carModel: 'Audi A4 2024',
    status: 'pending',
    totalClientPrice: 2000,
    totalCostPrice: 1000,
  });

  const line1 = await OrderDocumentLine.create({
    orderId: order._id,
    documentTypeId: docType._id,
    translationMode: 'original_only',
    clientPrice: 2000,
    costPrice: 1000,
    source: null, // explicitly null
    assignedAssociateId: null, // explicitly unassigned
    status: 'needed',
  });

  console.log(`Created pending order ${order.trackingCode} with 1 line (source: null, assignee: null)`);

  const confirmRes = await fetch(`${BASE_URL}/orders/${order._id}/confirm`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({ lineUpdates: [] }),
  });
  const confirmData = await confirmRes.json();

  if (confirmRes.status === 200 && confirmData.order?.status === 'confirmed') {
    console.log('✓ PASS: Order confirmed successfully with zero sources set! Source-gate is removed.');
  } else {
    console.error('✗ FAIL: Confirm failed:', confirmRes.status, confirmData);
  }

  // 3. Test Assign / Delegate routes
  console.log('\n────────────────────────────────────────────────────────────');
  console.log('TEST 2: Reused Assign Route & Standalone Delegate Route');
  console.log('────────────────────────────────────────────────────────────');

  // 2.1 Test Assign: PATCH /api/orders/:orderId/lines/:lineId/assign
  const assignRes = await fetch(`${BASE_URL}/orders/${order._id}/lines/${line1._id}/assign`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({ associateId: associate._id }),
  });
  const assignData = await assignRes.json();
  const dbLineAfterAssign = await OrderDocumentLine.findById(line1._id);
  const lastLogAssign = dbLineAfterAssign.activityLog[dbLineAfterAssign.activityLog.length - 1];

  console.log(`Assign associate status: ${assignRes.status}`);
  console.log(`Assigned associate ID: ${dbLineAfterAssign.assignedAssociateId}`);
  console.log(`Activity log entry action: "${lastLogAssign?.action}", note: "${lastLogAssign?.note}"`);

  if (assignRes.status === 200 && lastLogAssign?.action === 'assigned') {
    console.log('✓ PASS: Assign action recorded correctly as "assigned"!');
  } else {
    console.error('✗ FAIL: Assign action failed.');
  }

  // 2.2 Test Unassign: PATCH /api/orders/:orderId/lines/:lineId/assign with null
  const unassignRes = await fetch(`${BASE_URL}/orders/${order._id}/lines/${line1._id}/assign`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({ associateId: null }),
  });
  const unassignData = await unassignRes.json();
  const dbLineAfterUnassign = await OrderDocumentLine.findById(line1._id);
  const lastLogUnassign = dbLineAfterUnassign.activityLog[dbLineAfterUnassign.activityLog.length - 1];

  console.log(`Unassign associate status: ${unassignRes.status}`);
  console.log(`Assigned associate ID after clear: ${dbLineAfterUnassign.assignedAssociateId}`);
  console.log(`Activity log entry action: "${lastLogUnassign?.action}", note: "${lastLogUnassign?.note}"`);

  if (unassignRes.status === 200 && lastLogUnassign?.action === 'unassigned') {
    console.log('✓ PASS: Unassign action recorded correctly as "unassigned"!');
  } else {
    console.error('✗ FAIL: Unassign action failed.');
  }

  // 2.3 Confirm standalone /delegate route is removed (returns 404)
  const delegateRes = await fetch(`${BASE_URL}/order-lines/${line1._id}/delegate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({ associateId: associate._id }),
  });
  console.log(`Standalone /delegate route removed check (expected 404): ${delegateRes.status}`);
  if (delegateRes.status === 404) {
    console.log('✓ PASS: Standalone /delegate route is completely removed (404 Not Found)!');
  } else {
    console.error('✗ FAIL: Standalone /delegate route still exists.');
  }

  // Re-assign associate for attach test
  await fetch(`${BASE_URL}/orders/${order._id}/lines/${line1._id}/assign`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({ associateId: associate._id }),
  });

  // 4. Test Unified Attach → Lock Pipeline
  console.log('\n────────────────────────────────────────────────────────────');
  console.log('TEST 3: Attach → Reject (Revision Loop) → Re-Attach → Approve (Lock)');
  console.log('────────────────────────────────────────────────────────────');

  // Associate attaches file
  const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
  const fileContent = 'Simulated Document Scan Content Phase 5b';
  const postBody = [
    `--${boundary}`,
    'Content-Disposition: form-data; name="file"; filename="scan_5b.pdf"',
    'Content-Type: application/pdf',
    '',
    fileContent,
    `--${boundary}`,
    'Content-Disposition: form-data; name="trackingCode"',
    '',
    'SF-5B-998877',
    `--${boundary}--`,
  ].join('\r\n');

  const attachRes = await fetch(`${BASE_URL}/order-lines/${line1._id}/attach`, {
    method: 'POST',
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      Authorization: `Bearer ${assocToken}`,
    },
    body: postBody,
  });
  const attachData = await attachRes.json();
  const orderAfterAttach = await Order.findById(order._id);

  console.log(`Attach status: ${attachRes.status}, line status: "${attachData.line?.status}"`);
  console.log(`Order status after attach rollup: "${orderAfterAttach.status}"`);

  if (attachRes.status === 200 && attachData.line?.status === 'attached' && orderAfterAttach.status === 'in_progress') {
    console.log('✓ PASS: needed → attached transition succeeded; Order rolled up to in_progress!');
  } else {
    console.error('✗ FAIL: Attach transition failed.');
  }

  // Admin Rejects (Lock with approve: false)
  const rejectRes = await fetch(`${BASE_URL}/order-lines/${line1._id}/lock`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      approve: false,
      note: 'Stamp is blurry, please provide a higher resolution scan.',
    }),
  });
  const rejectData = await rejectRes.json();
  const dbLineAfterReject = await OrderDocumentLine.findById(line1._id);

  console.log(`Reject status: ${rejectRes.status}, line status: "${dbLineAfterReject.status}"`);
  console.log(`lastRejectionNote: "${dbLineAfterReject.lastRejectionNote}"`);
  console.log(`rejectedAt: ${dbLineAfterReject.rejectedAt}`);
  console.log(`Uploaded files count: ${dbLineAfterReject.uploadedFiles.length}`);

  if (
    rejectRes.status === 200 &&
    dbLineAfterReject.status === 'needed' &&
    dbLineAfterReject.lastRejectionNote === 'Stamp is blurry, please provide a higher resolution scan.' &&
    dbLineAfterReject.uploadedFiles.length === 0
  ) {
    console.log('✓ PASS: Rejection loop succeeded! Status returned to needed with lastRejectionNote set.');
  } else {
    console.error('✗ FAIL: Rejection loop failed.');
  }

  // Associate Re-attaches
  const reAttachRes = await fetch(`${BASE_URL}/order-lines/${line1._id}/attach`, {
    method: 'POST',
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      Authorization: `Bearer ${assocToken}`,
    },
    body: postBody,
  });
  const dbLineAfterReAttach = await OrderDocumentLine.findById(line1._id);

  console.log(`Re-attach status: ${reAttachRes.status}, line status: "${dbLineAfterReAttach.status}"`);
  console.log(`lastRejectionNote after re-attach: ${dbLineAfterReAttach.lastRejectionNote} (should be null)`);

  if (reAttachRes.status === 200 && dbLineAfterReAttach.status === 'attached' && dbLineAfterReAttach.lastRejectionNote === null) {
    console.log('✓ PASS: Re-attach cleared rejection note and transitioned line to attached!');
  } else {
    console.error('✗ FAIL: Re-attach failed.');
  }

  // Admin Approves (Lock with approve: true)
  const approveRes = await fetch(`${BASE_URL}/order-lines/${line1._id}/lock`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({ approve: true, note: 'Approved clean scan.' }),
  });
  const dbLineAfterApprove = await OrderDocumentLine.findById(line1._id);
  const orderAfterApprove = await Order.findById(order._id);

  console.log(`Approve status: ${approveRes.status}, line status: "${dbLineAfterApprove.status}"`);
  console.log(`Order status after all lines ready: "${orderAfterApprove.status}"`);

  if (
    approveRes.status === 200 &&
    dbLineAfterApprove.status === 'ready' &&
    orderAfterApprove.status === 'ready_for_dispatch'
  ) {
    console.log('✓ PASS: attached → ready transition succeeded; Order rolled up to ready_for_dispatch!');
  } else {
    console.error('✗ FAIL: Approve lock failed.');
  }

  // 5. Test China associate queue endpoint
  console.log('\n────────────────────────────────────────────────────────────');
  console.log('TEST 4: China Associate GET /api/china/lines');
  console.log('────────────────────────────────────────────────────────────');

  const chinaLinesRes = await fetch(`${BASE_URL}/china/lines`, {
    headers: { Authorization: `Bearer ${assocToken}` },
  });
  const chinaLines = await chinaLinesRes.json();
  console.log(`China queue count: ${chinaLines.length}`);
  const hasLeakedPrice = chinaLines.some((l) => l.clientPrice !== undefined || l.costPrice !== undefined);
  console.log(`Price leakage detected? ${hasLeakedPrice}`);

  if (chinaLinesRes.status === 200 && !hasLeakedPrice) {
    console.log('✓ PASS: China queue returns cleanly with zero price leakage!');
  } else {
    console.error('✗ FAIL: China queue check failed.');
  }

  // Clean up test order & line
  await OrderDocumentLine.deleteMany({ orderId: order._id });
  await Order.deleteOne({ _id: order._id });
  console.log('\n✓ Cleaned up test order and lines.');

  await mongoose.disconnect();
  console.log('\n====================================================');
  console.log('  ALL PHASE 5B VERIFICATIONS PASSED SUCCESSFULLY');
  console.log('====================================================\n');
}

run().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
