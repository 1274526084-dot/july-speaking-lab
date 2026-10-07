/* Read-only bridge to the archive's class ownership and reversible roster maps. */
const { createHash } = require('node:crypto');
const { projectSchoolRecord } = require('./school-classes');
const { DEFAULT_ASSIGNMENTS } = require('./class-ownership');
const PROJECT_ID = 'lzrtc-public-english-2026';
const COLLECTION = 'english_archive_class_normalization';
const fingerprint = row => createHash('sha256').update(JSON.stringify(row)).digest('hex');
const identity = value => String(value || '').normalize('NFKC').trim().toLocaleLowerCase('zh-CN').replace(/\s+/g, '');

async function archiveClassAccess(db) {
  const saved = await db.collection(COLLECTION).doc('teacher-assignments-2026').get();
  const settings = Array.isArray(saved.data) ? saved.data[0] : saved.data;
  const assignments = settings?.project_id === PROJECT_ID && settings.kind === 'teacher-assignments'
    ? settings.assignments : DEFAULT_ASSIGNMENTS;
  const result = await db.collection(COLLECTION).where({ project_id: PROJECT_ID, kind: 'roster-reassignment' }).limit(500).get();
  const rows = Array.isArray(result.data) ? result.data : [];
  if (rows.length >= 500) throw new Error('ARCHIVE_CLASS_MAPPINGS_INCOMPLETE');
  const mappings = new Map(rows.map(row => [`${row.source_collection}:${row.source_id}`, row]));
  function className(row, sourceCollection) {
    const view = projectSchoolRecord(row);
    const mapping = mappings.get(`${sourceCollection}:${row.id || row._id}`);
    return mapping && mapping.source_fingerprint === fingerprint(row)
      && view.class_name === '默认班级（测试）'
      && identity(view.student_name) === mapping.identity_name
      ? mapping.class_name : view.class_name;
  }
  function canSee(code, row, sourceCollection) {
    return code === 'july' || (assignments[code] || []).includes(className(row, sourceCollection));
  }
  return { className, canSee };
}
module.exports = { archiveClassAccess };
