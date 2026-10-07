import './course-charts.css';

export type CourseTrendPoint = {
  label: string;
  first?: number | null;
  latest?: number | null;
  participants?: number;
};

const safeScore = (value?: number | null) =>
  typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.min(100, value))
    : null;
const shown = (value?: number | null) =>
  value == null ? '暂无' : `${Math.round(value * 10) / 10}分`;

export function CourseTrendChart({
  points,
  label,
}: {
  points: CourseTrendPoint[];
  label: string;
}) {
  const visible = points.slice(-9);
  const x = (index: number) => 64 + (visible.length < 2 ? 252 : (index * 504) / (visible.length - 1));
  const y = (value: number) => 226 - (value * 176) / 100;
  const segments = (key: 'first' | 'latest') => {
    const runs: string[][] = [];
    visible.forEach((point, index) => {
      const value = safeScore(point[key]);
      if (value === null) return;
      if (index === 0 || safeScore(visible[index - 1][key]) === null) runs.push([]);
      runs[runs.length - 1].push(`${x(index)},${y(value)}`);
    });
    return runs.filter((run) => run.length > 1);
  };
  const hasScore = visible.some((point) => safeScore(point.latest) !== null);
  return (
    <figure className="cc-trend">
      {hasScore ? (
        <>
          <svg viewBox="0 0 640 274" role="img" aria-label={`${label}：${visible.map((point) => `${point.label}首次${shown(point.first)}、最近${shown(point.latest)}`).join('；')}`}>
            {[0, 25, 50, 75, 100].map((tick) => (
              <g key={tick}>
                <line x1="64" y1={y(tick)} x2="568" y2={y(tick)} stroke="#dce9e3" strokeDasharray={tick ? '4 6' : undefined} />
                <text x="47" y={y(tick) + 5} textAnchor="end" className="cc-axis">{tick}</text>
              </g>
            ))}
            {segments('first').map((run, index) => <polyline key={`first-${index}`} points={run.join(' ')} fill="none" stroke="#dd9966" strokeWidth="3" strokeDasharray="7 6" strokeLinecap="round" strokeLinejoin="round" />)}
            {segments('latest').map((run, index) => <polyline key={`latest-${index}`} points={run.join(' ')} fill="none" stroke="#20745b" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />)}
            {visible.map((point, index) => (
              <g key={`${point.label}-${index}`}>
                {safeScore(point.first) !== null && <circle cx={x(index)} cy={y(safeScore(point.first)!)} r="4.5" fill="#dd9966"><title>{point.label}首次 {shown(point.first)}</title></circle>}
                {safeScore(point.latest) !== null && <circle cx={x(index)} cy={y(safeScore(point.latest)!)} r="6" fill="#20745b" stroke="white" strokeWidth="2"><title>{point.label}最近 {shown(point.latest)}{point.participants != null ? ` · ${point.participants}人` : ''}</title></circle>}
                <text x={x(index)} y={point.participants == null ? 254 : 248} textAnchor="middle" className="cc-axis cc-x-label">{point.label}</text>
                {point.participants != null && <text x={x(index)} y="265" textAnchor="middle" className="cc-axis cc-participants">{point.participants}人</text>}
              </g>
            ))}
          </svg>
          <figcaption><span><i className="cc-legend-dot latest" />最近</span><span><i className="cc-legend-dot first" />首次</span><small>仅连接相邻且有成绩的课次；缺交不计为0分{visible.some((point) => point.participants != null) ? '；各课参与人数可能不同' : ''}</small><small className="cc-scroll-hint">左右滑动可看完整曲线</small></figcaption>
        </>
      ) : <p className="cc-chart-empty">完成课次任务后，这里会显示成绩变化；尚未提交的课次不绘制为0分。</p>}
    </figure>
  );
}

export function ScoreDistribution({ scores }: { scores: Array<number | null | undefined> }) {
  const valid = scores.map(safeScore).filter((value): value is number => value !== null);
  const bands = [
    { label: '90–100', min: 90, max: 100 },
    { label: '80–89', min: 80, max: 90 },
    { label: '70–79', min: 70, max: 80 },
    { label: '60–69', min: 60, max: 70 },
    { label: '0–59', min: 0, max: 60 },
  ].map((band) => ({ ...band, count: valid.filter((value) => value >= band.min && (band.max === 100 ? value <= 100 : value < band.max)).length }));
  const max = Math.max(1, ...bands.map((band) => band.count));
  return <div className="cc-bars" aria-label={`成绩区间统计：${bands.map((band) => `${band.label}分${band.count}人`).join('，')}；未提交${scores.length - valid.length}人`}>
    {bands.map((band) => <div className="cc-bar-row" key={band.label}><span>{band.label}</span><div className="cc-bar-track"><i style={{ width: `${(band.count / max) * 100}%` }} /></div><strong>{band.count}人</strong></div>)}
    <p>已有成绩 {valid.length} 人 · 尚未提交 {scores.length - valid.length} 人</p>
  </div>;
}

export function ClassScoreBars({ rows }: { rows: Array<{ name: string; total: number; graded: number; average: number | null }> }) {
  return <div className="cc-class-list" aria-label="各班本课最近均分对比">
    {rows.length ? rows.map((row) => <div className="cc-class-row" key={row.name}>
      <div><strong>{row.name}</strong><small>{row.graded}/{row.total}人有成绩</small></div>
      <div className="cc-class-track">{row.average !== null && <i style={{ width: `${safeScore(row.average) ?? 0}%` }} />}</div>
      <b>{shown(row.average)}</b>
    </div>) : <p className="cc-chart-empty">当前范围内尚无班级记录。</p>}
  </div>;
}
