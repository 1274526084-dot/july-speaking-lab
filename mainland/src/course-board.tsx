/* oxlint-disable react/react-compiler -- Polling callbacks perform asynchronous network state updates; this Vite app does not use React Compiler. */
import {
  type SubmitEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { ArrowRight, Plus, RefreshCw } from 'lucide-react';
import { getTeacherToken, sitePath } from './api';
import {
  archiveRequest,
  getArchiveToken,
  type ArchiveTask,
} from './archive-api';
import {
  COURSE_SESSION_KEY,
  getCourseStudent,
  getCourseIdentity,
} from './course-session';
import { createSchoolClassDirectory } from '@/lib/school-classes';
import { SchoolClassFilter } from '@/components/school-class-filter';
import './course-board.css';

type Unit = { number: number; title: string; lessons: number[] };
export type LessonResult = {
  unit: number;
  lesson: number;
  first: number | null;
  latest: number | null;
  best: number | null;
  change: number | null;
  comparableTasks: number;
  attempts: number;
  items: {
    key: string;
    title: string;
    first: number;
    latest: number;
    best: number;
    change: number | null;
    attempts: number;
  }[];
};
export type CourseProgress = {
  lessons: LessonResult[];
  unassignedWordCount: number;
};
type CourseFeed = {
  units: Unit[];
  current: { unit: number; lesson: number };
  tasks: ArchiveTask[];
  hasMore?: boolean;
};
type ScoreStudent = {
  id: string;
  name: string;
  className: string;
  courseProgress: CourseProgress;
};
const builtin: ArchiveTask[] = [
  {
    id: 'builtin-speaking',
    title: '校园情景口语',
    unit: 'Unit 1',
    lesson: 'Lesson 1',
    type: 'speaking',
    description: '',
    href: '/july-speaking-lab/student/',
  },
  ...[
    ['pinglu-canal-english-quiz.html', '平陆运河测试'],
    ['irregular-verbs-game.html', '不规则动词游戏'],
    ['english-tense-practice.html', '时态练习'],
    ['school-writing-practice.html', '校园写作'],
  ].map(([file, title], i) => ({
    id: `builtin-lesson2-${i}`,
    title,
    unit: 'Unit 1',
    lesson: 'Lesson 2',
    type: 'link',
    description: '',
    href: `/july-Englishclass/${file}`,
  })),
];
const coordinate = (value: string) => Number(value.match(/\d+/)?.[0] || 0);
const mark = (value?: number | null) => (value == null ? '—' : `${value}分`);
const delta = (value?: number | null) =>
  value == null ? '待复练' : `${value > 0 ? '+' : ''}${value}分`;
const safeHref = (value?: string) => {
  try {
    const url = new URL(value || '', location.origin);
    return value && /^https?:$/.test(url.protocol) ? url.href : '';
  } catch {
    return '';
  }
};

export function LessonProgress({ result }: { result?: LessonResult }) {
  return (
    <section className="course-progress" aria-label="本课成绩与进步">
      <div className="course-metrics">
        <div>
          <span>首次均分</span>
          <strong>{mark(result?.first)}</strong>
        </div>
        <div>
          <span>最近均分</span>
          <strong>{mark(result?.latest)}</strong>
        </div>
        <div>
          <span>最好均分</span>
          <strong>{mark(result?.best)}</strong>
        </div>
        <div
          className={
            result?.change != null && result.change > 0 ? 'course-up' : ''
          }
        >
          <span>复练变化</span>
          <strong>{delta(result?.change)}</strong>
        </div>
      </div>
      <p className="course-note">
        {result
          ? `${result.attempts}次提交 · ${result.comparableTasks}个同任务可比较`
          : '完成任务后显示成绩'}
        。不同任务、不同测验版本不直接比较。
      </p>
      {Boolean(result?.items.length) && (
        <details>
          <summary>查看逐项成绩</summary>
          <div className="course-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>任务</th>
                  <th>首次</th>
                  <th>最近</th>
                  <th>最好</th>
                  <th>变化</th>
                </tr>
              </thead>
              <tbody>
                {result!.items.map((item) => (
                  <tr key={item.key}>
                    <td>
                      {item.title}
                      <small>{item.attempts}次</small>
                    </td>
                    <td>{mark(item.first)}</td>
                    <td>{mark(item.latest)}</td>
                    <td>{mark(item.best)}</td>
                    <td>{delta(item.change)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </section>
  );
}

export function CourseBoard({
  teacher = false,
  tasks: privateTasks,
  progress,
  onOpen,
  onTask,
  revision = 0,
}: {
  teacher?: boolean;
  tasks?: ArchiveTask[];
  progress?: CourseProgress;
  onOpen?: (task: ArchiveTask) => void;
  onTask?: (unit: number, lesson: number, task?: ArchiveTask) => void;
  revision?: number;
}) {
  const [feed, setFeed] = useState<CourseFeed>({
    units: [{ number: 1, title: '校园与学习', lessons: [1, 2, 3] }],
    current: { unit: 1, lesson: 2 },
    tasks: [],
  });
  const params = new URLSearchParams(location.search);
  const [unit, setUnit] = useState(Number(params.get('unit')) || 1);
  const [lesson, setLesson] = useState(
    Math.min(3, Math.max(1, Number(params.get('lesson')) || 2)),
  );
  const [view, setView] = useState('tasks');
  const [students, setStudents] = useState<ScoreStudent[]>([]);
  const [personal, setPersonal] = useState<CourseProgress | undefined>(
    progress,
  );
  const [college, setCollege] = useState('');
  const [classKey, setClassKey] = useState('');
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [unitForm, setUnitForm] = useState(false);
  const [newNumber, setNewNumber] = useState(2);
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [chosen, setChosen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [page, setPage] = useState(1);
  const unitDialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = unitDialog.current;
    if (unitForm && dialog && !dialog.open) {
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else {
        dialog.setAttribute('open', '');
        dialog.dataset.fallback = 'true';
      }
    }
    return () => {
      if (dialog?.open) {
        if (typeof dialog.close === 'function') dialog.close();
        else dialog.removeAttribute('open');
      }
    };
  }, [unitForm]);
  useEffect(() => {
    const listener = (event: StorageEvent) => {
      if (
        event.key === COURSE_SESSION_KEY ||
        event.key === 'july.course.student.v1'
      )
        setPersonal(undefined);
    };
    window.addEventListener('storage', listener);
    return () => window.removeEventListener('storage', listener);
  }, []);
  const load = useCallback(async () => {
    try {
      const result = await archiveRequest<CourseFeed>(
        teacher ? 'courseFeed' : 'publicFeed',
        {},
        teacher ? getTeacherToken() : '',
      );
      setFeed({
        ...result,
        units: result.units || [
          { number: 1, title: '校园与学习', lessons: [1, 2, 3] },
        ],
        current: result.current || { unit: 1, lesson: 2 },
        tasks: result.tasks || [],
      });
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : '课程暂未更新，请重试');
    }
  }, [teacher]);
  useEffect(() => {
    void load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load();
    }, 30000);
    return () => clearInterval(timer);
  }, [load, revision]);
  const displayedUnit = chosen || params.has('unit') ? unit : feed.current.unit;
  const displayedLesson =
    chosen || params.has('lesson') ? lesson : feed.current.lesson;
  const scoreLoad = useCallback(async () => {
    if (teacher && view !== 'scores') return;
    const token = teacher
      ? getTeacherToken()
      : getArchiveToken() || getCourseIdentity()?.token;
    if (!token || (!teacher && progress)) return;
    setLoading(true);
    try {
      if (teacher) {
        const result = await archiveRequest<{
          students: ScoreStudent[];
          hasMore?: boolean;
        }>('teacherCourseScores', {}, token);
        if (result.hasMore) throw new Error('成绩尚未完整载入，请稍后刷新');
        setStudents(result.students);
      } else {
        const result = await archiveRequest<{ courseProgress: CourseProgress }>(
          'courseStudentScores',
          { studentToken: token },
        );
        if ((getArchiveToken() || getCourseIdentity()?.token) === token)
          setPersonal(result.courseProgress);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '成绩读取失败');
    } finally {
      setLoading(false);
    }
  }, [teacher, view, progress]);
  useEffect(() => {
    void scoreLoad();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void scoreLoad();
    }, 60000);
    return () => clearInterval(timer);
  }, [scoreLoad]);
  const directory = createSchoolClassDirectory(
    students.map((row) => ({ class_name: row.className })),
  );
  const filtered = students.filter(
    (row) =>
      (!college ||
        directory.resolve({ class_name: row.className }).college === college) &&
      (!classKey ||
        directory.resolve({ class_name: row.className }).key === classKey) &&
      (!query || `${row.name}${row.className}`.includes(query)),
  );
  const className = getCourseStudent()?.className;
  const tasks =
    privateTasks ||
    feed.tasks.filter(
      (task) =>
        teacher ||
        !task.classes?.length ||
        (className && task.classes.includes(className)),
    );
  const allTasks = [...builtin, ...tasks];
  const selectedTasks = allTasks.filter(
    (task) =>
      coordinate(task.unit) === displayedUnit &&
      coordinate(task.lesson) === displayedLesson,
  );
  const selectedResult = (progress || personal)?.lessons.find(
    (item) => item.unit === displayedUnit && item.lesson === displayedLesson,
  );
  const scores = filtered.map((row) => ({
    ...row,
    result: row.courseProgress.lessons.find(
      (item) => item.unit === displayedUnit && item.lesson === displayedLesson,
    ),
  }));
  const averages = scores.filter((row) => row.result?.latest != null);
  const visibleScores = showAll ? scores : averages;
  const pageCount = Math.max(1, Math.ceil(visibleScores.length / 20));
  const currentPage = Math.min(page, pageCount);
  const pagedScores = visibleScores.slice(
    (currentPage - 1) * 20,
    currentPage * 20,
  );
  useEffect(() => {
    setPage(1);
  }, [college, classKey, query, displayedUnit, displayedLesson, showAll]);
  const average = averages.length
    ? Math.round(
        (averages.reduce((sum, row) => sum + row.result!.latest!, 0) /
          averages.length) *
          10,
      ) / 10
    : null;
  async function saveUnit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError('');
    try {
      await archiveRequest(
        'saveCourseUnit',
        { number: newNumber, title },
        getTeacherToken(),
      );
      await load();
      setUnit(newNumber);
      setLesson(1);
      setChosen(true);
      setUnitForm(false);
      setMessage(`Unit ${newNumber}已保存，3课已建立`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '单元保存失败');
    } finally {
      setSaving(false);
    }
  }
  async function setCurrent() {
    setSaving(true);
    try {
      await archiveRequest(
        'setCurrentLesson',
        { unit: displayedUnit, lesson: displayedLesson },
        getTeacherToken(),
      );
      await load();
      setMessage('学生首页当前课已更新');
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新失败');
    } finally {
      setSaving(false);
    }
  }
  function open(task: ArchiveTask) {
    if (onOpen && !task.id.startsWith('builtin-')) {
      onOpen(task);
      return;
    }
    if (task.type === 'quiz') {
      location.assign(
        sitePath(`archive?unit=${displayedUnit}&lesson=${displayedLesson}`),
      );
      return;
    }
    const href = safeHref(task.href);
    if (href) location.assign(href);
  }
  return (
    <section className="course-board">
      <div className="course-top">
        <div>
          <p className="course-kicker">每个 Unit · 3课</p>
          <h2>
            Unit {displayedUnit} · 第{displayedLesson}课
          </h2>
        </div>
        {teacher ? (
          <button
            className="course-secondary"
            onClick={() => {
              setNewNumber(
                Math.max(...feed.units.map((item) => item.number)) + 1,
              );
              setTitle('');
              setUnitForm(true);
            }}
          >
            <Plus size={17} />
            添加 Unit
          </button>
        ) : (
          <span className="course-current">
            当前：Unit {feed.current.unit} · 第{feed.current.lesson}课
          </span>
        )}
      </div>
      <div className="course-picker">
        <label>
          单元
          <select
            value={displayedUnit}
            onChange={(event) => {
              setUnit(Number(event.target.value));
              setLesson(1);
              setChosen(true);
            }}
          >
            {feed.units.map((item) => (
              <option value={item.number} key={item.number}>
                Unit {item.number}
                {item.title ? ` · ${item.title}` : ''}
              </option>
            ))}
          </select>
        </label>
        <div className="course-lessons" aria-label="选择课次">
          {[1, 2, 3].map((value) => {
            const grade = (progress || personal)?.lessons.find(
              (item) => item.unit === displayedUnit && item.lesson === value,
            );
            return (
              <button
                key={value}
                className={displayedLesson === value ? 'active' : ''}
                aria-pressed={displayedLesson === value}
                onClick={() => {
                  setUnit(displayedUnit);
                  setLesson(value);
                  setChosen(true);
                }}
              >
                <span>第{value}课</span>
                <small>
                  {
                    allTasks.filter(
                      (task) =>
                        coordinate(task.unit) === displayedUnit &&
                        coordinate(task.lesson) === value,
                    ).length
                  }
                  项任务
                </small>
                {!teacher && (
                  <small>
                    {grade
                      ? `${mark(grade.latest)} · ${delta(grade.change)}`
                      : '待完成'}
                  </small>
                )}
              </button>
            );
          })}
        </div>
      </div>
      {error && (
        <p className="course-error" role="alert">
          {error}
          <button
            onClick={() => {
              void load();
              void scoreLoad();
            }}
          >
            重试
          </button>
        </p>
      )}
      {message && <output className="course-note">{message}</output>}
      {teacher && (
        <div className="course-toolbar">
          <div>
            <button
              aria-pressed={view === 'tasks'}
              className={view === 'tasks' ? 'active' : ''}
              onClick={() => setView('tasks')}
            >
              本课任务
            </button>
            <button
              aria-pressed={view === 'scores'}
              className={view === 'scores' ? 'active' : ''}
              onClick={() => setView('scores')}
            >
              成绩与进步
            </button>
          </div>
          <button
            className="course-current-button"
            disabled={saving}
            onClick={() => void setCurrent()}
          >
            设为学生当前课
          </button>
        </div>
      )}
      {!teacher && <LessonProgress result={selectedResult} />}
      {(!teacher || view === 'tasks') && (
        <>
          <div className="course-list-title">
            <h3>本课任务</h3>
            {teacher && (
              <button
                className="course-primary"
                onClick={() => onTask?.(displayedUnit, displayedLesson)}
              >
                <Plus size={16} />
                添加任务
              </button>
            )}
          </div>
          <div className="course-task-grid">
            {selectedTasks.map((task, i) => (
              <article key={task.id} className="course-task">
                <span className="course-order">{i + 1}</span>
                <div>
                  <h4>{task.title}</h4>
                  <small>
                    {task.status === 'draft'
                      ? '草稿 · 学生不可见'
                      : task.creatorName || '课程任务'}
                  </small>
                  {teacher && task.type === 'word' && (
                    <a
                      className="course-record-link"
                      href={sitePath('words/teacher')}
                    >
                      跟读成绩与录音 →
                    </a>
                  )}
                </div>
                {teacher && !task.id.startsWith('builtin-') ? (
                  <button
                    onClick={() =>
                      onTask?.(displayedUnit, displayedLesson, task)
                    }
                  >
                    编辑
                  </button>
                ) : (
                  <button
                    disabled={!safeHref(task.href) && task.type !== 'quiz'}
                    onClick={() => open(task)}
                  >
                    {teacher ? '预览' : '开始'}
                    <ArrowRight size={16} />
                  </button>
                )}
              </article>
            ))}
          </div>
          {!selectedTasks.length && (
            <p className="course-empty">
              {teacher
                ? '本课暂无任务，点击“添加任务”。'
                : '本课任务待老师发布'}
            </p>
          )}
        </>
      )}
      {teacher && view === 'scores' && (
        <section>
          <div className="course-score-heading">
            <h3>
              {averages.length}人有成绩 · 本课均分 {mark(average)}
            </h3>
            <button
              className="course-secondary"
              disabled={loading}
              onClick={() => void scoreLoad()}
            >
              <RefreshCw size={16} />
              {loading ? '读取中' : '刷新'}
            </button>
          </div>
          <div className="course-score-filters">
            <SchoolClassFilter
              college={college}
              classKey={classKey}
              groups={directory.groups}
              onCollege={setCollege}
              onClass={setClassKey}
            />
            <input
              aria-label="搜索本课学生"
              placeholder="搜索姓名或班级"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <p className="course-note">
            变化只比较同一任务、同一评分版本。单词与口语为练习参考分，不代表能力等级；待确认记录不计入正式档案。
          </p>
          <label className="course-check">
            <input
              type="checkbox"
              checked={showAll}
              onChange={(event) => setShowAll(event.target.checked)}
            />
            也显示本课暂无成绩的学生
          </label>
          <div className="course-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>学生 / 班级</th>
                  <th>首次均分</th>
                  <th>最近均分</th>
                  <th>最好均分</th>
                  <th>复练变化</th>
                  <th>提交次数</th>
                </tr>
              </thead>
              <tbody>
                {pagedScores.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <a
                        href={`${sitePath('archive/teacher')}?student=${encodeURIComponent(row.id)}`}
                      >
                        {row.name}
                      </a>
                      <small>{row.className}</small>
                      {row.result && (
                        <details className="course-item-scores">
                          <summary>本课任务成绩</summary>
                          {row.result.items.map((item) => (
                            <div key={item.key}>
                              <strong>{item.title}</strong>
                              <span>
                                最近 {mark(item.latest)} · {item.attempts}次 ·{' '}
                                {delta(item.change)}
                              </span>
                            </div>
                          ))}
                        </details>
                      )}
                    </td>
                    <td>{mark(row.result?.first)}</td>
                    <td>{mark(row.result?.latest)}</td>
                    <td>{mark(row.result?.best)}</td>
                    <td>{delta(row.result?.change)}</td>
                    <td>{row.result?.attempts || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!visibleScores.length && (
            <p className="course-empty">
              {loading ? '正在读取成绩' : '本课暂无匹配的成绩'}
            </p>
          )}
          {pageCount > 1 && (
            <div className="course-pagination">
              <button
                disabled={currentPage <= 1}
                onClick={() => setPage(currentPage - 1)}
              >
                上一页
              </button>
              <span>
                {currentPage} / {pageCount} · {visibleScores.length}人
              </span>
              <button
                disabled={currentPage >= pageCount}
                onClick={() => setPage(currentPage + 1)}
              >
                下一页
              </button>
            </div>
          )}
        </section>
      )}
      {unitForm && (
        <dialog
          ref={unitDialog}
          aria-labelledby="course-unit-title"
          className="course-modal"
          onCancel={() => setUnitForm(false)}
        >
          <h3 id="course-unit-title">添加 Unit</h3>
          <form onSubmit={saveUnit}>
            <label>
              单元编号
              <input
                autoFocus
                required
                type="number"
                min="1"
                max="30"
                value={newNumber}
                onChange={(event) => setNewNumber(Number(event.target.value))}
              />
            </label>
            <label>
              单元名称（可选）
              <input
                maxLength={100}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="如：Campus Life"
              />
            </label>
            <p>保存后自动建立第1、2、3课。</p>
            {error && (
              <p role="alert" className="course-error">
                {error}
              </p>
            )}
            <div>
              <button
                type="button"
                className="course-secondary"
                disabled={saving}
                onClick={() => setUnitForm(false)}
              >
                取消
              </button>
              <button className="course-primary" disabled={saving}>
                {saving ? '保存中' : '保存单元'}
              </button>
            </div>
          </form>
        </dialog>
      )}
      {!teacher && Boolean((progress || personal)?.unassignedWordCount) && (
        <p className="course-note">
          另有{(progress || personal)?.unassignedWordCount}
          次单词跟读未指定课次，仍保留在单词记录中。
        </p>
      )}
      {!teacher && !progress && !getArchiveToken() && !getCourseIdentity() && (
        <a className="course-signin" href={sitePath('archive')}>
          确认身份，查看自己的每课成绩 →
        </a>
      )}
    </section>
  );
}
