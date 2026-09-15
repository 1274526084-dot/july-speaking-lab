/* oxlint-disable jsx-a11y/media-has-caption */
import {
  ArrowRight,
  CheckCircle2,
  Headphones,
  LoaderCircle,
  Mic,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Square,
  Volume2,
} from 'lucide-react';
import { type SyntheticEvent, useEffect, useRef, useState } from 'react';
import {
  prepareAudioForUpload,
  type WordUnit,
  type WordUploadTicket,
  uploadWordAudio,
  wordRequest,
} from './word-api';
import { assessPronunciationRecording } from './word-audio-analysis';
import { WordDemoAudio } from './word-demo-audio';

type SpeechResultLike = {
  0: { transcript: string; confidence: number };
  isFinal: boolean;
};
type SpeechEventLike = {
  resultIndex: number;
  results: ArrayLike<SpeechResultLike>;
};
type RecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives?: number;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechEventLike) => void) | null;
  onerror: (() => void) | null;
};

function getRecognition(): RecognitionLike | null {
  const scope = window as typeof window & {
    SpeechRecognition?: new () => RecognitionLike;
    webkitSpeechRecognition?: new () => RecognitionLike;
  };
  const Constructor = scope.SpeechRecognition || scope.webkitSpeechRecognition;
  return Constructor ? new Constructor() : null;
}

function selfLabel(value: number) {
  return value === 3 ? '我读得很顺' : value === 2 ? '基本会读' : '还要再练';
}

function normalizeUnitCode(value: string) {
  const trimmed = value.trim();
  try {
    const linkedCode = new URL(trimmed).searchParams.get('unit');
    if (linkedCode) return linkedCode.toUpperCase().replace(/[^A-Z0-9]/g, '');
  } catch {
    /* The value is a code rather than a full URL. */
  }
  return trimmed.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function blobToBase64(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || '').split(',')[1] || '');
    reader.onerror = () => reject(reader.error || new Error('无法读取录音'));
    reader.readAsDataURL(blob);
  });
}

function pcmToWav(chunks: Float32Array[], sourceRate: number, targetRate = 16_000) {
  const inputLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  if (!inputLength || !sourceRate) return null;
  const input = new Float32Array(inputLength);
  let offset = 0;
  for (const chunk of chunks) {
    input.set(chunk, offset);
    offset += chunk.length;
  }
  const ratio = sourceRate / targetRate;
  const outputLength = Math.max(1, Math.round(input.length / ratio));
  const buffer = new ArrayBuffer(44 + outputLength * 2);
  const view = new DataView(buffer);
  const write = (at: number, value: string) => {
    for (let index = 0; index < value.length; index += 1) view.setUint8(at + index, value.charCodeAt(index));
  };
  write(0, 'RIFF'); view.setUint32(4, 36 + outputLength * 2, true); write(8, 'WAVE'); write(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, targetRate, true); view.setUint32(28, targetRate * 2, true);
  view.setUint16(32, 2, true); view.setUint16(34, 16, true); write(36, 'data'); view.setUint32(40, outputLength * 2, true);
  for (let index = 0; index < outputLength; index += 1) {
    const position = index * ratio;
    const left = Math.floor(position);
    const fraction = position - left;
    const next = input[Math.min(left + 1, input.length - 1)] || 0;
    const sample = input[left] * (1 - fraction) + next * fraction;
    const clamped = Math.max(-1, Math.min(1, sample));
    view.setInt16(44 + index * 2, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
  }
  return new Blob([buffer], { type: 'audio/wav' });
}

async function recognizeWithCloud(blob: Blob, target: string) {
  try {
    const encoded = await blobToBase64(blob);
    const chunkSize = 60_000;
    const totalChunks = Math.ceil(encoded.length / chunkSize);
    if (!encoded || totalChunks < 1 || totalChunks > 32) return '';
    const uploadId = window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}-${Math.random().toString(16).slice(2)}`;
    let transcript = '';
    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex += 1) {
      const payload = await wordRequest<{ ok: boolean; pending?: boolean; transcript?: string }>('recognizeWordChunk', {
        uploadId, target, type: blob.type || 'audio/wav', chunkIndex, totalChunks,
        data: encoded.slice(chunkIndex * chunkSize, (chunkIndex + 1) * chunkSize),
      });
      transcript = payload.transcript?.trim() || transcript;
    }
    return transcript;
  } catch {
    return '';
  }
}

export function WordStudent() {
  const queryCode =
    new URLSearchParams(window.location.search).get('unit') || '';
  const [code, setCode] = useState(queryCode.toUpperCase());
  const [unit, setUnit] = useState<WordUnit | null>(null);
  const [loading, setLoading] = useState(Boolean(queryCode));
  const [error, setError] = useState('');
  const [name, setName] = useState(
    () => window.localStorage.getItem('word-lab.student-name') || '',
  );
  const [className, setClassName] = useState(
    () => window.localStorage.getItem('word-lab.student-class') || '',
  );
  const [consent, setConsent] = useState(false);
  const [attemptId, setAttemptId] = useState('');
  const [submitToken, setSubmitToken] = useState('');
  const [index, setIndex] = useState(0);
  const [recording, setRecording] = useState(false);
  const [clip, setClip] = useState<Blob | null>(null);
  const [clipUrl, setClipUrl] = useState('');
  const [transcript, setTranscript] = useState('');
  const [confidence, setConfidence] = useState(0);
  const [recordedDurationMs, setRecordedDurationMs] = useState(0);
  const [selfRating, setSelfRating] = useState(0);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{
    score: number;
    advice: string;
    scoringMode: 'speech-recognition' | 'acoustic-fallback' | 'no-speech';
  } | null>(null);
  const [completed, setCompleted] = useState<{
    averageScore: number;
    averageSelf: number;
    wordCount: number;
  } | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<RecognitionLike | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<number | null>(null);
  const recordingStartedRef = useRef(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const audioProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const pcmChunksRef = useRef<Float32Array[]>([]);
  const pcmSampleRateRef = useRef(0);

  function releaseAudioCapture() {
    if (audioProcessorRef.current) audioProcessorRef.current.onaudioprocess = null;
    try { audioProcessorRef.current?.disconnect(); } catch { /* already disconnected */ }
    try { audioSourceRef.current?.disconnect(); } catch { /* already disconnected */ }
    const audioContext = audioContextRef.current;
    if (audioContext && audioContext.state !== 'closed') void audioContext.close().catch(() => undefined);
    audioProcessorRef.current = null;
    audioSourceRef.current = null;
    audioContextRef.current = null;
  }

  async function loadUnit(nextCode = code) {
    const normalized = normalizeUnitCode(nextCode);
    if (!normalized) return;
    setLoading(true);
    setError('');
    try {
      const payload = await wordRequest<{ ok: true; unit: WordUnit }>(
        'studentGetUnit',
        { shareCode: normalized },
      );
      setUnit(payload.unit);
      setCode(normalized);
      const url = new URL(window.location.href);
      url.searchParams.set('unit', normalized);
      window.history.replaceState({}, '', url);
    } catch (requestError) {
      setUnit(null);
      setError(
        requestError instanceof Error
          ? requestError.message
          : '没有找到这个单元。',
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (queryCode) void loadUnit(queryCode);
  }, []);
  useEffect(
    () => () => {
      if (clipUrl) URL.revokeObjectURL(clipUrl);
      if (recordingTimerRef.current)
        window.clearTimeout(recordingTimerRef.current);
      streamRef.current?.getTracks().forEach((track) => track.stop());
      releaseAudioCapture();
    },
    [clipUrl],
  );

  async function startPractice(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!unit || !name.trim() || !className.trim() || !consent) return;
    setLoading(true);
    setError('');
    try {
      const payload = await wordRequest<{
        attemptId: string;
        submitToken: string;
      }>('studentStart', {
        shareCode: unit.shareCode,
        studentName: name,
        className,
        recordingConsent: consent,
      });
      window.localStorage.setItem('word-lab.student-name', name.trim());
      window.localStorage.setItem('word-lab.student-class', className.trim());
      setAttemptId(payload.attemptId);
      setSubmitToken(payload.submitToken);
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : '暂时无法开始。',
      );
    } finally {
      setLoading(false);
    }
  }

  function resetClip() {
    if (clipUrl) URL.revokeObjectURL(clipUrl);
    setClip(null);
    setClipUrl('');
    setTranscript('');
    setConfidence(0);
    setRecordedDurationMs(0);
    setSelfRating(0);
    setFeedback(null);
  }

  async function beginRecording() {
    setError('');
    resetClip();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      pcmChunksRef.current = [];
      pcmSampleRateRef.current = 0;
      try {
        const browserWindow = window as typeof window & { webkitAudioContext?: typeof AudioContext };
        const Context = window.AudioContext || browserWindow.webkitAudioContext;
        if (Context) {
          const audioContext = new Context();
          await audioContext.resume();
          const source = audioContext.createMediaStreamSource(stream);
          const processor = audioContext.createScriptProcessor(4096, 1, 1);
          pcmSampleRateRef.current = audioContext.sampleRate;
          processor.onaudioprocess = (event) => {
            if (recorderRef.current?.state === 'recording') pcmChunksRef.current.push(new Float32Array(event.inputBuffer.getChannelData(0)));
          };
          source.connect(processor);
          processor.connect(audioContext.destination);
          audioContextRef.current = audioContext;
          audioSourceRef.current = source;
          audioProcessorRef.current = processor;
        }
      } catch {
        releaseAudioCapture();
      }
      const preferred = [
        'audio/webm;codecs=opus',
        'audio/mp4;codecs=mp4a.40.2',
        'audio/mp4',
        'audio/webm',
        'audio/ogg;codecs=opus',
      ].find((type) => MediaRecorder.isTypeSupported(type));
      let recorder: MediaRecorder;
      try {
        recorder = new MediaRecorder(stream, {
          ...(preferred ? { mimeType: preferred } : {}),
          audioBitsPerSecond: 48_000,
        });
      } catch {
        recorder = new MediaRecorder(stream);
      }
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const originalBlob = new Blob(chunksRef.current, { type: recorder.mimeType || chunksRef.current[0]?.type || 'audio/webm' });
        const wavBlob = pcmToWav(pcmChunksRef.current, pcmSampleRateRef.current);
        const blob = wavBlob && wavBlob.size > 2_400 ? wavBlob : originalBlob;
        setRecordedDurationMs(Math.max(0, Date.now() - recordingStartedRef.current));
        setClip(blob);
        setClipUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        releaseAudioCapture();
      };
      const recognition = getRecognition();
      if (recognition) {
        recognition.lang = 'en-US';
        recognition.interimResults = true;
        recognition.continuous = false;
        recognition.maxAlternatives = 5;
        let bestConfidence = 0;
        const heard: string[] = [];
        recognition.onresult = (event) => {
          for (
            let resultIndex = event.resultIndex;
            resultIndex < event.results.length;
            resultIndex += 1
          ) {
            const result = event.results[resultIndex];
            if (result[0]) {
              heard[resultIndex] = result[0].transcript;
              bestConfidence = Math.max(
                bestConfidence,
                result[0].confidence || 0,
              );
            }
          }
          setTranscript(heard.join(' ').trim());
          setConfidence(bestConfidence);
        };
        recognition.onerror = () => undefined;
        recognitionRef.current = recognition;
        try {
          recognition.start();
        } catch {
          /* recording still works */
        }
      }
      recorder.start(250);
      recordingStartedRef.current = Date.now();
      setRecording(true);
      recordingTimerRef.current = window.setTimeout(
        () => stopRecording(),
        12_000,
      );
    } catch {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      releaseAudioCapture();
      setError('无法使用麦克风，请在浏览器地址栏允许麦克风权限后重试。');
    }
  }

  function stopRecording() {
    if (recordingTimerRef.current)
      window.clearTimeout(recordingTimerRef.current);
    recordingTimerRef.current = null;
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
    setRecording(false);
  }

  async function saveWord() {
    if (!unit || !clip || !selfRating || saving) return;
    setSaving(true);
    setError('');
    try {
      const currentWord = unit.words[index];
      const referenceUrls = currentWord.audioUrls?.length
        ? currentWord.audioUrls
        : currentWord.audioUrl
          ? [currentWord.audioUrl]
          : [];
      const assessment = await assessPronunciationRecording(
        clip,
        referenceUrls,
        currentWord.word,
      );
      const uploadClip = await prepareAudioForUpload(clip);
      const cloudTranscript = await recognizeWithCloud(uploadClip, currentWord.word);
      const finalTranscript = cloudTranscript || transcript;
      const finalConfidence = cloudTranscript ? 0.9 : confidence;
      if (cloudTranscript) {
        setTranscript(cloudTranscript);
        setConfidence(finalConfidence);
      }
      const recordingLooksValid = assessment.speechDetected || (clip.size > 2_500 && recordedDurationMs >= 350);
      if (!recordingLooksValid) {
        setError('录音中没有检测到清晰人声，请靠近麦克风重新录制。');
        return;
      }
      const prepared = await wordRequest<{ upload: WordUploadTicket }>(
        'studentPrepareWordUpload',
        {
          attemptId,
          submitToken,
          wordId: unit.words[index].id,
          audioType: uploadClip.type,
          audioBytes: uploadClip.size,
        },
      );
      await uploadWordAudio(prepared.upload, uploadClip);
      const payload = await wordRequest<{
        score: number;
        advice: string;
        scoringMode: 'speech-recognition' | 'acoustic-fallback' | 'no-speech';
      }>(
        'studentConfirmWord',
        {
          attemptId,
          submitToken,
          wordId: unit.words[index].id,
          fileId: prepared.upload.fileId,
          transcript: finalTranscript,
          confidence: finalConfidence,
          selfRating,
          acousticScore: assessment.speechDetected ? assessment.acousticScore : 55,
          speechDetected: recordingLooksValid,
          durationMs: assessment.durationMs || recordedDurationMs,
          referenceCompared: assessment.referenceCompared,
        },
      );
      setFeedback({
        score: payload.score,
        advice: payload.advice,
        scoringMode: payload.scoringMode,
      });
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : '录音上传失败，请重试。',
      );
    } finally {
      setSaving(false);
    }
  }

  async function nextWord() {
    if (!unit) return;
    if (index < unit.words.length - 1) {
      setIndex((value) => value + 1);
      resetClip();
      return;
    }
    setSaving(true);
    setError('');
    try {
      const result = await wordRequest<{
        averageScore: number;
        averageSelf: number;
        wordCount: number;
      }>('studentComplete', { attemptId, submitToken });
      setCompleted(result);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : '提交失败，请重试。',
      );
    } finally {
      setSaving(false);
    }
  }

  if (!unit && loading && queryCode && !error)
    return (
      <main className="word-shell grid min-h-screen place-items-center px-5 py-10">
        <section className="word-card w-full max-w-md p-8 text-center sm:p-10">
          <LoaderCircle className="mx-auto h-10 w-10 animate-spin text-indigo-600" />
          <h1 className="mt-5 text-2xl font-black text-slate-950">
            正在打开老师发布的单元
          </h1>
          <p className="mt-2 text-base text-slate-500">
            无需输入单元代码，请稍候。
          </p>
        </section>
      </main>
    );

  if (!unit && queryCode && error)
    return (
      <main className="word-shell grid min-h-screen place-items-center px-5 py-10">
        <section className="word-card w-full max-w-md p-8 text-center sm:p-10">
          <div className="word-mark mx-auto">
            <Volume2 />
          </div>
          <h1 className="mt-5 text-2xl font-black text-slate-950">
            单元暂时没有打开
          </h1>
          <p className="word-error mt-4">{error}</p>
          <button
            type="button"
            onClick={() => void loadUnit(queryCode)}
            className="word-primary mt-5 w-full"
          >
            重新打开本单元
          </button>
          <p className="mt-3 text-sm leading-6 text-slate-500">
            如果多次重试仍无效，请把学习通里的链接重新打开或联系任课教师。
          </p>
        </section>
      </main>
    );

  if (!unit)
    return (
      <main className="word-shell grid min-h-screen place-items-center px-5 py-10">
        <section className="word-card w-full max-w-xl p-7 sm:p-10">
          <div className="word-mark">
            <Volume2 />
          </div>
          <p className="word-kicker mt-5">July Word Sound Lab</p>
          <h1 className="mt-2 text-4xl font-black tracking-tight text-slate-950">
            打开单词跟读任务
          </h1>
          <p className="mt-3 text-base leading-7 text-slate-600">
            请优先从学习通点击老师发布的链接，系统会直接进入对应单元，不需要输入代码。
          </p>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void loadUnit();
            }}
            className="mt-7 flex flex-col gap-3 sm:flex-row"
          >
            <label className="min-w-0 flex-1">
              <span className="sr-only">单元代码或完整链接</span>
              <input
                value={code}
                onChange={(event) => setCode(event.target.value)}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                className="word-input"
                placeholder="老师只发了代码？在这里输入"
              />
            </label>
            <button
              disabled={loading || !code.trim()}
              className="word-primary w-full sm:min-w-28 sm:w-auto"
            >
              {loading ? (
                <LoaderCircle className="h-5 w-5 animate-spin" />
              ) : (
                '进入单元'
              )}
            </button>
          </form>
          <p className="mt-3 text-sm leading-6 text-slate-500">
            代码不区分大小写；也支持粘贴老师发来的完整单词任务链接。
          </p>
          {error && (
            <p role="alert" className="word-error mt-4">
              {error}
            </p>
          )}
        </section>
      </main>
    );

  if (!attemptId)
    return (
      <main className="word-shell min-h-screen px-5 py-8">
        <section className="mx-auto max-w-3xl">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <p className="word-kicker">
                {unit.teacherName} · {unit.shareCode}
              </p>
              <h1 className="mt-1 text-3xl font-black">{unit.title}</h1>
            </div>
            <span className="word-pill">{unit.words.length} 个单词</span>
          </div>
          <div className="word-card p-6 sm:p-8">
            <div className="flex items-start gap-3 rounded-2xl bg-indigo-50 p-4 text-sm leading-6 text-indigo-950">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-indigo-600" />
              <span>
                <strong>已经直接进入本单元。</strong>
                填写姓名和班级后即可开始；下次会自动填写。
                {unit.note && (
                  <span className="mt-1 block">老师提示：{unit.note}</span>
                )}
              </span>
            </div>
            <form onSubmit={startPractice} className="mt-5 grid gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="word-label">
                  姓名
                  <input
                    required
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    className="word-input mt-2"
                    placeholder="请输入真实姓名"
                  />
                </label>
                <label className="word-label">
                  班级
                  <input
                    required
                    value={className}
                    onChange={(event) => setClassName(event.target.value)}
                    className="word-input mt-2"
                    placeholder="如：城轨信号2401"
                  />
                </label>
              </div>
              <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3.5 text-sm leading-6">
                <input
                  required
                  type="checkbox"
                  checked={consent}
                  onChange={(event) => setConsent(event.target.checked)}
                  className="mt-1 h-5 w-5 shrink-0 accent-indigo-600"
                />
                <span>同意将本次录音、识别文字和评分提交给任课教师。</span>
              </label>
              {error && (
                <p role="alert" className="word-error">
                  {error}
                </p>
              )}
              <button
                disabled={
                  loading || !name.trim() || !className.trim() || !consent
                }
                className="word-primary w-full"
              >
                {loading ? (
                  <LoaderCircle className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <Headphones className="h-5 w-5" />
                    直接开始跟读
                  </>
                )}
              </button>
            </form>
          </div>
        </section>
      </main>
    );

  if (completed)
    return (
      <main className="word-shell grid min-h-screen place-items-center px-5 py-10">
        <section className="word-card w-full max-w-2xl p-8 text-center sm:p-12">
          <CheckCircle2 className="mx-auto h-16 w-16 text-emerald-500" />
          <p className="word-kicker mt-5">练习已上传</p>
          <h1 className="mt-2 text-4xl font-black">完成得很认真！</h1>
          <div className="mt-7 grid gap-3 sm:grid-cols-3">
            <div className="word-stat">
              <b>{completed.wordCount}</b>
              <span>完成单词</span>
            </div>
            <div className="word-stat">
              <b>{completed.averageScore}</b>
              <span>系统练习分</span>
            </div>
            <div className="word-stat">
              <b>{completed.averageSelf}/3</b>
              <span>平均自评</span>
            </div>
          </div>
          <p className="mt-6 text-sm leading-6 text-slate-500">
            系统分用于判断目标单词是否被识别，不等同于专业音素测评。老师可以回听你的录音。
          </p>
          <button
            onClick={() => window.location.reload()}
            className="word-primary mt-7"
          >
            再练一次
          </button>
        </section>
      </main>
    );

  const current = unit.words[index];
  return (
    <main className="word-shell min-h-screen px-4 py-5 sm:px-6 sm:py-8">
      <section className="mx-auto max-w-4xl">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <p className="word-kicker">{unit.title}</p>
            <p className="mt-1 text-sm font-bold text-slate-500">
              {name} · {className}
            </p>
          </div>
          <span className="word-pill">
            {index + 1} / {unit.words.length}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full rounded-full bg-gradient-to-r from-indigo-600 to-cyan-400 transition-all"
            style={{ width: `${((index + 1) / unit.words.length) * 100}%` }}
          />
        </div>
        <article className="word-card mt-5 overflow-hidden">
          <div className="word-hero p-7 text-center sm:p-10">
            <p className="text-sm font-black tracking-[.18em] text-indigo-200">
              LISTEN · RECORD · REVIEW
            </p>
            <h1 className="mt-4 text-5xl font-black tracking-tight text-white sm:text-7xl">
              {current.word}
            </h1>
            {current.phonetic && (
              <p className="mt-3 text-xl text-cyan-100">{current.phonetic}</p>
            )}
            <p className="mt-3 text-lg font-bold text-white/90">
              {current.meaning}
            </p>
            {current.example && (
              <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-indigo-100">
                {current.example}
              </p>
            )}
          </div>
          <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[1fr_1.15fr]">
            <section>
              <p className="word-step">STEP 1 · 听词典标准发音</p>
              {current.audioUrl ? (
                <WordDemoAudio
                  urls={current.audioUrls?.length ? current.audioUrls : [current.audioUrl]}
                  phrase={current.word}
                />
              ) : (
                <p className="word-error mt-4">
                  示范音频暂时无法加载，请刷新页面。
                </p>
              )}
              <div className="mt-5 rounded-2xl bg-indigo-50 p-4 text-sm leading-6 text-indigo-950">
                <Sparkles className="mb-2 h-5 w-5 text-indigo-600" />
                先只听一遍，注意重音和音节；第二遍再轻声模仿。
              </div>
            </section>
            <section>
              <p className="word-step">STEP 2 · 录下你的读音</p>
              <div className="mt-4 flex flex-wrap gap-3">
                {!recording ? (
                  <button
                    onClick={() => void beginRecording()}
                    className="word-record"
                  >
                    <Mic className="h-6 w-6" />
                    开始录音
                  </button>
                ) : (
                  <button onClick={stopRecording} className="word-stop">
                    <Square className="h-5 w-5 fill-current" />
                    我读完了
                  </button>
                )}
                {clip && !recording && (
                  <button
                    onClick={() => void beginRecording()}
                    className="word-secondary"
                  >
                    <RotateCcw className="h-4 w-4" />
                    重新录
                  </button>
                )}
              </div>
              {recording && (
                <p
                  aria-live="polite"
                  className="mt-3 flex items-center gap-2 text-sm font-bold text-rose-600"
                >
                  <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-rose-500" />
                  正在录音，读完请点“我读完了”；12秒后会自动停止
                </p>
              )}
              {clipUrl && !recording && (
                <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="mb-2 text-sm font-bold text-slate-600">
                    先回听，满意后再提交
                  </p>
                  <audio controls src={clipUrl} className="w-full" />
                  <p className="mt-3 text-sm text-slate-500">
                    自动识别：
                    <strong className="text-slate-800">
                      {transcript || '当前浏览器未返回文字，将使用录音对比评分'}
                    </strong>
                  </p>
                </div>
              )}
            </section>
          </div>
          {clip && !feedback && (
            <div className="border-t border-slate-200 px-6 py-6 sm:px-8">
              <p className="word-step">STEP 3 · 你的自评</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {[1, 2, 3].map((value) => (
                  <button
                    key={value}
                    onClick={() => setSelfRating(value)}
                    className={`word-rating ${selfRating === value ? 'is-active' : ''}`}
                  >
                    <span>
                      {value === 1 ? '🌱' : value === 2 ? '👍' : '✨'}
                    </span>
                    {selfLabel(value)}
                  </button>
                ))}
              </div>
              {error && (
                <p role="alert" className="word-error mt-4">
                  {error}
                </p>
              )}
              <button
                onClick={() => void saveWord()}
                disabled={!selfRating || saving}
                className="word-primary mt-5 w-full"
              >
                {saving ? (
                  <>
                    <LoaderCircle className="h-5 w-5 animate-spin" />
                    正在处理并上传…
                  </>
                ) : (
                  <>
                    <ShieldCheck className="h-5 w-5" />
                    保存本词并查看反馈
                  </>
                )}
              </button>
            </div>
          )}
          {feedback && (
            <div className="border-t border-slate-200 bg-emerald-50 px-6 py-6 sm:px-8">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-black text-emerald-700">
                    {feedback.scoringMode === 'acoustic-fallback'
                      ? '录音对比反馈'
                      : '系统识别反馈'}
                  </p>
                  <div className="mt-1 flex items-baseline gap-3">
                    <strong className="text-4xl font-black text-emerald-700">
                      {feedback.score}
                    </strong>
                    <span className="text-sm text-emerald-900">
                      / 100 · {feedback.advice}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => void nextWord()}
                  disabled={saving}
                  className="word-primary shrink-0"
                >
                  {index === unit.words.length - 1
                    ? '提交全部练习'
                    : '下一个单词'}
                  <ArrowRight className="h-5 w-5" />
                </button>
              </div>
              <p className="mt-4 text-xs leading-5 text-emerald-800/75">
                {feedback.scoringMode === 'acoustic-fallback'
                  ? '当前浏览器未返回识别文字，本次根据录音清晰度、有效时长及与示范发音的节奏相似度评分；老师仍可回听录音。'
                  : '该分数反映浏览器对目标单词的识别情况，可能受设备、网络和环境噪声影响；老师可回听录音进行判断。'}
              </p>
            </div>
          )}
        </article>
      </section>
    </main>
  );
}
