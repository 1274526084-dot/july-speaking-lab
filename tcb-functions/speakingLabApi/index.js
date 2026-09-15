/* oxlint-disable typescript/no-require-imports */
const cloudbase = require('@cloudbase/node-sdk');
const { asr } = require('tencentcloud-sdk-nodejs-asr');
const {
  createHash,
  pbkdf2Sync,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} = require('node:crypto');

const app = cloudbase.init({ env: cloudbase.SYMBOL_CURRENT_ENV });
const db = app.database();

const ATTEMPTS = 'speaking_attempts';
const SESSIONS = 'speaking_sessions';
const RATES = 'speaking_rates';
const RECOGNITION_CHUNKS = 'speaking_recognition_chunks';
const UPLOADS = 'speaking_uploads';
const SESSION_MS = 8 * 60 * 60 * 1000;
const UPLOAD_SESSION_MS = 20 * 60 * 1000;
const AUTH_VERSION = 2;
const TEACHER_ACCOUNTS = {
  cherie: {
    code: 'cherie',
    name: 'Cherie',
    salt: '20fe6fc48b2726552878d0a1d169be7a',
    hash: '1ca5b76748e94a4d4abfbc0e7ccdfcebf97693871d2c6573093cf377e9fdedfc',
  },
  lisa: {
    code: 'lisa',
    name: 'Lisa',
    salt: 'ebcd2b7c67e1067c0e2518b84ec96158',
    hash: 'c3f48c521a5a58e2a421ec7d8b4d67e9d99f9e8e0ef424299f5723a0950dadf2',
  },
  alice: {
    code: 'alice',
    name: 'Alice',
    salt: 'e73f74c75887bd40b509d8a9ab3958c2',
    hash: '2aaf431361728efa852e7fbdd10df5fa6a52ff8c4aae47841092025dbbc03905',
  },
  july: {
    code: 'july',
    name: 'July',
    salt: '9f5aa832e98332de5c2ef9c43cdcd8e7',
    hash: '67d2ae9f437bc88b6a5c2fe7c99c4342d76ab1bc3232f6c2ab012f88c4cf3999',
  },
};
const MAX_CLIP_BYTES = 2 * 1024 * 1024;
const MAX_TOTAL_BYTES = 4.5 * 1024 * 1024;
const MAX_RECOGNITION_BYTES = 2 * 1024 * 1024;
const SCENES = new Set(['dormitory', 'club', 'classroom', 'canteen']);
const SCENE_HOTWORDS = {
  dormitory: ['dormitory', 'roommate', 'freshman', 'major', 'WeChat'],
  club: ['Debate Club', 'Cycling Club', 'beginner', 'sign up', 'interested'],
  classroom: [
    'do me a favor',
    'signal diagram',
    'circuit diagram',
    'work together',
  ],
  canteen: ['canteen', 'bamboo shoots', 'pizza', 'flavor', 'second floor'],
};
const ALLOWED_ORIGINS = new Set([
  'https://1274526084-dot.github.io',
  'http://localhost:4173',
  'http://localhost:5173',
]);

let collectionsReady;
let asrClient;

function headersFrom(event) {
  return Object.fromEntries(
    Object.entries(event.headers || {}).map(([key, value]) => [
      key.toLowerCase(),
      String(value),
    ]),
  );
}

function corsOrigin(event) {
  const origin = headersFrom(event).origin || '';
  return ALLOWED_ORIGINS.has(origin)
    ? origin
    : 'https://1274526084-dot.github.io';
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
  const raw = event.isBase64Encoded
    ? Buffer.from(encoded, 'base64').toString('utf8')
    : encoded;
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
  return (
    value.includes('exist') ||
    value.includes('已存在') ||
    value.includes('-502005')
  );
}

async function ensureCollections() {
  if (!collectionsReady) {
    collectionsReady = (async () => {
      for (const name of [ATTEMPTS, SESSIONS, RATES, RECOGNITION_CHUNKS, UPLOADS]) {
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
    return Array.isArray(result.data)
      ? result.data[0] || null
      : result.data || null;
  } catch {
    return null;
  }
}

function clientIp(event) {
  const headers = headersFrom(event);
  return String(
    event.requestContext?.sourceIp ||
      headers['x-forwarded-for'] ||
      headers['x-real-ip'] ||
      'unknown',
  )
    .split(',')[0]
    .trim();
}

function teacherPasswordMatches(password, teacher) {
  if (
    typeof password !== 'string' ||
    password.length < 8 ||
    password.length > 128
  )
    return false;
  const actual = pbkdf2Sync(password, teacher.salt, 210000, 32, 'sha256');
  const expected = Buffer.from(teacher.hash, 'hex');
  return expected.length === actual.length && timingSafeEqual(actual, expected);
}

async function checkLoginRate(event, successful) {
  const id = `login-${sha256(clientIp(event)).slice(0, 48)}`;
  const now = Date.now();
  const current = await getDocument(RATES, id);
  const active = current && Number(current.reset_at) > now;
  if (active && Number(current.count) >= 8 && !successful)
    return { blocked: true };
  if (successful) {
    await db
      .collection(RATES)
      .doc(id)
      .remove()
      .catch(() => undefined);
    return { blocked: false };
  }
  const count = active ? Number(current.count || 0) + 1 : 1;
  await db
    .collection(RATES)
    .doc(id)
    .set({
      count,
      reset_at: active ? Number(current.reset_at) : now + 15 * 60 * 1000,
    });
  return { blocked: count >= 8 };
}

async function checkSubmissionRate(event) {
  const id = `submit-${sha256(clientIp(event)).slice(0, 47)}`;
  const now = Date.now();
  const current = await getDocument(RATES, id);
  const active = current && Number(current.reset_at) > now;
  const count = active ? Number(current.count || 0) + 1 : 1;
  await db
    .collection(RATES)
    .doc(id)
    .set({
      count,
      reset_at: active ? Number(current.reset_at) : now + 15 * 60 * 1000,
    });
  return count <= 12;
}

async function checkRecognitionRate(event) {
  const id = `recognize-${sha256(clientIp(event)).slice(0, 44)}`;
  const now = Date.now();
  const current = await getDocument(RATES, id);
  const active = current && Number(current.reset_at) > now;
  const count = active ? Number(current.count || 0) + 1 : 1;
  await db
    .collection(RATES)
    .doc(id)
    .set({
      count,
      reset_at: active ? Number(current.reset_at) : now + 15 * 60 * 1000,
    });
  return count <= 45;
}

async function validSession(token) {
  if (!/^[0-9a-f]{64}$/i.test(String(token || ''))) return null;
  const id = sha256(token);
  const session = await getDocument(SESSIONS, id);
  if (
    !session ||
    Number(session.expires_at) <= Date.now() ||
    Number(session.auth_version) !== AUTH_VERSION
  ) {
    if (session)
      await db
        .collection(SESSIONS)
        .doc(id)
        .remove()
        .catch(() => undefined);
    return null;
  }
  return session;
}

function extensionFor(type) {
  if (String(type).includes('ogg')) return 'ogg';
  if (String(type).includes('mp4') || String(type).includes('m4a'))
    return 'm4a';
  return 'webm';
}

function voiceFormatFor(type) {
  const value = String(type || '').toLowerCase();
  if (value.includes('wav')) return 'wav';
  if (value.includes('mpeg') || value.includes('mp3')) return 'mp3';
  if (value.includes('m4a') || value.includes('mp4')) return 'm4a';
  if (value.includes('aac')) return 'aac';
  if (value.includes('amr')) return 'amr';
  if (value.includes('ogg')) return 'ogg-opus';
  return '';
}

function getAsrClient() {
  if (asrClient) return asrClient;
  const context = cloudbase.getCloudbaseContext();
  const secretId =
    context.TENCENTCLOUD_SECRETID ||
    process.env.TENCENTCLOUD_SECRETID ||
    process.env.TENCENTCLOUD_SECRET_ID;
  const secretKey =
    context.TENCENTCLOUD_SECRETKEY ||
    process.env.TENCENTCLOUD_SECRETKEY ||
    process.env.TENCENTCLOUD_SECRET_KEY;
  const token =
    context.TENCENTCLOUD_SESSIONTOKEN ||
    process.env.TENCENTCLOUD_SESSIONTOKEN ||
    process.env.TENCENTCLOUD_TOKEN;
  if (!secretId || !secretKey)
    throw new Error('ASR_RUNTIME_CREDENTIALS_MISSING');
  const Client = asr.v20190614.Client;
  asrClient = new Client({
    credential: { secretId, secretKey, token },
    region: '',
    profile: {
      httpProfile: { endpoint: 'asr.tencentcloudapi.com', reqTimeout: 12 },
    },
  });
  return asrClient;
}

async function handleRecognize(event, body) {
  if (!(await checkRecognitionRate(event))) {
    return response(event, 429, {
      ok: false,
      error: '识别请求较多，请稍等一分钟再试。',
    });
  }
  const sceneId = cleanText(body.sceneId, 30);
  const audio = body.audio || {};
  const type = cleanText(audio.type, 80);
  const format = voiceFormatFor(type);
  const data = typeof audio.data === 'string' ? audio.data : '';
  if (
    !SCENES.has(sceneId) ||
    !format ||
    !data ||
    data.length > Math.ceil((MAX_RECOGNITION_BYTES * 4) / 3) + 8
  ) {
    return response(event, 400, {
      ok: false,
      error: '这段录音无法识别，请重新录制。',
    });
  }
  const buffer = Buffer.from(data, 'base64');
  if (!buffer.length || buffer.length > MAX_RECOGNITION_BYTES) {
    return response(event, 400, {
      ok: false,
      error: '录音过长，请缩短回答后重新录制。',
    });
  }
  try {
    const result = await getAsrClient().SentenceRecognition({
      EngSerViceType: '16k_en',
      SourceType: 1,
      VoiceFormat: format,
      Data: data,
      DataLen: buffer.length,
      WordInfo: 0,
      FilterDirty: 0,
      FilterModal: 0,
      FilterPunc: 0,
      ConvertNumMode: 1,
      HotwordList: (SCENE_HOTWORDS[sceneId] || [])
        .map((word) => `${word}|6`)
        .join(','),
    });
    const transcript = cleanText(result.Result, 1000);
    return response(event, 200, {
      ok: true,
      transcript,
      durationMs: cleanInt(result.AudioDuration, 0, 60000),
    });
  } catch (error) {
    const details = `${error?.code || ''} ${error?.message || ''}`;
    console.error(
      'speakingLab recognize failed',
      details,
      error?.requestId || '',
    );
    if (
      /not.*activate|notactivated|service.*open|unauthorized/i.test(details)
    ) {
      return response(event, 503, {
        ok: false,
        code: cleanText(error?.code, 100),
        error:
          '腾讯云语音识别尚未开通或没有调用权限。录音仍已保留，可以手动输入或继续下一问。',
      });
    }
    return response(event, 502, {
      ok: false,
      code: cleanText(error?.code, 100),
      error: '云端暂时没有识别成功，录音仍已保留，可以重录或继续下一问。',
    });
  }
}

async function handleRecognizeChunk(event, body) {
  if (!(await checkRecognitionRate(event))) {
    return response(event, 429, {
      ok: false,
      error: '识别请求较多，请稍等一分钟再试。',
    });
  }
  const uploadId = cleanText(body.uploadId, 80);
  const sceneId = cleanText(body.sceneId, 30);
  const type = cleanText(body.type, 80);
  const data = typeof body.data === 'string' ? body.data : '';
  const chunkIndex = cleanInt(body.chunkIndex, 0, 31);
  const totalChunks = cleanInt(body.totalChunks, 1, 32);
  if (
    !/^[a-z0-9-]{20,80}$/i.test(uploadId) ||
    !SCENES.has(sceneId) ||
    !voiceFormatFor(type) ||
    chunkIndex >= totalChunks ||
    !data ||
    data.length > 65000
  ) {
    return response(event, 400, {
      ok: false,
      error: '录音分片无效，请重新录制。',
    });
  }
  const decoded = Buffer.from(data, 'base64');
  if (!decoded.length || decoded.length > 50000) {
    return response(event, 400, {
      ok: false,
      error: '录音分片过大，请重新录制。',
    });
  }
  const ipHash = sha256(clientIp(event));
  const chunkId = `asr-${uploadId}-${chunkIndex}`;
  await db.collection(RECOGNITION_CHUNKS).doc(chunkId).set({
    upload_id: uploadId,
    scene_id: sceneId,
    type,
    chunk_index: chunkIndex,
    total_chunks: totalChunks,
    data,
    ip_hash: ipHash,
    created_at: Date.now(),
  });
  if (chunkIndex + 1 < totalChunks) {
    return response(event, 200, {
      ok: true,
      pending: true,
      received: chunkIndex + 1,
    });
  }

  const chunkIds = Array.from(
    { length: totalChunks },
    (_, index) => `asr-${uploadId}-${index}`,
  );
  try {
    const rows = await Promise.all(
      chunkIds.map((id) => getDocument(RECOGNITION_CHUNKS, id)),
    );
    if (
      rows.some(
        (row, index) =>
          !row ||
          row.ip_hash !== ipHash ||
          row.upload_id !== uploadId ||
          row.scene_id !== sceneId ||
          row.type !== type ||
          Number(row.chunk_index) !== index ||
          Number(row.total_chunks) !== totalChunks,
      )
    ) {
      return response(event, 400, {
        ok: false,
        error: '录音分片不完整，请重新录制。',
      });
    }
    const audioBuffer = Buffer.concat(
      rows.map((row) => Buffer.from(row.data, 'base64')),
    );
    if (!audioBuffer.length || audioBuffer.length > MAX_RECOGNITION_BYTES) {
      return response(event, 400, {
        ok: false,
        error: '回答时间过长，请缩短后重新录制。',
      });
    }
    return await handleRecognize(event, {
      sceneId,
      audio: { type, data: audioBuffer.toString('base64') },
    });
  } finally {
    await Promise.all(
      chunkIds.map((id) =>
        db
          .collection(RECOGNITION_CHUNKS)
          .doc(id)
          .remove()
          .catch(() => undefined),
      ),
    );
  }
}

async function handleLogin(event, body) {
  const current = await checkLoginRate(event, false);
  if (current.blocked)
    return response(event, 429, {
      ok: false,
      error: '尝试次数过多，请15分钟后再试。',
    });
  const code = cleanText(body.code, 20).toLowerCase();
  const teacher = TEACHER_ACCOUNTS[code];
  const valid = Boolean(
    teacher && teacherPasswordMatches(body.password, teacher),
  );
  if (!valid)
    return response(event, 401, {
      ok: false,
      error: '教师账号或密码不正确，请重试。',
    });
  await checkLoginRate(event, true);
  const token = randomBytes(32).toString('hex');
  await db
    .collection(SESSIONS)
    .doc(sha256(token))
    .set({
      auth_version: AUTH_VERSION,
      teacher_code: teacher.code,
      teacher_name: teacher.name,
      created_at: Date.now(),
      expires_at: Date.now() + SESSION_MS,
    });
  return response(event, 200, {
    ok: true,
    token,
    code: teacher.code,
    name: teacher.name,
  });
}

function sanitizeAttemptPayload(payload) {
  const studentName = cleanText(payload.studentName, 40);
  const studentId = cleanText(payload.studentId, 40);
  const className = cleanText(payload.className, 60);
  const sceneId = cleanText(payload.sceneId, 30);
  const sceneTitle = cleanText(payload.sceneTitle, 100);
  const transcript = cleanText(payload.transcript, 4000);
  const feedback = cleanText(payload.feedback, 1000);
  if (!studentName || !studentId || !className || !SCENES.has(sceneId) || !transcript) return null;
  return {
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
  };
}

function uploadTokenMatches(token, expectedHash) {
  if (!/^[0-9a-f]{48}$/i.test(String(token || '')) || !/^[0-9a-f]{64}$/i.test(String(expectedHash || ''))) return false;
  const actual = Buffer.from(sha256(token), 'hex');
  const expected = Buffer.from(expectedHash, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

async function handlePrepareUpload(event, body) {
  if (!(await checkSubmissionRate(event))) return response(event, 429, { ok: false, error: '提交次数过多，请稍后再试。' });
  const payload = body.payload || {};
  const attempt = sanitizeAttemptPayload(payload);
  const clips = Array.isArray(body.audio) ? body.audio.slice(0, 4) : [];
  if (!attempt) return response(event, 400, { ok: false, error: '请填写姓名、学号和班级，并完成三轮对话。' });
  if (payload.recordingConsent !== true || clips.length < 1 || clips.length > 3) {
    return response(event, 400, { ok: false, error: '正式提交需要同意上传一至三段练习录音。' });
  }
  const audio = [];
  let totalBytes = 0;
  const rounds = new Set();
  for (const clip of clips) {
    const round = cleanInt(clip?.round, 1, 3);
    const type = cleanText(clip?.type, 80) || 'audio/wav';
    const rawBytes = Number(clip?.bytes);
    const bytes = Number.isFinite(rawBytes) && rawBytes > 0 ? Math.round(rawBytes) : 0;
    if (!type.startsWith('audio/') || !bytes || bytes > MAX_CLIP_BYTES || rounds.has(round)) {
      return response(event, 400, { ok: false, error: '录音格式或大小不符合要求，请重新录制。' });
    }
    rounds.add(round);
    totalBytes += bytes;
    audio.push({ round, type, bytes });
  }
  if (totalBytes > MAX_TOTAL_BYTES) return response(event, 400, { ok: false, error: '本次录音总长度过大，请缩短回答后重新录制。' });

  const id = randomUUID();
  const submitToken = randomBytes(24).toString('hex');
  const date = new Date().toISOString().slice(0, 10);
  const manifest = [];
  const uploads = [];
  for (const clip of audio) {
    const cloudPath = `july-speaking-lab/audio/${date}/${id}/round-${clip.round}.${extensionFor(clip.type)}`;
    const metadata = await app.getUploadMetadata({ cloudPath });
    const upload = metadata?.data || {};
    if (!upload.url || !upload.fileId || !upload.authorization || !upload.token || !upload.cosFileId) {
      return response(event, 500, { ok: false, error: '暂时无法准备录音上传，请稍后重试。' });
    }
    manifest.push({ key: upload.fileId, cloud_path: cloudPath, type: clip.type, expected_size: clip.bytes, round: clip.round });
    uploads.push({ round: clip.round, url: upload.url, token: upload.token, authorization: upload.authorization, fileId: upload.fileId, cosFileId: upload.cosFileId, cloudPath });
  }
  await db.collection(UPLOADS).doc(id).set({
    id,
    submit_token_hash: sha256(submitToken),
    attempt_json: JSON.stringify(attempt),
    audio_manifest: JSON.stringify(manifest),
    created_at: Date.now(),
    expires_at: Date.now() + UPLOAD_SESSION_MS,
  });
  return response(event, 200, { ok: true, uploadId: id, submitToken, uploads });
}

async function handleConfirmUpload(event, body) {
  const id = cleanText(body.uploadId, 64);
  const pending = id ? await getDocument(UPLOADS, id) : null;
  if (!pending || Number(pending.expires_at || 0) <= Date.now() || !uploadTokenMatches(body.submitToken, pending.submit_token_hash)) {
    return response(event, 401, { ok: false, error: '上传凭证已失效，请点击重新上传。' });
  }
  let attempt;
  let manifest;
  try {
    attempt = JSON.parse(pending.attempt_json || '{}');
    manifest = JSON.parse(pending.audio_manifest || '[]');
  } catch {
    return response(event, 400, { ok: false, error: '上传信息无效，请重新上传。' });
  }
  if (!attempt || !Array.isArray(manifest) || !manifest.length) return response(event, 400, { ok: false, error: '上传信息不完整，请重新上传。' });
  const info = await app.getFileInfo({ fileList: manifest.map((item) => item.key) });
  const storedById = new Map((info.fileList || []).map((item) => [item.fileID, item]));
  const savedManifest = [];
  let totalBytes = 0;
  for (const item of manifest) {
    const stored = storedById.get(item.key);
    const size = Number(stored?.size || 0);
    if (stored?.code !== 'SUCCESS' || !size) return response(event, 400, { ok: false, error: `第${item.round}轮录音尚未上传完成，请重试。` });
    if (size > MAX_CLIP_BYTES || size !== Number(item.expected_size)) return response(event, 400, { ok: false, error: `第${item.round}轮录音大小校验失败，请重新上传。` });
    totalBytes += size;
    savedManifest.push({ key: item.key, type: item.type, size, round: item.round });
  }
  if (totalBytes > MAX_TOTAL_BYTES) return response(event, 400, { ok: false, error: '本次录音总长度过大，请重新录制。' });
  const submittedAt = Date.now();
  await db.collection(ATTEMPTS).doc(id).set({ ...attempt, id, audio_manifest: JSON.stringify(savedManifest), submitted_at: submittedAt });
  await db.collection(UPLOADS).doc(id).remove().catch(() => undefined);
  return response(event, 200, { ok: true, id });
}

async function handleSubmit(event, body) {
  if (!(await checkSubmissionRate(event)))
    return response(event, 429, {
      ok: false,
      error: '提交次数过多，请稍后再试。',
    });
  const payload = body.payload || {};
  const studentName = cleanText(payload.studentName, 40);
  const studentId = cleanText(payload.studentId, 40);
  const className = cleanText(payload.className, 60);
  const sceneId = cleanText(payload.sceneId, 30);
  const sceneTitle = cleanText(payload.sceneTitle, 100);
  const transcript = cleanText(payload.transcript, 4000);
  const feedback = cleanText(payload.feedback, 1000);
  const clips = Array.isArray(body.audio) ? body.audio.slice(0, 4) : [];

  if (
    !studentName ||
    !studentId ||
    !className ||
    !SCENES.has(sceneId) ||
    !transcript
  ) {
    return response(event, 400, {
      ok: false,
      error: '请填写姓名、学号和班级，并完成三轮对话。',
    });
  }
  if (
    payload.recordingConsent !== true ||
    clips.length < 1 ||
    clips.length > 3
  ) {
    return response(event, 400, {
      ok: false,
      error: '正式提交需要同意上传一至三段练习录音。',
    });
  }

  const decoded = [];
  let totalBytes = 0;
  for (let index = 0; index < clips.length; index += 1) {
    const clip = clips[index] || {};
    const type = cleanText(clip.type, 80) || 'audio/webm';
    const data = typeof clip.data === 'string' ? clip.data : '';
    if (
      !type.startsWith('audio/') ||
      !data ||
      data.length > Math.ceil((MAX_CLIP_BYTES * 4) / 3) + 8
    ) {
      return response(event, 400, {
        ok: false,
        error: '录音格式或大小不符合要求，请重新录制。',
      });
    }
    const buffer = Buffer.from(data, 'base64');
    if (!buffer.length || buffer.length > MAX_CLIP_BYTES) {
      return response(event, 400, {
        ok: false,
        error: '单段录音过长，请重新录制。',
      });
    }
    totalBytes += buffer.length;
    decoded.push({ round: cleanInt(clip.round, 1, 3), type, buffer });
  }
  if (totalBytes > MAX_TOTAL_BYTES)
    return response(event, 400, {
      ok: false,
      error: '本次录音总长度过大，请重新录制。',
    });

  const id = randomUUID();
  const submittedAt = Date.now();
  const date = new Date(submittedAt).toISOString().slice(0, 10);
  const manifest = [];
  const uploaded = [];
  try {
    for (const clip of decoded) {
      const cloudPath = `july-speaking-lab/audio/${date}/${id}/round-${clip.round}.${extensionFor(clip.type)}`;
      const upload = await app.uploadFile({
        cloudPath,
        fileContent: clip.buffer,
      });
      if (!upload.fileID) throw new Error('Audio upload did not return fileID');
      uploaded.push(upload.fileID);
      manifest.push({
        key: upload.fileID,
        type: clip.type,
        size: clip.buffer.length,
        round: clip.round,
      });
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
      confidence:
        payload.confidence == null
          ? null
          : cleanInt(payload.confidence, 0, 100),
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
    if (uploaded.length)
      await app.deleteFile({ fileList: uploaded }).catch(() => undefined);
    console.error('speakingLab submit failed', error?.message || error);
    return response(event, 500, {
      ok: false,
      error: '上传未完成，请检查网络后重试。',
    });
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
  const session = await validSession(body.token);
  if (!session)
    return response(event, 401, {
      ok: false,
      error: '登录已失效，请重新登录。',
    });
  const result = await db
    .collection(ATTEMPTS)
    .orderBy('submitted_at', 'desc')
    .limit(300)
    .get();
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
    audio_manifest: JSON.stringify(
      manifests[index].map((item) => ({
        ...item,
        url: urls.get(item.key) || '',
      })),
    ),
  }));
  return response(event, 200, {
    ok: true,
    teacherName: session.teacher_name,
    rows: hydratedRows,
  });
}

exports.main = async (event) => {
  if (String(event.httpMethod || '').toUpperCase() === 'OPTIONS') {
    return response(event, 204, {});
  }
  try {
    await ensureCollections();
    const body = parseBody(event);
    const action = cleanText(body.action, 40);
    if (action === 'recognizeChunk') return handleRecognizeChunk(event, body);
    if (action === 'recognize') return handleRecognize(event, body);
    if (action === 'prepareUpload') return handlePrepareUpload(event, body);
    if (action === 'confirmUpload') return handleConfirmUpload(event, body);
    if (action === 'submit') return handleSubmit(event, body);
    if (action === 'teacherLogin') return handleLogin(event, body);
    if (action === 'session') {
      const session = await validSession(body.token);
      return response(
        event,
        session ? 200 : 401,
        session
          ? { ok: true, code: session.teacher_code, name: session.teacher_name }
          : { ok: false, error: '登录已失效，请重新登录。' },
      );
    }
    if (action === 'list') return handleList(event, body);
    if (action === 'logout') {
      if (/^[0-9a-f]{64}$/i.test(String(body.token || ''))) {
        await db
          .collection(SESSIONS)
          .doc(sha256(body.token))
          .remove()
          .catch(() => undefined);
      }
      return response(event, 200, { ok: true });
    }
    return response(event, 404, { ok: false, error: '未知操作。' });
  } catch (error) {
    console.error('speakingLab API failed', error?.message || error);
    return response(event, 500, {
      ok: false,
      error: '服务暂时不可用，请稍后重试。',
    });
  }
};
