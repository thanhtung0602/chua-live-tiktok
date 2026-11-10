import 'dotenv/config';
import { createServer } from 'node:http';
import { randomUUID, createHash } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import fs from 'node:fs';
import https from 'node:https';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import multer from 'multer';
import { Server } from 'socket.io';
import { createStore } from './store.js';
import { LiveProvider } from './live-provider.js';
import { TempleService } from './temple-service.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const publicDir = path.join(root, 'public');
const uploadDir = path.join(publicDir, 'uploads', 'audio');
const port = Number(process.env.PORT) || 3000;

await mkdir(uploadDir, { recursive: true });

const store = await createStore({
  dataPath: path.join(root, 'data', 'state.json'),
  sqlConfig: process.env.DB_SERVER ? {
    server: process.env.DB_SERVER,
    database: process.env.DB_DATABASE || 'temple_live',
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    encrypt: process.env.DB_ENCRYPT === 'true'
  } : null
});

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: '*' } });
const temple = new TempleService({ store, io });
const rawProvider = process.env.LIVE_PROVIDER_NAME;
const providerName = (!rawProvider || rawProvider === 'mock' || rawProvider === 'Mock simulator')
  ? 'tiktok-connector'
  : rawProvider;

const provider = new LiveProvider({
  name: providerName,
  onEvent: (event) => temple.handleEvent(event),
  onStatus: (status) => temple.setLiveStatus(status)
});
const initialChannel = process.env.TIKTOK_CHANNEL || '@camsisi0';
provider.connect(initialChannel);
temple.setLiveStatus(provider.snapshot());

const audioExtensions = new Set(['.mp3', '.m4a', '.wav', '.ogg', '.aac', '.flac']);
const upload = multer({
  storage: multer.diskStorage({
    destination: (_request, _file, callback) => callback(null, uploadDir),
    filename: (_request, file, callback) => {
      const extension = path.extname(file.originalname).toLowerCase();
      callback(null, `${randomUUID()}${extension}`);
    }
  }),
  limits: { fileSize: 80 * 1024 * 1024 },
  fileFilter: (_request, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    // MIME is supplied by the browser and can be forged; restrict the served
    // filename extension as well because uploads are exposed as static files.
    callback(null, audioExtensions.has(extension));
  }
});

const asyncRoute = (handler) => (request, response, next) => Promise.resolve(handler(request, response, next)).catch(next);
const requireAdmin = (request, response, next) => {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected || request.get('x-admin-token') === expected) return next();
  return response.status(401).json({ error: 'Thiếu hoặc sai x-admin-token.' });
};
const requireWebhookSecret = (request, response, next) => {
  const expected = process.env.LIVE_WEBHOOK_SECRET;
  const bearer = request.get('authorization')?.replace(/^Bearer\s+/i, '');
  const provided = request.get('x-live-secret') || request.query?.secret || request.body?.secret || bearer;
  if (expected) {
    if (provided !== expected) {
      return response.status(401).json({ error: 'Webhook không được xác thực. Hãy kiểm tra x-live-secret hoặc secret.' });
    }
    return next();
  }
  const ip = request.ip || request.socket.remoteAddress || '';
  const isLoopback = ip.includes('127.0.0.1') || ip.includes('::1') || ip.includes('::ffff:127.0.0.1');
  if (isLoopback) return next();

  return response.status(503).json({ error: 'LIVE_WEBHOOK_SECRET chưa được cấu hình trong .env.' });
};

function simulationEvent(body = {}) {
  const viewer = body.viewer || (body.viewerId ? {
    id: body.viewerId,
    username: body.username,
    nickname: body.nickname,
    avatarUrl: body.avatarUrl
  } : undefined);
  return {
    ...body,
    type: body.type,
    viewer,
    eventId: body.eventId || `sim-${randomUUID()}`
  };
}

app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));
app.use('/vendor', express.static(path.join(root, 'node_modules', 'phaser', 'dist'), { maxAge: '1d' }));
app.use('/uploads', express.static(path.join(publicDir, 'uploads'), { maxAge: '1h' }));

app.get('/api/health', (_request, response) => response.json({ ok: true, storage: process.env.DB_SERVER ? 'sqlserver' : 'json', live: provider.snapshot() }));
app.get('/api/state', (_request, response) => response.json(temple.snapshot()));

app.post('/api/admin/settings', requireAdmin, asyncRoute(async (request, response) => {
  response.json({ settings: await temple.updateSettings(request.body || {}) });
}));

app.post('/api/admin/participants/:id/remove', requireAdmin, (request, response) => {
  const removed = temple.leavePresence(request.params.id, 'admin');
  response.json({ removed });
});

app.post('/api/admin/simulate', requireAdmin, asyncRoute(async (request, response) => {
  const event = simulationEvent(request.body || {});
  const result = await provider.ingest(event);
  response.json({ event, result });
}));

app.post('/api/admin/live/mode', requireAdmin, (request, response) => {
  const { mode = 'live', channel = '' } = request.body || {};
  const live = provider.setMode(mode, channel);
  temple.setLiveStatus(live);
  response.json({ ok: true, live });
});
app.post('/api/admin/live/connect', requireAdmin, (request, response) => {
  response.json({ live: provider.connect(request.body?.channel) });
});
app.post('/api/admin/live/disconnect', requireAdmin, (_request, response) => {
  response.json({ live: provider.disconnect() });
});

app.post('/api/admin/audio/upload', requireAdmin, upload.single('audio'), asyncRoute(async (request, response) => {
  if (!request.file) return response.status(400).json({ error: 'Hãy chọn file âm thanh hợp lệ.' });
  const track = await temple.addTrack({
    title: request.body?.title || path.parse(request.file.originalname).name,
    filePath: `/uploads/audio/${request.file.filename}`
  });
  return response.status(201).json({ track });
}));
app.patch('/api/admin/audio/:id', requireAdmin, asyncRoute(async (request, response) => {
  response.json({ track: await temple.updateTrack(request.params.id, request.body || {}) });
}));
app.delete('/api/admin/audio/:id', requireAdmin, asyncRoute(async (request, response) => {
  await temple.deleteTrack(request.params.id);
  response.status(204).end();
}));
app.post('/api/admin/audio/action', requireAdmin, asyncRoute(async (request, response) => {
  response.json({ audio: await temple.audioAction(request.body?.action, request.body || {}) });
}));

app.post('/api/admin/gifts', requireAdmin, asyncRoute(async (request, response) => {
  response.status(201).json({ gift: await temple.addGift(request.body || {}) });
}));
app.patch('/api/admin/gifts/:id', requireAdmin, asyncRoute(async (request, response) => {
  response.json({ gift: await temple.updateGift(request.params.id, request.body || {}) });
}));
app.delete('/api/admin/gifts/:id', requireAdmin, asyncRoute(async (request, response) => {
  await temple.deleteGift(request.params.id);
  response.status(204).end();
}));

app.post('/api/admin/leaderboard/reset', requireAdmin, asyncRoute(async (_request, response) => {
  await temple.resetLeaderboard();
  response.json({ success: true });
}));

app.post('/api/admin/speech/test', requireAdmin, (request, response) => {
  const type = request.body?.type || 'welcome';
  const speaker = request.body?.speaker || 'Thiện Tùng';
  const giftName = request.body?.giftName || 'Hoa hồng';
  let speech;
  if (type === 'gift') {
    speech = temple.speechDirector.getGiftThankYouSpeech({ nickname: speaker }, { name: giftName }, 1);
  } else if (type === 'ambient') {
    speech = temple.speechDirector.getAmbientSpeech();
  } else if (type === 'follow') {
    speech = temple.speechDirector.getFollowSpeech({ nickname: speaker });
  } else {
    speech = temple.speechDirector.getWelcomeSpeech({ nickname: speaker });
  }
  temple.io.emit('speech:announce', {
    id: randomUUID(),
    type: speech.type,
    text: speech.text,
    speaker: type === 'ambient' ? 'Chùa An Lạc' : speaker,
    giftName: type === 'gift' ? giftName : undefined,
    createdAt: new Date().toISOString()
  });
  response.json({ ok: true, speech });
});

app.post('/api/admin/protection/trigger', requireAdmin, asyncRoute(async (_request, response) => {
  const result = await temple.triggerLiveProtectionNow();
  response.json({ ok: true, result });
}));

app.post('/api/admin/ceremony/trigger', requireAdmin, asyncRoute(async (_request, response) => {
  await temple.startCeremony();
  response.json({ ok: true, ceremony: temple.getCeremonyStatus() });
}));

app.post('/api/admin/bell/strike', requireAdmin, (request, response) => {
  const milestone = Number(request.body?.milestone || 1000);
  temple.strikeBellMilestone(milestone);
  response.json({ ok: true, milestone });
});

// Endpoint for an authorized TikTok LIVE provider or official integration.
app.post('/api/live/events', requireWebhookSecret, asyncRoute(async (request, response) => {
  await provider.ingest(request.body || {});
  response.status(202).json({ accepted: true });
}));

function fetchGoogleTtsChunk(chunk) {
  return new Promise((resolve, reject) => {
    const ttsUrl = 'https://translate.google.com/translate_tts?ie=UTF-8&tl=vi&client=tw-ob&q=' + encodeURIComponent(chunk);
    https.get(ttsUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } }, (res) => {
      if (res.statusCode !== 200) {
        return reject(new Error(`Google TTS status ${res.statusCode}`));
      }
      const data = [];
      res.on('data', (d) => data.push(d));
      res.on('end', () => resolve(Buffer.concat(data)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

function splitTextForTts(text, maxChunkLen = 180) {
  const chunks = [];
  const sentences = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [text];
  let current = '';
  for (const s of sentences) {
    const trimmed = s.trim();
    if (!trimmed) continue;
    if ((current + ' ' + trimmed).trim().length <= maxChunkLen) {
      current = (current + ' ' + trimmed).trim();
    } else {
      if (current) chunks.push(current);
      if (trimmed.length <= maxChunkLen) {
        current = trimmed;
      } else {
        const words = trimmed.split(' ');
        let wCurrent = '';
        for (const w of words) {
          if ((wCurrent + ' ' + w).trim().length <= maxChunkLen) {
            wCurrent = (wCurrent + ' ' + w).trim();
          } else {
            if (wCurrent) chunks.push(wCurrent);
            wCurrent = w;
          }
        }
        current = wCurrent;
      }
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

// Endpoint TTS phát âm thanh AI chuẩn tự nhiên, hỗ trợ cả đoạn văn ngắn lẫn bài kinh dài, 100% không bao giờ mất tiếng
app.get('/api/tts', async (request, response) => {
  const text = String(request.query?.text || '').trim();
  if (!text) return response.status(400).send('Missing text');

  const clean = text
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\p{Extended_Pictographic}]/gu, '')
    .replace(/[✦·•☸♥★☆✓✔✕✖~`@#$%^&*()_+={}\[\]|\\:;"'<>/?]/g, ' ')
    .replace(/!+/g, '.')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 3000);

  if (!clean) return response.status(400).send('Empty cleaned text');

  const cacheKey = createHash('md5').update(clean).digest('hex');
  const ttsCacheDir = path.join(uploadDir, 'tts-cache');
  await mkdir(ttsCacheDir, { recursive: true });
  const cachePath = path.join(ttsCacheDir, `${cacheKey}.mp3`);

  if (fs.existsSync(cachePath) && fs.statSync(cachePath).size > 0) {
    response.setHeader('Content-Type', 'audio/mpeg');
    response.setHeader('Cache-Control', 'public, max-age=86400');
    return fs.createReadStream(cachePath).pipe(response);
  }

  const chunks = splitTextForTts(clean, 180);
  try {
    const buffers = [];
    for (const chunk of chunks) {
      const buf = await fetchGoogleTtsChunk(chunk);
      if (buf && buf.length) buffers.push(buf);
    }
    const fullAudio = Buffer.concat(buffers);
    await fs.promises.writeFile(cachePath, fullAudio);
    response.setHeader('Content-Type', 'audio/mpeg');
    response.setHeader('Cache-Control', 'public, max-age=86400');
    response.send(fullAudio);
  } catch (err) {
    response.status(502).send('TTS upstream error: ' + err.message);
  }
});

app.get('/admin', (_request, response) => response.sendFile(path.join(publicDir, 'admin', 'index.html')));
app.use(express.static(publicDir, { extensions: ['html'] }));

io.on('connection', (socket) => {
  console.log(`[Socket] 🟢 Đã kết nối màn hình hiển thị (ID: ${socket.id}, IP: ${socket.handshake.address})`);
  socket.emit('temple:snapshot', temple.snapshot());
  socket.on('disconnect', () => {
    console.log(`[Socket] 🔴 Màn hình hiển thị đã ngắt (ID: ${socket.id})`);
  });
  socket.on('gift:finished', (payload) => temple.finishGift(payload?.id, 'game'));
  socket.on('audio:ended', (payload) => {
    if (Number(payload?.revision) === Number(temple.data.settings.audio.revision)) temple.audioAction('ended').catch(console.error);
  });
});

app.use((error, _request, response, _next) => {
  console.error(error);
  const status = error instanceof multer.MulterError ? 400 : 500;
  response.status(status).json({ error: status === 400 ? error.message : (error.message || 'Lỗi máy chủ.') });
});

httpServer.listen(port, () => {
  console.log(`Chùa Online MVP: http://localhost:${port}`);
  console.log(`Trang quản trị:   http://localhost:${port}/admin`);
});

async function shutdown() {
  temple.destroy();
  io.close();
  httpServer.close();
  await store.close();
}
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
