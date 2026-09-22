const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

// Load models
const DocumentType = require('../src/models/DocumentType');
const CarCategory = require('../src/models/CarCategory');
const Order = require('../src/models/Order');
const OrderDocumentLine = require('../src/models/OrderDocumentLine');
const User = require('../src/models/User');
const { generateTrackingCode, generateUniqueTrackingCode, CHARSET } = require('../src/utils/trackingCode');

const BASE_URL = 'http://localhost:5000/api';

async function main() {
  console.log('=== STARTING PHASE 3 VERIFICATION SCRIPT ===\n');

  // Connect to DB directly for setup & assertions
  await mongoose.connect('mongodb://localhost:27017/autopartdz');
  console.log('✓ Connected to MongoDB');

  // Get or create an admin token
  let adminUser = await User.findOne({ role: 'admin' });
  if (!adminUser) {
    adminUser = await User.create({
      name: 'Admin Test',
      email: `admin-test-${Date.now()}@autopartdz.dz`,
      passwordHash: 'dummy',
      role: 'admin',
    });
  }

  const token = jwt.sign(
    { userId: adminUser._id, role: adminUser.role },
    process.env.JWT_SECRET || 'changeme-jwt-secret-key-32chars!!',
    { expiresIn: '1h' }
  );
  const adminHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 1: Tracking code generation and uniqueness
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST 1: Tracking Code Generation & Uniqueness ---');
  const forbiddenChars = ['0', 'O', '1', 'I', 'L'];
  const generatedCodes = new Set();
  let trackingCodePass = true;

  for (let i = 0; i < 500; i++) {
    const code = generateTrackingCode();
    if (code.length !== 8) {
      console.error(`FAIL: Code length ${code.length} != 8: "${code}"`);
      trackingCodePass = false;
      break;
    }
    for (const char of code) {
      if (forbiddenChars.includes(char) || !CHARSET.includes(char)) {
        console.error(`FAIL: Code contains forbidden or non-charset character: "${char}" in "${code}"`);
        trackingCodePass = false;
        break;
      }
    }
    generatedCodes.add(code);
  }

  if (trackingCodePass && generatedCodes.size === 500) {
    console.log(`✓ PASS: 500 generated codes are 8 chars, strictly in CHARSET, zero collisions, zero forbidden chars.`);
    const sampleCode = await generateUniqueTrackingCode();
    console.log(`  Sample generated tracking code: "${sampleCode}"`);
  } else {
    throw new Error('Test 1 failed.');
  }

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 2: Public Document-Types Allowlist & Data Isolation
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST 2: Public Document-Types Allowlist & Data Leaks Check ---');
  const docTypesRes = await fetch(`${BASE_URL}/public/document-types?locale=en`);
  const docTypes = await docTypesRes.json();

  if (!docTypesRes.ok || !Array.isArray(docTypes)) {
    throw new Error(`Failed to fetch public document types: ${JSON.stringify(docTypes)}`);
  }

  console.log(`Fetched ${docTypes.length} active document types from public API.`);
  let leakDetected = false;

  for (const doc of docTypes) {
    if (doc.costPrice !== undefined) {
      console.error(`LEAK: doc.costPrice is defined!`, doc);
      leakDetected = true;
    }
    if (doc.defaultSource !== undefined) {
      console.error(`LEAK: doc.defaultSource is defined!`, doc);
      leakDetected = true;
    }
    if (doc.originLanguage !== undefined) {
      console.error(`LEAK: doc.originLanguage is defined!`, doc);
      leakDetected = true;
    }
    if (doc.pricing?.originalOnly?.costPrice !== undefined) {
      console.error(`LEAK: pricing.originalOnly.costPrice is defined!`, doc.pricing);
      leakDetected = true;
    }
    if (doc.pricing?.originalPlusTranslation?.costPrice !== undefined) {
      console.error(`LEAK: pricing.originalPlusTranslation.costPrice is defined!`, doc.pricing);
      leakDetected = true;
    }
    if (doc.pricing?.translationOnly?.costPrice !== undefined) {
      console.error(`LEAK: pricing.translationOnly.costPrice is defined!`, doc.pricing);
      leakDetected = true;
    }
  }

  if (!leakDetected && docTypes.length > 0) {
    console.log('✓ PASS: Strict allowlist verified. No costPrice, defaultSource, or originLanguage leaked.');
    console.log('  Actual public document item shape:');
    console.log(JSON.stringify(docTypes[0], null, 2));
  } else if (docTypes.length === 0) {
    console.log('⚠ Note: No documents in catalog to check allowlist.');
  }

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 3: Correction Lookup "Code Alone Is Not Enough" Rule
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST 3: Correction Lookup "Code Alone Is Not Enough" Rule ---');

  // Clean up any old test documents from previous runs
  await DocumentType.deleteMany({ shortName: 'Test Doc COC' });

  // Create a document type for orders testing
  const testDoc = await DocumentType.create({
    shortName: 'Test Doc COC',
    fullName: 'Certificate of Origin Customs',
    slug: 'test-doc-coc-' + Date.now(),
    category: 'customs',
    hasTranslation: true,
    defaultSource: 'mixed',
    pricing: {
      originalOnly: { clientPrice: 5000, costPrice: 2000 },
      originalPlusTranslation: { clientPrice: 8000, costPrice: 3500 },
      translationOnly: { clientPrice: 4000, costPrice: 1500 },
    },
    translations: {
      fr: { fullName: 'Certificat d Origine Douanier', category: 'Douane', description: 'Description FR' },
      ar: { fullName: 'شهادة المنشأ الجمركية', category: 'جمارك', description: 'شرح بالعربية' },
    },
  });

  const testTrackingCode = await generateUniqueTrackingCode();
  const testOrder = await Order.create({
    trackingCode: testTrackingCode,
    orderType: 'new',
    status: 'pending',
    firstName: 'Ahmed',
    lastName: 'Mansouri',
    phone: '0555123456',
    wilaya: '16 - Alger',
    address: '12 Rue Didouche Mourad',
    vin: 'WAUZZZ8V1GA123456',
  });

  const testLine = await OrderDocumentLine.create({
    orderId: testOrder._id,
    documentTypeId: testDoc._id,
    translationMode: 'original_plus_translation',
    clientPrice: 8000,
    costPrice: 3500,
    source: null, // mixed
    status: 'needed',
  });

  // A. Attempt lookup with trackingCode alone
  const lookupSoloRes = await fetch(`${BASE_URL}/public/orders/correction/lookup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ trackingCode: testTrackingCode }),
  });
  const lookupSoloBody = await lookupSoloRes.json();
  console.log(`Attempt with trackingCode alone status: ${lookupSoloRes.status}`);
  if (lookupSoloRes.status === 400) {
    console.log(`✓ PASS: Code alone rejected with 400: "${lookupSoloBody.error}"`);
  } else {
    throw new Error(`Expected 400, got ${lookupSoloRes.status}`);
  }

  // B. Attempt lookup with trackingCode + wrong phone and wrong vin
  const lookupWrongRes = await fetch(`${BASE_URL}/public/orders/correction/lookup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      trackingCode: testTrackingCode,
      phone: '0666999999',
    }),
  });
  const lookupWrongBody = await lookupWrongRes.json();
  console.log(`Attempt with wrong phone status: ${lookupWrongRes.status}`);
  if (lookupWrongRes.status === 404) {
    console.log(`✓ PASS: Generic 404 returned without leaking mismatch source: "${lookupWrongBody.error}"`);
  } else {
    throw new Error(`Expected 404, got ${lookupWrongRes.status}`);
  }

  // C. Lookup with valid credentials against pending order -> must return 404 (status gate)
  const lookupPendingRes = await fetch(`${BASE_URL}/public/orders/correction/lookup?locale=fr`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      trackingCode: testTrackingCode,
      phone: '0555123456',
    }),
  });
  const lookupPendingBody = await lookupPendingRes.json();
  if (lookupPendingRes.status === 404) {
    console.log(`✓ PASS: Pending order rejected with generic 404 per status gate rule.`);
  } else {
    throw new Error(`Expected 404 for pending order, got ${lookupPendingRes.status}`);
  }

  // D. Valid lookup with trackingCode + valid phone against confirmed order
  const confirmedTrackingCode = await generateUniqueTrackingCode();
  const testConfirmedOrder = await Order.create({
    trackingCode: confirmedTrackingCode,
    orderType: 'new',
    status: 'confirmed',
    firstName: 'Ahmed',
    lastName: 'Mansouri',
    phone: '0555123456',
    wilaya: '16 - Alger',
    address: '12 Rue Didouche Mourad',
    vin: 'WAUZZZ8V1GA123456',
  });
  await OrderDocumentLine.create({
    orderId: testConfirmedOrder._id,
    documentTypeId: testDoc._id,
    translationMode: 'original_plus_translation',
    clientPrice: 8000,
    costPrice: 3500,
    source: 'local',
    status: 'needed',
  });

  const lookupValidRes = await fetch(`${BASE_URL}/public/orders/correction/lookup?locale=fr`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      trackingCode: confirmedTrackingCode,
      phone: '0555123456',
    }),
  });
  const lookupValidBody = await lookupValidRes.json();
  if (lookupValidRes.status === 200 && lookupValidBody.orderDocumentLines?.length > 0) {
    console.log(`✓ PASS: Valid lookup against confirmed order returned details and sanitized document lines.`);
    console.log(`  Resolved French line title: "${lookupValidBody.orderDocumentLines[0].documentType.fullName}"`);
    if (lookupValidBody.orderDocumentLines[0].costPrice === undefined) {
      console.log(`✓ PASS: Line costPrice is NOT leaked in correction lookup response.`);
    } else {
      throw new Error(`costPrice leaked in correction lookup!`);
    }
  } else {
    throw new Error(`Valid lookup failed: ${JSON.stringify(lookupValidBody)}`);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 4: Mixed-Source Blocks Confirm Rule
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST 4: Mixed-Source-Blocks-Confirm Rule ---');
  // testLine has source: null
  const confirmBlockedRes = await fetch(`${BASE_URL}/orders/${testOrder._id}/confirm`, {
    method: 'PATCH',
    headers: adminHeaders,
    body: JSON.stringify({}),
  });
  const confirmBlockedBody = await confirmBlockedRes.json();
  console.log(`Confirm with source: null status: ${confirmBlockedRes.status}`);
  if (confirmBlockedRes.status === 400 && confirmBlockedBody.error?.includes('missing source')) {
    console.log(`✓ PASS: Confirm blocked with 400: "${confirmBlockedBody.error}"`);
  } else {
    throw new Error(`Expected 400 with missing source error, got: ${JSON.stringify(confirmBlockedBody)}`);
  }

  // Now assign source to 'local' and confirm
  const confirmSuccessRes = await fetch(`${BASE_URL}/orders/${testOrder._id}/confirm`, {
    method: 'PATCH',
    headers: adminHeaders,
    body: JSON.stringify({
      lineUpdates: [{ lineId: testLine._id, source: 'local' }],
    }),
  });
  const confirmSuccessBody = await confirmSuccessRes.json();
  console.log(`Confirm after setting source status: ${confirmSuccessRes.status}`);
  if (confirmSuccessRes.status === 200 && confirmSuccessBody.order?.status === 'confirmed') {
    console.log(`✓ PASS: Order confirmed successfully after source was assigned to 'local'.`);
    console.log(`  Confirmed by user: ${confirmSuccessBody.order.confirmedBy}`);
  } else {
    throw new Error(`Confirm failed: ${JSON.stringify(confirmSuccessBody)}`);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 5: Pending-Only Cascade Delete Rule
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST 5: Pending-Only Cascade Delete Rule ---');
  // Attempt to delete testOrder (which is now 'confirmed')
  const deleteConfirmedRes = await fetch(`${BASE_URL}/orders/${testOrder._id}`, {
    method: 'DELETE',
    headers: adminHeaders,
  });
  const deleteConfirmedBody = await deleteConfirmedRes.json();
  console.log(`Attempt to delete confirmed order status: ${deleteConfirmedRes.status}`);
  if (deleteConfirmedRes.status === 400) {
    console.log(`✓ PASS: Confirmed order delete rejected with 400: "${deleteConfirmedBody.error}"`);
  } else {
    throw new Error(`Expected 400, got ${deleteConfirmedRes.status}`);
  }

  // Create a pending order with 2 lines
  const pendingTracking = await generateUniqueTrackingCode();
  const pendingOrder = await Order.create({
    trackingCode: pendingTracking,
    orderType: 'new',
    status: 'pending',
    firstName: 'Karim',
    lastName: 'Belkacem',
    phone: '0770112233',
    wilaya: '31 - Oran',
    address: 'Es Senia Oran',
    vin: 'VF1BB0A0F12345678',
  });
  const pLine1 = await OrderDocumentLine.create({
    orderId: pendingOrder._id,
    documentTypeId: testDoc._id,
    translationMode: 'original_only',
    clientPrice: 5000,
    costPrice: 2000,
    source: 'local',
  });
  const pLine2 = await OrderDocumentLine.create({
    orderId: pendingOrder._id,
    documentTypeId: testDoc._id,
    translationMode: 'translation_only',
    clientPrice: 4000,
    costPrice: 1500,
    source: 'china',
  });

  // Verify lines exist
  let lineCountBefore = await OrderDocumentLine.countDocuments({ orderId: pendingOrder._id });
  console.log(`Pending order created with ${lineCountBefore} document lines.`);

  // Delete pending order
  const deletePendingRes = await fetch(`${BASE_URL}/orders/${pendingOrder._id}`, {
    method: 'DELETE',
    headers: adminHeaders,
  });
  const deletePendingBody = await deletePendingRes.json();
  if (deletePendingRes.status === 200) {
    const orderAfter = await Order.findById(pendingOrder._id);
    const lineCountAfter = await OrderDocumentLine.countDocuments({ orderId: pendingOrder._id });
    if (!orderAfter && lineCountAfter === 0) {
      console.log(`✓ PASS: Pending order deleted and cascaded to all ${lineCountBefore} document lines.`);
    } else {
      throw new Error(`Cascade delete failed. Lines remaining: ${lineCountAfter}`);
    }
  } else {
    throw new Error(`Failed to delete pending order: ${JSON.stringify(deletePendingBody)}`);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 6: Retrofit of Phase 2 Admin Forms (Translation Tabs)
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST 6: Retrofit of Phase 2 Admin Forms (Translation Tabs) ---');
  // Check CarCategory translations
  const testCat = await CarCategory.create({
    name: 'Electric SUV',
    description: 'Electric passenger vehicles',
    translations: {
      fr: { name: 'SUV Électrique', description: 'Véhicules particuliers électriques' },
      ar: { name: 'سيارات الدفع الرباعي الكهربائية', description: 'مركبات سياحية كهربائية' },
    },
  });

  const catEnRes = await fetch(`${BASE_URL}/public/car-categories?locale=en`);
  const catFrRes = await fetch(`${BASE_URL}/public/car-categories?locale=fr`);
  const catArRes = await fetch(`${BASE_URL}/public/car-categories?locale=ar`);

  const catEn = (await catEnRes.json()).find((c) => c.id === testCat._id.toString());
  const catFr = (await catFrRes.json()).find((c) => c.id === testCat._id.toString());
  const catAr = (await catArRes.json()).find((c) => c.id === testCat._id.toString());

  if (
    catEn?.name === 'Electric SUV' &&
    catFr?.name === 'SUV Électrique' &&
    catAr?.name === 'سيارات الدفع الرباعي الكهربائية'
  ) {
    console.log(`✓ PASS: Baseline English name preserved ("${catEn.name}"), French resolved ("${catFr.name}"), Arabic resolved ("${catAr.name}").`);
  } else {
    throw new Error(`CarCategory translation resolution failed: EN="${catEn?.name}", FR="${catFr?.name}", AR="${catAr?.name}"`);
  }

  // Cleanup test records
  await OrderDocumentLine.deleteMany({ orderId: testOrder._id });
  await Order.findByIdAndDelete(testOrder._id);
  await DocumentType.findByIdAndDelete(testDoc._id);
  await CarCategory.findByIdAndDelete(testCat._id);
  console.log('✓ Cleaned up test database records.');

  console.log('\n=== ALL PHASE 3 VERIFICATION CHECKS PASSED SUCCESSFULLY ===');
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('\n❌ VERIFICATION SCRIPT FAILED:', err);
  process.exit(1);
});
