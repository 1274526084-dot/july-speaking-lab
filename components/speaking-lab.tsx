'use client';
/* oxlint-disable next/no-html-link-for-pages */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, BarChart3, Check, ChevronRight, CircleHelp, Headphones, Keyboard, Mic, Play, RotateCcw, Send, Sparkles, Square, Volume2 } from 'lucide-react';
import { scenes, type SceneId } from '@/lib/scenes';

type Profile = { name: string; studentId: string; className: string };
type Message = { role: 'student' | 'partner' | 'coach'; text: string };
type Step = 'choose' | 'guess' | 'model' | 'practice' | 'result';
type Submission = { ok: boolean; id?: string; error?: string };
type ModelTool = {
  name: string; title?: string; description: string; inputSchema: object;
  annotations?: { readOnlyHint?: boolean; untrustedContentHint?: boolean };
  execute(input: unknown): unknown;
};

type RecognitionResult = { isFinal?: boolean; 0: { transcript: string; confidence?: number } };
type RecognitionEvent = { resultIndex: number; results: ArrayLike<RecognitionResult> };
type RecognitionErrorEvent = { error?: string };
type RecognitionInstance = {
  lang: string; interimResults: boolean; continuous: boolean; maxAlternatives: number;
  onstart: (() => void) | null;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: RecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void; stop(): void;
};
type RecognitionConstructor = new () => RecognitionInstance;

declare global {
  interface Document {
    modelContext?: { registerTool(tool: ModelTool, options?: { signal?: AbortSignal }): void | Promise<void> };
  }
}

const stepLabels = [['1', '选场景'], ['2', '猜情境'], ['3', '听与跟读'], ['4', '自主对话']];

function normalize(value: string) {
  return value.toLowerCase().replace(/[’']/g, "'").replace(/[^a-z0-9'\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function keywordCoverage(transcript: string, keywords: string[]) {
  const text = normalize(transcript);
  if (!text) return 0;
  return Math.round((keywords.filter((word) => text.includes(normalize(word))).length / Math.max(1, keywords.length)) * 100);
}

function speak(text: string) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'en-US'; utterance.rate = 0.86; utterance.pitch = 1;
  window.speechSynthesis.speak(utterance);
}

export function SpeakingLab() {
  const [profile, setProfile] = useState<Profile>({ name: '', studentId: '', className: '' });
  const [sceneId, setSceneId] = useState<SceneId>('dormitory');
  const [step, setStep] = useState<Step>('choose');
  const [guess, setGuess] = useState<number | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [turn, setTurn] = useState(0);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [confidences, setConfidences] = useState<number[]>([]);
  const [startedAt, setStartedAt] = useState<number>(0);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [notice, setNotice] = useState('');
  const recognitionRef = useRef<RecognitionInstance | null>(null);

  const scene = useMemo(() => scenes.find((item) => item.id === sceneId) ?? scenes[0], [sceneId]);
  const currentTurn = scene.turns[Math.min(turn, scene.turns.length - 1)];
  const studentTranscript = messages.filter((m) => m.role === 'student').map((m) => m.text).join(' ');
  const coverage = keywordCoverage(studentTranscript, scene.turns.flatMap((item) => item.keywords));
  const avgConfidence = confidences.length ? Math.round((confidences.reduce((a, b) => a + b, 0) / confidences.length) * 100) : null;

  const resetScene = useCallback((nextScene: SceneId = sceneId) => {
    setSceneId(nextScene); setStep('guess'); setGuess(null); setShowAnswer(false); setTurn(0);
    setMessages([]); setDraft(''); setAttempts(0); setConfidences([]); setStartedAt(Date.now()); setSubmission(null); setNotice('');
  }, [sceneId]);

  const submitLine = useCallback((rawText: string, confidence?: number) => {
    const text = rawText.trim(); if (!text) return;
    const target = scene.turns[turn];
    const score = keywordCoverage(text, target.keywords);
    const coachText = score >= 34 ? '表达成功。你已经说出了本轮的关键信息。' : `再具体一点：${target.coach}`;
    setMessages((prev) => [...prev, { role: 'student', text }, { role: 'coach', text: coachText }, { role: 'partner', text: target.reply }]);
    if (typeof confidence === 'number' && confidence > 0) setConfidences((prev) => [...prev, confidence]);
    setAttempts((value) => value + 1); setDraft(''); speak(target.reply);
    if (turn + 1 >= scene.turns.length) setTimeout(() => setStep('result'), 850);
    else setTurn((value) => value + 1);
  }, [scene.turns, turn]);

  const startRecognition = useCallback(() => {
    const w = window as typeof window & { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor };
    const Recognition = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Recognition) { setNotice('当前浏览器暂不支持语音识别，请使用 Chrome / Edge，或改用键盘输入。'); return; }
    const recognition = new Recognition();
    recognition.lang = 'en-US'; recognition.interimResults = true; recognition.continuous = false; recognition.maxAlternatives = 1;
    recognition.onstart = () => { setIsListening(true); setNotice('正在听，请自然说完整句子…'); };
    recognition.onresult = (event: RecognitionEvent) => {
      let text = ''; let confidence = 0;
      for (let i = event.resultIndex; i < event.results.length; i += 1) { text += event.results[i][0].transcript; confidence = Math.max(confidence, Number(event.results[i][0].confidence || 0)); }
      setDraft(text.trim());
      const last = event.results[event.results.length - 1];
      if (last?.isFinal) submitLine(text, confidence);
    };
    recognition.onerror = (event: RecognitionErrorEvent) => { setIsListening(false); setNotice(event.error === 'not-allowed' ? '麦克风权限未开启，请允许访问，或改用键盘输入。' : '没有听清，请再说一次。'); };
    recognition.onend = () => setIsListening(false);
    recognitionRef.current = recognition; recognition.start();
  }, [submitLine]);

  const submitResult = useCallback(async (override?: Partial<Profile> & { sceneId?: SceneId; transcript?: string }) => {
    const payload = {
      studentName: override?.name ?? profile.name, studentId: override?.studentId ?? profile.studentId,
      className: override?.className ?? profile.className, sceneId: override?.sceneId ?? scene.id,
      sceneTitle: scene.title, transcript: override?.transcript ?? studentTranscript, coverage, confidence: avgConfidence,
      durationSeconds: Math.max(1, Math.round((Date.now() - startedAt) / 1000)), attempts,
    };
    if (!payload.studentName || !payload.studentId || !payload.className || !payload.transcript) {
      const result: Submission = { ok: false, error: '请先填写姓名、学号、班级并完成对话。' }; setSubmission(result); return result;
    }
    try {
      const response = await fetch('/api/attempts', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
      const result = await response.json() as Submission; setSubmission(result); return result;
    } catch {
      const result: Submission = { ok: false, error: '提交失败，请检查网络后重试。你的当前对话仍显示在页面上。' }; setSubmission(result); return result;
    }
  }, [profile, scene, studentTranscript, coverage, avgConfidence, startedAt, attempts]);

  useEffect(() => {
    const context = document.modelContext; if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const register = async () => {
      await context.registerTool({
        name: 'start_scene_practice', title: '开始情景口语练习', description: '打开指定校园场景的猜情境与口语练习流程。',
        inputSchema: { type: 'object', properties: { sceneId: { type: 'string', enum: scenes.map((item) => item.id) } }, required: ['sceneId'], additionalProperties: false },
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        execute(input) { const id = (input as { sceneId?: string })?.sceneId; if (!scenes.some((item) => item.id === id)) throw new Error('Unknown sceneId'); resetScene(id as SceneId); return { status: 'started', sceneId: id }; },
      }, { signal: lifecycle.signal });
      await context.registerTool({
        name: 'submit_speaking_attempt', title: '提交口语练习记录', description: '提交学生当前的场景对话文本和任务完成数据，供教师看板汇总。',
        inputSchema: { type: 'object', properties: { name: { type: 'string', minLength: 1 }, studentId: { type: 'string', minLength: 1 }, className: { type: 'string', minLength: 1 } }, required: ['name', 'studentId', 'className'], additionalProperties: false },
        annotations: { readOnlyHint: false, untrustedContentHint: true },
        async execute(input) { const result = await submitResult(input as Profile); if (!result.ok) throw new Error(result.error || 'Submission failed'); return { status: 'submitted', attemptId: result.id, sceneId: scene.id }; },
      }, { signal: lifecycle.signal });
    };
    void register().catch(() => undefined); return () => lifecycle.abort();
  }, [resetScene, scene.id, submitResult]);

  const profileReady = Boolean(profile.name.trim() && profile.studentId.trim() && profile.className.trim());
  const frameParts = currentTurn.frame.split('____');

  return (
    <main className="min-h-screen pb-16">
      <header className="glass sticky top-0 z-30 border-b border-[#ecd3bf]">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-2xl bg-[#ea5a0b] text-xl font-bold text-white shadow-lg shadow-orange-200">J</div><div><p className="serif text-lg font-bold leading-tight text-[#c94a07]">July English Lab</p><p className="text-xs text-[#687168]">Campus Scene Talk · 公共英语1</p></div></div>
          <a href="/teacher" className="focus-ring inline-flex items-center gap-2 rounded-full border border-[#d8b89d] bg-white px-4 py-2 text-sm font-semibold text-[#416b36] shadow-sm hover:bg-[#fff7ef]"><BarChart3 className="h-4 w-4" /> 教师数据</a>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 pt-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div><p className="mb-2 text-sm font-bold uppercase tracking-[.18em] text-[#416b36]">Section I · Talking Face to Face</p><h1 className="serif max-w-3xl text-4xl font-bold leading-tight text-[#d94f08] sm:text-5xl">从“有句子可说”到“能完成一次对话”</h1><p className="mt-3 max-w-2xl text-base leading-7 text-[#687168]">四个校园场景。先听懂，再替换，最后和固定情境中的搭档完成三轮对话。</p></div>
          <div className="rounded-2xl border border-[#ead3bf] bg-white/80 px-4 py-3 text-sm text-[#59645a]"><p className="font-bold text-[#273327]">语音提示</p><p>建议使用 Chrome / Edge，并允许麦克风。</p></div>
        </div>

        <nav aria-label="练习步骤" className="mb-8 grid grid-cols-2 gap-2 rounded-3xl border border-[#ecd3bf] bg-white/75 p-2 shadow-soft md:grid-cols-4">
          {stepLabels.map(([number, label], index) => { const currentIndex = step === 'choose' ? 0 : step === 'guess' ? 1 : step === 'model' ? 2 : 3; const active = index <= currentIndex; return <div key={number} className={`flex items-center gap-3 rounded-2xl px-3 py-3 ${active ? 'bg-[#fff0e4] text-[#c94a07]' : 'text-[#858b85]'}`}><span className={`grid h-8 w-8 place-items-center rounded-full text-sm font-black ${active ? 'bg-[#ea5a0b] text-white' : 'bg-[#eee8e2]'}`}>{number}</span><span className="text-sm font-bold">{label}</span></div>; })}
        </nav>

        {step === 'choose' && (
          <section className="grid gap-6 lg:grid-cols-[.72fr_1.28fr]">
            <div className="rounded-[28px] border border-[#e7c9b1] bg-white/90 p-6 shadow-soft">
              <p className="text-sm font-bold text-[#416b36]">开始前 · 30秒</p><h2 className="serif mt-1 text-2xl font-bold text-[#273327]">填写练习信息</h2>
              <div className="mt-5 grid gap-4">{[['name', '姓名', '例如：张丽'], ['studentId', '学号', '例如：20260101'], ['className', '班级', '例如：城轨信号2401']].map(([key, label, placeholder]) => <label key={key} className="grid gap-1.5 text-sm font-semibold text-[#485148]">{label}<input value={profile[key as keyof Profile]} onChange={(e) => setProfile({ ...profile, [key]: e.target.value })} placeholder={placeholder} className="focus-ring rounded-xl border border-[#ddc7b4] bg-[#fffaf6] px-4 py-3 font-normal text-[#273327] placeholder:text-[#a89b90]" /></label>)}</div>
              <div className="mt-5 rounded-2xl bg-[#f4f0e8] p-4 text-sm leading-6 text-[#5d665d]"><p className="font-bold text-[#416b36]">老师能看到什么？</p><p>场景、识别文本、任务完成度、用时、尝试次数和提交时间。不保存原始录音。</p></div>
            </div>
            <div>
              <div className="mb-4 flex items-center justify-between gap-3"><div><p className="text-sm font-bold text-[#416b36]">Task 1 · Scene Choice</p><h2 className="serif text-2xl font-bold">选择一个校园场景</h2></div>{!profileReady && <span className="rounded-full bg-[#fff0e4] px-3 py-1 text-xs font-semibold text-[#c94a07]">请先填写左侧信息</span>}</div>
              <div className="grid gap-4 sm:grid-cols-2">{scenes.map((item) => <button key={item.id} disabled={!profileReady} onClick={() => resetScene(item.id)} className={`scene-card focus-ring group relative min-h-48 overflow-hidden rounded-[26px] border border-[#dfc5af] p-5 text-left transition disabled:cursor-not-allowed disabled:opacity-55 ${item.className}`}><span className="absolute right-4 top-2 text-6xl opacity-25 transition group-hover:scale-110">{item.icon}</span><span className="text-xs font-black tracking-[.14em] text-[#8a6047]">SCENE {item.number}</span><h3 className="serif mt-8 text-2xl font-bold text-[#273327]">{item.titleZh}</h3><p className="mt-1 font-semibold text-[#c94a07]">{item.title}</p><p className="mt-3 max-w-[85%] text-sm leading-6 text-[#5f695f]">{item.goal}</p><span className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-[#416b36]">开始练习 <ChevronRight className="h-4 w-4" /></span></button>)}</div>
            </div>
          </section>
        )}

        {step === 'guess' && (
          <section className="grid gap-6 lg:grid-cols-[1.18fr_.82fr]">
            <div className={`relative min-h-[430px] overflow-hidden rounded-[30px] border border-[#dfc5af] p-7 shadow-soft ${scene.className}`}>
              <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/10 to-transparent" />
              <div className="relative z-10 flex items-center justify-between"><span className="rounded-full bg-white/80 px-3 py-1 text-xs font-black tracking-[.14em] text-[#8a6047]">TASK 2 · GUESS THE SCENE</span><button onClick={() => setStep('choose')} className="focus-ring grid h-10 w-10 place-items-center rounded-full bg-white/80 text-[#59645a]" aria-label="返回"><ArrowLeft className="h-5 w-5" /></button></div>
              <div className="relative z-10 mx-auto mt-10 flex max-w-xl items-end justify-center gap-5" aria-label="场景线索动画"><div className="scene-motion grid h-28 w-28 place-items-center rounded-[30px] bg-white/80 text-6xl shadow-lg">{scene.icon}</div><div className="scene-motion mb-8 grid h-20 w-20 place-items-center rounded-full bg-[#416b36] text-4xl text-white shadow-lg">💬</div><div className="scene-motion grid h-28 w-28 place-items-center rounded-[30px] bg-white/80 text-6xl shadow-lg">🎒</div></div>
              <div className="relative z-10 mx-auto mt-10 max-w-2xl rounded-3xl bg-white/85 p-6 text-center"><p className="text-sm font-semibold text-[#687168]">先观察人物、地点和目的，再选择答案</p><h2 className="serif mt-2 text-3xl font-bold">{scene.warmup.question}</h2></div>
            </div>
            <div className="rounded-[30px] border border-[#e7c9b1] bg-white/90 p-6 shadow-soft">
              <p className="text-sm font-bold text-[#416b36]">你的判断</p><div className="mt-4 grid gap-3">{scene.warmup.options.map((option, index) => { const selected = guess === index; const correct = showAnswer && index === scene.warmup.answer; return <button key={option} onClick={() => !showAnswer && setGuess(index)} className={`focus-ring flex items-center gap-3 rounded-2xl border px-4 py-4 text-left font-semibold transition ${correct ? 'border-[#739667] bg-[#e6f1e2] text-[#31542a]' : selected ? 'border-[#ed7e41] bg-[#fff0e4] text-[#bd4607]' : 'border-[#e4d7cc] bg-[#fffaf6] hover:border-[#d7b89e]'}`}><span className="grid h-8 w-8 place-items-center rounded-full bg-white text-sm font-black">{String.fromCharCode(65 + index)}</span>{option}{correct && <Check className="ml-auto h-5 w-5" />}</button>; })}</div>
              {showAnswer && <div className="mt-4 rounded-2xl bg-[#f5f1e8] p-4 text-sm leading-6 text-[#5e675e]"><strong>线索：</strong> {scene.role} · {scene.goal}</div>}
              <button disabled={guess === null} onClick={() => showAnswer ? setStep('model') : setShowAnswer(true)} className="focus-ring mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#ea5a0b] px-5 py-3.5 font-bold text-white shadow-lg shadow-orange-200 disabled:opacity-40">{showAnswer ? <>进入听与跟读 <ChevronRight className="h-5 w-5" /></> : '确认答案'}</button>
            </div>
          </section>
        )}

        {step === 'model' && (
          <section className="grid gap-6 lg:grid-cols-[1.2fr_.8fr]">
            <div className="rounded-[30px] border border-[#e7c9b1] bg-white/92 p-6 shadow-soft sm:p-8">
              <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-bold text-[#416b36]">Task 3 · Listen, Shadow and Swap</p><h2 className="serif mt-1 text-3xl font-bold">{scene.number} · {scene.title}</h2></div><audio controls src={scene.audio} className="max-w-full"><track kind="captions" src={scene.captions} srcLang="en" label="English" default /></audio></div>
              <div className="mt-6 grid gap-3">{scene.model.map((line, index) => <div key={line} className="flex items-start gap-3 rounded-2xl border border-[#ead8c9] bg-[#fffaf6] p-4"><span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-black text-white ${index % 2 === 0 ? 'bg-[#ea5a0b]' : 'bg-[#416b36]'}`}>{index % 2 === 0 ? 'A' : 'B'}</span><p className="flex-1 pt-1 text-lg leading-7 text-[#343a34]">{line}</p><button onClick={() => speak(line)} className="focus-ring grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#e8f1e5] text-[#416b36]" aria-label={`播放第${index + 1}句`}><Volume2 className="h-4 w-4" /></button></div>)}</div>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">{[['1', 'Listen', '先听语调与停顿'], ['2', 'Shadow', '紧跟音频，不暂停'], ['3', 'Swap', '替换姓名、专业或兴趣']].map(([number, title, detail]) => <div key={number} className="rounded-2xl bg-[#f7eee6] p-4"><span className="text-xs font-black text-[#ea5a0b]">STEP {number}</span><p className="mt-1 font-bold">{title}</p><p className="mt-1 text-sm text-[#687168]">{detail}</p></div>)}</div>
            </div>
            <aside className="rounded-[30px] border border-[#cbdcbd] bg-[#f5faf2] p-6 shadow-soft">
              <p className="text-sm font-bold text-[#416b36]">Language Bank</p><h3 className="serif mt-1 text-2xl font-bold">说不出时，看这里</h3>
              <div className="mt-5 rounded-2xl bg-white p-4 leading-7"><p><span className="font-bold text-[#ea5a0b]">固定表达</span> + <span className="font-bold text-[#416b36]">可替换内容</span></p><p className="mt-2 text-lg"><span className="text-[#ea5a0b]">{scene.turns[0].frame.split('____')[0]}</span>{scene.turns[0].frame.includes('____') && <><span className="rounded bg-[#dcebd8] px-1.5 font-bold text-[#31542a]">your idea</span><span className="text-[#ea5a0b]">{scene.turns[0].frame.split('____')[1]}</span></>}</p></div>
              <div className="mt-4 flex flex-wrap gap-2">{scene.words.map((word) => <span key={word} className="rounded-full bg-[#d9edf2] px-3 py-1.5 text-sm font-semibold text-[#195e73]">{word}</span>)}</div>
              <div className="mt-5 rounded-2xl border border-dashed border-[#e0b997] p-4 text-sm leading-6 text-[#5e675e]"><strong className="text-[#c94a07]">同桌练习：</strong> A读橙色固定部分，B补绿色内容；交换角色后再脱稿说一次。</div>
              <button onClick={() => { setStep('practice'); setStartedAt(Date.now()); }} className="focus-ring mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#416b36] px-5 py-3.5 font-bold text-white shadow-lg shadow-green-200"><Mic className="h-5 w-5" /> 开始自主对话</button>
            </aside>
          </section>
        )}

        {step === 'practice' && (
          <section className="grid gap-6 lg:grid-cols-[.88fr_1.12fr]">
            <aside className="rounded-[30px] border border-[#e7c9b1] bg-white/92 p-6 shadow-soft">
              <p className="text-sm font-bold text-[#416b36]">Task 4 · Scripted Partner Practice</p><h2 className="serif mt-1 text-2xl font-bold">第 {turn + 1} / {scene.turns.length} 轮</h2>
              <div className="mt-5 rounded-3xl bg-[#fff0e4] p-5"><p className="text-sm font-bold text-[#c94a07]">你要完成的意思</p><p className="mt-1 text-lg font-bold">{currentTurn.prompt}</p></div>
              <div className="mt-4 rounded-3xl border border-[#cddfca] bg-[#f3f9f0] p-5"><div className="flex items-center justify-between gap-2"><p className="text-sm font-bold text-[#416b36]">句子支架</p><button onClick={() => speak(currentTurn.example)} className="focus-ring inline-flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-[#416b36]"><Play className="h-3.5 w-3.5" /> 听例句</button></div><p className="mt-3 text-xl font-semibold leading-8"><span className="text-[#ea5a0b]">{frameParts[0]}</span>{currentTurn.frame.includes('____') && <><span className="rounded-lg bg-[#dcebd8] px-2 py-1 text-[#31542a]">your idea</span><span className="text-[#ea5a0b]">{frameParts.slice(1).join('____')}</span></>}</p><p className="mt-3 text-sm leading-6 text-[#687168]">例：{currentTurn.example}</p></div>
              <div className="mt-4 rounded-2xl bg-[#edf6f8] p-4 text-sm leading-6 text-[#315f6b]"><strong>卡住了？</strong> {currentTurn.coach}</div>
              <button onClick={() => speak(currentTurn.reply)} className="focus-ring mt-4 inline-flex items-center gap-2 text-sm font-bold text-[#23748d]"><Headphones className="h-4 w-4" /> 预听搭档下一句</button>
            </aside>
            <div className="rounded-[30px] border border-[#d9c8ba] bg-[#fffdf9] p-5 shadow-soft sm:p-7">
              <div className="flex items-center justify-between gap-3 border-b border-[#ead8c9] pb-4"><div className="flex items-center gap-3"><div className={`grid h-11 w-11 place-items-center rounded-2xl text-2xl ${scene.className}`}>{scene.icon}</div><div><p className="font-bold">场景搭档</p><p className="text-xs text-[#687168]">回复范围已由老师设定</p></div></div><button onClick={() => resetScene(scene.id)} className="focus-ring inline-flex items-center gap-1 rounded-full border border-[#e2d3c6] px-3 py-2 text-xs font-bold text-[#687168]"><RotateCcw className="h-3.5 w-3.5" /> 重来</button></div>
              <div className="mt-5 min-h-[260px] max-h-[360px] space-y-3 overflow-y-auto pr-1">{messages.length === 0 && <div className="grid min-h-[240px] place-items-center text-center"><div><Sparkles className="mx-auto h-10 w-10 text-[#ea5a0b]" /><p className="mt-3 font-bold">你先开口，搭档会回应</p><p className="mt-1 text-sm text-[#687168]">可以照着左侧句子说，也可以换成自己的内容。</p></div></div>}{messages.map((message, index) => <div key={`${message.role}-${index}`} className={`flex ${message.role === 'student' ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[86%] rounded-2xl px-4 py-3 text-sm leading-6 ${message.role === 'student' ? 'bg-[#ea5a0b] text-white' : message.role === 'partner' ? 'bg-[#e5efe2] text-[#31542a]' : 'border border-[#cfe2e7] bg-[#edf6f8] text-[#315f6b]'}`}><p className="mb-0.5 text-[10px] font-black uppercase tracking-wider opacity-70">{message.role === 'student' ? 'YOU' : message.role === 'partner' ? 'PARTNER' : 'COACH'}</p>{message.text}</div></div>)}</div>
              <div className="mt-5 rounded-2xl border border-[#dfcbb9] bg-white p-3"><textarea value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="识别到的英语会出现在这里；也可以直接输入…" rows={2} className="focus-ring w-full resize-none border-0 bg-transparent px-2 py-1 text-sm outline-none" /><div className="mt-2 flex flex-wrap items-center justify-between gap-3"><p aria-live="polite" className="min-h-5 flex-1 text-xs text-[#7a7168]">{notice || '按麦克风说完整句子。系统只按本场景给出预设回复。'}</p><div className="flex gap-2"><button onClick={isListening ? () => recognitionRef.current?.stop?.() : startRecognition} className={`focus-ring grid h-11 w-11 place-items-center rounded-full text-white ${isListening ? 'recording bg-[#bb2f1b]' : 'bg-[#ea5a0b]'}`} aria-label={isListening ? '停止录音' : '开始语音识别'}>{isListening ? <Square className="h-4 w-4 fill-current" /> : <Mic className="h-5 w-5" />}</button><button disabled={!draft.trim()} onClick={() => submitLine(draft)} className="focus-ring grid h-11 w-11 place-items-center rounded-full bg-[#416b36] text-white disabled:opacity-35" aria-label="发送文字"><Send className="h-5 w-5" /></button></div></div></div>
              <div className="mt-3 flex items-center gap-2 text-xs text-[#7a7168]"><Keyboard className="h-3.5 w-3.5" /> 语音不可用时，键盘输入仍可完成全部练习。</div>
            </div>
          </section>
        )}

        {step === 'result' && (
          <section className="mx-auto max-w-4xl rounded-[32px] border border-[#d8c6b7] bg-white/94 p-6 text-center shadow-soft sm:p-9">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[#e5efe2] text-[#416b36]"><Check className="h-8 w-8" /></div><p className="mt-4 text-sm font-bold text-[#416b36]">Task Complete · {scene.title}</p><h2 className="serif mt-1 text-3xl font-bold">你完成了 {scene.turns.length} 轮场景对话</h2>
            <div className="mx-auto mt-6 grid max-w-2xl gap-3 sm:grid-cols-3"><div className="rounded-2xl bg-[#fff0e4] p-4"><p className="text-3xl font-black text-[#d94f08]">{coverage}%</p><p className="mt-1 text-sm text-[#687168]">关键词覆盖</p></div><div className="rounded-2xl bg-[#edf6f8] p-4"><p className="text-3xl font-black text-[#23748d]">{avgConfidence ?? '—'}{avgConfidence !== null ? '%' : ''}</p><p className="mt-1 text-sm text-[#687168]">浏览器识别置信度</p></div><div className="rounded-2xl bg-[#e5efe2] p-4"><p className="text-3xl font-black text-[#416b36]">{attempts}</p><p className="mt-1 text-sm text-[#687168]">开口次数</p></div></div>
            <p className="mx-auto mt-4 max-w-2xl text-xs leading-5 text-[#7a7168]">以上数据用于帮助你发现“是否说出了任务需要的信息”，不等同于专业发音评分。</p>
            <details className="mx-auto mt-5 max-w-2xl rounded-2xl border border-[#e6d5c7] bg-[#fffaf6] p-4 text-left"><summary className="cursor-pointer font-bold">查看我的识别文本</summary><p className="mt-3 text-sm leading-7 text-[#5f675f]">{studentTranscript}</p></details>
            {submission && <div className={`mx-auto mt-5 max-w-2xl rounded-2xl p-4 text-sm font-semibold ${submission.ok ? 'bg-[#e5efe2] text-[#31542a]' : 'bg-[#fff0e4] text-[#b64008]'}`}>{submission.ok ? '已提交，老师可以在数据看板中看到本次练习。' : submission.error}</div>}
            <div className="mt-6 flex flex-wrap justify-center gap-3"><button onClick={() => resetScene(scene.id)} className="focus-ring inline-flex items-center gap-2 rounded-2xl border border-[#d8c0aa] bg-white px-5 py-3 font-bold text-[#59645a]"><RotateCcw className="h-4 w-4" /> 再练一次</button><button onClick={() => setStep('choose')} className="focus-ring inline-flex items-center gap-2 rounded-2xl border border-[#c8d9c5] bg-[#f3f9f0] px-5 py-3 font-bold text-[#416b36]">换一个场景</button><button onClick={() => void submitResult()} disabled={submission?.ok} className="focus-ring inline-flex items-center gap-2 rounded-2xl bg-[#ea5a0b] px-5 py-3 font-bold text-white shadow-lg shadow-orange-200 disabled:opacity-45"><Send className="h-4 w-4" /> 提交给老师</button></div>
          </section>
        )}

        <section className="mt-10 grid gap-4 rounded-[28px] border border-[#e6d3c3] bg-white/72 p-5 sm:grid-cols-3">
          <div className="flex gap-3"><CircleHelp className="mt-0.5 h-5 w-5 shrink-0 text-[#ea5a0b]" /><div><p className="font-bold">说不出怎么办？</p><p className="mt-1 text-sm leading-6 text-[#687168]">先照读支架，再只替换绿色部分，第三次脱稿。</p></div></div>
          <div className="flex gap-3"><Headphones className="mt-0.5 h-5 w-5 shrink-0 text-[#416b36]" /><div><p className="font-bold">怎么跟读？</p><p className="mt-1 text-sm leading-6 text-[#687168]">先听完整句，再紧跟音频模仿重音和停顿。</p></div></div>
          <div className="flex gap-3"><Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-[#23748d]" /><div><p className="font-bold">这是生成式AI吗？</p><p className="mt-1 text-sm leading-6 text-[#687168]">不是。回复由老师预先设定，内容始终留在本课场景内。</p></div></div>
        </section>
      </section>
    </main>
  );
}
