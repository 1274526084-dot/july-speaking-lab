import {
  BarChart3,
  BookOpen,
  Download,
  Eye,
  GraduationCap,
  LoaderCircle,
  LogOut,
  RefreshCw,
  Search,
  Target,
  Users,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  clearProfileTeacherToken,
  COLLEGE_OPTIONS,
  collegeForMajor,
  getProfileTeacherToken,
  profilePath,
  profileRequest,
  SKILL_LABELS,
  type EnglishProfile,
  type SkillKey,
} from './profile-api';

const skillKeys = Object.keys(SKILL_LABELS) as SkillKey[];

function normalize(value: string) {
  return value.toLocaleLowerCase('zh-CN').replace(/[\s_-]+/g, '');
}

function avg(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function percent(value: number, total: number) {
  return total ? Math.round((value / total) * 100) : 0;
}

function dateText(value: number) {
  return new Date(value).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false });
}

function isNeedsSupport(row: EnglishProfile) {
  return row.confidence <= 2 || row.speaking_anxiety >= 4 || skillKeys.filter((key) => row.skills[key] <= 2).length >= 2;
}

function entranceScoreInfo(row: EnglishProfile) {
  const type = row.admission_type === 'single' ? 'single' : 'gaokao';
  const typeLabel = type === 'single' ? '单招' : '高考';
  const known = row.entrance_score_known ?? row.gaokao_known ?? false;
  const score = row.entrance_english_score ?? row.gaokao_score ?? null;
  const fullScore = row.entrance_english_full_score ?? (known && type === 'gaokao' ? 150 : null);
  const rate = known && score !== null && fullScore ? (Number(score) / Number(fullScore)) * 100 : null;
  return {
    type,
    typeLabel,
    known: Boolean(known && score !== null && fullScore),
    score: score === null ? null : Number(score),
    fullScore: fullScore === null ? null : Number(fullScore),
    rate,
    text: known && score !== null && fullScore ? `${typeLabel} ${score}/${fullScore}分` : `${typeLabel} · 未填写`,
  };
}

function profileCollege(row: EnglishProfile) {
  return row.college || collegeForMajor(row.major) || '未填写';
}

function Metric({ icon, value, label, note }: { icon: React.ReactNode; value: string | number; label: string; note: string }) {
  return <article className="dashboard-metric"><span>{icon}</span><div><strong>{value}</strong><p>{label}</p><small>{note}</small></div></article>;
}

function Distribution({ title, items, total }: { title: string; items: [string, number][]; total: number }) {
  const max = Math.max(1, ...items.map(([, value]) => value));
  return (
    <section className="dashboard-panel distribution-panel">
      <h3>{title}</h3>
      <div className="distribution-list">
        {items.length ? items.map(([label, value]) => (
          <div key={label} className="distribution-row">
            <div><span>{label}</span><strong>{value}人 · {percent(value, total)}%</strong></div>
            <div className="mini-bar"><span style={{ width: `${(value / max) * 100}%` }} /></div>
          </div>
        )) : <p className="empty-note">暂无数据</p>}
      </div>
    </section>
  );
}

function counter(values: string[][]) {
  const counts = new Map<string, number>();
  values.flat().forEach((value) => counts.set(value, (counts.get(value) || 0) + 1));
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

export function ProfileTeacher() {
  const [rows, setRows] = useState<EnglishProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [keyword, setKeyword] = useState('');
  const [collegeFilter, setCollegeFilter] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [majorFilter, setMajorFilter] = useState('');
  const [admissionFilter, setAdmissionFilter] = useState('');
  const [supportOnly, setSupportOnly] = useState(false);
  const [selected, setSelected] = useState<EnglishProfile | null>(null);

  const loadRows = useCallback(async (silent = false) => {
    const token = getProfileTeacherToken();
    if (!token) { window.location.replace(profilePath('teacher/login')); return; }
    if (silent) setRefreshing(true); else setLoading(true);
    try {
      const payload = await profileRequest<{ rows: EnglishProfile[] }>('listProfiles', {}, token);
      setRows(payload.rows || []); setLastUpdated(new Date()); setError('');
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : '数据加载失败。';
      if (/登录|失效|认证/.test(message)) { clearProfileTeacherToken(); window.location.replace(profilePath('teacher/login')); return; }
      setError(message);
    } finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => {
    void loadRows();
    const timer = window.setInterval(() => void loadRows(true), 20_000);
    return () => window.clearInterval(timer);
  }, [loadRows]);

  const classes = useMemo(() => [...new Set(rows.map((row) => row.class_name))].sort((a, b) => a.localeCompare(b, 'zh-CN')), [rows]);
  const majors = useMemo(() => [...new Set(rows.map((row) => row.major))].sort((a, b) => a.localeCompare(b, 'zh-CN')), [rows]);
  const filtered = useMemo(() => rows.filter((row) => {
    const scoreInfo = entranceScoreInfo(row);
    const college = profileCollege(row);
    const searchable = normalize(`${row.student_name}${row.class_name}${college}${row.major}${scoreInfo.typeLabel}`);
    return (!keyword || searchable.includes(normalize(keyword))) && (!collegeFilter || college === collegeFilter) && (!classFilter || row.class_name === classFilter) && (!majorFilter || row.major === majorFilter) && (!admissionFilter || scoreInfo.type === admissionFilter) && (!supportOnly || isNeedsSupport(row));
  }), [admissionFilter, classFilter, collegeFilter, keyword, majorFilter, rows, supportOnly]);

  const scoreInfos = filtered.map(entranceScoreInfo);
  const knownScoreRates = scoreInfos.filter((item) => item.known && item.rate !== null).map((item) => Number(item.rate));
  const averageScoreRate = avg(knownScoreRates);
  const skillAverages = Object.fromEntries(skillKeys.map((key) => [key, avg(filtered.map((row) => Number(row.skills[key] || 0))) ])) as Record<SkillKey, number>;
  const overallSkill = avg(skillKeys.map((key) => skillAverages[key]));
  const supportCount = filtered.filter(isNeedsSupport).length;
  const goalCounts = counter(filtered.map((row) => row.learning_goals)).slice(0, 6);
  const majorReasonCounts = counter(filtered.map((row) => row.major_reasons)).slice(0, 6);
  const schoolReasonCounts = counter(filtered.map((row) => row.school_reasons)).slice(0, 6);
  const scoreBands: [string, number][] = [
    ['80%–100%', knownScoreRates.filter((value) => value >= 80).length],
    ['60%–79%', knownScoreRates.filter((value) => value >= 60 && value < 80).length],
    ['40%–59%', knownScoreRates.filter((value) => value >= 40 && value < 60).length],
    ['0%–39%', knownScoreRates.filter((value) => value < 40).length],
    ['未填写', filtered.length - knownScoreRates.length],
  ];

  const classStats = useMemo(() => classes.map((className) => {
    const members = rows.filter((row) => row.class_name === className);
    const scores = members.map(entranceScoreInfo).filter((item) => item.known && item.rate !== null).map((item) => Number(item.rate));
    const skills = members.flatMap((row) => skillKeys.map((key) => Number(row.skills[key] || 0)));
    return { className, count: members.length, averageScoreRate: avg(scores), knownCount: scores.length, skillAverage: avg(skills), support: members.filter(isNeedsSupport).length };
  }).sort((a, b) => b.count - a.count), [classes, rows]);

  async function logout() {
    const token = getProfileTeacherToken();
    if (token) await profileRequest('logout', {}, token).catch(() => undefined);
    clearProfileTeacherToken(); window.location.replace(profilePath('teacher/login'));
  }

  function exportCsv() {
    const cell = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const headers = ['提交时间', '姓名', '班级', '学院', '专业', '入学方式', '英语得分', '英语满分', '英语得分率', ...skillKeys.map((key) => `${SKILL_LABELS[key]}/5`), '学习信心/5', '口语紧张/5', '英语兴趣/5', '每周课外时间', '学习习惯', '困难', '学习目标', '喜欢的活动', '择专业原因', '择校原因', '毕业计划', '本学期目标', '给老师的话', '设备情况'];
    const lines = filtered.map((row) => {
      const scoreInfo = entranceScoreInfo(row);
      return [dateText(row.updated_at), row.student_name, row.class_name, profileCollege(row), row.major, scoreInfo.typeLabel, scoreInfo.known ? scoreInfo.score : '未填写', scoreInfo.known ? scoreInfo.fullScore : '未填写', scoreInfo.rate === null ? '未填写' : `${scoreInfo.rate.toFixed(1)}%`, ...skillKeys.map((key) => row.skills[key]), row.confidence, row.speaking_anxiety, row.english_interest, row.weekly_time, row.current_habits.join('；'), row.difficulties.join('；'), row.learning_goals.join('；'), row.preferred_activities.join('；'), row.major_reasons.join('；'), row.school_reasons.join('；'), row.career_plan, row.semester_goal, row.teacher_message, row.device_ready].map(cell).join(',');
    });
    const blob = new Blob([`\uFEFF${[headers.map(cell).join(','), ...lines].join('\r\n')}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `July-英语学习档案-${new Date().toISOString().slice(0, 10)}.csv`; anchor.click(); URL.revokeObjectURL(url);
  }

  return (
    <main className="profile-dashboard">
      <header className="dashboard-topbar">
        <div><p className="eyebrow">JULY · ENGLISH PROFILE</p><h1>学生英语学习档案</h1><small>班级统计与个人画像 · 每20秒自动更新</small></div>
        <div className="topbar-actions">
          <button type="button" onClick={() => void loadRows(true)} disabled={refreshing}><RefreshCw className={refreshing ? 'spin' : ''} /><span>刷新</span></button>
          <button type="button" onClick={exportCsv}><Download /><span>导出CSV</span></button>
          <button type="button" className="logout-button" onClick={() => void logout()} aria-label="退出教师端"><LogOut /></button>
        </div>
      </header>

      <div className="dashboard-shell">
        <section className="dashboard-welcome">
          <div><h2>晚上好，July老师</h2><p>{lastUpdated ? `数据更新于 ${lastUpdated.toLocaleTimeString('zh-CN', { hour12: false })}` : '正在读取学生档案…'}</p></div>
          <a href={profilePath()} target="_blank" rel="noreferrer">打开学生入口</a>
        </section>

        <section className="dashboard-filters">
          <label className="search-control"><Search /><input type="search" value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="搜索姓名、班级、学院或专业" />{keyword && <button type="button" onClick={() => setKeyword('')} aria-label="清除搜索"><X /></button>}</label>
          <select value={collegeFilter} onChange={(event) => setCollegeFilter(event.target.value)}><option value="">全部学院</option>{COLLEGE_OPTIONS.map((value) => <option key={value}>{value}</option>)}</select>
          <select value={classFilter} onChange={(event) => setClassFilter(event.target.value)}><option value="">全部班级</option>{classes.map((value) => <option key={value}>{value}</option>)}</select>
          <select value={majorFilter} onChange={(event) => setMajorFilter(event.target.value)}><option value="">全部专业</option>{majors.map((value) => <option key={value}>{value}</option>)}</select>
          <select value={admissionFilter} onChange={(event) => setAdmissionFilter(event.target.value)}><option value="">全部入学方式</option><option value="gaokao">高考</option><option value="single">单招</option></select>
          <label className={`support-toggle ${supportOnly ? 'active' : ''}`}><input type="checkbox" checked={supportOnly} onChange={(event) => setSupportOnly(event.target.checked)} />只看需要关注</label>
          <span>显示 {filtered.length} / {rows.length} 人</span>
        </section>

        {error && <p className="dashboard-error">{error}</p>}
        {loading ? <div className="dashboard-loading"><LoaderCircle className="spin" />正在生成班级画像…</div> : (
          <>
            <section className="metrics-grid">
              <Metric icon={<Users />} value={filtered.length} label="学生档案" note={`${new Set(filtered.map((row) => row.class_name)).size}个班级`} />
              <Metric icon={<GraduationCap />} value={knownScoreRates.length ? `${averageScoreRate.toFixed(1)}%` : '—'} label="入学英语平均得分率" note={`${knownScoreRates.length}人填写高考/单招成绩`} />
              <Metric icon={<BarChart3 />} value={filtered.length ? `${overallSkill.toFixed(1)}/5` : '—'} label="英语技能自评" note="七项技能平均值" />
              <Metric icon={<BookOpen />} value={supportCount} label="建议重点关注" note="低信心、较紧张或多项薄弱" />
            </section>

            <section className="dashboard-grid wide-first">
              <section className="dashboard-panel skill-panel">
                <div className="panel-title"><div><p className="eyebrow">SKILL PORTRAIT</p><h3>班级英语技能画像</h3></div><span>满分5分</span></div>
                <div className="skill-bars">{skillKeys.map((key) => <div key={key}><label><span>{SKILL_LABELS[key]}</span><strong>{skillAverages[key].toFixed(1)}</strong></label><div><span style={{ width: `${(skillAverages[key] / 5) * 100}%` }} /></div></div>)}</div>
              </section>
              <Distribution title="高考/单招英语得分率" items={scoreBands} total={filtered.length} />
            </section>

            <section className="dashboard-grid three">
              <Distribution title="本学期学习目标 TOP 6" items={goalCounts} total={filtered.length} />
              <Distribution title="选择专业的原因" items={majorReasonCounts} total={filtered.length} />
              <Distribution title="选择学校的原因" items={schoolReasonCounts} total={filtered.length} />
            </section>

            <section className="dashboard-panel class-panel">
              <div className="panel-title"><div><p className="eyebrow">CLASS VIEW</p><h3>按班级实时统计</h3></div><span>{classStats.length}个班级</span></div>
              <div className="table-wrap"><table><thead><tr><th>班级</th><th>档案人数</th><th>英语平均得分率</th><th>成绩填写率</th><th>技能自评</th><th>建议关注</th><th></th></tr></thead><tbody>{classStats.map((item) => <tr key={item.className}><td><strong>{item.className}</strong></td><td>{item.count}人</td><td>{item.knownCount ? `${item.averageScoreRate.toFixed(1)}%` : '—'}</td><td>{percent(item.knownCount, item.count)}%</td><td>{item.skillAverage.toFixed(1)} / 5</td><td><span className={item.support ? 'risk-badge' : 'ok-badge'}>{item.support}人</span></td><td><button type="button" className="table-action" onClick={() => { setClassFilter(item.className); document.getElementById('student-profiles')?.scrollIntoView({ behavior: 'smooth' }); }}>查看学生</button></td></tr>)}</tbody></table></div>
            </section>

            <section className="dashboard-panel profiles-panel" id="student-profiles">
              <div className="panel-title"><div><p className="eyebrow">STUDENT VIEW</p><h3>个人英语学习档案</h3></div><span>{filtered.length}份</span></div>
              {filtered.length ? <div className="profile-list">{filtered.map((row) => (
                <article key={row.id} className="student-profile-row">
                  <span className="avatar">{row.student_name.slice(0, 1)}</span>
                  <div className="student-main"><strong>{row.student_name}</strong><p>{row.class_name} · {profileCollege(row)} · {row.major}</p></div>
                  <div><small>入学英语</small><strong>{entranceScoreInfo(row).text}</strong></div>
                  <div><small>技能自评</small><strong>{avg(skillKeys.map((key) => row.skills[key])).toFixed(1)} / 5</strong></div>
                  <div><small>学习目标</small><p className="tag-line">{row.learning_goals.slice(0, 2).join(' · ') || '未填写'}</p></div>
                  <span className={isNeedsSupport(row) ? 'risk-badge' : 'ok-badge'}>{isNeedsSupport(row) ? '建议关注' : '状态良好'}</span>
                  <button type="button" className="view-profile" onClick={() => setSelected(row)}><Eye />查看档案</button>
                </article>
              ))}</div> : <p className="empty-note large">没有符合筛选条件的学生档案。</p>}
            </section>
          </>
        )}
      </div>

      {selected && <div className="profile-modal-backdrop" role="presentation" onMouseDown={() => setSelected(null)}>
        <section className="profile-modal" role="dialog" aria-modal="true" aria-label={`${selected.student_name}的英语学习档案`} onMouseDown={(event) => event.stopPropagation()}>
          <header><div><p className="eyebrow">STUDENT PROFILE</p><h2>{selected.student_name}</h2><span>{selected.class_name} · {profileCollege(selected)} · {selected.major}</span></div><button type="button" onClick={() => setSelected(null)} aria-label="关闭档案"><X /></button></header>
          <div className="modal-content">
            <section className="profile-overview-cards"><div><small>入学英语</small><strong>{entranceScoreInfo(selected).text}</strong></div><div><small>学习信心</small><strong>{selected.confidence} / 5</strong></div><div><small>口语紧张</small><strong>{selected.speaking_anxiety} / 5</strong></div><div><small>英语兴趣</small><strong>{selected.english_interest} / 5</strong></div></section>
            <section className="modal-block"><h3>七项技能自评</h3><div className="modal-skills">{skillKeys.map((key) => <div key={key}><span>{SKILL_LABELS[key]}</span><strong>{selected.skills[key]} / 5</strong></div>)}</div></section>
            <section className="modal-two"><div className="modal-block"><h3>主要困难</h3><div className="tag-cloud">{selected.difficulties.length ? selected.difficulties.map((value) => <span key={value}>{value}</span>) : <em>未填写</em>}</div></div><div className="modal-block"><h3>学习目标</h3><div className="tag-cloud green">{selected.learning_goals.map((value) => <span key={value}>{value}</span>)}</div></div></section>
            <section className="modal-two"><div className="modal-block"><h3>选择专业的原因</h3><p>{selected.major_reasons.join('、')}</p></div><div className="modal-block"><h3>选择学校的原因</h3><p>{selected.school_reasons.join('、')}</p></div></section>
            <section className="modal-block detail-list"><p><strong>毕业计划：</strong>{selected.career_plan || '未填写'}</p><p><strong>每周课外学习：</strong>{selected.weekly_time}</p><p><strong>喜欢的活动：</strong>{selected.preferred_activities.join('、') || '未填写'}</p><p><strong>当前习惯：</strong>{selected.current_habits.join('、') || '未填写'}</p><p><strong>设备情况：</strong>{selected.device_ready}</p></section>
            <section className="student-message"><Target /><div><h3>本学期小目标</h3><p>{selected.semester_goal || '学生暂未填写。'}</p></div></section>
            <section className="student-message teacher"><BookOpen /><div><h3>想对July老师说</h3><p>{selected.teacher_message || '学生暂未留言。'}</p></div></section>
            <p className="updated-note">最后更新：{dateText(selected.updated_at)}</p>
          </div>
        </section>
      </div>}
    </main>
  );
}
