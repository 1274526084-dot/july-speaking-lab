import { ArrowRight, BookOpenCheck, ClipboardList, TrainFront, TrendingUp, UsersRound } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { archiveRequest } from './archive-api';
import { BUILTIN_COURSE_TASKS, type CourseProgress, type LessonResult } from './course-board';
import { getTeacherToken } from './api';
import './teacher-course-scores.css';

type ScoreStudent = {
  id: string;
  name: string;
  className: string;
  courseProgress?: CourseProgress;
};
type CourseUnit = { number: number; title?: string; lessons?: number[] };
type LessonTask = { id?: string; title: string; unit: string; lesson: string; type: string; href?: string; classes?: string[]; status?: string };

const coordinate = (value?: string) => Number(String(value || '').match(/\d+/)?.[0] || 0);
const average = (values: (number | null | undefined)[]) => {
  const valid = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : null;
};
const score = (value?: number | null) => value == null ? '—' : `${Math.round(value * 10) / 10}分`;
const change = (value?: number | null) => value == null ? '暂无复练' : `${value > 0 ? '+' : ''}${Math.round(value * 10) / 10}分`;
const typeName: Record<string, string> = {
  word: '单词跟读', speaking: '口语', reading: '阅读', listening: '听力',
  writing: '写作', quiz: '测验', link: '学习活动',
};
function resultFor(student: ScoreStudent, unit: number, lesson: number): LessonResult | undefined {
  return student.courseProgress?.lessons.find((row) => row.unit === unit && row.lesson === lesson);
}

export function TeacherCourseScores({
  students,
  tasks,
  assignedClasses,
  canManageCourse,
  onStudent,
}: {
  students: ScoreStudent[];
  tasks: LessonTask[];
  assignedClasses: string[];
  canManageCourse: boolean;
  onStudent: (id: string) => void;
}) {
  const [courseUnits, setCourseUnits] = useState<CourseUnit[]>([{ number: 1, title: '校园与学习', lessons: [1, 2, 3] }]);
  const [unit, setUnit] = useState(1);
  const [lesson, setLesson] = useState(1);
  const [showAll, setShowAll] = useState(false);
  const [page, setPage] = useState(1);
  const [feedError, setFeedError] = useState('');
  useEffect(() => {
    let active = true;
    void archiveRequest<{ units?: CourseUnit[]; current?: { unit: number; lesson: number } }>('courseFeed', {}, getTeacherToken())
      .then((feed) => {
        if (!active) return;
        if (feed.units?.length) setCourseUnits(feed.units);
        if (feed.current) { setUnit(feed.current.unit); setLesson(feed.current.lesson); }
        setFeedError('');
      })
      .catch(() => { if (active) setFeedError('课程目录暂未同步，仍可查看已记录的课次。'); });
    return () => { active = false; };
  }, []);

  const visibleTasks = useMemo(() => [...BUILTIN_COURSE_TASKS, ...tasks].filter((task) =>
    canManageCourse || !task.classes?.length || task.classes.some((className) => assignedClasses.includes(className))),
  [tasks, assignedClasses, canManageCourse]);
  const units = useMemo(() => {
    const byNumber = new Map<number, CourseUnit>(courseUnits.map((row) => [row.number, row]));
    for (const task of visibleTasks) {
      const number = coordinate(task.unit);
      if (number && !byNumber.has(number)) byNumber.set(number, { number, lessons: [1, 2, 3] });
    }
    for (const student of students) for (const row of student.courseProgress?.lessons || []) {
      if (!byNumber.has(row.unit)) byNumber.set(row.unit, { number: row.unit, lessons: [1, 2, 3] });
    }
    return [...byNumber.values()].sort((a, b) => a.number - b.number);
  }, [courseUnits, visibleTasks, students]);
  const lessonTiles = useMemo(() => [1, 2, 3].map((number) => {
    const results = students.map((student) => resultFor(student, unit, number)).filter((row) => row?.latest != null);
    return {
      number,
      taskCount: visibleTasks.filter((task) => coordinate(task.unit) === unit && coordinate(task.lesson) === number).length,
      participating: results.length,
      average: average(results.map((row) => row?.latest)),
      change: average(results.map((row) => row?.change)),
    };
  }), [students, unit, visibleTasks]);
  const overall = useMemo(() => {
    const personalMeans = students.map((student) => average((student.courseProgress?.lessons || []).map((row) => row.latest)));
    const completedLessons = new Set(students.flatMap((student) => (student.courseProgress?.lessons || [])
      .filter((row) => row.latest != null).map((row) => `${row.unit}:${row.lesson}`)));
    return {
      participating: personalMeans.filter((value) => value != null).length,
      average: average(personalMeans),
      completedLessons: completedLessons.size,
      plannedLessons: units.length * 3,
    };
  }, [students, units]);
  const selectedTasks = visibleTasks.filter((task) => coordinate(task.unit) === unit && coordinate(task.lesson) === lesson);
  const scoreRows = students.map((student) => ({ student, result: resultFor(student, unit, lesson) }));
  const activeRows = scoreRows.filter((row) => row.result?.latest != null);
  const displayRows = showAll ? scoreRows : activeRows;
  const pageCount = Math.max(1, Math.ceil(displayRows.length / 20));
  const pageRows = displayRows.slice((Math.min(page, pageCount) - 1) * 20, Math.min(page, pageCount) * 20);
  const taskResults = useMemo(() => {
    const groups = new Map<string, { title: string; scores: number[]; changes: number[]; students: Set<string> }>();
    for (const student of students) {
      for (const item of resultFor(student, unit, lesson)?.items || []) {
        if (!groups.has(item.key)) groups.set(item.key, { title: item.title, scores: [], changes: [], students: new Set() });
        const group = groups.get(item.key)!;
        group.scores.push(item.latest);
        if (item.change != null) group.changes.push(item.change);
        group.students.add(student.id);
      }
    }
    return [...groups.values()].map((group) => ({ title: group.title, count: group.students.size, average: average(group.scores), change: average(group.changes) }))
      .sort((a, b) => b.count - a.count || a.title.localeCompare(b.title, 'zh-CN'));
  }, [students, unit, lesson]);
  useEffect(() => { setPage(1); }, [students, unit, lesson, showAll]);

  return (
    <section className="tc-scores" aria-label="每课任务与成绩">
      <div className="tc-overview">
        <div className="tc-overview-heading">
          <span><TrainFront size={22} /> COURSE JOURNEY</span>
          <h2>课程总览</h2>
          <p>按当前筛选范围，汇总全学期的学习进展。</p>
        </div>
        <div className="tc-overview-stats">
          <div><UsersRound /><strong>{overall.participating}<small> / {students.length}</small></strong><span>已有成绩学生</span></div>
          <div><BookOpenCheck /><strong>{overall.completedLessons}<small> / {overall.plannedLessons}</small></strong><span>已有成绩课次</span></div>
          <div><TrendingUp /><strong>{score(overall.average)}</strong><span>课程最近均分</span></div>
        </div>
      </div>
      <p className="tc-fair-note">总均分先汇总每名学生各课的最近成绩，再计算当前范围的均分；未提交的课次不按 0 分计算。练习分仅供教学反馈。</p>
      {feedError && <p className="tc-feed-error" role="status">{feedError}</p>}

      <div className="tc-unit-heading">
        <div><span>01 / LESSON MAP</span><h2>选择单元与课次</h2></div>
        <label>单元
          <select value={unit} onChange={(event) => { setUnit(Number(event.target.value)); setLesson(1); }}>
            {units.map((row) => <option key={row.number} value={row.number}>Unit {row.number}{row.title ? ` · ${row.title}` : ''}</option>)}
          </select>
        </label>
      </div>
      <div className="tc-lesson-grid">
        {lessonTiles.map((tile) => <button key={tile.number} type="button" className={`tc-lesson-card ${lesson === tile.number ? 'selected' : ''}`} onClick={() => setLesson(tile.number)} aria-pressed={lesson === tile.number}>
          <span className="tc-lesson-index">UNIT {unit} / LESSON {tile.number}</span>
          <span className="tc-lesson-title">第 {tile.number} 课 <ArrowRight /></span>
          <span className="tc-lesson-detail">{tile.taskCount} 项任务 · {tile.participating} 人有成绩</span>
          <strong>{score(tile.average)}</strong>
          <span className="tc-lesson-change">同任务复练 {change(tile.change)}</span>
        </button>)}
      </div>

      <div className="tc-detail-heading"><div><span>02 / LESSON DETAIL</span><h2>Unit {unit} · 第 {lesson} 课</h2></div><p>{activeRows.length} 人有成绩 · 最近均分 {score(average(activeRows.map((row) => row.result?.latest)))}</p></div>
      <div className="tc-split">
        <section className="tc-panel">
          <h3><ClipboardList /> 本课任务 <span>{selectedTasks.length} 项</span></h3>
          {selectedTasks.length ? <div className="tc-task-list">{selectedTasks.map((task, index) => <article key={task.id || `${task.title}-${index}`}>
            <div><strong>{task.title}</strong><span>{typeName[task.type] || '课堂任务'} · {task.status === 'draft' ? '草稿' : '已发布'}</span></div>
            {task.href && <a href={task.href} target="_blank" rel="noreferrer" aria-label={`查看${task.title}`}><ArrowRight /></a>}
          </article>)}</div> : <p className="tc-empty">这节课还没有任务。可在“任务与组题”中添加。</p>}
        </section>
        <section className="tc-panel">
          <h3><TrendingUp /> 已记录的任务成绩 <span>{taskResults.length} 项</span></h3>
          {taskResults.length ? <div className="tc-result-list">{taskResults.map((item, index) => <article key={`${item.title}-${index}`}>
            <div><strong>{item.title}</strong><span>{item.count} 人提交 · 复练 {change(item.change)}</span></div><b>{score(item.average)}</b>
          </article>)}</div> : <p className="tc-empty">学生完成本课任务后，这里会出现逐项成绩。</p>}
        </section>
      </div>

      <section className="tc-panel tc-student-panel">
        <div className="tc-table-heading"><div><h3>学生成绩</h3><p>点击学生，可看个人任务原文、录音与历史。</p></div><label><input type="checkbox" checked={showAll} onChange={(event) => setShowAll(event.target.checked)} />显示未提交学生（{students.length - activeRows.length}人）</label></div>
        {displayRows.length ? <div className="tc-table-wrap"><table><thead><tr><th>学生 / 班级</th><th>首次均分</th><th>最近均分</th><th>最好均分</th><th>复练变化</th><th>已得分任务</th><th>个人档案</th></tr></thead><tbody>
          {pageRows.map(({ student, result }) => <tr key={student.id}><td><strong>{student.name}</strong><small>{student.className}</small></td><td>{score(result?.first)}</td><td className="tc-score-strong">{score(result?.latest)}</td><td>{score(result?.best)}</td><td>{change(result?.change)}</td><td>{result?.items.length || 0} 项</td><td><button type="button" onClick={() => onStudent(student.id)}>查看详情 <ArrowRight /></button></td></tr>)}
        </tbody></table></div> : <p className="tc-empty">当前筛选范围内，这节课还没有正式成绩。可勾选右上角查看未提交学生。</p>}
        {displayRows.length > 20 && <div className="tc-pagination"><span>第 {Math.min(page, pageCount)} / {pageCount} 页</span><button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)}>上一页</button><button type="button" disabled={page >= pageCount} onClick={() => setPage(page + 1)}>下一页</button></div>}
      </section>
    </section>
  );
}
