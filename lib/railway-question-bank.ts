/** Teacher-editable teaching scenarios. This is a fixed question bank, not AI generation. */
export type RailwayQuestion = {
  id: string;
  prompt: string;
  options: string[];
  answer: number;
  explanation: string;
};

export type RailwayBankQuestion = RailwayQuestion & {
  topic: 'station' | 'rolling-stock' | 'safety' | 'ecrl';
  difficulty: 'foundation' | 'practice' | 'challenge';
};

export const RAILWAY_TOPICS = [
  { value: 'all', label: '综合铁路英语' },
  { value: 'station', label: '车站服务与出行' },
  { value: 'rolling-stock', label: '机车车辆与检修' },
  { value: 'safety', label: '安全沟通与跨文化合作' },
  { value: 'ecrl', label: 'ECRL 项目情境阅读' },
] as const;

export const RAILWAY_QUESTION_BANK: readonly RailwayBankQuestion[] = [
  {
    id: 'station-01',
    topic: 'station',
    difficulty: 'foundation',
    prompt:
      'A passenger asks, “Where can I buy a ticket?” Which place should you recommend?',
    options: [
      'The ticket office.',
      'The driver’s cab.',
      'The maintenance depot.',
      'The signal box.',
    ],
    answer: 0,
    explanation: 'ticket office 指售票处；maintenance depot 指检修基地。',
  },
  {
    id: 'station-02',
    topic: 'station',
    difficulty: 'foundation',
    prompt: 'What does “Mind the gap” ask passengers to do?',
    options: [
      'Run to the train.',
      'Watch the space between the train and platform.',
      'Leave their bags on the platform.',
      'Stand in the doorway.',
    ],
    answer: 1,
    explanation: 'mind 在这条提示语中表示“当心”，gap 是列车与站台之间的间隙。',
  },
  {
    id: 'station-03',
    topic: 'station',
    difficulty: 'practice',
    prompt:
      'A passenger says, “I have a large suitcase. Is there a lift?” Choose the most helpful reply.',
    options: [
      'You should travel without luggage.',
      'I do not use the lift.',
      'Yes. Follow this sign; the lift is on your left.',
      'The train is very long.',
    ],
    answer: 2,
    explanation:
      '服务用语应回应实际需求，并提供清晰、可执行的指引。lift 在英式英语中指电梯。',
  },
  {
    id: 'station-04',
    topic: 'station',
    difficulty: 'practice',
    prompt:
      'Practice announcement: “The 10:20 service will depart from Platform 3 instead of Platform 1.” What has changed?',
    options: [
      'The destination.',
      'The ticket price.',
      'The departure date.',
      'The departure platform.',
    ],
    answer: 3,
    explanation: 'instead of 表示“代替”，本题改变的是乘车站台。',
  },
  {
    id: 'station-05',
    topic: 'station',
    difficulty: 'challenge',
    prompt:
      'A traveller does not understand your directions. Which response best checks understanding politely?',
    options: [
      'I have already told you.',
      'Would you like me to show you the route on the station map?',
      'Everyone knows where it is.',
      'Just follow the crowd.',
    ],
    answer: 1,
    explanation:
      '借助地图确认路线可以降低语言障碍，同时保持礼貌；不能假定跟随人群一定正确。',
  },
  {
    id: 'rolling-01',
    topic: 'rolling-stock',
    difficulty: 'foundation',
    prompt: 'In railway English, “rolling stock” refers to _____.',
    options: [
      'Food stored in a station.',
      'Only the rails.',
      'Railway vehicles such as locomotives and carriages.',
      'A station timetable.',
    ],
    answer: 2,
    explanation: 'rolling stock 是铁路机车、客车、货车等车辆的统称。',
  },
  {
    id: 'rolling-02',
    topic: 'rolling-stock',
    difficulty: 'foundation',
    prompt: 'Which word means “制动器” in a vehicle maintenance note?',
    options: ['Brake.', 'Bridge.', 'Branch.', 'Board.'],
    answer: 0,
    explanation: 'brake 为制动器或刹车；注意与表示“打破”的 break 区分。',
  },
  {
    id: 'rolling-03',
    topic: 'rolling-stock',
    difficulty: 'practice',
    prompt:
      'Practice maintenance note: “Inspect the doors before the vehicle enters service.” When should the doors be inspected?',
    options: [
      'After every passenger has left for home.',
      'Only after a failure.',
      'While passengers are boarding.',
      'Before the vehicle starts passenger service.',
    ],
    answer: 3,
    explanation:
      'before 引导时间关系；enter service 在该语境中表示投入运营。本题仅练习语言理解，现场操作须遵守正式规程。',
  },
  {
    id: 'rolling-04',
    topic: 'rolling-stock',
    difficulty: 'practice',
    prompt:
      'A team member reports, “There is an unusual noise near the wheel.” Which reply records the observation accurately?',
    options: [
      'The wheel is definitely broken.',
      'An unusual noise was reported near the wheel; further inspection is needed.',
      'The train is safe because it can still move.',
      'The passenger made the noise.',
    ],
    answer: 1,
    explanation:
      '报告应区分“观察到的现象”和“尚未证实的原因”，避免未经检查的结论。',
  },
  {
    id: 'rolling-05',
    topic: 'rolling-stock',
    difficulty: 'challenge',
    prompt:
      'Practice handover: “Unit A has completed inspection. Unit B is awaiting approval.” Which statement matches the note?',
    options: [
      'Both units have approval.',
      'Unit A has not been inspected.',
      'Unit B is still waiting for approval.',
      'Unit B has completed all required work.',
    ],
    answer: 2,
    explanation:
      'awaiting 表示“正在等待”。已完成 inspection 不等于已获得全部运营许可，不能擅自补充结论。',
  },
  {
    id: 'safety-01',
    topic: 'safety',
    difficulty: 'foundation',
    prompt: 'Which sentence is a clear request to repeat an instruction?',
    options: [
      'I will guess what you mean.',
      'That is not my problem.',
      'You speak too much.',
      'Could you repeat that, please?',
    ],
    answer: 3,
    explanation: '不清楚时应主动、礼貌地确认，不能凭猜测执行。',
  },
  {
    id: 'safety-02',
    topic: 'safety',
    difficulty: 'foundation',
    prompt: 'What does PPE stand for in a workplace safety text?',
    options: [
      'Passenger Platform Entrance.',
      'Personal Protective Equipment.',
      'Public Project English.',
      'Power Planning Engineer.',
    ],
    answer: 1,
    explanation:
      'PPE 为 Personal Protective Equipment，即个人防护装备。具体装备和操作要求由现场规程规定。',
  },
  {
    id: 'safety-03',
    topic: 'safety',
    difficulty: 'practice',
    prompt:
      'A colleague says, “Check item fifteen.” You heard “fifty”. What should you say?',
    options: [
      'To confirm, did you say fifteen, one-five, or fifty, five-zero?',
      'I will check either one.',
      'I know what you mean.',
      'Please speak English perfectly.',
    ],
    answer: 0,
    explanation: '复述数字并逐位确认有助于消除 fifteen/fifty 的听辨歧义。',
  },
  {
    id: 'safety-04',
    topic: 'safety',
    difficulty: 'practice',
    prompt:
      'An international teammate uses an unfamiliar technical term. What is the best next step?',
    options: [
      'Ignore the term.',
      'Assume the teammate is wrong.',
      'Ask for its meaning and agree on a shared term.',
      'Stop talking to the teammate.',
    ],
    answer: 2,
    explanation:
      '跨文化合作重在澄清含义与统一术语，不应把语言差异当作能力判断。',
  },
  {
    id: 'safety-05',
    topic: 'safety',
    difficulty: 'challenge',
    prompt:
      'Practice briefing: “The test must not begin until the supervisor confirms the area is clear.” Which action matches this statement?',
    options: [
      'Begin when most colleagues arrive.',
      'Wait for the supervisor’s confirmation before beginning.',
      'Begin if nobody complains.',
      'Ask a passenger to give permission.',
    ],
    answer: 1,
    explanation:
      'must not … until … 表示“在……之前不得……”。这是语言练习，实际作业须按批准的安全程序执行。',
  },
  {
    id: 'ecrl-01',
    topic: 'ecrl',
    difficulty: 'foundation',
    prompt:
      'ECRL is short for “East Coast Rail Link”. Which word means “海岸”?',
    options: ['East.', 'Rail.', 'Coast.', 'Link.'],
    answer: 2,
    explanation:
      'coast 为“海岸”；rail 为“铁路/铁轨”，link 表示“连接”。题目只考查项目英文名称的词义。',
  },
  {
    id: 'ecrl-02',
    topic: 'ecrl',
    difficulty: 'foundation',
    prompt:
      'Practice text: “An ECRL training team prepares a bilingual glossary.” What does “bilingual” mean?',
    options: [
      'Written in two languages.',
      'Written by two students.',
      'Used for two days.',
      'Containing two words.',
    ],
    answer: 0,
    explanation:
      'bi- 表示“两”；bilingual 意为“双语的”。这是一段教学情境文本，不是项目新闻。',
  },
  {
    id: 'ecrl-03',
    topic: 'ecrl',
    difficulty: 'practice',
    prompt:
      'Practice text: “At an ECRL workshop, trainees compare safety signs in English and Malay to reduce misunderstanding.” Why do they compare the signs?',
    options: [
      'To replace all safety rules.',
      'To make the workshop longer.',
      'To avoid learning new words.',
      'To help people understand safety information.',
    ],
    answer: 3,
    explanation:
      'to reduce misunderstanding 说明目的：减少误解。本段为课堂编写情境，不代表真实活动报道。',
  },
  {
    id: 'ecrl-04',
    topic: 'ecrl',
    difficulty: 'practice',
    prompt:
      'Practice email: “Dear ECRL training colleagues, could we confirm the workshop time in both local time zones?” What is the writer requesting?',
    options: [
      'A change of railway route.',
      'Clear confirmation of the meeting time.',
      'A new ticket price.',
      'A maintenance result.',
    ],
    answer: 1,
    explanation:
      'confirm 表示“确认”；跨地区交流应明确时间和时区。本邮件为教学模板。',
  },
  {
    id: 'ecrl-05',
    topic: 'ecrl',
    difficulty: 'challenge',
    prompt:
      'Practice project update: “Training is scheduled for May, subject to final approval.” Which summary is accurate?',
    options: [
      'Training has already finished.',
      'Training cannot happen in May.',
      'May is planned, but final approval is still required.',
      'Every detail has been approved.',
    ],
    answer: 2,
    explanation:
      'subject to final approval 意为“以最终批准为准”，计划不能写成已经确定或已经完成。此句为教学模板。',
  },
];

export function buildRailwayQuiz(options: {
  topic: string;
  difficulty: string;
  count: number;
  rotation?: number;
}): RailwayQuestion[] {
  const available = RAILWAY_QUESTION_BANK.filter(
    (question) =>
      (options.topic === 'all' || question.topic === options.topic) &&
      (options.difficulty === 'all' ||
        question.difficulty === options.difficulty),
  );
  if (!available.length) return [];
  const offset = (options.rotation || 0) % available.length;
  const rotated = [...available.slice(offset), ...available.slice(0, offset)];
  return rotated
    .slice(0, Math.max(1, Math.min(options.count, available.length)))
    .map(({ id, prompt, options: answers, answer, explanation }) => ({
      id,
      prompt,
      options: [...answers],
      answer,
      explanation,
    }));
}
