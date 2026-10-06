/* Server-owned answer keys for Unit 1, Lesson 3. Never trust a browser score. */
const MATCHING = {
  matching1: {
    title: '第三课 · 词组匹配（一）',
    phrases: [
      'a concise college motto', 'devote their lives to seeking truth',
      'embody the spirit of the scholars', 'engineering faculty members',
      'inevitably pause in front of the stele', 'inspire younger generations',
      'the college motto', 'hearts burning with passion',
      'the spirit of persistence', 'pioneering scholars', 'a precious gift',
      'recall my first day on campus', 'the stone stele', 'timeless wisdom',
      'vividly recall the moment', 'the wisdom of sages',
    ],
  },
  matching2: {
    title: '第三课 · 词组匹配（二）',
    phrases: [
      'carve a new path', 'at the welcome ceremony',
      'show empathy for classmates', 'question flawed data',
      'feel frustrated by a setback', 'a guiding principle for our actions',
      'promote inclusiveness on campus', 'act with integrity',
      'make contributions to the nation', 'a sense of mission',
      'overcome a setback', 'a time of renewal', 'resist peer pressure',
      'reflect on our choices', 'the urge to give up', 'uphold integrity',
    ],
  },
};
const READING_CHOICES = [1, 0, 2, 0, 3];
const READING_BLANKS = [
  'photos', 'pioneering scholars', 'space industry',
  'a frustrated classmate', 'practice',
];
const LETTERS = 'ABCDEFGHIJKLMNOP';
const norm = value => String(value).trim().toLowerCase()
  .replace(/[.,!?;:“”"']/g, '').replace(/\s+/g, ' ');

function gradeLesson3(body) {
  const activity = body.activity;
  if (Object.hasOwn(MATCHING, activity)) {
    const bank = MATCHING[activity];
    const items = body.items;
    if (!Array.isArray(items) || items.length !== 10 ||
      items.some(item => !item || !Number.isInteger(item.index) ||
        item.index < 0 || item.index >= 16 ||
        typeof item.selected !== 'string' || !/^[A-P]$/.test(item.selected)) ||
      new Set(items.map(item => item.index)).size !== 10 ||
      new Set(items.map(item => item.selected)).size !== 10)
      throw new Error('请完成10道题，且每个词组和字母只能使用一次。');
    const feedback = items.map(item => ({
      prompt: bank.phrases[item.index],
      selected: item.selected,
      answer: LETTERS[item.index],
      correct: item.selected === LETTERS[item.index],
    }));
    const correct = feedback.filter(item => item.correct).length;
    return { activity, title: bank.title, total: 10, correct,
      score: correct * 10, answers: items, details: { feedback } };
  }
  if (activity !== 'reading') throw new Error('不支持的第三课任务。');
  const choices = body.choices, blanks = body.blanks;
  if (!Array.isArray(choices) || choices.length !== 5 ||
    choices.some(value => !Number.isInteger(value) || value < 0 || value > 3) ||
    !Array.isArray(blanks) || blanks.length !== 5 ||
    blanks.some(value => typeof value !== 'string' ||
      !value.trim() || value.length > 100 || value.trim().split(/\s+/).length > 3))
    throw new Error('请完成5道选择题和5处不超过3词的填空。');
  const feedback = [
    ...choices.map((selected, i) => ({
      prompt: `Task 1 第${i + 1}题`, selected: 'ABCD'[selected],
      answer: 'ABCD'[READING_CHOICES[i]],
      correct: selected === READING_CHOICES[i], points: 2,
    })),
    ...blanks.map((selected, i) => ({
      prompt: `Task 3 第${i + 1}空`, selected,
      answer: READING_BLANKS[i],
      correct: norm(selected) === norm(READING_BLANKS[i]), points: 1,
    })),
  ];
  const correct = feedback.reduce((sum, item) => sum + (item.correct ? item.points : 0), 0);
  return { activity, title: '第三课 · 阅读理解 Task 1 + Task 3',
    total: 15, correct, score: Math.round(correct / 15 * 100),
    answers: { choices, blanks }, details: { feedback } };
}

module.exports = { gradeLesson3 };
