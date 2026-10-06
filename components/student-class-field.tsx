'use client';

import { useId, useState } from 'react';
import {
  COLLEGE_CLASSES,
  SCHOOL_COLLEGES,
  DEFAULT_CLASS,
  collegeForClass,
} from '@/lib/class-catalog';
import { normalizeSchoolClass } from '@/lib/school-classes';
import styles from './student-class-field.module.css';

type Props = {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  label?: string;
  theme?: 'words' | 'profile' | 'speaking';
  onCollegeChange?: (value: string) => void;
  compactHelp?: boolean;
};

export function StudentClassField({
  value,
  onChange,
  required = false,
  label = '班级',
  theme = 'profile',
  onCollegeChange,
  compactHelp = false,
}: Props) {
  const id = useId();
  const canonical = value ? normalizeSchoolClass(value) : '';
  const [chosenCollege, setChosenCollege] = useState('');
  const college =
    chosenCollege || (canonical ? collegeForClass(canonical) : '');
  const selectedClass =
    canonical && COLLEGE_CLASSES[college]?.includes(canonical) ? canonical : '';
  return (
    <div className={styles.field} data-theme={theme}>
      <label className={styles.label} htmlFor={`${id}-college`}>
        学院{required ? ' *' : ''}
      </label>
      <select
        id={`${id}-college`}
        className={styles.control}
        required={required}
        value={college}
        onChange={(event) => {
          const next = event.target.value;
          setChosenCollege(next);
          onChange('');
          onCollegeChange?.(next);
        }}
      >
        <option value="">先选择学院</option>
        {SCHOOL_COLLEGES.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
      <label className={styles.label} htmlFor={`${id}-class`}>
        {label}
        {required ? ' *' : ''}
      </label>
      <select
        id={`${id}-class`}
        className={styles.control}
        required={required}
        disabled={!college}
        value={selectedClass}
        aria-describedby={`${id}-help`}
        onChange={(event) => {
          onChange(event.target.value);
          onCollegeChange?.(college);
        }}
      >
        <option value="">
          {college ? '再选择完整班级' : '选择学院后显示班级'}
        </option>
        {(COLLEGE_CLASSES[college] || []).map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
      {compactHelp ? (
        <details className={styles.hint}>
          <summary>找不到班级？</summary>
          <p id={`${id}-help`}>
            选择默认学院中的{DEFAULT_CLASS}，请老师核对。姓名不附班级。
          </p>
        </details>
      ) : (
        <p id={`${id}-help`} className={styles.hint}>
          姓名只填真实姓名，不要附上班级。找不到班级时，选择默认学院中的
          {DEFAULT_CLASS}，请老师核对。
        </p>
      )}
      {value && selectedClass === DEFAULT_CLASS && (
        <p className={styles.warning}>
          此记录暂归测试班；原填信息和已有成绩仍然保留。
        </p>
      )}
    </div>
  );
}
