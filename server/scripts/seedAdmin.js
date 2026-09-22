/**
 * seedAdmin.js — Bootstrap script for creating the very first admin account.
 *
 * This is intentionally a SCRIPT, not an HTTP route. There is no public
 * registration route anywhere in this system.
 *
 * Usage:
 *   npm run seed:admin
 *
 * Reads credentials from environment variables (or .env):
 *   SEED_ADMIN_EMAIL
 *   SEED_ADMIN_PASSWORD
 *   SEED_ADMIN_NAME
 *
 * The script is IDEMPOTENT: if an account with SEED_ADMIN_EMAIL already
 * exists, it reports that and exits without making any changes.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const readline = require('readline');

const User = require('../src/models/User');

const MONGO_URI = process.env.MONGO_URI;
const EMAIL = process.env.SEED_ADMIN_EMAIL;
const PASSWORD = process.env.SEED_ADMIN_PASSWORD;
const NAME = process.env.SEED_ADMIN_NAME;

if (!MONGO_URI) {
  console.error('ERROR: MONGO_URI is not set in your .env file.');
  process.exit(1);
}

async function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function main() {
  console.log('\n── autopartdz Admin Seed Script ──\n');

  // Gather credentials: prefer env vars, fall back to interactive prompt
  const name = NAME || (await prompt('Admin name: '));
  const email = EMAIL || (await prompt('Admin email: '));
  const password = PASSWORD || (await prompt('Admin password (min 8 chars): '));

  if (!name || !email || !password) {
    console.error('ERROR: name, email, and password are all required.');
    process.exit(1);
  }

  if (password.length < 8) {
    console.error('ERROR: Password must be at least 8 characters.');
    process.exit(1);
  }

  await mongoose.connect(MONGO_URI);
  console.log(`[MongoDB] Connected to ${MONGO_URI}`);

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    console.log(`\n✓ Admin account already exists for "${email}". No changes made.`);
    await mongoose.disconnect();
    process.exit(0);
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const admin = await User.create({
    name,
    email: email.toLowerCase(),
    passwordHash,
    role: 'admin',
    active: true,
    createdBy: null, // Bootstrap account — no creator
  });

  console.log(`\n✓ Admin account created successfully.`);
  console.log(`  ID:    ${admin._id}`);
  console.log(`  Name:  ${admin.name}`);
  console.log(`  Email: ${admin.email}`);
  console.log(`  Role:  ${admin.role}`);
  console.log(`\nYou can now log in at POST /api/auth/login with these credentials.\n`);

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error('Seed script failed:', err.message);
  process.exit(1);
});
