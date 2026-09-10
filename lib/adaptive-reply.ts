export type AdaptiveSceneId = 'dormitory' | 'club' | 'classroom' | 'canteen';

function normalize(value: string) {
  return value
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[^a-z0-9'\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function includesAny(text: string, terms: string[]) {
  return terms.some((term) => text.includes(term));
}

function titleCase(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function extractName(text: string) {
  const match = text.match(/(?:my name is|i am|i'm)\s+([a-z]+(?:[ -][a-z]+)?)/i);
  if (!match) return '';
  const blocked = new Set(['a freshman', 'a student', 'fine', 'good', 'happy', 'interested', 'new', 'from', 'in']);
  const candidate = match[1].toLowerCase().replace(/\s+(?:and|nice|from|in)$/i, '').trim();
  return blocked.has(candidate) ? '' : titleCase(candidate);
}

function dormitoryReply(turn: number, text: string, original: string) {
  if (turn === 0) {
    const name = extractName(original);
    if (name) return `Nice to meet you, ${name}! What is your major?`;
    if (includesAny(text, ['nice to meet', 'hello', 'hi'])) return 'Nice to meet you, too! What are you studying?';
    return "Welcome to the dormitory! I didn't catch your name clearly. What is your name and major?";
  }
  if (turn === 1) {
    if (includesAny(text, ['signal', 'signaling', 'communication'])) return 'Rail transit signaling sounds important. Which part interests you most? And what do you like doing after class?';
    if (includesAny(text, ['locomotive', 'rolling stock', 'railway', 'train'])) return 'Working with trains sounds exciting. What do you like doing after class?';
    if (includesAny(text, ['energy storage', 'battery', 'new energy', 'energy'])) return 'Energy storage is a growing field. What do you enjoy doing after class?';
    if (includesAny(text, ['automotive', 'vehicle', 'car'])) return 'Automotive technology sounds practical. What is your favorite after-class activity?';
    if (includesAny(text, ['english', 'language'])) return 'English can open many doors. What do you like doing after class?';
    return 'That sounds interesting. What do you enjoy doing after class?';
  }
  if (includesAny(text, ['guzheng', 'music', 'piano', 'guitar', 'sing'])) return 'Music sounds like a lovely hobby. Sure, let’s add each other on WeChat and keep in touch!';
  if (includesAny(text, ['badminton', 'basketball', 'football', 'sport', 'run', 'swim'])) return 'I like sports, too. Maybe we can play together sometime. Let’s keep in touch!';
  if (includesAny(text, ['blind box', 'pop mart', 'collect'])) return 'Blind boxes sound fun. You can show me your collection sometime. Let’s add each other on WeChat!';
  if (includesAny(text, ['read', 'book', 'movie', 'film'])) return 'That sounds relaxing. Maybe you can recommend one to me. Sure, let’s keep in touch!';
  if (includesAny(text, ['wechat', 'contact', 'keep in touch'])) return 'Sure. Let’s add each other on WeChat and keep in touch!';
  return 'That sounds fun. I’d like to know more about it. Let’s keep in touch!';
}

function clubReply(turn: number, text: string) {
  if (turn === 0) {
    if (text.includes('debate')) return "The Debate Club sounds interesting, but I've never debated before. Do you welcome beginners?";
    if (includesAny(text, ['cycling', 'bike', 'bicycle'])) return "The Cycling Club sounds active, but I don't have much experience. Do you welcome beginners?";
    if (includesAny(text, ['music', 'sing', 'dance'])) return "A music club sounds fun, but I'm a beginner. Can beginners join?";
    if (includesAny(text, ['english', 'language'])) return "I'd like to practise English, but I'm still a beginner. Do you welcome beginners?";
    if (includesAny(text, ['basketball', 'football', 'badminton', 'sport'])) return "That sports club sounds energetic. I haven't tried it before. Do you welcome beginners?";
    return "It sounds interesting, but I've never tried it before. Do you welcome beginners?";
  }
  if (turn === 1) {
    if (includesAny(text, ["don't worry", 'do not worry', 'welcome', 'beginner'])) return 'That makes me feel much better. When does the club meet?';
    if (includesAny(text, ['teach', 'help', 'learn', 'together'])) return 'It is good to know that someone will help me. When do you meet?';
    return 'Thanks for explaining. When and where does the club meet?';
  }
  if (text.includes('friday')) return 'Friday works for me. Yes, I’d like to join. Please show me how to sign up.';
  if (includesAny(text, ['saturday', 'sunday', 'weekend'])) return 'The weekend is convenient for me. Yes, please help me sign up.';
  if (includesAny(text, ['monday', 'tuesday', 'wednesday', 'thursday'])) return 'That weekday is fine for me. I’d like to sign up.';
  if (includesAny(text, ['morning', 'afternoon', 'evening', "o'clock", ' pm', ' am'])) return 'That time works for me. Yes, please show me how to sign up.';
  return 'Thanks. I’d like to join the club. Please show me how to sign up.';
}

function classroomReply(turn: number, text: string) {
  if (turn === 0) {
    if (includesAny(text, ['signal diagram', 'signaling', 'signal'])) return 'Of course. Which part of the signal diagram is difficult for you?';
    if (includesAny(text, ['circuit', 'electric', 'wiring'])) return 'Sure. Which part of the circuit diagram is confusing?';
    if (includesAny(text, ['code', 'coding', 'program'])) return 'Sure. Is the problem with reading the code or writing it?';
    if (includesAny(text, ['english', 'listening', 'grammar', 'word'])) return 'Of course. Which part of the English task is difficult?';
    if (includesAny(text, ['homework', 'assignment', 'task'])) return 'Sure. Which part of the assignment do you need help with?';
    return 'Of course. Tell me which part is difficult for you.';
  }
  if (turn === 1) {
    if (includesAny(text, ['read', 'understand', 'meaning'])) return 'I understand. Would you like me to read it with you or explain the key parts first?';
    if (includesAny(text, ['connect', 'wire', 'circuit'])) return 'That connection can be confusing. What would you like me to show you first?';
    if (includesAny(text, ['collect', 'data', 'calculate', 'number'])) return 'The data step needs care. Which step would you like me to demonstrate?';
    if (includesAny(text, ['new to', 'beginner', "don't know", 'do not know'])) return 'No problem—everyone starts somewhere. What would you like me to show you first?';
    return 'I see the problem. What would you like me to explain or demonstrate first?';
  }
  if (includesAny(text, ['collect', 'data'])) return 'Of course. First, let’s identify what data you need, and then we can collect it step by step.';
  if (includesAny(text, ['read', 'diagram', 'signal'])) return 'Of course. Let’s find the main symbols first, and then read the diagram step by step.';
  if (includesAny(text, ['connect', 'wire', 'circuit'])) return 'Certainly. Let’s check the labels first, and then connect each part carefully.';
  if (includesAny(text, ['code', 'program'])) return 'Sure. Let’s read the first line together and work through the code step by step.';
  return 'Of course. Let’s start with the first step and work on it together.';
}

function canteenReply(turn: number, text: string) {
  if (turn === 0) {
    if (includesAny(text, ['bamboo', 'pizza'])) return 'Bamboo-shoot pizza sounds unusual! What does it taste like?';
    if (includesAny(text, ['noodle', 'rice noodle', 'luosifen'])) return 'Noodles sound good. Are they spicy, sour, or mild?';
    if (includesAny(text, ['rice', 'fried rice'])) return 'Rice is always a good choice. What ingredients does it have?';
    if (includesAny(text, ['dumpling', 'bao', 'bun'])) return 'That sounds tasty. What is inside it?';
    if (includesAny(text, ['vegetarian', 'vegetable', 'salad'])) return 'A vegetable dish sounds fresh. What does it taste like?';
    return 'I haven’t tried that yet. What does it taste like?';
  }
  if (turn === 1) {
    if (includesAny(text, ['spicy', 'hot'])) return 'I enjoy spicy food. Where can I get it?';
    if (includesAny(text, ['sweet'])) return 'A sweet flavor sounds nice. Where is it sold?';
    if (includesAny(text, ['sour'])) return 'That sour flavor sounds refreshing. Where can I find it?';
    if (includesAny(text, ['fresh', 'light', 'healthy'])) return 'Fresh and light sounds perfect for lunch. Where can I get it?';
    if (includesAny(text, ['bamboo', 'beef', 'chicken', 'vegetable', 'egg'])) return 'Those ingredients sound delicious. Which counter sells it?';
    return 'That sounds delicious. Where can I get it?';
  }
  if (text.includes('second floor')) return 'Great—the second floor is easy to find. Let’s go there together!';
  if (text.includes('first floor')) return 'Perfect. Let’s go to the first floor together!';
  if (includesAny(text, ['counter', 'window', 'snack bar'])) return 'Thanks for the clear directions. Let’s go to that counter together!';
  if (includesAny(text, ['canteen', 'cafeteria'])) return 'Great. Let’s go to the canteen and try it together!';
  return 'Thanks for the recommendation. Let’s go and try it together!';
}

export function getAdaptiveReply(sceneId: AdaptiveSceneId, turn: number, answer: string) {
  const text = normalize(answer);
  if (sceneId === 'dormitory') return dormitoryReply(turn, text, answer);
  if (sceneId === 'club') return clubReply(turn, text);
  if (sceneId === 'classroom') return classroomReply(turn, text);
  return canteenReply(turn, text);
}
