/**
 * verify-phase7.js
 * Verification suite for Phase 7: Correction Flow + Completed Close-Out
 *
 * Verifies:
 *   1. Full lifecycle of normal order to 'delivered'.
 *   2. Client submits correction on delivered order via POST /api/public/orders/:trackingCode/correction
 *      with trackingCode + phone/vin identity check.
 *   3. Cloned line has parentLineId, correctionReason, status='needed'.
 *   4. Parent order and original lines remain byte-for-byte unchanged.
 *   5. Guard: duplicate simultaneous correction on the same line while first is open is rejected with error.
 *   6. Admin rejects first correction via POST /api/orders/:id/reject { reason }:
 *      status becomes 'rejected', reason stored, order is terminal (confirm/attach/lock refused).
 *   7. Client submits second correction on same line (now that first is rejected): succeeds.
 *   8. Admin confirms second correction and runs it through Attach -> Lock -> package -> dispatch -> deliver
 *      reusing existing pipeline unmodified.
 *   9. Admin calls POST /api/orders/:id/complete on delivered order: succeeds, status='completed'.
 *  10. Call /complete on non-delivered order: rejected with 400.
 *  11. Call /complete via public/client route: returns 404.
 *  12. Tracking route surfaces correct simplified status and isCorrection for correction orders.
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
  try { resBody = await res.json(); } catch { resBody = null; }
  return { status: res.status, body: resBody };
}

async function run() {
  console.log('================================================================');
  console.log('  PHASE 7 VERIFICATION SUITE: CORRECTION FLOW & COMPLETED CLOSE');
  console.log('================================================================');

  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/autopartdz');
  console.log('Connected to MongoDB.\n');

  const JWT_SECRET = process.env.JWT_SECRET || 'secret';
  let admin = await User.findOne({ role: 'admin', active: true });
  if (!admin) {
    admin = await User.create({
      name: 'P7 Admin',
      email: `p7admin_${Date.now()}@autopartdz.test`,
      passwordHash: 'invalidsalt',
      role: 'admin',
      active: true,
    });
  }
  const adminToken = jwt.sign({ userId: admin._id, role: admin.role }, JWT_SECRET, { expiresIn: '2h' });

  // Get or create document types
  let docType1 = await DocumentType.findOne({ active: true, shortName: 'P7 Doc 1' });
  if (!docType1) {
    docType1 = await DocumentType.create({
      code: `P7-D1-${Date.now()}`,
      shortName: 'P7 Doc 1',
      fullName: 'Phase 7 Certificate of Conformity',
      category: 'Vehicle Documentation',
      defaultSource: 'local',
      hasTranslation: false,
      pricing: { originalOnly: { costPrice: 1500, clientPrice: 3000 } },
      active: true,
    });
  }

  let docType2 = await DocumentType.findOne({ active: true, shortName: 'P7 Doc 2' });
  if (!docType2) {
    docType2 = await DocumentType.create({
      code: `P7-D2-${Date.now()}`,
      shortName: 'P7 Doc 2',
      fullName: 'Phase 7 Customs Invoice Clearance',
      category: 'Customs & Tax',
      defaultSource: 'china',
      hasTranslation: false,
      pricing: { originalOnly: { costPrice: 2000, clientPrice: 4000 } },
      active: true,
    });
  }

  const timestamp = Date.now();
  const testPhone = '0555777888';
  const testVin = `P7VIN${timestamp}`.slice(0, 17).toUpperCase();

  const cleanupOrderIds = [];

  try {
    // ─────────────────────────────────────────────────────────────────────────
    // STEP 1: Create a normal order and advance it to 'delivered'
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- STEP 1: Create normal order and advance to delivered ---');

    const normalOrder = await Order.create({
      trackingCode: `DZ-P7-${timestamp.toString().slice(-6)}`,
      orderType: 'new',
      isCorrection: false,
      parentOrderId: null,
      status: 'pending',
      firstName: 'Zinedine',
      lastName: 'Mebarki',
      phone: testPhone,
      address: 'Route Nationale 1, Blida',
      wilaya: '09 - Blida',
      vin: testVin,
      carModel: 'Chery Tiggo 8 Pro 2024',
    });
    cleanupOrderIds.push(normalOrder._id);

    const normalLine1 = await OrderDocumentLine.create({
      orderId: normalOrder._id,
      documentTypeId: docType1._id,
      translationMode: 'original_only',
      clientPrice: 3000,
      costPrice: 1500,
      source: 'local',
      status: 'needed',
    });

    const normalLine2 = await OrderDocumentLine.create({
      orderId: normalOrder._id,
      documentTypeId: docType2._id,
      translationMode: 'original_only',
      clientPrice: 4000,
      costPrice: 2000,
      source: 'china',
      status: 'needed',
    });

    // 1.1 Confirm order
    const confirmReq = { lineUpdates: [] };
    const confirmRes = await apiRequest('PATCH', `/orders/${normalOrder._id}/confirm`, adminToken, confirmReq);
    recordTest(
      'Admin confirms normal order (pending -> confirmed)',
      confirmRes.status === 200 && confirmRes.body?.order?.status === 'confirmed',
      { method: 'PATCH', path: `/orders/${normalOrder._id}/confirm`, body: confirmReq },
      confirmRes
    );

    // 1.2 Attach documents to line 1 and line 2
    const jpegBuffer = makeJpegBuffer();
    const attach1Res = await apiAttachFile(normalLine1._id, adminToken, { note: 'Line 1 Attached' }, jpegBuffer, 'cert.jpg');
    const lock1Res = await apiRequest('POST', `/order-lines/${normalLine1._id}/lock`, adminToken, { approve: true });
    
    const attach2Res = await apiAttachFile(normalLine2._id, adminToken, { note: 'Line 2 Attached' }, jpegBuffer, 'invoice.jpg');
    const lock2Res = await apiRequest('POST', `/order-lines/${normalLine2._id}/lock`, adminToken, { approve: true });

    // Order should now be ready_for_dispatch
    const checkedOrderAfterLock = await Order.findById(normalOrder._id);
    recordTest(
      'Attach & Lock all lines rolls order up to ready_for_dispatch',
      checkedOrderAfterLock.status === 'ready_for_dispatch',
      { orderId: normalOrder._id, line1Status: lock1Res.body?.line?.status, line2Status: lock2Res.body?.line?.status },
      { orderStatus: checkedOrderAfterLock.status }
    );

    // 1.3 Package -> Dispatch -> Deliver
    const pkgRes = await apiRequest('POST', `/orders/${normalOrder._id}/package`, adminToken);
    const dspRes = await apiRequest('POST', `/orders/${normalOrder._id}/dispatch`, adminToken);
    const dlvRes = await apiRequest('POST', `/orders/${normalOrder._id}/deliver`, adminToken);
    
    const orderDelivered = await Order.findById(normalOrder._id);
    recordTest(
      'Normal order advances to delivered (package -> dispatch -> deliver)',
      dlvRes.status === 200 && orderDelivered.status === 'delivered',
      { method: 'POST', steps: ['package', 'dispatch', 'deliver'] },
      { finalStatus: orderDelivered.status, deliveredAt: orderDelivered.deliveredAt }
    );

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 2: Snapshot parent order and original lines before correction
    // ─────────────────────────────────────────────────────────────────────────
    const parentOrderPreSnapshot = JSON.stringify(await Order.findById(normalOrder._id).lean());
    const parentLinesPreSnapshot = JSON.stringify(
      await OrderDocumentLine.find({ orderId: normalOrder._id }).sort({ _id: 1 }).lean()
    );

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 3: Client submits correction via POST /api/public/orders/:trackingCode/correction
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- STEP 2: Public correction submission on Line 1 ---');

    const correctionReq = {
      phone: testPhone,
      lines: [
        {
          originalLineId: normalLine1._id.toString(),
          reason: 'Official clearance stamp is blurred and unreadable on page 2.',
        },
      ],
    };

    const corrSubmitRes = await apiRequest(
      'POST',
      `/public/orders/${normalOrder.trackingCode}/correction`,
      null,
      correctionReq
    );

    const corrOrder1Id = corrSubmitRes.body?.order?._id || corrSubmitRes.body?.orderId;
    if (corrOrder1Id) cleanupOrderIds.push(corrOrder1Id);

    const isCorr1Success =
      corrSubmitRes.status === 201 &&
      (corrSubmitRes.body?.order?.isCorrection === true || corrSubmitRes.body?.isCorrection === true);

    recordTest(
      'Client submits correction via POST /public/orders/:trackingCode/correction',
      isCorr1Success,
      { method: 'POST', path: `/public/orders/${normalOrder.trackingCode}/correction`, body: correctionReq },
      corrSubmitRes
    );

    // 3.1 Verify new correction order properties in database
    const corrOrder1InDb = await Order.findById(corrOrder1Id);
    const corrLines1 = await OrderDocumentLine.find({ orderId: corrOrder1Id });
    const corrLine1 = corrLines1[0];

    recordTest(
      'Correction Order has isCorrection=true, parentOrderId=<original>, fresh trackingCode, status=pending',
      corrOrder1InDb &&
        corrOrder1InDb.isCorrection === true &&
        corrOrder1InDb.parentOrderId?.toString() === normalOrder._id.toString() &&
        corrOrder1InDb.trackingCode !== normalOrder.trackingCode &&
        corrOrder1InDb.status === 'pending',
      { orderId: corrOrder1Id },
      {
        isCorrection: corrOrder1InDb?.isCorrection,
        parentOrderId: corrOrder1InDb?.parentOrderId,
        trackingCode: corrOrder1InDb?.trackingCode,
        status: corrOrder1InDb?.status,
      }
    );

    recordTest(
      'Correction Line has parentLineId pointing to original line, correctionReason preserved, status=needed',
      corrLine1 &&
        corrLine1.parentLineId?.toString() === normalLine1._id.toString() &&
        corrLine1.correctionReason === 'Official clearance stamp is blurred and unreadable on page 2.' &&
        corrLine1.status === 'needed' &&
        corrLine1.documentTypeId?.toString() === docType1._id.toString(),
      { corrLineId: corrLine1?._id },
      {
        parentLineId: corrLine1?.parentLineId,
        correctionReason: corrLine1?.correctionReason,
        status: corrLine1?.status,
        documentTypeId: corrLine1?.documentTypeId,
      }
    );

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 4: Confirm parent order and original lines are byte-for-byte unchanged
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- STEP 3: Parent order integrity check ---');

    const parentOrderPostSnapshot = JSON.stringify(await Order.findById(normalOrder._id).lean());
    const parentLinesPostSnapshot = JSON.stringify(
      await OrderDocumentLine.find({ orderId: normalOrder._id }).sort({ _id: 1 }).lean()
    );

    const orderUnchanged = parentOrderPreSnapshot === parentOrderPostSnapshot;
    const linesUnchanged = parentLinesPreSnapshot === parentLinesPostSnapshot;

    recordTest(
      'Parent Order is byte-for-byte identical after correction submission',
      orderUnchanged,
      { preLength: parentOrderPreSnapshot.length, postLength: parentOrderPostSnapshot.length },
      { identical: orderUnchanged }
    );

    recordTest(
      'Original lines are byte-for-byte identical after correction submission',
      linesUnchanged,
      { preLength: parentLinesPreSnapshot.length, postLength: parentLinesPostSnapshot.length },
      { identical: linesUnchanged }
    );

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 5: Attempt duplicate simultaneous correction on the same line while first is open
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- STEP 4: Duplicate correction guard ---');

    const duplicateReq = {
      vin: testVin,
      lines: [
        {
          originalLineId: normalLine1._id.toString(),
          reason: 'Attempting a second simultaneous claim while first is open.',
        },
      ],
    };

    const duplicateRes = await apiRequest(
      'POST',
      `/public/orders/${normalOrder.trackingCode}/correction`,
      null,
      duplicateReq
    );

    recordTest(
      'Duplicate correction on same line while first is open is rejected (400) with clear error naming the line',
      duplicateRes.status === 400 &&
        duplicateRes.body?.error?.includes(normalLine1._id.toString()) &&
        duplicateRes.body?.conflictingLineId === normalLine1._id.toString(),
      { method: 'POST', path: `/public/orders/${normalOrder.trackingCode}/correction`, body: duplicateReq },
      duplicateRes
    );

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 6: Admin rejects the first correction claim via POST /api/orders/:id/reject
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- STEP 5: Admin rejects correction claim ---');

    const rejectReq = { reason: 'Original stamp confirmed valid by Alger port customs; duplicate stamp denied.' };
    const rejectRes = await apiRequest('POST', `/orders/${corrOrder1Id}/reject`, adminToken, rejectReq);

    const rejectedOrderInDb = await Order.findById(corrOrder1Id);
    recordTest(
      'Admin rejects correction order (POST /orders/:id/reject) -> status=rejected, reason stored',
      rejectRes.status === 200 &&
        rejectedOrderInDb.status === 'rejected' &&
        rejectedOrderInDb.rejectionReason === rejectReq.reason &&
        rejectedOrderInDb.rejectedBy?.toString() === admin._id.toString(),
      { method: 'POST', path: `/orders/${corrOrder1Id}/reject`, body: rejectReq },
      rejectRes
    );

    // 6.1 Confirm terminal status: all further order & line actions are refused
    const tryConfirmOnRejected = await apiRequest('PATCH', `/orders/${corrOrder1Id}/confirm`, adminToken, {});
    const tryPackageOnRejected = await apiRequest('POST', `/orders/${corrOrder1Id}/package`, adminToken);
    const tryCompleteOnRejected = await apiRequest('POST', `/orders/${corrOrder1Id}/complete`, adminToken);
    const tryAttachOnRejected = await apiAttachFile(corrLine1._id, adminToken, { note: 'illegal attach' }, jpegBuffer, 'test.jpg');
    const tryLockOnRejected = await apiRequest('POST', `/order-lines/${corrLine1._id}/lock`, adminToken, { approve: true });

    const terminalEnforced =
      tryConfirmOnRejected.status === 400 &&
      tryPackageOnRejected.status === 400 &&
      tryCompleteOnRejected.status === 400 &&
      tryAttachOnRejected.status === 400 &&
      tryLockOnRejected.status === 400;

    recordTest(
      'Rejected correction order is terminal — refuses confirm, package, complete, attach, and lock',
      terminalEnforced,
      {
        tryConfirm: tryConfirmOnRejected.status,
        tryPackage: tryPackageOnRejected.status,
        tryComplete: tryCompleteOnRejected.status,
        tryAttach: tryAttachOnRejected.status,
        tryLock: tryLockOnRejected.status,
      },
      {
        confirmErr: tryConfirmOnRejected.body?.error,
        attachErr: tryAttachOnRejected.body?.error,
        lockErr: tryLockOnRejected.body?.error,
      }
    );

    // Reject route scoped to correction orders only: test calling /reject on normal order
    const tryRejectNormal = await apiRequest('POST', `/orders/${normalOrder._id}/reject`, adminToken, { reason: 'Invalid' });
    recordTest(
      'POST /orders/:id/reject on a non-correction order is rejected (scoped to isCorrection orders only)',
      tryRejectNormal.status === 400,
      { method: 'POST', path: `/orders/${normalOrder._id}/reject` },
      tryRejectNormal
    );

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 7: Submit second correction on same line (now that first is rejected)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- STEP 6: Second correction submission after rejection ---');

    const secondCorrReq = {
      phone: testPhone,
      lines: [
        {
          originalLineId: normalLine1._id.toString(),
          reason: 'Client provided fresh consular notarization for re-issue.',
        },
      ],
    };

    const secondCorrRes = await apiRequest(
      'POST',
      `/public/orders/${normalOrder.trackingCode}/correction`,
      null,
      secondCorrReq
    );

    const corrOrder2Id = secondCorrRes.body?.order?._id || secondCorrRes.body?.orderId;
    if (corrOrder2Id) cleanupOrderIds.push(corrOrder2Id);

    const isCorr2Success =
      secondCorrRes.status === 201 &&
      (secondCorrRes.body?.order?.isCorrection === true || secondCorrRes.body?.isCorrection === true);

    recordTest(
      'Second correction on same line succeeds after previous claim was rejected',
      isCorr2Success,
      { method: 'POST', path: `/public/orders/${normalOrder.trackingCode}/correction`, body: secondCorrReq },
      secondCorrRes
    );

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 8: Admin confirms second correction and runs it through fulfillment
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- STEP 7: Reused Attach->Lock->Fulfillment on Correction Order ---');

    const corr2Lines = await OrderDocumentLine.find({ orderId: corrOrder2Id });
    const corr2Line1 = corr2Lines[0];

    // Confirm correction claim
    const confirmCorr2Res = await apiRequest('PATCH', `/orders/${corrOrder2Id}/confirm`, adminToken, { lineUpdates: [] });
    recordTest(
      'Admin confirms correction order 2 via standard PATCH /orders/:id/confirm',
      confirmCorr2Res.status === 200 && confirmCorr2Res.body?.order?.status === 'confirmed',
      { method: 'PATCH', path: `/orders/${corrOrder2Id}/confirm` },
      confirmCorr2Res
    );

    // Attach & Lock on correction line
    const attachCorr2Res = await apiAttachFile(corr2Line1._id, adminToken, { note: 'Notarized document attached' }, jpegBuffer, 'notary.jpg');
    const lockCorr2Res = await apiRequest('POST', `/order-lines/${corr2Line1._id}/lock`, adminToken, { approve: true });

    const order2AfterLock = await Order.findById(corrOrder2Id);
    recordTest(
      'Correction line attach & lock rolls order up to ready_for_dispatch (reused rollup)',
      lockCorr2Res.status === 200 && order2AfterLock.status === 'ready_for_dispatch',
      { corrLineStatus: lockCorr2Res.body?.line?.status },
      { orderStatus: order2AfterLock.status }
    );

    // Package -> Dispatch -> Deliver
    const pkg2Res = await apiRequest('POST', `/orders/${corrOrder2Id}/package`, adminToken);
    const dsp2Res = await apiRequest('POST', `/orders/${corrOrder2Id}/dispatch`, adminToken);
    const dlv2Res = await apiRequest('POST', `/orders/${corrOrder2Id}/deliver`, adminToken);

    const order2Delivered = await Order.findById(corrOrder2Id);
    recordTest(
      'Correction order reaches delivered via existing /package, /dispatch, /deliver routes',
      dlv2Res.status === 200 && order2Delivered.status === 'delivered',
      { method: 'POST', endpoints: ['package', 'dispatch', 'deliver'] },
      { status: order2Delivered.status, deliveredAt: order2Delivered.deliveredAt }
    );

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 9: Completed Close-Out (/complete route)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- STEP 8: Completed Close-Out (/complete) ---');

    // 9.1 Call /complete on delivered normal order
    const completeRes = await apiRequest('POST', `/orders/${normalOrder._id}/complete`, adminToken);
    const completedNormalOrder = await Order.findById(normalOrder._id);

    recordTest(
      'Admin marks delivered order as completed (POST /orders/:id/complete)',
      completeRes.status === 200 &&
        completedNormalOrder.status === 'completed' &&
        completedNormalOrder.completedBy?.toString() === admin._id.toString() &&
        Boolean(completedNormalOrder.completedAt),
      { method: 'POST', path: `/orders/${normalOrder._id}/complete` },
      completeRes
    );

    // 9.2 Call /complete on a non-delivered order
    const pendingOrderForTest = await Order.create({
      trackingCode: `DZ-PEND-${Date.now().toString().slice(-6)}`,
      orderType: 'new',
      status: 'pending',
      firstName: 'Test',
      lastName: 'Incomplete',
      phone: '0555999888',
      address: 'Oran, Algeria',
      wilaya: '31 - Oran',
      vin: `WAUZZZPEND${Date.now()}`.slice(0, 17),
    });
    cleanupOrderIds.push(pendingOrderForTest._id);

    const completeOnPendingRes = await apiRequest('POST', `/orders/${pendingOrderForTest._id}/complete`, adminToken);
    recordTest(
      'Call /complete on a non-delivered order is rejected with 400',
      completeOnPendingRes.status === 400 && completeOnPendingRes.body?.error?.includes('delivered'),
      { method: 'POST', path: `/orders/${pendingOrderForTest._id}/complete` },
      completeOnPendingRes
    );

    // 9.3 Call /complete on delivered correction order
    const completeCorr2Res = await apiRequest('POST', `/orders/${corrOrder2Id}/complete`, adminToken);
    const completedCorrOrder = await Order.findById(corrOrder2Id);
    recordTest(
      'Call /complete on delivered correction order succeeds (applies to correction orders identically)',
      completeCorr2Res.status === 200 && completedCorrOrder.status === 'completed',
      { method: 'POST', path: `/orders/${corrOrder2Id}/complete` },
      completeCorr2Res
    );

    // 9.4 Call /complete via client-facing route: confirm no such route exists (404)
    const publicCompleteRes = await apiRequest('POST', `/public/orders/${normalOrder.trackingCode}/complete`, null);
    recordTest(
      'Call /complete via client-facing route returns 404 (no client self-service complete exists)',
      publicCompleteRes.status === 404,
      { method: 'POST', path: `/public/orders/${normalOrder.trackingCode}/complete` },
      publicCompleteRes
    );

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 10: Tracking Route for Correction Orders
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- STEP 9: Tracking route simplified status for correction orders ---');

    // 10.1 Tracking for rejected correction order
    const trackRejectedRes = await apiRequest(
      'GET',
      `/public/orders/track?trackingCode=${corrOrder1InDb.trackingCode}&phone=${testPhone}`
    );
    recordTest(
      'Tracking route returns simplified status "rejected" and isCorrection=true for rejected correction order',
      trackRejectedRes.status === 200 &&
        trackRejectedRes.body?.orderStatus === 'rejected' &&
        trackRejectedRes.body?.isCorrection === true,
      { query: { trackingCode: corrOrder1InDb.trackingCode, phone: testPhone } },
      trackRejectedRes
    );

    // 10.2 Tracking for completed correction order
    const trackCompletedRes = await apiRequest(
      'GET',
      `/public/orders/track?trackingCode=${completedCorrOrder.trackingCode}&phone=${testPhone}`
    );
    recordTest(
      'Tracking route returns simplified status "completed" and isCorrection=true for completed correction order',
      trackCompletedRes.status === 200 &&
        trackCompletedRes.body?.orderStatus === 'completed' &&
        trackCompletedRes.body?.isCorrection === true,
      { query: { trackingCode: completedCorrOrder.trackingCode, phone: testPhone } },
      trackCompletedRes
    );

  } finally {
    // Cleanup generated orders and lines
    console.log('\nCleaning up verification orders...');
    if (cleanupOrderIds.length > 0) {
      await OrderDocumentLine.deleteMany({ orderId: { $in: cleanupOrderIds } });
      await Order.deleteMany({ _id: { $in: cleanupOrderIds } });
    }
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
  }

  // Summary
  console.log('\n================================================================');
  console.log(`  VERIFICATION RESULTS: ${passedTests}/${totalTests} PASSED, ${failedTests} FAILED`);
  console.log('================================================================');

  if (failedTests > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Fatal verification error:', err);
  process.exit(1);
});
