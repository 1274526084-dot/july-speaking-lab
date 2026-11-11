import { useEffect, useState } from 'react';
import { ArrowLeft, BarChart3, Eye, RefreshCw, Sparkles } from 'lucide-react';
import { CLASS_CATALOG, DEFAULT_CLASS } from '@/lib/class-catalog';
import { scenes } from '@/lib/scenes';
import { clearTeacherToken, getTeacherToken, sitePath } from './api';
import { ArchiveError, archiveRequest, type ArchiveTask } from './archive-api';
import './teacher-task-tools.css';

type Scope = 'workbench' | 'tasks' | 'scores';
type QuestionStat = { label: string; answered: number; percent: number; correct?: number; wrongOption?: [string, number] | null };
type Report = {
  id: string; connected: boolean; submitted: number; attempts: number; graded: number;
  average: number | null; latestAt: number; bands: { min: number; count: number }[];
  questionMetric: string; questions: QuestionStat[]; dimensions: QuestionStat[];
};
type Snapshot = { checkedAt: number; reports: Report[]; identityConflicts: number };
type PreviewContent = {
  title?: string; note?: string; passage?: string[]; model?: string[];
  questions?: { label: string; prompt: string; options?: string[]; answer?: string; explanation?: string; paragraph?: string }[];
  sections?: PreviewContent[];
};

export const teacherClasses = (staff?: { assignedClasses?: string[]; canManageCourse?: boolean }) =>
  (staff?.canManageCourse ? CLASS_CATALOG : staff?.assignedClasses || []).filter(label => label !== DEFAULT_CLASS);

export function taskPreviewHref(taskId: string, className: string, from: Scope) {
  const params = new URLSearchParams({ task: taskId, from });
  if (className) params.set('class', className);
  return `${sitePath('archive/teacher')}?${params}`;
}

export function useTaskReports(classes: string[], unit: number, lesson: number, enabled = true) {
  const [selected, setClass] = useState(() => new URLSearchParams(location.search).get('class') || '');
  const className = classes.includes(selected) ? selected : classes[0] || '';
  const key = enabled && className && unit && lesson ? `${unit}:${lesson}:${className}` : '';
  const [result, setResult] = useState<{ key: string; data?: Snapshot; error?: string }>();
  const [refreshCount, setRefreshCount] = useState(0);
  useEffect(() => {
    if (!key) return;
    let active = true;
    let pending = false;
    async function load() {
      if (pending) return;
      pending = true;
      try {
        const data = await archiveRequest<Snapshot>('teacherLessonTasks', { className, unit, lesson }, getTeacherToken());
        if (active) setResult({ key, data });
      } catch (error) {
        if (active) setResult(previous => ({ key, data: previous?.key === key ? previous.data : undefined, error: error instanceof Error ? error.message : '班级数据暂未载入。' }));
      } finally { pending = false; }
    }
    void load();
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void load(); }, 30000);
    const onVisible = () => { if (document.visibilityState === 'visible') void load(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { active = false; window.clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); };
  }, [key, className, unit, lesson, refreshCount]);
  const current = result?.key === key ? result : undefined;
  return { className, setClass, snapshot: current?.data, error: current?.error, loading: Boolean(key && !current), refresh: () => setRefreshCount(count => count + 1) };
}

export function TaskReportControls({ classes, reports }: { classes: string[]; reports: ReturnType<typeof useTaskReports> }) {
  if (!classes.length) return null;
  return <section className="tt-controls" aria-label="任务班级筛选">
    <label>班级实时数据 <select value={reports.className} onChange={event => reports.setClass(event.target.value)}>{classes.map(label => <option key={label}>{label}</option>)}</select></label>
    <button type="button" onClick={reports.refresh} aria-label="刷新班级任务数据"><RefreshCw size={16} /> 刷新</button>
    <p>{reports.snapshot ? `更新于 ${new Date(reports.snapshot.checkedAt).toLocaleTimeString('zh-CN')} · 每 30 秒刷新` : reports.loading ? '正在读取最新提交…' : '每 30 秒刷新'}{reports.snapshot?.identityConflicts ? ` · ${reports.snapshot.identityConflicts} 份身份冲突档案未计入` : ''}</p>
    {reports.error && <p className="tt-error" role="status">{reports.error}{reports.snapshot && ' 当前显示上次成功载入的数据。'}</p>}
  </section>;
}

function questionOrder(report: Report) {
  return [...report.questions, ...report.dimensions].sort((a, b) => (a.answered < 3 ? 1 : 0) - (b.answered < 3 ? 1 : 0) || a.percent - b.percent || b.answered - a.answered);
}

function QuestionBars({ rows, metric }: { rows: QuestionStat[]; metric: string }) {
  return <ul className="tt-bars" aria-label={metric}>{rows.map(row => <li key={row.label}>
    <span title={row.label}>{row.label}</span><div><i style={{ width: `${row.percent}%` }} /></div><strong>{row.percent}%</strong>
    <small>{row.correct === undefined ? `${row.answered} 人有记录` : `${row.correct}/${row.answered} 人${metric === '跟读达标率' ? '达标' : '答对'}`}{row.wrongOption ? ` · ${row.wrongOption[1]} 人误选 ${row.wrongOption[0]}` : ''}</small>
  </li>)}</ul>;
}

export function TaskLiveStats({ taskId, unit, lesson, reports }: { taskId: string; unit: number; lesson: number; reports: ReturnType<typeof useTaskReports> }) {
  const report = reports.snapshot?.reports.find(item => item.id === taskId);
  const [comment, setComment] = useState<{ comment: string; latestAt: number; attempts: number }>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  if (!reports.className) return null;
  if (!report) return <p className="tt-empty">{reports.loading ? '正在统计班级提交…' : reports.snapshot ? '此任务未布置给所选班级。' : '班级数据暂未载入。'}</p>;
  if (!report.connected) return <p className="tt-empty">这项任务暂无可汇总的提交数据。</p>;
  if (!report.submitted) return <p className="tt-empty">所选班级还没有提交这项任务。</p>;
  const rows = questionOrder(report);
  const priority = rows.filter(row => row.answered >= 3 && row.percent < 80).slice(0, 2);
  const metric = report.dimensions.length ? '口语评分维度' : report.questionMetric;
  const latestComment = comment?.latestAt === report.latestAt && comment?.attempts === report.attempts;
  const rateLabel = metric === '逐题正确率' ? '正确率' : metric === '跟读达标率' ? '达标率' : '得分率';
  const narrative = report.graded === 0 ? '已有提交，暂时没有可统计的参考分。' : priority.length ? `${priority.map(row => `「${row.label}」${rateLabel} ${row.percent}%`).join('、')}。讲评时可先复盘这些题项。` : rows.some(row => row.answered >= 3) ? '当前样本中，暂未发现有 3 人以上作答且表现低于 80% 的题项。' : '逐题记录或样本较少，暂时难以判断集中薄弱点。';
  async function analyze() {
    setBusy(true);
    setError('');
    try {
      setComment(await archiveRequest<typeof comment>('teacherTaskAnalysis', { taskId, unit, lesson, className: reports.className }, getTeacherToken()));
    } catch (err) { setError(err instanceof Error ? err.message : 'AI 讲评暂未生成。'); }
    finally { setBusy(false); }
  }
  return <div className="tt-stats">
    <div className="tt-metrics"><span><strong>{report.submitted}</strong> 人提交</span><span><strong>{report.graded}</strong> 人有分</span><span><strong>{report.average ?? '—'}</strong> 班级均分</span><span>{report.attempts} 次提交</span></div>
    {report.graded > 0 && <div className="tt-chart-grid">
      <div><h5>成绩分布</h5><ul className="tt-bars" aria-label="成绩分布">{report.bands.map(band => <li key={band.min}><span>{band.min === 90 ? '90–100' : band.min === 0 ? '0–59' : `${band.min}–${band.min + 9}`}</span><div><i style={{ width: `${100 * band.count / report.graded}%` }} /></div><strong>{band.count} 人</strong></li>)}</ul></div>
      {rows.length > 0 && <div><h5>{metric} · 优先关注</h5><QuestionBars rows={rows.slice(0, 3)} metric={metric} />{rows.length > 3 && <details><summary>查看全部 {rows.length} 项</summary><QuestionBars rows={rows.slice(3)} metric={metric} /></details>}</div>}
    </div>}
    <p className="tt-caveat">按每人最近一次提交统计。同一任务含多个场景或阶段时，先按人汇总已完成部分。</p>
    <section className="tt-insight" aria-label="班级分析"><div><strong><BarChart3 size={16} /> 班级速览</strong><p>{narrative}</p></div>
      <div className="tt-ai"><strong><Sparkles size={16} /> AI 讲评</strong>
        {latestComment && <p>{comment?.comment}</p>}
        {comment && !latestComment && <p>提交数据已有变化，可重新生成讲评。</p>}
        {report.graded < 3 ? <p>至少 3 人获得成绩后可生成 AI 讲评。</p> : !latestComment && <button type="button" onClick={() => void analyze()} disabled={busy}>{busy ? '正在生成讲评…' : '生成 AI 讲评'}</button>}
        {error && <p className="tt-error" role="status">{error}</p>}
      </div>
    </section>
  </div>;
}

function PreviewBody({ content }: { content: PreviewContent }) {
  return <div className="tt-preview-content">
    {content.title && <h3>{content.title}</h3>}
    {content.note && <p className="tt-caveat">{content.note}</p>}
    {content.passage?.map((line, index) => <p className="tt-passage" key={index}>{line}</p>)}
    {content.questions && content.questions.length > 0 && <ol className="tt-preview-questions">{content.questions.map((question, index) => <li key={`${question.label}-${index}`}>
      <small>{question.label}</small><h4>{question.prompt}</h4>
      {Boolean(question.options?.length) && <ul>{question.options?.map((option, optionIndex) => <li key={optionIndex}>{'ABCD'[optionIndex]}. {option}</li>)}</ul>}
      {question.answer && <p className="tt-answer">参考答案 · {question.answer}{question.paragraph && ` · 原文 ${question.paragraph}`}</p>}
      {question.explanation && <p>{question.explanation}</p>}
    </li>)}</ol>}
    {content.model?.map((line, index) => <p className="tt-passage" key={`model-${index}`}>{line}</p>)}
    {content.sections?.map((section, index) => <details className="tt-preview-section" key={index}><summary>{section.title}</summary><PreviewBody content={{ ...section, title: undefined }} /></details>)}
  </div>;
}

const speakingPreview: PreviewContent = { note: '四个校园口语场景，每个场景包含热身、示范对话和三轮表达任务。', sections: scenes.map(scene => ({
  title: `${scene.titleZh} · ${scene.title}`, passage: [scene.opening, ...scene.model], questions: [
    { label: '热身题', prompt: scene.warmup.question, options: scene.warmup.options, answer: 'ABC'[scene.warmup.answer] },
    ...scene.turns.map((turn, index) => ({ label: `第 ${index + 1} 轮`, prompt: turn.prompt, answer: turn.example, explanation: turn.frame })),
  ],
})) };

export function TeacherTaskPage({ taskId }: { taskId: string }) {
  const [result, setResult] = useState<{ task: ArchiveTask; preview: PreviewContent; classes: string[] }>();
  const [error, setError] = useState('');
  const [signIn, setSignIn] = useState(!getTeacherToken());
  const from = new URLSearchParams(location.search).get('from');
  const unit = Number(result?.task.unit.match(/\d+/)?.[0] || 0);
  const lesson = Number(result?.task.lesson.match(/\d+/)?.[0] || 0);
  const reports = useTaskReports(result?.classes || [], unit, lesson);
  const back = new URLSearchParams({ unit: String(unit || 1), lesson: String(lesson || 1) });
  if (reports.className) back.set('class', reports.className);
  if (from !== 'workbench') back.set('tab', from === 'scores' ? 'scores' : 'tasks');
  const login = `${sitePath('workbench/login')}?${new URLSearchParams({ next: 'archive/teacher', task: taskId })}`;
  useEffect(() => {
    if (signIn) return;
    let active = true;
    const token = getTeacherToken();
    archiveRequest<NonNullable<typeof result>>('teacherTaskPreview', { taskId }, token).then(value => { if (active) setResult(value); }).catch(err => {
      if (!active) return;
      if (err instanceof ArchiveError && err.status === 401) {
        if (getTeacherToken() === token) clearTeacherToken();
        setSignIn(true);
      }
      else setError(err instanceof Error ? err.message : '任务预览暂未载入。');
    });
    return () => { active = false; };
  }, [taskId, signIn]);
  return <main className="tt-page">
    <a className="tt-back" href={`${sitePath(from === 'workbench' ? 'workbench' : 'archive/teacher')}?${back}`}><ArrowLeft size={18} /> 返回本课任务</a>
    <header className="tt-page-header"><p><Eye size={17} /> 教师只读预览</p><h1>{result?.task.title || '任务预览'}</h1>
      {result && <p>{result.task.unit} · 第 {(unit - 1) * 3 + lesson} 课{result.task.status === 'draft' ? ' · 草稿' : ''}</p>}
      {result?.task.description && <p>{result.task.description}</p>}
    </header>
    {signIn ? <p className="tt-empty">请先<a href={login}>登录教师账号</a>再查看任务。</p> : error ? <p className="tt-error" role="alert">{error}</p> : !result ? <p className="tt-empty">正在加载题目…</p> : <>
      <section className="tt-page-panel"><h2>班级表现</h2><TaskReportControls classes={result.classes} reports={reports} /><TaskLiveStats key={`${taskId}:${reports.className}`} taskId={taskId} unit={unit} lesson={lesson} reports={reports} />{!result.classes.length && <p className="tt-empty">暂无可查看的班级。</p>}</section>
      <section className="tt-page-panel"><h2>任务材料与参考答案</h2><PreviewBody content={taskId === 'builtin-speaking' ? speakingPreview : result.preview} /></section>
    </>}
  </main>;
}
