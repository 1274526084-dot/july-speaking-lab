import type { ClassGroup } from '@/lib/class-groups';

export function ClassGroupingNote({ groups }: { groups: ClassGroup[] }) {
  const combined = groups.filter(group => group.aliases.length > 1);
  const pending = groups.filter(group => group.ambiguous);
  return (
    <details style={{ margin: '12px 0', border: '1px solid #d8dfda', borderRadius: 12, padding: '12px 16px', background: '#f7faf8', fontSize: 14, color: '#47544b' }}>
      <summary style={{ cursor: 'pointer', fontWeight: 700 }}>班级智能归类 · {combined.length}组已合并写法{pending.length ? ` · ${pending.length}组待确认` : ''}</summary>
      <p style={{ marginTop: 8 }}>筛选、统计和导出使用归类班级，明细保留原填班级。缺少年级或专业且对应多个班级时，单独显示为“待确认”。</p>
      {combined.map(group => <p key={group.key} style={{ marginTop: 6 }}><strong>{group.label}</strong> ← {group.aliases.join('、')}</p>)}
      {pending.map(group => <p key={group.key} style={{ marginTop: 6, color: '#9a5b17' }}><strong>{group.label}</strong>：{group.aliases.join('、')}</p>)}
    </details>
  );
}
