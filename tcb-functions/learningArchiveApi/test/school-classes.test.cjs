const test = require('node:test');
const assert = require('node:assert/strict');
const { projectSchoolRecord, normalizeSchoolClass, createSchoolClassDirectory } = require('../school-classes');
const { CLASS_CATALOG, COLLEGE_CLASSES, DEFAULT_CLASS } = require('../class-catalog');

test('28 school classes retain exact prefixes, short names and leading zeros', () => {
  assert.equal(CLASS_CATALOG.length, 29);
  assert.equal(new Set(CLASS_CATALOG).size, 29);
  for (const [college, classes] of Object.entries(COLLEGE_CLASSES)) for (const className of classes) {
    const view = projectSchoolRecord({ class_name: className, student_name: '测试同学' });
    assert.equal(view.class_name, className);
    assert.equal(view.normalized_college, college);
  }
  for (const [raw, expected] of [
    ['城轨信号2654', '26-城轨信号54班'], ['人工智能2615', '26-人工智能15班'],
    ['储能1班', '26-储能技术01班'], ['工程测量2604', '26-测量04班'],
    ['智控2608', '26-智控08班'], ['新能源汽车2633', '26-新能源汽车33班'],
    ['机车车辆123', '26-机车123班'], ['机车车辆68班', '26-车辆68班'],
    ['69班电气自动化', '26-电气69班'], ['26+电气68班', '26-电气68班'],
    ['城轨54班', '26-城轨信号54班'], ['2684', '26-铁工84班'],
    ['无人机应用技术2班', '26-无人机2班'], ['酒店管理与数字化运营6班', '26-酒店6班'],
  ]) assert.equal(normalizeSchoolClass(raw), expected, raw);
});

test('mixed name/class entries are split without altering any grade, audio or original', () => {
  const rows = [
    { student_name: '张三26-城轨信号54班', class_name: '城轨信号54班' },
    { student_name: '26-城轨信号54班张三', class_name: '城轨信号54班' },
    { student_name: '张三城轨信号54', class_name: '城轨信号54班' },
    { student_name: '张三', class_name: '铁工84班张三' },
    { student_name: '机车125班', class_name: '张三' },
  ].map(row => Object.freeze({ ...row, id: 'unchanged', average_score: 0, audio_file_id: 'cloud://unchanged', results_json: 'original bytes' }));
  const before = JSON.stringify(rows);
  for (const row of rows) {
    const view = projectSchoolRecord(row);
    assert.equal(view.student_name, '张三');
    assert.equal(view.raw_student_name, row.student_name);
    assert.equal(view.raw_class_name, row.class_name);
    assert.equal(view.average_score, 0);
    assert.equal(view.audio_file_id, row.audio_file_id);
    assert.equal(view.results_json, row.results_json);
    assert.deepEqual(projectSchoolRecord(view), view, 'projection is idempotent');
  }
  assert.equal(JSON.stringify(rows), before);
});

test('ambiguous and unknown classes share only a teacher filter, not a private identity', () => {
  const rows = [{ class_name: '68班', student_name: '同名同学' }, { class_name: '69班', student_name: '同名同学' }, { class_name: '25-机车125班', student_name: '同名同学' }];
  const directory = createSchoolClassDirectory(rows);
  assert.equal(directory.groups.length, 1);
  assert.equal(directory.groups[0].label, DEFAULT_CLASS);
  assert.equal(directory.groups[0].count, 3);
  assert.equal(new Set(rows.map(row => directory.resolve(row).identityKey)).size, 3);
  assert.equal(directory.matches(rows[0], '26-电气68班'), false);
  assert.equal(projectSchoolRecord({ class_name: '68班', major: '电气自动化技术' }).class_name, '26-电气68班');
  assert.equal(projectSchoolRecord({ class_name: '我', student_name: '张三' }).class_name, DEFAULT_CLASS);
});
