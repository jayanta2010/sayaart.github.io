const crypto = require('node:crypto');
const path = require('node:path');
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const admin = require('firebase-admin');
const { onRequest } = require('firebase-functions/v2/https');

if (!admin.apps.length) admin.initializeApp({ projectId: 'sayaart', storageBucket: 'sayaart.firebasestorage.app' });
const db = admin.firestore();
const bucket = admin.storage().bucket();
const app = express();

const DEFAULT_ORIGINS = ['https://jayanta2010.github.io', 'https://sayaart.github.io'];
const allowedOrigins = new Set((process.env.ALLOWED_ORIGINS || DEFAULT_ORIGINS.join(',')).split(',').map(x => x.trim()).filter(Boolean));
const whatsappNumber = String(process.env.WHATSAPP_CONTACT_NUMBER || '').replace(/\D/g, '');
const MAX_FILE_BYTES = 30 * 1024 * 1024;
const previews = db.collection('privateDesignPreviews');

app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) return callback(null, true);
    return callback(new Error('Origin not allowed'));
  },
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 600
}));
app.use((req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Referrer-Policy', 'no-referrer');
  res.set('Cache-Control', 'no-store, private, max-age=0');
  res.set('Pragma', 'no-cache');
  next();
});
app.use(express.json({ limit: '32kb', strict: true }));
const publicLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 80, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: 'Too many requests. Please wait and try again.' } });
const adminLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 35, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: 'Too many admin requests. Please wait and try again.' } });
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_FILE_BYTES, files: 1, fields: 8, fieldSize: 5000 } });

function safeText(value, max) {
  return String(value == null ? '' : value).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, max);
}
function tokenHash(token) {
  return crypto.createHash('sha256').update(String(token), 'utf8').digest('hex');
}
function encryptionKey() {
  const key = Buffer.from(String(process.env.PREVIEW_TOKEN_ENCRYPTION_KEY || ''), 'base64');
  if (key.length !== 32) throw new Error('PREVIEW_TOKEN_ENCRYPTION_KEY must be a base64-encoded 32-byte key.');
  return key;
}
function encryptToken(token) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map(part => part.toString('base64url')).join('.');
}
function decryptToken(value) {
  const parts = String(value || '').split('.');
  if (parts.length !== 3) return '';
  const iv = Buffer.from(parts[0], 'base64url');
  const tag = Buffer.from(parts[1], 'base64url');
  const encrypted = Buffer.from(parts[2], 'base64url');
  const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}
function validTokenShape(token) {
  return typeof token === 'string' && /^[A-Za-z0-9_-]{40,100}$/.test(token);
}
function parseExpiry(value) {
  const ms = Date.parse(String(value || ''));
  const now = Date.now();
  if (!Number.isFinite(ms) || ms < now + 10 * 60 * 1000 || ms > now + 365 * 24 * 60 * 60 * 1000) return null;
  return admin.firestore.Timestamp.fromMillis(ms);
}
function fileType(file) {
  const b = file.buffer;
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { ext: 'jpg', mime: 'image/jpeg' };
  if (b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return { ext: 'png', mime: 'image/png' };
  if (b.length >= 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') return { ext: 'webp', mime: 'image/webp' };
  return null;
}
function sendUnavailable(res, code) {
  const messages = {
    expired: 'This private preview link has expired. Please contact Saya Art & Advertising for a new link.',
    revoked: 'This private preview link has been revoked. Please contact Saya Art & Advertising.',
    invalid: 'This private preview link is invalid or unavailable.'
  };
  return res.status(code === 'invalid' ? 404 : 410).json({ code, error: messages[code] });
}
async function findActivePreview(token) {
  if (!validTokenShape(token)) return { state: 'invalid' };
  const hash = tokenHash(token);
  const snap = await previews.where('tokenHash', '==', hash).limit(1).get();
  if (snap.empty) return { state: 'invalid' };
  const doc = snap.docs[0];
  const data = doc.data();
  if (data.status === 'revoked') return { state: 'revoked', id: doc.id, data };
  if (data.status !== 'active') return { state: 'invalid' };
  if (!data.expiresAt || data.expiresAt.toMillis() <= Date.now()) return { state: 'expired', id: doc.id, data };
  return { state: 'active', id: doc.id, data };
}
async function requireAdmin(req, res, next) {
  try {
    const header = String(req.headers.authorization || '');
    const match = header.match(/^Bearer\s+(.+)$/i);
    if (!match) return res.status(401).json({ error: 'Sign in with an authorized admin account.' });
    const decoded = await admin.auth().verifyIdToken(match[1], true);
    if (decoded.admin !== true) return res.status(403).json({ error: 'This account is not authorized to manage private previews.' });
    req.adminUser = decoded;
    next();
  } catch (_) {
    return res.status(401).json({ error: 'Admin authentication is required. Refresh your sign-in and try again.' });
  }
}
function publicRecord(data) {
  return {
    expiresAt: data.expiresAt ? data.expiresAt.toMillis() : null,
    whatsappNumber
  };
}
function adminRecord(doc) {
  const d = doc.data();
  const activeAndUnexpired = d.status === 'active' && d.expiresAt && d.expiresAt.toMillis() > Date.now();
  let previewToken = '';
  if (activeAndUnexpired && d.tokenCiphertext) {
    try { previewToken = decryptToken(d.tokenCiphertext); } catch (_) { previewToken = ''; }
  }
  return {
    id: doc.id,
    previewToken,
    originalName: d.originalName || 'design',
    size: d.size || 0,
    expiresAt: d.expiresAt ? d.expiresAt.toMillis() : null,
    createdAt: d.createdAt ? d.createdAt.toMillis() : null,
    status: d.status || 'active'
  };
}

app.get('/health', (_req, res) => res.json({ ok: true, service: 'sayaart-private-design-previews' }));

// Public preview metadata. Token is sent in a POST body, not in the URL or referrer.
app.post('/public/preview', publicLimiter, async (req, res) => {
  try {
    const found = await findActivePreview(req.body && req.body.token);
    if (found.state !== 'active') return sendUnavailable(res, found.state);
    return res.json(publicRecord(found.data));
  } catch (_) {
    return res.status(503).json({ error: 'Preview service is temporarily unavailable. Please try again later.' });
  }
});

// Revalidate the token for every image request and stream from private Storage.
app.post('/public/image', publicLimiter, async (req, res) => {
  try {
    const found = await findActivePreview(req.body && req.body.token);
    if (found.state !== 'active') return sendUnavailable(res, found.state);
    const object = bucket.file(found.data.storagePath);
    res.set('Content-Type', found.data.contentType);
    res.set('Content-Length', String(found.data.size));
    res.set('Content-Disposition', 'inline; filename="design-preview"');
    res.set('Cross-Origin-Resource-Policy', 'cross-origin');
    const stream = object.createReadStream();
    stream.on('error', () => {
      if (!res.headersSent) res.status(404).json({ error: 'Preview image is unavailable.' });
      else res.destroy();
    });
    stream.pipe(res);
  } catch (_) {
    if (!res.headersSent) res.status(503).json({ error: 'Preview service is temporarily unavailable.' });
    else res.destroy();
  }
});

app.get('/admin/previews', adminLimiter, requireAdmin, async (_req, res) => {
  try {
    const snap = await previews.orderBy('createdAt', 'desc').limit(200).get();
    return res.json({ previews: snap.docs.map(adminRecord) });
  } catch (_) {
    return res.status(503).json({ error: 'Could not load private previews.' });
  }
});

app.post('/admin/previews', adminLimiter, requireAdmin, upload.single('design'), async (req, res) => {
  let storagePath = '';
  try {
    if (!req.file) return res.status(400).json({ error: 'Choose a design image to upload.' });
    const detected = fileType(req.file);
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
    const originalName = path.basename(String(req.file.originalname || 'design')).replace(/[\u0000-\u001F\u007F]/g, '').slice(0, 180);
    if (!allowedExtensions.includes(path.extname(originalName).toLowerCase()) || !detected) {
      return res.status(415).json({ error: 'Upload a valid JPG, JPEG, PNG, or WebP image.' });
    }
    const declared = String(req.file.mimetype || '').toLowerCase();
    if (declared && declared !== detected.mime && !(declared === 'image/jpg' && detected.mime === 'image/jpeg')) {
      return res.status(415).json({ error: 'The file type does not match its image content.' });
    }
    const expiry = parseExpiry(req.body.expiresAt);
    if (!expiry) return res.status(400).json({ error: 'Choose an expiry date at least 10 minutes from now and within 365 days.' });
    const token = crypto.randomBytes(32).toString('base64url');
    const id = previews.doc().id;
    storagePath = 'private-design-previews/' + id + '/' + crypto.randomUUID() + '.' + detected.ext;
    const object = bucket.file(storagePath);
    await object.save(req.file.buffer, {
      resumable: false,
      metadata: {
        contentType: detected.mime,
        cacheControl: 'private, no-store, max-age=0',
        metadata: { previewId: id, uploadedBy: req.adminUser.uid }
      },
      validation: 'crc32c'
    });
    const record = {
      tokenHash: tokenHash(token),
      tokenCiphertext: encryptToken(token),
      status: 'active',
      storagePath,
      contentType: detected.mime,
      originalName,
      size: req.file.size,
      expiresAt: expiry,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: req.adminUser.uid
    };
    try {
      await previews.doc(id).create(record);
    } catch (writeError) {
      await object.delete({ ignoreNotFound: true }).catch(() => {});
      storagePath = '';
      throw writeError;
    }
    return res.status(201).json({ id, token, expiresAt: expiry.toMillis(), previewPath: 'private-preview.html#' + token });
  } catch (error) {
    if (error && error.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'The maximum image size is 30 MB.' });
    if (storagePath) await bucket.file(storagePath).delete({ ignoreNotFound: true }).catch(() => {});
    return res.status(500).json({ error: 'The design could not be saved. Check Storage setup and try again.' });
  }
});

app.post('/admin/previews/:id/revoke', adminLimiter, requireAdmin, async (req, res) => {
  try {
    const ref = previews.doc(String(req.params.id || '').slice(0, 150));
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: 'Preview record not found.' });
    await ref.update({ status: 'revoked', revokedAt: admin.firestore.FieldValue.serverTimestamp(), revokedBy: req.adminUser.uid });
    return res.json({ ok: true });
  } catch (_) {
    return res.status(500).json({ error: 'Could not revoke this preview.' });
  }
});

app.delete('/admin/previews/:id', adminLimiter, requireAdmin, async (req, res) => {
  try {
    const ref = previews.doc(String(req.params.id || '').slice(0, 150));
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: 'Preview record not found.' });
    const data = snap.data();
    if (data.storagePath) await bucket.file(data.storagePath).delete({ ignoreNotFound: true });
    await ref.delete();
    return res.json({ ok: true });
  } catch (_) {
    return res.status(500).json({ error: 'Could not delete this preview.' });
  }
});

app.use((err, _req, res, _next) => {
  if (err && err.message === 'Origin not allowed') return res.status(403).json({ error: 'Origin not allowed.' });
  if (err && err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'The maximum image size is 30 MB.' });
  return res.status(400).json({ error: 'Invalid request.' });
});

exports.privateDesignApi = onRequest({ region: 'us-central1', memory: '1GiB', timeoutSeconds: 120, maxInstances: 10, secrets: ['PREVIEW_TOKEN_ENCRYPTION_KEY'] }, app);
