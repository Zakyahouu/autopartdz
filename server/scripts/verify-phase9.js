/**
 * verify-phase9.js
 * Verification suite for Phase 9:
 *   - Status-Based Order Queue & Status Count Badges
 *   - China Claim System & Atomic Race-Condition Protection
 *   - Receipt Acknowledgment Flow
 *   - Admin Revocation, Permanent Associate Exclusion & Reopen to Pool
 *   - China-Visible Client Details Narrow Allowlist (Privacy Verification)
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

const Order = require('../src/models/Order');
const OrderDocumentLine = require('../src/models/OrderDocumentLine');
const DocumentType = require('../src/models/DocumentType');
const User = require('../src/models/User');
const CarCategory = require('../src/models/CarCategory');
const File = require('../src/models/File');

const BASE_URL = 'http://localhost:5000/api';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const testResults = [];

function recordTest(testName, passed, actualRequest, actualResponse, errorDetail) {
  totalTests++;
  if (passed) {
    passedTests++;
    console.log(`\n  [PASS] Test ${totalTests}: ${testName}`);
  } else {
    failedTests++;
    console.log(`\n  [FAIL] Test ${totalTests}: ${testName}`);
    if (errorDetail) console.log(`         Error: ${errorDetail}`);
  }
  console.log(`         Request:  ${JSON.stringify(actualRequest)}`);
  console.log(`         Response: ${JSON.stringify(actualResponse)}`);
  testResults.push({
    index: totalTests,
    name: testName,
    passed,
    request: actualRequest,
    response: actualResponse,
    error: errorDetail || null,
  });
}

function makeJpegBuffer() {
  return Buffer.from(
    'ffd8ffe000104a46494600010100000100010000ffdb004300080808080808080808080808080808080808080808080808080808080808080808080808080808080808080808080808080808080808080808080808080808ffc00011080001000103011100021101031101ffc4001f0000010501010101010100000000000000000102030405060708090a0bffda000c03010002110311003f00f93fffd9',
    'hex'
  );
}

async function apiRequest(method, urlPath, token, body) {
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (body !== undefined && !(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${BASE_URL}${urlPath}`, {
    method,
    headers,
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  });

  let resBody;
  try {
    resBody = await res.json();
  } catch {
    resBody = null;
  }
  return { status: res.status, body: resBody };
}

async function apiAttachFile(lineId, token, fields, fileBuffer, filename) {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  if (fileBuffer) {
    const blob = new Blob([fileBuffer], { type: 'image/jpeg' });
    form.append('file', blob, filename || 'proof.jpg');
  }

  const res = await fetch(`${BASE_URL}/order-lines/${lineId}/attach`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });

  let resBody;
  try {
    resBody = await res.json();
  } catch {
    resBody = null;
  }
  return { status: res.status, body: resBody };
}

async function runPhase9Verification() {
  console.log('========================================================================');
  console.log('   STARTING PHASE 9 VERIFICATION SUITE');
  console.log('========================================================================\n');

  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/autopartdz');

  const adminUser = await User.findOne({ role: 'admin', active: true });
  if (!adminUser) throw new Error('No active admin user found in database.');

  let assocA = await User.findOne({ role: 'china_associate', active: true, email: 'associate_a_phase9@autopartdz.test' });
  if (!assocA) {
    assocA = await User.create({
      name: 'China Associate A (Phase 9)',
      email: 'associate_a_phase9@autopartdz.test',
      passwordHash: '$2a$10$wT0/K90eC/9aL7b2vD7Y6eQd4t3m5n8o1p6q9r4s2t5u8v1w2x3y4',
      role: 'china_associate',
      active: true,
    });
  }

  let assocB = await User.findOne({ role: 'china_associate', active: true, email: 'associate_b_phase9@autopartdz.test' });
  if (!assocB) {
    assocB = await User.create({
      name: 'China Associate B (Phase 9)',
      email: 'associate_b_phase9@autopartdz.test',
      passwordHash: '$2a$10$wT0/K90eC/9aL7b2vD7Y6eQd4t3m5n8o1p6q9r4s2t5u8v1w2x3y4',
      role: 'china_associate',
      active: true,
    });
  }

  const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_key_change_in_production';
  const adminToken = jwt.sign({ userId: adminUser._id, role: adminUser.role }, JWT_SECRET, { expiresIn: '1h' });
  const assocAToken = jwt.sign({ userId: assocA._id, role: assocA.role }, JWT_SECRET, { expiresIn: '1h' });
  const assocBToken = jwt.sign({ userId: assocB._id, role: assocB.role }, JWT_SECRET, { expiresIn: '1h' });

  let carCat = await CarCategory.findOne({ active: true });
  if (!carCat) {
    carCat = await CarCategory.create({ name: 'Sedan Phase 9', active: true, displayOrder: 1 });
  }

  let docType = await DocumentType.findOne({ active: true });
  if (!docType) {
    docType = await DocumentType.create({
      shortName: 'Customs Cert P9',
      fullName: 'Certificate of Vehicle Origin P9',
      code: 'CERT-P9',
      category: 'Export Formalities',
      active: true,
      displayOrder: 1,
    });
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SECTION 1: Status-Based Orders Queue Tabs & DB Count Matching
  // ════════════════════════════════════════════════════════════════════════════
  console.log('────────────────────────────────────────────────────────────────────────');
  console.log('SECTION 1: Orders Queue Status Tabs & DB Count Matching');
  console.log('────────────────────────────────────────────────────────────────────────');

  const ordersRes = await apiRequest('GET', '/orders', adminToken);
  const queueOrders = Array.isArray(ordersRes.body) ? ordersRes.body : ordersRes.body?.orders || [];
  
  // Calculate counts per status from fetched orders
  const tabCounts = {
    all: queueOrders.length,
    pending: queueOrders.filter((o) => o.status === 'pending').length,
    confirmed: queueOrders.filter((o) => o.status === 'confirmed').length,
    in_progress: queueOrders.filter((o) => o.status === 'in_progress').length,
    ready_for_dispatch: queueOrders.filter((o) => o.status === 'ready_for_dispatch').length,
    packaged: queueOrders.filter((o) => o.status === 'packaged').length,
    sent_to_client: queueOrders.filter((o) => o.status === 'sent_to_client').length,
    delivered: queueOrders.filter((o) => o.status === 'delivered').length,
    completed: queueOrders.filter((o) => o.status === 'completed').length,
    rejected: queueOrders.filter((o) => o.status === 'rejected').length,
  };

  // Compare against actual DB counts
  const dbCounts = {
    all: await Order.countDocuments(),
    pending: await Order.countDocuments({ status: 'pending' }),
    confirmed: await Order.countDocuments({ status: 'confirmed' }),
    in_progress: await Order.countDocuments({ status: 'in_progress' }),
    ready_for_dispatch: await Order.countDocuments({ status: 'ready_for_dispatch' }),
    packaged: await Order.countDocuments({ status: 'packaged' }),
    sent_to_client: await Order.countDocuments({ status: 'sent_to_client' }),
    delivered: await Order.countDocuments({ status: 'delivered' }),
    completed: await Order.countDocuments({ status: 'completed' }),
    rejected: await Order.countDocuments({ status: 'rejected' }),
  };

  const countsMatch = Object.keys(dbCounts).every((key) => tabCounts[key] === dbCounts[key]);
  recordTest(
    'Orders Queue Status Tab Counts match actual DB counts per status',
    countsMatch,
    { route: 'GET /api/orders', expectedKeys: Object.keys(dbCounts) },
    { tabCounts, dbCounts }
  );

  // ════════════════════════════════════════════════════════════════════════════
  // SECTION 2: Order Creation & Delegation to Open Pool
  // ════════════════════════════════════════════════════════════════════════════
  console.log('\n────────────────────────────────────────────────────────────────────────');
  console.log('SECTION 2: Order Creation & Delegation to Open Pool');
  console.log('────────────────────────────────────────────────────────────────────────');

  const randVin = `VIN9RACE${Date.now().toString().slice(-8)}`;
  const orderRes = await apiRequest('POST', '/public/orders', null, {
    firstName: 'Zinedine',
    lastName: 'Zidane',
    phone: '0555998877',
    wilaya: 'Algiers',
    address: '14 Boulevard des Martyrs, Alger',
    passportNumber: 'DZ-99442211',
    vin: randVin,
    carModel: 'Chery Tiggo 8 Pro Max',
    carCategoryId: carCat._id.toString(),
    documents: [
      {
        documentTypeId: docType._id.toString(),
        translationMode: 'original_only',
      },
    ],
  });

  const createdOrderId = orderRes.body?.orderId;
  const createdTrackingCode = orderRes.body?.trackingCode;
  const dbLine = await OrderDocumentLine.findOne({ orderId: createdOrderId }).lean();
  const lineId = dbLine?._id;

  recordTest(
    'Create public import demand with client details (Name, Passport, Address, VIN)',
    orderRes.status === 201 && Boolean(createdOrderId) && Boolean(lineId),
    { vin: randVin, firstName: 'Zinedine', passportNumber: 'DZ-99442211' },
    { orderId: createdOrderId, trackingCode: createdTrackingCode, lineId: lineId?.toString() }
  );

  // Admin sets delegationMode='open' and confirms the order
  const confirmRes = await apiRequest('PATCH', `/orders/${createdOrderId}/confirm`, adminToken, {
    lineUpdates: [
      {
        lineId: lineId.toString(),
        delegationMode: 'open',
        associateId: null,
      },
    ],
  });

  const confirmedLine = await OrderDocumentLine.findById(lineId).lean();
  recordTest(
    'Admin confirms order and delegates line to Open Pool (delegationMode=open, assignedAssociateId=null)',
    confirmRes.status === 200 &&
      confirmedLine?.delegationMode === 'open' &&
      confirmedLine?.assignedAssociateId === null,
    { delegationMode: 'open', associateId: null },
    {
      orderStatus: confirmRes.body?.order?.status,
      delegationMode: confirmedLine?.delegationMode,
      assignedAssociateId: confirmedLine?.assignedAssociateId,
    }
  );

  // Both Associate A and Associate B see the line in GET /api/china/lines?view=open
  const openQueueA = await apiRequest('GET', '/china/lines?view=open', assocAToken);
  const openQueueB = await apiRequest('GET', '/china/lines?view=open', assocBToken);

  const foundA = openQueueA.body?.find((l) => l.id === lineId.toString());
  const foundB = openQueueB.body?.find((l) => l.id === lineId.toString());

  recordTest(
    'Both Associate A and Associate B see the unclaimed line in their open claim pool',
    openQueueA.status === 200 &&
      openQueueB.status === 200 &&
      Boolean(foundA) &&
      Boolean(foundB) &&
      foundA.isClaimable === true &&
      foundB.isClaimable === true,
    { route: 'GET /api/china/lines?view=open', lineId: lineId.toString() },
    {
      associateAFound: Boolean(foundA),
      associateBFound: Boolean(foundB),
      isClaimableA: foundA?.isClaimable,
      isClaimableB: foundB?.isClaimable,
    }
  );

  // ════════════════════════════════════════════════════════════════════════════
  // SECTION 3: Atomic Race-Condition Test (/claim)
  // ════════════════════════════════════════════════════════════════════════════
  console.log('\n────────────────────────────────────────────────────────────────────────');
  console.log('SECTION 3: Atomic Race-Condition Test on /claim');
  console.log('────────────────────────────────────────────────────────────────────────');

  // Both associates simultaneously call POST /api/order-lines/:id/claim
  const [claimResultA, claimResultB] = await Promise.all([
    apiRequest('POST', `/order-lines/${lineId}/claim`, assocAToken, {}),
    apiRequest('POST', `/order-lines/${lineId}/claim`, assocBToken, {}),
  ]);

  const has200 = claimResultA.status === 200 || claimResultB.status === 200;
  const has409 = claimResultA.status === 409 || claimResultB.status === 409;
  const exactOneSuccess =
    (claimResultA.status === 200 && claimResultB.status === 409) ||
    (claimResultB.status === 200 && claimResultA.status === 409);

  const winnerToken = claimResultA.status === 200 ? assocAToken : assocBToken;
  const winnerUser = claimResultA.status === 200 ? assocA : assocB;
  const loserToken = claimResultA.status === 200 ? assocBToken : assocAToken;
  const loserUser = claimResultA.status === 200 ? assocB : assocA;

  recordTest(
    'Race Condition Protection: Simultaneous claims yield exactly one 200 and one 409 Conflict',
    exactOneSuccess,
    { endpoint: `POST /api/order-lines/${lineId}/claim (concurrently executed)` },
    {
      associateAResult: { status: claimResultA.status, body: claimResultA.body },
      associateBResult: { status: claimResultB.status, body: claimResultB.body },
      winner: winnerUser.name,
      loser: loserUser.name,
    }
  );

  const lineAfterClaim = await OrderDocumentLine.findById(lineId).lean();
  recordTest(
    'DB state reflects atomic assignment to winning associate and remains delegationMode=open',
    lineAfterClaim.assignedAssociateId?.toString() === winnerUser._id.toString() &&
      lineAfterClaim.delegationMode === 'open',
    { lineId: lineId.toString() },
    {
      assignedAssociateId: lineAfterClaim.assignedAssociateId?.toString(),
      delegationMode: lineAfterClaim.delegationMode,
    }
  );

  // ════════════════════════════════════════════════════════════════════════════
  // SECTION 4: Receipt Acknowledgment & Non-Blocking Attach
  // ════════════════════════════════════════════════════════════════════════════
  console.log('\n────────────────────────────────────────────────────────────────────────');
  console.log('SECTION 4: Receipt Acknowledgment & Non-Blocking Attach');
  console.log('────────────────────────────────────────────────────────────────────────');

  // Loser cannot acknowledge
  const unauthAck = await apiRequest('POST', `/order-lines/${lineId}/acknowledge`, loserToken, {});
  recordTest(
    'Unauthorized associate cannot acknowledge someone else assigned line (403 Forbidden)',
    unauthAck.status === 403,
    { caller: loserUser.name },
    unauthAck.body
  );

  // Winner acknowledges receipt
  const ackRes = await apiRequest('POST', `/order-lines/${lineId}/acknowledge`, winnerToken, {});
  const lineAfterAck = await OrderDocumentLine.findById(lineId).lean();

  recordTest(
    'Winning associate acknowledges receipt: sets acknowledgedAt and acknowledgedBy',
    ackRes.status === 200 &&
      Boolean(lineAfterAck.acknowledgedAt) &&
      lineAfterAck.acknowledgedBy?.toString() === winnerUser._id.toString() &&
      lineAfterAck.status === 'needed',
    { caller: winnerUser.name },
    {
      status: ackRes.status,
      acknowledgedAt: lineAfterAck.acknowledgedAt,
      acknowledgedBy: lineAfterAck.acknowledgedBy?.toString(),
      lineStatus: lineAfterAck.status,
    }
  );

  // Verify acknowledge does NOT block attach — associate can attach cleanly
  const attachRes = await apiAttachFile(
    lineId,
    winnerToken,
    { trackingCode: 'SF-CN-998811', note: 'Stamped customs sheet' },
    makeJpegBuffer(),
    'stamped_customs.jpg'
  );

  const lineAfterAttach = await OrderDocumentLine.findById(lineId).lean();
  recordTest(
    'Attach document succeeds seamlessly after acknowledge (needed -> attached)',
    attachRes.status === 200 && lineAfterAttach.status === 'attached',
    { filename: 'stamped_customs.jpg', trackingCode: 'SF-CN-998811' },
    { lineStatus: lineAfterAttach.status, uploadedFilesCount: lineAfterAttach.uploadedFiles.length }
  );

  // ════════════════════════════════════════════════════════════════════════════
  // SECTION 5: Admin Revoke, Permanent Exclusion & Reopen to Pool
  // ════════════════════════════════════════════════════════════════════════════
  console.log('\n────────────────────────────────────────────────────────────────────────');
  console.log('SECTION 5: Admin Revoke, Permanent Exclusion & Reopen to Pool');
  console.log('────────────────────────────────────────────────────────────────────────');

  // Reset line to needed so we can test re-claim lifecycle
  await OrderDocumentLine.findByIdAndUpdate(lineId, { status: 'needed' });

  // Non-admin cannot revoke
  const unauthRevoke = await apiRequest('POST', `/order-lines/${lineId}/revoke`, winnerToken, {
    reason: 'Associate attempting self-revoke',
  });
  recordTest(
    'Associate cannot invoke /revoke endpoint (403 Forbidden)',
    unauthRevoke.status === 403,
    { callerRole: 'china_associate' },
    unauthRevoke.body
  );

  // Admin revokes assignment with required reason
  const revokeRes = await apiRequest('POST', `/order-lines/${lineId}/revoke`, adminToken, {
    reason: 'Associate took too long to complete document fulfillment',
  });

  const lineAfterRevoke = await OrderDocumentLine.findById(lineId).lean();
  const formerExcluded = (lineAfterRevoke.excludedAssociateIds || []).some(
    (id) => id.toString() === winnerUser._id.toString()
  );

  recordTest(
    'Admin revokes line: clears assignee/ack, permanently excludes former associate, reopens to pool',
    revokeRes.status === 200 &&
      lineAfterRevoke.assignedAssociateId === null &&
      lineAfterRevoke.acknowledgedAt === null &&
      lineAfterRevoke.delegationMode === 'open' &&
      formerExcluded &&
      lineAfterRevoke.revocationReason === 'Associate took too long to complete document fulfillment' &&
      Boolean(lineAfterRevoke.revokedAt),
    { reason: 'Associate took too long to complete document fulfillment' },
    {
      assignedAssociateId: lineAfterRevoke.assignedAssociateId,
      delegationMode: lineAfterRevoke.delegationMode,
      excludedCount: lineAfterRevoke.excludedAssociateIds.length,
      formerAssociateExcluded: formerExcluded,
      revocationReason: lineAfterRevoke.revocationReason,
    }
  );

  // The excluded associate attempts to claim the reopened line -> Blocked with 409
  const reClaimAttempt = await apiRequest('POST', `/order-lines/${lineId}/claim`, winnerToken, {});
  recordTest(
    'Revoked/excluded associate is permanently barred from claiming this line (409 Conflict)',
    reClaimAttempt.status === 409,
    { caller: winnerUser.name, lineId: lineId.toString() },
    reClaimAttempt.body
  );

  // Admin attempts to re-assign excluded associate via PATCH /assign -> Blocked with 400
  const reAssignAttempt = await apiRequest(
    'PATCH',
    `/orders/${createdOrderId}/lines/${lineId}/assign`,
    adminToken,
    { associateId: winnerUser._id.toString() }
  );
  recordTest(
    'Admin cannot reassign excluded associate to the same line via assign route (400 Bad Request)',
    reAssignAttempt.status === 400,
    { associateId: winnerUser._id.toString() },
    reAssignAttempt.body
  );

  // A DIFFERENT associate (loserUser) claims the reopened line -> SUCCEEDS!
  const secondClaimRes = await apiRequest('POST', `/order-lines/${lineId}/claim`, loserToken, {});
  const lineAfterSecondClaim = await OrderDocumentLine.findById(lineId).lean();

  recordTest(
    'Different non-excluded associate successfully claims reopened line from pool',
    secondClaimRes.status === 200 &&
      lineAfterSecondClaim.assignedAssociateId?.toString() === loserUser._id.toString(),
    { caller: loserUser.name },
    {
      claimStatus: secondClaimRes.status,
      assignedAssociate: lineAfterSecondClaim.assignedAssociateId?.toString(),
    }
  );

  // ════════════════════════════════════════════════════════════════════════════
  // SECTION 6: China Portal Client Details Privacy Allowlist
  // ════════════════════════════════════════════════════════════════════════════
  console.log('\n────────────────────────────────────────────────────────────────────────');
  console.log('SECTION 6: China Portal Client Details Privacy Allowlist');
  console.log('────────────────────────────────────────────────────────────────────────');

  const chinaLinesRes = await apiRequest('GET', '/china/lines?view=mine', loserToken);
  const chinaLineItem = (chinaLinesRes.body || []).find((l) => l.id === lineId.toString());

  const ordSub = chinaLineItem?.order || {};
  const hasAllowlistedPII =
    ordSub.firstName === 'Zinedine' &&
    ordSub.lastName === 'Zidane' &&
    ordSub.passportNumber === 'DZ-99442211' &&
    ordSub.address === '14 Boulevard des Martyrs, Alger' &&
    ordSub.vin === randVin &&
    ordSub.carModel === 'Chery Tiggo 8 Pro Max';

  const hasStrictlyExcludedFields =
    'phone' in ordSub ||
    'clientPhone' in ordSub ||
    'email' in ordSub ||
    'clientPrice' in (chinaLineItem || {}) ||
    'costPrice' in (chinaLineItem || {});

  recordTest(
    'Narrow Allowlist: Exposes firstName, lastName, passportNumber, address, vin, carModel',
    hasAllowlistedPII,
    { endpoint: 'GET /api/china/lines' },
    {
      firstName: ordSub.firstName,
      lastName: ordSub.lastName,
      passportNumber: ordSub.passportNumber,
      address: ordSub.address,
      vin: ordSub.vin,
      carModel: ordSub.carModel,
    }
  );

  recordTest(
    'Strict Privacy: Customer phone, email, clientPrice, and costPrice are NEVER leaked to China',
    !hasStrictlyExcludedFields,
    { inspectedKeys: Object.keys(ordSub), lineKeys: Object.keys(chinaLineItem || {}) },
    {
      phonePresent: 'phone' in ordSub,
      emailPresent: 'email' in ordSub,
      clientPricePresent: 'clientPrice' in (chinaLineItem || {}),
      costPricePresent: 'costPrice' in (chinaLineItem || {}),
    }
  );

  console.log('\n========================================================================');
  console.log(`   PHASE 9 VERIFICATION SUMMARY: ${passedTests}/${totalTests} TESTS PASSED`);
  console.log('========================================================================\n');

  await mongoose.disconnect();

  if (failedTests > 0) {
    process.exit(1);
  }
}

runPhase9Verification().catch((err) => {
  console.error('\n[FATAL ERROR IN VERIFICATION]:', err);
  process.exit(1);
});
