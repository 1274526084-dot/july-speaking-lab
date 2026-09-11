/* oxlint-disable typescript/no-require-imports */
const cloudbase = require('@cloudbase/node-sdk');
const { createHash, pbkdf2Sync, randomBytes, randomUUID, timingSafeEqual } = require('node:crypto');

const app = cloudbase.init({ env: cloudbase.SYMBOL_CURRENT_ENV });
const db = app.database();

const ATTEMPTS = 'speaking_attempts';
const SESSIONS = 'speaking_sessions';
const RATES = 'speaking_rates';
const SESSION_MS = 8 * 60 * 60 * 1000;
const PASSWORD_SALT = 'db0ec8f7c8632bb51ebccc49114ba1f8';
const PASSWORD_HASH = '7847a75d46d7436bca0f3895644ae0cff889215c859ba3390aaa5aa5f5f53cb8';
const MAX_CLIP_BYTES = 2 * 1024 * 1024;
const MAX_TOTAL_BYTES = 4.5 * 1024 * 1024;
const SCENES = new Set(['dormitory', 'club', 'classroom', 'canteen']);
const ALLOWED_ORIGINS = new Set([
  'https://1274526084-dot.github.io',
  'http://localhost:4173',
  'http://localhost:5173',
]);

let collectionsReady;

function headersFrom(event) {
  return Object.fromEntries(Object.entries(event.headers || {}).map(([key, value]) => [key.toLowerCase(), String(value)]));
}

function corsOrigin(event) {
  const origin = headersFrom(event).origin || '';
  return ALLOWED_ORIGINS.has(origin) ? origin : 'https://1274526084-dot.github.io';
}

function response(event, statusCode, value) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': corsOrigin(event),
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      Vary: 'Origin',
    },
    body: JSON.stringify(value),
  };
}

function parseBody(event) {
  if (event.body && typeof event.body === 'object') return event.body;
  const encoded = typeof event.body === 'string' ? event.body : '';
  const raw = event.isBase64Encoded ? Buffer.from(encoded, 'base64').toString('utf8') : encoded;
  return raw ? JSON.parse(raw) : {};
}

function cleanText(value, max) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function cleanInt(value, min, max) {
  const number = Math.round(Number(value));
  return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : min;
}

function sha256(value) {
  return createHash('sha256').update(String(value)).digest('hex');
}

function isCollectionExistsError(error) {
  const value = `${error?.code || ''} ${error?.message || ''}`.toLowerCase();
  return value.includes('exist') || value.includes('已存在') || value.includes('-502005');
}

async function ensureCollections() {
  if (!collectionsReady) {
    collectionsReady = (async () => {
      for (const name of [ATTEMPTS, SESSIONS, RATES]) {
        try {
          await db.createCollection(name);
        } catch (error) {
          if (!isCollectionExistsError(error)) throw error;
        }
      }
    })();
  }
  return collectionsReady;
}

async function getDocument(collection, id) {
  try {
    const result = await db.collection(collection).doc(id).get();
    return Array.isArray(result.data) ? result.data[0] || null : result.data || null;
  } catch {
    return null;
  }
}

function clientIp(event) {
  const headers = headersFrom(event);
  return String(event.requestContext?.sourceIp || headers['x-forwarded-for'] || headers['x-real-ip'] || 'unknown').split(',')[0].trim();
}

function passwordMatches(password) {
  if (typeof password !== 'string' || password.length < 8 || password.length > 128) return false;
  const actual = pbkdf2Sync(password, PASSWORD_SALT, 210000, 32, 'sha256');
  const expected = Buffer.from(PASSWORD_HASH, 'hex');
  return expected.length === actual.length && timingSafeEqual(actual, expected);
}

async function checkLoginRate(event, successful) {
  const id = `login-${sha256(clientIp(event)).slice(0, 48)}`;
  const now = Date.now();
  const current = await getDocument(RATES, id);
  const active = current && Number(current.reset_at) > now;
  if (active && Number(current.count) >= 8 && !successful) return { blocked: true };
  if (successful) {
    await db.collection(RATES).doc(id).remove().catch(() => undefined);
    return { blocked: false };
  }
  const count = active ? Number(current.count || 0) + 1 : 1;
  await db.collection(RATES).doc(id).set({ count, reset_at: active ? Number(current.reset_at) : now + 15 * 60 * 1000 });
  return { blocked: count >= 8 };
}

async function checkSubmissionRate(event) {
  const id = `submit-${sha256(clientIp(event)).slice(0, 47)}`;
  const now = Date.now();
  const current = await getDocument(RATES, id);
  const active = current && Number(current.reset_at) > now;
  const count = active ? Number(current.count || 0) + 1 : 1;
  await db.collection(RATES).doc(id).set({ count, reset_at: active ? Number(current.reset_at) : now + 15 * 60 * 1000 });
  return count <= 12;
}

async function validSession(token) {
  if (!/^[0-9a-f]{64}$/i.test(String(token || ''))) return false;
  const id = sha256(token);
  const session = await getDocument(SESSIONS, id);
  if (!session || Number(session.expires_at) <= Date.now()) {
    if (session) await db.collection(SESSIONS).doc(id).remove().catch(() => undefined);
    return false;
  }
  return true;
}

function extensionFor(type) {
  if (String(type).includes('ogg')) return 'ogg';
  if (String(type).includes('mp4') || String(type).includes('m4a')) return 'm4a';
  return 'webm';
}

async function handleLogin(event, body) {
  const current = await checkLoginRate(event, false);
  if (current.blocked) return response(event, 429, { ok: false, error: '尝试次数过多，请15分钟后再试。' });
  const valid = passwordMatches(body.password);
  if (!valid) return response(event, 401, { ok: false, error: '密码不正确，请重试。' });
  await checkLoginRate(event, true);
  const token = randomBytes(32).toString('hex');
  await db.collection(SESSIONS).doc(sha256(token)).set({ created_at: Date.now(), expires_at: Date.now() + SESSION_MS });
  return response(event, 200, { ok: true, token });
}

async function handleSubmit(event, body) {
  if (!(await checkSubmissionRate(event))) return response(event, 429, { ok: false, error: '提交次数过多，请稍后再试。' });
  const payload = body.payload || {};
  const studentName = cleanText(payload.studentName, 40);
  const studentId = cleanText(payload.studentId, 40);
  const className = cleanText(payload.className, 60);
  const sceneId = cleanText(payload.sceneId, 30);
  const sceneTitle = cleanText(payload.sceneTitle, 100);
  const transcript = cleanText(payload.transcript, 4000);
  const feedback = cleanText(payload.feedback, 1000);
  const clips = Array.isArray(body.audio) ? body.audio.slice(0, 4) : [];

  if (!studentName || !studentId || !className || !SCENES.has(sceneId) || !transcript) {
    return response(event, 400, { ok: false, error: '请填写姓名、学号和班级，并完成三轮对话。' });
  }
  if (payload.recordingConsent !== true || clips.length < 1 || clips.length > 3) {
    return response(event, 400, { ok: false, error: '正式提交需要同意上传一至三段练习录音。' });
  }

  const decoded = [];
  let totalBytes = 0;
  for (let index = 0; index < clips.length; index += 1) {
    const clip = clips[index] || {};
    const type = cleanText(clip.type, 80) || 'audio/webm';
    const data = typeof clip.data === 'string' ? clip.data : '';
    if (!type.startsWith('audio/') || !data || data.length > Math.ceil(MAX_CLIP_BYTES * 4 / 3) + 8) {
      return response(event, 400, { ok: false, error: '录音格式或大小不符合要求，请重新录制。' });
    }
    const buffer = Buffer.from(data, 'base64');
    if (!buffer.length || buffer.length > MAX_CLIP_BYTES) {
      return response(event, 400, { ok: false, error: '单段录音过长，请重新录制。' });
    }
    totalBytes += buffer.length;
    decoded.push({ round: cleanInt(clip.round, 1, 3), type, buffer });
  }
  if (totalBytes > MAX_TOTAL_BYTES) return response(event, 400, { ok: false, error: '本次录音总长度过大，请重新录制。' });

  const id = randomUUID();
  const submittedAt = Date.now();
  const date = new Date(submittedAt).toISOString().slice(0, 10);
  const manifest = [];
  const uploaded = [];
  try {
    for (const clip of decoded) {
      const cloudPath = `july-speaking-lab/audio/${date}/${id}/round-${clip.round}.${extensionFor(clip.type)}`;
      const upload = await app.uploadFile({ cloudPath, fileContent: clip.buffer });
      if (!upload.fileID) throw new Error('Audio upload did not return fileID');
      uploaded.push(upload.fileID);
      manifest.push({ key: upload.fileID, type: clip.type, size: clip.buffer.length, round: clip.round });
    }

    const attempt = {
      id,
      student_name: studentName,
      student_id: studentId,
      class_name: className,
      scene_id: sceneId,
      scene_title: sceneTitle,
      transcript,
      coverage: cleanInt(payload.coverage, 0, 100),
      confidence: payload.confidence == null ? null : cleanInt(payload.confidence, 0, 100),
      duration_seconds: cleanInt(payload.durationSeconds, 1, 7200),
      attempts: cleanInt(payload.attempts, 1, 20),
      task_score: cleanInt(payload.taskScore, 0, 40),
      sentence_score: cleanInt(payload.sentenceScore, 0, 30),
      clarity_score: cleanInt(payload.clarityScore, 0, 20),
      interaction_score: cleanInt(payload.interactionScore, 0, 10),
      total_score: cleanInt(payload.totalScore, 0, 100),
      feedback,
      audio_manifest: JSON.stringify(manifest),
      submitted_at: submittedAt,
    };
    await db.collection(ATTEMPTS).doc(id).set(attempt);
  } catch (error) {
    if (uploaded.length) await app.deleteFile({ fileList: uploaded }).catch(() => undefined);
    console.error('speakingLab submit failed', error?.message || error);
    return response(event, 500, { ok: false, error: '上传未完成，请检查网络后重试。' });
  }
  return response(event, 200, { ok: true, id });
}

async function temporaryUrlMap(fileIds) {
  const map = new Map();
  const unique = [...new Set(fileIds.filter(Boolean))];
  for (let index = 0; index < unique.length; index += 50) {
    const batch = unique.slice(index, index + 50);
    const result = await app.getTempFileURL({ fileList: batch });
    for (const item of result.fileList || []) {
      map.set(item.fileID, item.tempFileURL || item.download_url || '');
    }
  }
  return map;
}

async function handleList(event, body) {
  if (!(await validSession(body.token))) return response(event, 401, { ok: false, error: '登录已失效，请重新登录。' });
  const result = await db.collection(ATTEMPTS).orderBy('submitted_at', 'desc').limit(300).get();
  const rows = Array.isArray(result.data) ? result.data : [];
  const fileIds = [];
  const manifests = rows.map((row) => {
    try {
      const parsed = JSON.parse(row.audio_manifest || '[]');
      if (!Array.isArray(parsed)) return [];
      parsed.forEach((item) => fileIds.push(item.key));
      return parsed;
    } catch {
      return [];
    }
  });
  const urls = await temporaryUrlMap(fileIds);
  const hydratedRows = rows.map((row, index) => ({
    ...row,
    audio_manifest: JSON.stringify(manifests[index].map((item) => ({ ...item, url: urls.get(item.key) || '' }))),
  }));
  return response(event, 200, { ok: true, rows: hydratedRows });
}

exports.main = async (event) => {
  if (String(event.httpMethod || '').toUpperCase() === 'OPTIONS') {
    return response(event, 204, {});
  }
  try {
    await ensureCollections();
    const body = parseBody(event);
    const action = cleanText(body.action, 40);
    if (action === 'submit') return handleSubmit(event, body);
    if (action === 'teacherLogin') return handleLogin(event, body);
    if (action === 'session') {
      const ok = await validSession(body.token);
      return response(event, ok ? 200 : 401, ok ? { ok: true } : { ok: false, error: '登录已失效，请重新登录。' });
    }
    if (action === 'list') return handleList(event, body);
    if (action === 'logout') {
      if (/^[0-9a-f]{64}$/i.test(String(body.token || ''))) {
        await db.collection(SESSIONS).doc(sha256(body.token)).remove().catch(() => undefined);
      }
      return response(event, 200, { ok: true });
    }
    return response(event, 404, { ok: false, error: '未知操作。' });
  } catch (error) {
    console.error('speakingLab API failed', error?.message || error);
    return response(event, 500, { ok: false, error: '服务暂时不可用，请稍后重试。' });
  }
};
