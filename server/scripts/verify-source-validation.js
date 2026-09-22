const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const Order = require('../src/models/Order');
const OrderDocumentLine = require('../src/models/OrderDocumentLine');
const DocumentType = require('../src/models/DocumentType');
const User = require('../src/models/User');

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/autopartdz';
const JWT_SECRET = process.env.JWT_SECRET;
const API_BASE = 'http://localhost:5000/api';

function createToken(user) {
  return jwt.sign(
    { userId: user._id.toString(), role: user.role },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB');

  // Find admin & china associate
  const admin = await User.findOne({ role: 'admin' });
  let associate = await User.findOne({ role: 'china_associate', active: true });
  if (!associate) {
    associate = await User.create({
      name: 'China Associate Test',
      email: 'china.src.test@autopartdz.test',
      password: 'password123',
      role: 'china_associate',
      active: true,
    });
  }

  const adminToken = createToken(admin);

  // Find or create document types
  let chinaDoc = await DocumentType.findOne({ defaultSource: 'china', active: true });
  if (!chinaDoc) {
    chinaDoc = await DocumentType.create({
      code: 'DOC-SRC-CH',
      fullName: 'China Source Doc Test',
      shortName: 'China Doc',
      category: 'legal',
      defaultSource: 'china',
      active: true,
      pricing: { originalOnly: { clientPrice: 10000, costPrice: 5000 } },
    });
  }

  let localDoc = await DocumentType.findOne({ defaultSource: 'local', active: true });
  if (!localDoc) {
    localDoc = await DocumentType.create({
      code: 'DOC-SRC-LOC',
      fullName: 'Local Source Doc Test',
      shortName: 'Local Doc',
      category: 'legal',
      defaultSource: 'local',
      active: true,
      pricing: { originalOnly: { clientPrice: 5000, costPrice: 2000 } },
    });
  }

  // Create test order
  const order = await Order.create({
    trackingCode: `SRC-VAL-${Date.now()}`,
    orderType: 'new',
    status: 'pending',
    firstName: 'Karim',
    lastName: 'Mansouri',
    phone: '0555001122',
    wilaya: '16 - Alger',
    address: '10 Rue Didouche Mourad, Alger',
    vin: 'SRCVAL12345678901',
    carModel: 'Chery Tiggo 8 Pro',
  });

  // Create a local line and a china line
  const localLine = await OrderDocumentLine.create({
    orderId: order._id,
    documentTypeId: localDoc._id,
    translationMode: 'original_only',
    clientPrice: 5000,
    costPrice: 2000,
    source: 'local',
    status: 'needed',
  });

  const chinaLine = await OrderDocumentLine.create({
    orderId: order._id,
    documentTypeId: chinaDoc._id,
    translationMode: 'original_only',
    clientPrice: 10000,
    costPrice: 5000,
    source: 'china',
    status: 'needed',
  });

  console.log('\n======================================================');
  console.log(' ROUTE 1: PATCH /api/orders/:orderId/lines/:lineId/assign');
  console.log('======================================================');

  console.log('\n[1A: Rejection Trace] Attempting to assign China associate to a LOCAL line:');
  const res1A = await fetch(`${API_BASE}/orders/${order._id}/lines/${localLine._id}/assign`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ chinaAccountId: associate._id }),
  });
  const data1A = await res1A.json();
  console.log(`HTTP Status: ${res1A.status}`);
  console.log('Response:', JSON.stringify(data1A, null, 2));

  console.log('\n[1B: Success Trace] Assigning China associate to a CHINA line:');
  const res1B = await fetch(`${API_BASE}/orders/${order._id}/lines/${chinaLine._id}/assign`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ chinaAccountId: associate._id }),
  });
  const data1B = await res1B.json();
  console.log(`HTTP Status: ${res1B.status}`);
  console.log('Response:', JSON.stringify(data1B, null, 2));

  console.log('\n======================================================');
  console.log(' ROUTE 2: POST /api/order-lines/:lineId/ship');
  console.log('======================================================');

  console.log('\n[2A: Rejection Trace] Attempting to /ship a LOCAL line:');
  const res2A = await fetch(`${API_BASE}/order-lines/${localLine._id}/ship`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ shippingTrackingCode: 'INVALID-TRACK-001' }),
  });
  const data2A = await res2A.json();
  console.log(`HTTP Status: ${res2A.status}`);
  console.log('Response:', JSON.stringify(data2A, null, 2));

  console.log('\n[2B: Success Trace] Calling /ship on a CHINA line:');
  const res2B = await fetch(`${API_BASE}/order-lines/${chinaLine._id}/ship`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      shippingTrackingCode: 'SF-VALID-CHINA-888',
      note: 'Legitimate China shipment',
    }),
  });
  const data2B = await res2B.json();
  console.log(`HTTP Status: ${res2B.status}`);
  console.log('Response:', JSON.stringify(data2B, null, 2));

  console.log('\n======================================================');
  console.log(' ROUTE 3: POST /api/order-lines/:lineId/mark-printed');
  console.log('======================================================');

  // Create another china line with status 'needed' to test mark-printed rejection
  const chinaLineForPrint = await OrderDocumentLine.create({
    orderId: order._id,
    documentTypeId: chinaDoc._id,
    translationMode: 'original_only',
    clientPrice: 10000,
    costPrice: 5000,
    source: 'china',
    status: 'needed',
    assignedChinaAccountId: associate._id,
  });

  console.log('\n[3A: Rejection Trace] Attempting to /mark-printed on a CHINA line:');
  const res3A = await fetch(`${API_BASE}/order-lines/${chinaLineForPrint._id}/mark-printed`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ note: 'Attempting to print china doc locally' }),
  });
  const data3A = await res3A.json();
  console.log(`HTTP Status: ${res3A.status}`);
  console.log('Response:', JSON.stringify(data3A, null, 2));

  console.log('\n[3B: Success Trace] Calling /mark-printed on a LOCAL line:');
  const res3B = await fetch(`${API_BASE}/order-lines/${localLine._id}/mark-printed`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ note: 'Printed locally at Algerian print office' }),
  });
  const data3B = await res3B.json();
  console.log(`HTTP Status: ${res3B.status}`);
  console.log('Response:', JSON.stringify(data3B, null, 2));

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('Test run failed:', err);
  process.exit(1);
});
