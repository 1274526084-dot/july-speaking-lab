const test = require('node:test');
const assert = require('node:assert/strict');
const { createApi, PROJECT_ID, COLLECTIONS: C, LEGACY, hash } = require('../service');
const { gradeUnit2, unit2Summary } = require('../unit2');

test('school reclassification persists only reversible project mappings, never grades, audio or foreign data', async () => {
  const original = { [LEGACY.words]: [word('own', '张三26-城轨信号54班', '城轨信号2654'), word('unknown-a', '李四', '68班'), word('unknown-b', '李四', '69班'), word('foreign', '重要学生', '城轨信号54班', { project_id: 'malaysia' }), word('malaysia-tagged', '重要学生', '城轨信号54班', { country: 'Malaysia' })] };
  const f = fixture(original);
  const before = JSON.stringify(f.db.rows(LEGACY.words));
  const preview = await f.call('normalizeClasses', { token: f.tokens.july });
  assert.equal(preview.records, 3);
  assert.equal(preview.counts.words.default, 2);
  assert.equal(preview.counts.words.splitNames, 1);
  assert.equal(f.db.rows(C.classNormalization).length, 0);
  assert.equal((await f.call('normalizeClasses', { token: f.tokens.lisa, commit: true })).status, 403);
  const result = await f.call('normalizeClasses', { token: f.tokens.july, commit: true });
  assert.equal(result.committed, true);
  assert.equal(JSON.stringify(f.db.rows(LEGACY.words)), before);
  assert.ok(f.db.writes.every(write => !Object.values(LEGACY).includes(write.collection)));
  assert.equal(f.db.rows(C.classNormalization).length, 3);
  const dashboard = await f.call('teacherDashboard', { token: f.tokens.july });
  const defaults = dashboard.students.filter(student => student.className === '默认班级（测试）');
  assert.equal(defaults.length, 2);
  assert.equal(new Set(defaults.map(student => student.id)).size, 2);
  assert.ok(defaults.every(student => student.historyCount === 1));
  assert.equal(dashboard.students.find(student => student.name === '张三').className, '26-城轨信号54班');
  await f.call('normalizeClasses', { token: f.tokens.july, commit: true });
  assert.equal(f.db.rows(C.classNormalization).length, 3);
  assert.equal(JSON.stringify(f.db.rows(LEGACY.words)), before);
});

test('Unit 2 submissions are server scored, idempotent and bound to the authorized student', async () => {
  const f = fixture({ [LEGACY.profiles]: [profile('keep-profile')], [LEGACY.words]: [word('keep-word')] });
  const auth = await f.authorize();
  const payload = { studentToken: auth.studentToken, requestId: 'unit2-test-0001', activity: 'pinglu', score: 999, answers: ['connects','gives','began','opened','have carried','have learned','are watching','are explaining','will help','are going to write'] };
  const submissions = await Promise.all([f.call('saveUnit2Attempt', payload), f.call('saveUnit2Attempt', payload)]);
  assert.ok(submissions.every(row => row.submission.score === 100));
  assert.equal(f.db.rows(C.unit2).length, 1);
  assert.equal((await f.call('saveUnit2Attempt', { ...payload, answers: Array(10).fill('wrong') })).status, 409);
  f.advance(5);
  assert.equal((await f.call('saveUnit2Attempt', { ...payload, requestId: 'unit2-test-0002', answers: Array(10).fill('wrong') })).submission.score, 0);
  assert.equal(f.db.rows(LEGACY.profiles).length, 1);
  assert.equal(f.db.rows(LEGACY.words).length, 1);
  assert.ok(f.db.writes.every(write => !Object.values(LEGACY).includes(write.collection)));
  const other = await f.authorize('另一位学生');
  assert.equal((await f.call('unit2Dashboard', { studentToken: other.studentToken })).unit2.attemptCount, 0);
  const teacher = await f.call('teacherDashboard', { token: f.tokens.lisa });
  assert.equal(teacher.students.find(row => row.id === auth.studentId).unit2.stages.pinglu.first, 100);
  const detail = await f.call('teacherStudent', { token: f.tokens.lisa, studentId: auth.studentId });
  assert.equal(detail.history.filter(row => row.type === 'unit2').length, 2);
  assert.equal(detail.unit2.stages.pinglu.latest, 0);
  assert.equal((await f.call('saveUnit2Attempt', { ...payload, studentToken: other.studentToken, requestId: 'unit2-test-0003', activity: 'malaysia' })).status, 400);
});

test('Unit 2 validators reject partial games and preserve writing content and missing radar values', () => {
  assert.throws(() => gradeUnit2({ activity: 'verbs', answers: Array(10).fill({verb:'begin',answer:'begun'}) }));
  assert.throws(() => gradeUnit2({ activity: 'writingEssay', major: 'signal', essay: 'Too short.' }));
  const essay='On Monday afternoon, I had my first class in the locomotive training room. At first, I felt nervous because everything was new. I could not find the brake on the model, so I stood there worried. My classmate Li Ming helped me look at a diagram. We found the brake together, and I put the label in the right place. At last, I finished the task. I felt more confident and learned that a little help can make a big difference.';
  const result = gradeUnit2({ activity: 'writingEssay', major: 'train', essay, score: 0 });
  assert.equal(result.score, 100);
  assert.equal(result.details.essay, essay);
  assert.equal(result.details.needsReview, true);
  const summary = unit2Summary([{id:'a',activity:'pinglu',score:0,created_at:10},{id:'b',activity:'pinglu',score:60,created_at:20},{id:'c',activity:'tense',score:80,created_at:30}]);
  assert.equal(summary.pretest, 0);
  assert.equal(summary.change, 80);
  assert.equal(summary.radar.verbs, null);
  assert.equal(summary.radar.writing, null);
  assert.equal(summary.completed, 2);
});

const copy = value => structuredClone(value);
function memoryDb(seed = {}, options = {}) {
  let tables = new Map(Object.entries(seed).map(([name, rows]) => [name, new Map(rows.map(row => [row.id || row._id, copy(row)]))]));
  const writes = [];
  const queries = [];
  const queryStats = new Map();
  let tail = Promise.resolve();
  function client(source, writeLog) {
    return {
      collection(name) {
        if (!source.has(name)) source.set(name, new Map());
        const collection = source.get(name);
        const query = (filters = {}, offset = 0, count = Infinity) => ({
          where: filters2 => query(filters2, offset, count),
          orderBy: () => query(filters, offset, count),
          skip: offset2 => query(filters, offset2, count),
          limit: count2 => query(filters, offset, count2),
          async count() { return { total: [...collection.values()].filter(row => Object.entries(filters).every(([key, value]) => row[key] === value)).length }; },
          async get() {
            queries.push({ collection: name, offset, limit: count });
            const stats = queryStats.get(name) || { active: 0, peak: 0 };
            stats.active += 1; stats.peak = Math.max(stats.peak, stats.active); queryStats.set(name, stats);
            try {
              if (options.delayMs) await new Promise(resolve => setTimeout(resolve, options.delayMs));
              return { data: [...collection].sort(([a], [b]) => a.localeCompare(b)).filter(([, row]) => Object.entries(filters).every(([key, value]) => row[key] === value)).slice(offset, offset + Math.min(count, options.serverPageCap || Infinity)).map(([id, row]) => ({ ...copy(row), _id: id })) };
            } finally { stats.active -= 1; }
          },
          doc(id) {
            return {
              async get() { return { data: collection.has(id) ? [{ ...copy(collection.get(id)), _id: id }] : [] }; },
              async set(value) {
                assert.equal(Object.hasOwn(value, '_id'), false, 'CloudBase rejects writes with _id');
                collection.set(id, copy(value)); writeLog.push({ collection: name, id, value: copy(value) }); return { updated: 1 };
              },
              async remove() { assert.fail('Archive must never delete records'); },
            };
          },
        });
        return query();
      },
    };
  }
  const db = {
    collection: name => client(tables, writes).collection(name),
    async createCollection(name) {
      if (tables.has(name)) { const error = new Error('collection already exists'); error.code = 'DATABASE_COLLECTION_EXIST'; throw error; }
      tables.set(name, new Map()); return {};
    },
    async runTransaction(callback) {
      const transaction = tail.then(async () => {
        const pending = new Map([...tables].map(([key, rows]) => [key, new Map([...rows].map(([id, row]) => [id, copy(row)]))]));
        const pendingWrites = [];
        const result = await callback(client(pending, pendingWrites));
        tables = pending; writes.push(...pendingWrites); return result;
      });
      tail = transaction.catch(() => {});
      return transaction;
    },
    rows: name => [...(tables.get(name)?.values() || [])].map(copy),
    writes,
    queries,
    queryStats,
  };
  return db;
}
function fixture(seed = {}, options = {}) {
  let time = 1800000000000;
  const tokens = { july: 'a'.repeat(64), cherie: 'b'.repeat(64), lisa: 'c'.repeat(64), alice: 'd'.repeat(64), invalid: 'f'.repeat(64) };
  const teacherRows = Object.entries(tokens).map(([code, token]) => ({ id: hash(token), auth_version: 2, teacher_code: code, teacher_name: code, expires_at: time + 30 * 86400000 }));
  const db = memoryDb({ speaking_sessions: teacherRows, ...Object.fromEntries(Object.values(LEGACY).map(name => [name, []])), ...seed }, options.dbOptions);
  const signed = [];
  const storage = { async getTempFileURL({ fileList }) { signed.push(...fileList); return { fileList: fileList.map(file => ({ fileID: file.fileID, tempFileURL: `https://audio.example/${encodeURIComponent(file.fileID)}?expires=300` })) }; } };
  const main = createApi({ db, storage, now: () => time, logger: { error() {} }, ...options });
  async function call(action, payload = {}, event = {}) {
    const response = await main({ httpMethod: 'POST', headers: { origin: 'http://localhost:5179' }, body: { action, ...payload }, ...event });
    return { status: response.statusCode, ...JSON.parse(response.body), headers: response.headers };
  }
  async function authorize(name = '张同学', className = '26-城轨信号54班', extra = {}) {
    const request = await call('requestAccess', { name, className });
    assert.equal(request.status, 'pending');
    const approval = await call('approveAccess', { token: tokens.july, requestId: request.requestId, verificationCode: request.verificationCode, className, identityVerified: true, ...extra });
    assert.equal(approval.ok, true, JSON.stringify(approval));
    const approved = await call('accessStatus', { requestToken: request.requestToken });
    assert.equal(approved.status, 'approved');
    return { ...request, ...approved, studentId: approved.student.id };
  }
  return { db, call, authorize, tokens, signed, advance: amount => { time += amount; }, time: () => time };
}
function profile(id, name = '张同学', className = '26-城轨信号54班', extra = {}) {
  return { id, project_id: PROJECT_ID, student_name: name, class_name: className, major: '城轨信号', admission_type: 'gaokao', skills_json: JSON.stringify({ speaking: 2 }), learning_goals_json: JSON.stringify(['秘密学习目标']), entrance_english_score: 96, submitted_at: 100, ...extra };
}
function word(id, name = '张同学', className = '26-城轨信号54班', extra = {}) {
  return { id, project_id: PROJECT_ID, student_name: name, class_name: className, unit_id: 'unit1', unit_title: 'Unit 1', status: 'completed', average_score: 80, results_json: JSON.stringify([{ word: 'train', system_score: 80, audio_file_id: `cloud://env/${id}.wav` }]), submitted_at: 200, ...extra };
}
function quiz(overrides = {}) {
  return { title: 'Unit 1 check', unit: 'Unit 1', lesson: 'Lesson 1', type: 'quiz', description: '', href: '', classes: ['26-城轨信号54班'], dueAt: null, status: 'published', questions: [{ id: 'q1', prompt: 'Train means?', options: ['火车', '飞机', '轮船', '汽车'], answer: 0, explanation: 'Train is 火车.' }, { id: 'q2', prompt: 'Platform means?', options: ['车站', '站台', '轨道', '信号'], answer: 1, explanation: 'Platform is 站台.' }], ...overrides };
}

test('teacher authentication accepts only current, unexpired, allowed existing speaking sessions', async () => {
  const f = fixture();
  for (const code of ['july', 'cherie', 'lisa', 'alice']) assert.equal((await f.call('teacherDashboard', { token: f.tokens[code] })).ok, true);
  assert.equal((await f.call('teacherDashboard', { token: f.tokens.invalid })).status, 401);
  assert.equal((await f.call('teacherDashboard', { token: 'not-a-token' })).status, 401);
  const session = f.db.rows('speaking_sessions').find(row => row.teacher_code === 'july');
  await f.db.collection('speaking_sessions').doc(session.id).set({ ...session, auth_version: 1 });
  assert.equal((await f.call('teacherDashboard', { token: f.tokens.july })).status, 401);
  await f.db.collection('speaking_sessions').doc(session.id).set({ ...session, expires_at: f.time() - 1 });
  assert.equal((await f.call('teacherDashboard', { token: f.tokens.july })).status, 401);
  await f.db.collection('speaking_sessions').doc(session.id).set({ ...session, project_id: 'malaysia' });
  assert.equal((await f.call('teacherDashboard', { token: f.tokens.july })).status, 401);
});

test('name and class request reveals no data; approval requires identity acknowledgement and verification code', async () => {
  const f = fixture({ [LEGACY.profiles]: [profile('p1')] });
  const request = await f.call('requestAccess', { name: '张同学', className: '26-城轨信号54班' });
  assert.equal(request.status, 'pending');
  assert.match(request.requestToken, /^[0-9a-f]{64}$/);
  assert.match(request.verificationCode, /^\d{6}$/);
  assert.equal(request.profile, undefined);
  assert.equal(request.studentToken, undefined);
  const pending = await f.call('accessStatus', { requestToken: request.requestToken });
  assert.equal(pending.status, 'pending');
  assert.equal(pending.profile, undefined);
  const args = { token: f.tokens.july, requestId: request.requestId, verificationCode: request.verificationCode };
  assert.equal((await f.call('approveAccess', args)).status, 400);
  assert.equal((await f.call('approveAccess', { ...args, identityVerified: true, verificationCode: '000000' })).status, 400);
  const listed = await f.call('listAccessRequests', { token: f.tokens.july });
  assert.equal(listed.requests[0].verificationCode, undefined);
  assert.equal(listed.requests[0].requestToken, undefined);
  const stored = JSON.stringify(f.db.rows(C.requests));
  assert.equal(stored.includes(request.requestToken), false);
  assert.equal(stored.includes(request.verificationCode), false);
});

test('approved access polls reuse a hashed 30-day device session; revocation denies dashboard and token handoff', async () => {
  const f = fixture();
  const approved = await f.authorize();
  const again = await f.call('accessStatus', { requestToken: approved.requestToken });
  assert.equal(again.studentToken, approved.studentToken);
  assert.equal(f.db.rows(C.sessions).length, 1);
  assert.equal(JSON.stringify(f.db.rows(C.sessions)).includes(approved.studentToken), false);
  assert.equal(again.expiresAt - f.time(), 30 * 86400000);
  const teacherView = await f.call('teacherStudent', { token: f.tokens.july, studentId: approved.studentId });
  const revoked = await f.call('revokeDevice', { token: f.tokens.cherie, sessionId: teacherView.devices[0].id });
  assert.equal(revoked.ok, true);
  assert.equal((await f.call('studentDashboard', { studentToken: approved.studentToken })).status, 401);
  assert.equal((await f.call('accessStatus', { requestToken: approved.requestToken })).status, 'revoked');
});

test('request expiry, rejected access and student expiry cannot recover records using a name', async () => {
  const f = fixture();
  const request = await f.call('requestAccess', { name: '张同学', className: '26-城轨信号54班' });
  f.advance(86400001);
  assert.equal((await f.call('accessStatus', { requestToken: request.requestToken })).status, 'expired');
  assert.equal((await f.call('approveAccess', { token: f.tokens.july, requestId: request.requestId, verificationCode: request.verificationCode, identityVerified: true })).status, 409);
  const rejected = await f.call('requestAccess', { name: '李同学', className: '26-城轨信号54班' });
  assert.equal((await f.call('rejectAccess', { token: f.tokens.july, requestId: rejected.requestId })).ok, true);
  assert.equal((await f.call('accessStatus', { requestToken: rejected.requestToken })).status, 'rejected');
  const approved = await f.authorize();
  f.advance(30 * 86400000 + 1);
  assert.equal((await f.call('studentDashboard', { studentToken: approved.studentToken, name: '张同学', className: '26-城轨信号54班' })).status, 401);
});

test('student projection joins safe aliases but never another class, person, project or Malaysia legacy record', async () => {
  const f = fixture({
    [LEGACY.profiles]: [profile('p1'), profile('p2', '张同学', '25-城轨信号54班'), profile('p3', '张同学', '26-城轨信号54班', { project_id: 'malaysia' })],
    [LEGACY.words]: [word('own', '张同学', '26-城市轨道交通通信信号技术054班'), word('other-class', '张同学', '25-城轨信号54班'), word('other-name', '王同学'), word('foreign', '张同学', '26-城轨信号54班', { project_id: 'another-project' }), word('malaysia', '张同学', '26-城轨信号54班', { project_id: undefined, country: 'Malaysia' }), word('legacy-own', '张同学', '城轨信号2654', { project_id: undefined })],
    [LEGACY.speaking]: [{ id: 'sp1', project_id: PROJECT_ID, student_name: '张同学', class_name: '26-城轨信号54班', student_id: 'S1', scene_id: 'club', scene_title: 'Club', total_score: 91, audio_manifest: JSON.stringify([{ key: 'cloud://env/own-sp.webm', round: 1 }]), submitted_at: 300, transcript: 'Hello' }],
  });
  const auth = await f.authorize();
  const result = await f.call('studentDashboard', { studentToken: auth.studentToken, studentId: 'other-class' });
  assert.deepEqual(result.history.map(row => row.id).sort(), ['profile:p1', 'speaking:sp1', 'word:legacy-own', 'word:own']);
  assert.equal(result.profile.learning_goals[0], '秘密学习目标');
  assert.deepEqual(f.signed.map(file => file.fileID).sort(), ['cloud://env/legacy-own.wav', 'cloud://env/own-sp.webm', 'cloud://env/own.wav']);
  assert.ok(f.signed.every(file => file.maxAge === 300));
  assert.equal(JSON.stringify(result).includes('audio_file_id'), false);
  assert.equal(JSON.stringify(result).includes('submit_token_hash'), false);
  assert.ok(result.history.find(row => row.id === 'word:own').audio[0].url.startsWith('https:'));
});

test('teacher selection cannot merge same-name pupils in two classes', async () => {
  const f = fixture({ [LEGACY.words]: [word('w1'), word('w2', '张同学', '26-城轨信号53班')] });
  const dashboard = await f.call('teacherDashboard', { token: f.tokens.july });
  assert.equal(dashboard.students.length, 2);
  const other = dashboard.students.find(student => student.className.includes('53'));
  const request = await f.call('requestAccess', { name: '张同学', className: '26-城轨信号54班' });
  assert.equal((await f.call('approveAccess', { token: f.tokens.july, requestId: request.requestId, verificationCode: request.verificationCode, identityVerified: true, studentId: other.id })).status, 409);
  assert.equal(f.db.rows(C.sessions).length, 0);
});

test('ambiguous incomplete classes require teacher corroboration and never merge by class number', async () => {
  const f = fixture({ [LEGACY.words]: [word('w1', '张同学', '26-电气68班'), word('w2', '张同学', '26-铁道车辆68班')] });
  const request = await f.call('requestAccess', { name: '张同学', className: '68班' });
  const args = { token: f.tokens.july, requestId: request.requestId, verificationCode: request.verificationCode, identityVerified: true };
  assert.equal((await f.call('approveAccess', args)).status, 400);
  assert.equal((await f.call('approveAccess', { ...args, className: '26-电气68班' })).ok, true);
  const auth = await f.call('accessStatus', { requestToken: request.requestToken });
  const view = await f.call('studentDashboard', { studentToken: auth.studentToken });
  assert.deepEqual(view.history.map(row => row.id), ['word:w1']);
});

test('legacy survey detail remains July-only across teacher summaries and individual history', async () => {
  const f = fixture({ [LEGACY.profiles]: [profile('p1')], [LEGACY.words]: [word('w1')] });
  const july = await f.call('teacherDashboard', { token: f.tokens.july });
  assert.equal(july.students[0].profile.entrance_english_score, 96);
  const cherie = await f.call('teacherDashboard', { token: f.tokens.cherie });
  assert.equal(cherie.profileRestricted, true);
  assert.equal(cherie.students[0].profile, null);
  assert.equal(cherie.students[0].historyCount, 1);
  const student = await f.call('teacherStudent', { token: f.tokens.cherie, studentId: cherie.students[0].id });
  assert.equal(student.profileRestricted, true);
  assert.equal(student.profile, null);
  assert.deepEqual(student.history.map(row => row.type), ['word']);
  assert.equal(JSON.stringify(student).includes('秘密学习目标'), false);
});

test('reflections append immutable snapshots and do not write any legacy collection', async () => {
  const original = profile('p1');
  const f = fixture({ [LEGACY.profiles]: [original], [LEGACY.words]: [word('w1')] });
  const auth = await f.authorize();
  const skills = { listening: 1, speaking: 2, reading: 3, writing: 4, vocabulary: 5, grammar: 2, pronunciation: 3 };
  const first = await f.call('saveReflection', { studentToken: auth.studentToken, skills, goals: '每天练习单词' });
  f.advance(1000);
  const second = await f.call('saveReflection', { studentToken: auth.studentToken, skills: { ...skills, speaking: 4 }, goals: '每天练习口语' });
  assert.equal(first.ok, true); assert.equal(second.ok, true);
  assert.notEqual(first.snapshot.id, second.snapshot.id);
  const view = await f.call('studentDashboard', { studentToken: auth.studentToken });
  assert.equal(view.snapshots.length, 2);
  assert.equal(view.snapshots[1].skills.speaking, 2);
  assert.deepEqual(f.db.rows(LEGACY.profiles), [original]);
  assert.ok(f.db.writes.every(write => write.collection.startsWith('english_archive_')));
  assert.equal((await f.call('saveReflection', { studentToken: auth.studentToken, skills: { ...skills, speaking: 9 }, goals: 'invalid' })).status, 400);
});

test('quiz answers stay private until server-scored submission; retries are idempotent and immutable', async () => {
  const f = fixture();
  const saved = await f.call('saveTask', { token: f.tokens.july, task: quiz() });
  assert.equal(saved.ok, true);
  assert.equal(saved.task.questions[0].answer, 0);
  const feed = await f.call('publicFeed');
  assert.equal(feed.tasks[0].questions[0].answer, undefined);
  assert.equal(feed.tasks[0].questions[0].explanation, undefined);
  const auth = await f.authorize();
  const dashboard = await f.call('studentDashboard', { studentToken: auth.studentToken });
  assert.equal(dashboard.tasks[0].questions[0].answer, undefined);
  const payload = { studentToken: auth.studentToken, taskId: saved.task.id, taskVersion: saved.task.version, requestId: 'request-123456', answers: [0, 0] };
  const [first, retry] = await Promise.all([f.call('submitQuiz', payload), f.call('submitQuiz', payload)]);
  assert.equal(first.score, 50); assert.equal(retry.score, 50);
  assert.equal(first.feedback[1].answer, 1);
  assert.equal(first.submission.id, retry.submission.id);
  assert.equal(f.db.rows(C.submissions).length, 1);
  assert.equal((await f.call('submitQuiz', { ...payload, answers: [0, 1] })).status, 409);
  await f.call('saveTask', { token: f.tokens.july, task: { ...quiz(), id: saved.task.id, questions: quiz().questions.map(question => ({ ...question, answer: 3 })) } });
  const unchanged = await f.call('submitQuiz', payload);
  assert.equal(unchanged.score, 50);
  assert.equal((await f.call('studentDashboard', { studentToken: auth.studentToken })).summary.quizAverage, 50);
  const history = (await f.call('studentDashboard', { studentToken: auth.studentToken })).history;
  assert.equal(history[0].taskId, saved.task.id);
  assert.equal(history[0].details.taskVersion, saved.task.version);
});

test('quiz cannot be submitted by another class or from a draft; task ownership supports copying', async () => {
  const f = fixture();
  const saved = await f.call('saveTask', { token: f.tokens.cherie, task: quiz({ status: 'draft' }) });
  const auth = await f.authorize();
  const payload = { studentToken: auth.studentToken, taskId: saved.task.id, taskVersion: saved.task.version, requestId: 'request-draft-123', answers: [0, 1] };
  assert.equal((await f.call('submitQuiz', payload)).status, 404);
  assert.equal((await f.call('saveTask', { token: f.tokens.lisa, task: { ...quiz(), id: saved.task.id } })).status, 403);
  assert.equal((await f.call('saveTask', { token: f.tokens.lisa, task: quiz() })).ok, true);
  assert.equal((await f.call('saveTask', { token: f.tokens.july, task: { ...quiz(), id: saved.task.id, classes: ['26-城轨信号53班'] } })).ok, true);
  assert.equal((await f.call('submitQuiz', payload)).status, 404);
});

test('news is published only by teacher action; harmful links and unapproved origins are rejected', async () => {
  const f = fixture();
  const news = { title: 'Railway update', summary: 'A classroom reading.', url: 'https://example.org/article', source: 'Rail authority', publishedDate: '2026-09-28', vocabulary: [{ word: 'rail', meaning: '铁轨' }], question: 'What changed?', status: 'draft' };
  assert.equal((await f.call('saveNews', { news })).status, 401);
  const saved = await f.call('saveNews', { token: f.tokens.july, news });
  assert.equal(saved.ok, true);
  assert.equal((await f.call('publicFeed')).news.length, 0);
  assert.equal((await f.call('saveNews', { token: f.tokens.july, news: { ...news, id: saved.news.id, status: 'published' } })).ok, true);
  assert.equal((await f.call('publicFeed')).news.length, 1);
  assert.equal((await f.call('saveNews', { token: f.tokens.july, news: { ...news, url: 'javascript:alert(1)' } })).status, 400);
  assert.equal((await f.call('saveTask', { token: f.tokens.july, task: { ...quiz(), href: 'data:text/html,hello' } })).status, 400);
  assert.equal((await f.call('publicFeed', {}, { headers: { origin: 'https://untrusted.example' } })).status, 403);
  assert.equal((await f.call('publicFeed')).headers['Access-Control-Allow-Origin'], 'http://localhost:5179');
});

test('pagination loads beyond a single database page; capped data is explicitly marked and blocks unsafe approval', async () => {
  const rows = Array.from({ length: 205 }, (_, index) => word(`w-${String(index).padStart(4, '0')}`));
  const f = fixture({ [LEGACY.words]: rows });
  const view = await f.call('teacherDashboard', { token: f.tokens.july });
  assert.equal(view.students[0].historyCount, 205);
  assert.equal(view.hasMore, false);
  const capped = fixture({ [LEGACY.words]: rows }, { maxRows: 100 });
  const partial = await capped.call('teacherDashboard', { token: capped.tokens.july });
  assert.equal(partial.students[0].historyCount, 100);
  assert.equal(partial.hasMore, true);
  assert.ok(partial.warnings.length);
  const request = await capped.call('requestAccess', { name: '张同学', className: '26-城轨信号54班' });
  assert.equal((await capped.call('approveAccess', { token: capped.tokens.july, requestId: request.requestId, verificationCode: request.verificationCode, identityVerified: true })).status, 409);
});

test('bad request bodies and rate limits return proper statuses without internal error detail', async () => {
  const f = fixture();
  assert.equal((await f.call('publicFeed', {}, { body: '{broken' })).status, 400);
  assert.equal((await f.call('publicFeed', {}, { httpMethod: 'GET' })).status, 405);
  assert.equal((await f.call('publicFeed', { padding: 'x'.repeat(180000) })).status, 413);
  for (let count = 0; count < 6; count++) assert.equal((await f.call('requestAccess', { name: '张同学', className: '26-城轨信号54班' })).ok, true);
  assert.equal((await f.call('requestAccess', { name: '张同学', className: '26-城轨信号54班' })).status, 429);
});

test('different student numbers for one class and name block approval instead of widening a legacy match', async () => {
  const speaking = (id, studentId, className = '26-城轨信号54班') => ({ id, student_name: '张同学', student_id: studentId, class_name: className, project_id: PROJECT_ID, scene_id: 'club', total_score: 80, audio_manifest: JSON.stringify([{ key: `cloud://env/${id}.wav` }]) });
  const f = fixture({ [LEGACY.speaking]: [speaking('s1', '20260101'), speaking('s2', '20260102')] });
  const staff = await f.call('teacherDashboard', { token: f.tokens.july });
  assert.equal(staff.students[0].identityConflict, true);
  const request = await f.call('requestAccess', { name: '张同学', className: '26-城轨信号54班' });
  const approval = await f.call('approveAccess', { token: f.tokens.july, requestId: request.requestId, verificationCode: request.verificationCode, identityVerified: true, studentId: staff.students[0].id });
  assert.equal(approval.status, 409);
  assert.match(approval.error, /不同学号/);
  assert.equal(f.db.rows(C.sessions).length, 0);
  assert.equal(f.db.rows(C.students).length, 0);
  assert.equal(f.signed.length, 0);
  assert.equal((await f.call('accessStatus', { requestToken: request.requestToken })).status, 'pending');

  const safe = fixture({ [LEGACY.speaking]: [speaking('s1', '20260101'), speaking('s2', '20260101'), speaking('s3', '20260102', '26-城轨信号53班')] });
  const approved = await safe.authorize();
  const own = await safe.call('studentDashboard', { studentToken: approved.studentToken });
  assert.deepEqual(own.history.map(row => row.id).sort(), ['speaking:s1', 'speaking:s2']);
});

test('a new conflicting student number suspends an existing device before reading or adding records', async () => {
  const f = fixture({ [LEGACY.words]: [word('w1')] });
  const auth = await f.authorize();
  for (const [id, studentId] of [['s1', '20260101'], ['s2', '20260102']]) {
    await f.db.collection(LEGACY.speaking).doc(id).set({ id, student_name: '张同学', student_id: studentId, class_name: '26-城轨信号54班', project_id: PROJECT_ID, scene_id: 'club', audio_manifest: JSON.stringify([{ key: `cloud://env/${id}.wav` }]) });
  }
  const before = f.db.rows(LEGACY.speaking);
  const view = await f.call('studentDashboard', { studentToken: auth.studentToken, studentId: '20260101' });
  assert.equal(view.status, 409);
  assert.equal(view.history, undefined);
  assert.equal(f.signed.length, 0);
  assert.equal((await f.call('saveReflection', { studentToken: auth.studentToken, skills: {}, goals: 'Do not guess' })).status, 409);
  assert.equal(f.db.rows(C.reflections).length, 0);
  assert.deepEqual(f.db.rows(LEGACY.speaking), before);
  const teacher = await f.call('teacherStudent', { token: f.tokens.july, studentId: auth.studentId });
  assert.equal(teacher.identityConflict, true);
  assert.match(teacher.warnings.join(' '), /不同学号/);
  assert.deepEqual(teacher.history.filter(row => row.type === 'speaking').map(row => row.details.studentId).sort(), ['20260101', '20260102']);
});

test('changed quiz versions are rejected before scoring and a reopened version can be submitted', async () => {
  const f = fixture();
  const initial = await f.call('saveTask', { token: f.tokens.july, task: quiz() });
  const auth = await f.authorize();
  const updated = await f.call('saveTask', { token: f.tokens.july, task: { ...quiz(), id: initial.task.id, questions: quiz().questions.map(question => ({ ...question, answer: 3 })) } });
  assert.notEqual(initial.task.version, updated.task.version, 'Even two saves in one millisecond must have different versions');
  const payload = { studentToken: auth.studentToken, taskId: initial.task.id, taskVersion: initial.task.version, requestId: 'changed-version-request', answers: [0, 1] };
  const stale = await f.call('submitQuiz', payload);
  assert.equal(stale.status, 409);
  assert.match(stale.error, /刷新任务/);
  assert.equal(stale.feedback, undefined);
  assert.equal(f.db.rows(C.submissions).length, 0);
  const current = await f.call('submitQuiz', { ...payload, taskVersion: updated.task.version });
  assert.equal(current.score, 0);
  assert.equal(current.submission.taskVersion, updated.task.version);
  const retry = await f.call('submitQuiz', payload);
  assert.equal(retry.submission.id, current.submission.id, 'An already committed request wins over the changed or absent client version');
  assert.equal(retry.score, 0);
  assert.equal(f.db.rows(C.submissions).length, 1);
});

test('legacy numeric task versions stay numeric and require an exact type match', async () => {
  const f = fixture();
  const saved = await f.call('saveTask', { token: f.tokens.july, task: quiz() });
  const row = f.db.rows(C.tasks)[0];
  delete row.version;
  await f.db.collection(C.tasks).doc(row.id).set(row);
  const feed = await f.call('publicFeed');
  assert.equal(feed.tasks[0].version, f.time());
  const auth = await f.authorize();
  const payload = { studentToken: auth.studentToken, taskId: saved.task.id, requestId: 'numeric-version-request', answers: [0, 1] };
  assert.equal((await f.call('submitQuiz', { ...payload, taskVersion: String(f.time()) })).status, 409);
  assert.equal((await f.call('submitQuiz', payload)).status, 409);
  assert.equal((await f.call('submitQuiz', { ...payload, taskVersion: f.time() })).score, 100);
});

test('all teacher request payloads omit verification secrets and revoked status carries no reusable token', async () => {
  const f = fixture();
  const request = await f.call('requestAccess', { name: '张同学', className: '26-城轨信号54班' });
  for (const action of ['listAccessRequests', 'teacherDashboard']) {
    const response = await f.call(action, { token: f.tokens.cherie });
    const row = response.requests[0];
    for (const secretKey of ['verificationCode', 'verification_hash', 'requestToken', 'request_token_hash', 'session_id']) assert.equal(Object.hasOwn(row, secretKey), false);
    assert.ok(Object.values(row).every(value => value !== request.verificationCode && value !== request.requestToken));
  }
  const approved = await f.call('approveAccess', { token: f.tokens.july, requestId: request.requestId, verificationCode: request.verificationCode, identityVerified: true });
  assert.equal(approved.studentToken, undefined);
  const handoff = await f.call('accessStatus', { requestToken: request.requestToken });
  const teacher = await f.call('teacherStudent', { token: f.tokens.july, studentId: handoff.student.id });
  await f.call('revokeDevice', { token: f.tokens.july, sessionId: teacher.devices[0].id });
  const revoked = await f.call('accessStatus', { requestToken: request.requestToken });
  assert.equal(revoked.status, 'revoked');
  assert.equal(revoked.studentToken, undefined);
  assert.equal(revoked.student, undefined);
});

test('an existing device cannot use truncated identity evidence to bypass a hidden namesake check', async () => {
  const f = fixture({}, { maxRows: 100 });
  const auth = await f.authorize();
  for (let index = 0; index < 101; index++) {
    const id = `s-${String(index).padStart(4, '0')}`;
    await f.db.collection(LEGACY.speaking).doc(id).set({ id, project_id: PROJECT_ID, student_name: '张同学', class_name: '26-城轨信号54班', scene_id: 'club', student_id: index === 100 ? '20260102' : '20260101' });
  }
  const result = await f.call('studentDashboard', { studentToken: auth.studentToken });
  assert.equal(result.status, 409);
  assert.match(result.error, /读取上限/);
  assert.equal(result.history, undefined);
  assert.equal(f.signed.length, 0);
});

test('large dashboards keep every record with bounded concurrent pages and no per-student audio expansion', async t => {
  const aliases = ['26-城轨信号54班', '城轨信号2654', '26-城市轨道交通通信信号技术054班'];
  const rows = Array.from({ length: 6205 }, (_, index) => word(`w-${String(index).padStart(5, '0')}`, `学生${index % 1000}`, aliases[index % aliases.length]));
  const f = fixture({ [LEGACY.words]: rows }, { dbOptions: { delayMs: 1 } });
  const started = performance.now();
  const view = await f.call('teacherDashboard', { token: f.tokens.july });
  t.diagnostic(`6,205 records / 1,000 students processed in ${Math.round(performance.now() - started)} ms (local transactional mock)`);
  assert.equal(view.ok, true);
  assert.equal(view.hasMore, false);
  assert.equal(view.students.length, 1000);
  assert.equal(view.students.reduce((sum, student) => sum + student.wordCount, 0), 6205);
  assert.ok(view.students.every(student => student.wordAverage === 80));
  assert.equal(view.returnedRecordCounts.words, 6205);
  assert.equal(view.scannedRecordCounts.words, 6205);
  assert.equal(view.collectionTotals.words, 6205);
  assert.ok(view.scanPages.words <= 9, 'Large collection must not require one remote request per 100 records');
  assert.equal(f.db.queryStats.get(LEGACY.words).peak, 4);
  assert.equal(f.signed.length, 0);
  assert.equal(JSON.stringify(view).includes('cloud://'), false);
  assert.ok(view.timingsMs.teacherDashboard >= 0);
});

test('a smaller service-side page cap is detected by count and does not masquerade as a full scan', async () => {
  const rows = Array.from({ length: 1205 }, (_, index) => word(`w-${String(index).padStart(5, '0')}`));
  const f = fixture({ [LEGACY.words]: rows }, { dbOptions: { serverPageCap: 100 } });
  const view = await f.call('teacherDashboard', { token: f.tokens.july });
  assert.equal(view.ok, true);
  assert.equal(view.hasMore, false);
  assert.equal(view.students[0].wordCount, 1205);
  assert.equal(view.scannedRecordCounts.words, 1205);
  assert.equal(view.collectionTotals.words, 1205);
  assert.ok(f.db.queries.some(query => query.collection === LEGACY.words && query.offset >= 1000));
});

test('indexed identity checks still include conflicting student numbers after page 1000 and safe class aliases', async () => {
  const rows = Array.from({ length: 1205 }, (_, index) => ({ id: `s-${String(index).padStart(5, '0')}`, project_id: PROJECT_ID, student_name: '张同学', class_name: index % 2 ? '城轨信号2654' : '26-城轨信号54班', student_id: index === 1204 ? '20260202' : '20260101', scene_id: 'club', total_score: 85 }));
  const f = fixture({ [LEGACY.speaking]: rows });
  const view = await f.call('teacherDashboard', { token: f.tokens.july });
  assert.equal(view.students.length, 1);
  assert.equal(view.students[0].speakingCount, 1205);
  assert.equal(view.students[0].identityConflict, true);
  const request = await f.call('requestAccess', { name: '张同学', className: '26-城轨信号54班' });
  const approval = await f.call('approveAccess', { token: f.tokens.july, requestId: request.requestId, verificationCode: request.verificationCode, identityVerified: true });
  assert.equal(approval.status, 409);
  assert.equal(f.db.rows(C.sessions).length, 0);
});

test('indexed summaries equal the authorized detail view, including July profile restrictions and zero scores', async () => {
  const f = fixture({
    [LEGACY.profiles]: [profile('p1'), profile('p2', '另一学生', '26-城轨信号53班'), profile('p-old', '张同学', '54班', { major: '城轨信号', project_id: undefined, submitted_at: 99999 })],
    [LEGACY.words]: [word('w1', '张同学', '城轨信号2654', { average_score: 0 }), word('w2', '张同学', '26-城轨信号54班', { average_score: 100 }), word('w3', '另一学生', '26-城轨信号53班', { average_score: null })],
  });
  for (const code of ['july', 'cherie']) {
    const view = await f.call('teacherDashboard', { token: f.tokens[code] });
    for (const student of view.students) {
      const detail = await f.call('teacherStudent', { token: f.tokens[code], studentId: student.id });
      for (const [key, value] of Object.entries(detail.summary)) assert.equal(student[key], value, `${code}: ${key}`);
      assert.deepEqual(student.profile, detail.profile);
    }
  }
  const auth = await f.authorize();
  const own = await f.call('studentDashboard', { studentToken: auth.studentToken });
  assert.equal(own.profile.id, 'p1', 'Project-tagged profile remains preferred over a newer untagged legacy profile');
  assert.equal(own.summary.wordAverage, 50);
  assert.equal(own.returnedRecordCounts, undefined);
  assert.equal((await f.call('publicFeed')).collectionTotals, undefined);
});
