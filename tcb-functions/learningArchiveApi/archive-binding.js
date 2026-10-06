/* oxlint-disable typescript/no-require-imports */
const { createHash } = require('node:crypto');
const { projectSchoolRecord } = require('./school-classes');
const PROJECT_ID = 'lzrtc-public-english-2026';
const hash = value => createHash('sha256').update(String(value)).digest('hex');
const nameKey = value => String(value || '').normalize('NFKC').toLocaleLowerCase('zh-CN').replace(/\s+/g, '');
const denied = message => { const error = new Error(message); error.status = 401; throw error; };
async function get(db, collection, id) {
  try { const result = await db.collection(collection).doc(id).get(); return (Array.isArray(result.data) ? result.data[0] : result.data) || null; }
  catch (error) {
    if (/DATABASE_COLLECTION_NOT_EXIST|DOCUMENT_NOT_EXIST|not.*exist|不存在/i.test(`${error.code || ''} ${error.message || ''}`)) return null;
    throw error;
  }
}
function matches(person, submitted) {
  const actual = projectSchoolRecord({ student_name: person.name, class_name: person.class_name });
  const claimed = projectSchoolRecord({ student_name: submitted.name, class_name: submitted.className });
  return nameKey(actual.student_name) === nameKey(claimed.student_name) && actual.class_name === claimed.class_name && actual.class_identity_name === claimed.class_identity_name;
}
// Name/class are only labels. Ownership always comes from an opaque, server-issued
// credential. Legacy clients still save evidence, but cannot alter an archive.
async function bindArchiveIdentity(db, token, submitted, now = Date.now()) {
  const unverified = { archive_binding_version: 1, archive_binding: 'unverified' };
  if (!token) return unverified;
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) denied('课堂身份已失效，请重新进入；本页录音仍保留。');
  const session = await get(db, 'english_archive_sessions', hash(token));
  if (session) {
    if (session.project_id !== PROJECT_ID || session.auth_version !== 1 || session.revoked_at || !(session.expires_at > now)) denied('此设备授权已到期或撤销，请重新进入。');
    const student = await get(db, 'english_archive_students', session.student_id);
    if (student?.project_id !== PROJECT_ID || student.active === false || !matches(student, submitted)) denied('当前身份与填写的姓名、班级不一致，请切换学生后重新进入。');
    return { archive_binding_version: 1, archive_binding: 'verified', archive_student_id: student.id };
  }
  const practice = await get(db, 'english_archive_practice_sessions', hash(token));
  if (practice?.project_id !== PROJECT_ID || practice.auth_version !== 1 || practice.revoked_at || !(practice.expires_at > now)) denied('课堂身份已到期，请重新填写姓名和班级。');
  const request = await get(db, 'english_archive_access_requests', practice.request_id);
  if (request?.project_id !== PROJECT_ID || !['pending', 'approved'].includes(request.status) || !matches(request, submitted)) denied('申请身份不一致或已拒绝，请联系老师核对。');
  if (request.status === 'approved') {
    const approvedSession = await get(db, 'english_archive_sessions', request.session_id);
    if (approvedSession?.project_id !== PROJECT_ID || approvedSession.revoked_at || !(approvedSession.expires_at > now)) denied('此设备已撤销授权，请重新申请。');
  }
  return { archive_binding_version: 1, archive_binding: 'pending', archive_request_id: request.id };
}
module.exports = { bindArchiveIdentity };
