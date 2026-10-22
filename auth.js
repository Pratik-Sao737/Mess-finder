// auth.js - Cryptographic authentication, password hashing, and token helpers
const crypto = require('node:crypto');

const JWT_SECRET = process.env.JWT_SECRET || 'messmate-super-secret-development-key-2026';

function hashPassword(password) {
  if (!password || typeof password !== 'string') {
    throw new Error('Password must be a non-empty string');
  }
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
  if (!password || !storedHash || !storedHash.includes(':')) {
    return false;
  }
  const [salt, key] = storedHash.split(':');
  const keyBuffer = Buffer.from(key, 'hex');
  const derived = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512');
  if (keyBuffer.length !== derived.length) return false;
  return crypto.timingSafeEqual(keyBuffer, derived);
}

function createToken(payload, expiresInMs = 7 * 24 * 60 * 60 * 1000) {
  const exp = Date.now() + expiresInMs;
  const data = JSON.stringify({ ...payload, exp });
  const dataBase64 = Buffer.from(data).toString('base64url');
  const signature = crypto.createHmac('sha256', JWT_SECRET).update(dataBase64).digest('base64url');
  return `${dataBase64}.${signature}`;
}

function verifyToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) {
    return null;
  }
  const [dataBase64, signature] = token.split('.');
  const expectedSignature = crypto.createHmac('sha256', JWT_SECRET).update(dataBase64).digest('base64url');
  
  const sigBuffer = Buffer.from(signature);
  const expBuffer = Buffer.from(expectedSignature);
  if (sigBuffer.length !== expBuffer.length || !crypto.timingSafeEqual(sigBuffer, expBuffer)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(dataBase64, 'base64url').toString('utf8'));
    if (payload.exp && Date.now() > payload.exp) {
      return null; // Expired
    }
    return payload;
  } catch (err) {
    return null;
  }
}

module.exports = {
  hashPassword,
  verifyPassword,
  createToken,
  verifyToken
};
