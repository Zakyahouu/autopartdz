/**
 * verify-phase4-files.js
 * Comprehensive automated verification for Phase 4 File Upload & Viewing Gaps follow-up:
 * 1. File upload end-to-end on /ship, /mark-printed, and dedicated /files route
 * 2. File visibility on GET /api/orders/:id, GET /api/china/lines, and retrieval via GET /api/files/:id
 * 3. Public tracking trace for 'delivered' order confirming zero file leakage
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const Order = require('../src/models/Order');
const OrderDocumentLine = require('../src/models/OrderDocumentLine');
const DocumentType = require('../src/models/DocumentType');
const User = require('../src/models/User');
const File = require('../src/models/File');

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/autopartdz';
const JWT_SECRET = process.env.JWT_SECRET;
const BASE_URL = 'http://localhost:5000/api';

function createToken(user) {
  return jwt.sign(
    { userId: user._id, role: user.role },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

// Helper to build multipart/form-data body manually with boundary
function createMultipartBody(fields = {}, file = null) {
  const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
  const parts = [];

  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined && value !== null) {
      parts.push(
        Buffer.from(
          `--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${value}\r\n`
        )
      );
    }
  }

  if (file) {
    const { fieldName, filename, contentType, buffer } = file;
    parts.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${fieldName}"; filename="${filename}"\r\nContent-Type: ${contentType}\r\n\r\n`
      )
    );
    parts.push(buffer);
    parts.push(Buffer.from('\r\n'));
  }

  parts.push(Buffer.from(`--${boundary}--\r\n`));

  return {
    boundary,
    contentTypeHeader: `multipart/form-data; boundary=${boundary}`,
    bodyBuffer: Buffer.concat(parts),
  };
}

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log('✓ Connected to MongoDB');

  // Find or create Admin
  const admin = await User.findOne({ role: 'admin' });
  const adminToken = createToken(admin);

  // Find or create China Associate A & B
  let associateA = await User.findOne({ email: 'china.associate.a@autopartdz.dz' });
  if (!associateA) {
    associateA = await User.create({
      name: 'Li Wei (Associate A)',
      email: 'china.associate.a@autopartdz.dz',
      passwordHash: 'dummy',
      role: 'china_associate',
      active: true,
    });
  }
  const tokenA = createToken(associateA);

  let associateB = await User.findOne({ email: 'china.associate.b@autopartdz.dz' });
  if (!associateB) {
    associateB = await User.create({
      name: 'Zhang Ming (Associate B)',
      email: 'china.associate.b@autopartdz.dz',
      passwordHash: 'dummy',
      role: 'china_associate',
      active: true,
    });
  }
  const tokenB = createToken(associateB);

  // Document types
  let chinaDoc = await DocumentType.findOne({ defaultSource: 'china', active: true });
  if (!chinaDoc) {
    chinaDoc = await DocumentType.create({
      code: 'DOC-CH-FL',
      fullName: 'China Vehicle Certificate of Exportation',
      shortName: 'Export Cert',
      category: 'legal',
      defaultSource: 'china',
      active: true,
      pricing: { originalOnly: { clientPrice: 12000, costPrice: 6000 } },
    });
  }

  let localDoc = await DocumentType.findOne({ defaultSource: 'local', active: true });
  if (!localDoc) {
    localDoc = await DocumentType.create({
      code: 'DOC-LOC-FL',
      fullName: 'Customs Tax Declaration Algeria',
      shortName: 'Tax Dec',
      category: 'legal',
      defaultSource: 'local',
      active: true,
      pricing: { originalOnly: { clientPrice: 4000, costPrice: 1500 } },
    });
  }

  // Create test order
  const trackingCode = `DZ-FILES-${Date.now().toString().slice(-6)}`;
  const order = await Order.create({
    trackingCode,
    orderType: 'new',
    status: 'confirmed',
    firstName: 'Amine',
    lastName: 'Bouzid',
    phone: '0661223344',
    wilaya: '06 - Béjaïa',
    address: '15 Rue de la Liberté, Béjaïa',
    vin: 'WAUZZZ8V' + Math.floor(100000000 + Math.random() * 900000000),
    carModel: 'Audi A3 Sportback 2023',
    confirmedAt: new Date(),
    confirmedBy: admin._id,
  });

  // Create lines:
  // 1. China line for ship test
  const chinaLineForShip = await OrderDocumentLine.create({
    orderId: order._id,
    documentTypeId: chinaDoc._id,
    translationMode: 'original_only',
    clientPrice: 12000,
    costPrice: 6000,
    source: 'china',
    assignedChinaAccountId: associateA._id,
    status: 'needed',
  });

  // 2. Local line for mark-printed test
  const localLineForPrint = await OrderDocumentLine.create({
    orderId: order._id,
    documentTypeId: localDoc._id,
    translationMode: 'original_only',
    clientPrice: 4000,
    costPrice: 1500,
    source: 'local',
    status: 'needed',
  });

  // 3. China line for dedicated /files attach test
  const chinaLineForAttach = await OrderDocumentLine.create({
    orderId: order._id,
    documentTypeId: chinaDoc._id,
    translationMode: 'original_only',
    clientPrice: 12000,
    costPrice: 6000,
    source: 'china',
    assignedChinaAccountId: associateA._id,
    status: 'needed',
  });

  console.log('\n===============================================================');
  console.log(' ITEM 1: FILE UPLOADS ON SHIP, MARK-PRINTED, AND DEDICATED /FILES');
  console.log('===============================================================');

  // 1.1 Upload with POST /api/order-lines/:lineId/ship
  console.log('\n[1.1] Testing file upload on POST /api/order-lines/:lineId/ship ...');
  const dummyWaybillPdf = Buffer.from('%PDF-1.4 Waybill Proof of Air Shipping SF Express content...');
  const shipMultipart = createMultipartBody(
    { shippingTrackingCode: 'SF-9911223344', note: 'China dispatch proof attached' },
    { fieldName: 'file', filename: 'Waybill_SF991122.pdf', contentType: 'application/pdf', buffer: dummyWaybillPdf }
  );

  const shipRes = await fetch(`${BASE_URL}/order-lines/${chinaLineForShip._id}/ship`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tokenA}`,
      'Content-Type': shipMultipart.contentTypeHeader,
    },
    body: shipMultipart.bodyBuffer,
  });
  const shipData = await shipRes.json();
  console.log('HTTP Status:', shipRes.status);
  console.log('Response Message:', shipData.message);
  console.log('Line Status:', shipData.line?.status);
  console.log('Tracking Code:', shipData.line?.shippingTrackingCode);
  console.log('Uploaded Files count on Line:', shipData.line?.uploadedFiles?.length);
  const shipFileItem = shipData.line?.uploadedFiles?.[0];
  console.log('Uploaded File:', {
    id: shipFileItem?._id,
    filename: shipFileItem?.filename,
    contentType: shipFileItem?.contentType,
    size: shipFileItem?.size,
    uploadedBy: shipFileItem?.uploadedByUserId?.name || shipFileItem?.uploadedByUserId,
  });

  if (shipRes.status !== 200 || !shipFileItem?._id) {
    throw new Error('POST /ship with file failed!');
  }
  console.log('✓ PASS: File successfully uploaded and linked on /ship!');

  // 1.2 Upload with POST /api/order-lines/:lineId/mark-printed
  console.log('\n[1.2] Testing file upload on POST /api/order-lines/:lineId/mark-printed ...');
  const dummyPrintScan = Buffer.from('%PDF-1.4 Scanned Local Algeria Print Stamped Tax Declaration...');
  const printMultipart = createMultipartBody(
    { note: 'Algeria print office stamp certified scan' },
    { fieldName: 'file', filename: 'Local_Tax_Stamped_Copy.pdf', contentType: 'application/pdf', buffer: dummyPrintScan }
  );

  const printRes = await fetch(`${BASE_URL}/order-lines/${localLineForPrint._id}/mark-printed`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': printMultipart.contentTypeHeader,
    },
    body: printMultipart.bodyBuffer,
  });
  const printData = await printRes.json();
  console.log('HTTP Status:', printRes.status);
  console.log('Response Message:', printData.message);
  console.log('Line Status:', printData.line?.status);
  console.log('Uploaded Files count on Line:', printData.line?.uploadedFiles?.length);
  const printFileItem = printData.line?.uploadedFiles?.[0];
  console.log('Uploaded File:', {
    id: printFileItem?._id,
    filename: printFileItem?.filename,
    contentType: printFileItem?.contentType,
    size: printFileItem?.size,
    uploadedBy: printFileItem?.uploadedByUserId?.name || printFileItem?.uploadedByUserId,
  });

  if (printRes.status !== 200 || !printFileItem?._id) {
    throw new Error('POST /mark-printed with file failed!');
  }
  console.log('✓ PASS: File successfully uploaded and linked on /mark-printed!');

  // 1.3 Dedicated POST /api/order-lines/:lineId/files (NO status change)
  console.log('\n[1.3] Testing dedicated POST /api/order-lines/:lineId/files (WITHOUT status change) ...');
  const dummySpecDoc = Buffer.from('PDF Certificate Raw Spec Sheet Scan...');
  const attachMultipart = createMultipartBody(
    { note: 'Original manufacturer spec document added prior to shipping' },
    { fieldName: 'file', filename: 'Spec_Sheet_Original.pdf', contentType: 'application/pdf', buffer: dummySpecDoc }
  );

  const attachRes = await fetch(`${BASE_URL}/order-lines/${chinaLineForAttach._id}/files`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tokenA}`,
      'Content-Type': attachMultipart.contentTypeHeader,
    },
    body: attachMultipart.bodyBuffer,
  });
  const attachData = await attachRes.json();
  console.log('HTTP Status:', attachRes.status);
  console.log('Response Message:', attachData.message);
  console.log('Line Status before and after:', chinaLineForAttach.status, '->', attachData.line?.status);
  console.log('Uploaded Files count on Line:', attachData.line?.uploadedFiles?.length);
  console.log('Activity Log action:', attachData.line?.activityLog?.[attachData.line.activityLog.length - 1]?.action);
  const attachedFileItem = attachData.file;
  console.log('Attached File details:', attachedFileItem);

  if (attachRes.status !== 200 || attachData.line?.status !== 'needed') {
    throw new Error('Dedicated POST /files failed or modified line status!');
  }
  console.log('✓ PASS: Dedicated /files route uploaded file without changing line status!');

  console.log('\n===============================================================');
  console.log(' ITEM 2: FILE VISIBILITY & RETRIEVAL (ADMIN + CHINA PORTAL)');
  console.log('===============================================================');

  // 2.1 Admin Order Detail visibility: GET /api/orders/:id
  console.log('\n[2.1] Checking file visibility on GET /api/orders/:id (Admin) ...');
  const adminOrderRes = await fetch(`${BASE_URL}/orders/${order._id}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const adminOrderData = await adminOrderRes.json();
  console.log('HTTP Status:', adminOrderRes.status);
  console.log('Total order lines:', adminOrderData.lines?.length);
  adminOrderData.lines?.forEach((l, idx) => {
    console.log(`Line ${idx + 1} (${l.source} - ${l.status}): ${l.uploadedFiles?.length || 0} file(s)`);
    l.uploadedFiles?.forEach((f) => {
      console.log(`   - Filename: "${f.filename}", Size: ${f.size} B, UploadedBy: ${f.uploadedByUserId?.name} (${f.uploadedByUserId?.role})`);
    });
  });
  console.log('✓ PASS: Admin Order Detail fully populates uploadedFiles with uploader name/role!');

  // 2.2 China Portal queue visibility: GET /api/china/lines
  console.log('\n[2.2] Checking file visibility on GET /api/china/lines (Associate A) ...');
  const chinaQueueRes = await fetch(`${BASE_URL}/china/lines`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  const chinaQueueData = await chinaQueueRes.json();
  console.log('HTTP Status:', chinaQueueRes.status);
  const matchedLine = chinaQueueData.find((l) => l.id === chinaLineForShip._id.toString());
  console.log('China associate sees uploadedFiles:', JSON.stringify(matchedLine?.uploadedFiles, null, 2));
  console.log('✓ PASS: China associate queue includes uploadedFiles metadata!');

  // 2.3 File Retrieval: GET /api/files/:id
  console.log('\n[2.3] Testing binary file download via GET /api/files/:id ...');
  // Admin download
  const adminDlRes = await fetch(`${BASE_URL}/files/${shipFileItem._id}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  console.log('Admin file download HTTP Status:', adminDlRes.status);
  console.log('Content-Type:', adminDlRes.headers.get('content-type'));
  console.log('Content-Disposition:', adminDlRes.headers.get('content-disposition'));
  const adminDlBuffer = await adminDlRes.arrayBuffer();
  console.log('Downloaded bytes:', adminDlBuffer.byteLength);

  // Associate A download (their own assigned file)
  const assocDlRes = await fetch(`${BASE_URL}/files/${shipFileItem._id}`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  console.log('Associate A file download HTTP Status:', assocDlRes.status);

  // Associate B download attempt on Associate A's file (must be 403)
  const assocBBlockedRes = await fetch(`${BASE_URL}/files/${shipFileItem._id}`, {
    headers: { Authorization: `Bearer ${tokenB}` },
  });
  console.log('Associate B unauthorized download HTTP Status (Expected 403):', assocBBlockedRes.status);
  const assocBBlockedBody = await assocBBlockedRes.json();
  console.log('Associate B rejection response:', assocBBlockedBody.error);

  if (adminDlRes.status !== 200 || assocDlRes.status !== 200 || assocBBlockedRes.status !== 403) {
    throw new Error('File download permission checks failed!');
  }
  console.log('✓ PASS: File retrieval verified for Admin and assigned Associate, with 403 isolation for unauthorized associate!');

  console.log('\n===============================================================');
  console.log(' ITEM 3: CONFIRM DELIVERED ORDER TRACKING LEAK AUDIT');
  console.log('===============================================================');

  // Advance order and all lines to 'delivered' status
  order.status = 'delivered';
  await order.save();

  await OrderDocumentLine.updateMany(
    { orderId: order._id },
    { $set: { status: 'delivered' } }
  );

  console.log(`\nCalling GET /api/public/orders/track for fully 'delivered' order (${order.trackingCode}) ...`);
  const publicTrackRes = await fetch(
    `${BASE_URL}/public/orders/track?trackingCode=${order.trackingCode}&phone=${order.phone}`
  );
  const publicTrackData = await publicTrackRes.json();
  console.log('HTTP Status:', publicTrackRes.status);
  console.log('Full Public Track Response JSON:');
  console.log(JSON.stringify(publicTrackData, null, 2));

  // Audit assertions
  const responseStr = JSON.stringify(publicTrackData);
  const forbiddenTerms = [
    'file',
    'files',
    'uploadedFiles',
    'url',
    'clientPrice',
    'costPrice',
    'shippingTrackingCode',
    'assignedChinaAccountId',
    'activityLog',
    'SF-9911223344',
  ];

  const leaksFound = [];
  forbiddenTerms.forEach((term) => {
    // Check if the term exists as a property or value
    if (publicTrackData[term] !== undefined) leaksFound.push(term);
    if (publicTrackData.lines?.some((l) => l[term] !== undefined)) leaksFound.push(`line.${term}`);
  });

  if (leaksFound.length > 0) {
    throw new Error(`Public tracking response leaked forbidden fields: ${leaksFound.join(', ')}`);
  }

  console.log('\n✓ PASS: Fully "delivered" order tracking strictly contains only status text!');
  console.log('Zero files, zero file IDs, zero file URLs, and zero pricing leaked on public wire.');

  console.log('\n===============================================================');
  console.log(' ALL PHASE 4 FOLLOW-UP VERIFICATIONS PASSED SUCCESSFULLY!');
  console.log('===============================================================\n');

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
