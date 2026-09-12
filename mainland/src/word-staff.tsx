/* oxlint-disable jsx-a11y/media-has-caption */
import { BarChart3, BookOpenCheck, ChevronDown, Clipboard, CopyPlus, Download, Headphones, KeyRound, Library, LoaderCircle, LockKeyhole, LogOut, Plus, QrCode, Radio, RefreshCw, Search, ShieldCheck, Sparkles, Users, Volume2, X } from 'lucide-react';
import QRCode from 'qrcode';
import { type SyntheticEvent, useEffect, useMemo, useState } from 'react';
import { clearWordSession, getWordRole, getWordToken, setWordSession, type WordAttempt, type WordItem, type WordUnit, wordPath, wordRequest } from './word-api';

type Teacher = { id: string; code: string; name: string; active: boolean; created_at: number };
type UnitRow = WordUnit & { teacher_id: string; share_code: string; teacher_name: string; status: string; demoCount: number; updated_at: number; copied_from_teacher?: string };
type SharedUnitRow = { id: string; title: string; note: string; teacher_id: string; teacher_name: string; share_code: string; published_at: number; wordCount: number; demoCount: number; isMine: boolean };

function normalize(value: string) { return value.toLocaleLowerCase('zh-CN').replace(/[\s_-]+/g, ''); }
function formatDate(value: number) { return new Date(value).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }); }
function shareUrl(unit: UnitRow) { return `${window.location.origin}${wordPath()}?unit=${unit.share_code}`; }

function parseUnitEntries(value: string) {
  const map = new Map<string, { term: string; meaning: string }>();
  value.split(/\r?\n/).flatMap((line) => line.split(/[,，;；\t]+/)).forEach((raw) => {
    const separator = raw.indexOf('|');
    const word = (separator >= 0 ? raw.slice(0, separator) : raw).trim().toLowerCase().replace(/\s+/g, ' ');
    const meaning = (separator >= 0 ? raw.slice(separator + 1) : '').trim();
    if (/^[a-z][a-z' -]*$/.test(word) && !map.has(word)) map.set(word, { term: word, meaning });
  });
  return [...map.values()];
}

function StaffLogin({ mode }: { mode: 'teacher' | 'admin' }) {
  const [code, setCode] = useState(''); const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false); const [error, setError] = useState('');
  async function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setError('');
    try {
      const payload = await wordRequest<{ token: string; role: string }>('login', { mode, code, password });
      setWordSession(payload.token, payload.role); window.location.reload();
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : '暂时无法登录。'); }
    finally { setLoading(false); }
  }
  return <main className="word-shell grid min-h-screen place-items-center px-5 py-10"><section className="word-card w-full max-w-md overflow-hidden"><div className="word-hero px-7 py-8 text-center"><div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-white/15 text-white"><LockKeyhole className="h-8 w-8" /></div><p className="mt-5 text-xs font-black uppercase tracking-[.18em] text-cyan-200">July Word Sound Lab</p><h1 className="mt-2 text-3xl font-black text-white">{mode === 'admin' ? '管理员登录' : '教师工作台'}</h1><p className="mt-3 text-indigo-100">{mode === 'admin' ? '管理教师账号并查看全部教学数据' : '智能生成词典发音，查看全部班级练习数据'}</p></div><form onSubmit={submit} className="space-y-5 p-7">{mode === 'teacher' && <label className="word-label">教师代码<input required autoComplete="username" value={code} onChange={(event) => setCode(event.target.value)} className="word-input mt-2" placeholder="如：july" /></label>}<label className="word-label">密码<div className="relative mt-2"><KeyRound className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" /><input required type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} className="word-input pl-12" placeholder="请输入密码" /></div></label>{error && <p className="word-error" role="alert">{error}</p>}<button disabled={loading || !password || (mode === 'teacher' && !code)} className="word-primary w-full">{loading ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <><ShieldCheck className="h-5 w-5" />登录</>}</button><div className="flex justify-between text-sm font-bold"><a href={wordPath()} className="text-indigo-700">学生练习</a><a href={mode === 'admin' ? wordPath('teacher') : wordPath('admin')} className="text-slate-500">{mode === 'admin' ? '教师登录' : '管理员入口'}</a></div></form></section></main>;
}

function StaffHeader({ title, subtitle, onLogout }: { title: string; subtitle: string; onLogout: () => void }) {
  return <header className="word-nav"><div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4"><div className="flex items-center gap-3"><div className="word-mark h-11 w-11 rounded-xl"><Volume2 className="h-5 w-5" /></div><div><p className="word-kicker">July Word Sound Lab</p><h1 className="text-xl font-black text-slate-950">{title}</h1><p className="hidden text-xs text-slate-500 sm:block">{subtitle}</p></div></div><button onClick={onLogout} className="word-icon" aria-label="退出登录"><LogOut className="h-5 w-5" /></button></div></header>;
}

function Metrics({ attempts }: { attempts: WordAttempt[] }) {
  const students = new Set(attempts.map((row) => `${row.class_name}-${row.student_name}`)).size;
  const average = attempts.length ? Math.round(attempts.reduce((sum, row) => sum + Number(row.average_score || 0), 0) / attempts.length) : 0;
  const recordings = attempts.reduce((sum, row) => sum + (row.results?.length || 0), 0);
  return <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><div className="word-metric"><Users /><b>{students}</b><span>练习学生</span></div><div className="word-metric"><BookOpenCheck /><b>{attempts.length}</b><span>完成记录</span></div><div className="word-metric"><BarChart3 /><b>{attempts.length ? `${average}分` : '—'}</b><span>平均练习分</span></div><div className="word-metric"><Headphones /><b>{recordings}</b><span>可回听录音</span></div></div>;
}

function AttemptsTable({ rows, showTeacher = false }: { rows: WordAttempt[]; showTeacher?: boolean }) {
  const [classKeyword, setClassKeyword] = useState(''); const [unitFilter, setUnitFilter] = useState(''); const [teacherFilter, setTeacherFilter] = useState('');
  const units = useMemo(() => [...new Map(rows.map((row) => [row.unit_id, row.unit_title])).entries()], [rows]);
  const teachers = useMemo(() => [...new Map(rows.map((row) => [row.teacher_id, row.teacher_name])).entries()], [rows]);
  const filtered = useMemo(() => rows.filter((row) => (!classKeyword || normalize(row.class_name).includes(normalize(classKeyword))) && (!unitFilter || row.unit_id === unitFilter) && (!teacherFilter || row.teacher_id === teacherFilter)), [rows, classKeyword, unitFilter, teacherFilter]);
  function exportCsv() {
    const quote = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const header = ['教师', '单元', '姓名', '班级', '系统平均分', '学生自评', '提交时间', '单词详情'];
    const lines = filtered.map((row) => [row.teacher_name, row.unit_title, row.student_name, row.class_name, row.average_score, row.average_self, formatDate(row.submitted_at), row.results.map((item) => `${item.word}:${item.system_score}分/自评${item.self_rating}/识别${item.transcript || '无'}`).join('；')].map(quote).join(','));
    const blob = new Blob([`\uFEFF${[header.map(quote).join(','), ...lines].join('\r\n')}`], { type: 'text/csv;charset=utf-8' }); const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `word-lab-${new Date().toISOString().slice(0, 10)}.csv`; anchor.click(); URL.revokeObjectURL(url);
  }
  return <section><div className="mb-4 grid gap-3 lg:grid-cols-[1fr_220px_220px_auto]"><label className="relative"><span className="sr-only">按班级搜索</span><Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" /><input value={classKeyword} onChange={(event) => setClassKeyword(event.target.value)} className="word-input pl-12" placeholder="按班级关键词搜索" />{classKeyword && <button onClick={() => setClassKeyword('')} className="absolute right-3 top-1/2 -translate-y-1/2"><X className="h-4 w-4" /></button>}</label><select value={unitFilter} onChange={(event) => setUnitFilter(event.target.value)} className="word-input"><option value="">全部单元</option>{units.map(([id, title]) => <option key={id} value={id}>{title}</option>)}</select>{showTeacher ? <select value={teacherFilter} onChange={(event) => setTeacherFilter(event.target.value)} className="word-input"><option value="">全部教师</option>{teachers.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select> : <div />}<button onClick={exportCsv} className="word-secondary"><Download className="h-4 w-4" />导出</button></div><p className="mb-3 text-sm font-bold text-slate-500">显示 {filtered.length} / {rows.length} 条 · 点击每个单词下方录音可回听</p><div className="overflow-x-auto rounded-2xl border border-slate-200"><table className="word-table min-w-[1180px]"><thead><tr>{[...(showTeacher ? ['教师'] : []), '学生', '班级', '单元', '系统分', '自评', '提交时间', '逐词结果与录音'].map((item) => <th key={item}>{item}</th>)}</tr></thead><tbody>{filtered.map((row) => <tr key={row.id}>{showTeacher && <td className="font-bold text-indigo-700">{row.teacher_name}</td>}<td className="font-bold">{row.student_name}</td><td>{row.class_name}</td><td>{row.unit_title}</td><td><b className="text-xl text-indigo-700">{row.average_score}</b></td><td>{row.average_self}/3</td><td className="whitespace-nowrap text-slate-500">{formatDate(row.submitted_at)}</td><td><div className="grid min-w-[420px] gap-2">{row.results.map((item) => <details key={item.word_id} className="rounded-xl bg-slate-50 p-3"><summary className="cursor-pointer list-none font-bold"><span className="inline-flex w-full items-center justify-between"><span>{item.word} <small className="ml-2 text-slate-500">识别：{item.transcript || '无'}</small></span><span className="text-indigo-700">{item.system_score}分 · 自评{item.self_rating}</span></span></summary>{item.audioUrl && <audio controls preload="none" src={item.audioUrl} className="mt-3 h-9 w-full" />}</details>)}</div></td></tr>)}</tbody></table>{!filtered.length && <div className="p-12 text-center text-slate-500">暂无符合条件的练习数据。</div>}</div></section>;
}

function UnitEditor({ unit, onSaved, onCancel }: { unit: UnitRow | null; onSaved: (unit: UnitRow, message: string) => void; onCancel: () => void }) {
  const [title, setTitle] = useState(unit?.title || ''); const [note, setNote] = useState(unit?.note || '');
  const [lines, setLines] = useState(unit?.words.map((item) => item.word).join('\n') || '');
  const [saving, setSaving] = useState(false); const [error, setError] = useState('');
  const [progress, setProgress] = useState('');
  const parsedEntries = parseUnitEntries(lines); const entries = parsedEntries.slice(0, 60); const terms = entries.map((entry) => entry.term); const overflowCount = Math.max(0, parsedEntries.length - entries.length);
  async function save(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(''); setProgress(`正在从词典查询 ${terms.length} 项内容并保存发音，请稍候…`);
    try {
      const payload = await wordRequest<{ unit: UnitRow; failures: { word: string; reason: string }[] }>('teacherSmartImport', { id: unit?.id, title, note, entries }, getWordToken());
      const message = payload.failures?.length
        ? `单元已保存；${payload.failures.map((item) => item.word).join('、')} 暂未找到发音，请检查拼写后再次编辑。`
        : `已自动获取并保存 ${payload.unit.demoCount} 个单词的标准发音。`;
      onSaved(payload.unit, message);
    }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : '保存失败。'); }
    finally { setSaving(false); setProgress(''); }
  }
  return <form onSubmit={save} className="word-card p-6 sm:p-8"><div className="flex items-start justify-between gap-4"><div><p className="word-kicker">{unit ? '智能更新单元' : '智能新建单元'}</p><h2 className="mt-1 text-2xl font-black">输入单词或词组，其他交给系统</h2></div><button type="button" onClick={onCancel} className="word-icon"><X className="h-5 w-5" /></button></div><div className="mt-5 flex items-start gap-3 rounded-2xl bg-gradient-to-r from-indigo-50 to-cyan-50 p-4"><Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-indigo-600" /><p className="text-sm leading-6 text-slate-700">系统会自动查询词典中的标准发音、IPA音标、英文释义和例句，并把发音音频保存到腾讯云。无需教师录音。</p></div><div className="mt-6 grid gap-5"><label className="word-label">单元名称<input required value={title} onChange={(event) => setTitle(event.target.value)} className="word-input mt-2" placeholder="如：Unit 1 New College, New Life" /></label><label className="word-label">给学生的提示（选填）<input value={note} onChange={(event) => setNote(event.target.value)} className="word-input mt-2" placeholder="如：注意单词重音，建议佩戴耳机" /></label><label className="word-label">粘贴英文单词或词组<textarea required rows={10} value={lines} onChange={(event) => setLines(event.target.value)} className="word-input mt-2 h-auto resize-y py-3 text-base leading-7" placeholder={'freshman | 大一新生\nrailway locomotive | 铁道机车\nenergy storage technology\ncontact'} /><span className="mt-2 block text-sm font-normal leading-6 text-slate-500">每行一个单词或词组，也可用逗号、分号分隔；词组中的空格会保留，不再拆成多个单词。每个单元最多60项。需要中文释义时可写“单词或词组 | 中文”。</span></label><div className="flex flex-wrap gap-2">{entries.slice(0, 12).map((entry) => <span key={entry.term} className="word-chip">{entry.term}{entry.meaning ? ` · ${entry.meaning}` : ''}</span>)}{terms.length > 12 && <span className="word-chip">+{terms.length - 12}</span>}</div><div className="rounded-2xl bg-indigo-50 p-4 text-sm font-bold text-indigo-950">准备自动处理 {terms.length} 项{unit ? ` · 当前已有 ${unit.demoCount}/${unit.words.length} 项词典发音` : ''}{overflowCount ? ` · 已超过上限，后 ${overflowCount} 项暂不处理` : ''}</div>{progress && <p className="rounded-2xl bg-cyan-50 px-4 py-3 text-sm font-bold text-cyan-950">{progress}</p>}{error && <p className="word-error">{error}</p>}<div className="flex gap-3"><button type="button" onClick={onCancel} className="word-secondary flex-1">取消</button><button disabled={saving || !title || !terms.length} className="word-primary flex-1">{saving ? <><LoaderCircle className="h-5 w-5 animate-spin" />正在智能获取…</> : <><Sparkles className="h-5 w-5" />自动获取并保存</>}</button></div></div></form>;
}

function UnitQrDialog({ unit, onClose }: { unit: UnitRow; onClose: () => void }) {
  const [imageUrl, setImageUrl] = useState(''); const [copied, setCopied] = useState(false); const url = shareUrl(unit);
  useEffect(() => { void QRCode.toDataURL(url, { width: 420, margin: 2, errorCorrectionLevel: 'M', color: { dark: '#172033', light: '#ffffff' } }).then(setImageUrl); }, [url]);
  useEffect(() => { const close = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); }; window.addEventListener('keydown', close); return () => window.removeEventListener('keydown', close); }, [onClose]);
  async function copyLink() { await navigator.clipboard.writeText(url); setCopied(true); window.setTimeout(() => setCopied(false), 1800); }
  function download() { if (!imageUrl) return; const anchor = document.createElement('a'); anchor.href = imageUrl; anchor.download = `${unit.title.replace(/[\\/:*?"<>|]/g, '-')}-学生二维码.png`; anchor.click(); }
  return <div className="word-modal" role="dialog" aria-modal="true" aria-labelledby="word-qr-title" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="word-card word-modal-card p-6 sm:p-8"><div className="flex items-start justify-between gap-4"><div><p className="word-kicker">发到学习通</p><h2 id="word-qr-title" className="mt-1 text-2xl font-black">{unit.title} 学生二维码</h2></div><button type="button" onClick={onClose} className="word-icon" aria-label="关闭二维码"><X className="h-5 w-5" /></button></div><div className="mt-5 grid justify-items-center rounded-2xl bg-slate-50 p-5">{imageUrl ? <img src={imageUrl} alt={`${unit.title}学生练习二维码`} className="h-auto w-full max-w-[320px] rounded-xl bg-white" /> : <LoaderCircle className="my-24 h-8 w-8 animate-spin text-indigo-600" />}<p className="mt-4 text-center text-sm font-bold text-slate-600">单元代码：{unit.share_code}</p><p className="mt-2 max-w-full break-all text-center text-xs leading-5 text-slate-500">{url}</p></div><div className="mt-5 grid gap-3 sm:grid-cols-2"><button type="button" onClick={() => void copyLink()} className="word-secondary"><Clipboard className="h-4 w-4" />{copied ? '已复制链接' : '复制学生链接'}</button><button type="button" onClick={download} disabled={!imageUrl} className="word-primary"><Download className="h-4 w-4" />下载二维码</button></div></section></div>;
}

function DictionaryWord({ word }: { word: WordItem }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><b className="text-xl">{word.word}</b>{word.phonetic && <span className="ml-2 text-sm font-bold text-indigo-700">{word.phonetic}</span>}<p className="mt-2 text-sm leading-6 text-slate-600">{word.meaning || '暂无词典释义'}</p>{word.example && <p className="mt-1 text-sm italic leading-6 text-slate-500">“{word.example}”</p>}</div><span className={`word-status ${word.audio_file_id ? 'is-live' : ''}`}>{word.audio_file_id ? '词典发音' : '未找到发音'}</span></div>{word.audioUrl && <audio controls preload="none" src={word.audioUrl} className="mt-3 h-9 w-full" />}</div>;
}

function SharedLibrary({ rows, onApplied }: { rows: SharedUnitRow[]; onApplied: (unit: UnitRow) => void }) {
  const [keyword, setKeyword] = useState('');
  const [detail, setDetail] = useState<UnitRow | null>(null);
  const [loadingId, setLoadingId] = useState('');
  const [applyingId, setApplyingId] = useState('');
  const [error, setError] = useState('');
  const filtered = rows.filter((row) => !keyword || normalize(`${row.title}${row.teacher_name}`).includes(normalize(keyword)));

  async function toggleDetail(unit: SharedUnitRow) {
    if (detail?.id === unit.id) { setDetail(null); return; }
    setLoadingId(unit.id); setError('');
    try {
      const payload = await wordRequest<{ unit: UnitRow }>('teacherGetSharedUnit', { unitId: unit.id }, getWordToken());
      setDetail(payload.unit);
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : '暂时无法读取任务。'); }
    finally { setLoadingId(''); }
  }

  async function applyUnit(unit: SharedUnitRow) {
    setApplyingId(unit.id); setError('');
    try {
      const payload = await wordRequest<{ unit: UnitRow }>('teacherCloneUnit', { unitId: unit.id }, getWordToken());
      onApplied(payload.unit);
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : '应用任务失败，请重试。'); }
    finally { setApplyingId(''); }
  }

  return <section><div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="word-kicker">TEAM TASK LIBRARY</p><h2 className="mt-1 text-2xl font-black">共享任务库</h2><p className="mt-2 text-sm leading-6 text-slate-500">每位老师发布的新任务都会显示在这里。点击“应用到我的工作台”会生成独立副本和新的学生链接。</p></div><label className="relative w-full sm:w-80"><span className="sr-only">搜索共享任务</span><Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" /><input value={keyword} onChange={(event) => setKeyword(event.target.value)} className="word-input pl-12" placeholder="搜索老师或任务名称" /></label></div>{error && <p className="word-error mb-4">{error}</p>}<div className="grid gap-4">{filtered.map((unit) => <article key={unit.id} className="word-card overflow-hidden"><div className="flex flex-wrap items-center justify-between gap-4 p-5"><button onClick={() => void toggleDetail(unit)} className="flex min-w-0 flex-1 items-center gap-4 text-left"><div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-cyan-100 text-cyan-800"><Library /></div><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="truncate text-lg font-black">{unit.title}</h3><span className="word-chip">{unit.teacher_name}</span>{unit.isMine && <span className="word-status is-live">我的任务</span>}</div><p className="mt-1 text-sm text-slate-500">{unit.wordCount} 个单词 · 发布于 {formatDate(unit.published_at)}</p></div>{loadingId === unit.id ? <LoaderCircle className="ml-auto h-5 w-5 animate-spin text-indigo-600" /> : <ChevronDown className={`ml-auto h-5 w-5 transition ${detail?.id === unit.id ? 'rotate-180' : ''}`} />}</button>{!unit.isMine && <button disabled={applyingId === unit.id} onClick={() => void applyUnit(unit)} className="word-primary text-sm">{applyingId === unit.id ? <><LoaderCircle className="h-4 w-4 animate-spin" />正在应用…</> : <><CopyPlus className="h-4 w-4" />应用到我的工作台</>}</button>}</div>{detail?.id === unit.id && <div className="border-t border-slate-200 bg-slate-50 p-5"><div className="mb-4 rounded-2xl bg-white p-4 text-sm leading-6 text-slate-600"><b className="text-slate-900">教师提示：</b>{detail.note || '无额外提示'}</div><div className="grid gap-3 lg:grid-cols-2">{detail.words.map((word) => <DictionaryWord key={word.id} word={word} />)}</div></div>}</article>)}{!filtered.length && <div className="word-card p-12 text-center"><Library className="mx-auto h-12 w-12 text-indigo-300" /><h3 className="mt-4 text-xl font-black">还没有找到共享任务</h3><p className="mt-2 text-slate-500">老师发布新任务后会自动出现在这里。</p></div>}</div></section>;
}

function TeacherApp() {
  const [name, setName] = useState('教师'); const [tab, setTab] = useState<'units' | 'shared' | 'data'>('units'); const [units, setUnits] = useState<UnitRow[]>([]); const [sharedUnits, setSharedUnits] = useState<SharedUnitRow[]>([]); const [attempts, setAttempts] = useState<WordAttempt[]>([]); const [loading, setLoading] = useState(true); const [editing, setEditing] = useState<UnitRow | null | 'new'>(null); const [expanded, setExpanded] = useState(''); const [notice, setNotice] = useState(''); const [qrUnit, setQrUnit] = useState<UnitRow | null>(null);
  async function load() { setLoading(true); try { const session = await wordRequest<{ name: string }>('session', {}, getWordToken()); setName(session.name); const [unitData, sharedData, attemptData] = await Promise.all([wordRequest<{ rows: UnitRow[] }>('teacherListUnits', {}, getWordToken()), wordRequest<{ rows: SharedUnitRow[] }>('teacherListSharedUnits', {}, getWordToken()), wordRequest<{ rows: WordAttempt[] }>('listAttempts', {}, getWordToken())]); setUnits(unitData.rows || []); setSharedUnits(sharedData.rows || []); setAttempts(attemptData.rows || []); } catch { clearWordSession(); window.location.reload(); } finally { setLoading(false); } }
  useEffect(() => { void load(); }, []);
  async function publish(unit: UnitRow) { setNotice(''); try { await wordRequest('teacherPublishUnit', { unitId: unit.id }, getWordToken()); setNotice(`“${unit.title}”已实时发布，可以把学生链接发到学习通。`); await load(); } catch (requestError) { setNotice(requestError instanceof Error ? requestError.message : '发布失败。'); } }
  async function copy(unit: UnitRow) { await navigator.clipboard.writeText(shareUrl(unit)); setNotice('学生链接已复制，可以粘贴到学习通。'); }
  function applied(unit: UnitRow) { setNotice(`已把“${unit.title}”复制到您的工作台，可编辑后再发布。`); setExpanded(unit.id); setTab('units'); void load(); }
  async function logout() { await wordRequest('logout', {}, getWordToken()).catch(() => undefined); clearWordSession(); window.location.reload(); }
  return (
    <main className="word-shell min-h-screen pb-12">
      <StaffHeader title={`${name}的教师工作台`} subtitle="自己的单元独立发布；已发布任务可供四位教师互相应用" onLogout={() => void logout()} />
      <section className="mx-auto max-w-7xl px-5 pt-6">
        <div className="word-tabs">
          <button onClick={() => setTab('units')} className={tab === 'units' ? 'is-active' : ''}><Radio />我的单元</button>
          <button onClick={() => setTab('shared')} className={tab === 'shared' ? 'is-active' : ''}><Library />共享任务库</button>
          <button onClick={() => setTab('data')} className={tab === 'data' ? 'is-active' : ''}><BarChart3 />全部学生数据</button>
        </div>
        {notice && <p className="mt-4 rounded-2xl bg-cyan-50 px-4 py-3 text-sm font-bold text-cyan-950">{notice}</p>}
        {loading && <div className="grid place-items-center py-24 text-indigo-700"><LoaderCircle className="h-8 w-8 animate-spin" /></div>}

        {!loading && tab === 'units' && <div className="mt-5">
          {editing ? <UnitEditor unit={editing === 'new' ? null : editing} onCancel={() => setEditing(null)} onSaved={(saved, message) => { setEditing(null); setExpanded(saved.id); setNotice(message); void load(); }} /> : <>
            <div className="mb-4 flex items-end justify-between gap-4"><div><p className="word-kicker">我的教学内容</p><h2 className="mt-1 text-2xl font-black">单元与词典标准发音</h2></div><button onClick={() => setEditing('new')} className="word-primary"><Plus className="h-5 w-5" />智能添加单元</button></div>
            <div className="grid gap-4">
              {units.map((unit) => <article key={unit.id} className="word-card overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-4 p-5">
                  <button onClick={() => setExpanded(expanded === unit.id ? '' : unit.id)} className="flex min-w-0 flex-1 items-center gap-4 text-left"><div className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${unit.status === 'published' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}><BookOpenCheck /></div><div className="min-w-0"><h3 className="truncate text-lg font-black">{unit.title}</h3><p className="mt-1 text-sm text-slate-500">{unit.words.length} 个单词 · 词典发音 {unit.demoCount}/{unit.words.length} · {unit.status === 'published' ? '已发布并共享' : '草稿'}</p>{unit.copied_from_teacher && <p className="mt-1 text-xs font-bold text-cyan-700">应用自 {unit.copied_from_teacher}</p>}</div><ChevronDown className={`ml-auto h-5 w-5 transition ${expanded === unit.id ? 'rotate-180' : ''}`} /></button>
                  <div className="flex flex-wrap gap-2"><button onClick={() => setEditing(unit)} className="word-secondary text-sm"><Sparkles className="h-4 w-4" />智能编辑</button>{unit.status === 'published' && <><button onClick={() => void copy(unit)} className="word-secondary text-sm"><Clipboard className="h-4 w-4" />复制学生链接</button><button onClick={() => setQrUnit(unit)} className="word-secondary text-sm"><QrCode className="h-4 w-4" />学生二维码</button></>}<button onClick={() => void publish(unit)} className="word-primary text-sm"><Radio className="h-4 w-4" />{unit.status === 'published' ? '重新发布' : '实时发布'}</button></div>
                </div>
                {expanded === unit.id && <div className="border-t border-slate-200 bg-slate-50 p-5"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><p className="text-sm font-bold text-slate-600">发音、音标、释义和例句已由系统自动获取；发布后自动进入共享任务库。</p><span className="word-pill">单元代码 {unit.share_code}</span></div><div className="grid gap-3 lg:grid-cols-2">{unit.words.map((word) => <DictionaryWord key={word.id} word={word} />)}</div></div>}
              </article>)}
              {!units.length && <div className="word-card p-12 text-center"><Sparkles className="mx-auto h-12 w-12 text-indigo-300" /><h3 className="mt-4 text-xl font-black">还没有单元</h3><p className="mt-2 text-slate-500">可以智能新建，也可以从共享任务库应用其他老师的任务。</p></div>}
            </div>
          </>}
        </div>}

        {!loading && tab === 'shared' && <div className="mt-5"><SharedLibrary rows={sharedUnits} onApplied={applied} /></div>}
        {!loading && tab === 'data' && <div className="mt-5"><Metrics attempts={attempts} /><div className="word-card mt-5 p-5"><AttemptsTable rows={attempts} showTeacher /></div></div>}
      </section>
      {qrUnit && <UnitQrDialog unit={qrUnit} onClose={() => setQrUnit(null)} />}
    </main>
  );
}

function AdminApp() {
  const [teachers, setTeachers] = useState<Teacher[]>([]); const [attempts, setAttempts] = useState<WordAttempt[]>([]); const [tab, setTab] = useState<'teachers' | 'data'>('teachers'); const [name, setName] = useState(''); const [code, setCode] = useState(''); const [password, setPassword] = useState(''); const [notice, setNotice] = useState(''); const [loading, setLoading] = useState(true);
  async function load() { setLoading(true); try { await wordRequest('session', {}, getWordToken()); const [teacherData, attemptData] = await Promise.all([wordRequest<{ rows: Teacher[] }>('adminListTeachers', {}, getWordToken()), wordRequest<{ rows: WordAttempt[] }>('listAttempts', {}, getWordToken())]); setTeachers(teacherData.rows || []); setAttempts(attemptData.rows || []); } catch { clearWordSession(); window.location.reload(); } finally { setLoading(false); } }
  useEffect(() => { void load(); }, []);
  async function create(event: SyntheticEvent<HTMLFormElement>) { event.preventDefault(); setNotice(''); try { await wordRequest('adminCreateTeacher', { name, code, password }, getWordToken()); setName(''); setCode(''); setPassword(''); setNotice('教师账号已创建。'); await load(); } catch (requestError) { setNotice(requestError instanceof Error ? requestError.message : '创建失败。'); } }
  async function toggle(teacher: Teacher) { await wordRequest('adminSetTeacherActive', { teacherId: teacher.id, active: !teacher.active }, getWordToken()); await load(); }
  async function reset(teacher: Teacher) { const next = window.prompt(`请输入 ${teacher.name} 的新密码（至少8位）`); if (!next) return; try { await wordRequest('adminResetTeacher', { teacherId: teacher.id, password: next }, getWordToken()); setNotice(`${teacher.name} 的密码已重置。`); } catch (requestError) { setNotice(requestError instanceof Error ? requestError.message : '重置失败。'); } }
  async function logout() { await wordRequest('logout', {}, getWordToken()).catch(() => undefined); clearWordSession(); window.location.reload(); }
  return <main className="word-shell min-h-screen pb-12"><StaffHeader title="管理员总览" subtitle="管理所有教师账号，汇总查看全校练习数据" onLogout={() => void logout()} /><section className="mx-auto max-w-7xl px-5 pt-6"><div className="word-tabs"><button onClick={() => setTab('teachers')} className={tab === 'teachers' ? 'is-active' : ''}><Users />教师账号</button><button onClick={() => setTab('data')} className={tab === 'data' ? 'is-active' : ''}><BarChart3 />全部数据</button></div>{notice && <p className="mt-4 rounded-2xl bg-cyan-50 px-4 py-3 text-sm font-bold text-cyan-950">{notice}</p>}{loading ? <div className="grid place-items-center py-24"><LoaderCircle className="h-8 w-8 animate-spin text-indigo-700" /></div> : tab === 'teachers' ? <div className="mt-5 grid gap-5 lg:grid-cols-[360px_1fr]"><form onSubmit={create} className="word-card self-start p-6"><p className="word-kicker">新增使用教师</p><h2 className="mt-1 text-2xl font-black">创建教师账号</h2><div className="mt-5 grid gap-4"><label className="word-label">教师姓名<input required value={name} onChange={(event) => setName(event.target.value)} className="word-input mt-2" placeholder="如：李老师" /></label><label className="word-label">教师代码<input required value={code} onChange={(event) => setCode(event.target.value.toLowerCase())} className="word-input mt-2" placeholder="字母/数字，如：teacher01" /></label><label className="word-label">初始密码<input required minLength={8} type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="word-input mt-2" placeholder="至少8位" /></label><button className="word-primary"><Plus className="h-5 w-5" />创建账号</button></div></form><div className="word-card overflow-hidden"><div className="border-b border-slate-200 p-5"><h2 className="text-xl font-black">教师账号 · {teachers.length}</h2></div><div className="divide-y divide-slate-200">{teachers.map((teacher) => <div key={teacher.id} className="flex flex-wrap items-center justify-between gap-4 p-5"><div><b>{teacher.name}</b><p className="mt-1 text-sm text-slate-500">登录代码：{teacher.code} · {teacher.active ? '可登录' : '已停用'}</p></div><div className="flex gap-2"><button onClick={() => void reset(teacher)} className="word-secondary text-sm"><RefreshCw className="h-4 w-4" />重置密码</button><button onClick={() => void toggle(teacher)} className={`word-secondary text-sm ${teacher.active ? 'text-rose-600' : 'text-emerald-700'}`}>{teacher.active ? '停用' : '启用'}</button></div></div>)}</div></div></div> : <div className="mt-5"><Metrics attempts={attempts} /><div className="word-card mt-5 p-5"><AttemptsTable rows={attempts} showTeacher /></div></div>}</section></main>;
}

export function WordStaff({ mode }: { mode: 'teacher' | 'admin' }) {
  const token = getWordToken(); const role = getWordRole();
  if (!token || role !== mode) return <StaffLogin mode={mode} />;
  return mode === 'admin' ? <AdminApp /> : <TeacherApp />;
}
