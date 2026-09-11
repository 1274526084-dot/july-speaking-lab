/* oxlint-disable typescript/no-require-imports */
const cloudbase = require('@cloudbase/node-sdk');
const { createHash, pbkdf2Sync, randomBytes, randomUUID, timingSafeEqual } = require('node:crypto');

const app = cloudbase.init({ env: cloudbase.SYMBOL_CURRENT_ENV });
const db = app.database();
const _ = db.command;

const TEACHERS = 'word_teachers';
const UNITS = 'word_units';
const ATTEMPTS = 'word_attempts';
const SESSIONS = 'word_sessions';
const RATES = 'word_rates';
const SESSION_MS = 8 * 60 * 60 * 1000;
const ADMIN_SALT = 'db0ec8f7c8632bb51ebccc49114ba1f8';
const ADMIN_HASH = '7847a75d46d7436bca0f3895644ae0cff889215c859ba3390aaa5aa5f5f53cb8';
const MAX_AUDIO_BYTES = 2 * 1024 * 1024;
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

function cleanText(value, max = 120) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function cleanCode(value) {
  return cleanText(value, 32).toLowerCase().replace(/[^a-z0-9_-]/g, '');
}

function cleanInt(value, min, max, fallback = min) {
  const number = Math.round(Number(value));
  return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback;
}

function sha256(value) {
  return createHash('sha256').update(String(value)).digest('hex');
}

function passwordHash(password, salt) {
  return pbkdf2Sync(password, salt, 210000, 32, 'sha256').toString('hex');
}

function safeEqualHex(left, right) {
  try {
    const a = Buffer.from(left, 'hex');
    const b = Buffer.from(right, 'hex');
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function isCollectionExistsError(error) {
  const value = `${error?.code || ''} ${error?.message || ''}`.toLowerCase();
  return value.includes('exist') || value.includes('已存在') || value.includes('-502005');
}

async function ensureCollections() {
  if (!collectionsReady) {
    collectionsReady = (async () => {
      for (const name of [TEACHERS, UNITS, ATTEMPTS, SESSIONS, RATES]) {
        try {
          await db.createCollection(name);
        } catch (error) {
          if (!isCollectionExistsError(error)) throw error;
        }
      }
      const seeded = await db.collection(TEACHERS).where({ code: 'july' }).limit(1).get();
      if (!(seeded.data || []).length) {
        await db.collection(TEACHERS).doc('teacher-july').set({
          id: 'teacher-july', code: 'july', name: 'July', password_salt: ADMIN_SALT,
          password_hash: ADMIN_HASH, active: true, created_at: Date.now(),
        });
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

async function findOne(collection, where) {
  const result = await db.collection(collection).where(where).limit(1).get();
  return (result.data || [])[0] || null;
}

async function queryRows(collection, where, max = 500) {
  const rows = [];
  for (let offset = 0; offset < max; offset += 100) {
    const result = await db.collection(collection).where(where).skip(offset).limit(Math.min(100, max - offset)).get();
    const batch = result.data || [];
    rows.push(...batch);
    if (batch.length < 100) break;
  }
  return rows;
}

function clientIp(event) {
  const headers = headersFrom(event);
  return String(event.requestContext?.sourceIp || headers['x-forwarded-for'] || headers['x-real-ip'] || 'unknown').split(',')[0].trim();
}

async function rateLimit(event, scope, max = 20) {
  const id = `${scope}-${sha256(clientIp(event)).slice(0, 48)}`;
  const now = Date.now();
  const current = await getDocument(RATES, id);
  const active = current && Number(current.reset_at) > now;
  const count = active ? Number(current.count || 0) + 1 : 1;
  await db.collection(RATES).doc(id).set({ count, reset_at: active ? Number(current.reset_at) : now + 15 * 60 * 1000 });
  return count <= max;
}

function adminPasswordMatches(password) {
  if (typeof password !== 'string' || password.length < 8 || password.length > 128) return false;
  return safeEqualHex(passwordHash(password, ADMIN_SALT), ADMIN_HASH);
}

function teacherPasswordMatches(password, teacher) {
  if (typeof password !== 'string' || password.length < 8 || password.length > 128 || !teacher) return false;
  return safeEqualHex(passwordHash(password, teacher.password_salt), teacher.password_hash);
}

async function createSession(role, teacher = null) {
  const token = randomBytes(32).toString('hex');
  await db.collection(SESSIONS).doc(sha256(token)).set({
    role,
    teacher_id: teacher?.id || '',
    teacher_name: teacher?.name || '管理员',
    created_at: Date.now(),
    expires_at: Date.now() + SESSION_MS,
  });
  return token;
}

async function validSession(token, allowedRoles = []) {
  if (!/^[0-9a-f]{64}$/i.test(String(token || ''))) return null;
  const id = sha256(token);
  const session = await getDocument(SESSIONS, id);
  if (!session || Number(session.expires_at) <= Date.now()) {
    if (session) await db.collection(SESSIONS).doc(id).remove().catch(() => undefined);
    return null;
  }
  if (allowedRoles.length && !allowedRoles.includes(session.role)) return null;
  return session;
}

function extensionFor(type) {
  if (String(type).includes('ogg')) return 'ogg';
  if (String(type).includes('mp4') || String(type).includes('m4a')) return 'm4a';
  if (String(type).includes('mpeg') || String(type).includes('mp3')) return 'mp3';
  if (String(type).includes('wav')) return 'wav';
  return 'webm';
}

function decodeAudio(audio) {
  const type = cleanText(audio?.type, 80) || 'audio/webm';
  const data = typeof audio?.data === 'string' ? audio.data : '';
  if (!type.startsWith('audio/') || !data || data.length > Math.ceil(MAX_AUDIO_BYTES * 4 / 3) + 8) return null;
  const buffer = Buffer.from(data, 'base64');
  if (!buffer.length || buffer.length > MAX_AUDIO_BYTES) return null;
  return { type, buffer };
}

function cleanWords(words) {
  if (!Array.isArray(words)) return [];
  return words.slice(0, 60).map((word) => ({
    id: cleanText(word?.id, 64) || randomUUID(),
    word: cleanText(word?.word, 80),
    meaning: cleanText(word?.meaning, 120),
    phonetic: cleanText(word?.phonetic, 80),
    example: cleanText(word?.example, 240),
    audio_file_id: cleanText(word?.audio_file_id, 500),
    audio_type: cleanText(word?.audio_type, 80),
    audio_source: cleanText(word?.audio_source, 100),
    source_url: cleanText(word?.source_url, 500),
  })).filter((word) => word.word);
}

function parseJson(value, fallback) {
  try { return JSON.parse(value); } catch { return fallback; }
}

function publicUnit(unit, audioUrls = new Map()) {
  const words = cleanWords(parseJson(unit.words_json || '[]', [])).map((word) => ({
    id: word.id, word: word.word, meaning: word.meaning, phonetic: word.phonetic,
    example: word.example, audioUrl: audioUrls.get(word.audio_file_id) || '',
  }));
  return {
    id: unit.id, title: unit.title, note: unit.note || '', shareCode: unit.share_code,
    teacherName: unit.teacher_name, wordCount: words.length, publishedAt: unit.published_at || null, words,
  };
}

async function temporaryUrlMap(fileIds) {
  const map = new Map();
  const unique = [...new Set(fileIds.filter(Boolean))];
  for (let index = 0; index < unique.length; index += 50) {
    const batch = unique.slice(index, index + 50);
    const result = await app.getTempFileURL({ fileList: batch });
    for (const item of result.fileList || []) map.set(item.fileID, item.tempFileURL || item.download_url || '');
  }
  return map;
}

function randomShareCode() {
  return randomBytes(4).toString('hex').toUpperCase();
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 9000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function cleanLookupTerm(value) {
  const term = cleanText(value, 60).toLowerCase();
  return /^[a-z][a-z' -]*$/.test(term) ? term.replace(/\s+/g, ' ') : '';
}

async function lookupDictionaryWord(term) {
  const endpoint = `https://dict.youdao.com/jsonapi?q=${encodeURIComponent(term)}`;
  const headers = { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0 JulyWordSoundLab/1.0' };
  const dictionaryResponse = await fetchWithTimeout(endpoint, { headers }, 8000);
  if (!dictionaryResponse.ok) throw new Error('词典中没有找到');
  const payload = await dictionaryResponse.json();
  const entry = payload?.ec?.word?.[0] || payload?.simple?.word?.[0];
  if (!entry) throw new Error('词典中没有找到');
  const audioUrl = `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(term)}&type=2`;
  const audioResponse = await fetchWithTimeout(audioUrl, { headers: { Accept: 'audio/*', 'User-Agent': headers['User-Agent'] } }, 8000);
  if (!audioResponse.ok) throw new Error('发音音频下载失败');
  const declaredSize = Number(audioResponse.headers.get('content-length') || 0);
  if (declaredSize > MAX_AUDIO_BYTES) throw new Error('发音音频过大');
  const buffer = Buffer.from(await audioResponse.arrayBuffer());
  if (!buffer.length || buffer.length > MAX_AUDIO_BYTES) throw new Error('发音音频无效');
  const definition = (entry.trs || []).flatMap((group) => group?.tr || []).flatMap((translation) => translation?.l?.i || []).filter((item) => typeof item === 'string').join('；');
  const example = cleanText(payload?.blng_sents_part?.['sentence-pair']?.[0]?.sentence, 240).replace(/<[^>]+>/g, '');
  return {
    word: cleanText(entry?.['return-phrase']?.l?.i || entry?.['return-phrase'] || term, 80),
    meaning: cleanText(definition, 120),
    phonetic: entry.usphone ? `/${cleanText(entry.usphone, 76)}/` : '',
    example: cleanText(example, 240),
    audioUrl,
    audioType: cleanText(audioResponse.headers.get('content-type') || 'audio/mpeg', 80),
    buffer,
    sourceUrl: endpoint,
  };
}

async function handleLogin(event, body) {
  if (!(await rateLimit(event, 'word-login', 12))) return response(event, 429, { ok: false, error: '尝试次数过多，请15分钟后再试。' });
  const mode = cleanText(body.mode, 12);
  if (mode === 'admin') {
    if (!adminPasswordMatches(body.password)) return response(event, 401, { ok: false, error: '管理员密码不正确。' });
    return response(event, 200, { ok: true, token: await createSession('admin'), role: 'admin', name: '管理员' });
  }
  const code = cleanCode(body.code);
  const teacher = code ? await findOne(TEACHERS, { code }) : null;
  if (!teacher || teacher.active !== true || !teacherPasswordMatches(body.password, teacher)) {
    return response(event, 401, { ok: false, error: '教师账号或密码不正确。' });
  }
  return response(event, 200, { ok: true, token: await createSession('teacher', teacher), role: 'teacher', name: teacher.name });
}

async function handleTeacherListUnits(event, body) {
  const session = await validSession(body.token, ['teacher', 'admin']);
  if (!session) return response(event, 401, { ok: false, error: '登录已失效，请重新登录。' });
  const teacherId = session.role === 'admin' ? cleanText(body.teacherId, 64) : session.teacher_id;
  if (!teacherId) return response(event, 400, { ok: false, error: '请选择教师。' });
  const result = await queryRows(UNITS, { teacher_id: teacherId }, 200);
  const parsedWords = result.map((unit) => cleanWords(parseJson(unit.words_json || '[]', [])));
  const urls = await temporaryUrlMap(parsedWords.flatMap((words) => words.map((word) => word.audio_file_id)));
  const rows = result.map((unit, index) => {
    const words = parsedWords[index].map((word) => ({ ...word, audioUrl: urls.get(word.audio_file_id) || '' }));
    return { ...unit, words, words_json: undefined, demoCount: words.filter((word) => word.audio_file_id).length };
  });
  rows.sort((left, right) => Number(right.updated_at || 0) - Number(left.updated_at || 0));
  return response(event, 200, { ok: true, rows });
}

async function handleTeacherSaveUnit(event, body) {
  const session = await validSession(body.token, ['teacher']);
  if (!session) return response(event, 401, { ok: false, error: '登录已失效，请重新登录。' });
  const title = cleanText(body.title, 100);
  const note = cleanText(body.note, 300);
  const words = cleanWords(body.words);
  if (!title || !words.length) return response(event, 400, { ok: false, error: '请填写单元名称并至少添加一个单词。' });
  const duplicate = new Set(words.map((word) => word.word.toLowerCase()));
  if (duplicate.size !== words.length) return response(event, 400, { ok: false, error: '同一单元中不能有重复单词。' });
  const now = Date.now();
  const id = cleanText(body.id, 64) || randomUUID();
  const existing = await getDocument(UNITS, id);
  if (existing && existing.teacher_id !== session.teacher_id) return response(event, 403, { ok: false, error: '无权修改此单元。' });
  let shareCode = existing?.share_code || '';
  if (!shareCode) {
    for (let tries = 0; tries < 8 && !shareCode; tries += 1) {
      const candidate = randomShareCode();
      if (!(await findOne(UNITS, { share_code: candidate }))) shareCode = candidate;
    }
  }
  if (!shareCode) return response(event, 500, { ok: false, error: '暂时无法生成单元代码，请重试。' });
  const record = {
    id, teacher_id: session.teacher_id, teacher_name: session.teacher_name,
    title, note, words_json: JSON.stringify(words), share_code: shareCode,
    status: existing?.status === 'published' ? 'draft' : (existing?.status || 'draft'),
    created_at: existing?.created_at || now, updated_at: now, published_at: existing?.published_at || null,
  };
  await db.collection(UNITS).doc(id).set(record);
  return response(event, 200, { ok: true, unit: { ...record, words, words_json: undefined, demoCount: words.filter((word) => word.audio_file_id).length } });
}

async function handleTeacherSmartImport(event, body) {
  const session = await validSession(body.token, ['teacher']);
  if (!session) return response(event, 401, { ok: false, error: '登录已失效，请重新登录。' });
  const title = cleanText(body.title, 100);
  const note = cleanText(body.note, 300);
  const rawEntries = Array.isArray(body.entries) ? body.entries : (Array.isArray(body.terms) ? body.terms : []);
  const entryMap = new Map();
  for (const item of rawEntries) {
    const term = cleanLookupTerm(typeof item === 'string' ? item : item?.term);
    if (term && !entryMap.has(term)) entryMap.set(term, { term, meaning: cleanText(item?.meaning, 120) });
  }
  const entries = [...entryMap.values()].slice(0, 25);
  if (!title || !entries.length) return response(event, 400, { ok: false, error: '请填写单元名称，并输入1—25个英文单词。' });
  const now = Date.now();
  const id = cleanText(body.id, 64) || randomUUID();
  const existing = await getDocument(UNITS, id);
  if (existing && existing.teacher_id !== session.teacher_id) return response(event, 403, { ok: false, error: '无权修改此单元。' });
  const existingWords = cleanWords(parseJson(existing?.words_json || '[]', []));
  const existingMap = new Map(existingWords.map((word) => [word.word.toLowerCase(), word]));
  const lookups = await Promise.all(entries.map(async ({ term, meaning: meaningOverride }) => {
    const saved = existingMap.get(term);
    if (saved?.audio_file_id) return { ok: true, word: { ...saved, meaning: meaningOverride || saved.meaning }, reused: true };
    try {
      const found = await lookupDictionaryWord(term);
      const cloudPath = `july-word-lab/dictionary/${session.teacher_id}/${id}/${sha256(`${term}-${found.audioUrl}`).slice(0, 20)}.${extensionFor(found.audioType)}`;
      const upload = await app.uploadFile({ cloudPath, fileContent: found.buffer });
      if (!upload.fileID) throw new Error('保存发音失败');
      return {
        ok: true,
        word: {
          id: saved?.id || randomUUID(), word: found.word || term, meaning: meaningOverride || found.meaning,
          phonetic: found.phonetic, example: found.example, audio_file_id: upload.fileID,
          audio_type: found.audioType, audio_source: 'Youdao Dictionary', source_url: found.sourceUrl,
        },
      };
    } catch (error) {
      return { ok: false, term, error: cleanText(error?.message || '自动获取失败', 100), word: saved || { id: randomUUID(), word: term, meaning: '', phonetic: '', example: '', audio_file_id: '', audio_type: '', audio_source: '', source_url: '' } };
    }
  }));
  const words = cleanWords(lookups.map((item) => item.word));
  let shareCode = existing?.share_code || '';
  if (!shareCode) {
    for (let tries = 0; tries < 8 && !shareCode; tries += 1) {
      const candidate = randomShareCode();
      if (!(await findOne(UNITS, { share_code: candidate }))) shareCode = candidate;
    }
  }
  if (!shareCode) return response(event, 500, { ok: false, error: '暂时无法生成单元代码，请重试。' });
  const record = {
    id, teacher_id: session.teacher_id, teacher_name: session.teacher_name,
    title, note, words_json: JSON.stringify(words), share_code: shareCode,
    status: existing?.status === 'published' ? 'draft' : (existing?.status || 'draft'),
    created_at: existing?.created_at || now, updated_at: now, published_at: existing?.published_at || null,
  };
  await db.collection(UNITS).doc(id).set(record);
  const keptIds = new Set(words.map((word) => word.audio_file_id).filter(Boolean));
  const removedFiles = existingWords.map((word) => word.audio_file_id).filter((fileId) => fileId && !keptIds.has(fileId));
  if (removedFiles.length) await app.deleteFile({ fileList: removedFiles }).catch(() => undefined);
  const failures = lookups.filter((item) => !item.ok).map((item) => ({ word: item.term, reason: item.error }));
  const urls = await temporaryUrlMap(words.map((word) => word.audio_file_id));
  const hydratedWords = words.map((word) => ({ ...word, audioUrl: urls.get(word.audio_file_id) || '' }));
  return response(event, 200, { ok: true, unit: { ...record, words: hydratedWords, words_json: undefined, demoCount: words.filter((word) => word.audio_file_id).length }, failures });
}

async function handleTeacherUploadReference(event, body) {
  const session = await validSession(body.token, ['teacher']);
  if (!session) return response(event, 401, { ok: false, error: '登录已失效，请重新登录。' });
  const unit = await getDocument(UNITS, cleanText(body.unitId, 64));
  if (!unit || unit.teacher_id !== session.teacher_id) return response(event, 404, { ok: false, error: '没有找到这个单元。' });
  const audio = decodeAudio(body.audio);
  if (!audio) return response(event, 400, { ok: false, error: '示范音频无效或超过2MB。' });
  const words = cleanWords(parseJson(unit.words_json || '[]', []));
  const wordIndex = words.findIndex((word) => word.id === cleanText(body.wordId, 64));
  if (wordIndex < 0) return response(event, 404, { ok: false, error: '没有找到这个单词。' });
  const oldFileId = words[wordIndex].audio_file_id;
  const cloudPath = `july-word-lab/reference/${session.teacher_id}/${unit.id}/${words[wordIndex].id}-${Date.now()}.${extensionFor(audio.type)}`;
  const upload = await app.uploadFile({ cloudPath, fileContent: audio.buffer });
  if (!upload.fileID) return response(event, 500, { ok: false, error: '示范音频上传失败，请重试。' });
  words[wordIndex].audio_file_id = upload.fileID;
  words[wordIndex].audio_type = audio.type;
  await db.collection(UNITS).doc(unit.id).update({ words_json: JSON.stringify(words), status: 'draft', updated_at: Date.now() });
  if (oldFileId) await app.deleteFile({ fileList: [oldFileId] }).catch(() => undefined);
  return response(event, 200, { ok: true, fileId: upload.fileID });
}

async function handleTeacherPublish(event, body) {
  const session = await validSession(body.token, ['teacher']);
  if (!session) return response(event, 401, { ok: false, error: '登录已失效，请重新登录。' });
  const unit = await getDocument(UNITS, cleanText(body.unitId, 64));
  if (!unit || unit.teacher_id !== session.teacher_id) return response(event, 404, { ok: false, error: '没有找到这个单元。' });
  const words = cleanWords(parseJson(unit.words_json || '[]', []));
  const missing = words.filter((word) => !word.audio_file_id).map((word) => word.word);
  if (missing.length) return response(event, 400, { ok: false, error: `这些单词还没有自动获取到词典发音，请检查拼写后重新智能添加：${missing.slice(0, 8).join('、')}${missing.length > 8 ? '等' : ''}` });
  const publishedAt = Date.now();
  await db.collection(UNITS).doc(unit.id).update({ status: 'published', published_at: publishedAt, updated_at: publishedAt });
  return response(event, 200, { ok: true, shareCode: unit.share_code });
}

async function handleStudentGetUnit(event, body) {
  const shareCode = cleanText(body.shareCode, 20).toUpperCase().replace(/[^A-Z0-9]/g, '');
  const unit = shareCode ? await findOne(UNITS, { share_code: shareCode, status: 'published' }) : null;
  if (!unit) return response(event, 404, { ok: false, error: '没有找到已发布的单元，请检查链接或单元代码。' });
  const words = cleanWords(parseJson(unit.words_json || '[]', []));
  const urls = await temporaryUrlMap(words.map((word) => word.audio_file_id));
  return response(event, 200, { ok: true, unit: publicUnit(unit, urls) });
}

async function handleStudentStart(event, body) {
  if (!(await rateLimit(event, 'word-start', 30))) return response(event, 429, { ok: false, error: '操作太频繁，请稍后再试。' });
  const unit = await findOne(UNITS, { share_code: cleanText(body.shareCode, 20).toUpperCase(), status: 'published' });
  const studentName = cleanText(body.studentName, 40);
  const className = cleanText(body.className, 80);
  if (!unit || !studentName || !className || body.recordingConsent !== true) {
    return response(event, 400, { ok: false, error: '请填写姓名和班级，并同意上传本次练习录音。' });
  }
  const id = randomUUID();
  const submitToken = randomBytes(24).toString('hex');
  await db.collection(ATTEMPTS).doc(id).set({
    id, unit_id: unit.id, unit_title: unit.title, teacher_id: unit.teacher_id, teacher_name: unit.teacher_name,
    student_name: studentName, class_name: className, status: 'practicing',
    results_json: '[]', submit_token_hash: sha256(submitToken), started_at: Date.now(), submitted_at: null,
  });
  return response(event, 200, { ok: true, attemptId: id, submitToken });
}

function levenshtein(a, b) {
  const matrix = Array.from({ length: b.length + 1 }, (_, row) => [row]);
  for (let column = 0; column <= a.length; column += 1) matrix[0][column] = column;
  for (let row = 1; row <= b.length; row += 1) {
    for (let column = 1; column <= a.length; column += 1) {
      matrix[row][column] = b[row - 1] === a[column - 1]
        ? matrix[row - 1][column - 1]
        : Math.min(matrix[row - 1][column - 1], matrix[row][column - 1], matrix[row - 1][column]) + 1;
    }
  }
  return matrix[b.length][a.length];
}

function scoreRecognition(target, transcript, confidence) {
  const normalize = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9']/g, '');
  const expected = normalize(target);
  const heard = normalize(transcript);
  if (!expected || !heard) return 0;
  const similarity = Math.max(0, 1 - levenshtein(expected, heard) / Math.max(expected.length, heard.length, 1));
  const exact = expected === heard || heard.includes(expected);
  const confidencePart = Math.max(0, Math.min(1, Number(confidence) || 0));
  return Math.round(Math.min(100, exact ? 88 + confidencePart * 12 : similarity * 75 + confidencePart * 20));
}

async function studentAttempt(body) {
  const attempt = await getDocument(ATTEMPTS, cleanText(body.attemptId, 64));
  const token = cleanText(body.submitToken, 100);
  if (!attempt || !token || !safeEqualHex(sha256(token), attempt.submit_token_hash)) return null;
  return attempt;
}

async function handleStudentSubmitWord(event, body) {
  if (!(await rateLimit(event, 'word-audio', 100))) return response(event, 429, { ok: false, error: '上传太频繁，请稍后再试。' });
  const attempt = await studentAttempt(body);
  if (!attempt || attempt.status === 'completed') return response(event, 401, { ok: false, error: '本次练习已失效，请重新进入单元。' });
  const unit = await getDocument(UNITS, attempt.unit_id);
  const words = cleanWords(parseJson(unit?.words_json || '[]', []));
  const word = words.find((item) => item.id === cleanText(body.wordId, 64));
  const audio = decodeAudio(body.audio);
  if (!word || !audio) return response(event, 400, { ok: false, error: '录音无效或超过2MB，请重新录制。' });
  const transcript = cleanText(body.transcript, 120);
  const confidence = Math.max(0, Math.min(1, Number(body.confidence) || 0));
  const selfRating = cleanInt(body.selfRating, 1, 3, 2);
  const score = scoreRecognition(word.word, transcript, confidence);
  const results = Array.isArray(parseJson(attempt.results_json || '[]', [])) ? parseJson(attempt.results_json || '[]', []) : [];
  const existing = results.find((item) => item.word_id === word.id);
  const oldFileId = existing?.audio_file_id || '';
  const cloudPath = `july-word-lab/student/${attempt.teacher_id}/${attempt.unit_id}/${attempt.id}/${word.id}-${Date.now()}.${extensionFor(audio.type)}`;
  const upload = await app.uploadFile({ cloudPath, fileContent: audio.buffer });
  if (!upload.fileID) return response(event, 500, { ok: false, error: '录音上传失败，请检查网络后重试。' });
  const next = {
    word_id: word.id, word: word.word, transcript, confidence: Math.round(confidence * 100),
    system_score: score, self_rating: selfRating, audio_file_id: upload.fileID, audio_type: audio.type,
    recorded_at: Date.now(),
  };
  const nextResults = [...results.filter((item) => item.word_id !== word.id), next];
  await db.collection(ATTEMPTS).doc(attempt.id).update({ results_json: JSON.stringify(nextResults) });
  if (oldFileId) await app.deleteFile({ fileList: [oldFileId] }).catch(() => undefined);
  const advice = !transcript ? '系统没有识别到单词，请靠近麦克风、放慢速度后再试。'
    : score >= 88 ? '识别很清楚，可以继续保持自然重音。'
      : score >= 65 ? '基本识别正确，建议再听一次示范并完整读出每个音节。'
        : '与目标词差异较大，请先听示范，再分音节慢读。';
  return response(event, 200, { ok: true, score, advice, transcript });
}

async function handleStudentComplete(event, body) {
  const attempt = await studentAttempt(body);
  if (!attempt) return response(event, 401, { ok: false, error: '本次练习已失效，请重新进入单元。' });
  const unit = await getDocument(UNITS, attempt.unit_id);
  const words = cleanWords(parseJson(unit?.words_json || '[]', []));
  const results = parseJson(attempt.results_json || '[]', []);
  if (!Array.isArray(results) || results.length < words.length) return response(event, 400, { ok: false, error: '请完成本单元全部单词后再提交。' });
  const averageScore = Math.round(results.reduce((sum, item) => sum + Number(item.system_score || 0), 0) / results.length);
  const averageSelf = Number((results.reduce((sum, item) => sum + Number(item.self_rating || 0), 0) / results.length).toFixed(1));
  const submittedAt = Date.now();
  await db.collection(ATTEMPTS).doc(attempt.id).update({ status: 'completed', average_score: averageScore, average_self: averageSelf, submitted_at: submittedAt });
  return response(event, 200, { ok: true, averageScore, averageSelf, wordCount: results.length });
}

async function hydrateAttempts(rows) {
  const parsed = rows.map((row) => Array.isArray(parseJson(row.results_json || '[]', [])) ? parseJson(row.results_json || '[]', []) : []);
  const urls = await temporaryUrlMap(parsed.flatMap((results) => results.map((item) => item.audio_file_id)));
  return rows.map((row, index) => ({
    ...row,
    submit_token_hash: undefined,
    results: parsed[index].map((item) => ({ ...item, audioUrl: urls.get(item.audio_file_id) || '', audio_file_id: undefined })),
    results_json: undefined,
  }));
}

async function handleListAttempts(event, body) {
  const session = await validSession(body.token, ['teacher', 'admin']);
  if (!session) return response(event, 401, { ok: false, error: '登录已失效，请重新登录。' });
  const where = { status: 'completed' };
  const result = await queryRows(ATTEMPTS, where, 500);
  result.sort((left, right) => Number(right.submitted_at || 0) - Number(left.submitted_at || 0));
  return response(event, 200, { ok: true, rows: await hydrateAttempts(result) });
}

async function handleAdminListTeachers(event, body) {
  const session = await validSession(body.token, ['admin']);
  if (!session) return response(event, 401, { ok: false, error: '管理员登录已失效。' });
  const result = await queryRows(TEACHERS, {}, 200);
  const rows = result.sort((left, right) => Number(left.created_at || 0) - Number(right.created_at || 0)).map(({ password_hash, password_salt, ...teacher }) => teacher);
  return response(event, 200, { ok: true, rows });
}

async function handleAdminCreateTeacher(event, body) {
  const session = await validSession(body.token, ['admin']);
  if (!session) return response(event, 401, { ok: false, error: '管理员登录已失效。' });
  const name = cleanText(body.name, 60);
  const code = cleanCode(body.code);
  const password = typeof body.password === 'string' ? body.password : '';
  if (!name || code.length < 3 || password.length < 8) return response(event, 400, { ok: false, error: '教师代码至少3位，密码至少8位。' });
  if (await findOne(TEACHERS, { code })) return response(event, 409, { ok: false, error: '教师代码已存在。' });
  const id = `teacher-${randomUUID()}`;
  const salt = randomBytes(16).toString('hex');
  await db.collection(TEACHERS).doc(id).set({ id, name, code, password_salt: salt, password_hash: passwordHash(password, salt), active: true, created_at: Date.now() });
  return response(event, 200, { ok: true, id });
}

async function handleAdminResetTeacher(event, body) {
  const session = await validSession(body.token, ['admin']);
  if (!session) return response(event, 401, { ok: false, error: '管理员登录已失效。' });
  const teacher = await getDocument(TEACHERS, cleanText(body.teacherId, 80));
  const password = typeof body.password === 'string' ? body.password : '';
  if (!teacher || password.length < 8) return response(event, 400, { ok: false, error: '新密码至少8位。' });
  const salt = randomBytes(16).toString('hex');
  await db.collection(TEACHERS).doc(teacher.id).update({ password_salt: salt, password_hash: passwordHash(password, salt) });
  return response(event, 200, { ok: true });
}

async function handleAdminSetTeacherActive(event, body) {
  const session = await validSession(body.token, ['admin']);
  if (!session) return response(event, 401, { ok: false, error: '管理员登录已失效。' });
  const teacher = await getDocument(TEACHERS, cleanText(body.teacherId, 80));
  if (!teacher) return response(event, 404, { ok: false, error: '没有找到教师。' });
  await db.collection(TEACHERS).doc(teacher.id).update({ active: body.active === true });
  return response(event, 200, { ok: true });
}

async function handleAdminDeleteUnit(event, body) {
  const session = await validSession(body.token, ['admin']);
  if (!session) return response(event, 401, { ok: false, error: '管理员登录已失效。' });
  const unit = await getDocument(UNITS, cleanText(body.unitId, 80));
  if (!unit) return response(event, 404, { ok: false, error: '没有找到单元。' });
  const attempts = await queryRows(ATTEMPTS, { unit_id: unit.id }, 1);
  if (attempts.length) return response(event, 409, { ok: false, error: '已有学生数据的单元不能删除。' });
  const files = cleanWords(parseJson(unit.words_json || '[]', [])).map((word) => word.audio_file_id).filter(Boolean);
  await db.collection(UNITS).doc(unit.id).remove();
  if (files.length) await app.deleteFile({ fileList: files }).catch(() => undefined);
  return response(event, 200, { ok: true });
}

exports.main = async (event) => {
  if (String(event.httpMethod || '').toUpperCase() === 'OPTIONS') return response(event, 204, {});
  try {
    await ensureCollections();
    const body = parseBody(event);
    const action = cleanText(body.action, 50);
    if (action === 'login') return handleLogin(event, body);
    if (action === 'session') {
      const session = await validSession(body.token, ['teacher', 'admin']);
      return response(event, session ? 200 : 401, session ? { ok: true, role: session.role, name: session.teacher_name, teacherId: session.teacher_id } : { ok: false, error: '登录已失效。' });
    }
    if (action === 'logout') {
      if (/^[0-9a-f]{64}$/i.test(String(body.token || ''))) await db.collection(SESSIONS).doc(sha256(body.token)).remove().catch(() => undefined);
      return response(event, 200, { ok: true });
    }
    if (action === 'teacherListUnits') return handleTeacherListUnits(event, body);
    if (action === 'teacherSaveUnit') return handleTeacherSaveUnit(event, body);
    if (action === 'teacherSmartImport') return handleTeacherSmartImport(event, body);
    if (action === 'teacherUploadReference') return handleTeacherUploadReference(event, body);
    if (action === 'teacherPublishUnit') return handleTeacherPublish(event, body);
    if (action === 'studentGetUnit') return handleStudentGetUnit(event, body);
    if (action === 'studentStart') return handleStudentStart(event, body);
    if (action === 'studentSubmitWord') return handleStudentSubmitWord(event, body);
    if (action === 'studentComplete') return handleStudentComplete(event, body);
    if (action === 'listAttempts') return handleListAttempts(event, body);
    if (action === 'adminListTeachers') return handleAdminListTeachers(event, body);
    if (action === 'adminCreateTeacher') return handleAdminCreateTeacher(event, body);
    if (action === 'adminResetTeacher') return handleAdminResetTeacher(event, body);
    if (action === 'adminSetTeacherActive') return handleAdminSetTeacherActive(event, body);
    if (action === 'adminDeleteUnit') return handleAdminDeleteUnit(event, body);
    return response(event, 404, { ok: false, error: '未知操作。' });
  } catch (error) {
    console.error('wordLab API failed', error?.stack || error?.message || error);
    return response(event, 500, { ok: false, error: '服务暂时不可用，请稍后重试。' });
  }
};
