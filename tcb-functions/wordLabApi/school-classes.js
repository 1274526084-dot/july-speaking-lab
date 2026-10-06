/* Generated from lib/school-classes.ts. */
/* oxlint-disable typescript/no-require-imports */
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CLASS_NORMALIZATION_VERSION = void 0;
exports.projectSchoolRecord = projectSchoolRecord;
exports.normalizeSchoolClass = normalizeSchoolClass;
exports.projectSchoolPayload = projectSchoolPayload;
exports.projectSchoolSubmission = projectSchoolSubmission;
exports.createSchoolClassDirectory = createSchoolClassDirectory;
const class_catalog_1 = require("./class-catalog");
const class_groups_1 = require("./class-groups");
exports.CLASS_NORMALIZATION_VERSION = 'school-classes-20261005-v1';
const roster = class_catalog_1.CLASS_CATALOG.filter((value) => value !== class_catalog_1.DEFAULT_CLASS).map((label) => ({ label, parsed: (0, class_groups_1.parseClassName)(label) }));
const clean = (value) => String(value || '')
    .normalize('NFKC')
    .trim()
    .replace(/[+＋]/g, '-');
const keyOf = (value) => `class:${value.year || '*'}:${value.major || '*'}:${value.number}`;
function literalClass(value, majorHint = '') {
    const input = clean(value);
    if (input === class_catalog_1.DEFAULT_CLASS ||
        /^(?:默认班级|测试班|测试班级|测试)$/.test(input))
        return class_catalog_1.DEFAULT_CLASS;
    let parsed = (0, class_groups_1.parseClassName)(input);
    const reverse = input.match(/^(\d{1,3})班\s*([^\d]+)$/);
    if (reverse)
        parsed = (0, class_groups_1.parseClassName)(`${reverse[2]}${reverse[1]}班`);
    if (parsed.number && !parsed.major && majorHint)
        parsed.major = (0, class_groups_1.parseClassName)(`${majorHint}1班`).major;
    // These abbreviations refer to exactly one roster major at each listed number.
    if (parsed.major === '城轨' || parsed.major === '城轨交通') {
        if (['53', '54'].includes(parsed.number || ''))
            parsed.major = '城轨信号';
        if (parsed.number === '58')
            parsed.major = '城轨车辆';
        if (['68', '69'].includes(parsed.number || ''))
            parsed.major = '城轨运营';
    }
    if (parsed.major === '机车车辆')
        parsed.major = ['122', '123', '124', '125'].includes(parsed.number || '')
            ? '机车'
            : '铁道车辆';
    if (parsed.major === '铁道' &&
        ['84', '85', '2684', '2685'].includes(parsed.number || ''))
        parsed.major = '铁工';
    if (!parsed.year && parsed.number && /^26\d{2,3}$/.test(parsed.number)) {
        const number = parsed.number.slice(2).replace(/^0+(?=\d)/, '');
        const packed = roster.filter((row) => row.parsed.year === '2026' &&
            row.parsed.number === number &&
            (!parsed.major || row.parsed.major === parsed.major));
        if (packed.length === 1)
            return packed[0].label;
    }
    if (!parsed.number)
        return null;
    const candidates = roster.filter((row) => row.parsed.number === parsed.number &&
        (!parsed.major || row.parsed.major === parsed.major) &&
        (!parsed.year || row.parsed.year === parsed.year));
    return candidates.length === 1 ? candidates[0].label : null;
}
/** Split only a recognizable complete class span; never guess a person's name. */
function classSpan(value) {
    const input = clean(value).replace(/\s+/g, '');
    const matches = [];
    for (let end = 0; end < input.length; end++) {
        if (input[end] !== '班' &&
            !(/\d/.test(input[end]) && !/\d/.test(input[end + 1] || '')))
            continue;
        for (let start = 0; start <= end; start++) {
            const candidate = input.slice(start, end + 1);
            // A major is required when removing a class from the name field.
            if (!/[\u4e00-\u9fff]/.test(candidate.replace(/班$/, '')))
                continue;
            const className = literalClass(candidate);
            const remainder = (input.slice(0, start) + input.slice(end + 1)).replace(/^[,，:：;；-]+|[,，:：;；-]+$/g, '');
            if (className &&
                className !== class_catalog_1.DEFAULT_CLASS &&
                (!remainder || /^[\u4e00-\u9fffA-Za-z·.]{2,30}$/.test(remainder)))
                matches.push({ className, remainder, length: candidate.length });
        }
    }
    matches.sort((a, b) => b.length - a.length);
    return matches[0] || null;
}
/** A reversible view: grade, audio, record ID and submitted originals are untouched. */
function projectSchoolRecord(row) {
    const rawName = row.raw_student_name ?? row.student_name ?? '';
    const rawClass = row.raw_class_name ?? row.class_name ?? '';
    const nameSpan = classSpan(rawName);
    const classPart = classSpan(rawClass);
    let name = clean(rawName);
    let className = literalClass(rawClass, row.major || '') ||
        classPart?.className ||
        nameSpan?.className ||
        null;
    if (nameSpan?.remainder &&
        (!className ||
            className === nameSpan.className ||
            className === class_catalog_1.DEFAULT_CLASS)) {
        name = nameSpan.remainder;
        if (!className || className === class_catalog_1.DEFAULT_CLASS)
            className = nameSpan.className;
    }
    else if (nameSpan &&
        !nameSpan.remainder &&
        /^[\u4e00-\u9fffA-Za-z·.]{2,30}$/.test(clean(rawClass)) &&
        !literalClass(rawClass)) {
        name = clean(rawClass);
        className = nameSpan.className;
    }
    if (!nameSpan && className && className !== class_catalog_1.DEFAULT_CLASS) {
        const numberOnly = clean(rawName).match(/^(.*?)(\d{1,3})班(.*?)$/);
        const remainder = numberOnly ? (numberOnly[1] + numberOnly[3]).trim() : '';
        if (numberOnly &&
            numberOnly[2].replace(/^0+(?=\d)/, '') ===
                (0, class_groups_1.parseClassName)(className).number &&
            /^[\u4e00-\u9fffA-Za-z·.]{2,30}$/.test(remainder))
            name = remainder;
    }
    // Explicit disagreement between two recognizable class fields is not merged.
    if (nameSpan && className && nameSpan.className !== className)
        className = null;
    if (classPart?.remainder &&
        name &&
        classPart.remainder.toLowerCase() !== name.replace(/\s/g, '').toLowerCase())
        className = null;
    const finalClass = className || class_catalog_1.DEFAULT_CLASS;
    return {
        ...row,
        student_name: name,
        class_name: finalClass,
        raw_student_name: rawName,
        raw_class_name: rawClass,
        class_identity_name: finalClass === class_catalog_1.DEFAULT_CLASS
            ? row.class_identity_name || rawClass || rawName
            : finalClass,
        normalized_college: (0, class_catalog_1.collegeForClass)(finalClass),
        class_normalization_version: exports.CLASS_NORMALIZATION_VERSION,
    };
}
function normalizeSchoolClass(value, major = '') {
    return projectSchoolRecord({ class_name: value, major }).class_name;
}
function projectSchoolPayload(payload) {
    if (!payload ||
        typeof payload !== 'object' ||
        !('rows' in payload) ||
        !Array.isArray(payload.rows))
        return payload;
    return {
        ...payload,
        rows: payload.rows.map((row) => row &&
            typeof row === 'object' &&
            typeof row.class_name === 'string' &&
            typeof row.student_name === 'string'
            ? projectSchoolRecord(row)
            : row),
    };
}
/** Normalize explicit login/submission fields, not previously saved source rows. */
function projectSchoolSubmission(data) {
    if (data.profile &&
        typeof data.profile === 'object' &&
        !Array.isArray(data.profile))
        return {
            ...data,
            profile: projectSchoolSubmission(data.profile),
        };
    if (typeof data.className !== 'string')
        return data;
    const nameKey = typeof data.studentName === 'string'
        ? 'studentName'
        : typeof data.name === 'string'
            ? 'name'
            : '';
    const view = projectSchoolRecord({
        class_name: data.className,
        student_name: nameKey ? String(data[nameKey]) : '',
        major: typeof data.major === 'string' ? data.major : '',
    });
    return {
        ...data,
        className: view.class_name,
        ...(nameKey ? { [nameKey]: view.student_name } : {}),
    };
}
/** Class filter buckets are shared; unresolved PERSONAL identities remain separate. */
function createSchoolClassDirectory(records, _knownClasses = []) {
    const groups = new Map();
    const originals = new Map();
    function resolve(row) {
        const normalized = projectSchoolRecord(row);
        const fallback = normalized.class_name === class_catalog_1.DEFAULT_CLASS;
        const parsed = (0, class_groups_1.parseClassName)(normalized.class_name);
        const key = fallback ? 'school:default' : keyOf(parsed);
        const identityKey = fallback
            ? (0, class_groups_1.createClassDirectory)([
                { class_name: normalized.class_identity_name },
            ]).resolve({ class_name: normalized.class_identity_name }).key
            : key;
        if (!groups.has(key))
            groups.set(key, {
                key,
                identityKey,
                label: normalized.class_name,
                college: normalized.normalized_college,
                count: 0,
                aliases: [],
                ambiguous: fallback,
            });
        // Do not reuse the first unresolved identity just because the filter bucket matches.
        return { ...groups.get(key), identityKey };
    }
    for (const row of records) {
        const result = resolve(row);
        const group = groups.get(result.key);
        group.count++;
        const original = row.raw_class_name ?? row.class_name;
        if (!group.aliases.includes(original))
            group.aliases.push(original);
        originals.set(original, result.key);
    }
    function matches(row, query) {
        const wanted = clean(query);
        if (!wanted)
            return true;
        const group = resolve(row);
        if (/^(?:class:|raw:|school:)/.test(wanted))
            return group.key === wanted;
        const canonical = literalClass(wanted);
        if (canonical)
            return group.label === canonical;
        const compact = (value) => clean(value).replace(/[\s-]/g, '').toLowerCase();
        return (compact(group.label).includes(compact(wanted)) ||
            compact(row.raw_class_name ?? row.class_name).includes(compact(wanted)) ||
            originals.get(wanted) === group.key);
    }
    return {
        groups: [...groups.values()].sort((a, b) => Number(a.label === class_catalog_1.DEFAULT_CLASS) - Number(b.label === class_catalog_1.DEFAULT_CLASS) ||
            a.label.localeCompare(b.label, 'zh-CN', { numeric: true })),
        resolve,
        matches,
    };
}
