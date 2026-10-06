/* oxlint-disable react/react-compiler -- Visible-page polling is asynchronous. */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, RefreshCw, UserCheck } from 'lucide-react';
import { archiveRequest } from './archive-api';
import { getTeacherToken } from './api';
import { createSchoolClassDirectory } from '@/lib/school-classes';
import { SchoolClassFilter } from '@/components/school-class-filter';
import './classroom-access.css';

type Request = {
  id: string;
  name: string;
  className: string;
  createdAt: number;
  status: string;
  practiceCount?: number;
  practiceScores?: { title: string; score: number | null }[];
};
export function ClassroomAccess({
  expanded = false,
  onChanged,
}: {
  expanded?: boolean;
  onChanged?: () => void;
}) {
  const [requests, setRequests] = useState<Request[]>([]);
  const [open, setOpen] = useState(expanded);
  const [college, setCollege] = useState('');
  const [classKey, setClassKey] = useState('');
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [networkError, setNetworkError] = useState('');
  const [notice, setNotice] = useState('');
  const [incomplete, setIncomplete] = useState(false);
  const [busy, setBusy] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const polling = useRef(false);
  const active = useRef(true);
  const load = useCallback(async () => {
    if (polling.current || !getTeacherToken()) return;
    polling.current = true;
    try {
      const result = await archiveRequest<{
        requests: Request[];
        hasMore?: boolean;
      }>('listAccessRequests', { pendingOnly: true }, getTeacherToken());
      if (!active.current) return;
      setRequests(result.requests.filter((row) => row.status === 'pending'));
      setIncomplete(Boolean(result.hasMore));
      setLoaded(true);
      setNetworkError('');
    } catch (err) {
      if (active.current)
        setNetworkError(
          err instanceof Error ? err.message : '申请读取失败，请重试',
        );
    } finally {
      polling.current = false;
    }
  }, []);
  useEffect(() => {
    active.current = true;
    void load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load();
    }, 5000);
    const visible = () => {
      if (document.visibilityState === 'visible') void load();
    };
    document.addEventListener('visibilitychange', visible);
    return () => {
      active.current = false;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [load]);
  const directory = createSchoolClassDirectory(
    requests.map((row) => ({ class_name: row.className })),
  );
  const filtered = requests.filter(
    (row) =>
      (!college ||
        directory.resolve({ class_name: row.className }).college === college) &&
      (!classKey ||
        directory.resolve({ class_name: row.className }).key === classKey) &&
      (!query || `${row.name}${row.className}`.includes(query.trim())),
  );
  const duplicate = (row: Request) =>
    requests.filter(
      (item) => item.name === row.name && item.className === row.className,
    ).length > 1;
  async function decide(row: Request, approve: boolean) {
    if (busy || (approve && incomplete)) return;
    if (
      !window.confirm(
        approve
          ? `请本人展示申请页面，核对本机标记 ${row.id.slice(-8)}。\n确认 ${row.className} 的 ${row.name} 是本人及此设备申请？\n确认后才关联本次记录，并允许此设备查看本人档案。不能仅凭姓名、班级就批准。`
          : `拒绝 ${row.name} 的本次申请？`,
      )
    )
      return;
    setBusy(row.id);
    setError('');
    try {
      await archiveRequest(
        approve ? 'approveAccess' : 'rejectAccess',
        {
          requestId: row.id,
          ...(approve
            ? {
                approvalMode: 'classroom-confirmation',
                identityVerified: true,
                name: row.name,
                className: row.className,
              }
            : {}),
        },
        getTeacherToken(),
      );
      if (!active.current) return;
      setRequests((previous) => previous.filter((item) => item.id !== row.id));
      setNotice(
        approve
          ? `已确认 ${row.name}，本次记录已关联；此设备可进入本人档案。`
          : `已拒绝 ${row.name} 的本次申请。`,
      );
      onChanged?.();
      void load();
    } catch (err) {
      if (active.current)
        setError(err instanceof Error ? err.message : '处理失败，请重试');
    } finally {
      if (active.current) setBusy('');
    }
  }
  async function confirmSelected() {
    const rows = filtered.filter((row) => selected.includes(row.id));
    if (busy || incomplete || !rows.length) return;
    if (rows.some(duplicate)) {
      setError(
        '同名同班出现多份设备申请，请先逐一核对学生本机申请标记，再单独确认；不能批量批准。',
      );
      return;
    }
    if (
      !window.confirm(
        `以下 ${rows.length} 位学生都已逐一核对本人和本机申请标记吗？\n${rows.map((row) => `${row.className} ${row.name} · ${row.id.slice(-8)}`).join('\n')}\n未经本人及设备核对不要批准；确认后才关联正式档案。`,
      )
    )
      return;
    setBusy('batch');
    setError('');
    const done: string[] = [];
    try {
      for (const row of rows) {
        setNotice(`正在确认 ${done.length + 1} / ${rows.length}…`);
        await archiveRequest(
          'approveAccess',
          {
            requestId: row.id,
            approvalMode: 'classroom-confirmation',
            identityVerified: true,
            name: row.name,
            className: row.className,
          },
          getTeacherToken(),
        );
        done.push(row.id);
      }
      setNotice(`已确认 ${done.length} 位学生，本次记录已关联。`);
    } catch (err) {
      setError(
        `已确认 ${done.length} 人；其余未批准。${err instanceof Error ? err.message : '请重试'}`,
      );
    } finally {
      setRequests((previous) =>
        previous.filter((row) => !done.includes(row.id)),
      );
      setSelected((previous) => previous.filter((id) => !done.includes(id)));
      setBusy('');
      onChanged?.();
      void load();
    }
  }
  return (
    <section className="classroom-access" aria-label="学生进入申请">
      <header>
        <div>
          <UserCheck size={21} />
          <strong>学生进入申请</strong>
          <span className={requests.length ? 'has-pending' : ''}>
            {loaded ? `${requests.length}人待确认` : '正在连接'}
          </span>
        </div>
        <div>
          <button onClick={() => void load()} aria-label="刷新学生进入申请">
            <RefreshCw size={16} />
          </button>
          <button
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? '收起' : '查看申请'}
          </button>
        </div>
      </header>
      <p className="classroom-access-hint">
        学生先做任务 · 教师课后核对本人和设备，再确认归档 ·
        每5秒更新，不用输数字。
      </p>
      {notice && <output className="classroom-access-success">{notice}</output>}
      {error && (
        <p role="alert" className="classroom-access-error">
          {error}
        </p>
      )}
      {networkError && (
        <p role="alert" className="classroom-access-error">
          {networkError}
        </p>
      )}
      {open && (
        <div className="classroom-access-body">
          <div className="classroom-access-filters">
            <SchoolClassFilter
              college={college}
              classKey={classKey}
              groups={directory.groups}
              onCollege={setCollege}
              onClass={setClassKey}
            />
            <input
              aria-label="搜索待确认学生"
              placeholder="搜索姓名或班级"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          {incomplete && (
            <p role="alert">申请尚未完整载入，暂不能批准，请刷新重试。</p>
          )}
          {filtered.length > 0 && (
            <div className="classroom-batch">
              <label>
                <input
                  type="checkbox"
                  checked={filtered.every((row) => selected.includes(row.id))}
                  disabled={Boolean(busy) || filtered.length > 20}
                  onChange={(event) =>
                    setSelected(
                      event.target.checked
                        ? filtered.slice(0, 20).map((row) => row.id)
                        : [],
                    )
                  }
                />
                选中当前筛选（每批最多20人）
              </label>
              <button
                className="classroom-approve"
                disabled={
                  Boolean(busy) ||
                  incomplete ||
                  !filtered.some((row) => selected.includes(row.id))
                }
                onClick={() => void confirmSelected()}
              >
                确认所选（
                {filtered.filter((row) => selected.includes(row.id)).length}）
              </button>
            </div>
          )}
          {filtered.map((row) => (
            <article key={row.id}>
              <div>
                <label>
                  <input
                    type="checkbox"
                    checked={selected.includes(row.id)}
                    disabled={
                      Boolean(busy) ||
                      (!selected.includes(row.id) && selected.length >= 20)
                    }
                    onChange={(event) =>
                      setSelected((previous) =>
                        event.target.checked
                          ? [...previous, row.id]
                          : previous.filter((id) => id !== row.id),
                      )
                    }
                  />
                  <strong>{row.name}</strong>
                </label>
                <span>{row.className}</span>
                <span>
                  申请{' '}
                  {new Date(row.createdAt).toLocaleString('zh-CN', {
                    month: 'numeric',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                  {' · 本机标记 '}
                  {row.id.slice(-8)}
                </span>
                {duplicate(row) && (
                  <strong>同名同班有多份申请，请核对本机标记后单独确认</strong>
                )}
                <span>
                  本次已提交 {row.practiceCount || 0} 份记录 · 尚未关联正式档案
                </span>
                {Boolean(row.practiceScores?.length) && (
                  <details>
                    <summary>查看本次提交</summary>
                    {row.practiceScores!.map((item, index) => (
                      <p key={index}>
                        {item.title} ·{' '}
                        {item.score == null
                          ? item.title.includes('学情')
                            ? '自评，不计成绩'
                            : '待教师回听 / 评分'
                          : `${item.score} / 100`}
                      </p>
                    ))}
                  </details>
                )}
              </div>
              <div>
                <button
                  disabled={Boolean(busy)}
                  onClick={() => void decide(row, false)}
                >
                  拒绝
                </button>
                <button
                  className="classroom-approve"
                  disabled={Boolean(busy) || incomplete}
                  onClick={() => void decide(row, true)}
                >
                  <Check size={16} />
                  {busy === row.id ? '处理中…' : '确认归档'}
                </button>
              </div>
            </article>
          ))}
          {!filtered.length && (
            <p className="classroom-access-empty">
              {loaded
                ? '暂无匹配申请。学生提交后自动出现在这里。'
                : '正在读取申请…'}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
