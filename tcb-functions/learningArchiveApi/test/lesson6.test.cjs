const test = require('node:test');
const assert = require('node:assert/strict');
const { gradeLesson6, MATCHING } = require('../lesson6');
const { courseCatalog, lessonProgress } = require('../course');

const order = [1, 8, 13, 10, 0, 11, 9, 4, 14, 5];
const letters = 'ABCDEFGHIJKLMNOP';
const correctItems = () => order.map(index => ({ index, selected: letters[index] }));

test('Lesson 6 has exactly sixteen options and includes every required phrase with distinct meanings', () => {
  assert.equal(MATCHING.length, 16);
  assert.equal(new Set(MATCHING.map(item => item[0])).size, 16);
  for (const phrase of ['make a difference', 'put off', 'let alone', 'commit oneself to', 'leave a mark on']) {
    assert.ok(MATCHING.some(([english]) => english === phrase), phrase);
  }
  assert.equal(MATCHING[1][1], '推迟');
  assert.equal(MATCHING[11][1], '更不用说');
  assert.notEqual(MATCHING[13][1], MATCHING[3][1], 'leave a mark on must not be confused with leave behind');
});

test('Lesson 6 grades all ten blanks on the server, ignores browser scores and returns precise feedback', () => {
  const items = correctItems();
  const before = structuredClone(items);
  const result = gradeLesson6({ activity: 'time-matching', items, score: -999, correct: 0 });
  assert.equal(result.total, 10);
  assert.equal(result.correct, 10);
  assert.equal(result.score, 100);
  assert.match(result.title, /Unit 2.*第6课/);
  assert.deepEqual(items, before, 'Grading cannot change submitted answers');
  assert.equal(result.details.feedback.length, 10);
  for (const [i, feedback] of result.details.feedback.entries()) {
    assert.equal(feedback.index, order[i]);
    assert.equal(feedback.en, MATCHING[order[i]][0]);
    assert.equal(feedback.prompt, MATCHING[order[i]][1]);
    assert.equal(feedback.answer, letters[order[i]]);
    assert.equal(feedback.selected, feedback.answer);
    assert.equal(feedback.correct, true);
  }
});

test('Lesson 6 keeps genuine zero scores and awards exactly ten points per correct match', () => {
  const wrong = order.map((index, i) => ({ index, selected: letters[order[(i + 1) % order.length]] }));
  const zero = gradeLesson6({ activity: 'time-matching', items: wrong, score: 100 });
  assert.equal(zero.correct, 0);
  assert.equal(zero.score, 0);
  assert.ok(zero.details.feedback.every(item => !item.correct));
  const mixed = correctItems();
  [mixed[0].selected, mixed[1].selected] = [mixed[1].selected, mixed[0].selected];
  const eighty = gradeLesson6({ activity: 'time-matching', items: mixed, score: 100 });
  assert.equal(eighty.correct, 8);
  assert.equal(eighty.score, 80);
});

test('Lesson 6 rejects incomplete, duplicate, out-of-range and missing-core-phrase submissions', () => {
  const duplicateIndex = correctItems(); duplicateIndex[1].index = duplicateIndex[0].index;
  const duplicateLetter = correctItems(); duplicateLetter[1].selected = duplicateLetter[0].selected;
  const outOfRange = correctItems(); outOfRange[1].index = 16;
  const fractional = correctItems(); fractional[1].index = 1.5;
  const badLetter = correctItems(); badLetter[1].selected = 'Q';
  const lowercase = correctItems(); lowercase[1].selected = 'i';
  const missingCore = correctItems(); missingCore[0] = { index: 2, selected: 'C' };
  const nullItem = correctItems(); nullItem[1] = null;
  for (const items of [null, {}, correctItems().slice(0, 9), [...correctItems(), { index: 2, selected: 'C' }], duplicateIndex, duplicateLetter, outOfRange, fractional, badLetter, lowercase, missingCore, nullItem]) {
    assert.throws(() => gradeLesson6({ activity: 'time-matching', items }), /10个匹配空/);
  }
  assert.throws(() => gradeLesson6({ activity: 'matching1', items: correctItems() }), /不支持/);
});

test('Unit 2 exposes only the sixth taught lesson and progress never creates skipped lesson results', () => {
  const catalog = courseCatalog([]);
  assert.deepEqual(catalog.units.find(unit => unit.number === 1).lessons, [1, 2, 3]);
  assert.deepEqual(catalog.units.find(unit => unit.number === 2).lessons, [3]);
  const selected = courseCatalog([{ kind: 'current', unit: 2, lesson: 1 }]);
  assert.deepEqual(selected.current, { unit: 2, lesson: 3 });
  const progress = lessonProgress({ unit2: [{ activity: 'time-matching', title: 'Unit 2 · 第6课', course_unit: 'Unit 2', course_lesson: 'Lesson 3', score: 0, created_at: 1 }] });
  assert.deepEqual(progress.lessons.map(item => [item.unit, item.lesson, item.latest]), [[2, 3, 0]]);
});
