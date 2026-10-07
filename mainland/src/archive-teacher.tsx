import {
  ArrowLeft,
  ArrowRight,
  AudioLines,
  BookOpen,
  Check,
  CheckCircle2,
  ClipboardList,
  Clock3,
  ExternalLink,
  FilePenLine,
  GraduationCap,
  Layers3,
  LoaderCircle,
  Newspaper,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Smartphone,
  TrainFront,
  Trash2,
  UsersRound,
  X,
} from 'lucide-react';
import {
  type SubmitEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  CLASS_CATALOG,
  SCHOOL_COLLEGES,
  collegeForClass,
} from '@/lib/class-catalog';
import { createSchoolClassDirectory as createClassDirectory } from '@/lib/school-classes';
import { SchoolClassFilter } from '@/components/school-class-filter';
import {
  buildRailwayQuiz,
  RAILWAY_QUESTION_BANK,
  RAILWAY_TOPICS,
  type RailwayQuestion,
} from '@/lib/railway-question-bank';
import { RAILWAY_NEWS_SEEDS } from '@/lib/railway-news';
import { getTeacherToken, sitePath } from './api';
import { ArchiveError, archiveRequest, type Unit2Summary } from './archive-api';
import { Unit2Panel } from './unit2-panel';
import { CourseBoard } from './course-board';
import { ClassroomAccess } from './classroom-access';
import { type ArchiveTask as CourseTask } from './archive-api';
import { LearningAvatar, SkillRadar } from './archive-visuals';
import { type EnglishProfile, SKILL_LABELS } from './profile-api';
import { getWordToken, wordPath, wordRequest } from './word-api';
import './archive-teacher.css';

type Tab = 'students' | 'unit2' | 'tasks' | 'news' | 'devices' | 'overview';
type TaskType =
  | 'word'
  | 'speaking'
  | 'reading'
  | 'listening'
  | 'writing'
  | 'quiz'
  | 'link';
export type ArchiveTask = {
  id?: string;
  title: string;
  unit: string;
  lesson: string;
  type: TaskType;
  description: string;
  href: string;
  classes: string[];
  dueAt: number | null;
  status: 'draft' | 'published';
  questions?: RailwayQuestion[];
  material?: string;
  createdAt?: number;
  courseLocked?: boolean;
};
type ArchiveNews = {
  id?: string;
  title: string;
  summary: string;
  url: string;
  source: string;
  publishedDate: string;
  vocabulary: { word: string; meaning: string }[];
  question: string;
  status: 'draft' | 'published';
  checkedAt?: string;
};
type Student = {
  unit2?: Unit2Summary;
  id: string;
  name: string;
  className: string;
  rawName?: string;
  rawClassName?: string;
  profile?: Partial<EnglishProfile> | null;
  profileRestricted?: boolean;
  identityConflict?: boolean;
  ambiguous?: boolean;
  historyCount?: number;
  wordAverage?: number | null;
  speakingAverage?: number | null;
  quizAverage?: number | null;
  lastActive?: number | null;
};
type AccessRequest = {
  id?: string;
  requestId?: string;
  studentId?: string;
  studentName?: string;
  name?: string;
  className?: string;
  verificationCode?: string;
  deviceLabel?: string;
  createdAt?: number;
  status?: string;
  student?: { name?: string; className?: string };
};
type Device = {
  id?: string;
  sessionId?: string;
  deviceLabel?: string;
  label?: string;
  createdAt?: number;
  expiresAt?: number;
  lastSeenAt?: number;
  revokedAt?: number;
  active?: boolean;
  status?: string;
};
type Snapshot = {
  id?: string;
  createdAt?: number;
  skills?: Record<string, number>;
  goals?: string[] | string;
  note?: string;
  confidence?: number;
};
type History = {
  id?: string;
  type?: string;
  kind?: string;
  source?: string;
  module?: string;
  title?: string;
  unit?: string;
  lesson?: string;
  score?: number | null;
  totalScore?: number | null;
  average_score?: number | null;
  createdAt?: number;
  submitted_at?: number;
  submittedAt?: number;
  recordedAt?: number;
  audioUrl?: string;
  audio_url?: string;
  audioUrls?: string[];
  feedback?: string;
  transcript?: string;
  selfScore?: number;
  self_score?: number;
  total?: number;
  correct?: number;
  answers?: unknown[];
  audio?: { url: string; label?: string }[];
  details?: {
    activity?: string;
    essay?: string;
    transcript?: string;
    feedback?: unknown;
    averageSelf?: number;
    total?: number;
    correct?: number;
    results?: {
      word: string;
      transcript?: string;
      score?: number | null;
      selfRating?: number;
      scoringMode?: string;
    }[];
  };
};
type StudentDetail = {
  unit2?: Unit2Summary;
  student?: Student;
  profile?: Partial<EnglishProfile> | null;
  profileRestricted?: boolean;
  identityConflict?: boolean;
  hasMore?: boolean;
  snapshots?: Snapshot[];
  selfChecks?: Snapshot[];
  history?: History[];
  wordHistory?: History[];
  speakingHistory?: History[];
  quizHistory?: History[];
  devices?: Device[];
  wordAverage?: number | null;
  speakingAverage?: number | null;
  quizAverage?: number | null;
  summary?: {
    wordAverage?: number | null;
    speakingAverage?: number | null;
    quizAverage?: number | null;
  };
  warnings?: string[];
};
type Dashboard = {
  teacher?: { code: string; name: string; assignedClasses: string[]; canManageCourse: boolean };
  students: Student[];
  tasks: ArchiveTask[];
  news: ArchiveNews[];
  requests: AccessRequest[];
  profileRestricted?: boolean;
  hasMore?: boolean;
  warnings?: string[];
};
type TeacherOverview = {
  teachers: { code: string; name: string; studentCount: number; classes: { className: string; studentCount: number; activeCount: number; wordAverage: number | null; speakingAverage: number | null; quizAverage: number | null }[] }[];
  assignments: Record<string, string[]>;
  unassignedClassCount: number;
  hasMore: boolean;
  canEdit: boolean;
};

const taskLabels: Record<TaskType, string> = {
  word: '单词跟读',
  speaking: '情境口语',
  reading: '阅读任务',
  listening: '听力任务',
  writing: '写作任务',
  quiz: '铁路英语小测',
  link: '外部学习链接',
};
const blankTask = (): ArchiveTask => ({
  title: '',
  unit: 'Unit 1',
  lesson: 'Lesson 1',
  type: 'quiz',
  description: '',
  href: '',
  classes: [],
  dueAt: null,
  status: 'draft',
  questions: [],
  material: '',
});
const blankNews = (): ArchiveNews => ({
  title: '',
  summary: '',
  url: '',
  source: '',
  publishedDate: '',
  vocabulary: [{ word: '', meaning: '' }],
  question: '',
  status: 'draft',
});
const formatDate = (value?: number | string | null) =>
  value
    ? new Date(value).toLocaleString('zh-CN', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '暂无记录';
const scoreText = (value?: number | null) =>
  typeof value === 'number' && Number.isFinite(value) ? value.toFixed(1) : '—';
const average = (values: (number | null | undefined)[]) => {
  const valid = values.filter(
    (value): value is number =>
      typeof value === 'number' && Number.isFinite(value),
  );
  return valid.length
    ? valid.reduce((sum, value) => sum + value, 0) / valid.length
    : null;
};
const normalize = (value: string) =>
  value
    .normalize('NFKC')
    .toLocaleLowerCase('zh-CN')
    .replace(/[\s_-]+/g, '');
const classRow = (student: Student) => ({
  class_name: student.className || '',
  student_name: student.name,
  raw_student_name: student.rawName,
  raw_class_name: student.rawClassName,
  major: student.profile?.major,
});
const errorText = (error: unknown) =>
  error instanceof Error ? error.message : '暂时无法完成，请稍后重试。';
const safeLink = (value?: string) => {
  if (!value) return '';
  try {
    const url = new URL(value, window.location.origin);
    return ['https:', 'http:'].includes(url.protocol) ? url.href : '';
  } catch {
    return '';
  }
};
const localDateValue = (value: number | null) =>
  value
    ? new Date(value - new Date(value).getTimezoneOffset() * 60_000)
        .toISOString()
        .slice(0, 16)
    : '';

function Notice({
  children,
  danger = false,
}: {
  children: ReactNode;
  danger?: boolean;
}) {
  return (
    <div
      className={`at-notice ${danger ? 'at-danger' : ''}`}
      role={danger ? 'alert' : 'status'}
    >
      {children}
    </div>
  );
}
function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="at-empty">
      <Layers3 />
      <h3>{title}</h3>
      {children && <p>{children}</p>}
    </div>
  );
}
function Dialog({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const container = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    container.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
      if (event.key !== 'Tab') return;
      const focusable = Array.from(
        container.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex="0"]',
        ) || [],
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first) {
        event.preventDefault();
        return;
      }
      if (
        event.shiftKey &&
        (document.activeElement === first ||
          document.activeElement === container.current)
      ) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = oldOverflow;
      document.removeEventListener('keydown', onKey);
      previous?.focus();
    };
  }, [onClose]);
  return (
    <div
      className="at-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <dialog
        ref={container}
        open
        tabIndex={-1}
        className={`at-dialog ${wide ? 'at-dialog-wide' : ''}`}
        aria-modal="true"
        aria-label={title}
      >
        <header className="at-dialog-header">
          <div>
            <p className="at-eyebrow">RAILWAY ENGLISH · TEACHER</p>
            <h2>{title}</h2>
          </div>
          <button
            type="button"
            className="at-icon-button"
            aria-label="关闭"
            onClick={onClose}
          >
            <X />
          </button>
        </header>
        {children}
      </dialog>
    </div>
  );
}

export function ArchiveTeacher() {
  const [tab, setTab] = useState<Tab>(() =>
    new URLSearchParams(location.search).get('tab') === 'overview'
      ? 'overview'
      : new URLSearchParams(location.search).get('tab') === 'devices'
      ? 'devices'
      : new URLSearchParams(location.search).get('tab') === 'unit2'
        ? 'unit2'
        : 'students',
  );
  const [data, setData] = useState<Dashboard>({
    students: [],
    tasks: [],
    news: [],
    requests: [],
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [overview, setOverview] = useState<TeacherOverview | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [assignmentDraft, setAssignmentDraft] = useState<Record<string, string[]> | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [query, setQuery] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [collegeFilter, setCollegeFilter] = useState('');
  const [selected, setSelected] = useState<Student | null>(null);
  const openedLinkedStudent = useRef(false);
  useEffect(() => {
    if (openedLinkedStudent.current) return;
    const id = new URLSearchParams(location.search).get('student');
    const student = data.students.find((row) => row.id === id);
    if (student) {
      openedLinkedStudent.current = true;
      // Selection uses only the authorized teacher list, never a query-supplied identity.
      // oxlint-disable-next-line react/react-compiler
      setSelected(student);
    }
  }, [data.students]);
  const [taskEditor, setTaskEditor] = useState<ArchiveTask | null>(null);
  const [newsEditor, setNewsEditor] = useState<ArchiveNews | null>(null);
  const token = getTeacherToken();
  const teacherName =
    window.sessionStorage.getItem('july-english-hub.teacher-name') || 'Teacher';
  const load = useCallback(async (silent = false) => {
    if (!getTeacherToken()) {
      window.location.replace(
        `${sitePath('workbench/login')}?next=archive/teacher`,
      );
      return;
    }
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      const payload = await archiveRequest<Dashboard>(
        'teacherDashboard',
        {},
        getTeacherToken(),
      );
      setData({
        ...payload,
        students: payload.students || [],
        tasks: payload.tasks || [],
        news: payload.news || [],
        requests: payload.requests || [],
      });
      setError('');
    } catch (requestError) {
      if (requestError instanceof ArchiveError && requestError.status === 401) {
        window.sessionStorage.removeItem('july-speaking-lab.teacher-token');
        window.location.replace(
          `${sitePath('workbench/login')}?next=archive/teacher`,
        );
      }
      setError(errorText(requestError));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);
  useEffect(() => {
    // The same asynchronous fetcher owns loading state for initial load and retries.
    // oxlint-disable-next-line react/react-compiler
    void load();
  }, [load]);
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load(true);
    }, 30000);
    return () => window.clearInterval(timer);
  }, [load]);
  const loadOverview = useCallback(async () => {
    setOverviewLoading(true);
    try {
      const result = await archiveRequest<TeacherOverview>('teacherOverview', {}, getTeacherToken());
      setOverview(result);
      setAssignmentDraft(result.assignments);
      setError('');
    } catch (requestError) {
      setError(errorText(requestError));
    } finally {
      setOverviewLoading(false);
    }
  }, []);
  useEffect(() => {
    if (tab === 'overview') void loadOverview();
  }, [tab, loadOverview]);
  async function saveAssignments() {
    if (!assignmentDraft || !window.confirm('确认更新四位老师的班级分工？学生成绩不会改动。')) return;
    setOverviewLoading(true);
    try {
      await archiveRequest('saveTeacherAssignments', { assignments: assignmentDraft }, getTeacherToken());
      setMessage('班级分工已同步到教师工作台。');
      await Promise.all([loadOverview(), load(true)]);
    } catch (requestError) {
      setError(errorText(requestError));
    } finally {
      setOverviewLoading(false);
    }
  }
  const directory = useMemo(
    () =>
      createClassDirectory(
        data.students.map(classRow),
        CLASS_CATALOG.map((class_name) => ({ class_name })),
      ),
    [data.students],
  );
  const classOptions = useMemo(
    () =>
      [
        ...new Set([
          ...directory.groups.map((group) => group.label),
          ...(data.teacher?.canManageCourse ? CLASS_CATALOG : data.teacher?.assignedClasses || []),
        ]),
      ].sort((a, b) => a.localeCompare(b, 'zh-CN', { numeric: true })),
    [directory, data.teacher],
  );
  const students = useMemo(
    () =>
      data.students.filter(
        (student) =>
          (!classFilter ||
            directory.resolve(classRow(student)).key === classFilter) &&
          (!collegeFilter ||
            directory.resolve(classRow(student)).college === collegeFilter) &&
          (!query ||
            normalize(
              `${student.name}${student.rawName || ''}${student.className}${student.rawClassName || ''}${student.profile?.major || ''}`,
            ).includes(normalize(query)) ||
            directory.matches(classRow(student), query)),
      ),
    [data.students, classFilter, collegeFilter, query, directory],
  );
  const classStats = useMemo(
    () =>
      directory.groups
        .map((group) => {
          const rows = students.filter(
            (student) => directory.resolve(classRow(student)).key === group.key,
          );
          return {
            ...group,
            count: rows.length,
            word: average(rows.map((row) => row.wordAverage)),
            speaking: average(rows.map((row) => row.speakingAverage)),
            quiz: average(rows.map((row) => row.quizAverage)),
          };
        })
        .filter((group) => group.count),
    [directory, students],
  );
  const pending = data.requests.filter(
    (request) => !request.status || request.status === 'pending',
  );
  const closeStudent = useCallback(() => setSelected(null), []);
  const closeTask = useCallback(() => setTaskEditor(null), []);
  const closeNews = useCallback(() => setNewsEditor(null), []);
  async function saved(kind: string) {
    setMessage(kind);
    await load(true);
  }
  if (!token) return null;
  return (
    <main className="archive-teacher">
      <header className="at-topbar">
        <a href={sitePath('workbench')} className="at-brand">
          <span>
            <TrainFront />
          </span>
          <div>
            <strong>RAILWAY ENGLISH</strong>
            <small>英语成长档案 · 教师工作台</small>
          </div>
        </a>
        <div className="at-top-actions">
          <a href={sitePath('workbench')}>
            <ArrowLeft />
            原数据中心
          </a>
          <button
            type="button"
            onClick={() => void load(true)}
            disabled={refreshing}
          >
            <RefreshCw className={refreshing ? 'at-spin' : ''} />
            <span>刷新数据</span>
          </button>
          <span className="at-teacher-badge">
            {teacherName.slice(0, 1).toUpperCase()}
          </span>
        </div>
      </header>
      <div className="at-shell">
        <section className="at-section-heading">
          <div>
            <h1>班级学习档案</h1>
            <p>
              {data.students.length}人 · {directory.groups.length}个班级
            </p>
          </div>
          <a className="at-secondary" href={sitePath('workbench')}>
            课程与每课成绩 →
          </a>
        </section>
        <nav className="at-tabs" aria-label="教师档案功能">
          {(
            [
              { id: 'students', label: '班级档案', icon: UsersRound },
              { id: 'overview', label: '四师总览', icon: Layers3 },
              { id: 'unit2', label: '第二课成绩', icon: GraduationCap },
              { id: 'tasks', label: '任务与组题', icon: ClipboardList },
              { id: 'news', label: '铁路英语窗', icon: Newspaper },
              { id: 'devices', label: '设备确认', icon: ShieldCheck },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              className={tab === item.id ? 'active' : ''}
              onClick={() => {
                setTab(item.id);
                setMessage('');
              }}
              aria-current={tab === item.id ? 'page' : undefined}
            >
              <item.icon />
              {item.label}
              {item.id === 'devices' && pending.length > 0 && (
                <b>{pending.length}</b>
              )}
            </button>
          ))}
        </nav>
        {error && (
          <Notice danger>
            {error}
            <button type="button" onClick={() => void load(true)}>
              重新加载
            </button>
          </Notice>
        )}
        {message && (
          <Notice>
            <CheckCircle2 />
            {message}
            <button
              type="button"
              aria-label="关闭提示"
              onClick={() => setMessage('')}
            >
              <X />
            </button>
          </Notice>
        )}
        {data.warnings?.map((warning, index) => (
          <Notice key={index}>{warning}</Notice>
        ))}
        {data.hasMore && (
          <Notice danger>
            <ShieldCheck />
            当前只读取了部分档案，统计可能不完整。设备批准已暂停，请联系管理员核对完整记录后重新加载。
          </Notice>
        )}
        {loading ? (
          <div className="at-loading">
            <LoaderCircle className="at-spin" />
            正在整理班级学习记录…
          </div>
        ) : (
          <>
            {tab === 'overview' && (
              <section className="at-panel">
                <div className="at-panel-heading">
                  <div><h2>四位老师 · 班级总览</h2><p>只展示班级汇总；学生个人档案仍由任课教师查看。</p></div>
                  <button type="button" className="at-secondary" onClick={() => void loadOverview()} disabled={overviewLoading}>刷新总览</button>
                </div>
                {overviewLoading && !overview ? <div className="at-loading"><LoaderCircle className="at-spin" />正在统计…</div> : null}
                {overview?.hasMore && <Notice danger>部分记录未完整读取，暂不应用汇总数字。</Notice>}
                {overview && <>
                  <p className="at-help">四位老师合计 {overview.teachers.reduce((sum, row) => sum + row.studentCount, 0)} 份档案；另有 {overview.unassignedClassCount} 个班级尚未分给这四位老师。</p>
                  <div className="at-owner-grid">
                    {overview.teachers.map((owner) => <article className="at-owner-card" key={owner.code}>
                      <h3>{owner.name}</h3><p>{owner.classes.length} 个班 · {owner.studentCount} 份档案</p>
                      <div className="at-table-wrap"><table className="at-table"><thead><tr><th>班级</th><th>人数</th><th>单词</th><th>口语</th><th>小测</th></tr></thead><tbody>
                        {owner.classes.map((group) => <tr key={group.className}><td>{group.className}</td><td>{group.studentCount}</td><td>{scoreText(group.wordAverage)}</td><td>{scoreText(group.speakingAverage)}</td><td>{scoreText(group.quizAverage)}</td></tr>)}
                      </tbody></table></div>
                    </article>)}
                  </div>
                  {overview.canEdit && assignmentDraft && <details className="at-assignment-editor"><summary>July 管理班级分工</summary>
                    <p className="at-help">仅调整教师负责的班级；不会修改学生原始成绩、录音或学习记录。</p>
                    <div className="at-assignment-grid">{CLASS_CATALOG.filter((name) => !name.includes('默认班级')).map((name) => <label key={name}>{name}<select value={Object.entries(assignmentDraft).find(([, list]) => list.includes(name))?.[0] || ''} onChange={(event) => { const next = Object.fromEntries(Object.entries(assignmentDraft).map(([code, list]) => [code, list.filter((item) => item !== name)])) as Record<string, string[]>; if (event.target.value) next[event.target.value] = [...next[event.target.value], name]; setAssignmentDraft(next); }}><option value="">未分配</option>{overview.teachers.map((owner) => <option key={owner.code} value={owner.code}>{owner.name}</option>)}</select></label>)}</div>
                    <button type="button" className="at-primary" disabled={overviewLoading} onClick={() => void saveAssignments()}>保存并同步分工</button>
                  </details>}
                </>}
              </section>
            )}
            {tab === 'unit2' && (
              <section className="at-panel">
                <div className="at-panel-heading">
                  <h2>Unit 1 · 第2课作答明细</h2>
                  <span>每30秒自动更新</span>
                </div>
                <div className="at-filters">
                  <input
                    aria-label="搜索学生"
                    placeholder="姓名或班级关键词"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                  <SchoolClassFilter
                    college={collegeFilter}
                    classKey={classFilter}
                    groups={directory.groups}
                    onCollege={setCollegeFilter}
                    onClass={setClassFilter}
                  />
                </div>
                <div className="at-table-wrap">
                  <table className="at-table">
                    <thead>
                      <tr>
                        <th>姓名 / 班级</th>
                        <th>平陆运河首次</th>
                        <th>动词最近</th>
                        <th>时态最近</th>
                        <th>课堂填空</th>
                        <th>作文</th>
                        <th>完成项目</th>
                        <th>档案</th>
                      </tr>
                    </thead>
                    <tbody>
                      {students.map((student) => (
                        <tr key={student.id}>
                          <td>
                            {student.name}
                            <br />
                            <small>{student.className}</small>
                          </td>
                          <td>{scoreText(student.unit2?.pretest)}</td>
                          <td>
                            {scoreText(student.unit2?.stages.verbs?.latest)}
                          </td>
                          <td>{scoreText(student.unit2?.postPractice)}</td>
                          <td>
                            {scoreText(
                              student.unit2?.stages.writingClass?.latest,
                            )}
                          </td>
                          <td>
                            {scoreText(
                              student.unit2?.stages.writingEssay?.latest,
                            )}
                          </td>
                          <td>{student.unit2?.completed || 0}/4</td>
                          <td>
                            <button
                              className="at-text-button"
                              onClick={() => setSelected(student)}
                            >
                              查看原文与历史 →
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="at-help">
                  分数均换算为100分得分率。写作记录保留原文与规则评分依据；点击学生可查看本课雷达和所有尝试。
                </p>
                <section className="at-metrics">
                  <Metric
                    label="平陆运河首次均分"
                    value={scoreText(
                      average(
                        students.map((student) => student.unit2?.pretest),
                      ),
                    )}
                    note="当前筛选班级 · 已提交学生"
                    icon={<GraduationCap />}
                  />
                  <Metric
                    label="动词最近均分"
                    value={scoreText(
                      average(
                        students.map(
                          (student) => student.unit2?.stages.verbs?.latest,
                        ),
                      ),
                    )}
                    note="当前筛选班级 · 已提交学生"
                    icon={<BookOpen />}
                  />
                  <Metric
                    label="时态最近均分"
                    value={scoreText(
                      average(
                        students.map((student) => student.unit2?.postPractice),
                      ),
                    )}
                    note="当前筛选班级 · 已提交学生"
                    icon={<ClipboardList />}
                  />
                  <Metric
                    label="写作综合得分率"
                    value={scoreText(
                      average(
                        students.map((student) => student.unit2?.radar.writing),
                      ),
                    )}
                    note="课堂与作文均完成的学生"
                    icon={<FilePenLine />}
                  />
                </section>
                <p className="at-help">
                  当前筛选范围：
                  {
                    students.filter(
                      (student) => (student.unit2?.attemptCount || 0) > 0,
                    ).length
                  }
                  人已参与，
                  {
                    students.filter((student) => student.unit2?.completed === 4)
                      .length
                  }
                  人完成四项。
                </p>
              </section>
            )}
            {tab === 'students' && (
              <>
                <section className="at-section-heading">
                  <div>
                    <p className="at-eyebrow">01 / CLASS ARCHIVE</p>
                    <h2>班级里的每一个人</h2>
                    <p>合并班级的常见写法；原始填写和原模块记录继续保留。</p>
                  </div>
                  <span className="at-pill">{students.length} 份档案</span>
                </section>
                <div className="at-filters">
                  <label className="at-search">
                    <Search />
                    <input
                      type="search"
                      placeholder="搜索姓名、班级、专业，如：机车125"
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                    />
                    {query && (
                      <button
                        type="button"
                        aria-label="清除搜索"
                        onClick={() => setQuery('')}
                      >
                        <X />
                      </button>
                    )}
                  </label>
                  <SchoolClassFilter
                    college={collegeFilter}
                    classKey={classFilter}
                    groups={directory.groups}
                    onCollege={setCollegeFilter}
                    onClass={setClassFilter}
                  />
                </div>
                {data.profileRestricted && (
                  <Notice>
                    <ShieldCheck />
                    当前账号可查看授权的练习记录。历史学情调查的完整画像仅 July
                    账号可见。
                  </Notice>
                )}
                <section className="at-metrics">
                  <Metric
                    label="当前学生"
                    value={String(students.length)}
                    note={`${classStats.length} 个班级`}
                    icon={<UsersRound />}
                  />
                  <Metric
                    label="单词跟读均分"
                    value={scoreText(
                      average(students.map((student) => student.wordAverage)),
                    )}
                    note="仅统计有记录的学生"
                    icon={<AudioLines />}
                  />
                  <Metric
                    label="情境口语均分"
                    value={scoreText(
                      average(
                        students.map((student) => student.speakingAverage),
                      ),
                    )}
                    note="原模块评分 · 满分100"
                    icon={<BookOpen />}
                  />
                  <Metric
                    label="小测平均得分率"
                    value={scoreText(
                      average(students.map((student) => student.quizAverage)),
                    )}
                    note="已提交的小测 · 满分100"
                    icon={<GraduationCap />}
                  />
                </section>
                {classStats.length > 0 && (
                  <section className="at-panel">
                    <div className="at-panel-heading">
                      <h3>班级一览</h3>
                      <span>均分空缺表示尚无记录</span>
                    </div>
                    <div className="at-class-grid">
                      {classStats.map((group) => (
                        <button
                          type="button"
                          key={group.key}
                          className={`at-class-card ${classFilter === group.key ? 'selected' : ''}`}
                          onClick={() =>
                            setClassFilter(
                              classFilter === group.key ? '' : group.key,
                            )
                          }
                        >
                          <div>
                            <strong>{group.label}</strong>
                            <span>
                              {group.count} 人<ArrowRight />
                            </span>
                          </div>
                          <dl>
                            <div>
                              <dt>单词</dt>
                              <dd>{scoreText(group.word)}</dd>
                            </div>
                            <div>
                              <dt>口语</dt>
                              <dd>{scoreText(group.speaking)}</dd>
                            </div>
                            <div>
                              <dt>小测</dt>
                              <dd>{scoreText(group.quiz)}</dd>
                            </div>
                          </dl>
                          {group.aliases.length > 1 && (
                            <small>
                              已归类 {group.aliases.length} 种班级写法
                            </small>
                          )}
                        </button>
                      ))}
                    </div>
                  </section>
                )}
                <section className="at-panel">
                  <div className="at-panel-heading">
                    <h3>学生成长档案</h3>
                    <span>点击学生查看历史、雷达与录音</span>
                  </div>
                  {students.length ? (
                    <div className="at-table-wrap">
                      <table className="at-table">
                        <thead>
                          <tr>
                            <th>学生 / 班级</th>
                            <th>成长记录</th>
                            <th>单词</th>
                            <th>口语</th>
                            <th>小测</th>
                            <th>最近活动</th>
                            <th>
                              <span className="at-sr-only">操作</span>
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {students.map((student) => (
                            <tr key={student.id}>
                              <td aria-label={student.name}>
                                <div className="at-student-name">
                                  <span>{student.name.slice(0, 1)}</span>
                                  <div>
                                    <strong>{student.name}</strong>
                                    {student.identityConflict && (
                                      <span className="at-status at-danger-text">
                                        同班同名身份冲突 · 待核对学号
                                      </span>
                                    )}
                                    <small>
                                      {
                                        directory.resolve(classRow(student))
                                          .label
                                      }
                                    </small>
                                    {student.rawClassName &&
                                      student.rawClassName !==
                                        student.className && (
                                        <small>
                                          原填班级：{student.rawClassName}
                                        </small>
                                      )}
                                    {student.rawName &&
                                      student.rawName !== student.name && (
                                        <small>
                                          原填姓名：{student.rawName}
                                        </small>
                                      )}
                                  </div>
                                </div>
                              </td>
                              <td>{student.historyCount ?? 0} 条</td>
                              <td>{scoreText(student.wordAverage)}</td>
                              <td>{scoreText(student.speakingAverage)}</td>
                              <td>{scoreText(student.quizAverage)}</td>
                              <td className="at-muted">
                                {formatDate(student.lastActive)}
                              </td>
                              <td>
                                <button
                                  type="button"
                                  className="at-text-button"
                                  onClick={() => setSelected(student)}
                                >
                                  查看档案
                                  <ArrowRight />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <Empty
                      title={
                        data.students.length
                          ? '没有匹配的学生'
                          : '成长档案从第一次访问开始'
                      }
                    >
                      {data.students.length
                        ? '试试班级简称或清除筛选条件。'
                        : '学生建立档案并获得教师确认后，学习记录会显示在这里。'}
                    </Empty>
                  )}
                </section>
              </>
            )}
            {tab === 'tasks' && (
              <CourseBoard
                teacher
                tasks={data.tasks as unknown as CourseTask[]}
                onTask={(unit, lesson, task) =>
                  setTaskEditor(
                    task
                      ? (task as unknown as ArchiveTask)
                      : {
                          ...blankTask(),
                          unit: 'Unit ' + unit,
                          lesson: 'Lesson ' + lesson,
                          type: 'link',
                        },
                  )
                }
              />
            )}
            {tab === 'news' && (
              <>
                <section className="at-section-heading">
                  <div>
                    <p className="at-eyebrow">03 / RAILWAY ENGLISH WINDOW</p>
                    <h2>从课堂，望向世界</h2>
                    <p>以可核查的铁路报道为材料，加入英文词汇与课堂思考。</p>
                  </div>
                  <button
                    type="button"
                    className="at-primary"
                    onClick={() => setNewsEditor(blankNews())}
                  >
                    <Plus />
                    新建英语窗
                  </button>
                </section>
                <section className="at-panel at-news-seeds">
                  <div className="at-panel-heading">
                    <h3>编辑选题库</h3>
                    <span>导入后由教师核对、编辑并发布</span>
                  </div>
                  <div className="at-seed-grid">
                    {RAILWAY_NEWS_SEEDS.map((seed, index) => (
                      <article key={seed.id || index}>
                        <span className="at-eyebrow">
                          {seed.source} · {seed.publishedDate}
                        </span>
                        <h4>{seed.title}</h4>
                        <p>{seed.summary}</p>
                        <div>
                          <a
                            href={safeLink(seed.url)}
                            target="_blank"
                            rel="noreferrer"
                          >
                            核对原文
                            <ExternalLink />
                          </a>
                          <button
                            type="button"
                            onClick={() =>
                              setNewsEditor({
                                ...seed,
                                id: undefined,
                                vocabulary: seed.vocabulary.map((item) => ({
                                  ...item,
                                })),
                                status: 'draft',
                              })
                            }
                          >
                            导入选题草稿
                            <Plus />
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                  <p className="at-help">
                    选题保留原文发布日期，不代表今天的新闻；发布前请核对原文和英文内容。导入草稿不会自动发布。
                  </p>
                </section>
                {data.news.length ? (
                  <div className="at-content-grid">
                    {data.news.map((news, index) => (
                      <article
                        className="at-content-card"
                        key={news.id || index}
                      >
                        <div className="at-card-meta">
                          <span>{news.source}</span>
                          <Status status={news.status} />
                        </div>
                        <h3>{news.title}</h3>
                        <p>{news.summary}</p>
                        <div className="at-tags">
                          {news.vocabulary.slice(0, 3).map((item) => (
                            <span key={item.word}>{item.word}</span>
                          ))}
                        </div>
                        <small className="at-muted">
                          原文日期 {news.publishedDate}
                        </small>
                        <footer>
                          <button
                            type="button"
                            className="at-text-button"
                            onClick={() =>
                              setNewsEditor({
                                ...news,
                                vocabulary: news.vocabulary.map((item) => ({
                                  ...item,
                                })),
                              })
                            }
                          >
                            <FilePenLine />
                            编辑内容
                          </button>
                          <a
                            href={safeLink(news.url)}
                            target="_blank"
                            rel="noreferrer"
                            className="at-text-button"
                          >
                            查看来源
                            <ExternalLink />
                          </a>
                        </footer>
                      </article>
                    ))}
                  </div>
                ) : (
                  <Empty title="英语窗正在等一篇好材料">
                    从上方选题导入，或手动填写有可靠来源的铁路报道。
                  </Empty>
                )}
              </>
            )}
            {tab === 'devices' && (
              <>
                <section className="at-section-heading">
                  <div>
                    <p className="at-eyebrow">04 / TRUSTED ACCESS</p>
                    <h2>学生进入申请</h2>
                    <p>学生先完成任务，课后核对本人和申请设备，再确认归档。</p>
                  </div>
                  <span className="at-pill">{pending.length} 项待确认</span>
                </section>
                <ClassroomAccess expanded onChanged={() => void load(true)} />
              </>
            )}
          </>
        )}
        <footer className="at-footer">
          <TrainFront />
          <span>RAILWAY ENGLISH · 成长有方向，学习有回声</span>
          <a href={sitePath('workbench')}>返回原数据中心</a>
        </footer>
      </div>
      {selected && <StudentDialog student={selected} onClose={closeStudent} />}
      {taskEditor && (
        <TaskComposer
          initial={taskEditor}
          classes={classOptions}
          onClose={closeTask}
          onSaved={async (status) => {
            setTaskEditor(null);
            await saved(
              status === 'published'
                ? '任务已发布到所选班级。'
                : '任务草稿已保存。',
            );
          }}
        />
      )}
      {newsEditor && (
        <NewsComposer
          initial={newsEditor}
          onClose={closeNews}
          onSaved={async (status) => {
            setNewsEditor(null);
            await saved(
              status === 'published'
                ? '铁路英语窗已发布。'
                : '英语窗草稿已保存。',
            );
          }}
        />
      )}
    </main>
  );
}

function Metric({
  label,
  value,
  note,
  icon,
}: {
  label: string;
  value: string;
  note: string;
  icon: ReactNode;
}) {
  return (
    <article className="at-metric">
      <div>
        {icon}
        <span>{label}</span>
      </div>
      <strong>{value}</strong>
      <small>{note}</small>
    </article>
  );
}
function Status({ status }: { status: string }) {
  return (
    <span className={`at-status ${status === 'published' ? 'published' : ''}`}>
      {status === 'published' ? '已发布' : '草稿'}
    </span>
  );
}

function StudentDialog({
  student,
  onClose,
}: {
  student: Student;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<StudentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [revoking, setRevoking] = useState('');
  const load = useCallback(async () => {
    setLoading(true);
    try {
      setDetail(
        await archiveRequest<StudentDetail>(
          'teacherStudent',
          { studentId: student.id },
          getTeacherToken(),
        ),
      );
      setError('');
    } catch (requestError) {
      setError(errorText(requestError));
    } finally {
      setLoading(false);
    }
  }, [student.id]);
  useEffect(() => {
    // This starts an external data request; its loading flag is shared with retries.
    // oxlint-disable-next-line react/react-compiler
    void load();
  }, [load]);
  const profile =
    detail?.profile || detail?.student?.profile || student.profile;
  const snapshots = [...(detail?.snapshots || detail?.selfChecks || [])].sort(
    (a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0),
  );
  const history = [
    ...(detail?.history || []),
    ...(detail?.wordHistory || []).map((item) => ({ ...item, type: 'word' })),
    ...(detail?.speakingHistory || []).map((item) => ({
      ...item,
      type: 'speaking',
    })),
    ...(detail?.quizHistory || []).map((item) => ({ ...item, type: 'quiz' })),
  ]
    .map(normalizeHistory)
    .sort((a, b) => historyTime(b) - historyTime(a));
  const records = history.filter(
    (item) => filter === 'all' || historyKind(item) === filter,
  );
  const latestSkills = snapshots[0]?.skills || profile?.skills;
  const devices = (detail?.devices || []).filter(
    (device) =>
      !device.revokedAt &&
      device.status !== 'revoked' &&
      device.active !== false,
  );
  async function revoke(device: Device) {
    const sessionId = device.sessionId || device.id;
    if (
      !sessionId ||
      !window.confirm(
        `撤销 ${student.name} 的“${device.deviceLabel || device.label || '此设备'}”访问权限？该设备需重新申请。`,
      )
    )
      return;
    setRevoking(sessionId);
    try {
      await archiveRequest(
        'revokeDevice',
        { sessionId, studentId: student.id },
        getTeacherToken(),
      );
      await load();
    } catch (requestError) {
      setError(errorText(requestError));
    } finally {
      setRevoking('');
    }
  }
  return (
    <Dialog title={`${student.name}的成长档案`} onClose={onClose} wide>
      <div className="at-dialog-body">
        <Unit2Panel data={detail?.unit2 || student.unit2} links={false} />
        {error && (
          <Notice danger>
            {error}
            <button type="button" onClick={() => void load()}>
              重试
            </button>
          </Notice>
        )}
        {detail?.warnings?.map((warning, index) => (
          <Notice
            key={index}
            danger={Boolean(detail.identityConflict || detail.hasMore)}
          >
            {warning}
          </Notice>
        ))}
        {(detail?.identityConflict || student.identityConflict) && (
          <Notice danger>
            <ShieldCheck />
            身份待核验：同班同名记录涉及不同学号。以下历史仅供教师核对，不能据此确认属于同一学生；学生访问与设备批准已暂停，请先核对原始记录。
          </Notice>
        )}
        {detail?.hasMore && (
          <Notice danger>
            当前个人档案或设备列表尚未完整读取，以下记录和统计可能不完整。请联系管理员分批核对。
          </Notice>
        )}
        {loading ? (
          <div className="at-loading">
            <LoaderCircle className="at-spin" />
            正在读取个人记录…
          </div>
        ) : (
          <>
            <section className="at-profile-intro">
              <LearningAvatar variant="engineer" />
              <div>
                <p className="at-eyebrow">MY LEARNING JOURNEY</p>
                <h3>{student.name}</h3>
                <p>
                  {student.className}{' '}
                  {profile?.major ? `· ${profile.major}` : ''}
                </p>
                <span>
                  {history.length} 条学习记录 · {snapshots.length} 次成长自评
                </span>
              </div>
            </section>
            <div className="at-detail-metrics">
              <div>
                <small>单词跟读均分</small>
                <strong>
                  {scoreText(
                    detail?.summary?.wordAverage ??
                      detail?.wordAverage ??
                      detail?.student?.wordAverage ??
                      student.wordAverage,
                  )}
                </strong>
              </div>
              <div>
                <small>口语练习均分</small>
                <strong>
                  {scoreText(
                    detail?.summary?.speakingAverage ??
                      detail?.speakingAverage ??
                      detail?.student?.speakingAverage ??
                      student.speakingAverage,
                  )}
                </strong>
              </div>
              <div>
                <small>小测平均得分率</small>
                <strong>
                  {scoreText(
                    detail?.summary?.quizAverage ??
                      detail?.quizAverage ??
                      detail?.student?.quizAverage ??
                      student.quizAverage,
                  )}
                </strong>
              </div>
            </div>
            {detail?.profileRestricted || student.profileRestricted ? (
              <Notice>
                <ShieldCheck />
                当前账号无权读取历史学情调查中的完整个人画像。授权范围内的练习记录显示如下。
              </Notice>
            ) : null}
            <section className="at-detail-grid">
              <div className="at-panel">
                <div className="at-panel-heading">
                  <h3>技能成长雷达</h3>
                  <span>自评 1–5 分</span>
                </div>
                {latestSkills ? (
                  <>
                    <SkillRadar
                      skills={latestSkills}
                      previous={
                        snapshots.length > 1 ? snapshots[1]?.skills : undefined
                      }
                    />
                    <p className="at-help">
                      展示最近自评；有上次记录时叠加对比。自评与练习成绩分别呈现。
                    </p>
                  </>
                ) : (
                  <Empty title="尚无可用技能自评">
                    学生完成自评后可查看变化。
                  </Empty>
                )}
              </div>
              <div className="at-panel">
                <div className="at-panel-heading">
                  <h3>学习目标与支持</h3>
                  <GraduationCap />
                </div>
                <dl className="at-profile-notes">
                  <dt>本学期目标</dt>
                  <dd>
                    {profile?.semester_goal || '尚未填写或当前账号不可见'}
                  </dd>
                  <dt>学习方向</dt>
                  <dd>
                    {profile?.learning_goals?.join(' · ') ||
                      '尚未填写或当前账号不可见'}
                  </dd>
                  <dt>主要困难</dt>
                  <dd>
                    {profile?.difficulties?.join(' · ') ||
                      '尚未填写或当前账号不可见'}
                  </dd>
                  <dt>给老师的话</dt>
                  <dd>{profile?.teacher_message || '暂无可查看的留言'}</dd>
                </dl>
              </div>
            </section>
            <section className="at-panel">
              <div className="at-panel-heading">
                <h3>自评变化记录</h3>
                <span>{snapshots.length} 次</span>
              </div>
              {snapshots.length ? (
                <div className="at-snapshot-list">
                  {snapshots.map((snapshot, index) => (
                    <article key={snapshot.id || index}>
                      <div>
                        <Clock3 />
                        <strong>{formatDate(snapshot.createdAt)}</strong>
                        {index === 0 && (
                          <span className="at-pill">最近一次</span>
                        )}
                      </div>
                      <div className="at-tags">
                        {Object.entries(snapshot.skills || {}).map(
                          ([key, value]) => (
                            <span key={key}>
                              {SKILL_LABELS[key as keyof typeof SKILL_LABELS] ||
                                key}{' '}
                              {value}/5
                            </span>
                          ),
                        )}
                      </div>
                      {snapshot.goals && (
                        <p>
                          目标：
                          {Array.isArray(snapshot.goals)
                            ? snapshot.goals.join('、')
                            : snapshot.goals}
                        </p>
                      )}
                      {snapshot.note && <p>{snapshot.note}</p>}
                    </article>
                  ))}
                </div>
              ) : (
                <p className="at-help">尚未保存新的自评记录。</p>
              )}
            </section>
            <section className="at-panel">
              <div className="at-panel-heading">
                <h3>学习记录与原始录音</h3>
                <select
                  aria-label="筛选个人学习记录"
                  value={filter}
                  onChange={(event) => setFilter(event.target.value)}
                >
                  <option value="all">全部记录</option>
                  <option value="unit2">第二课测试与写作</option>
                  <option value="word">单词跟读</option>
                  <option value="speaking">情境口语</option>
                  <option value="quiz">铁路小测</option>
                  <option value="profile">学情自评</option>
                </select>
              </div>
              {records.length ? (
                <div className="at-history-list">
                  {records.map((record, index) => {
                    const kind = historyKind(record);
                    const audio = [
                      ...new Set(
                        [
                          record.audioUrl,
                          record.audio_url,
                          ...(record.audioUrls || []),
                        ]
                          .map((value) => safeLink(value))
                          .filter(Boolean),
                      ),
                    ];
                    return (
                      <article key={`${record.id || index}-${kind}`}>
                        <div className="at-history-heading">
                          <span className="at-record-icon">
                            {kind === 'quiz' ? (
                              <ClipboardList />
                            ) : (
                              <AudioLines />
                            )}
                          </span>
                          <div>
                            <strong>
                              {record.title ||
                                taskLabels[kind as TaskType] ||
                                '学习记录'}
                            </strong>
                            <small>
                              {[record.unit, record.lesson]
                                .filter(Boolean)
                                .join(' · ')}{' '}
                              · {formatDate(historyTime(record))}
                            </small>
                          </div>
                          <span className="at-record-score">
                            {scoreText(
                              record.score ??
                                record.totalScore ??
                                record.average_score,
                            )}
                            <small> / 100</small>
                          </span>
                        </div>
                        {record.feedback && <p>{record.feedback}</p>}
                        <HistoryDetails record={record} />
                        {record.transcript && (
                          <details>
                            <summary>查看识别文本</summary>
                            <p>{record.transcript}</p>
                          </details>
                        )}
                        {(record.selfScore ?? record.self_score) !==
                          undefined && (
                          <p className="at-help">
                            学生自评分：{record.selfScore ?? record.self_score}
                          </p>
                        )}
                        {record.correct !== undefined && (
                          <p className="at-help">
                            答对 {record.correct} /{' '}
                            {record.total ?? record.answers?.length ?? '—'} 题
                          </p>
                        )}
                        {audio.map((url, audioIndex) => (
                          <div className="at-audio" key={url}>
                            <span>
                              {record.audio?.find(
                                (clip) => safeLink(clip.url) === url,
                              )?.label || `录音 ${audioIndex + 1}`}
                            </span>
                            {/* Original student recordings have no timed captions; recognition text is shown above. */}
                            {/* oxlint-disable-next-line jsx-a11y/media-has-caption */}
                            <audio
                              controls
                              preload="none"
                              src={url}
                              aria-label={
                                record.audio?.find(
                                  (clip) => safeLink(clip.url) === url,
                                )?.label || `学生原始录音${audioIndex + 1}`
                              }
                            >
                              浏览器暂不支持播放
                            </audio>
                            <a
                              href={url}
                              target="_blank"
                              rel="noreferrer"
                              aria-label={`打开录音${audioIndex + 1}`}
                            >
                              <ExternalLink />
                            </a>
                          </div>
                        ))}
                      </article>
                    );
                  })}
                </div>
              ) : (
                <Empty title="这个分类还没有记录">
                  完成原模块练习后，记录将在这里汇总。
                </Empty>
              )}
            </section>
            <section className="at-panel">
              <div className="at-panel-heading">
                <h3>已授权设备</h3>
                <ShieldCheck />
              </div>
              {devices.length ? (
                <div className="at-device-list">
                  {devices.map((device, index) => (
                    <div key={device.sessionId || device.id || index}>
                      <Smartphone />
                      <div>
                        <strong>
                          {device.deviceLabel || device.label || '已授权设备'}
                        </strong>
                        <small>
                          授权至 {formatDate(device.expiresAt)} · 最近使用{' '}
                          {formatDate(device.lastSeenAt || device.createdAt)}
                        </small>
                      </div>
                      <button
                        type="button"
                        className="at-text-button at-danger-text"
                        disabled={
                          Boolean(revoking) || !(device.sessionId || device.id)
                        }
                        onClick={() => void revoke(device)}
                      >
                        {revoking === (device.sessionId || device.id)
                          ? '正在撤销…'
                          : '撤销授权'}
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="at-help">暂无已授权设备。</p>
              )}
            </section>
          </>
        )}
      </div>
    </Dialog>
  );
}

function historyKind(record: History) {
  const value =
    record.type || record.kind || record.source || record.module || '';
  return /word|vocabulary/i.test(value)
    ? 'word'
    : /speak/i.test(value)
      ? 'speaking'
      : /quiz|test/i.test(value)
        ? 'quiz'
        : /profile|self/i.test(value)
          ? 'profile'
          : value;
}
function historyTime(record: History) {
  return Number(
    record.submittedAt ||
      record.createdAt ||
      record.submitted_at ||
      record.recordedAt ||
      0,
  );
}

function normalizeHistory(record: History): History {
  const details = record.details;
  return {
    ...record,
    transcript: record.transcript || details?.transcript,
    feedback:
      record.feedback ||
      (typeof details?.feedback === 'string' ? details.feedback : undefined),
    selfScore: record.selfScore ?? details?.averageSelf,
    total: record.total ?? details?.total,
    correct: record.correct ?? details?.correct,
    audioUrls: [
      ...(record.audioUrls || []),
      ...(record.audio || []).map((clip) => clip.url),
    ],
  };
}

function HistoryDetails({ record }: { record: History }) {
  const quizFeedback = Array.isArray(record.details?.feedback)
    ? (record.details.feedback as {
        prompt?: string;
        options?: string[];
        selected?: number;
        answer?: number;
        correct?: boolean;
        explanation?: string;
      }[])
    : [];
  return (
    <>
      {record.type === 'unit2' && (
        <details>
          <summary>查看第二课答案 / 作文原文</summary>
          <div className="at-quiz-feedback">
            {record.details?.essay && (
              <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.9 }}>
                {record.details.essay}
              </p>
            )}
            {(Array.isArray(record.details?.feedback)
              ? (record.details.feedback as {
                  prompt: string;
                  selected: string;
                  answer: string;
                  correct: boolean;
                  explanation?: string;
                }[])
              : []
            ).map((item, index) => (
              <article key={index}>
                <strong>
                  {item.prompt} · {item.correct ? '✓' : '待巩固'}
                </strong>
                {item.selected && <p>学生答案：{item.selected}</p>}
                {item.answer && <p>参考答案：{item.answer}</p>}
                {item.explanation && <p>{item.explanation}</p>}
              </article>
            ))}
          </div>
        </details>
      )}
      {record.details?.results?.length ? (
        <details>
          <summary>查看逐词成绩与识别结果</summary>
          <div className="at-word-results">
            {record.details.results.map((result, index) => (
              <div key={index}>
                <strong>{result.word}</strong>
                <span>
                  {scoreText(result.score)}分 · 自评 {result.selfRating ?? '—'}
                </span>
                {result.transcript && <p>识别：{result.transcript}</p>}
              </div>
            ))}
          </div>
        </details>
      ) : null}
      {record.type !== 'unit2' && quizFeedback.length ? (
        <details>
          <summary>查看小测答题与解析</summary>
          <div className="at-quiz-feedback">
            {quizFeedback.map((result, index) => (
              <article key={index}>
                <strong>
                  {index + 1}. {result.prompt}
                </strong>
                <p>
                  {result.correct ? '✓ 回答正确' : '待复习'} · 学生选项：
                  {result.options?.[result.selected ?? -1] || '未作答'}
                </p>
                <p>正确答案：{result.options?.[result.answer ?? -1] || '—'}</p>
                {result.explanation && <p>{result.explanation}</p>}
              </article>
            ))}
          </div>
        </details>
      ) : null}
    </>
  );
}

export function TaskComposer({
  initial,
  classes,
  onClose,
  onSaved,
}: {
  initial: ArchiveTask;
  classes: string[];
  onClose: () => void;
  onSaved: (status: string) => Promise<void>;
}) {
  const [task, setTask] = useState<ArchiveTask>(initial);
  const courseLocked = Boolean(
    initial.courseLocked || initial.status === 'published',
  );
  const [topic, setTopic] = useState('all');
  const [difficulty, setDifficulty] = useState('all');
  const [count, setCount] = useState(5);
  const [rotation, setRotation] = useState(0);
  const [classQuery, setClassQuery] = useState('');
  const [classCollege, setClassCollege] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [wordUnits, setWordUnits] = useState<
    { id: string; title: string; teacher_name: string; share_code: string }[]
  >([]);
  const [wordUnitError, setWordUnitError] = useState('');
  useEffect(() => {
    if (task.type !== 'word' || !getWordToken()) return;
    let active = true;
    void wordRequest<{
      rows: {
        id: string;
        title: string;
        teacher_name: string;
        share_code: string;
      }[];
    }>('teacherListSharedUnits', {}, getWordToken())
      .then((result) => {
        if (active) {
          setWordUnits(result.rows);
          setWordUnitError('');
        }
      })
      .catch(() => {
        if (active) setWordUnitError('跟读单元暂未读取到，可填写原练习链接。');
      });
    return () => {
      active = false;
    };
  }, [task.type]);
  const form = useRef<HTMLFormElement>(null);
  const classDirectory = useMemo(
    () =>
      createClassDirectory(
        classes.map((class_name) => ({ class_name })),
        CLASS_CATALOG.map((class_name) => ({ class_name })),
      ),
    [classes],
  );
  const filteredClasses = classes.filter(
    (name) =>
      (!classCollege || collegeForClass(name) === classCollege) &&
      (!classQuery || classDirectory.matches({ class_name: name }, classQuery)),
  );
  const available = RAILWAY_QUESTION_BANK.filter(
    (question) =>
      (topic === 'all' || question.topic === topic) &&
      (difficulty === 'all' || question.difficulty === difficulty),
  ).length;
  const update = (patch: Partial<ArchiveTask>) =>
    setTask((current) => ({ ...current, ...patch }));
  function build() {
    if (
      task.questions?.length &&
      !window.confirm('重新组题会替换当前题目及编辑内容，继续吗？')
    )
      return;
    const questions = buildRailwayQuiz({ topic, difficulty, count, rotation });
    update({ questions });
    setRotation(rotation + 1);
    setNotice(
      `已从现有题库选入 ${questions.length} 题。${questions.length < count ? '当前筛选的题量有限，已使用全部可用题目。' : ''}请逐题检查后保存。`,
    );
  }
  function changeQuestion(index: number, patch: Partial<RailwayQuestion>) {
    update({
      questions: task.questions?.map((question, i) =>
        i === index ? { ...question, ...patch } : question,
      ),
    });
  }
  async function save(status: 'draft' | 'published') {
    if (busy || !form.current?.reportValidity()) return;
    setError('');
    if (task.type === 'quiz' && !task.questions?.length) {
      setError('保存小测前请先组题或手动添加题目。');
      return;
    }
    if (
      task.questions?.some(
        (question) =>
          !question.prompt.trim() ||
          question.options.length < 2 ||
          question.options.some((option) => !option.trim()) ||
          !Number.isInteger(question.answer) ||
          question.answer < 0 ||
          question.answer >= question.options.length,
      )
    ) {
      setError('请填写完整的题目、选项，并为每道题指定正确答案。');
      return;
    }
    if (status === 'published' && !task.classes.length) {
      setError('请选择至少一个发布班级。');
      return;
    }
    if (task.href && !safeLink(task.href)) {
      setError('学习链接必须是有效的 http 或 https 网址。');
      return;
    }
    if (
      status === 'published' &&
      ['word', 'speaking', 'link'].includes(task.type) &&
      !task.href
    ) {
      setError('请填写或选择学生可以打开的练习链接。');
      return;
    }
    if (
      status === 'published' &&
      !window.confirm(
        `确认发布“${task.title}”？\n面向：${task.classes.join('、')}\n${task.type === 'quiz' ? `${task.questions?.length || 0} 道题；请确认题目与答案均已核对。` : '发布后学生可在个人档案中看到此任务。'}`,
      )
    )
      return;
    setBusy(true);
    try {
      await archiveRequest(
        'saveTask',
        {
          task: {
            ...task,
            href: safeLink(task.href),
            status,
            questions: task.type === 'quiz' ? task.questions : [],
            title: task.title.trim(),
          },
        },
        getTeacherToken(),
      );
      await onSaved(status);
    } catch (requestError) {
      setError(errorText(requestError));
    } finally {
      setBusy(false);
    }
  }
  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    void save('draft');
  }
  return (
    <Dialog
      title={task.id ? '编辑学习任务' : '新建学习任务'}
      onClose={onClose}
      wide
    >
      <form ref={form} onSubmit={submit} className="at-composer">
        <div className="at-dialog-body">
          {error && <Notice danger>{error}</Notice>}
          <div className="at-form-grid">
            <label className="at-field at-span-two">
              <span>任务名称 *</span>
              <input
                required
                maxLength={100}
                value={task.title}
                onChange={(event) => update({ title: event.target.value })}
                placeholder="如：Unit 1 · 车站英语热身小测"
              />
            </label>
            <label className="at-field">
              <span>任务类型</span>
              <select
                value={task.type}
                disabled={courseLocked}
                onChange={(event) => {
                  const type = event.target.value as TaskType;
                  update({
                    type,
                    href:
                      type === 'word'
                        ? wordPath()
                        : type === 'speaking'
                          ? sitePath('student')
                          : '',
                  });
                }}
              >
                {Object.entries(taskLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="at-field">
              <span>截止时间（可选）</span>
              <input
                type="datetime-local"
                value={localDateValue(task.dueAt)}
                onChange={(event) =>
                  update({
                    dueAt: event.target.value
                      ? new Date(event.target.value).getTime()
                      : null,
                  })
                }
              />
            </label>
            <label className="at-field">
              <span>单元 *</span>
              <select
                disabled={courseLocked}
                value={task.unit}
                onChange={(event) => update({ unit: event.target.value })}
              >
                {Array.from({ length: 30 }, (_, i) => i + 1).map((unit) => (
                  <option value={`Unit ${unit}`} key={unit}>
                    Unit {unit}
                  </option>
                ))}
              </select>
            </label>
            <label className="at-field">
              <span>课次 *</span>
              <select
                disabled={courseLocked}
                value={task.lesson}
                onChange={(event) => update({ lesson: event.target.value })}
              >
                {[1, 2, 3].map((lesson) => (
                  <option value={`Lesson ${lesson}`} key={lesson}>
                    第{lesson}课
                  </option>
                ))}
              </select>
            </label>
            <label className="at-field at-span-two">
              <span>学习说明</span>
              <textarea
                rows={3}
                value={task.description}
                onChange={(event) =>
                  update({ description: event.target.value })
                }
                placeholder="告诉学生要做什么，以及完成后如何检查。"
              />
            </label>
            {task.type === 'word' && (
              <label className="at-field at-span-two">
                <span>选择已发布的跟读单元</span>
                <select
                  disabled={courseLocked}
                  value={
                    wordUnits.find((unit) =>
                      task.href.includes(`unit=${unit.share_code}`),
                    )?.id || ''
                  }
                  onChange={(event) => {
                    const unit = wordUnits.find(
                      (unit) => unit.id === event.target.value,
                    );
                    if (unit)
                      update({
                        href: `${location.origin}${wordPath()}?unit=${encodeURIComponent(unit.share_code)}`,
                        ...(task.title ? {} : { title: unit.title }),
                      });
                  }}
                >
                  <option value="">请选择（或在下方粘贴已有链接）</option>
                  {wordUnits.map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {unit.title} · {unit.teacher_name}
                    </option>
                  ))}
                </select>
                <small>
                  {wordUnitError ||
                    '选定单元后自动填写链接；其跟读成绩会关联到本课。'}
                </small>
              </label>
            )}
            {task.type !== 'quiz' && (
              <label className="at-field at-span-two">
                <span>
                  练习链接{' '}
                  {['word', 'speaking', 'link'].includes(task.type)
                    ? '*'
                    : '（可选）'}
                </span>
                <input
                  required={['word', 'speaking', 'link'].includes(task.type)}
                  readOnly={courseLocked && initial.type === 'word'}
                  value={task.href}
                  onChange={(event) => update({ href: event.target.value })}
                  placeholder="https://… 或本站练习地址"
                />
                <small>
                  本站跟读、小测及第二课活动可回传成绩；普通外部链接仅用于打开资源。
                </small>
              </label>
            )}
            <label className="at-field at-span-two">
              <span>阅读 / 听力文本 / 写作材料（可选）</span>
              <textarea
                rows={4}
                value={task.material || ''}
                onChange={(event) => update({ material: event.target.value })}
                placeholder="粘贴已核对的教学文本、听力材料链接或写作要求。"
              />
            </label>
          </div>
          <section className="at-form-section">
            <div className="at-panel-heading">
              <h3>发布到哪些班级</h3>
              <span>已选 {task.classes.length} 个</span>
            </div>
            <label className="at-field">
              <span>按学院选择任务班级</span>
              <select
                value={classCollege}
                onChange={(event) => setClassCollege(event.target.value)}
              >
                <option value="">全部学院</option>
                {SCHOOL_COLLEGES.map((college) => (
                  <option key={college}>{college}</option>
                ))}
              </select>
            </label>
            <label className="at-search">
              <Search />
              <input
                value={classQuery}
                onChange={(event) => setClassQuery(event.target.value)}
                placeholder="搜索班级简称或编号"
                aria-label="搜索任务目标班级"
              />
            </label>
            <div className="at-class-options">
              {filteredClasses.map((name) => (
                <label
                  key={name}
                  className={task.classes.includes(name) ? 'selected' : ''}
                >
                  <input
                    type="checkbox"
                    checked={task.classes.includes(name)}
                    onChange={(event) =>
                      update({
                        classes: event.target.checked
                          ? [...task.classes, name]
                          : task.classes.filter((value) => value !== name),
                      })
                    }
                  />
                  {name}
                </label>
              ))}
            </div>
            {!filteredClasses.length && (
              <p className="at-help">没有匹配的班级。</p>
            )}
            {task.classes
              .filter((name) => !classes.includes(name))
              .map((name) => (
                <label className="at-checkbox" key={name}>
                  <input
                    type="checkbox"
                    checked
                    onChange={() =>
                      update({
                        classes: task.classes.filter((value) => value !== name),
                      })
                    }
                  />
                  {name}（此前所选）
                </label>
              ))}
          </section>
          {task.type === 'quiz' && (
            <section className="at-form-section">
              <div className="at-panel-heading">
                <div>
                  <h3>铁路英语题库组卷</h3>
                  <p className="at-help">
                    题库组卷，不是AI自动出题。教学情境文本不作为真实项目新闻。本题库随网页代码公开，用于课堂练习，不用于保密考试。
                  </p>
                </div>
                <span className="at-pill">
                  {task.questions?.length || 0} 题
                </span>
              </div>
              <div className="at-bank-controls">
                <label className="at-field">
                  <span>题目主题</span>
                  <select
                    value={topic}
                    onChange={(event) => setTopic(event.target.value)}
                  >
                    {RAILWAY_TOPICS.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="at-field">
                  <span>难度</span>
                  <select
                    value={difficulty}
                    onChange={(event) => setDifficulty(event.target.value)}
                  >
                    <option value="all">混合难度</option>
                    <option value="foundation">基础词汇</option>
                    <option value="practice">情境应用</option>
                    <option value="challenge">综合理解</option>
                  </select>
                </label>
                <label className="at-field">
                  <span>题数（可用 {available} 题）</span>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={count}
                    onChange={(event) =>
                      setCount(
                        Math.max(
                          1,
                          Math.min(20, Number(event.target.value) || 1),
                        ),
                      )
                    }
                  />
                </label>
                <button type="button" className="at-secondary" onClick={build}>
                  <Layers3 />
                  {task.questions?.length ? '重新组题' : '从题库组题'}
                </button>
              </div>
              {notice && <Notice>{notice}</Notice>}
              <div className="at-question-list">
                {task.questions?.map((question, index) => (
                  <article
                    className="at-question-editor"
                    key={`${question.id}-${index}`}
                  >
                    <div className="at-panel-heading">
                      <h4>QUESTION {String(index + 1).padStart(2, '0')}</h4>
                      <button
                        type="button"
                        className="at-icon-button"
                        aria-label={`删除第${index + 1}题`}
                        onClick={() =>
                          update({
                            questions: task.questions?.filter(
                              (_, i) => i !== index,
                            ),
                          })
                        }
                      >
                        <Trash2 />
                      </button>
                    </div>
                    <label className="at-field">
                      <span>题干 *</span>
                      <textarea
                        required
                        rows={3}
                        value={question.prompt}
                        onChange={(event) =>
                          changeQuestion(index, { prompt: event.target.value })
                        }
                      />
                    </label>
                    <div className="at-answer-options">
                      {question.options.map((option, answerIndex) => (
                        <label
                          key={answerIndex}
                          className={
                            question.answer === answerIndex ? 'correct' : ''
                          }
                        >
                          <input
                            type="radio"
                            name={`answer-${index}`}
                            checked={question.answer === answerIndex}
                            onChange={() =>
                              changeQuestion(index, { answer: answerIndex })
                            }
                            aria-label={`第${index + 1}题正确答案${String.fromCharCode(65 + answerIndex)}`}
                          />
                          <b>{String.fromCharCode(65 + answerIndex)}</b>
                          <input
                            required
                            aria-label={`第${index + 1}题选项${String.fromCharCode(65 + answerIndex)}`}
                            value={option}
                            onChange={(event) =>
                              changeQuestion(index, {
                                options: question.options.map(
                                  (value, optionIndex) =>
                                    optionIndex === answerIndex
                                      ? event.target.value
                                      : value,
                                ),
                              })
                            }
                          />
                          {question.answer === answerIndex && <Check />}
                        </label>
                      ))}
                    </div>
                    <label className="at-field">
                      <span>答案解析</span>
                      <textarea
                        rows={2}
                        value={question.explanation}
                        onChange={(event) =>
                          changeQuestion(index, {
                            explanation: event.target.value,
                          })
                        }
                      />
                    </label>
                  </article>
                ))}
              </div>
              <button
                type="button"
                className="at-secondary"
                onClick={() =>
                  update({
                    questions: [
                      ...(task.questions || []),
                      {
                        id: `manual-${Date.now()}`,
                        prompt: '',
                        options: ['', '', '', ''],
                        answer: 0,
                        explanation: '',
                      },
                    ],
                  })
                }
              >
                <Plus />
                手动增加一道题
              </button>
            </section>
          )}
        </div>
        <footer className="at-sticky-actions">
          <p>
            发布前核对内容、答案与目标班级。
            <br />
            保存草稿后，学生暂不可见。
          </p>
          <div>
            <button type="submit" className="at-secondary" disabled={busy}>
              {busy ? '正在保存…' : '保存草稿'}
            </button>
            <button
              type="button"
              className="at-primary"
              disabled={busy}
              onClick={() => void save('published')}
            >
              {busy ? <LoaderCircle className="at-spin" /> : <Send />}确认并发布
            </button>
          </div>
        </footer>
      </form>
    </Dialog>
  );
}

function NewsComposer({
  initial,
  onClose,
  onSaved,
}: {
  initial: ArchiveNews;
  onClose: () => void;
  onSaved: (status: string) => Promise<void>;
}) {
  const [news, setNews] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const form = useRef<HTMLFormElement>(null);
  const update = (patch: Partial<ArchiveNews>) =>
    setNews((current) => ({ ...current, ...patch }));
  async function save(status: 'draft' | 'published') {
    if (busy || !form.current?.reportValidity()) return;
    if (!safeLink(news.url)) {
      setError('请填写可核查的 http 或 https 来源链接。');
      return;
    }
    if (
      status === 'published' &&
      !window.confirm(
        `确认发布“${news.title}”？\n请确认已核对来源、发布日期、摘要及词汇。学生将可阅读本内容。`,
      )
    )
      return;
    setBusy(true);
    setError('');
    try {
      await archiveRequest(
        'saveNews',
        {
          news: {
            ...news,
            status,
            vocabulary: news.vocabulary.filter(
              (item) => item.word.trim() && item.meaning.trim(),
            ),
          },
        },
        getTeacherToken(),
      );
      await onSaved(status);
    } catch (requestError) {
      setError(errorText(requestError));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      title={news.id ? '编辑铁路英语窗' : '准备一扇铁路英语窗'}
      onClose={onClose}
      wide
    >
      <form
        ref={form}
        className="at-composer"
        onSubmit={(event) => {
          event.preventDefault();
          void save('draft');
        }}
      >
        <div className="at-dialog-body">
          {error && <Notice danger>{error}</Notice>}
          <Notice>
            <Newspaper />
            这是一份教师编辑的教学材料。保留来源与原文日期，核实后再发布。
          </Notice>
          <div className="at-form-grid">
            <label className="at-field at-span-two">
              <span>标题 *</span>
              <input
                required
                maxLength={160}
                value={news.title}
                onChange={(event) => update({ title: event.target.value })}
              />
            </label>
            <label className="at-field">
              <span>来源机构 *</span>
              <input
                required
                value={news.source}
                onChange={(event) => update({ source: event.target.value })}
                placeholder="原文发布机构"
              />
            </label>
            <label className="at-field">
              <span>原文发布日期 *</span>
              <input
                required
                type="date"
                value={news.publishedDate}
                onChange={(event) =>
                  update({ publishedDate: event.target.value })
                }
              />
            </label>
            <label className="at-field at-span-two">
              <span>原文链接 *</span>
              <input
                required
                type="url"
                value={news.url}
                onChange={(event) => update({ url: event.target.value })}
                placeholder="https://…"
              />
              {safeLink(news.url) && (
                <a href={safeLink(news.url)} target="_blank" rel="noreferrer">
                  打开原文核对
                  <ExternalLink />
                </a>
              )}
            </label>
            <label className="at-field at-span-two">
              <span>教学摘要 *</span>
              <textarea
                required
                rows={5}
                value={news.summary}
                onChange={(event) => update({ summary: event.target.value })}
                placeholder="简洁说明报道内容；涉及计划时保留时间与条件。"
              />
            </label>
            <label className="at-field at-span-two">
              <span>课堂思考问题 *</span>
              <textarea
                required
                rows={3}
                value={news.question}
                onChange={(event) => update({ question: event.target.value })}
                placeholder="可用英文回答的一道开放问题。"
              />
            </label>
          </div>
          <section className="at-form-section">
            <div className="at-panel-heading">
              <h3>一起学的词汇</h3>
              <span>英文 · 中文释义</span>
            </div>
            <div className="at-vocabulary-editor">
              {news.vocabulary.map((item, index) => (
                <div key={index}>
                  <input
                    aria-label={`词汇${index + 1}`}
                    placeholder="English word / phrase"
                    value={item.word}
                    onChange={(event) =>
                      update({
                        vocabulary: news.vocabulary.map((value, i) =>
                          i === index
                            ? { ...value, word: event.target.value }
                            : value,
                        ),
                      })
                    }
                  />
                  <input
                    aria-label={`词汇${index + 1}释义`}
                    placeholder="中文释义"
                    value={item.meaning}
                    onChange={(event) =>
                      update({
                        vocabulary: news.vocabulary.map((value, i) =>
                          i === index
                            ? { ...value, meaning: event.target.value }
                            : value,
                        ),
                      })
                    }
                  />
                  <button
                    type="button"
                    className="at-icon-button"
                    aria-label={`移除词汇${index + 1}`}
                    onClick={() =>
                      update({
                        vocabulary: news.vocabulary.filter(
                          (_, i) => i !== index,
                        ),
                      })
                    }
                  >
                    <X />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              className="at-secondary"
              onClick={() =>
                update({
                  vocabulary: [...news.vocabulary, { word: '', meaning: '' }],
                })
              }
            >
              <Plus />
              添加词汇
            </button>
          </section>
          <section className="at-news-preview">
            <span className="at-eyebrow">STUDENT PREVIEW</span>
            <h3>{news.title || '这里将显示标题'}</h3>
            <small>
              {news.source || '来源'} · {news.publishedDate || '原文日期'}
            </small>
            <p>{news.summary || '这里将显示教学摘要。'}</p>
            <div className="at-tags">
              {news.vocabulary
                .filter((item) => item.word)
                .map((item, index) => (
                  <span key={index}>
                    {item.word} · {item.meaning}
                  </span>
                ))}
            </div>
            <blockquote>
              {news.question || '这里将显示课堂思考问题。'}
            </blockquote>
          </section>
        </div>
        <footer className="at-sticky-actions">
          <p>核对原文后发布，学生可在英语窗阅读。</p>
          <div>
            <button type="submit" className="at-secondary" disabled={busy}>
              保存草稿
            </button>
            <button
              type="button"
              className="at-primary"
              disabled={busy}
              onClick={() => void save('published')}
            >
              {busy ? <LoaderCircle className="at-spin" /> : <Send />}确认并发布
            </button>
          </div>
        </footer>
      </form>
    </Dialog>
  );
}
