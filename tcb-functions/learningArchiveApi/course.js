/* Course labels are a view. Historical Unit 2 storage is Unit 1 / Lesson 2. */
const number = value => {
  const match = String(value || '').match(/(?:unit|单元|lesson|第)?\s*(\d+)/i);
  return match ? Number(match[1]) : null;
};
function position(unit, lesson) {
  const u = number(unit), l = number(lesson);
  return u >= 1 && u <= 30 && l >= 1 && l <= 3 ? { unit: u, lesson: l } : null;
}
function courseCatalog(rows, tasks = []) {
  const units = new Map([[1, { number: 1, title: '校园与学习', lessons: [1, 2, 3] }]]);
  for (const row of rows.filter(row => row.kind === 'unit')) units.set(row.number, { number: row.number, title: row.title, lessons: [1, 2, 3], creatorName: row.creator_name });
  for (const task of tasks) {
    const at = position(task.unit, task.lesson);
    if (at && !units.has(at.unit)) units.set(at.unit, { number: at.unit, title: '', lessons: [1, 2, 3] });
  }
  const current = rows.find(row => row.kind === 'current');
  return { units: [...units.values()].sort((a, b) => a.number - b.number), current: current ? { unit: current.unit, lesson: current.lesson } : { unit: 1, lesson: 2 } };
}
function lessonProgress({ speaking = [], words = [], wordUnits = [], unit2 = [], quizzes = [], tasks = [] }) {
  const buckets = new Map(); let unassignedWordCount = 0;
  function add(at, key, title, score, when) {
    if (!at || score == null || score === '' || !Number.isFinite(Number(score))) return;
    const id = `${at.unit}:${at.lesson}`;
    if (!buckets.has(id)) buckets.set(id, { ...at, groups: new Map() });
    const groups = buckets.get(id).groups;
    if (!groups.has(key)) groups.set(key, { key, title, rows: [] });
    groups.get(key).rows.push({ score: Number(score), when: Number(when || 0) });
  }
  for (const row of speaking) add({ unit: 1, lesson: 1 }, `speaking:${row.scene_id}`, row.scene_title || '校园口语', row.total_score, row.submitted_at);
  for (const row of unit2) add({ unit: 1, lesson: 2 }, `activity:${row.activity}:${row.details?.major || ''}`, row.title || row.activity, row.score, row.created_at);
  for (const row of quizzes) {
    const task = tasks.find(item => item.id === row.task_id);
    const at = position(row.course_unit || row.unit || task?.unit, row.course_lesson || row.lesson || task?.lesson);
    add(at, `quiz:${row.task_id}:${row.task_version ?? row.task_updated_at}`, row.task_title || '小测', row.score, row.created_at);
  }
  for (const row of words) {
    let at = position(row.course_unit, row.course_lesson);
    if (!at) {
      const matches = tasks.filter(task => {
        if (task.type !== 'word') return false;
        try {
          const code = new URL(task.href).searchParams.get('unit');
          return code === row.unit_id || wordUnits.some(unit => unit.id === row.unit_id && unit.share_code === code);
        } catch { return false; }
      }).map(task => position(task.unit, task.lesson)).filter(Boolean);
      const unique = new Map(matches.map(item => [`${item.unit}:${item.lesson}`, item]));
      if (unique.size === 1) at = [...unique.values()][0];
    }
    if (!at) { unassignedWordCount++; continue; }
    add(at, `word:${row.unit_id}`, row.unit_title || '单词跟读', row.average_score, row.submitted_at);
  }
  const mean = values => values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length * 10) / 10 : null;
  return { lessons: [...buckets.values()].map(bucket => {
    const items = [...bucket.groups.values()].map(group => {
      group.rows.sort((a, b) => a.when - b.when);
      const first = group.rows[0].score, latest = group.rows.at(-1).score;
      return { key: group.key, title: group.title, first, latest, best: Math.max(...group.rows.map(row => row.score)), attempts: group.rows.length, change: group.rows.length > 1 ? Math.round((latest - first) * 10) / 10 : null };
    });
    const paired = items.filter(item => item.change !== null);
    return { unit: bucket.unit, lesson: bucket.lesson, items, first: mean(items.map(item => item.first)), latest: mean(items.map(item => item.latest)), best: mean(items.map(item => item.best)), change: mean(paired.map(item => item.change)), comparableTasks: paired.length, attempts: items.reduce((sum, item) => sum + item.attempts, 0) };
  }).sort((a, b) => a.unit - b.unit || a.lesson - b.lesson), unassignedWordCount };
}
module.exports = { position, courseCatalog, lessonProgress };
