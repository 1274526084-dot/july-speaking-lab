const test = require('node:test');
const assert = require('node:assert/strict');
const {gradeLesson6} = require('../lesson6');
const {PASSAGE,CHOICES,BLANKS} = require('../lesson6-reading');
const correct = () => ({activity:'time-reading',choices:[1,3,0,2,1],blanks:['24 hours','fruitless yesterday','deepest respect']});
test('Lesson6 reading preserves seven passage paragraphs and eight grounded questions',()=>{
  assert.equal(PASSAGE.length,7);assert.equal(CHOICES.length,5);assert.equal(BLANKS.length,3);
  assert.ok(PASSAGE[3].includes('single-colored struggle rather than a rainbow-like experience'));
  for(const q of CHOICES){assert.equal(q.options.length,4);assert.equal(new Set(q.options).size,4);assert.ok(q.explanation&&q.paragraph);}
  for(const q of BLANKS){assert.ok(PASSAGE.some(p=>p.replace(/[“”]/g,'').includes(q.answer)));assert.ok(q.answer.split(' ').length<=3);}
});
test('Lesson6 reading awards two points per choice and one per blank, with server-owned grading',()=>{
  const body=correct(), original=structuredClone(body);body.score=0;body.correct=-99;
  const full=gradeLesson6(body);assert.equal(full.total,13);assert.equal(full.correct,13);assert.equal(full.score,100);assert.equal(full.details.feedback.length,8);
  assert.deepEqual(full.answers,{choices:original.choices,blanks:original.blanks});assert.deepEqual(body.choices,original.choices);
  const oneChoice=correct();oneChoice.choices[0]=0;assert.equal(gradeLesson6(oneChoice).correct,11);assert.equal(gradeLesson6(oneChoice).score,85);
  const oneBlank=correct();oneBlank.blanks[2]='wrong';assert.equal(gradeLesson6(oneBlank).correct,12);assert.equal(gradeLesson6(oneBlank).score,92);
  const zero=gradeLesson6({activity:'time-reading',choices:[0,0,1,0,0],blanks:['wrong','wrong','wrong'],score:100});assert.equal(zero.score,0);
});
test('Lesson6 reading accepts harmless case, punctuation and spacing while rejecting incomplete or overlong input',()=>{
  assert.equal(gradeLesson6({activity:'time-reading',choices:[1,3,0,2,1],blanks:[' 24  HOURS. ','Fruitless “yesterday”','DEEPEST RESPECT']}).score,100);
  assert.equal(gradeLesson6({...correct(),blanks:['twenty-four hours','fruitless yesterday','deepest respect']}).score,100);
  for(const body of [{...correct(),choices:[1,3]}, {...correct(),choices:[1,3,0,2,true]}, {...correct(),choices:[1,3,0,2,4]}, {...correct(),blanks:['24 hours','','respect']}, {...correct(),blanks:['one two three four','x','y']}, {...correct(),blanks:[null,'x','y']}, {...correct(),blanks:['a'.repeat(101),'x','y']}])assert.throws(()=>gradeLesson6(body),/3个英文词/);
});
