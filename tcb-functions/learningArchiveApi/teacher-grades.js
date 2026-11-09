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
  const candidates = [], legacyGrades = [], review = [], numberEvidence = new Map(), ownerNumbers = new Map();
  function rememberNumber(item, row, ownerId) {
    const number = normalizeName(row.student_id);
    if (!item || !number) return;
    const numbers = numberEvidence.get(item.key) || new Set();
    numbers.add(number);
    numberEvidence.set(item.key, numbers);
    if (ownerId && stored.get(item.key)?.some(student => student.id === ownerId)) {
      const verified = ownerNumbers.get(ownerId) || new Set();
      verified.add(number);
      ownerNumbers.set(ownerId, verified);
    }
  }
  const pendingIdentity = (request, row) => {
    if (!request || request.status !== 'pending') return null;
    const claimed = identity(requestView(request));
    if (!claimed) return null;
    if (row) {
      const submitted = identity(row);
      if (submitted) return submitted.key === claimed.key ? submitted : null;
      // A stored request with a complete class can corroborate its own legacy
      // submission if the school directory resolves the abbreviated class uniquely.
      const group = directory.resolve(row);
      if (group.ambiguous || group.identityKey !== claimed.group.identityKey ||
          normalizeName(row.student_name) !== normalizeName(claimed.name)) return null;
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
            if (kind === 'speaking' && submitted && claimed?.key === submitted.key)
              rememberNumber(submitted, row, request.student_id);
            continue;
          }
          // Missing, rejected, and mismatched claims are never inferred.
          if (!request || request.status !== 'pending') continue;
          item = pendingIdentity(request, row);
        } else if (row.archive_binding === 'unverified') item = identity(row);
        else if (row.archive_binding === 'verified') {
          item = identity(row);
          if (kind === 'speaking') rememberNumber(item, row, row.archive_student_id);
          continue;
        } else continue;
        if (item) candidates.push({ kind, row, item });
        else review.push({ className: row.class_name, count: 1 });
      } else if (!row.archive_binding_version) {
        item = identity(row);
        if (item) legacyGrades.push(item);
      }
      if (kind === 'speaking') rememberNumber(item, row);
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
  const aliases = new Map(), mergedOwners = new Map(), unresolvedOwners = new Set();
  const unresolvedKeys = new Set();
  for (const [key, owners] of stored) {
    if (owners.length < 2) continue;
    const numbers = numberEvidence.get(key);
    const number = numbers?.values().next().value;
    if (data.hasMore || numbers?.size !== 1 || !owners.every(student => ownerNumbers.get(student.id)?.has(number))) {
      unresolvedKeys.add(key);
      for (const student of owners) {
        conflicts.add(student.id);
        unresolvedOwners.add(student.id);
      }
      continue;
    }
    const [classKey, nameKey] = key.split('\0');
    const preferredId = candidateId(classKey, nameKey);
    const primary = owners.find(student => student.id === preferredId) || [...owners].sort((a, b) => a.id.localeCompare(b.id))[0];
    const ids = owners.map(student => student.id);
    mergedOwners.set(primary.id, ids);
    for (const id of ids) if (id !== primary.id) aliases.set(id, primary.id);
  }
  for (const item of legacyGrades) {
    if (unresolvedKeys.has(item.key)) review.push({ className: item.group.label, count: 1 });
  }
  for (const { kind, row, item } of candidates) {
    const owners = stored.get(item.key) || [];
    const ownerId = owners[0]?.id;
    const id = aliases.get(ownerId) || ownerId || candidateId(item.group.identityKey, item.name);
    if (!owners.length && !students.has(id)) students.set(id, {
      id, name: item.name, class_name: item.group.label, raw_class_name: item.group.label,
      class_identity_name: item.group.label, class_key: item.group.identityKey, project_id: projectId,
    });
    if (conflicts.has(id) || (numberEvidence.get(item.key)?.size || 0) > 1) {
      conflicts.add(id); review.push({ className: item.group.label, count: 1 }); continue;
    }
    const view = { ...row, identity_approval: 'self-declared',
      ...(kind === 'words' || kind === 'speaking' ? { archive_student_id: id } : { student_id: id }) };
    records[kind].push(view);
    counts.set(id, (counts.get(id) || 0) + 1);
    associated.push({ className: item.group.label, count: 1 });
  }
  return { records, students: [...students.values()], conflicts, counts, associated, review, aliases, mergedOwners, unresolvedOwners };
}

module.exports = { projectTeacherGrades };
