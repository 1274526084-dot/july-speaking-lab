/* Reading task two. The passage was supplied by the course teacher. */
const PASSAGE = [
  'What is time? Answers vary. Yet beyond those fancy descriptions, time remains the carrier of everyone’s life.',
  'Are you familiar with the question, “Where on earth has my time gone?” Indeed, while some can arrange their time effectively, many others seem to be pressed for time. However, one thing is for sure: Each person is given 24 hours equally every day. It is how we spend our time that makes the difference.',
  'One typical approach is to put things off till tomorrow. Gradually, each “tomorrow” becomes a careless “today,” and each careless “today” turns into a fruitless “yesterday.” It may be too late when they realize, “Oh, gone are the days when my heart was young and gay (carefree)!”—a line from a folk song, expressing regret for the passing of youth.',
  'The opposite approach is to “never waste any time on unimportant things.” People in this group seldom chat on WeChat or like friends’ photos on Moments, let alone take time off for leisure activities. To them, life is a single-colored struggle rather than a rainbow-like experience.',
  'Most of us may adjust our attitudes depending on our moods and situations. Setbacks might make us “lie flat” for a while, while good role models can lift us up again. Here are some great figures who are always inspiring.',
  'Li Shizhen, a renowned medical scientist of the Ming Dynasty, devoted decades to studying and testing herbs and completing his great 52-volume work—a remarkable contribution to humanity. Similarly, Li Dazhao, one of the key founders of the Communist Party of China, balanced the heavy tasks of teaching, writing, and other revolutionary activities to commit himself to the goal of “saving the nation from peril.” Words like “procrastination” or “slacking off” never seemed to exist in his life. Another example is the outstanding musician Mozart, who left behind more than 600 musical works, even though he lived only 35 years.',
  'It is true that most people may not leave a mark on history. Street cleaners may spend their entire career keeping a street clean; lighthouse keepers may live on a remote island all their lives, with little real interaction with the outside world. As unsung heroes, they fill their lives with dedicated service to make the world better, and they truly deserve our deepest respect.',
];
const CHOICES = [
  { prompt: 'What is the passage mainly about?', options: [
    'Why great people should be remembered.', 'How people use time to make life meaningful.',
    'Why everyone should work without taking a break.', 'How modern technology saves people time.',
  ], answer: 1, paragraph: '②—⑦', explanation: '文章从每人每天同样拥有24小时谈起，对比不同的用时方式，再列举杰出人物和普通劳动者，说明怎样使用时间能赋予人生意义。B能概括全文；A只涉及部分例子，C误把“不休息”当成作者主张，D文中没有讨论。' },
  { prompt: 'According to paragraph ③, what may happen if people keep putting things off?', options: [
    'They will have more useful plans.', 'They will enjoy more free time.',
    'They will finish tasks more carefully.', 'They may regret wasting their youth.',
  ], answer: 3, paragraph: '③', explanation: '定位put things off、fruitless yesterday和regret for the passing of youth。不断拖延让时间白白流逝，最终可能后悔虚度青春，因此选D。其他选项都不是本段给出的结果。' },
  { prompt: 'The words “a single-colored struggle” in paragraph ④ suggest that these people _____.', options: [
    'may miss the variety and enjoyment of life', 'always feel calm and relaxed at work',
    'have more time for leisure than others', 'are unable to arrange their working time',
  ], answer: 0, paragraph: '④', explanation: 'single-colored与rainbow-like构成对比，前文又说他们很少休闲。可推断这种极端做法让生活缺少色彩和乐趣，故选A。作者没有主张无限拖延，也没有主张完全不休息。' },
  { prompt: 'Why does the writer mention Li Shizhen, Li Dazhao and Mozart?', options: [
    'To show that fame is more important than service.', 'To argue that working alone is the best way to succeed.',
    'To give examples of using time to achieve meaningful goals.', 'To suggest that everyone should work as long as they did.',
  ], answer: 2, paragraph: '⑤—⑥', explanation: '第⑤段引出inspiring role models，第⑥段说明这些人珍惜时间、坚持投入并作出贡献。这些例子是为了说明有意义地使用时间，故选C；不是鼓励追求名气、独自工作或机械比较工作年限。' },
  { prompt: 'In paragraph ⑦, “unsung heroes” refers to people who _____.', options: [
    'become famous for changing history', 'serve others without receiving much public praise',
    'prefer to avoid all contact with other people', 'always spend their lives on remote islands',
  ], answer: 1, paragraph: '⑦', explanation: '前文举了清洁工和灯塔看守人的例子，后文强调dedicated service和deepest respect。unsung heroes指默默奉献、未受到广泛赞扬的英雄，故选B；并不是说他们都住在海岛上或主动回避所有人。' },
];
const BLANKS = [
  { topic: 'Equal time', prompt: 'Each person is given _____ equally every day.', answer: '24 hours', accepted: ['24 hours', 'twenty-four hours', 'twenty four hours'], paragraph: '②', explanation: '第②段直接写出Each person is given 24 hours equally every day。填入24 hours，共2词，注意保留时间单位hours。' },
  { topic: 'The cost of delay', prompt: 'A careless “today” can turn into a _____.', answer: 'fruitless yesterday', accepted: ['fruitless yesterday'], paragraph: '③', explanation: '第③段中each careless “today” turns into a fruitless “yesterday”。空格前已有a，提取fruitless yesterday即可，共2词；引号不影响判分。' },
  { topic: 'Respect for ordinary workers', prompt: 'Complete the writer’s closing words: “they truly deserve our _____.”', answer: 'deepest respect', accepted: ['deepest respect'], paragraph: '⑦', explanation: '题目要求补全作者结尾原话：they truly deserve our deepest respect。提取deepest respect，共2词，表示“最深的敬意”。' },
];
const normalizeBlank = value => value.normalize('NFKC').toLowerCase().trim()
  .replace(/[“”‘’"']/g, '').replace(/[.,!?;:，。！？；：]+$/g, '').trim().replace(/\s+/g, ' ');
function gradeLesson6Reading(body) {
  if (!Array.isArray(body.choices) || body.choices.length !== 5 || body.choices.some(value => !Number.isInteger(value) || value < 0 || value > 3) ||
    !Array.isArray(body.blanks) || body.blanks.length !== 3 || body.blanks.some(value => typeof value !== 'string' || !value.trim() || value.length > 100 || value.trim().split(/\s+/).length > 3))
    throw new Error('请完成5道单项选择和3道阅读填空；每空不超过3个英文词。');
  const feedback = [
    ...CHOICES.map((question, index) => ({ kind: 'choice', index, prompt: question.prompt, options: question.options,
      selected: 'ABCD'[body.choices[index]], answer: 'ABCD'[question.answer], correct: body.choices[index] === question.answer,
      points: 2, paragraph: question.paragraph, explanation: question.explanation })),
    ...BLANKS.map((question, index) => ({ kind: 'blank', index, prompt: question.prompt, selected: body.blanks[index].trim(),
      answer: question.answer, correct: question.accepted.includes(normalizeBlank(body.blanks[index])),
      points: 1, paragraph: question.paragraph, explanation: question.explanation })),
  ];
  const correct = feedback.reduce((sum, item) => sum + (item.correct ? item.points : 0), 0);
  return { activity: 'time-reading', title: 'Unit 2 · 第6课 · 阅读理解 Task 1 + Task 3', total: 13, correct,
    score: Math.round(correct / 13 * 100), answers: { choices: [...body.choices], blanks: body.blanks.map(value => value.trim()) },
    details: { bankVersion: 'unit2-lesson6-reading-v1', feedback },
  };
}
module.exports = { PASSAGE, CHOICES, BLANKS, gradeLesson6Reading, normalizeBlank };
