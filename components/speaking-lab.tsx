'use client';
/* oxlint-disable next/no-html-link-for-pages, jsx-a11y/media-has-caption */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, BarChart3, Check, ChevronRight, Mic, Play, RotateCcw, Send, Square, UploadCloud, Volume2 } from 'lucide-react';
import { scenes, type PracticeTurn, type SceneId } from '@/lib/scenes';

type Profile = { name: string; studentId: string; className: string };
type Stage = 'shadow' | 'choose' | 'practice' | 'result';
type Message = { role: 'student' | 'partner'; text: string };
type AudioClip = { round: number; blob: Blob };
type RoundScore = { task: number; sentence: number; clarity: number; note: string };
type Submission = { ok: boolean; id?: string; error?: string };
type RecognitionResult = { isFinal?: boolean; 0: { transcript: string; confidence?: number } };
type RecognitionEvent = { resultIndex: number; results: ArrayLike<RecognitionResult> };
type RecognitionErrorEvent = { error?: string };
type RecognitionInstance = {
  lang: string; interimResults: boolean; continuous: boolean; maxAlternatives: number;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: RecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void; stop(): void;
};
type RecognitionConstructor = new () => RecognitionInstance;

const steps = [['1', '跟读'], ['2', '选场景'], ['3', '模拟对话'], ['4', '结果上传']];

function normalize(value: string) {
  return value.toLowerCase().replace(/[’']/g, "'").replace(/[^a-z0-9'\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function evaluateTurn(text: string, turn: PracticeTurn, confidence: number | null): RoundScore {
  const normalized = normalize(text);
  const matchedKeywords = new Set(turn.keywords.filter((word) => normalized.includes(normalize(word))));
  const task = Math.min(40, matchedKeywords.size * 20);
  const words = normalized.split(' ').filter(Boolean).length;
  const patternUsed = turn.patterns.some((pattern) => normalized.includes(normalize(pattern)));
  const sentence = (patternUsed ? 20 : 0) + (words >= 6 ? 10 : words >= 3 ? 5 : 0);
  const clarity = confidence === null ? 12 : Math.max(4, Math.min(20, Math.round(confidence * 20)));
  const notes: string[] = [];
  if (task < 40) notes.push('关键信息还可以更完整');
  if (!patternUsed) notes.push('再用一次提示句型');
  if (words < 6) notes.push('补充一个具体细节');
  if (clarity < 14) notes.push('放慢语速并按意群停顿');
  return { task, sentence, clarity, note: notes[0] ?? '本轮表达完整，可以尝试减少支架。' };
}

function speak(text: string) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'en-US';
  utterance.rate = 0.86;
  window.speechSynthesis.speak(utterance);
}

export function SpeakingLab() {
  const [stage, setStage] = useState<Stage>('shadow');
  const [shadowSceneId, setShadowSceneId] = useState<SceneId>('dormitory');
  const [sceneId, setSceneId] = useState<SceneId>('dormitory');
  const [profile, setProfile] = useState<Profile>({ name: '', studentId: '', className: '' });
  const [recordingConsent, setRecordingConsent] = useState(false);
  const [turn, setTurn] = useState(0);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [pendingClip, setPendingClip] = useState<Blob | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [notice, setNotice] = useState('');
  const [recordings, setRecordings] = useState<AudioClip[]>([]);
  const [scores, setScores] = useState<RoundScore[]>([]);
  const [attemptCount, setAttemptCount] = useState(0);
  const [startedAt, setStartedAt] = useState(0);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const recognitionRef = useRef<RecognitionInstance | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const confidenceRef = useRef<number | null>(null);
  const stoppingRef = useRef<Promise<Blob | null> | null>(null);

  const shadowScene = scenes.find((item) => item.id === shadowSceneId) ?? scenes[0];
  const scene = scenes.find((item) => item.id === sceneId) ?? scenes[0];
  const currentTurn = scene.turns[Math.min(turn, scene.turns.length - 1)];
  const profileReady = Boolean(profile.name.trim() && profile.studentId.trim() && profile.className.trim());

  const result = useMemo(() => {
    const count = Math.max(1, scores.length);
    const task = Math.round(scores.reduce((sum, item) => sum + item.task, 0) / count);
    const sentence = Math.round(scores.reduce((sum, item) => sum + item.sentence, 0) / count);
    const clarity = Math.round(scores.reduce((sum, item) => sum + item.clarity, 0) / count);
    const interaction = scores.length === scene.turns.length ? 10 : Math.round((scores.length / scene.turns.length) * 10);
    const total = task + sentence + clarity + interaction;
    const advice: string[] = [];
    if (task < 30) advice.push('下一次先确认自己是否回答了每轮要求的关键信息。');
    if (sentence < 23) advice.push('先完整使用黄色句型，再替换绿色信息。');
    if (clarity < 14) advice.push('语速放慢一点，在意群之间停顿，识别会更稳定。');
    if (!advice.length) advice.push('任务完成较完整。下一次可以隐藏例句，再增加一个自己的细节。');
    return { task, sentence, clarity, interaction, total, advice: advice.join(' ') };
  }, [scores, scene.turns.length]);

  const clipUrls = useMemo(() => recordings.map((clip) => ({ round: clip.round, url: URL.createObjectURL(clip.blob) })), [recordings]);
  useEffect(() => () => clipUrls.forEach((clip) => URL.revokeObjectURL(clip.url)), [clipUrls]);

  const releaseStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    recorderRef.current = null;
    recognitionRef.current = null;
  }, []);

  const finishRecording = useCallback(async () => {
    if (stoppingRef.current) return stoppingRef.current;
    const recorder = recorderRef.current;
    if (!recorder) return null;
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    const promise = new Promise<Blob | null>((resolve) => {
      recorder.onstop = () => {
        const type = recorder.mimeType || chunksRef.current[0]?.type || 'audio/webm';
        const blob = chunksRef.current.length ? new Blob(chunksRef.current, { type }) : null;
        releaseStream();
        setIsRecording(false);
        setPendingClip(blob);
        setNotice(blob ? '录音已完成。检查文字后，发送本轮回答。' : '没有录到声音，请重新录制。');
        resolve(blob);
      };
      if (recorder.state === 'inactive') recorder.onstop(new Event('stop'));
      else recorder.stop();
    });
    stoppingRef.current = promise;
    const blob = await promise;
    stoppingRef.current = null;
    return blob;
  }, [releaseStream]);

  const startRecording = useCallback(async () => {
    if (isRecording) return;
    setPendingClip(null);
    setDraft('');
    setNotice('正在录音，请回答系统的问题……');
    confidenceRef.current = null;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const preferred = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'].find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(stream, preferred ? { mimeType: preferred } : undefined);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => { if (event.data.size) chunksRef.current.push(event.data); };
      recorderRef.current = recorder;
      recorder.start();
      setAttemptCount((value) => value + 1);
      setIsRecording(true);

      const browserWindow = window as typeof window & { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor };
      const Recognition = browserWindow.SpeechRecognition || browserWindow.webkitSpeechRecognition;
      if (!Recognition) {
        setNotice('正在录音。此浏览器不能自动识别文字，结束后请手动输入你说的内容。');
        return;
      }
      const recognition = new Recognition();
      recognition.lang = 'en-US';
      recognition.interimResults = true;
      recognition.continuous = false;
      recognition.maxAlternatives = 1;
      recognition.onresult = (event) => {
        let text = '';
        let confidence = 0;
        for (let index = event.resultIndex; index < event.results.length; index += 1) {
          text += event.results[index][0].transcript;
          confidence = Math.max(confidence, Number(event.results[index][0].confidence || 0));
        }
        setDraft(text.trim());
        if (confidence > 0) confidenceRef.current = confidence;
      };
      recognition.onerror = (event: RecognitionErrorEvent) => {
        setNotice(event.error === 'not-allowed' ? '麦克风权限未开启，请允许访问后重试。' : '文字没有完全识别，可结束录音后手动修改。');
      };
      recognition.onend = () => { if (recorderRef.current?.state === 'recording') void finishRecording(); };
      recognitionRef.current = recognition;
      recognition.start();
    } catch {
      releaseStream();
      setIsRecording(false);
      setNotice('无法使用麦克风。请在浏览器地址栏允许麦克风后重试。');
    }
  }, [finishRecording, isRecording, releaseStream]);

  useEffect(() => () => {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
    releaseStream();
  }, [releaseStream]);

  const beginPractice = useCallback((nextSceneId: SceneId) => {
    const nextScene = scenes.find((item) => item.id === nextSceneId) ?? scenes[0];
    setSceneId(nextSceneId);
    setTurn(0);
    setMessages([{ role: 'partner', text: nextScene.opening }]);
    setDraft('');
    setPendingClip(null);
    setRecordings([]);
    setScores([]);
    setAttemptCount(0);
    setSubmission(null);
    setStartedAt(Date.now());
    setStage('practice');
    speak(nextScene.opening);
  }, []);

  const sendAnswer = useCallback(() => {
    const text = draft.trim();
    if (!text || !pendingClip) return;
    const score = evaluateTurn(text, currentTurn, confidenceRef.current);
    setScores((previous) => [...previous, score]);
    setRecordings((previous) => [...previous.filter((clip) => clip.round !== turn + 1), { round: turn + 1, blob: pendingClip }]);
    setMessages((previous) => [...previous, { role: 'student', text }, { role: 'partner', text: currentTurn.reply }]);
    setDraft('');
    setPendingClip(null);
    confidenceRef.current = null;
    speak(currentTurn.reply);
    if (turn + 1 >= scene.turns.length) setStage('result');
    else setTurn((value) => value + 1);
  }, [currentTurn, draft, pendingClip, scene.turns.length, turn]);

  const submitResult = useCallback(async () => {
    if (isUploading || recordings.length !== scene.turns.length) return;
    setIsUploading(true);
    setSubmission(null);
    const studentLines = messages.filter((message) => message.role === 'student').map((message, index) => `Round ${index + 1}: ${message.text}`).join('\n');
    const confidences = scores.map((item) => item.clarity / 20);
    const form = new FormData();
    form.set('payload', JSON.stringify({
      studentName: profile.name,
      studentId: profile.studentId,
      className: profile.className,
      sceneId: scene.id,
      sceneTitle: scene.title,
      transcript: studentLines,
      coverage: Math.round((result.task / 40) * 100),
      confidence: Math.round((confidences.reduce((sum, value) => sum + value, 0) / Math.max(1, confidences.length)) * 100),
      durationSeconds: Math.max(1, Math.round((Date.now() - startedAt) / 1000)),
      attempts: attemptCount,
      taskScore: result.task,
      sentenceScore: result.sentence,
      clarityScore: result.clarity,
      interactionScore: result.interaction,
      totalScore: result.total,
      feedback: result.advice,
      recordingConsent,
    }));
    [...recordings].sort((a, b) => a.round - b.round).forEach((clip) => form.append('audio', clip.blob, `round-${clip.round}.webm`));
    try {
      const response = await fetch('/api/attempts', { method: 'POST', body: form });
      const payload = await response.json() as Submission;
      setSubmission(payload);
    } catch {
      setSubmission({ ok: false, error: '上传失败，请检查网络后重试。录音暂时仍保留在本页。' });
    } finally {
      setIsUploading(false);
    }
  }, [attemptCount, isUploading, messages, profile, recordingConsent, recordings, result, scene, scores, startedAt]);

  useEffect(() => {
    if (stage !== 'result' || submission || isUploading || recordings.length !== scene.turns.length) return;
    const timer = window.setTimeout(() => void submitResult(), 0);
    return () => window.clearTimeout(timer);
  }, [isUploading, recordings.length, scene.turns.length, stage, submission, submitResult]);

  const activeStep = stage === 'shadow' ? 0 : stage === 'choose' ? 1 : stage === 'practice' ? 2 : 3;

  return (
    <main className="min-h-screen pb-12">
      <header className="glass sticky top-0 z-30 border-b border-[#ecd3bf]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-2xl bg-[#ea5a0b] text-lg font-black text-white">J</div><div><p className="serif text-lg font-bold text-[#c94a07]">July English Lab</p><p className="text-xs text-[#687168]">四个校园情景对话</p></div></div>
          <a href="/teacher" className="focus-ring inline-flex items-center gap-2 rounded-full border border-[#d8b89d] bg-white px-4 py-2 text-sm font-bold text-[#416b36]"><BarChart3 className="h-4 w-4" /> 教师数据</a>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 pt-6 sm:px-6">
        <nav aria-label="练习步骤" className="mb-6 grid grid-cols-4 gap-1 rounded-2xl border border-[#ead6c4] bg-white/80 p-1.5 shadow-soft">
          {steps.map(([number, label], index) => <div key={number} className={`flex items-center justify-center gap-2 rounded-xl px-2 py-2.5 text-sm font-bold ${index <= activeStep ? 'bg-[#fff0e4] text-[#c94a07]' : 'text-[#96908a]'}`}><span className={`grid h-7 w-7 place-items-center rounded-full text-xs ${index <= activeStep ? 'bg-[#ea5a0b] text-white' : 'bg-[#eee8e2]'}`}>{number}</span><span className="hidden sm:inline">{label}</span></div>)}
        </nav>

        {stage === 'shadow' && (
          <section>
            <div className="mb-5"><p className="text-sm font-black uppercase tracking-[.15em] text-[#416b36]">Step 1 · Listen and Shadow</p><h1 className="serif mt-1 text-3xl font-bold text-[#d94f08] sm:text-4xl">先听原音，再跟读</h1><p className="mt-2 text-[#687168]">内容与PPT一致。先听完整对话，再逐句模仿重音和停顿。</p></div>
            <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">{scenes.map((item) => <button key={item.id} onClick={() => setShadowSceneId(item.id)} className={`focus-ring rounded-2xl border px-3 py-3 text-left ${shadowSceneId === item.id ? 'border-[#ea5a0b] bg-[#fff0e4]' : 'border-[#e4d4c7] bg-white'}`}><span className="text-lg">{item.icon}</span><span className="ml-2 text-sm font-bold">{item.number} {item.titleZh}</span></button>)}</div>
            <div className="grid gap-5 lg:grid-cols-[1.15fr_.85fr]">
              <div className="rounded-[28px] border border-[#e5cbb6] bg-white p-5 shadow-soft sm:p-7">
                <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-bold text-[#416b36]">PPT MODEL DIALOGUE</p><h2 className="serif mt-1 text-2xl font-bold">{shadowScene.number} · {shadowScene.title}</h2></div><audio controls src={shadowScene.audio}><track kind="captions" src={shadowScene.captions} srcLang="en" label="English" default /></audio></div>
                <div className="mt-5 space-y-3">{shadowScene.model.map((line, index) => <div key={line} className="flex items-start gap-3 rounded-2xl bg-[#fffaf6] p-3.5"><span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-black text-white ${index % 2 ? 'bg-[#416b36]' : 'bg-[#ea5a0b]'}`}>{index % 2 ? 'B' : 'A'}</span><p className="flex-1 pt-0.5 text-lg leading-7">{line}</p><button onClick={() => speak(line)} aria-label={`播放第${index + 1}句`} className="focus-ring grid h-8 w-8 place-items-center rounded-full bg-[#e8f1e5] text-[#416b36]"><Volume2 className="h-4 w-4" /></button></div>)}</div>
              </div>
              <aside className="rounded-[28px] border border-[#cadcc7] bg-[#f5faf2] p-5 shadow-soft sm:p-6"><p className="text-sm font-bold text-[#416b36]">这个场景可以这样说</p><div className="mt-4 space-y-3">{shadowScene.turns.map((item, index) => <div key={item.frame} className="rounded-2xl bg-white p-4"><p className="text-xs font-black text-[#ea5a0b]">TIP {index + 1}</p><p className="mt-1 text-lg font-semibold leading-7">{item.frame}</p></div>)}</div><button onClick={() => setStage('choose')} className="focus-ring mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#ea5a0b] px-5 py-3.5 font-bold text-white">跟读完成，选择场景 <ChevronRight className="h-5 w-5" /></button></aside>
            </div>
          </section>
        )}

        {stage === 'choose' && (
          <section>
            <button onClick={() => setStage('shadow')} className="focus-ring mb-4 inline-flex items-center gap-1 text-sm font-bold text-[#687168]"><ArrowLeft className="h-4 w-4" /> 返回跟读</button>
            <div className="grid gap-5 lg:grid-cols-[.75fr_1.25fr]">
              <div className="rounded-[28px] border border-[#e5cbb6] bg-white p-5 shadow-soft"><p className="text-sm font-bold text-[#416b36]">Step 2 · Student Information</p><h1 className="serif mt-1 text-2xl font-bold">填写信息</h1><div className="mt-4 grid gap-3">{[['name', '姓名', '张丽'], ['studentId', '学号', '20260101'], ['className', '班级', '城轨信号2401']].map(([key, label, placeholder]) => <label key={key} className="grid gap-1 text-sm font-bold text-[#59645a]">{label}<input value={profile[key as keyof Profile]} onChange={(event) => setProfile({ ...profile, [key]: event.target.value })} placeholder={placeholder} className="focus-ring rounded-xl border border-[#dcc5b2] bg-[#fffaf6] px-4 py-3 font-normal text-[#273327]" /></label>)}</div><label className="mt-4 flex cursor-pointer items-start gap-3 rounded-2xl bg-[#edf6f8] p-4 text-sm leading-6 text-[#315f6b]"><input type="checkbox" checked={recordingConsent} onChange={(event) => setRecordingConsent(event.target.checked)} className="mt-1 h-4 w-4" /><span>我同意将本次三段回答录音、识别文字和评分上传给任课教师，仅用于课程反馈。</span></label></div>
              <div><p className="text-sm font-bold text-[#416b36]">Step 2 · Choose One</p><h1 className="serif mt-1 text-3xl font-bold text-[#d94f08]">自主选择一个场景</h1><div className="mt-4 grid gap-3 sm:grid-cols-2">{scenes.map((item) => <button key={item.id} disabled={!profileReady || !recordingConsent} onClick={() => beginPractice(item.id)} className={`scene-card focus-ring min-h-40 rounded-[24px] border border-[#dfc5af] p-5 text-left disabled:cursor-not-allowed disabled:opacity-45 ${item.className}`}><span className="text-3xl">{item.icon}</span><p className="mt-3 text-xs font-black tracking-[.12em] text-[#8a6047]">SCENE {item.number}</p><h2 className="serif mt-1 text-xl font-bold">{item.titleZh}</h2><p className="mt-1 text-sm text-[#687168]">{item.goal}</p></button>)}</div>{(!profileReady || !recordingConsent) && <p className="mt-3 text-sm text-[#b94a10]">填写信息并勾选录音说明后即可开始。</p>}</div>
            </div>
          </section>
        )}

        {stage === 'practice' && (
          <section>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-bold text-[#416b36]">Step 3 · Question and Answer</p><h1 className="serif text-3xl font-bold text-[#d94f08]">{scene.number} · {scene.titleZh}</h1></div><button onClick={() => { releaseStream(); setStage('choose'); }} className="focus-ring inline-flex items-center gap-1 rounded-full border border-[#dac5b3] bg-white px-4 py-2 text-sm font-bold text-[#687168]"><ArrowLeft className="h-4 w-4" /> 换场景</button></div>
            <div className="grid gap-5 lg:grid-cols-[1.05fr_.95fr]">
              <div className="rounded-[28px] border border-[#dfcabb] bg-white p-5 shadow-soft"><div className="flex items-center justify-between border-b border-[#eee0d4] pb-3"><div><p className="font-bold">系统搭档</p><p className="text-xs text-[#687168]">问一句，你答一句 · 共3轮</p></div><button onClick={() => speak(messages.filter((message) => message.role === 'partner').at(-1)?.text ?? scene.opening)} className="focus-ring inline-flex items-center gap-2 rounded-full bg-[#e7f1e4] px-3 py-2 text-sm font-bold text-[#416b36]"><Volume2 className="h-4 w-4" /> 再听一次</button></div><div className="mt-4 min-h-80 space-y-3">{messages.map((message, index) => <div key={`${message.role}-${index}`} className={`flex ${message.role === 'student' ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[86%] rounded-2xl px-4 py-3 leading-7 ${message.role === 'student' ? 'bg-[#ea5a0b] text-white' : 'bg-[#e7f1e4] text-[#31542a]'}`}><p className="mb-0.5 text-xs font-black opacity-65">{message.role === 'student' ? 'YOU' : 'PARTNER'}</p>{message.text}</div></div>)}</div></div>
              <aside className="rounded-[28px] border border-[#cbdcc8] bg-[#f5faf2] p-5 shadow-soft"><p className="text-sm font-bold text-[#416b36]">ROUND {turn + 1} / {scene.turns.length}</p><h2 className="serif mt-1 text-2xl font-bold">{currentTurn.prompt}</h2><div className="mt-4 rounded-2xl bg-white p-4"><p className="text-xs font-black text-[#ea5a0b]">小提示 · 可直接模仿</p><p className="mt-2 text-xl font-semibold leading-8">{currentTurn.frame}</p><button onClick={() => speak(currentTurn.example)} className="focus-ring mt-3 inline-flex items-center gap-2 text-sm font-bold text-[#416b36]"><Play className="h-4 w-4" /> 例句：{currentTurn.example}</button></div><div className="mt-4 rounded-2xl border border-[#ddc8b6] bg-white p-3"><textarea rows={3} value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="语音识别文字会出现在这里，也可以修改……" className="focus-ring w-full resize-none border-0 bg-transparent p-1 outline-none" /><p aria-live="polite" className="mt-1 min-h-5 text-xs text-[#7b746c]">{notice || '点击麦克风开始回答，结束后检查文字。'}</p><div className="mt-3 flex items-center justify-between gap-3"><button onClick={isRecording ? () => void finishRecording() : () => void startRecording()} className={`focus-ring inline-flex items-center gap-2 rounded-xl px-4 py-3 font-bold text-white ${isRecording ? 'bg-[#b73523]' : 'bg-[#ea5a0b]'}`}>{isRecording ? <><Square className="h-4 w-4 fill-current" /> 结束回答</> : <><Mic className="h-5 w-5" /> 开始回答</>}</button><button disabled={!draft.trim() || !pendingClip || isRecording} onClick={sendAnswer} className="focus-ring inline-flex items-center gap-2 rounded-xl bg-[#416b36] px-4 py-3 font-bold text-white disabled:opacity-35"><Send className="h-4 w-4" /> 发送本轮</button></div></div>{pendingClip && <p className="mt-3 flex items-center gap-2 text-sm font-bold text-[#23748d]"><Check className="h-4 w-4" /> 本轮录音已保存，发送后进入下一问。</p>}</aside>
            </div>
          </section>
        )}

        {stage === 'result' && (
          <section className="mx-auto max-w-4xl rounded-[30px] border border-[#dfc9b7] bg-white p-6 shadow-soft sm:p-8">
            <div className="text-center"><div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[#e6f1e2] text-[#416b36]"><Check className="h-7 w-7" /></div><p className="mt-3 text-sm font-bold text-[#416b36]">Step 4 · Result</p><h1 className="serif mt-1 text-3xl font-bold text-[#d94f08]">本次得分 {result.total} / 100</h1></div>
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">{[[result.task, 40, '任务信息'], [result.sentence, 30, '句型使用'], [result.clarity, 20, '识别清晰度'], [result.interaction, 10, '完成话轮']].map(([score, full, label]) => <div key={String(label)} className="rounded-2xl bg-[#fff6ee] p-4 text-center"><p className="text-2xl font-black text-[#d94f08]">{score}<span className="text-sm text-[#8b8178]">/{full}</span></p><p className="mt-1 text-sm font-bold text-[#59645a]">{label}</p></div>)}</div>
            <div className="mt-5 rounded-2xl bg-[#edf6f8] p-5"><p className="font-bold text-[#23748d]">给你的建议</p><p className="mt-2 leading-7 text-[#40545a]">{result.advice}</p><p className="mt-2 text-xs leading-5 text-[#6f7b7d]">评分只检查是否完成任务、是否使用目标句型、浏览器识别稳定度和话轮完成情况，不冒充专业发音或语法评分。</p></div>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">{clipUrls.map((clip) => <div key={clip.round} className="rounded-2xl border border-[#e6d6c9] p-3"><p className="mb-2 text-sm font-bold">第 {clip.round} 轮录音</p><audio controls preload="none" src={clip.url} className="w-full" /></div>)}</div>
            <div className={`mt-5 rounded-2xl p-4 text-center font-bold ${submission?.ok ? 'bg-[#e6f1e2] text-[#31542a]' : submission?.error ? 'bg-[#fff0e4] text-[#b64008]' : 'bg-[#f5f1ea] text-[#59645a]'}`}>{isUploading ? <span className="inline-flex items-center gap-2"><UploadCloud className="h-5 w-5" /> 正在上传对话、评分和三段录音……</span> : submission?.ok ? '已同步给教师，老师可以查看文字、评分并回听录音。' : submission?.error ?? '正在准备上传……'}</div>
            <div className="mt-5 flex flex-wrap justify-center gap-3">{submission?.error && <button onClick={() => void submitResult()} className="focus-ring rounded-xl bg-[#ea5a0b] px-5 py-3 font-bold text-white">重新上传</button>}<button onClick={() => beginPractice(scene.id)} className="focus-ring inline-flex items-center gap-2 rounded-xl border border-[#d8c0aa] px-5 py-3 font-bold text-[#59645a]"><RotateCcw className="h-4 w-4" /> 再练一次</button><button onClick={() => setStage('choose')} className="focus-ring rounded-xl bg-[#416b36] px-5 py-3 font-bold text-white">换一个场景</button></div>
          </section>
        )}
      </section>
    </main>
  );
}
