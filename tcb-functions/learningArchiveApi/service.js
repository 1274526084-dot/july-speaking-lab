/* oxlint-disable typescript/no-require-imports */
const { createHash, randomBytes, randomUUID, randomInt, timingSafeEqual } = require('node:crypto');
const { createSchoolClassDirectory: createClassDirectory, projectSchoolRecord, CLASS_NORMALIZATION_VERSION } = require('./school-classes');
const { CLASS_CATALOG } = require('./class-catalog');
const { gradeUnit2, unit2Summary } = require('./unit2');
const { gradeLesson3 } = require('./lesson3');
const { position, courseCatalog, lessonProgress } = require('./course');

const PROJECT_ID = 'lzrtc-public-english-2026';
const TEACHERS = new Set(['cherie', 'lisa', 'alice', 'july']);
const SKILLS = ['listening', 'speaking', 'reading', 'writing', 'vocabulary', 'grammar', 'pronunciation'];
const COLLECTIONS = Object.freeze({
  students: 'english_archive_students', requests: 'english_archive_access_requests',
  sessions: 'english_archive_sessions', reflections: 'english_archive_reflections',
  tasks: 'english_archive_tasks', news: 'english_archive_news',
  submissions: 'english_archive_quiz_submissions', rates: 'english_archive_rates',
  unit2: 'english_archive_unit2_attempts',
  classNormalization: 'english_archive_class_normalization',
  courseUnits: 'english_archive_course_units',
  practiceSessions: 'english_archive_practice_sessions',
  practiceAttempts: 'english_archive_practice_attempts',
});
const LEGACY = Object.freeze({ profiles: 'english_learning_profiles', words: 'word_attempts', speaking: 'speaking_attempts' });
const DAY = 24 * 60 * 60 * 1000;
const MAX_ROWS = 10000;
// The installed server SDK permits up to 1,000 records per query.
const PAGE_SIZE = 1000;
const PAGE_CONCURRENCY = 4;
const AUDIO_SECONDS = 300;
const ALLOWED_ORIGINS = new Set([
  'https://1274526084-dot.github.io', 'http://localhost:4173',
  'http://localhost:5173', 'http://localhost:5179',
  'http://127.0.0.1:5173', 'http://127.0.0.1:5179',
]);

class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const fail = (status, message) => { throw new ApiError(status, message); };
const hash = value => createHash('sha256').update(String(value)).digest('hex');
// oxlint-disable-next-line no-control-regex -- Request text must not retain control characters.
const text = (value, max = 120) => typeof value === 'string' ? value.trim().replace(/[\u0000-\u001f\u007f]/g, '').slice(0, max) : '';
const normalizeName = value => text(value, 60).normalize('NFKC').toLocaleLowerCase('zh-CN').replace(/\s+/g, '');
const validToken = value => typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);
const tagged = row => row?.project_id === PROJECT_ID;
const foreign = row => /malaysia|malaysian|马来西亚/i.test(`${row?.country || ''}${row?.region || ''}${row?.source || ''}`);
const scoped = (row, kind) => {
  if (foreign(row)) return false;
  if (!text(row?.student_name, 60) || !text(row?.class_name, 100)) return false;
  if (row?.project_id) return tagged(row);
  if (!row?.student_name || !row?.class_name || foreign(row)) return false;
  if (kind === 'profiles') return Boolean(row.major && (['gaokao', 'single'].includes(row.admission_type) || row.gaokao_known !== undefined));
  if (kind === 'words') return Boolean(row.unit_id && row.status === 'completed' && typeof row.results_json === 'string');
  return Boolean(row.scene_id && row.student_id);
};
function equalHash(left, right) {
  if (!validToken(left) || !validToken(right)) return false;
  return timingSafeEqual(Buffer.from(left, 'hex'), Buffer.from(right, 'hex'));
}
function parse(value, fallback) {
  if (typeof value !== 'string') return value == null ? fallback : value;
  try { return JSON.parse(value); } catch { return fallback; }
}
function array(value) { const decoded = parse(value, []); return Array.isArray(decoded) ? decoded : []; }
function score(value) { return value == null || value === '' || !Number.isFinite(Number(value)) ? null : Math.max(0, Math.min(100, Number(value))); }
function timestamp(row) { return Number(row.submitted_at || row.updated_at || row.created_at || 0); }
function mean(rows) {
  const values = rows.map(row => row.score).filter(value => value !== null && Number.isFinite(value));
  return values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length * 10) / 10 : null;
}
function safeUrl(value, required = false) {
  const candidate = text(value, 2000);
  if (!candidate && !required) return '';
  try {
    const url = new URL(candidate);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('url');
    return url.href;
  } catch { fail(400, '链接必须是完整的 http 或 https 地址。'); }
}
function requiredText(value, label, max) {
  const result = text(value, max);
  if (!result || typeof value !== 'string' || value.trim().length > max) fail(400, `${label}未填写或超过${max}字。`);
  return result;
}
function skillsValue(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(400, '请完成七项能力自评。');
  const result = {};
  for (const key of SKILLS) {
    if (!Number.isInteger(value[key]) || value[key] < 1 || value[key] > 5) fail(400, '能力自评分数须为1至5。');
    result[key] = value[key];
  }
  return result;
}
function publicProfile(row) {
  if (!row) return null;
  const strings = ['college', 'major', 'admission_type', 'weekly_time', 'career_plan', 'semester_goal', 'teacher_message', 'device_ready'];
  const lists = ['current_habits', 'learning_goals', 'preferred_activities', 'difficulties', 'major_reasons', 'school_reasons'];
  const result = { id: row.id || row._id, student_name: text(row.student_name, 60), class_name: text(row.class_name, 100), skills: parse(row.skills_json || row.skills, {}), submitted_at: Number(row.submitted_at || 0), updated_at: Number(row.updated_at || 0) };
  for (const key of strings) result[key] = text(row[key], 1000);
  for (const key of lists) result[key] = array(row[`${key}_json`] || row[key]).map(item => text(item, 300)).slice(0, 30);
  for (const key of ['confidence', 'speaking_anxiety', 'english_interest', 'entrance_english_score', 'entrance_english_full_score', 'entrance_english_percent', 'gaokao_score']) result[key] = row[key] == null ? null : Number(row[key]);
  result.entrance_score_known = row.entrance_score_known === true || row.gaokao_known === true;
  return result;
}
function publicTask(row, teacher = false) {
  return {
    id: row.id || row._id, title: row.title, unit: row.unit || '', lesson: row.lesson || '', type: row.type,
    description: row.description || '', href: row.href || '', classes: row.classes || [], dueAt: row.due_at ?? null,
    status: row.status, courseLocked: Boolean(row.course_locked || row.status === 'published'), material: row.material || '', creator: row.creator, creatorName: row.creator_name,
    createdAt: row.created_at, updatedAt: row.updated_at, version: row.version ?? row.updated_at,
    questions: (row.questions || []).map(question => ({ id: question.id, prompt: question.prompt, options: question.options, ...(teacher ? { answer: question.answer, explanation: question.explanation } : {}) })),
  };
}
function publicNews(row) {
  return { id: row.id || row._id, title: row.title, summary: row.summary || '', url: row.url || '', source: row.source || '', publishedDate: row.published_date || '', vocabulary: row.vocabulary || [], question: row.question || '', status: row.status, creator: row.creator, creatorName: row.creator_name, createdAt: row.created_at, updatedAt: row.updated_at };
}
function publicStudent(student) {
  const view = projectSchoolRecord({ ...student, student_name: student.name });
  return { id: student.id, name: view.student_name, className: view.class_name, college: view.normalized_college, rawName: view.raw_student_name, rawClassName: view.raw_class_name };
}
function publicRequest(row, now) {
  return { id: row.id, name: row.name, className: row.class_name, status: row.status === 'pending' && row.expires_at <= now ? 'expired' : row.status, createdAt: row.created_at, expiresAt: row.expires_at, approvedAt: row.approved_at || null, approvedBy: row.approved_by || null, studentId: row.student_id || null, practiceCount: row.practice_count || 0, practiceScores: Object.values(row.practice_scores || {}) };
}

function createApi({ db, storage, now = Date.now, maxRows = MAX_ROWS, logger = console }) {
  let collectionsReady;
  const checkResult = result => {
    if (result?.code) {
      const error = new Error(String(result.message || 'DATABASE_OPERATION_FAILED'));
      error.code = result.code;
      throw error;
    }
    return result;
  };
  async function ensureCollections() {
    if (!collectionsReady) collectionsReady = (async () => {
      const names = Object.values(COLLECTIONS);
      for (let offset = 0; offset < names.length; offset += PAGE_CONCURRENCY) {
        await Promise.all(names.slice(offset, offset + PAGE_CONCURRENCY).map(async name => {
          try { checkResult(await db.createCollection(name)); }
          catch (error) {
            if (!/already.*exist|collection.*exist|已存在|DATABASE_COLLECTION_EXIST/i.test(`${error?.code || ''} ${error?.message || ''}`)) throw error;
          }
        }));
      }
    })().catch(error => { collectionsReady = null; throw error; });
    return collectionsReady;
  }
  async function get(collection, id, client = db) {
    const result = checkResult(await client.collection(collection).doc(id).get());
    return Array.isArray(result.data) ? result.data[0] || null : result.data || null;
  }
  async function put(collection, id, value, client = db) {
    const { _id, ...data } = value;
    checkResult(await client.collection(collection).doc(id).set(data));
  }
  async function read(collection, where = {}, optionalLegacy = false) {
    const rows = [];
    const startedAt = Date.now();
    let pageCount = 0;
    let totalCount = 0;
    async function page(offset, limit) {
      const result = checkResult(await db.collection(collection).where(where).orderBy('_id', 'asc').skip(offset).limit(limit).get());
      pageCount += 1;
      return Array.isArray(result.data) ? result.data : [];
    }
    function done(hasMore) {
      return { rows, hasMore, pages: pageCount, totalCount, elapsedMs: Date.now() - startedAt };
    }
    try {
      const firstLimit = Math.min(PAGE_SIZE, maxRows);
      const [first, countResult] = await Promise.all([
        page(0, firstLimit),
        db.collection(collection).where(where).count().then(checkResult),
      ]);
      if (!Number.isInteger(countResult.total) || countResult.total < 0) throw new Error('DATABASE_COUNT_INVALID');
      totalCount = countResult.total;
      rows.push(...first);
      const target = Math.min(totalCount, maxRows);
      if (first.length >= target) return done(totalCount > maxRows || first.length !== target);
      if (!first.length) return done(true);
      // The count verifies a short first page is genuinely complete. If a
      // service applies a smaller page ceiling, continue at that observed size
      // instead of silently dropping all records after the first 100.
      const effectivePageSize = Math.min(PAGE_SIZE, first.length);
      for (let offset = first.length; offset < target; offset += effectivePageSize * PAGE_CONCURRENCY) {
        const specs = Array.from({ length: PAGE_CONCURRENCY }, (_, index) => offset + index * effectivePageSize)
          .filter(start => start < target).map(start => ({ start, limit: Math.min(effectivePageSize, target - start) }));
        const pages = await Promise.all(specs.map(spec => page(spec.start, spec.limit)));
        pages.forEach(items => rows.push(...items));
        const short = pages.findIndex((items, index) => items.length < specs[index].limit);
        if (short !== -1) return done(true);
      }
      if (totalCount > maxRows || rows.length !== target) return done(true);
      return done((await page(target, 1)).length > 0);
    } catch (error) {
      if (optionalLegacy && /DATABASE_COLLECTION_NOT_EXIST|collection.*not.*exist|集合不存在/i.test(`${error?.code || ''} ${error?.message || ''}`)) return { rows: [], hasMore: false, pages: pageCount, totalCount: 0, elapsedMs: Date.now() - startedAt };
      throw error;
    }
  }
  function headers(event) { return Object.fromEntries(Object.entries(event.headers || {}).map(([k, v]) => [k.toLowerCase(), String(v)])); }
  function respond(event, statusCode, body) {
    const origin = headers(event).origin;
    return { statusCode, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': ALLOWED_ORIGINS.has(origin) ? origin : 'https://1274526084-dot.github.io', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', Vary: 'Origin' }, body: JSON.stringify(body) };
  }
  async function rate(event, scope, limit, interval = 15 * 60 * 1000, identity = '') {
    const ip = String(event.requestContext?.sourceIp || headers(event)['x-forwarded-for'] || headers(event)['x-real-ip'] || 'unknown').split(',')[0].trim();
    const time = now();
    const id = `rate-${hash(`${PROJECT_ID}|${scope}|${identity || ip}`).slice(0, 48)}`;
    await db.runTransaction(async tx => {
      const old = await get(COLLECTIONS.rates, id, tx);
      const active = old && old.reset_at > time;
      const count = active ? Number(old.count || 0) + 1 : 1;
      if (count > limit) fail(429, '操作较频繁，请稍后再试。');
      await put(COLLECTIONS.rates, id, { project_id: PROJECT_ID, count, reset_at: active ? old.reset_at : time + interval }, tx);
    });
  }
  async function teacher(token) {
    if (!validToken(token)) fail(401, '教师登录已失效，请重新登录。');
    const session = await get('speaking_sessions', hash(token));
    if (!session || session.auth_version !== 2 || !Number.isFinite(Number(session.expires_at)) || Number(session.expires_at) <= now() || !TEACHERS.has(session.teacher_code) || session.active === false || session.revoked_at || (session.project_id && !tagged(session))) fail(401, '教师登录已失效，请重新登录。');
    return { code: session.teacher_code, name: text(session.teacher_name, 60) || session.teacher_code };
  }
  async function studentSession(token, allowPractice = false) {
    if (!validToken(token)) fail(401, '此设备尚未获老师批准，或授权已失效。');
    let session = await get(COLLECTIONS.sessions, hash(token));
    if (!session) {
      const practice = await get(COLLECTIONS.practiceSessions, hash(token));
      if (!tagged(practice) || practice.auth_version !== 1 || practice.revoked_at || practice.expires_at <= now()) fail(401, '课堂身份已到期，请重新填写姓名和班级；已提交记录仍保留。');
      const request = await get(COLLECTIONS.requests, practice.request_id);
      if (!tagged(request) || !['pending', 'approved'].includes(request.status)) fail(401, '本次申请已失效，请联系老师；已提交记录仍保留。');
      if (request.status === 'approved') {
        const granted = await get(COLLECTIONS.sessions, request.session_id);
        if (!tagged(granted) || granted.revoked_at || granted.expires_at <= now()) fail(401, '此设备授权已撤销或到期，已提交记录仍保留。');
      }
      if (allowPractice) {
        const group = createClassDirectory([], CLASS_CATALOG.map(class_name => ({ class_name }))).resolve({ class_name: request.class_name });
        return { session: practice, student: { id: `practice-${practice.id.slice(0, 48)}`, name: request.name, class_name: request.class_name, class_key: group.key, project_id: PROJECT_ID }, practice: true, request };
      }
      if (request.status !== 'approved') fail(401, '可先完成课堂任务；个人历史档案需老师课后确认。');
      session = await get(COLLECTIONS.sessions, request.session_id);
    }
    if (!tagged(session) || session.auth_version !== 1 || session.revoked_at || !Number.isFinite(Number(session.expires_at)) || session.expires_at <= now()) fail(401, '此设备尚未获老师批准，或授权已失效。');
    const student = await get(COLLECTIONS.students, session.student_id);
    if (!tagged(student) || student.active === false) fail(401, '学习档案授权已失效，请联系老师。');
    return { session, student };
  }
  async function startPractice(requestToken) {
    if (!validToken(requestToken)) fail(401, '申请凭证已失效，请重新填写姓名和班级。');
    const requestId = `access-${hash(requestToken).slice(0, 48)}`;
    const practiceToken = hash(`english-archive-practice|${requestToken}`);
    const expiresAt = now() + 2 * 60 * 60 * 1000;
    const request = await db.runTransaction(async tx => {
      const row = await get(COLLECTIONS.requests, requestId, tx);
      if (!tagged(row) || !equalHash(row.request_token_hash, hash(requestToken)) || row.status !== 'pending' || row.expires_at <= now()) fail(409, '本次申请已处理或过期，请重新进入。');
      const old = await get(COLLECTIONS.practiceSessions, hash(practiceToken), tx);
      if (old?.revoked_at) fail(401, '课堂身份已撤销，请重新申请。');
      await put(COLLECTIONS.practiceSessions, hash(practiceToken), { id: hash(practiceToken), project_id: PROJECT_ID, auth_version: 1, request_id: requestId, created_at: old?.created_at || now(), expires_at: expiresAt, revoked_at: null }, tx);
      await put(COLLECTIONS.requests, requestId, { ...row, practice_enabled: true, expires_at: Math.max(row.expires_at, now() + 7 * DAY) }, tx);
      return row;
    });
    const group = createClassDirectory([], CLASS_CATALOG.map(class_name => ({ class_name }))).resolve({ class_name: request.class_name });
    return { practiceToken, practiceExpiresAt: expiresAt, student: { id: `practice-${hash(practiceToken).slice(0, 48)}`, name: request.name, className: group.label }, verified: false };
  }
  async function recordPractice(row, auth, tx, kind) {
    const session = await get(COLLECTIONS.practiceSessions, auth.session.id, tx);
    const request = await get(COLLECTIONS.requests, auth.request.id, tx);
    if (!tagged(session) || session.revoked_at || session.expires_at <= now() || !tagged(request) || !['pending', 'approved'].includes(request.status)) fail(401, '课堂身份已到期或撤销，本次尚未提交，请重新进入。');
    const key = kind === 'quiz' ? `quiz:${row.task_id}:${row.task_version}` : `unit2:${row.activity}:${row.details?.major || ''}`;
    await put(COLLECTIONS.practiceAttempts, row.id, { ...row, attempt_kind: kind, access_request_id: request.id }, tx);
    await put(COLLECTIONS.requests, request.id, { ...request, practice_count: (request.practice_count || 0) + 1, practice_scores: { ...request.practice_scores, [key]: { title: row.task_title || row.title, score: row.score, submittedAt: row.created_at } } }, tx);
  }
  async function existingAttempt(kind, id, legacyId, auth, tx) {
    const collection = kind === 'unit2' ? COLLECTIONS.unit2 : COLLECTIONS.submissions;
    const previous = await get(collection, id, tx) || await get(COLLECTIONS.practiceAttempts, id, tx) || (!auth.practice && await get(collection, legacyId, tx));
    if (!previous) return null;
    if (!tagged(previous)) fail(409, '提交编号已使用，不能修改他人的成绩。');
    if (previous.access_request_id) {
      if (auth.practice) {
        if (previous.access_request_id !== auth.request.id || previous.student_id !== auth.student.id) fail(409, '此提交编号属于另一份申请，不能修改他人的成绩。');
      } else {
        const owner = await get(COLLECTIONS.requests, previous.access_request_id, tx);
        if (!tagged(owner) || owner.status !== 'approved' || owner.student_id !== auth.student.id) fail(409, '此提交编号不属于本人，不能修改他人的成绩。');
      }
    } else if (previous.student_id !== auth.student.id) fail(409, '此提交编号不属于本人，不能修改他人的成绩。');
    return previous;
  }
  async function datasets() {
    const startedAt = Date.now();
    const names = ['profiles', 'words', 'speaking', 'students', 'reflections', 'submissions', 'tasks', 'news', 'unit2', 'practiceAttempts'];
    const [result, wordUnits, approvedRequests] = await Promise.all([
      Promise.all(names.map(key => read(LEGACY[key] || COLLECTIONS[key], LEGACY[key] ? {} : { project_id: PROJECT_ID }, Boolean(LEGACY[key])))),
      read('word_units', {}, true),
      read(COLLECTIONS.requests, { project_id: PROJECT_ID, status: 'approved' }),
    ]);
    const data = { hasMore: result.some(item => item.hasMore), incompleteCollections: names.filter((_, i) => result[i].hasMore), scans: Object.fromEntries(names.map((key, index) => [key, { scanned: result[index].rows.length, total: result[index].totalCount, pages: result[index].pages, elapsedMs: result[index].elapsedMs }])) };
    names.forEach((key, index) => { data[key] = LEGACY[key] ? result[index].rows.filter(row => scoped(row, key) && (key !== 'words' || row.status === 'completed')).map(projectSchoolRecord) : result[index].rows.filter(tagged); });
    const approved = new Map(approvedRequests.rows.filter(tagged).map(row => [row.id, row.student_id]));
    const owners = new Set(data.students.map(student => student.id));
    // Never merge new unverified submissions by a public name/class label.
    // Preserve old rows unchanged, while new evidence needs explicit ownership.
    for (const kind of ['profiles', 'words', 'speaking']) {
      data[kind] = data[kind].flatMap(row => {
        if (!row.archive_binding_version) return [row];
        const owner = row.archive_binding === 'verified' ? row.archive_student_id : row.archive_binding === 'pending' ? approved.get(row.archive_request_id) : '';
        return owner && owners.has(owner) ? [{ ...row, archive_student_id: owner }] : [];
      });
    }
    for (const row of data.practiceAttempts) {
      const studentId = approved.get(row.access_request_id);
      if (studentId) {
        const view = { ...row, student_id: studentId, identity_approval: 'teacher-confirmed' };
        if (row.attempt_kind === 'unit2') data.unit2.push(view);
        if (row.attempt_kind === 'quiz') data.submissions.push(view);
      }
    }
    if (approvedRequests.hasMore) { data.hasMore = true; data.incompleteCollections.push('approvedRequests'); }
    // Read only the same domestic units accepted by wordLab. No unit or audio is rewritten.
    data.wordUnits = wordUnits.rows.filter(row => !foreign(row) && (tagged(row) || (!row.project_id && row.teacher_id && row.share_code && typeof row.words_json === 'string')));
    if (wordUnits.hasMore) { data.hasMore = true; data.incompleteCollections.push('wordUnits'); }
    // The directory uses class/major evidence, not student or attempt counts.
    // Keep EVERY distinct pair, including ambiguous spellings; duplicate rows
    // cannot add identity evidence and made packed-class parsing quadratic.
    const classVariants = new Map();
    const classKey = row => JSON.stringify([row.class_name, row.major || null, row.class_identity_name || null]);
    for (const kind of ['profiles', 'words', 'speaking', 'students']) {
      for (const row of data[kind]) {
        const descriptor = { class_name: row.class_name, class_identity_name: row.class_identity_name, raw_class_name: row.raw_class_name, ...(kind !== 'students' && row.major ? { major: row.major } : {}) };
        classVariants.set(classKey(descriptor), descriptor);
      }
    }
    data.directory = createClassDirectory([...classVariants.values()], CLASS_CATALOG.map(class_name => ({ class_name })));
    const resolvedClasses = new Map();
    for (const [key, row] of classVariants) resolvedClasses.set(key, data.directory.resolve(row));
    data.identities = new Map();
    for (const kind of ['profiles', 'words', 'speaking']) {
      for (const row of data[kind]) {
        const group = resolvedClasses.get(classKey(row));
        const key = `${group.identityKey}\0${normalizeName(row.student_name)}`;
        let bucket = data.identities.get(key);
        if (!bucket) {
          bucket = { name: text(row.student_name, 60), group, profiles: [], words: [], speaking: [], studentNumbers: new Set(), profile: null };
          data.identities.set(key, bucket);
        }
        bucket[kind].push(row);
        if (kind === 'speaking' && !row.archive_binding_version) {
          const studentNumber = normalizeName(row.student_id);
          if (studentNumber) bucket.studentNumbers.add(studentNumber);
        }
        if (kind === 'profiles' && (!bucket.profile || Number(tagged(row)) > Number(tagged(bucket.profile)) || (tagged(row) === tagged(bucket.profile) && timestamp(row) > timestamp(bucket.profile)))) bucket.profile = row;
      }
    }
    for (const kind of ['reflections', 'submissions', 'unit2']) {
      data[`${kind}ByStudent`] = new Map();
      for (const row of data[kind]) {
        const bucket = data[`${kind}ByStudent`].get(row.student_id) || [];
        bucket.push(row);
        data[`${kind}ByStudent`].set(row.student_id, bucket);
      }
    }
    data.indexStats = { classVariants: classVariants.size, identities: data.identities.size, elapsedMs: Date.now() - startedAt };
    return data;
  }
  function candidateId(classKey, name) { return `student-${hash(`${PROJECT_ID}|${classKey}|${normalizeName(name)}`).slice(0, 48)}`; }
  function allStudents(data) {
    const students = new Map(data.students.map(student => [student.id, student]));
    const existingByIdentity = new Map(data.students.map(student => {
      const group = data.directory.resolve({ class_name: student.class_name, raw_class_name: student.raw_class_name, class_identity_name: student.class_identity_name });
      return [`${group.identityKey}\0${normalizeName(publicStudent(student).name)}`, student];
    }));
    for (const { name, group, profiles, words, speaking } of data.identities.values()) {
      const existing = existingByIdentity.get(`${group.identityKey}\0${normalizeName(name)}`);
      const id = existing?.id || candidateId(group.identityKey, name);
      const source = [...profiles, ...words, ...speaking][0];
      if (!students.has(id)) students.set(id, { id, name, raw_student_name: source?.raw_student_name, class_name: group.label, raw_class_name: source?.raw_class_name, class_identity_name: source?.class_identity_name, class_key: group.identityKey, ambiguous: group.ambiguous, project_id: PROJECT_ID });
    }
    return students;
  }
  function identityFor(student, data) {
    const view = publicStudent(student);
    const group = data.directory.resolve({ class_name: student.class_name, raw_class_name: student.raw_class_name, class_identity_name: student.class_identity_name });
    return data.identities.get(`${student.class_key}\0${normalizeName(view.name)}`) || data.identities.get(`${group.identityKey}\0${normalizeName(view.name)}`);
  }
  function legacyRows(kind, student, data) {
    return (identityFor(student, data)?.[kind] || []).filter(row => !row.archive_binding_version || row.archive_student_id === student.id);
  }
  function archiveRows(kind, student, data) {
    return data[`${kind}ByStudent`].get(student.id) || [];
  }
  function identityConflict(student, data) {
    // speakingLab's student_id is the student-entered 学号, not an attempt ID.
    // Multiple IDs for one name/class may be a namesake or a typo; neither is
    // sufficient evidence to grant access to a combined legacy archive.
    return (identityFor(student, data)?.studentNumbers.size || 0) > 1;
  }
  function assigned(task, student, data) {
    return !task.classes?.length || task.classes.some(className => {
      if (className === student.class_key) return true;
      const group = data.directory.resolve({ class_name: className });
      return !group.ambiguous && group.key === student.class_key;
    });
  }
  function profileFor(student, data) {
    return legacyRows('profiles', student, data).sort((a,b) => Number(tagged(b)) - Number(tagged(a)) || timestamp(b) - timestamp(a))[0] || null;
  }
  async function signedAudio(entries) {
    const unique = [...new Set(entries.flatMap(entry => entry.audio.map(clip => clip.fileId)).filter(id => typeof id === 'string' && id.startsWith('cloud://')))];
    const urls = new Map();
    // Only IDs taken from the selected student's records can reach storage signing.
    for (let offset = 0; offset < unique.length; offset += 50) {
      const result = await storage.getTempFileURL({ fileList: unique.slice(offset, offset + 50).map(fileID => ({ fileID, maxAge: AUDIO_SECONDS })) });
      for (const item of result.fileList || []) {
        const url = item.tempFileURL || item.download_url || '';
        if (/^https?:\/\//i.test(url)) urls.set(item.fileID, url);
      }
    }
    return entries.map(entry => ({ ...entry, audio: entry.audio.map(clip => ({ url: urls.get(clip.fileId) || '', label: clip.label })).filter(clip => clip.url) }));
  }
  function historyFor(student, data, includeProfiles) {
    const words = legacyRows('words', student, data).map(row => {
      const results = array(row.results_json);
      return { id: `word:${row.id || row._id}`, type: 'word', title: text(row.unit_title, 160) || '单词跟读练习', submittedAt: timestamp(row), score: score(row.average_score), details: { teacherName: text(row.teacher_name, 60), averageSelf: row.average_self ?? null, results: results.map(item => ({ word: text(item.word, 120), transcript: text(item.transcript, 1000), score: score(item.system_score), selfRating: item.self_rating ?? null, scoringMode: text(item.scoring_mode, 60), recordedAt: Number(item.recorded_at || 0) })) }, audio: results.map(item => ({ fileId: item.audio_file_id, label: text(item.word, 120) || '单词录音' })) };
    });
    const speaking = legacyRows('speaking', student, data).map(row => ({ id: `speaking:${row.id || row._id}`, type: 'speaking', title: text(row.scene_title, 160) || '情景口语练习', submittedAt: timestamp(row), score: score(row.total_score), details: { studentId: text(row.student_id, 60), transcript: text(row.transcript, 8000), feedback: typeof row.feedback === 'string' ? text(row.feedback, 4000) : parse(row.feedback, {}), taskScore: score(row.task_score), sentenceScore: score(row.sentence_score), clarityScore: score(row.clarity_score), interactionScore: score(row.interaction_score), durationSeconds: Number(row.duration_seconds || 0) }, audio: array(row.audio_manifest).map((clip, index) => ({ fileId: clip.key, label: `第${Number(clip.round) || index + 1}轮录音` })) }));
    const quizzes = archiveRows('submissions', student, data).map(row => ({ id: `quiz:${row.id || row._id}`, type: 'quiz', taskId: row.task_id, title: row.task_title, submittedAt: row.created_at, score: row.score, details: { taskId: row.task_id, taskVersion: row.task_version ?? row.task_updated_at, answers: row.answers, feedback: row.feedback, total: row.total, correct: row.correct }, audio: [] }));
    const profiles = includeProfiles ? legacyRows('profiles', student, data).map(row => ({ id: `profile:${row.id || row._id}`, type: 'profile', title: '学期初学习画像', submittedAt: timestamp(row), score: null, details: publicProfile(row), audio: [] })) : [];
    const unit2 = archiveRows('unit2', student, data).map(row => ({ id: `unit2:${row.id}`, type: row.course_lesson === 'Lesson 3' ? 'lesson3' : 'unit2', title: row.title, submittedAt: row.created_at, score: row.score, details: { ...row.details, activity: row.activity, total: row.total, correct: row.correct }, audio: [] }));
    return [...words, ...speaking, ...quizzes, ...profiles, ...unit2].sort((a, b) => b.submittedAt - a.submittedAt);
  }
  function summaryFor(history, reflections) {
    const words = history.filter(row => row.type === 'word'), speaking = history.filter(row => row.type === 'speaking'), quizzes = history.filter(row => row.type === 'quiz');
    return { historyCount: history.length, wordCount: words.length, speakingCount: speaking.length, quizCount: quizzes.length, wordAverage: mean(words), speakingAverage: mean(speaking), quizAverage: mean(quizzes), lastActive: Math.max(0, ...history.map(row => row.submittedAt), ...reflections.map(row => row.created_at)), reflectionCount: reflections.length };
  }
  function courseProgressFor(student, data) {
    const tasks = data.tasks.filter(task => assigned(task, student, data));
    return lessonProgress({ words: legacyRows('words', student, data), wordUnits: data.wordUnits, speaking: legacyRows('speaking', student, data), unit2: archiveRows('unit2', student, data), quizzes: archiveRows('submissions', student, data), tasks });
  }
  function studentSummary(student, data, includeProfiles) {
    const words = legacyRows('words', student, data), speaking = legacyRows('speaking', student, data);
    const profiles = includeProfiles ? legacyRows('profiles', student, data) : [];
    const quizzes = archiveRows('submissions', student, data), reflections = archiveRows('reflections', student, data);
    const unit2 = archiveRows('unit2', student, data);
    return {
      courseProgress: courseProgressFor(student, data),
      unit2: unit2Summary(unit2),
      historyCount: words.length + speaking.length + profiles.length + quizzes.length + unit2.length,
      wordCount: words.length, speakingCount: speaking.length, quizCount: quizzes.length,
      wordAverage: mean(words.map(row => ({ score: score(row.average_score) }))),
      speakingAverage: mean(speaking.map(row => ({ score: score(row.total_score) }))),
      quizAverage: mean(quizzes.map(row => ({ score: row.score }))),
      lastActive: Math.max(0, ...words.map(timestamp), ...speaking.map(timestamp), ...profiles.map(timestamp), ...quizzes.map(row => row.created_at), ...reflections.map(row => row.created_at), ...unit2.map(row => row.created_at)),
      reflectionCount: reflections.length,
    };
  }
  async function dashboard(student, data, includeProfiles = true, isTeacher = false) {
    const reflections = [...archiveRows('reflections', student, data)].sort((a, b) => b.created_at - a.created_at);
    const history = historyFor(student, data, includeProfiles);
    const unit2 = unit2Summary(archiveRows('unit2', student, data));
    const output = { student: publicStudent(student), profile: includeProfiles ? publicProfile(profileFor(student, data)) : null, profileRestricted: !includeProfiles, history: await signedAudio(history), tasks: data.tasks.filter(row => row.status === 'published' && assigned(row, student, data)).map(row => publicTask(row)), news: data.news.filter(row => row.status === 'published').map(publicNews).sort((a, b) => b.updatedAt - a.updatedAt), snapshots: reflections.map(row => ({ id: row.id, createdAt: row.created_at, skills: row.skills, goals: row.goals })), summary: summaryFor(history, reflections), hasMore: data.hasMore, warnings: data.hasMore ? ['记录数量超过本次读取上限，显示结果可能不完整，请联系管理员分批导出。'] : [], audioExpiresAt: now() + AUDIO_SECONDS * 1000 };
    output.unit2 = unit2;
    output.courseProgress = courseProgressFor(student, data);
    if (isTeacher) {
      output.identityConflict = identityConflict(student, data);
      if (output.identityConflict) output.warnings.push('同班同名记录出现不同学号，学生访问已暂停。请先核对原始记录；系统不会猜测或合并身份。');
      const devices = await read(COLLECTIONS.sessions, { project_id: PROJECT_ID, student_id: student.id });
      output.devices = devices.rows.map(row => ({ id: row.id, createdAt: row.created_at, expiresAt: row.expires_at, revokedAt: row.revoked_at || null, approvedBy: row.approved_by, active: !row.revoked_at && row.expires_at > now() }));
      output.hasMore ||= devices.hasMore;
    }
    return output;
  }
  function validateTask(value) {
    const task = value || {};
    const title = requiredText(task.title, '任务名称', 160);
    if (!position(task.unit, task.lesson)) fail(400, '请选择 Unit 1–30 和第1、2或3课。');
    if (!['word', 'speaking', 'reading', 'listening', 'writing', 'quiz', 'link'].includes(task.type)) fail(400, '请选择有效的任务类型。');
    if (!['draft', 'published'].includes(task.status)) fail(400, '请选择草稿或发布状态。');
    if (!Array.isArray(task.classes) || task.classes.length > 50 || task.classes.some(item => typeof item !== 'string' || !item.trim() || item.length > 100)) fail(400, '班级格式不正确，最多选择50个班级。');
    if (task.dueAt != null && (!Number.isFinite(task.dueAt) || task.dueAt < 0)) fail(400, '截止时间不正确。');
    let questions = [];
    if (task.type === 'quiz') {
      if (!Array.isArray(task.questions) || !task.questions.length || task.questions.length > 30) fail(400, '测验须包含1至30道题。');
      const ids = new Set();
      questions = task.questions.map((item, index) => {
        const id = text(item.id, 80) || `q${index + 1}`;
        if (ids.has(id)) fail(400, '题目编号不能重复。');
        ids.add(id);
        if (!Array.isArray(item.options) || item.options.length !== 4 || item.options.some(option => typeof option !== 'string' || !option.trim() || option.length > 500) || !Number.isInteger(item.answer) || item.answer < 0 || item.answer > 3) fail(400, '每题须填写四个选项，并指定正确答案。');
        return { id, prompt: requiredText(item.prompt, '题干', 1500), options: item.options.map(option => text(option, 500)), answer: item.answer, explanation: text(item.explanation, 2000) };
      });
    }
    return { title, unit: text(task.unit, 80), lesson: text(task.lesson, 80), type: task.type, description: text(task.description, 5000), href: safeUrl(task.href), classes: [...new Set(task.classes.map(item => text(item, 100)))], due_at: task.dueAt ?? null, status: task.status, questions, material: text(task.material, 15000) };
  }
  function validateNews(value) {
    const news = value || {};
    if (!['draft', 'published'].includes(news.status)) fail(400, '请选择草稿或发布状态。');
    const vocabulary = news.vocabulary || [];
    if (!Array.isArray(vocabulary) || vocabulary.length > 30) fail(400, '词汇最多填写30项。');
    return { title: requiredText(news.title, '新闻标题', 200), summary: text(news.summary, 6000), url: safeUrl(news.url, true), source: requiredText(news.source, '新闻来源', 160), published_date: text(news.publishedDate, 40), vocabulary: vocabulary.map(item => ({ word: requiredText(item.word, '词汇', 100), meaning: requiredText(item.meaning, '释义', 500) })), question: text(news.question, 2000), status: news.status };
  }
  async function saveOwned(kind, body, staff) {
    const value = body[kind === 'tasks' ? 'task' : 'news'];
    const clean = kind === 'tasks' ? validateTask(value) : validateNews(value);
    const id = text(value?.id, 100) || `${kind === 'tasks' ? 'task' : 'news'}-${randomUUID()}`;
    const row = await db.runTransaction(async tx => {
      const existing = await get(COLLECTIONS[kind], id, tx);
      if (value?.id && !tagged(existing)) fail(404, '没有找到这条内容。');
      if (existing && existing.creator !== staff.code && staff.code !== 'july') fail(403, '只能修改自己创建的内容；可以复制后再编辑。');
      const locked = existing?.course_locked || existing?.status === 'published';
      if (kind === 'tasks' && locked && (existing.unit !== clean.unit || existing.lesson !== clean.lesson || existing.type !== clean.type || (existing.type === 'word' && existing.href !== clean.href))) fail(409, '已发布任务的课次、类型和跟读链接不可替换；请新建任务，已有成绩继续保留。');
      const saved = { id, project_id: PROJECT_ID, ...clean, creator: existing?.creator || staff.code, creator_name: existing?.creator_name || staff.name, created_at: existing?.created_at || now(), updated_at: now(), updated_by: staff.code, ...(kind === 'tasks' ? { version: randomUUID(), course_locked: Boolean(locked || clean.status === 'published') } : {}) };
      await put(COLLECTIONS[kind], id, saved, tx);
      return saved;
    });
    return kind === 'tasks' ? { task: publicTask(row, true) } : { news: publicNews(row) };
  }
  async function dispatch(event, body) {
    const action = text(body.action, 40);
    if (body.projectId && body.projectId !== PROJECT_ID) fail(400, '项目不匹配。');
    if (action === 'publicFeed') {
      await rate(event, 'feed', 1800);
      const [tasks, news] = await Promise.all(['tasks', 'news'].map(key => read(COLLECTIONS[key], { project_id: PROJECT_ID, status: 'published' })));
      const courses = await read(COLLECTIONS.courseUnits, { project_id: PROJECT_ID });
      return { ...courseCatalog(courses.rows, tasks.rows), tasks: tasks.rows.filter(tagged).map(row => publicTask(row)), news: news.rows.filter(tagged).map(publicNews).sort((a, b) => b.updatedAt - a.updatedAt), hasMore: tasks.hasMore || news.hasMore || courses.hasMore };
    }
    if (action === 'requestAccess') {
      await rate(event, 'request-access', 300);
      const originalName = requiredText(body.name, '姓名', 60), originalClass = requiredText(body.className, '完整班级', 100);
      const view = projectSchoolRecord({ student_name: originalName, class_name: originalClass });
      const name = view.student_name, className = view.class_name;
      await rate(event, 'request-identity', 6, 15 * 60 * 1000, `${normalizeName(name)}|${className}`);
      const requestToken = randomBytes(32).toString('hex');
      const studentToken = hash(`english-archive-device|${requestToken}`);
      const verificationCode = String(randomInt(100000, 1000000));
      const id = `access-${hash(requestToken).slice(0, 48)}`;
      const row = { id, project_id: PROJECT_ID, name, class_name: className, raw_student_name: originalName, raw_class_name: originalClass, request_token_hash: hash(requestToken), verification_hash: hash(`${id}|${verificationCode}`), session_id: hash(studentToken), status: 'pending', created_at: now(), expires_at: now() + DAY };
      await put(COLLECTIONS.requests, id, row);
      const practice = body.practice === true ? await startPractice(requestToken) : {};
      return { requestId: id, requestToken, verificationCode, expiresAt: body.practice === true ? now() + 7 * DAY : row.expires_at, status: 'pending', ...practice };
    }
    if (action === 'startPractice') {
      await rate(event, 'start-practice', 30, 15 * 60 * 1000, hash(body.requestToken || ''));
      return startPractice(body.requestToken);
    }
    if (action === 'accessStatus') {
      if (!validToken(body.requestToken)) fail(401, '授权申请已失效，请重新申请。');
      await rate(event, 'access-status', 200, 15 * 60 * 1000, hash(body.requestToken));
      const id = `access-${hash(body.requestToken).slice(0, 48)}`;
      const request = await get(COLLECTIONS.requests, id);
      if (!tagged(request) || !equalHash(request.request_token_hash, hash(body.requestToken))) fail(401, '授权申请已失效，请重新申请。');
      if (request.status === 'rejected') return { status: 'rejected' };
      if ((request.status === 'pending' && request.expires_at <= now()) || (request.status === 'approved' && Number(request.approved_at) + DAY <= now())) return { status: 'expired' };
      if (request.status !== 'approved') return { status: 'pending', expiresAt: request.expires_at };
      const studentToken = hash(`english-archive-device|${body.requestToken}`);
      try {
        const { student, session } = await studentSession(studentToken);
        return { status: 'approved', studentToken, student: publicStudent(student), expiresAt: session.expires_at };
      } catch (error) { if (error.status === 401) return { status: 'revoked' }; throw error; }
    }
    if (['studentDashboard', 'saveReflection', 'submitQuiz', 'studentLogout', 'saveUnit2Attempt', 'saveLesson3Attempt', 'unit2Dashboard', 'courseSession', 'courseStudentScores'].includes(action)) {
      const auth = await studentSession(body.studentToken, ['courseSession', 'saveUnit2Attempt', 'saveLesson3Attempt', 'submitQuiz', 'courseStudentScores', 'unit2Dashboard'].includes(action));
      const { student, session } = auth;
      await rate(event, action, action === 'studentDashboard' ? 90 : 30, 15 * 60 * 1000, student.id);
      if (action === 'studentLogout') {
        await put(COLLECTIONS.sessions, session.id, { ...session, revoked_at: now(), revoked_by: 'student' });
        return {};
      }
      if (action === 'courseSession') return { student: publicStudent(student), verified: !auth.practice, expiresAt: Math.min(session.expires_at, now() + 2 * 60 * 60 * 1000) };
      if (auth.practice && ['courseStudentScores', 'unit2Dashboard'].includes(action)) {
        const [own, words, speaking, units, tasks] = await Promise.all([
          read(COLLECTIONS.practiceAttempts, { project_id: PROJECT_ID, student_id: student.id, access_request_id: auth.request.id }),
          read(LEGACY.words, { project_id: PROJECT_ID, archive_request_id: auth.request.id, archive_binding: 'pending', status: 'completed' }, true),
          read(LEGACY.speaking, { project_id: PROJECT_ID, archive_request_id: auth.request.id, archive_binding: 'pending' }, true),
          read('word_units', { project_id: PROJECT_ID }, true),
          read(COLLECTIONS.tasks, { project_id: PROJECT_ID, status: 'published' }),
        ]);
        if ([own, words, speaking, units, tasks].some(scan => scan.hasMore)) fail(409, '本次成绩未完整载入，请稍后重试。');
        return { student: publicStudent(student), verified: false, unit2: unit2Summary(own.rows.filter(row => row.attempt_kind === 'unit2')), courseProgress: lessonProgress({ unit2: own.rows.filter(row => row.attempt_kind === 'unit2'), quizzes: own.rows.filter(row => row.attempt_kind === 'quiz'), words: words.rows.filter(tagged), speaking: speaking.rows.filter(tagged), wordUnits: units.rows.filter(tagged), tasks: tasks.rows.filter(tagged) }) };
      }
      if (action === 'courseStudentScores') {
        const data = await datasets();
        if (data.hasMore || identityConflict(student, data)) fail(409, '记录或身份待核对，暂不显示可能不完整的成绩。');
        return { student: publicStudent(student), courseProgress: courseProgressFor(student, data) };
      }
      if (action === 'saveUnit2Attempt') {
        const requestId = requiredText(body.requestId, '提交编号', 100);
        if (!/^[a-zA-Z0-9_-]{8,100}$/.test(requestId)) fail(400, '提交编号不正确。');
        let graded;
        try { graded = gradeUnit2(body); } catch (error) { fail(400, error.message); }
        const id = `unit2-${hash(`${PROJECT_ID}|${requestId}`).slice(0, 48)}`;
        const legacyId = `unit2-${hash(`${PROJECT_ID}|${student.id}|${requestId}`).slice(0, 48)}`;
        const fingerprint = hash(JSON.stringify(graded));
        const row = await db.runTransaction(async tx => {
          const previous = await existingAttempt('unit2', id, legacyId, auth, tx);
          if (previous) {
            if (previous.fingerprint !== fingerprint) fail(409, '提交编号已被其他答案使用，请重新提交。');
            return previous;
          }
          const result = { ...graded, id, fingerprint, project_id: PROJECT_ID, student_id: student.id, unit: 'Unit 2', created_at: now() };
          if (auth.practice) await recordPractice(result, auth, tx, 'unit2');
          else await put(COLLECTIONS.unit2, id, result, tx);
          return result;
        });
        return { pendingVerification: Boolean(auth.practice), submission: { id: row.id, activity: row.activity, score: row.score, total: row.total, correct: row.correct, submittedAt: row.created_at } };
      }
      if (action === 'saveLesson3Attempt') {
        const requestId = requiredText(body.requestId, '提交编号', 100);
        if (!/^[a-zA-Z0-9_-]{8,100}$/.test(requestId)) fail(400, '提交编号不正确。');
        let graded;
        try { graded = gradeLesson3(body); } catch (error) { fail(400, error.message); }
        const id = `lesson3-${hash(`${PROJECT_ID}|${requestId}`).slice(0, 48)}`;
        const fingerprint = hash(JSON.stringify(graded));
        const row = await db.runTransaction(async tx => {
          const previous = await existingAttempt('unit2', id, id, auth, tx);
          if (previous) {
            if (previous.fingerprint !== fingerprint) fail(409, '提交编号已被其他答案使用，请重新提交。');
            return previous;
          }
          const result = { ...graded, id, fingerprint, project_id: PROJECT_ID,
            student_id: student.id, unit: 'Unit 1', course_unit: 'Unit 1',
            course_lesson: 'Lesson 3', created_at: now() };
          if (auth.practice) await recordPractice(result, auth, tx, 'unit2');
          else await put(COLLECTIONS.unit2, id, result, tx);
          return result;
        });
        return { pendingVerification: Boolean(auth.practice), submission: {
          id: row.id, activity: row.activity, score: row.score,
          total: row.total, correct: row.correct, submittedAt: row.created_at,
        } };
      }
      if (action === 'unit2Dashboard') {
        const data = await datasets();
        if (data.hasMore || identityConflict(student, data)) fail(409, '记录或身份待核对，暂不能安全显示成绩。');
        return { student: publicStudent(student), unit2: unit2Summary(archiveRows('unit2', student, data)), hasMore: false };
      }
      const data = auth.practice ? { directory: createClassDirectory([], CLASS_CATALOG.map(class_name => ({ class_name }))), incompleteCollections: [] } : await datasets();
      if (!auth.practice && data.incompleteCollections.some(key => LEGACY[key] || key === 'students')) fail(409, '身份核验所需的历史记录超过本次读取上限，暂不能安全读取或新增个人档案。请联系老师分批核对；原始记录仍保留。');
      if (!auth.practice && identityConflict(student, data)) fail(409, '同班同名记录出现不同学号，暂不能安全显示或新增个人档案。请联系老师核对；原始记录仍保留。');
      if (action === 'saveReflection') {
        const skills = skillsValue(body.skills), goals = requiredText(body.goals, '学习目标', 2000);
        const id = `reflection-${randomUUID()}`, createdAt = now();
        await put(COLLECTIONS.reflections, id, { id, project_id: PROJECT_ID, student_id: student.id, created_at: createdAt, skills, goals });
        return { snapshot: { id, createdAt, skills, goals } };
      }
      if (action === 'studentDashboard') return dashboard(student, data);
      const taskId = requiredText(body.taskId, '测验编号', 100);
      const requestId = requiredText(body.requestId, '提交凭证', 100);
      if (!/^[a-zA-Z0-9_-]{8,100}$/.test(requestId)) fail(400, '提交凭证不正确，请刷新后再试。');
      const id = `quiz-${hash(`${PROJECT_ID}|${requestId}`).slice(0, 48)}`;
      const legacyId = `quiz-${hash(`${PROJECT_ID}|${student.id}|${requestId}`).slice(0, 48)}`;
      const answers = body.answers;
      if (!Array.isArray(answers) || answers.length > 30 || answers.some(value => !Number.isInteger(value) || value < 0 || value > 3)) fail(400, '请完成所有题目。');
      const submitted = await db.runTransaction(async tx => {
        const previous = await existingAttempt('quiz', id, legacyId, auth, tx);
        if (previous) {
          if (previous.task_id !== taskId || JSON.stringify(previous.answers) !== JSON.stringify(answers)) fail(409, '此提交凭证已用于其他答案，请重新提交。');
          return previous;
        }
        const task = await get(COLLECTIONS.tasks, taskId, tx);
        if (!tagged(task) || task.status !== 'published' || task.type !== 'quiz' || !assigned(task, student, data)) fail(404, '该测验尚未向你的班级发布。');
        if (body.taskVersion !== (task.version ?? task.updated_at)) fail(409, '老师已更新这份测验，或页面版本已过期。请关闭小测并刷新任务后重新作答；本次尚未记分。');
        if (!task.questions?.length || answers.length !== task.questions.length) fail(400, '请完成所有题目。');
        const feedback = task.questions.map((question, index) => ({ id: question.id, prompt: question.prompt, options: question.options, selected: answers[index], answer: question.answer, correct: answers[index] === question.answer, explanation: question.explanation || '' }));
        const correct = feedback.filter(item => item.correct).length;
        const row = { id, project_id: PROJECT_ID, student_id: student.id, task_id: taskId, task_title: task.title, unit: task.unit, lesson: task.lesson, task_updated_at: task.updated_at, task_version: task.version ?? task.updated_at, request_id: requestId, answers, feedback, total: feedback.length, correct, score: Math.round(correct / feedback.length * 100), created_at: now() };
        if (auth.practice) await recordPractice(row, auth, tx, 'quiz');
        else await put(COLLECTIONS.submissions, id, row, tx);
        return row;
      });
      return { pendingVerification: Boolean(auth.practice), submission: { id: submitted.id, taskId: submitted.task_id, taskVersion: submitted.task_version ?? submitted.task_updated_at, score: submitted.score, correct: submitted.correct, total: submitted.total, submittedAt: submitted.created_at, feedback: submitted.feedback }, score: submitted.score, feedback: submitted.feedback };
    }
    const teacherActions = ['teacherDashboard', 'teacherStudent', 'listAccessRequests', 'approveAccess', 'rejectAccess', 'revokeDevice', 'saveTask', 'saveNews', 'teacherSession', 'normalizeClasses', 'courseFeed', 'saveCourseUnit', 'setCurrentLesson', 'teacherCourseScores'];
    if (!teacherActions.includes(action)) fail(404, '未知操作。');
    const staff = await teacher(body.token);
    await rate(event, action, action === 'listAccessRequests' ? 1000 : action === 'approveAccess' ? 100 : 180, 15 * 60 * 1000, staff.code);
    if (action === 'teacherSession') return { code: staff.code, name: staff.name };
    if (action === 'courseFeed') {
      const [courses, tasks] = await Promise.all([read(COLLECTIONS.courseUnits, { project_id: PROJECT_ID }), read(COLLECTIONS.tasks, { project_id: PROJECT_ID })]);
      return { teacher: staff, ...courseCatalog(courses.rows, tasks.rows), tasks: tasks.rows.map(row => publicTask(row, true)), hasMore: courses.hasMore || tasks.hasMore };
    }
    if (action === 'saveCourseUnit') {
      if (!Number.isInteger(body.number) || body.number < 1 || body.number > 30) fail(400, '单元编号须为1–30。');
      const id = `course-unit-${body.number}`;
      const unit = await db.runTransaction(async tx => {
        const old = await get(COLLECTIONS.courseUnits, id, tx);
        if (old && (!tagged(old) || (old.creator !== staff.code && staff.code !== 'july'))) fail(403, '该单元由另一位老师创建。');
        const row = { id, project_id: PROJECT_ID, kind: 'unit', number: body.number, title: text(body.title, 100), lessons: [1, 2, 3], creator: old?.creator || staff.code, creator_name: old?.creator_name || staff.name, updated_at: now() };
        await put(COLLECTIONS.courseUnits, id, row, tx); return row;
      });
      return { unit: courseCatalog([unit]).units.find(item => item.number === body.number) };
    }
    if (action === 'setCurrentLesson') {
      const at = position(body.unit, body.lesson);
      if (!at) fail(400, '请选择有效单元及第1–3课。');
      if (at.unit !== 1 && !tagged(await get(COLLECTIONS.courseUnits, `course-unit-${at.unit}`))) fail(400, '请先创建这个单元。');
      await put(COLLECTIONS.courseUnits, 'course-current', { id: 'course-current', project_id: PROJECT_ID, kind: 'current', ...at, updated_by: staff.code, updated_at: now() });
      return { current: at };
    }
    if (action === 'normalizeClasses') {
      if (staff.code !== 'july') fail(403, '仅 July 可以执行全量班级整理。');
      const scans = await Promise.all(Object.entries(LEGACY).map(async ([kind, collection]) => ({ kind, collection, scan: await read(collection, {}, true) })));
      if (scans.some(item => item.scan.hasMore)) fail(409, '记录读取不完整，未执行整理。');
      const counts = {}; const pending = [];
      for (const { kind, collection, scan } of scans) {
        const report = { scanned: scan.rows.length, scoped: 0, normalized: 0, default: 0, splitNames: 0, fingerprint: hash(JSON.stringify(scan.rows)) };
        for (const row of scan.rows) {
          if (!scoped(row, kind) || (kind === 'words' && row.status !== 'completed')) continue;
          const view = projectSchoolRecord(row); report.scoped++;
          if (view.class_name !== view.raw_class_name) report.normalized++;
          if (view.class_name === '默认班级（测试）') report.default++;
          if (view.student_name !== view.raw_student_name) report.splitNames++;
          const sourceId = row.id || row._id;
          if (!sourceId) fail(409, '记录编号缺失，未执行整理。');
          pending.push({ id: `class-map-${hash(`${CLASS_NORMALIZATION_VERSION}|${collection}|${sourceId}`).slice(0, 48)}`, project_id: PROJECT_ID, source_collection: collection, source_id: sourceId, raw_student_name: view.raw_student_name, raw_class_name: view.raw_class_name, student_name: view.student_name, class_name: view.class_name, college: view.normalized_college, identity_name: view.class_identity_name, source_fingerprint: hash(JSON.stringify(row)), version: CLASS_NORMALIZATION_VERSION, normalized_by: staff.code });
        }
        counts[kind] = report;
      }
      if (body.commit === true) {
        // Only this project's separate mapping collection is written. All old
        // scores, audio, IDs and Malaysia datasets remain byte-for-byte intact.
        for (let offset = 0; offset < pending.length; offset += 20) await Promise.all(pending.slice(offset, offset + 20).map(row => put(COLLECTIONS.classNormalization, row.id, row)));
      }
      return { committed: body.commit === true, version: CLASS_NORMALIZATION_VERSION, records: pending.length, counts, originalCollectionsModified: false };
    }
    if (action === 'saveTask') return saveOwned('tasks', body, staff);
    if (action === 'saveNews') return saveOwned('news', body, staff);
    if (action === 'listAccessRequests') {
      const requests = await read(COLLECTIONS.requests, { project_id: PROJECT_ID, ...(body.pendingOnly === true ? { status: 'pending' } : {}) });
      const evidence = await Promise.all(['words', 'speaking', 'profiles'].map(kind => read(LEGACY[kind], { project_id: PROJECT_ID, archive_binding: 'pending' }, true)));
      const summaries = new Map();
      evidence.forEach((scan,index) => scan.rows.filter(tagged).forEach(row => {
        if (index === 0 && row.status !== 'completed') return;
        const list = summaries.get(row.archive_request_id) || [];
        list.push({ title: index === 0 ? row.unit_title : index === 1 ? row.scene_title : '学情调查（自评）', score: index === 0 ? score(row.average_score) : index === 1 ? score(row.total_score) : null, submittedAt: timestamp(row) });
        summaries.set(row.archive_request_id, list);
      }));
      return { requests: requests.rows.map(row => { const extra = summaries.get(row.id) || []; const view = publicRequest(row, now()); return { ...view, practiceCount: view.practiceCount + extra.length, practiceScores: [...view.practiceScores, ...extra] }; }).filter(row => body.pendingOnly !== true || row.status === 'pending').sort((a, b) => b.createdAt - a.createdAt), hasMore: requests.hasMore || evidence.some(scan => scan.hasMore) };
    }
    if (action === 'revokeDevice') {
      const id = requiredText(body.sessionId, '设备编号', 100);
      await db.runTransaction(async tx => {
        const session = await get(COLLECTIONS.sessions, id, tx);
        if (!tagged(session)) fail(404, '没有找到这台设备的授权。');
        await put(COLLECTIONS.sessions, id, { ...session, revoked_at: now(), revoked_by: staff.code }, tx);
      });
      return {};
    }
    if (action === 'rejectAccess') {
      const id = requiredText(body.requestId, '申请编号', 100);
      await db.runTransaction(async tx => {
        const request = await get(COLLECTIONS.requests, id, tx);
        if (!tagged(request) || request.status !== 'pending') fail(409, '该申请不存在或已处理。');
        await put(COLLECTIONS.requests, id, { ...request, status: 'rejected', rejected_at: now(), rejected_by: staff.code }, tx);
      });
      return {};
    }
    const teacherStartedAt = Date.now();
    const [data, requestScan] = await Promise.all([
      datasets(), action === 'teacherDashboard' ? read(COLLECTIONS.requests, { project_id: PROJECT_ID }) : Promise.resolve(null),
    ]);
    const students = allStudents(data);
    if (action === 'teacherCourseScores') return { students: [...students.values()].map(student => ({ ...publicStudent(student), courseProgress: courseProgressFor(student, data) })), hasMore: data.hasMore };
    if (action === 'teacherDashboard') {
      const requests = requestScan;
      const includeProfiles = staff.code === 'july';
      const result = { teacher: staff, students: [...students.values()].map(student => ({ ...publicStudent(student), ambiguous: Boolean(student.ambiguous), identityConflict: identityConflict(student, data), profile: includeProfiles ? publicProfile(profileFor(student, data)) : null, profileRestricted: !includeProfiles, ...studentSummary(student, data, includeProfiles) })).sort((a, b) => b.lastActive - a.lastActive || a.className.localeCompare(b.className, 'zh-CN')), tasks: data.tasks.map(row => publicTask(row, true)).sort((a, b) => b.updatedAt - a.updatedAt), news: data.news.map(publicNews).sort((a, b) => b.updatedAt - a.updatedAt), requests: requests.rows.map(row => publicRequest(row, now())).sort((a, b) => b.createdAt - a.createdAt), profileRestricted: !includeProfiles, hasMore: data.hasMore || requests.hasMore, warnings: data.hasMore || requests.hasMore ? ['记录数量超过本次读取上限，显示结果可能不完整，请联系管理员分批导出。'] : [] };
      result.returnedRecordCounts = { ...Object.fromEntries(Object.keys(data.scans).map(key => [key, data[key].length])), requests: requests.rows.length };
      result.scannedRecordCounts = { ...Object.fromEntries(Object.entries(data.scans).map(([key, value]) => [key, value.scanned])), requests: requests.rows.length };
      result.collectionTotals = { ...Object.fromEntries(Object.entries(data.scans).map(([key, value]) => [key, value.total])), requests: requests.totalCount };
      result.scanPages = { ...Object.fromEntries(Object.entries(data.scans).map(([key, value]) => [key, value.pages])), requests: requests.pages };
      result.timingsMs = { ...Object.fromEntries(Object.entries(data.scans).map(([key, value]) => [key, value.elapsedMs])), requests: requests.elapsedMs, datasetsAndIndex: data.indexStats.elapsedMs, teacherDashboard: Date.now() - teacherStartedAt };
      logger.info?.('learningArchiveApi teacherDashboard', { counts: result.returnedRecordCounts, scanPages: result.scanPages, timingsMs: result.timingsMs });
      return result;
    }
    if (action === 'teacherStudent') {
      const student = students.get(text(body.studentId, 100));
      if (!student) fail(404, '没有找到该学生。');
      return dashboard(student, data, staff.code === 'july', true);
    }
    // Authenticated teachers may confirm a visible classroom applicant directly.
    // Legacy code-based approval remains valid; neither path auto-trusts a name.
    const classroomApproval = body.approvalMode === 'classroom-confirmation';
    if (body.identityVerified !== true) fail(400, '请先核对是该学生本人及其完整班级，再同意进入。');
    if (data.hasMore) fail(409, '档案读取尚不完整，暂不能安全核验身份，请联系管理员。');
    const requestId = requiredText(body.requestId, '申请编号', 100);
    let verificationCode;
    if (!classroomApproval) {
      verificationCode = requiredText(body.verificationCode, '学生验证码', 6);
      await rate(event, 'approval-code', 8, 15 * 60 * 1000, requestId);
    }
    const request = await get(COLLECTIONS.requests, requestId);
    if (!tagged(request) || request.status !== 'pending' || request.expires_at <= now()) fail(409, '此申请已处理或已过期。');
    if (!classroomApproval && !equalHash(request.verification_hash, hash(`${requestId}|${verificationCode}`))) fail(400, '验证码不匹配，请在学生设备上重新核对。');
    const name = body.name ? requiredText(body.name, '姓名', 60) : request.name;
    const className = body.className ? requiredText(body.className, '完整班级', 100) : request.class_name;
    if (normalizeName(name) !== normalizeName(request.name)) fail(400, '核验姓名与申请不一致，请让学生重新申请。');
    const group = data.directory.resolve({ class_name: className });
    if (group.ambiguous || !group.key.startsWith('class:') || group.key.split(':')[2] === '*') fail(400, '班级身份不明确，请核对并填写完整的年级、专业和班号。');
    let student = body.studentId ? students.get(text(body.studentId, 100)) : students.get(candidateId(group.key, name));
    if (body.studentId && !student) fail(404, '选择的学生档案不存在。');
    if (student && (normalizeName(student.name) !== normalizeName(name) || student.class_key !== group.key)) fail(409, '所选档案的姓名或班级不匹配，不能合并不同班级的学生。');
    if (!student) student = { id: candidateId(group.key, name), name, class_name: group.label, class_key: group.key, project_id: PROJECT_ID, active: true, created_at: now() };
    if (identityConflict(student, data)) fail(409, '同班同名记录出现不同学号，不能批准合并身份。请先核对原始学号和档案归属。');
    const expiresAt = now() + 30 * DAY;
    await db.runTransaction(async tx => {
      const current = await get(COLLECTIONS.requests, requestId, tx);
      if (!tagged(current) || current.status !== 'pending' || current.expires_at <= now()) fail(409, '此申请已处理或已过期。');
      const existing = await get(COLLECTIONS.students, student.id, tx);
      if (existing && (!tagged(existing) || existing.class_key !== student.class_key || normalizeName(existing.name) !== normalizeName(student.name) || existing.active === false)) fail(409, '档案身份冲突，请联系管理员。');
      if (!existing) await put(COLLECTIONS.students, student.id, { ...student, created_at: student.created_at || now(), active: true, approved_by: staff.code }, tx);
      await put(COLLECTIONS.sessions, current.session_id, { id: current.session_id, project_id: PROJECT_ID, auth_version: 1, student_id: student.id, created_at: now(), expires_at: expiresAt, approved_by: staff.code, revoked_at: null }, tx);
      await put(COLLECTIONS.requests, requestId, { ...current, status: 'approved', student_id: student.id, approved_at: now(), approved_by: staff.code, approval_method: classroomApproval ? 'classroom-confirmation' : 'student-code', verified_class_name: className }, tx);
    });
    return { student: publicStudent(student), expiresAt };
  }
  return async function main(event = {}) {
    if (String(event.httpMethod || '').toUpperCase() === 'OPTIONS') return respond(event, 204, {});
    try {
      if (event.httpMethod && String(event.httpMethod).toUpperCase() !== 'POST') fail(405, '请使用POST请求。');
      const origin = headers(event).origin;
      if (origin && !ALLOWED_ORIGINS.has(origin)) fail(403, '此来源未获授权。');
      let body = event.body;
      if (typeof body === 'string') {
        if (body.length > 220000) fail(413, '请求内容过大。');
        const raw = event.isBase64Encoded ? Buffer.from(body, 'base64').toString('utf8') : body;
        if (Buffer.byteLength(raw) > 160000) fail(413, '请求内容过大。');
        try { body = JSON.parse(raw); } catch { fail(400, '请求格式不正确。'); }
      }
      if (!body || typeof body !== 'object' || Array.isArray(body)) fail(400, '请求格式不正确。');
      if (Buffer.byteLength(JSON.stringify(body)) > 160000) fail(413, '请求内容过大。');
      await ensureCollections();
      const result = await dispatch(event, body);
      return respond(event, 200, { ok: true, projectId: PROJECT_ID, ...result });
    } catch (error) {
      if (!(error instanceof ApiError)) logger.error('learningArchiveApi failed', text(error?.code, 80) || 'INTERNAL_ERROR');
      return respond(event, error instanceof ApiError ? error.status : 500, { ok: false, error: error instanceof ApiError ? error.message : '服务暂时不可用，请稍后重试。' });
    }
  };
}

module.exports = { createApi, PROJECT_ID, COLLECTIONS, LEGACY, hash };
