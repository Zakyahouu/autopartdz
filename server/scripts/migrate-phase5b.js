/**
 * migrate-phase5b.js
 * Idempotent migration from Phase 4/5 data model to Phase 5b.
 *
 * Status mappings:
 *   needed            → needed            (no change)
 *   printed           → attached          (file carried over)
 *   shipped           → attached          (file + trackingCode carried over)
 *   arrived_at_office → ready
 *   needs_correction  → needed  + copy rejection note to lastRejectionNote/rejectedAt,
 *                                  clear shippingTrackingCode
 *   packaged / sent_to_client / delivered → unchanged (downstream)
 *   pending_admin_review / sent_to_china  → attached (treat as "sent but unlocked")
 *
 * Field renames:
 *   assignedChinaAccountId → assignedAssociateId
 *   shippingTrackingCode   → trackingCode
 *
 * Does NOT touch Order.status — order statuses compute correctly from line statuses.
 * Run: node server/scripts/migrate-phase5b.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const mongoose = require('mongoose');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/autopartdz');
  console.log('[migrate-phase5b] Connected to MongoDB');

  const db = mongoose.connection.db;
  const col = db.collection('orderdocumentlines');

  // ── 1. Before counts ──────────────────────────────────────────────────────
  const beforeAgg = await col.aggregate([
    { $group: { _id: '$status', count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]).toArray();

  console.log('\n[BEFORE] Status distribution:');
  beforeAgg.forEach(({ _id, count }) => console.log(`  ${String(_id).padEnd(25)} ${count}`));
  const beforeTotal = beforeAgg.reduce((s, r) => s + r.count, 0);
  console.log(`  ${'TOTAL'.padEnd(25)} ${beforeTotal}`);

  // ── 2. Status migrations ──────────────────────────────────────────────────

  // needed → needed (no-op, but rename fields if present)
  // We'll cover the field rename in a bulk pass below.

  // printed → attached
  const r1 = await col.updateMany(
    { status: 'printed' },
    { $set: { status: 'attached' } }
  );
  console.log(`\n[MIGRATE] printed → attached: ${r1.modifiedCount} doc(s)`);

  // shipped → attached, rename shippingTrackingCode → trackingCode
  const shippedDocs = await col.find({ status: 'shipped' }).toArray();
  let shippedMigrated = 0;
  for (const doc of shippedDocs) {
    const update = { $set: { status: 'attached' }, $unset: {} };
    if (doc.shippingTrackingCode != null) {
      update.$set.trackingCode = doc.shippingTrackingCode;
      update.$unset.shippingTrackingCode = '';
    }
    await col.updateOne({ _id: doc._id }, update);
    shippedMigrated++;
  }
  console.log(`[MIGRATE] shipped → attached (with trackingCode): ${shippedMigrated} doc(s)`);

  // arrived_at_office → ready
  const r3 = await col.updateMany(
    { status: 'arrived_at_office' },
    { $set: { status: 'ready' } }
  );
  console.log(`[MIGRATE] arrived_at_office → ready: ${r3.modifiedCount} doc(s)`);

  // needs_correction → needed + extract lastRejectionNote from activityLog
  const correctionDocs = await col.find({ status: 'needs_correction' }).toArray();
  let correctionMigrated = 0;
  for (const doc of correctionDocs) {
    // Find the most recent 'rejected' activityLog entry
    const logs = (doc.activityLog || []).slice().reverse();
    const rejEntry = logs.find((e) => e.action === 'rejected');
    const update = {
      $set: {
        status: 'needed',
        lastRejectionNote: rejEntry?.note || 'Returned for correction.',
        rejectedAt: rejEntry?.timestamp || new Date(),
        trackingCode: null,
      },
      $unset: { shippingTrackingCode: '' },
    };
    await col.updateOne({ _id: doc._id }, update);
    correctionMigrated++;
  }
  console.log(`[MIGRATE] needs_correction → needed (rejection note preserved): ${correctionMigrated} doc(s)`);

  // pending_admin_review / sent_to_china → attached
  const r5 = await col.updateMany(
    { status: { $in: ['pending_admin_review', 'sent_to_china'] } },
    { $set: { status: 'attached' } }
  );
  console.log(`[MIGRATE] pending_admin_review/sent_to_china → attached: ${r5.modifiedCount} doc(s)`);

  // packaged / sent_to_client / delivered → unchanged (downstream states, no mapping needed)
  console.log('[MIGRATE] packaged/sent_to_client/delivered → unchanged (no action)');

  // ── 3. Field renames (idempotent bulk) ────────────────────────────────────

  // Rename assignedChinaAccountId → assignedAssociateId
  const fieldRename = await col.updateMany(
    { assignedChinaAccountId: { $exists: true } },
    [
      {
        $set: {
          assignedAssociateId: '$assignedChinaAccountId',
        },
      },
      {
        $unset: 'assignedChinaAccountId',
      },
    ]
  );
  console.log(`\n[MIGRATE] assignedChinaAccountId → assignedAssociateId: ${fieldRename.modifiedCount} doc(s)`);

  // Rename shippingTrackingCode → trackingCode (for any remaining docs not yet renamed)
  const trackRename = await col.updateMany(
    { shippingTrackingCode: { $exists: true } },
    [
      { $set: { trackingCode: '$shippingTrackingCode' } },
      { $unset: 'shippingTrackingCode' },
    ]
  );
  console.log(`[MIGRATE] shippingTrackingCode → trackingCode: ${trackRename.modifiedCount} doc(s)`);

  // Remove isDelayed field (no longer meaningful)
  const delayRemove = await col.updateMany(
    { isDelayed: { $exists: true } },
    { $unset: { isDelayed: '' } }
  );
  console.log(`[MIGRATE] isDelayed field removed: ${delayRemove.modifiedCount} doc(s)`);

  // ── 4. After counts ───────────────────────────────────────────────────────
  const afterAgg = await col.aggregate([
    { $group: { _id: '$status', count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]).toArray();

  console.log('\n[AFTER] Status distribution:');
  afterAgg.forEach(({ _id, count }) => console.log(`  ${String(_id).padEnd(25)} ${count}`));
  const afterTotal = afterAgg.reduce((s, r) => s + r.count, 0);
  console.log(`  ${'TOTAL'.padEnd(25)} ${afterTotal}`);

  if (beforeTotal !== afterTotal) {
    console.warn('\n[WARNING] Total row count changed! Before:', beforeTotal, 'After:', afterTotal);
  } else {
    console.log('\n[OK] Total row count preserved:', afterTotal);
  }

  // Verify no old statuses remain
  const legacyRemaining = await col.find({
    status: { $in: ['printed', 'shipped', 'arrived_at_office', 'needs_correction',
                      'pending_admin_review', 'sent_to_china'] }
  }).count();
  if (legacyRemaining > 0) {
    console.error(`[ERROR] ${legacyRemaining} doc(s) still have legacy statuses!`);
  } else {
    console.log('[OK] No legacy statuses remain.');
  }

  await mongoose.disconnect();
  console.log('\n[migrate-phase5b] Done.');
}

run().catch((err) => {
  console.error('[migrate-phase5b] Fatal error:', err);
  process.exit(1);
});
