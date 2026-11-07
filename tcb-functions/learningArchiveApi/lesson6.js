/* Unit 2 / internal Lesson 3 is the sixth taught lesson. Server-owned bank. */
const MATCHING = [
  ['interaction', '互动；相互作用'],
  ['put off', '推迟'],
  ['carrier', '载体；运送者'],
  ['leave behind', '留下'],
  ['inspiring', '鼓舞人心的'],
  ['make a difference', '起作用；带来改变'],
  ['fruitless', '无结果的'],
  ['on earth', '究竟'],
  ['attitude', '态度；看法'],
  ['commit oneself to', '致力于……'],
  ['vary', '变化；有不同'],
  ['let alone', '更不用说'],
  ['slack off', '懈怠；松懈'],
  ['leave a mark on', '在……上留下印记'],
  ['deserve', '值得；应受'],
  ['remarkable', '非凡的'],
];
const CORE = [1, 5, 9, 11, 13];
const LETTERS = 'ABCDEFGHIJKLMNOP';
function gradeLesson6(body) {
  const items = body.items;
  if (body.activity !== 'time-matching') throw new Error('不支持的第六课任务。');
  if (!Array.isArray(items) || items.length !== 10 ||
    items.some(item => !item || !Number.isInteger(item.index) || item.index < 0 || item.index >= MATCHING.length ||
      typeof item.selected !== 'string' || !/^[A-P]$/.test(item.selected)) ||
    new Set(items.map(item => item.index)).size !== 10 ||
    new Set(items.map(item => item.selected)).size !== 10 ||
    CORE.some(index => !items.some(item => item.index === index)))
    throw new Error('请完成5道双空题：10个匹配空均须作答，每个字母只能使用一次，并保留本轮5个重点词组。');
  const feedback = items.map(item => ({
    index: item.index, prompt: MATCHING[item.index][1], en: MATCHING[item.index][0],
    selected: item.selected, answer: LETTERS[item.index], correct: item.selected === LETTERS[item.index],
  }));
  const correct = feedback.filter(item => item.correct).length;
  return { activity: 'time-matching', title: 'Unit 2 · 第6课 · 词汇与词组匹配',
    total: 10, correct, score: correct * 10,
    answers: items.map(item => ({ index: item.index, selected: item.selected })),
    details: { bankVersion: 'unit2-lesson6-time-v1', feedback },
  };
}
module.exports = { gradeLesson6, MATCHING, CORE };
