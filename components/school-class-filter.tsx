import { SCHOOL_COLLEGES, CLASS_CATALOG } from '@/lib/class-catalog';
import {
  createSchoolClassDirectory,
  type SchoolGroup,
} from '@/lib/school-classes';

export function SchoolClassFilter({
  college,
  classKey,
  groups,
  onCollege,
  onClass,
  className = '',
}: {
  college: string;
  classKey: string;
  groups: SchoolGroup[];
  onCollege: (value: string) => void;
  onClass: (value: string) => void;
  className?: string;
}) {
  const directory = createSchoolClassDirectory([]);
  const choices = CLASS_CATALOG.map(
    (class_name) =>
      groups.find((group) => group.label === class_name) ||
      directory.resolve({ class_name }),
  );
  return (
    <>
      <select
        className={className}
        aria-label="按学院筛选"
        value={college}
        onChange={(event) => {
          onCollege(event.target.value);
          onClass('');
        }}
      >
        <option value="">全部学院</option>
        {SCHOOL_COLLEGES.map((value) => (
          <option key={value}>{value}</option>
        ))}
      </select>
      <select
        className={className}
        aria-label="按班级筛选"
        value={classKey}
        onChange={(event) => onClass(event.target.value)}
      >
        <option value="">{college ? '该学院全部班级' : '全部班级'}</option>
        {choices
          .filter((group) => !college || group.college === college)
          .map((group) => (
            <option key={group.key} value={group.key}>
              {group.label} · {group.count}
            </option>
          ))}
      </select>
    </>
  );
}
