'use client';

import { useId, useState } from 'react';
import { CLASS_CATALOG } from '@/lib/class-catalog';
import styles from './student-class-field.module.css';

type StudentClassFieldProps = {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  label?: string;
  theme?: 'words' | 'profile' | 'speaking';
};

function cleanDigits(value: string) {
  return value.replace(/[０-９]/g, (digit) => String(digit.charCodeAt(0) - 0xff10));
}

// This helper only prepares a student's explicit choice. Existing values and
// saved drafts are never normalized as a side effect of rendering this field.
export function StudentClassField({
  value,
  onChange,
  required = false,
  label = '班级',
  theme = 'profile',
}: StudentClassFieldProps) {
  const id = useId();
  const [helperOpen, setHelperOpen] = useState(false);
  const [year, setYear] = useState('');
  const [major, setMajor] = useState('');
  const [number, setNumber] = useState('');
  const currentText = cleanDigits(value).replace(/\s+/g, '');
  const needsFullClass = /^(?:\d{2,4}[-－—])?\d{1,4}班?$/.test(currentText);
  const yearDigits = cleanDigits(year).trim();
  const classDigits = cleanDigits(number).trim().replace(/班$/, '');
  const shortMajor = major.trim().replace(/\s+/g, '');
  const canBuild = /^(?:\d{2}|20\d{2})$/.test(yearDigits)
    && /^\d{1,4}$/.test(classDigits)
    && /[\u4e00-\u9fffA-Za-z]/.test(shortMajor)
    && shortMajor.length <= 30;
  const suggestedClass = canBuild
    ? `${yearDigits.slice(-2)}-${shortMajor}${classDigits}班`
    : '';
  const existingChoice = CLASS_CATALOG.includes(value) ? value : '';

  function openHelper() {
    if (!helperOpen) {
      const parts = currentText.match(/^(?:(\d{2}|20\d{2})[-－—])?([^\d]+?)(\d{1,4})班?$/);
      setYear(parts?.[1] || '');
      setMajor(parts?.[2] || '');
      setNumber(parts?.[3] || (/^\d{1,4}班?$/.test(currentText) ? currentText.replace(/班$/, '') : ''));
    }
    setHelperOpen((open) => !open);
  }

  return (
    <div className={styles.field} data-theme={theme}>
      <label className={styles.label} htmlFor={`${id}-class`}>{label}{required ? ' *' : ''}</label>
      {CLASS_CATALOG.length > 0 && (
        <>
          <label className={styles.selectionLabel} htmlFor={`${id}-select`}>从已有班级选择</label>
          <select
            id={`${id}-select`}
            className={styles.control}
            value={existingChoice}
            onChange={(event) => { if (event.target.value) onChange(event.target.value); }}
            aria-describedby={`${id}-help`}
          >
            <option value="">请选择你的完整班级</option>
            {CLASS_CATALOG.map((className) => <option key={className} value={className}>{className}</option>)}
          </select>
        </>
      )}
      <input
        id={`${id}-class`}
        className={styles.control}
        required={required}
        maxLength={50}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="如：26-城轨信号54班"
        aria-describedby={`${id}-help${needsFullClass ? ` ${id}-warning` : ''}`}
        autoComplete="off"
      />
      <p id={`${id}-help`} className={styles.hint}>选择后会填入下方；找不到时可直接填写。请与老师公布的完整班级名称一致。</p>
      {needsFullClass && <output id={`${id}-warning`} className={styles.warning}>只有班号容易与其他专业重名，请补全年级和专业，例如：26-城轨信号54班。</output>}
      <button type="button" className={styles.helperToggle} aria-expanded={helperOpen} aria-controls={`${id}-helper`} onClick={openHelper}>
        {helperOpen ? '收起填写助手' : '按年级、专业和班号填写'}
      </button>
      {helperOpen && (
        <div id={`${id}-helper`} className={styles.helper}>
          <div className={styles.parts}>
            <label>入学年级<input className={styles.control} inputMode="numeric" maxLength={4} value={year} onChange={(event) => setYear(event.target.value)} placeholder="如：26" /></label>
            <label>专业简称<input className={styles.control} maxLength={30} value={major} onChange={(event) => setMajor(event.target.value)} placeholder="如：城轨信号" /></label>
            <label>班号<input className={styles.control} inputMode="numeric" maxLength={5} value={number} onChange={(event) => setNumber(event.target.value)} placeholder="如：54" /></label>
          </div>
          <p className={styles.preview} aria-live="polite">{suggestedClass ? `班级预览：${suggestedClass}` : '填写三项后，确认完整班级名称。'}</p>
          <button type="button" className={styles.apply} disabled={!canBuild} onClick={() => { onChange(suggestedClass); setHelperOpen(false); }}>使用这个班级</button>
        </div>
      )}
    </div>
  );
}
