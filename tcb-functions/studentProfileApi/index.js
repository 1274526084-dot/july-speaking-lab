/* oxlint-disable typescript/no-require-imports */
const cloudbase = require('@cloudbase/node-sdk');
const { createHash, pbkdf2Sync, randomBytes, timingSafeEqual } = require('node:crypto');

const app = cloudbase.init({ env: cloudbase.SYMBOL_CURRENT_ENV });
const db = app.database();

const PROFILES = 'english_learning_profiles';
const SESSIONS = 'english_profile_sessions';
const RATES = 'english_profile_rates';
const SESSION_MS = 8 * 60 * 60 * 1000;
const AUTH_VERSION = 1;
const JULY_SALT = '9f5aa832e98332de5c2ef9c43cdcd8e7';
const JULY_HASH = '67d2ae9f437bc88b6a5c2fe7c99c4342d76ab1bc3232f6c2ab012f88c4cf3999';
const SKILLS = ['listening', 'speaking', 'reading', 'writing', 'vocabulary', 'grammar', 'pronunciation'];
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
  return typeof value === 'string' ? value.trim().replace(/[\u0000-\u001f\u007f]/g, '').slice(0, max) : '';
}

function cleanInt(value, min, max, fallback = min) {
  const number = Math.round(Number(value));
  return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback;
}

function cleanScore(value, min, max) {
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max ? Math.round(number * 10) / 10 : null;
}

function cleanArray(value, maxItems = 12, maxText = 80) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => cleanText(item, maxText)).filter(Boolean))].slice(0, maxItems);
}

function sha256(value) {
  return createHash('sha256').update(String(value)).digest('hex');
}

function passwordHash(password, salt) {
  return pbkdf2Sync(password, salt, 210000, 32, 'sha256').toString('hex');
}

function safeEqualHex(left, right) {
  try {
    const a = Buffer.from(left, 'hex'); const b = Buffer.from(right, 'hex');
    return a.length === b.length && timingSafeEqual(a, b);
  } catch { return false; }
}

function isCollectionExistsError(error) {
  const value = `${error?.code || ''} ${error?.message || ''}`.toLowerCase();
  return value.includes('exist') || value.includes('已存在') || value.includes('-502005');
}

async function ensureCollections() {
  if (!collectionsReady) {
    collectionsReady = (async () => {
      for (const name of [PROFILES, SESSIONS, RATES]) {
        try { await db.createCollection(name); }
        catch (error) { if (!isCollectionExistsError(error)) throw error; }
      }
    })();
  }
  return collectionsReady;
}

async function getDocument(collection, id) {
  try {
    const result = await db.collection(collection).doc(id).get();
    return Array.isArray(result.data) ? result.data[0] || null : result.data || null;
  } catch { return null; }
}

function clientIp(event) {
  const headers = headersFrom(event);
  return String(event.requestContext?.sourceIp || headers['x-forwarded-for'] || headers['x-real-ip'] || 'unknown').split(',')[0].trim();
}

async function rateLimit(event, scope, max = 20) {
  const id = `${scope}-${sha256(clientIp(event)).slice(0, 48)}`;
  const now = Date.now(); const current = await getDocument(RATES, id);
  const active = current && Number(current.reset_at) > now;
  const count = active ? Number(current.count || 0) + 1 : 1;
  await db.collection(RATES).doc(id).set({ count, reset_at: active ? Number(current.reset_at) : now + 15 * 60 * 1000 });
  return count <= max;
}

async function createSession() {
  const token = randomBytes(32).toString('hex');
  await db.collection(SESSIONS).doc(sha256(token)).set({ auth_version: AUTH_VERSION, teacher_code: 'july', teacher_name: 'July', created_at: Date.now(), expires_at: Date.now() + SESSION_MS });
  return token;
}

async function validSession(token) {
  if (!/^[0-9a-f]{64}$/i.test(String(token || ''))) return null;
  const id = sha256(token); const session = await getDocument(SESSIONS, id);
  if (!session || session.auth_version !== AUTH_VERSION || Number(session.expires_at) <= Date.now()) {
    if (session) await db.collection(SESSIONS).doc(id).remove().catch(() => undefined);
    return null;
  }
  return session;
}

function normalizeIdentity(value) {
  return cleanText(value, 80).toLocaleLowerCase('zh-CN').replace(/[\s_-]+/g, '');
}

function sanitizeProfile(raw) {
  const studentName = cleanText(raw?.studentName, 30);
  const className = cleanText(raw?.className, 50);
  const major = cleanText(raw?.major, 60);
  const legacyRequest = raw?.gaokaoKnown !== undefined || raw?.gaokaoScore !== undefined;
  const admissionType = raw?.admissionType === 'single' || raw?.admissionType === 'gaokao' ? raw.admissionType : legacyRequest ? 'gaokao' : '';
  const entranceScoreKnown = raw?.entranceScoreKnown === true || (raw?.entranceScoreKnown === undefined && raw?.gaokaoKnown === true);
  const rawScore = raw?.entranceScore ?? raw?.gaokaoScore;
  const rawFullScore = raw?.entranceFullScore ?? (admissionType === 'gaokao' ? 150 : null);
  const entranceEnglishScore = entranceScoreKnown ? cleanScore(rawScore, 0, 1000) : null;
  const entranceEnglishFullScore = entranceScoreKnown ? cleanScore(rawFullScore, 1, 1000) : null;
  const entranceScoreValid = !entranceScoreKnown || (entranceEnglishScore !== null && entranceEnglishFullScore !== null && entranceEnglishScore <= entranceEnglishFullScore);
  const entranceEnglishPercent = entranceScoreValid && entranceScoreKnown
    ? Math.round((entranceEnglishScore / entranceEnglishFullScore) * 1000) / 10
    : null;
  const skills = Object.fromEntries(SKILLS.map((key) => [key, cleanInt(raw?.skills?.[key], 1, 5, 3)]));
  return {
    student_name: studentName,
    class_name: className,
    major,
    admission_type: admissionType,
    entrance_score_known: entranceScoreKnown,
    entrance_english_score: entranceScoreValid ? entranceEnglishScore : null,
    entrance_english_full_score: entranceScoreValid ? entranceEnglishFullScore : null,
    entrance_english_percent: entranceScoreValid ? entranceEnglishPercent : null,
    entrance_score_valid: entranceScoreValid,
    // Keep legacy fields so older teacher pages and previously cached student pages remain compatible.
    gaokao_known: admissionType === 'gaokao' && entranceScoreKnown && entranceScoreValid,
    gaokao_score: admissionType === 'gaokao' && entranceScoreKnown && entranceScoreValid ? entranceEnglishScore : null,
    skills,
    confidence: cleanInt(raw?.confidence, 1, 5, 3),
    speaking_anxiety: cleanInt(raw?.speakingAnxiety, 1, 5, 3),
    english_interest: cleanInt(raw?.englishInterest, 1, 5, 3),
    weekly_time: cleanText(raw?.weeklyTime, 40),
    current_habits: cleanArray(raw?.currentHabits),
    learning_goals: cleanArray(raw?.learningGoals),
    preferred_activities: cleanArray(raw?.preferredActivities),
    difficulties: cleanArray(raw?.difficulties),
    major_reasons: cleanArray(raw?.majorReasons, 3),
    school_reasons: cleanArray(raw?.schoolReasons, 3),
    career_plan: cleanText(raw?.careerPlan, 80),
    semester_goal: cleanText(raw?.semesterGoal, 180),
    teacher_message: cleanText(raw?.teacherMessage, 240),
    device_ready: cleanText(raw?.deviceReady, 80),
  };
}

function publicProfile(row) {
  const parse = (value, fallback) => { try { return JSON.parse(value); } catch { return fallback; } };
  const admissionType = row.admission_type === 'single' ? 'single' : 'gaokao';
  const entranceScoreKnown = row.entrance_score_known === undefined
    ? row.gaokao_known === true
    : row.entrance_score_known === true;
  const entranceEnglishScore = row.entrance_english_score == null
    ? (row.gaokao_score == null ? null : Number(row.gaokao_score))
    : Number(row.entrance_english_score);
  const entranceEnglishFullScore = row.entrance_english_full_score == null
    ? (entranceScoreKnown && admissionType === 'gaokao' ? 150 : null)
    : Number(row.entrance_english_full_score);
  const entranceEnglishPercent = entranceScoreKnown && entranceEnglishScore !== null && entranceEnglishFullScore
    ? Math.round((entranceEnglishScore / entranceEnglishFullScore) * 1000) / 10
    : null;
  return {
    id: row.id,
    student_name: row.student_name,
    class_name: row.class_name,
    major: row.major,
    admission_type: admissionType,
    entrance_score_known: entranceScoreKnown,
    entrance_english_score: entranceEnglishScore,
    entrance_english_full_score: entranceEnglishFullScore,
    entrance_english_percent: entranceEnglishPercent,
    gaokao_known: row.gaokao_known === true,
    gaokao_score: row.gaokao_score == null ? null : Number(row.gaokao_score),
    skills: parse(row.skills_json || '{}', {}),
    confidence: Number(row.confidence || 3),
    speaking_anxiety: Number(row.speaking_anxiety || 3),
    english_interest: Number(row.english_interest || 3),
    weekly_time: row.weekly_time || '',
    current_habits: parse(row.current_habits_json || '[]', []),
    learning_goals: parse(row.learning_goals_json || '[]', []),
    preferred_activities: parse(row.preferred_activities_json || '[]', []),
    difficulties: parse(row.difficulties_json || '[]', []),
    major_reasons: parse(row.major_reasons_json || '[]', []),
    school_reasons: parse(row.school_reasons_json || '[]', []),
    career_plan: row.career_plan || '',
    semester_goal: row.semester_goal || '',
    teacher_message: row.teacher_message || '',
    device_ready: row.device_ready || '',
    submitted_at: Number(row.submitted_at || 0),
    updated_at: Number(row.updated_at || 0),
  };
}

async function handleSubmit(event, body) {
  if (!(await rateLimit(event, 'profile-submit', 20))) return response(event, 429, { ok: false, error: '提交次数较多，请稍后再试。' });
  const profile = sanitizeProfile(body.profile || {});
  if (!profile.student_name || !profile.class_name || !profile.major || !profile.admission_type || !profile.entrance_score_valid || !profile.weekly_time || !profile.learning_goals.length || !profile.major_reasons.length || !profile.school_reasons.length || !profile.device_ready) {
    return response(event, 400, { ok: false, error: '还有必填问题未完成，请检查后再提交。' });
  }
  const id = `profile-${sha256(`${normalizeIdentity(profile.class_name)}|${normalizeIdentity(profile.student_name)}`).slice(0, 48)}`;
  const now = Date.now(); const existing = await getDocument(PROFILES, id);
  const row = {
    id,
    ...profile,
    skills_json: JSON.stringify(profile.skills),
    current_habits_json: JSON.stringify(profile.current_habits),
    learning_goals_json: JSON.stringify(profile.learning_goals),
    preferred_activities_json: JSON.stringify(profile.preferred_activities),
    difficulties_json: JSON.stringify(profile.difficulties),
    major_reasons_json: JSON.stringify(profile.major_reasons),
    school_reasons_json: JSON.stringify(profile.school_reasons),
    created_at: Number(existing?.created_at || now),
    submitted_at: Number(existing?.submitted_at || now),
    updated_at: now,
  };
  delete row.skills;
  delete row.current_habits;
  delete row.learning_goals;
  delete row.preferred_activities;
  delete row.difficulties;
  delete row.major_reasons;
  delete row.school_reasons;
  delete row.entrance_score_valid;
  await db.collection(PROFILES).doc(id).set(row);
  return response(event, 200, { ok: true, id, profileKey: id.slice(8) });
}

async function handleLogin(event, body) {
  if (!(await rateLimit(event, 'profile-login', 15))) return response(event, 429, { ok: false, error: '尝试次数较多，请15分钟后再试。' });
  const code = cleanText(body.code, 20).toLowerCase();
  const password = typeof body.password === 'string' ? body.password : '';
  const valid = code === 'july' && password.length >= 8 && safeEqualHex(passwordHash(password, JULY_SALT), JULY_HASH);
  if (!valid) return response(event, 401, { ok: false, error: '教师账号或密码不正确。' });
  const token = await createSession();
  return response(event, 200, { ok: true, token, name: 'July' });
}

async function handleList(event, body) {
  const session = await validSession(body.token);
  if (!session) return response(event, 401, { ok: false, error: '登录已失效，请重新登录。' });
  const result = await db.collection(PROFILES).orderBy('updated_at', 'desc').limit(1000).get();
  const rows = Array.isArray(result.data) ? result.data.map(publicProfile) : [];
  return response(event, 200, { ok: true, rows, updatedAt: Date.now() });
}

exports.main = async (event) => {
  if (String(event.httpMethod || '').toUpperCase() === 'OPTIONS') return response(event, 204, {});
  try {
    await ensureCollections();
    const body = parseBody(event); const action = cleanText(body.action, 40);
    if (action === 'submitProfile') return handleSubmit(event, body);
    if (action === 'teacherLogin') return handleLogin(event, body);
    if (action === 'session') {
      const session = await validSession(body.token);
      return response(event, session ? 200 : 401, session ? { ok: true, name: session.teacher_name } : { ok: false, error: '登录已失效，请重新登录。' });
    }
    if (action === 'listProfiles') return handleList(event, body);
    if (action === 'logout') {
      if (/^[0-9a-f]{64}$/i.test(String(body.token || ''))) await db.collection(SESSIONS).doc(sha256(body.token)).remove().catch(() => undefined);
      return response(event, 200, { ok: true });
    }
    return response(event, 404, { ok: false, error: '未知操作。' });
  } catch (error) {
    console.error('studentProfileApi failed', error?.message || error);
    return response(event, 500, { ok: false, error: '服务暂时不可用，请稍后重试。' });
  }
};
