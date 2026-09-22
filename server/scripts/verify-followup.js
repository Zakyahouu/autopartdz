const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');

const DocumentType = require('../src/models/DocumentType');
const Order = require('../src/models/Order');
const OrderDocumentLine = require('../src/models/OrderDocumentLine');
const { generateUniqueTrackingCode } = require('../src/utils/trackingCode');

const BASE_URL = 'http://localhost:5000/api';

async function run() {
  console.log('====================================================');
  console.log('  PHASE 3 PRE-MERGE FOLLOW-UP VERIFICATION SUITE');
  console.log('====================================================\n');

  await mongoose.connect('mongodb://localhost:27017/autopartdz');
  console.log('✓ Connected to MongoDB (mongodb://localhost:27017/autopartdz)\n');

  // =========================================================================
  // ITEM 1: TRANSLATION RETROFIT TRACE (ARABIC OVERRIDE & FRENCH FALLBACK)
  // =========================================================================
  console.log('────────────────────────────────────────────────────────────');
  console.log('ITEM 1: Translation Retrofit Trace (Arabic vs French fallback)');
  console.log('────────────────────────────────────────────────────────────');

  // Create a dedicated DocumentType with English baseline and Arabic override, but NO French override
  const testDoc = await DocumentType.create({
    code: 'DOC-TR-TEST-' + Date.now().toString().slice(-4),
    shortName: 'COC Test',
    fullName: 'Certificate of Conformity Baseline (English)',
    category: 'Customs & Compliance',
    description: 'Baseline technical inspection conformity document.',
    defaultSource: 'local',
    hasTranslation: true,
    pricing: {
      originalOnly: { costPrice: 2000, clientPrice: 4000 },
      originalPlusTranslation: { costPrice: 3500, clientPrice: 6500 },
      translationOnly: { costPrice: 1500, clientPrice: 3000 },
    },
    translations: {
      ar: {
        fullName: 'شهادة المطابقة الجمركية المعتمدة (عربي)',
        description: 'وثيقة فحص المطابقة التقنية الصادرة للمركبات.',
        category: 'الجمارك والامتثال',
      },
      fr: {
        // French override is completely absent or empty
      },
    },
    active: true,
  });

  console.log(`Created DocumentType in DB: ID ${testDoc._id}`);
  console.log(`- Baseline English fullName: "${testDoc.fullName}"`);
  console.log(`- Arabic override translations.ar.fullName: "${testDoc.translations.ar.fullName}"`);
  console.log(`- French override translations.fr.fullName: ${JSON.stringify(testDoc.translations.fr?.fullName || undefined)} (None set)`);

  // Call GET /api/public/document-types?locale=ar
  console.log('\n[1.1] Calling GET /api/public/document-types?locale=ar ...');
  const resAr = await fetch(`${BASE_URL}/public/document-types?locale=ar`);
  const docsAr = await resAr.json();
  const entryAr = docsAr.find((d) => d.id === testDoc._id.toString());
  console.log('HTTP Status:', resAr.status);
  console.log('Returned entry for test document:');
  console.log(JSON.stringify(entryAr, null, 2));

  if (entryAr && entryAr.fullName === 'شهادة المطابقة الجمركية المعتمدة (عربي)') {
    console.log('✓ SUCCESS: Arabic override correctly returned in fullName field!');
  } else {
    console.error('✗ FAIL: Arabic override did not match:', entryAr?.fullName);
    process.exit(1);
  }

  // Call GET /api/public/document-types?locale=fr
  console.log('\n[1.2] Calling GET /api/public/document-types?locale=fr ...');
  const resFr = await fetch(`${BASE_URL}/public/document-types?locale=fr`);
  const docsFr = await resFr.json();
  const entryFr = docsFr.find((d) => d.id === testDoc._id.toString());
  console.log('HTTP Status:', resFr.status);
  console.log('Returned entry for SAME test document:');
  console.log(JSON.stringify(entryFr, null, 2));

  if (entryFr && entryFr.fullName === 'Certificate of Conformity Baseline (English)') {
    console.log('✓ SUCCESS: French request correctly fell back to English baseline fullName (not null, empty, or omitted)!');
  } else {
    console.error('✗ FAIL: Fallback failed:', entryFr?.fullName);
    process.exit(1);
  }

  // =========================================================================
  // ITEM 3: STATUS CHECK ON CORRECTION LOOKUP (PENDING -> 404, CONFIRMED -> 200)
  // =========================================================================
  console.log('\n────────────────────────────────────────────────────────────');
  console.log('ITEM 3: Status Check on Correction Lookup (Pending vs Confirmed)');
  console.log('────────────────────────────────────────────────────────────');

  // Create an order in 'pending' status with two document lines
  const pendingTrackingCode = await generateUniqueTrackingCode();
  const clientPhone = '+213555987654';
  const clientVin = 'KMHCT4AE8KU' + Math.floor(100000 + Math.random() * 900000);

  // Another doc for multi-line order
  const secondDoc = await DocumentType.create({
    code: 'DOC-2-' + Date.now().toString().slice(-4),
    shortName: 'Commercial Invoice',
    fullName: 'Commercial Purchase Invoice',
    category: 'Commercial',
    defaultSource: 'china',
    hasTranslation: false,
    pricing: {
      originalOnly: { costPrice: 1000, clientPrice: 2500 },
    },
    active: true,
  });

  const orderPending = await Order.create({
    trackingCode: pendingTrackingCode,
    orderType: 'new',
    status: 'pending', // <--- Genuinely pending!
    firstName: 'Karim',
    lastName: 'Bensalem',
    email: 'karim.bensalem@example.dz',
    phone: clientPhone,
    wilaya: '16 - Alger',
    address: '14 Rue Didouche Mourad, Alger Centre',
    vin: clientVin,
    carModel: 'Hyundai Tucson 2023',
    note: 'Initial pending order for status gate check',
  });

  const line1 = await OrderDocumentLine.create({
    orderId: orderPending._id,
    documentTypeId: testDoc._id,
    translationMode: 'original_only',
    clientPrice: 4000, // snapshot at 4000
    costPrice: 2000,
    source: 'local',
    status: 'needed',
  });

  const line2 = await OrderDocumentLine.create({
    orderId: orderPending._id,
    documentTypeId: secondDoc._id,
    translationMode: 'original_only',
    clientPrice: 2500,
    costPrice: 1000,
    source: 'china',
    status: 'needed',
  });

  console.log(`Created Pending Order in DB: ID ${orderPending._id}`);
  console.log(`- Tracking Code: "${orderPending.trackingCode}"`);
  console.log(`- Phone: "${orderPending.phone}"`);
  console.log(`- VIN: "${orderPending.vin}"`);
  console.log(`- Status: "${orderPending.status}" (Pending)`);
  console.log(`- Document Lines count: 2 (Line 1: ${line1._id}, Line 2: ${line2._id})`);

  // [3.1] Test lookup against pending order -> MUST return 404
  console.log('\n[3.1] Calling POST /api/public/orders/correction/lookup on PENDING order ...');
  const lookupPendingRes = await fetch(`${BASE_URL}/public/orders/correction/lookup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      trackingCode: orderPending.trackingCode,
      phone: orderPending.phone,
    }),
  });
  const lookupPendingBody = await lookupPendingRes.json();
  console.log('HTTP Status:', lookupPendingRes.status);
  console.log('Response body:', JSON.stringify(lookupPendingBody, null, 2));

  if (lookupPendingRes.status === 404 && lookupPendingBody.error?.includes('No matching order found')) {
    console.log('✓ SUCCESS: Pending order returned generic 404 — leaking zero information!');
  } else {
    console.error('✗ FAIL: Expected 404 for pending order, got:', lookupPendingRes.status, lookupPendingBody);
    process.exit(1);
  }

  // [3.2] Now transition the order to 'confirmed'
  console.log('\n[3.2] Transitioning Order status to "confirmed" ...');
  orderPending.status = 'confirmed';
  await orderPending.save();
  console.log(`Order status updated to: "${orderPending.status}"`);

  // [3.3] Re-run lookup on confirmed order -> MUST return 200
  console.log('\n[3.3] Calling POST /api/public/orders/correction/lookup on CONFIRMED order ...');
  const lookupConfirmedRes = await fetch(`${BASE_URL}/public/orders/correction/lookup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      trackingCode: orderPending.trackingCode,
      phone: orderPending.phone,
    }),
  });
  const lookupConfirmedBody = await lookupConfirmedRes.json();
  console.log('HTTP Status:', lookupConfirmedRes.status);
  console.log('Response body:');
  console.log(JSON.stringify(lookupConfirmedBody, null, 2));

  if (lookupConfirmedRes.status === 200 && lookupConfirmedBody.id === orderPending._id.toString()) {
    console.log('✓ SUCCESS: Confirmed order returned 200 with sanitized details and lines!');
  } else {
    console.error('✗ FAIL: Expected 200 for confirmed order, got:', lookupConfirmedRes.status, lookupConfirmedBody);
    process.exit(1);
  }

  // =========================================================================
  // ITEM 2: CORRECTION FLOW END-TO-END TRACE
  // =========================================================================
  console.log('\n────────────────────────────────────────────────────────────');
  console.log('ITEM 2: Correction Flow End-to-End Trace');
  console.log('────────────────────────────────────────────────────────────');

  // We take one real originalLineId from lookupConfirmedBody
  const chosenLine = lookupConfirmedBody.orderDocumentLines[0];
  const originalLineId = chosenLine.id;
  console.log(`Selected originalLineId: ${originalLineId} (Document: "${chosenLine.documentType.fullName}", Old clientPrice: ${chosenLine.clientPrice} DZD)`);

  // Now change the DocumentType's pricing in the catalog from 4000 to 5800 DZD
  // to prove clientPrice is re-snapshotted from current catalog, not copied!
  console.log('\nUpdating DocumentType catalog pricing to prove re-snapshotting:');
  console.log('Previous originalOnly.clientPrice in catalog: 4000 DZD');
  testDoc.pricing.originalOnly.clientPrice = 5800;
  testDoc.pricing.originalOnly.costPrice = 2900;
  await testDoc.save();
  console.log('New current originalOnly.clientPrice in catalog: 5800 DZD');

  // Submit correction via POST /api/public/orders/correction
  const correctionReasonText = 'VIN digits 5-8 smudged on the original document certificate.';
  console.log('\nSubmitting POST /api/public/orders/correction ...');
  const correctionPayload = {
    originalOrderId: lookupConfirmedBody.id,
    corrections: [
      {
        originalLineId: originalLineId,
        reason: correctionReasonText,
      },
    ],
    updates: {
      note: 'Client updated note regarding customs inspection appointment',
    },
  };
  console.log('Payload:', JSON.stringify(correctionPayload, null, 2));

  const correctionRes = await fetch(`${BASE_URL}/public/orders/correction`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(correctionPayload),
  });
  const correctionBody = await correctionRes.json();
  console.log('HTTP Status:', correctionRes.status);
  console.log('Response body:', JSON.stringify(correctionBody, null, 2));

  if (correctionRes.status !== 201 || !correctionBody.orderId) {
    console.error('✗ FAIL: Correction submission failed:', correctionRes.status, correctionBody);
    process.exit(1);
  }

  // Fetch the resulting new order and its lines directly from DB to inspect all fields
  const newOrder = await Order.findById(correctionBody.orderId).lean();
  const newLines = await OrderDocumentLine.find({ orderId: newOrder._id }).lean();

  console.log('\n--- VERIFYING RESULTING CORRECTION ORDER ---');
  console.log(`New Order ID: ${newOrder._id}`);
  console.log(`Tracking Code: "${newOrder.trackingCode}" (Valid format, generated unique)`);
  console.log(`Order Type: "${newOrder.orderType}"`);
  console.log(`Linked Order ID: ${newOrder.linkedOrderId} (Points to original order: ${orderPending._id})`);
  console.log(`Total OrderDocumentLines count: ${newLines.length} (Expected: EXACTLY 1)`);

  const resultingLine = newLines[0];
  console.log('\n--- VERIFYING RESULTING CORRECTION LINE ---');
  console.log(`Line ID: ${resultingLine._id}`);
  console.log(`Document Type ID: ${resultingLine.documentTypeId}`);
  console.log(`Correction Reason: "${resultingLine.correctionReason}"`);
  console.log(`Client Price (re-snapshotted): ${resultingLine.clientPrice} DZD (Original line was: ${chosenLine.clientPrice} DZD)`);
  console.log(`Cost Price (re-snapshotted): ${resultingLine.costPrice} DZD`);
  console.log(`Source: ${resultingLine.source}`);
  console.log(`Status: ${resultingLine.status}`);

  // Assertions
  const assertions = [
    {
      name: 'trackingCode is present and non-empty (8 characters)',
      pass: Boolean(newOrder.trackingCode && newOrder.trackingCode.length === 8),
    },
    {
      name: 'linkedOrderId matches original order id',
      pass: newOrder.linkedOrderId.toString() === orderPending._id.toString(),
    },
    {
      name: 'Has EXACTLY ONE OrderDocumentLine (not copied full document set of 2 lines)',
      pass: newLines.length === 1,
    },
    {
      name: 'correctionReason is populated with user reason',
      pass: resultingLine.correctionReason === correctionReasonText,
    },
    {
      name: 'clientPrice was re-snapshotted from current catalog pricing (5800 DZD, not old 4000 DZD)',
      pass: resultingLine.clientPrice === 5800,
    },
  ];

  console.log('\n--- VERIFICATION CHECKLIST ---');
  let allPassed = true;
  for (const a of assertions) {
    if (a.pass) {
      console.log(`✓ PASS: ${a.name}`);
    } else {
      console.error(`✗ FAIL: ${a.name}`);
      allPassed = false;
    }
  }

  if (!allPassed) {
    process.exit(1);
  }

  console.log('\n====================================================');
  console.log('  ALL PRE-MERGE VERIFICATIONS COMPLETED SUCCESSFULLY!');
  console.log('====================================================\n');
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('Fatal error during verification:', err);
  process.exit(1);
});
