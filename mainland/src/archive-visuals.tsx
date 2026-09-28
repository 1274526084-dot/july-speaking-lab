import { SKILL_LABELS } from './profile-api';
import './archive-visuals.css';

const KEYS = Object.keys(SKILL_LABELS) as Array<keyof typeof SKILL_LABELS>;
export function SkillRadar({
  skills,
  previous,
}: {
  skills?: Record<string, number> | null;
  previous?: Record<string, number> | null;
}) {
  const point = (i: number, radius: number) => {
    const a = (i * Math.PI * 2) / KEYS.length - Math.PI / 2;
    return [180 + radius * Math.cos(a), 171 + radius * Math.sin(a)];
  };
  const points = (r: number) =>
    KEYS.map((_, i) => point(i, r).join(',')).join(' ');
  const valid = (data?: Record<string, number> | null) =>
    Boolean(
      data &&
      KEYS.every(
        (key) => Number.isFinite(data[key]) && data[key] >= 1 && data[key] <= 5,
      ),
    );
  const dataPoints = (data: Record<string, number>) =>
    KEYS.map((key, i) =>
      point(i, (Number(data[key]) / 5) * 115).join(','),
    ).join(' ');
  return (
    <figure className="archive-radar">
      {/* This SVG is a rendered chart; its image role and label describe the full graphic. */}
      {/* oxlint-disable jsx-a11y/prefer-tag-over-role */}
      <svg
        viewBox="0 0 360 340"
        role="img"
        aria-label={
          valid(skills)
            ? `英语能力自评雷达图，满分5：${KEYS.map((key) => `${SKILL_LABELS[key]}${skills![key]}`).join('，')}`
            : '尚无能力自评数据，请完成调查或阶段自评'
        }
      >
        {/* oxlint-enable jsx-a11y/prefer-tag-over-role */}
        {[1, 2, 3, 4, 5]
          .map((n) => (
            <polygon
              key={n}
              points={points(n * 23)}
              fill={n % 2 ? '#f7faf5' : '#fff'}
              stroke="#d9e3d8"
              strokeWidth="1"
            />
          ))
          .reverse()}
        {KEYS.map((key, i) => {
          const [x, y] = point(i, 115);
          const [tx, ty] = point(i, 146);
          return (
            <g key={key}>
              <line x1="180" y1="171" x2={x} y2={y} stroke="#d9e3d8" />
              <text x={tx} y={ty} textAnchor="middle" dominantBaseline="middle">
                {SKILL_LABELS[key]}
              </text>
            </g>
          );
        })}
        {valid(previous) && (
          <polygon
            points={dataPoints(previous!)}
            fill="#e9944320"
            stroke="#d78636"
            strokeWidth="2"
            strokeDasharray="5 4"
          />
        )}
        {valid(skills) && (
          <>
            <polygon
              points={dataPoints(skills!)}
              fill="#43806d35"
              stroke="#28715d"
              strokeWidth="2.5"
            />
            {KEYS.map((key, i) => {
              const [cx, cy] = point(i, (skills![key] / 5) * 115);
              return (
                <circle
                  key={key}
                  cx={cx}
                  cy={cy}
                  r="4"
                  fill="#28715d"
                  stroke="white"
                  strokeWidth="2"
                />
              );
            })}
          </>
        )}
        {!valid(skills) && (
          <text x="180" y="172" textAnchor="middle" className="radar-empty">
            等待你的第一次自评
          </text>
        )}
      </svg>
      <figcaption>
        <span>● 当前自评</span>
        {valid(previous) && (
          <span className="radar-previous">┄ 上一次自评</span>
        )}
        <small>1–5分 · 这是学习感受，不是专业能力测评</small>
      </figcaption>
      {valid(skills) && (
        <details>
          <summary>查看图表数值</summary>
          <dl>
            {KEYS.map((key) => (
              <div key={key}>
                <dt>{SKILL_LABELS[key]}</dt>
                <dd>
                  {skills![key]} / 5
                  {valid(previous) ? `（上次 ${previous![key]}）` : ''}
                </dd>
              </div>
            ))}
          </dl>
        </details>
      )}
    </figure>
  );
}

export function LearningAvatar({
  variant = 'explorer',
  name = '',
}: {
  variant?: 'explorer' | 'engineer';
  name?: string;
}) {
  return (
    <figure className={`learning-avatar ${variant}`}>
      <div className="avatar-window">
        {/* This entry point is built with Vite and serves this local illustration directly. */}
        {/* oxlint-disable-next-line next/no-img-element */}
        <img
          src={`${import.meta.env.BASE_URL}archive/railway-learning-companions.png`}
          alt={`${name ? `${name}选择的` : ''}虚构铁路英语学习伙伴插画`}
        />
      </div>
      <figcaption>
        {variant === 'explorer' ? '线路探索者' : '技术协作者'}
        <small>自选形象 · 不代表分数或能力等级</small>
      </figcaption>
    </figure>
  );
}
