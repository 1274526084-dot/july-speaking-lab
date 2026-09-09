export type SceneId = 'dormitory' | 'club' | 'classroom' | 'canteen';

export type PracticeTurn = {
  prompt: string;
  frame: string;
  example: string;
  keywords: string[];
  reply: string;
  coach: string;
  patterns: string[];
};

export type Scene = {
  id: SceneId;
  number: string;
  title: string;
  titleZh: string;
  role: string;
  goal: string;
  icon: string;
  className: string;
  audio: string;
  captions: string;
  opening: string;
  warmup: { question: string; options: string[]; answer: number };
  model: string[];
  words: string[];
  turns: PracticeTurn[];
};

export const scenes: Scene[] = [
  {
    id: 'dormitory', number: '01', title: 'Meeting in the Dormitory', titleZh: '宿舍初见',
    role: 'new roommates', goal: 'introduce yourself and exchange contact information', icon: '🏠', className: 'scene-dorm', audio: '/audio/dormitory.mp3', captions: '/audio/dormitory.vtt', opening: "Hi! I’m Lin Fan. What’s your name?",
    warmup: { question: 'Where are they talking?', options: ['In a dormitory', 'At a club booth', 'In a canteen'], answer: 0 },
    model: ["Hi! I’m Zhang Li. Nice to meet you!", "Hello! I’m Lin Fan. Wow, we’re roommates.", "And we are in the same major, too!", "That’s awesome! Let’s add each other on WeChat."],
    words: ['dormitory', 'freshman', 'major', 'contact', 'WeChat'],
    turns: [
      { prompt: '介绍姓名并问候。', frame: "Hi! I’m ____. Nice to meet you!", example: "Hi! I’m Chen Yu. Nice to meet you!", keywords: ['hi', 'hello', "i'm", 'i am', 'nice to meet'], reply: 'Nice to meet you, too. What is your major?', coach: '用 Hi / Hello 开头，再说姓名。', patterns: ["i'm", 'i am', 'my name is'] },
      { prompt: '介绍自己的专业。', frame: 'My major is ____.', example: 'My major is Urban Rail Transit Signaling Technology.', keywords: ['major', 'study', 'rail', 'signal', 'energy', 'automotive'], reply: 'That sounds interesting. What do you like doing after class?', coach: '说 My major is…；专业太长时可以看着读。', patterns: ['my major is', 'i study'] },
      { prompt: '说一个爱好并建议保持联系。', frame: 'I like ____. Shall we add each other on WeChat?', example: 'I like playing badminton. Shall we add each other on WeChat?', keywords: ['like', 'enjoy', 'wechat', 'contact'], reply: 'Sure. Let’s keep in touch!', coach: '至少说一个爱好，再用 Shall we…? 发出建议。', patterns: ['i like', 'i enjoy', 'shall we'] },
    ],
  },
  {
    id: 'club', number: '02', title: 'Promoting a Club', titleZh: '社团招新',
    role: 'club member and freshman', goal: 'introduce a club and invite someone to join', icon: '🚲', className: 'scene-club', audio: '/audio/club.mp3', captions: '/audio/club.vtt', opening: 'Excuse me. What club is this?',
    warmup: { question: 'What does the club member want?', options: ['To borrow a book', 'To invite a freshman', 'To order lunch'], answer: 1 },
    model: ['Excuse me! Are you interested in the Debate Club?', 'Oh, yes. But I’ve never tried it before.', 'Don’t worry. We welcome beginners!', 'Sounds great! How do I sign up?'],
    words: ['promote', 'debate', 'cycling', 'invite', 'sign up'],
    turns: [
      { prompt: '介绍社团并询问兴趣。', frame: 'This is the ____ Club. Are you interested?', example: 'This is the Cycling Club. Are you interested?', keywords: ['club', 'cycling', 'debate', 'interested'], reply: 'Maybe, but I’ve never tried it before. Do you welcome beginners?', coach: '先说社团名称，再用 Are you interested? 询问。', patterns: ['this is', 'are you interested'] },
      { prompt: '安慰对方，说明欢迎新手。', frame: 'Don’t worry. We welcome beginners.', example: 'Don’t worry. We welcome beginners.', keywords: ["don't worry", 'welcome', 'beginner'], reply: 'Sounds good. When do you meet?', coach: '用 Don’t worry 表示安慰，再补充 beginners。', patterns: ["don't worry", 'we welcome'] },
      { prompt: '给出时间并邀请报名。', frame: 'We meet on ____. Would you like to sign up?', example: 'We meet on Friday afternoon. Would you like to sign up?', keywords: ['meet', 'friday', 'monday', 'weekend', 'sign up', 'join'], reply: 'Yes! Please show me how to sign up.', coach: '说活动时间，再用 Would you like to…? 邀请。', patterns: ['we meet', 'would you like', 'sign up'] },
    ],
  },
  {
    id: 'classroom', number: '03', title: 'Asking for Help in Class', titleZh: '课堂求助',
    role: 'classmates', goal: 'explain a problem and ask for help politely', icon: '🧩', className: 'scene-class', audio: '/audio/classroom.mp3', captions: '/audio/classroom.vtt', opening: 'Hi, you look worried. Can I help you?',
    warmup: { question: 'Why does the student start the conversation?', options: ['To ask for help', 'To make a complaint', 'To sell a product'], answer: 0 },
    model: ['Hey Alex, could you please do me a favor?', 'Sure thing! What’s the problem?', 'It’s about coding. I’m totally new to it.', 'Don’t worry. Let’s work on it together.'],
    words: ['solve', 'do me a favor', 'be new to', 'work on', 'together'],
    turns: [
      { prompt: '礼貌地请求帮助。', frame: 'Could you please help me with ____?', example: 'Could you please help me with this signal diagram?', keywords: ['could you', 'please', 'help', 'favor'], reply: 'Sure. What is difficult for you?', coach: '完整说 Could you please…，语气会更礼貌。', patterns: ['could you please', 'help me', 'do me a favor'] },
      { prompt: '说明具体困难。', frame: 'It’s about ____. I’m new to it.', example: 'It’s about reading a circuit diagram. I’m new to it.', keywords: ["it's about", 'new to', 'problem', 'understand'], reply: 'No problem. What would you like me to show you?', coach: '用 It’s about… 指明问题，用 I’m new to it 说明原因。', patterns: ["it's about", "i'm new", 'i am new'] },
      { prompt: '提出一个清楚的小请求。', frame: 'Could you show me how to ____?', example: 'Could you show me how to collect the data?', keywords: ['show me', 'how to', 'explain', 'teach me'], reply: 'Of course. Let’s start with the first step.', coach: '把大问题变成一个可执行的小请求。', patterns: ['could you show me', 'how to'] },
    ],
  },
  {
    id: 'canteen', number: '04', title: 'Chatting in the Canteen', titleZh: '食堂交流',
    role: 'classmates at lunch', goal: 'describe food and make a recommendation', icon: '🍜', className: 'scene-canteen', audio: '/audio/canteen.mp3', captions: '/audio/canteen.vtt', opening: 'I don’t know what to eat. Do you have any ideas?',
    warmup: { question: 'What will they probably talk about?', options: ['A train timetable', 'Food and flavors', 'A coding problem'], answer: 1 },
    model: ['Hi! I really like our canteen. There are so many kinds of food!', 'Have you tried the new Cross-Culture Snack Bar?', 'They even have pizza with bamboo shoots on top.', 'That’s such a lovely mix of Chinese and international flavors!'],
    words: ['canteen', 'snack', 'international', 'flavor', 'bamboo shoot'],
    turns: [
      { prompt: '推荐一种食物。', frame: 'Have you tried the ____?', example: 'Have you tried the bamboo-shoot pizza?', keywords: ['have you tried', 'food', 'pizza', 'noodles', 'rice'], reply: 'Not yet. What does it taste like?', coach: '用 Have you tried…? 开启美食话题。', patterns: ['have you tried'] },
      { prompt: '描述味道或配料。', frame: 'It tastes ____. It has ____ in it.', example: 'It tastes fresh. It has bamboo shoots in it.', keywords: ['taste', 'tastes', 'has', 'with', 'flavor'], reply: 'Sounds interesting. Where can I get it?', coach: '用 tastes + 形容词；用 has / with 介绍配料。', patterns: ['it tastes', 'it has', 'with'] },
      { prompt: '说明地点并再次推荐。', frame: 'You can get it ____. You should try it!', example: 'You can get it on the second floor. You should try it!', keywords: ['get it', 'floor', 'canteen', 'try it', 'recommend'], reply: 'Great. Let’s go together!', coach: '先说位置，再用 should try it 推荐。', patterns: ['you can get', 'you should try'] },
    ],
  },
];

export const sceneById = Object.fromEntries(scenes.map((scene) => [scene.id, scene])) as Record<SceneId, Scene>;
