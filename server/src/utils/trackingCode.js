const crypto = require('crypto');
const Order = require('../models/Order');

// 31 characters: A-Z and 2-9, excluding ambiguous chars: 0, O, 1, I, L
const CHARSET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

/**
 * Generates an 8-character random tracking code using crypto.randomInt.
 * @returns {string} 8-character alphanumeric string, e.g. "K7F4Q9XM"
 */
function generateTrackingCode() {
  let code = '';
  for (let i = 0; i < 8; i++) {
    const randomIndex = crypto.randomInt(0, CHARSET.length);
    code += CHARSET[randomIndex];
  }
  return code;
}

/**
 * Generates a unique tracking code against the database with retry on collision.
 * @param {number} maxRetries Maximum number of attempts before throwing
 * @returns {Promise<string>}
 */
async function generateUniqueTrackingCode(maxRetries = 10) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const code = generateTrackingCode();
    const existing = await Order.findOne({ trackingCode: code }).select('_id').lean();
    if (!existing) {
      return code;
    }
  }
  throw new Error('Failed to generate a unique tracking code after multiple attempts.');
}

module.exports = {
  CHARSET,
  generateTrackingCode,
  generateUniqueTrackingCode,
};
