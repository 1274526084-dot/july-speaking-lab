/* A teacher-only read projection. Never creates an identity, grants access,
 * rewrites a submission, or feeds the student's protected archive. */
const { createSchoolClassDirectory, projectSchoolRecord } = require('./school-classes');
const { parseClassName } = require('./class-groups');

function projectTeacherGrades({ data, requests, catalog, projectId, normalizeName, candidateId }) {
  const requestMap = new Map(requests.filter(row => row.project_id === projectId).map(row => [row.id, row]));
  const requestView = request => projectSchoolRecord({ student_name: request.name, class_name: request.class_name, raw_student_name: request.raw_student_name, raw_class_name: request.raw_class_name });
  const descriptors = [...data.profiles, ...data.words, ...data.speaking, ...data.students,
    ...requests.filter(row => row.project_id === projectId && row.status === 'pending').map(requestView)];
  const directory = createSchoolClassDirectory(descriptors, catalog.map(class_name => ({ class_name })));
  function identity(row, name = row.student_name || row.name) {
    const sourceClass = parseClassName(row.raw_class_name ?? row.class_name);
    if (!sourceClass.major && !row.major && !parseClassName(row.raw_student_name || '').major) return null;
    const group = directory.resolve(row);
    const normalized = normalizeName(name);
    if (!normalized || group.ambiguous || !group.identityKey.startsWith('class:') || group.identityKey.split(':')[2] === '*') return null;
    return { key: `${group.identityKey}\0${normalized}`, group, name, source: row };
  }
  const stored = new Map();
  for (const student of data.students) {
    const item = identity(student, projectSchoolRecord({ ...student, student_name: student.name }).student_name);
    if (!item) continue;
    const bucket = stored.get(item.key) || [];
    bucket.push(student); stored.set(item.key, bucket);
  }
  const candidates = [], review = [], numberEvidence = new Map();
  const pendingIdentity = (request, row) => {
    if (!request || request.status !== 'pending') return null;
    const claimed = identity(requestView(request));
    if (!claimed) return null;
    if (row) {
      const submitted = identity(row);
      if (!submitted || submitted.key !== claimed.key) return null;
      return submitted;
    }
    return claimed;
  };
  for (const kind of ['words', 'speaking']) {
    for (const row of data[kind]) {
      let item = null;
      if (row.archive_binding_version && row.project_id === projectId) {
        if (row.archive_binding === 'pending') {
          const request = requestMap.get(row.archive_request_id);
          if (request?.status === 'approved') {
            const submitted = identity(row), claimed = identity(requestView(request));
            if (kind === 'speaking' && submitted && claimed?.key === submitted.key &&
              stored.get(submitted.key)?.some(student => student.id === request.student_id) && row.student_id) {
              const numbers = numberEvidence.get(submitted.key) || new Set();
              numbers.add(normalizeName(row.student_id)); numberEvidence.set(submitted.key, numbers);
            }
            continue;
          }
          // Missing, rejected, and mismatched claims are never inferred.
          if (!request || request.status !== 'pending') continue;
          item = pendingIdentity(request, row);
        } else if (row.archive_binding === 'unverified') item = identity(row);
        else if (row.archive_binding === 'verified') {
          item = identity(row);
          if (item && kind === 'speaking' && row.student_id) {
            const numbers = numberEvidence.get(item.key) || new Set();
            numbers.add(normalizeName(row.student_id)); numberEvidence.set(item.key, numbers);
          }
          continue;
        } else continue;
        if (item) candidates.push({ kind, row, item });
        else review.push({ className: row.class_name, count: 1 });
      } else if (!row.archive_binding_version) item = identity(row);
      if (item && kind === 'speaking' && row.student_id) {
        const numbers = numberEvidence.get(item.key) || new Set();
        numbers.add(normalizeName(row.student_id)); numberEvidence.set(item.key, numbers);
      }
    }
  }
  for (const row of data.practiceAttempts) {
    const request = requestMap.get(row.access_request_id);
    if (!request || request.status !== 'pending' || !['unit2', 'quiz'].includes(row.attempt_kind)) continue;
    const item = pendingIdentity(request);
    if (item) candidates.push({ kind: row.attempt_kind === 'quiz' ? 'submissions' : 'unit2', row, item });
    else review.push({ className: request.class_name, count: 1 });
  }
  const records = { words: [], speaking: [], submissions: [], unit2: [] };
  const students = new Map(), conflicts = new Set(), counts = new Map(), associated = [];
  for (const { kind, row, item } of candidates) {
    const owners = stored.get(item.key) || [];
    const id = owners[0]?.id || candidateId(item.group.identityKey, item.name);
    if (!owners.length && !students.has(id)) students.set(id, {
      id, name: item.name, class_name: item.group.label, raw_class_name: item.group.label,
      class_identity_name: item.group.label, class_key: item.group.identityKey, project_id: projectId,
    });
    if (owners.length > 1 || (numberEvidence.get(item.key)?.size || 0) > 1) {
      conflicts.add(id); review.push({ className: item.group.label, count: 1 }); continue;
    }
    const view = { ...row, identity_approval: 'self-declared',
      ...(kind === 'words' || kind === 'speaking' ? { archive_student_id: id } : { student_id: id }) };
    records[kind].push(view);
    counts.set(id, (counts.get(id) || 0) + 1);
    associated.push({ className: item.group.label, count: 1 });
  }
  return { records, students: [...students.values()], conflicts, counts, associated, review };
}

module.exports = { projectTeacherGrades };
