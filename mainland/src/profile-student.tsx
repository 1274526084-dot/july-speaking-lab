import {
  ArrowLeft,
  ArrowRight,
  BookOpenCheck,
  Check,
  ClipboardCheck,
  GraduationCap,
  LoaderCircle,
  School,
  Sparkles,
  Target,
  UserRound,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  COLLEGE_MAJOR_OPTIONS,
  COLLEGE_OPTIONS,
  collegeForMajor,
  getStudentProfileKey,
  profilePath,
  profileRequest,
  setStudentProfileKey,
  SKILL_LABELS,
  type SkillKey,
} from './profile-api';

const DRAFT_KEY = 'july-english-profile.draft-v1';
const steps = [
  { title: '基本信息', short: '我是谁' },
  { title: '英语画像', short: '我的基础' },
  { title: '选择与期待', short: '我的选择' },
  { title: '学习计划', short: '我的目标' },
];

const defaultSkills = Object.fromEntries(Object.keys(SKILL_LABELS).map((key) => [key, 3])) as Record<SkillKey, number>;

type FormState = {
  studentName: string;
  className: string;
  college: string;
  major: string;
  otherMajor: string;
  admissionType: 'gaokao' | 'single' | '';
  entranceScoreKnown: boolean;
  entranceScore: string;
  entranceFullScore: string;
  skills: Record<SkillKey, number>;
  confidence: number;
  speakingAnxiety: number;
  englishInterest: number;
  weeklyTime: string;
  currentHabits: string[];
  learningGoals: string[];
  preferredActivities: string[];
  difficulties: string[];
  majorReasons: string[];
  schoolReasons: string[];
  careerPlan: string;
  semesterGoal: string;
  teacherMessage: string;
  deviceReady: string;
};

const initialForm: FormState = {
  studentName: '', className: '', college: '', major: '', otherMajor: '', admissionType: '', entranceScoreKnown: true, entranceScore: '', entranceFullScore: '150',
  skills: defaultSkills, confidence: 3, speakingAnxiety: 3, englishInterest: 3,
  weeklyTime: '', currentHabits: [], learningGoals: [], preferredActivities: [], difficulties: [],
  majorReasons: [], schoolReasons: [], careerPlan: '', semesterGoal: '', teacherMessage: '', deviceReady: '',
};

const habitOptions = ['背单词', '刷英语短视频', '听英文歌', '看英文影视', '做题', '用AI学习', '几乎没有固定习惯'];
const goalOptions = ['通过英语应用能力B级', '提高口语交流', '看懂专业英语', '提升求职竞争力', '参加专升本考试', '为四六级做准备', '能听懂英文内容'];
const activityOptions = ['情景对话', '游戏与竞赛', '视频学习', '小组任务', '歌曲或配音', '阅读故事', 'AI口语练习', '教师讲解与练习'];
const difficultyOptions = ['词汇量不足', '听不清或听不懂', '不敢开口', '发音不准', '语法基础弱', '阅读速度慢', '写不出句子', '缺少学习方法', '容易放弃'];
const majorReasonOptions = ['对专业感兴趣', '就业前景较好', '喜欢实践和技术', '家人或老师建议', '高考/单招成绩与录取匹配', '行业发展吸引我', '暂时没有明确原因'];
const schoolReasonOptions = ['铁路特色鲜明', '就业口碑较好', '专业设置适合我', '学校地理位置合适', '家人或老师推荐', '校园环境与设施', '高考/单招成绩与录取匹配', '暂时没有明确原因'];

function ChoiceGroup({
  title,
  hint,
  options,
  values,
  onChange,
}: {
  title: string;
  hint?: string;
  options: string[];
  values: string[];
  onChange: (values: string[]) => void;
}) {
  function toggle(option: string) {
    onChange(values.includes(option) ? values.filter((value) => value !== option) : [...values, option]);
  }
  return (
    <fieldset className="profile-fieldset">
      <legend>{title}</legend>
      {hint && <p className="field-hint">{hint}</p>}
      <div className="choice-grid">
        {options.map((option) => {
          const selected = values.includes(option);
          return (
            <button key={option} type="button" aria-pressed={selected} onClick={() => toggle(option)} className={`choice-pill ${selected ? 'selected' : ''}`}>
              {selected && <Check aria-hidden="true" />} {option}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function Scale({ label, value, low, high, onChange }: { label: string; value: number; low: string; high: string; onChange: (value: number) => void }) {
  return (
    <div className="scale-card">
      <div className="scale-heading"><strong>{label}</strong><span>{value} / 5</span></div>
      <div className="scale-buttons" role="radiogroup" aria-label={label}>
        {[1, 2, 3, 4, 5].map((score) => (
          <button key={score} type="button" role="radio" aria-checked={value === score} onClick={() => onChange(score)} className={value === score ? 'active' : ''}>{score}</button>
        ))}
      </div>
      <div className="scale-ends"><span>{low}</span><span>{high}</span></div>
    </div>
  );
}

export function ProfileStudent() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(initialForm);
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(DRAFT_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<FormState> & { gaokaoKnown?: boolean; gaokaoScore?: string };
        const isLegacyDraft = parsed.gaokaoKnown !== undefined || parsed.gaokaoScore !== undefined;
        setForm({
          ...initialForm,
          ...parsed,
          college: parsed.college || collegeForMajor(parsed.major || ''),
          admissionType: parsed.admissionType || (isLegacyDraft ? 'gaokao' : ''),
          entranceScoreKnown: parsed.entranceScoreKnown ?? parsed.gaokaoKnown ?? true,
          entranceScore: parsed.entranceScore ?? parsed.gaokaoScore ?? '',
          entranceFullScore: parsed.entranceFullScore || '150',
        });
      }
    } catch { /* ignore an invalid local draft */ }
  }, []);

  useEffect(() => {
    if (!submitted) window.localStorage.setItem(DRAFT_KEY, JSON.stringify(form));
  }, [form, submitted]);

  const progress = ((step + 1) / steps.length) * 100;
  const majorValue = form.major === '其他专业' ? form.otherMajor.trim() : form.major;
  const scoreValue = Number(form.entranceScore);
  const fullScoreValue = form.admissionType === 'gaokao' ? 150 : Number(form.entranceFullScore);
  const admissionLabel = form.admissionType === 'gaokao' ? '高考' : form.admissionType === 'single' ? '单招' : '';
  const answeredCount = useMemo(() => [
    form.studentName, form.className, form.college, majorValue, form.admissionType,
    !form.entranceScoreKnown || (Number.isFinite(scoreValue) && form.entranceScore !== '' && Number.isFinite(fullScoreValue) && fullScoreValue > 0),
    form.weeklyTime, form.learningGoals.length, form.majorReasons.length, form.schoolReasons.length,
  ].filter(Boolean).length, [form, fullScoreValue, majorValue, scoreValue]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function validateStep() {
    if (step === 0) {
      if (!form.studentName.trim() || !form.className.trim() || !form.college || !majorValue) return '请填写姓名、班级、学院和专业。';
      if (!form.admissionType) return '请选择你的入学方式：高考或单招。';
      if (form.entranceScoreKnown && (form.entranceScore === '' || !Number.isFinite(scoreValue) || scoreValue < 0)) return `请填写${admissionLabel}英语得分；如果不记得，可选择“不记得”。`;
      if (form.entranceScoreKnown && (!Number.isFinite(fullScoreValue) || fullScoreValue <= 0 || fullScoreValue > 1000)) return '英语科目满分请填写 1–1000 之间的数字。';
      if (form.entranceScoreKnown && scoreValue > fullScoreValue) return '英语得分不能高于英语科目满分，请检查后再填写。';
    }
    if (step === 2 && (!form.majorReasons.length || !form.schoolReasons.length)) return '请选择择专业和择校原因（可以多选）。';
    if (step === 3 && (!form.weeklyTime || !form.learningGoals.length || !form.deviceReady)) return '请选择每周学习时间、学习目标和设备情况。';
    return '';
  }

  function next() {
    const message = validateStep();
    if (message) { setError(message); return; }
    setError('');
    setStep((value) => Math.min(steps.length - 1, value + 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function submit() {
    const message = validateStep();
    if (message) { setError(message); return; }
    if (!consent) { setError('请确认同意将本次调查用于课程学习档案和教学分析。'); return; }
    setSubmitting(true); setError('');
    try {
      const result = await profileRequest<{ ok: boolean; id: string; profileKey: string }>('submitProfile', {
        profileKey: getStudentProfileKey(),
        profile: {
          studentName: form.studentName.trim(), className: form.className.trim(), college: form.college, major: majorValue,
          admissionType: form.admissionType,
          entranceScoreKnown: form.entranceScoreKnown,
          entranceScore: form.entranceScoreKnown ? scoreValue : null,
          entranceFullScore: form.entranceScoreKnown ? fullScoreValue : null,
          skills: form.skills, confidence: form.confidence, speakingAnxiety: form.speakingAnxiety,
          englishInterest: form.englishInterest, weeklyTime: form.weeklyTime, currentHabits: form.currentHabits,
          learningGoals: form.learningGoals, preferredActivities: form.preferredActivities, difficulties: form.difficulties,
          majorReasons: form.majorReasons, schoolReasons: form.schoolReasons, careerPlan: form.careerPlan,
          semesterGoal: form.semesterGoal.trim(), teacherMessage: form.teacherMessage.trim(), deviceReady: form.deviceReady,
        },
      });
      setStudentProfileKey(result.profileKey);
      window.localStorage.removeItem(DRAFT_KEY);
      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '提交没有完成，请检查网络后重试。');
    } finally { setSubmitting(false); }
  }

  if (submitted) return (
    <main className="profile-page profile-success-page">
      <section className="success-card">
        <div className="success-icon"><Check /></div>
        <p className="eyebrow">PROFILE SAVED</p>
        <h1>{form.studentName}，英语学习档案已建立</h1>
        <p>July老师已经可以在教师端看到你的档案。以后重新打开本页面，也可以更新自己的目标和学习情况。</p>
        <div className="profile-summary-mini">
          <span><strong>{form.className}</strong><small>班级</small></span>
          <span><strong>{form.entranceScoreKnown ? `${admissionLabel} ${form.entranceScore}/${fullScoreValue}分` : `${admissionLabel} · 未填写`}</strong><small>入学英语</small></span>
          <span><strong>{form.learningGoals.length}项</strong><small>学习目标</small></span>
        </div>
        <button type="button" className="primary-button" onClick={() => { setSubmitted(false); setStep(0); }}>更新我的档案</button>
      </section>
    </main>
  );

  return (
    <main className="profile-page">
      <header className="profile-topbar">
        <a href={profilePath()} className="brand-lockup" aria-label="英语学习档案首页">
          <span className="brand-mark">J</span><span><strong>July English Profile</strong><small>课前英语学习档案</small></span>
        </a>
        <span className="save-note">自动保存草稿</span>
      </header>

      <div className="profile-shell">
        <aside className="profile-intro">
          <div className="intro-illustration" aria-hidden="true"><GraduationCap /><Sparkles /><BookOpenCheck /></div>
          <p className="eyebrow">BEFORE OUR FIRST CLASS</p>
          <h1>让我先认识你的英语</h1>
          <p>这不是考试，也不影响成绩。请按真实情况作答，帮助July老师为不同班级安排更合适的课堂活动与学习支持。</p>
          <ul>
            <li><Check />约 3–5 分钟</li>
            <li><Check />以选择题为主</li>
            <li><Check />可以更新自己的档案</li>
          </ul>
          <a href={profilePath('teacher')} className="teacher-link">教师入口</a>
        </aside>

        <section className="survey-card">
          <div className="step-head">
            <div><span>STEP {step + 1} / {steps.length}</span><h2>{steps[step].title}</h2></div>
            <strong>{Math.round(progress)}%</strong>
          </div>
          <div className="progress-track"><span style={{ width: `${progress}%` }} /></div>
          <nav className="step-dots" aria-label="调查进度">
            {steps.map((item, index) => <span key={item.title} className={index <= step ? 'active' : ''}>{index + 1}<small>{item.short}</small></span>)}
          </nav>

          <div className="survey-body">
            {step === 0 && (
              <div className="form-section">
                <div className="section-callout"><UserRound /><div><strong>先填写你的基本信息</strong><p>学生无需账号密码，姓名和班级用于老师筛选档案。</p></div></div>
                <div className="two-columns">
                  <label className="text-field"><span>姓名 *</span><input value={form.studentName} onChange={(event) => update('studentName', event.target.value)} maxLength={30} placeholder="请输入真实姓名" /></label>
                  <label className="text-field"><span>班级 *</span><input value={form.className} onChange={(event) => update('className', event.target.value)} maxLength={50} placeholder="如：城轨信号2401" /></label>
                </div>
                <div className="two-columns">
                  <label className="text-field"><span>学院 *</span><select value={form.college} onChange={(event) => setForm((current) => ({ ...current, college: event.target.value, major: '', otherMajor: '' }))}><option value="">请先选择学院</option>{COLLEGE_OPTIONS.map((option) => <option key={option}>{option}</option>)}</select></label>
                  <label className="text-field"><span>专业 *</span><select value={form.major} disabled={!form.college} onChange={(event) => update('major', event.target.value)}><option value="">{form.college ? '请选择专业' : '选择学院后显示专业'}</option>{form.college && [...(COLLEGE_MAJOR_OPTIONS[form.college as keyof typeof COLLEGE_MAJOR_OPTIONS] || []), '其他专业'].map((option) => <option key={option}>{option}</option>)}</select></label>
                </div>
                {form.major === '其他专业' && <label className="text-field"><span>请填写专业名称 *</span><input value={form.otherMajor} onChange={(event) => update('otherMajor', event.target.value)} maxLength={60} placeholder="完整专业名称" /></label>}
                <fieldset className="profile-fieldset">
                  <legend>你的入学方式是？ *</legend>
                  <div className="inline-options">
                    <label><input type="radio" name="admissionType" checked={form.admissionType === 'gaokao'} onChange={() => setForm((current) => ({ ...current, admissionType: 'gaokao', entranceFullScore: '150' }))} />高考</label>
                    <label><input type="radio" name="admissionType" checked={form.admissionType === 'single'} onChange={() => setForm((current) => ({ ...current, admissionType: 'single', entranceFullScore: current.admissionType === 'single' ? current.entranceFullScore : '' }))} />单招</label>
                  </div>
                </fieldset>
                {form.admissionType && <fieldset className="profile-fieldset">
                  <legend>你的{admissionLabel}英语成绩是？</legend>
                  <div className="inline-options">
                    <label><input type="radio" name="entranceScoreKnown" checked={form.entranceScoreKnown} onChange={() => update('entranceScoreKnown', true)} />记得</label>
                    <label><input type="radio" name="entranceScoreKnown" checked={!form.entranceScoreKnown} onChange={() => update('entranceScoreKnown', false)} />不记得</label>
                  </div>
                  {form.entranceScoreKnown && (form.admissionType === 'gaokao' ? (
                    <label className="score-input"><input inputMode="decimal" type="number" min="0" max="150" step="0.5" value={form.entranceScore} onChange={(event) => update('entranceScore', event.target.value)} placeholder="例如：96" /><span>/ 150 分</span></label>
                  ) : (
                    <div className="two-columns">
                      <label className="text-field"><span>英语得分</span><input inputMode="decimal" type="number" min="0" max="1000" step="0.5" value={form.entranceScore} onChange={(event) => update('entranceScore', event.target.value)} placeholder="例如：82" /></label>
                      <label className="text-field"><span>英语科目满分</span><input inputMode="decimal" type="number" min="1" max="1000" step="0.5" value={form.entranceFullScore} onChange={(event) => update('entranceFullScore', event.target.value)} placeholder="例如：100" /></label>
                    </div>
                  ))}
                  <p className="field-hint">只用于了解班级英语起点，不公开个人分数。单招分值不同，请同时填写英语科目满分。</p>
                </fieldset>}
              </div>
            )}

            {step === 1 && (
              <div className="form-section">
                <div className="section-callout blue"><ClipboardCheck /><div><strong>请按真实感受自评</strong><p>1代表“基础较弱”，5代表“比较有信心”。没有标准答案。</p></div></div>
                <div className="skill-grid">{(Object.keys(SKILL_LABELS) as SkillKey[]).map((key) => <Scale key={key} label={SKILL_LABELS[key]} value={form.skills[key]} low="需要帮助" high="比较擅长" onChange={(value) => update('skills', { ...form.skills, [key]: value })} />)}</div>
                <div className="three-scales"><Scale label="英语学习信心" value={form.confidence} low="没信心" high="有信心" onChange={(value) => update('confidence', value)} /><Scale label="开口说英语的紧张程度" value={form.speakingAnxiety} low="不紧张" high="很紧张" onChange={(value) => update('speakingAnxiety', value)} /><Scale label="对英语的兴趣" value={form.englishInterest} low="不感兴趣" high="很感兴趣" onChange={(value) => update('englishInterest', value)} /></div>
                <ChoiceGroup title="你现在有哪些英语学习习惯？" hint="可以多选" options={habitOptions} values={form.currentHabits} onChange={(values) => update('currentHabits', values)} />
                <ChoiceGroup title="目前最困扰你的问题是什么？" hint="可以多选，老师会据此安排支持" options={difficultyOptions} values={form.difficulties} onChange={(values) => update('difficulties', values)} />
              </div>
            )}

            {step === 2 && (
              <div className="form-section">
                <div className="section-callout green"><School /><div><strong>了解你的选择</strong><p>这些信息帮助老师把英语任务与专业、校园生活和未来岗位联系起来。</p></div></div>
                <ChoiceGroup title="你为什么选择现在的专业？ *" hint="请选择最符合你的1–3项" options={majorReasonOptions} values={form.majorReasons} onChange={(values) => update('majorReasons', values.slice(-3))} />
                <ChoiceGroup title="你为什么选择柳州铁道职业技术学院？ *" hint="请选择最符合你的1–3项" options={schoolReasonOptions} values={form.schoolReasons} onChange={(values) => update('schoolReasons', values.slice(-3))} />
                <fieldset className="profile-fieldset"><legend>毕业后的初步计划</legend><p className="field-hint">请选择目前最接近你想法的一项，以后可以更新。</p><div className="radio-card-grid">{[
                  '进入铁路或轨道交通行业',
                  '进入汽车或新能源行业',
                  '进入智能制造、人工智能或通信行业',
                  '进入与本专业相关的其他企业',
                  '专升本继续学习',
                  '参加公务员、事业单位或国企招考',
                  '参军入伍',
                  '自主创业或从事自由职业',
                  '回家乡就业发展',
                  '先就业，积累经验后再规划',
                  '尝试与本专业不同的行业',
                  '还没有想好',
                ].map((option) => <label key={option} className={form.careerPlan === option ? 'selected' : ''}><input type="radio" name="careerPlan" value={option} checked={form.careerPlan === option} onChange={(event) => update('careerPlan', event.target.value)} />{option}</label>)}</div></fieldset>
              </div>
            )}

            {step === 3 && (
              <div className="form-section">
                <div className="section-callout orange"><Target /><div><strong>一起制定本学期方向</strong><p>你的回答会成为个人英语学习档案的一部分。</p></div></div>
                <fieldset className="profile-fieldset"><legend>你每周愿意在课外学习英语多久？ *</legend><div className="radio-card-grid compact">{['30分钟以内', '30–60分钟', '1–2小时', '2小时以上', '暂时不确定'].map((option) => <label key={option} className={form.weeklyTime === option ? 'selected' : ''}><input type="radio" name="weeklyTime" value={option} checked={form.weeklyTime === option} onChange={(event) => update('weeklyTime', event.target.value)} />{option}</label>)}</div></fieldset>
                <ChoiceGroup title="本学期最想实现哪些英语目标？ *" hint="可以多选" options={goalOptions} values={form.learningGoals} onChange={(values) => update('learningGoals', values)} />
                <ChoiceGroup title="你更喜欢哪些课堂活动？" hint="可以多选" options={activityOptions} values={form.preferredActivities} onChange={(values) => update('preferredActivities', values)} />
                <fieldset className="profile-fieldset"><legend>手机录音与在线学习条件 *</legend><div className="radio-card-grid compact">{['设备和网络都比较稳定', '偶尔不稳定，但基本能完成', '设备或网络有困难，需要帮助'].map((option) => <label key={option} className={form.deviceReady === option ? 'selected' : ''}><input type="radio" name="deviceReady" value={option} checked={form.deviceReady === option} onChange={(event) => update('deviceReady', event.target.value)} />{option}</label>)}</div></fieldset>
                <label className="text-field"><span>给自己定一个具体的小目标（选填）</span><textarea value={form.semesterGoal} onChange={(event) => update('semesterGoal', event.target.value)} maxLength={180} placeholder="例如：每周完成两次听力练习，课堂上至少主动说一次英语。" /></label>
                <label className="text-field"><span>还有什么想让July老师知道？（选填）</span><textarea value={form.teacherMessage} onChange={(event) => update('teacherMessage', event.target.value)} maxLength={240} placeholder="可以写你的担心、期待，或希望得到的帮助。" /></label>
                <label className="consent-box"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} /><span><strong>我确认以上信息真实，并同意用于本课程的学习档案与教学分析。</strong><small>信息仅在教师端查看，不向同学公开。</small></span></label>
              </div>
            )}
          </div>

          {error && <p className="form-error" role="alert">{error}</p>}
          <footer className="survey-actions">
            <button type="button" className="secondary-button" disabled={step === 0 || submitting} onClick={() => { setError(''); setStep((value) => Math.max(0, value - 1)); }}><ArrowLeft />上一步</button>
            <span>已完成 {answeredCount} 项关键信息</span>
            {step < steps.length - 1 ? <button type="button" className="primary-button" onClick={next}>下一步<ArrowRight /></button> : <button type="button" className="primary-button" disabled={submitting} onClick={() => void submit()}>{submitting ? <LoaderCircle className="spin" /> : <Check />}{submitting ? '正在保存…' : '提交并建立档案'}</button>}
          </footer>
        </section>
      </div>
    </main>
  );
}
