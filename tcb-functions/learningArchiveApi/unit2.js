const ACTIVITIES = {
  pinglu: { title: '平陆运河课前测试', total: 10 },
  verbs: { title: '不规则动词游戏', total: 10 },
  tense: { title: '时态练习', total: 10 },
  writingClass: { title: '写作 · 课堂信息填空', total: 5 },
  writingEssay: { title: '写作 · A Warm Moment on Campus', total: 5 },
};
const norm = (v) =>
  String(v || '')
    .trim()
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/\s+/g, ' ');
const PINGLU = [
  'connects',
  'gives',
  'began',
  'opened',
  'have carried',
  'have learned',
  'are watching',
  'are explaining',
  'will help',
  'are going to write',
];
const TENSE = [
  ['b'],
  ['c'],
  ['b'],
  ['c'],
  ['b'],
  ['b'],
  ['c'],
  ['has joined'],
  ['rises'],
  ['have learned', 'have learnt'],
];
const VERBS = {
  begin: 'begun',
  forbid: 'forbade',
  arise: 'arisen',
  overtake: 'overtook',
  choose: 'chose',
  ring: 'rung',
  withdraw: 'withdrawn',
  speak: 'spoke',
  take: 'taken',
  overcome: 'overcame',
};
const WRITING = {
  train: {
    answers: [
      'Monday afternoon',
      'locomotive training room',
      'Li Ming',
      'brought a diagram and helped me',
      'confident',
    ],
    checks: [
      [/monday/, /afternoon/],
      [/(locomotive|train)/, /(training room|lab|workshop)/],
      [/li ming/],
      [/diagram/, /(help|look|check|find|show|bring|brought)/],
      [/(confident|confidence|less nervous|not nervous)/],
    ],
    essay: [
      [/monday afternoon/, /(locomotive|train).{0,25}(room|lab|workshop)/],
      [
        /brake/,
        /(could not|couldn't|did not|didn't|unable|hard to|trouble|problem)/,
      ],
      [/li ming/, /diagram/],
      [/(label|brake)/, /(confident|confidence|better|less nervous)/],
    ],
  },
  signal: {
    answers: [
      'Tuesday morning',
      'metro signal lab',
      'Wang Xiao',
      'checked the route map with me',
      'relaxed',
    ],
    checks: [
      [/tuesday/, /morning/],
      [/(metro|signal|rail)/, /(lab|room|workshop)/],
      [/wang xiao/],
      [/(map|route)/, /(check|look|compare|help|find)/],
      [/(relaxed|relieved|less nervous|calm|supported)/],
    ],
    essay: [
      [/tuesday morning/, /(metro|signal).{0,25}(lab|room)/],
      [/(wrong route|chose the wrong|red warning|red mark|red sign)/],
      [/wang xiao/, /(route map|map)/],
      [
        /(finish|finished|complete|completed|found the mistake)/,
        /(relaxed|relieved|better|support)/,
      ],
    ],
  },
  energy: {
    answers: [
      'Friday afternoon',
      'energy storage lab',
      'Zhang Ting',
      'read the safety notes with me',
      'safe and welcome',
    ],
    checks: [
      [/friday/, /afternoon/],
      [/(energy|storage|battery)/, /(lab|room|workshop)/],
      [/zhang ting/],
      [/(safety|notes|instructions)/, /(read|help|check|ask|explain)/],
      [/(safe|welcome|welcomed|relaxed|comfortable|accepted)/],
    ],
    essay: [
      [/friday afternoon/, /(energy storage|battery).{0,20}(lab|room)/],
      [
        /(safety notes|safety instructions)/,
        /(could not|couldn't|did not|didn't|understand|worried)/,
      ],
      [/zhang ting/, /(read|notes|teacher)/],
      [
        /(finish|finished|complete|completed|record sheet)/,
        /(safe|welcome|welcomed|accepted|better)/,
      ],
    ],
  },
};
function gradeUnit2(body) {
  const activity = body.activity;
  if (!Object.hasOwn(ACTIVITIES, activity))
    throw new Error('不支持的第二课任务。');
  const info = ACTIVITIES[activity];
  let answers = body.answers,
    feedback = [],
    details = {};
  if (activity.startsWith('writing') && !Object.hasOwn(WRITING, body.major))
    throw new Error('请先选择写作场景。');
  if (activity === 'writingEssay') {
    if (
      typeof body.essay !== 'string' ||
      body.essay.length > 12000 ||
      (body.essay.match(/[A-Za-z]+/g) || []).length < 20
    )
      throw new Error('请提交20词以上、长度不超过12000字的英文作文。');
    const essay = body.essay.trim(),
      clean = norm(essay);
    const frames = [
      /\bon\b[^.!?]{3,90}\bi had my first class in\b/,
      /\bat first,?\s+i felt\b[^.!?]{3,90}\bbecause\b/,
      /\bi could not\b[^.!?]{1,95}\bso i\b/,
      /\bmy classmate\b[^.!?]{1,70}\bhelped me\b/,
      /\bat last,?\s+[^.!?]{2,100}\bi felt\b/,
    ].filter((r) => r.test(clean)).length;
    const wordCount = (clean.match(/[a-z]+(?:['’][a-z]+)?/g) || []).length,
      pastCount = (
        clean.match(
          /\b(was|were|had|went|entered|walked|felt|asked|could|did|noticed|brought|looked|found|put|chose|appeared|took|checked|finished|completed|read|explained|learned|made|stopped|helped)\b/g,
        ) || []
      ).length;
    const checks = [
      ...WRITING[body.major].essay.map((rules) =>
        rules.every((r) => r.test(clean)),
      ),
      wordCount >= 65 && wordCount <= 115 && frames >= 2 && pastCount >= 3,
    ];
    feedback = checks.map((correct, i) => ({
      prompt: [
        '时间与地点',
        '困难描述',
        '同伴帮助',
        '结果与感受',
        '字数、支架和过去时',
      ][i],
      correct,
      selected: '',
      answer: '',
      explanation: correct
        ? '检出了对应信息。'
        : '请根据任务要求补充，教师可复核。',
    }));
    details = {
      major: body.major,
      essay,
      wordCount,
      pastCount,
      matchedFrames: frames,
      scoringMode: 'rule-assisted',
      needsReview: true,
    };
    answers = [];
  } else {
    if (!Array.isArray(answers) || answers.length !== info.total)
      throw new Error('请完成所有题目再提交。');
    if (activity === 'verbs') {
      if (
        answers.some(
          (v) =>
            !v ||
            typeof v.verb !== 'string' ||
            !Object.hasOwn(VERBS, v.verb) ||
            typeof v.answer !== 'string' ||
            v.answer.length > 150,
        ) ||
        new Set(answers.map((v) => v.verb)).size !== 10
      )
        throw new Error('动词题目或答案不完整。');
      feedback = answers.map((v) => ({
        prompt: v.verb,
        selected: v.answer,
        answer: VERBS[v.verb],
        correct: norm(v.answer) === VERBS[v.verb],
      }));
    } else {
      if (answers.some((v) => typeof v !== 'string' || v.length > 300))
        throw new Error('答案格式不正确。');
      feedback = answers.map((v, i) => ({
        prompt:
          activity === 'writingClass'
            ? ['时间', '地点', '帮助者', '具体帮助', '最后感受'][i]
            : `第${i + 1}题`,
        selected: v,
        answer:
          activity === 'pinglu'
            ? PINGLU[i]
            : activity === 'tense'
              ? TENSE[i].join(' / ')
              : WRITING[body.major].answers[i],
        correct:
          activity === 'pinglu'
            ? norm(v) === PINGLU[i]
            : activity === 'tense'
              ? TENSE[i].includes(norm(v))
              : WRITING[body.major].checks[i].every((r) => r.test(norm(v))),
      }));
    }
    if (activity === 'writingClass') details.major = body.major;
  }
  const correct = feedback.filter((v) => v.correct).length;
  return {
    activity,
    title: info.title,
    total: info.total,
    correct,
    score: Math.round((correct / info.total) * 100),
    answers,
    details: { ...details, feedback },
  };
}
function unit2Summary(rows) {
  rows = rows.filter(row => Object.hasOwn(ACTIVITIES, row.activity));
  const stages = {};
  for (const key of Object.keys(ACTIVITIES)) {
    const list = rows
      .filter((r) => r.activity === key)
      .sort((a, b) => a.created_at - b.created_at || a.id.localeCompare(b.id));
    stages[key] = list.length
      ? {
          first: list[0].score,
          latest: list.at(-1).score,
          best: Math.max(...list.map((r) => r.score)),
          attempts: list.length,
          submittedAt: list.at(-1).created_at,
        }
      : null;
  }
  const writing =
    stages.writingClass && stages.writingEssay
      ? Math.round(
          (stages.writingClass.latest + stages.writingEssay.latest) / 2,
        )
      : null;
  const radar = {
    pinglu: stages.pinglu?.latest ?? null,
    verbs: stages.verbs?.latest ?? null,
    tense: stages.tense?.latest ?? null,
    writing,
  };
  return {
    stages,
    radar,
    completed: Object.values(radar).filter((v) => v !== null).length,
    attemptCount: rows.length,
    pretest: stages.pinglu?.first ?? null,
    postPractice: stages.tense?.latest ?? null,
    change:
      stages.pinglu && stages.tense
        ? stages.tense.latest - stages.pinglu.first
        : null,
  };
}
module.exports = { gradeUnit2, unit2Summary, ACTIVITIES };
