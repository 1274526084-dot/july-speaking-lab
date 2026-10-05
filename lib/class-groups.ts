/** A read-only projection of a saved record. Originals are never rewritten. */
export type ClassRecord = Readonly<{ class_name: string; major?: string | null }>;

export type ParsedClassName = {
  raw: string;
  normalized: string;
  /** Four-digit year where a two-digit intake year was supplied, otherwise null. */
  year: string | null;
  major: string | null;
  number: string | null;
};

export type ClassGroup = {
  key: string;
  label: string;
  /** Exact class names submitted by students, including their original spelling. */
  aliases: string[];
  count: number;
  /** More than one cohort could explain the missing year or major. */
  ambiguous: boolean;
};

const MAJOR_ALIASES: Readonly<Record<string, string>> = {
  城市轨道交通通信信号技术: "城轨信号",
  城轨通信信号: "城轨信号",
  城轨通信: "城轨信号",
  城市轨道交通通信信号: "城轨信号",
  城轨交通信号: "城轨信号",
  城轨信信号: "城轨信号",
  城里信号: "城轨信号",
  铁道机车运用与维护: "机车",
  铁道机车运用: "机车",
  机车运用与维护: "机车",
  铁道机车: "机车",
  铁道机辆: "机车",
  机车运维: "机车",
  机维: "机车",
  机车运用: "机车",
  电力储能应用技术: "储能",
  储能技术: "储能",
  电力储能: "储能",
  储能应用技术: "储能",
  电气自动化技术: "电气",
  电气自动化: "电气",
  工程测量技术: "测量",
  工程测量: "测量",
  人工智能技术应用: "人工智能",
  铁道车辆技术: "铁道车辆",
  车辆技术: "铁道车辆",
  车辆: "铁道车辆",
  车辆应用技术: "铁道车辆",
  机辆: "铁道车辆",
  城市轨道车辆应用技术: "城轨车辆",
  城市轨道应用技术: "城轨车辆",
  城轨应用: "城轨车辆",
  城辆: "城轨车辆",
  城市轨道交通运营管理: "城轨运营",
  城轨交通运营管理: "城轨运营",
  轨道交通运营管理: "城轨运营",
  铁道工程技术: "铁工",
  铁道工程: "铁工",
  铁路工程: "铁工",
  铁道工程学院: "铁工",
  新能源汽车技术: "新能源",
  新能源汽车: "新能源",
  智能控制技术: "智控",
  智能控制: "智控",
  铁道交通运营管理: "运营",
  铁道运营管理: "运营",
  运输运营: "运营",
  无人机应用技术: "无人机",
  酒店管理与数字化运营: "酒店",
  机电一体化技术: "机电",
  机电一体化: "机电",
  电汽自动化: "电气",
};

function normalizeText(value: string): string {
  return String(value ?? "").normalize("NFKC").trim().toLowerCase();
}

function compact(value: string): string {
  return normalizeText(value)
    .replace(/\u200b|\u200c|\u200d|\ufeff/g, "")
    .replace(/[\s\-_—–－·.，,、/\\]+/g, "");
}

function normalizeMajor(value: string): string {
  const normalized = compact(value).replace(/专业$/, "");
  return MAJOR_ALIASES[normalized] ?? normalized;
}

function canonicalDigits(value: string): string {
  return value.replace(/^0+(?=\d)/, "");
}

/**
 * Parse class names without guessing missing information. Full-width characters,
 * spacing, separators and leading zeroes are cosmetic. Only the explicit aliases
 * above are equivalent; similar-looking majors are deliberately not fuzzy-merged.
 */
export function parseClassName(value: string): ParsedClassName {
  const raw = String(value ?? "");
  const normalized = compact(raw);
  let body = normalizeText(raw);
  let year: string | null = null;
  // Require another class number after the prefix: plain "26班" means class 26.
  const prefix = body.match(/^(20\d{2}|19\d{2}|\d{2})(?:\s*(?:[-_—–－·./\\]|级|届)\s*|\s*(?=[^\d\s]))/);
  if (prefix && /\d\s*(?:班(?:级)?)?$/.test(body.slice(prefix[0].length))) {
    const suppliedYear = prefix[1];
    year = suppliedYear.length === 2 ? `20${suppliedYear}` : suppliedYear;
    body = body.slice(prefix[0].length);
  }
  if (!year) {
    // Some students put the intake year between the major and class number.
    // A visible separator or 年级 marker is required; "城轨信号2654" stays
    // unsplit here and can only be interpreted by an explicit known-class catalog.
    const infix = body.match(/^(.+?[^\d\s])\s*(20\d{2}|19\d{2}|\d{2})\s*(?:级|届|[-_—–－·./\\])\s*(\d+)\s*(?:班(?:级)?)?$/);
    if (infix) {
      year = infix[2].length === 2 ? `20${infix[2]}` : infix[2];
      body = `${infix[1]}${infix[3]}班`;
    }
  }
  const bodyCompact = compact(body);
  const suffix = bodyCompact.match(/(\d+)(?:班(?:级)?)?$/);
  if (!suffix) return { raw, normalized, year: null, major: null, number: null };
  const major = normalizeMajor(bodyCompact.slice(0, suffix.index));
  return { raw, normalized, year, major: major || null, number: canonicalDigits(suffix[1]) };
}

/** Format a new input or parsed name; this never edits a saved record. */
export function formatClassName(value: string | ParsedClassName): string {
  const parsed = typeof value === "string" ? parseClassName(value) : value;
  if (!parsed.number) return parsed.raw.trim();
  const year = parsed.year ? `${parsed.year.startsWith("20") ? parsed.year.slice(2) : parsed.year}-` : "";
  return `${year}${parsed.major ?? ""}${parsed.number}班`;
}

function describe(row: ClassRecord): ParsedClassName {
  const parsed = parseClassName(row.class_name);
  if (parsed.number && !parsed.major && row.major) {
    parsed.major = normalizeMajor(row.major) || null;
  }
  return parsed;
}

function identity(parsed: ParsedClassName): string {
  return parsed.number
    ? `class:${parsed.year ?? "*"}:${parsed.major ?? "*"}:${parsed.number}`
    : `raw:${parsed.normalized}`;
}

function covers(specific: ParsedClassName, partial: ParsedClassName): boolean {
  return specific.number === partial.number
    && (!partial.major || specific.major === partial.major)
    && (!partial.year || specific.year === partial.year);
}

function compatible(a: ParsedClassName, b: ParsedClassName): boolean {
  return a.number === b.number
    && (!a.major || !b.major || a.major === b.major)
    && (!a.year || !b.year || a.year === b.year);
}

/**
 * Build a display/search directory from the COMPLETE unfiltered dataset. Pass an
 * optional knownClasses catalog from other modules to make ambiguity decisions
 * consistent. Catalog entries affect resolution, not counts or the visible list.
 * Packed year/class numbers are split only against this explicit catalog and only
 * when no explicit or catalog evidence identifies the unsplit class number.
 *
 * A missing year/major is filled only when exactly one compatible observed cohort
 * exists. Ambiguous entries remain their own group; no edit-distance or number-only
 * merging is used. resolve() works for the original rows and equivalent new objects.
 * matches() supports canonical group keys, complete class names, keywords, or a
 * class number (which intentionally searches across all cohorts with that number).
 */
export function createClassDirectory(
  records: readonly ClassRecord[],
  knownClasses: readonly ClassRecord[] = [],
): {
  groups: ClassGroup[];
  resolve: (row: ClassRecord) => ClassGroup;
  matches: (row: ClassRecord, query: string) => boolean;
} {
  const evidence = new Map<string, ParsedClassName>();
  const observations = [...records, ...knownClasses].map(describe);
  const catalog = knownClasses.map(describe);

  function describeWithCatalog(row: ClassRecord): ParsedClassName {
    const parsed = describe(row);
    if (parsed.year || !parsed.major || !parsed.number || parsed.number.length < 4) return parsed;
    // Never reinterpret an explicit/catalog class 2654 as intake 26, class 54.
    const genuineNumber = catalog.some(candidate => candidate.number === parsed.number && candidate.major === parsed.major)
      || observations.some(candidate => candidate.number === parsed.number
        && candidate.major === parsed.major && candidate.year);
    if (genuineNumber) return parsed;
    const packedYear = `20${parsed.number.slice(0, 2)}`;
    const packedNumber = canonicalDigits(parsed.number.slice(2));
    const possible = catalog.filter(candidate => candidate.year === packedYear
      && candidate.major === parsed.major && candidate.number === packedNumber);
    const distinct = new Map(possible.map(candidate => [identity(candidate), candidate]));
    if (distinct.size !== 1) return parsed;
    return { ...parsed, year: packedYear, number: packedNumber };
  }

  for (const row of [...records, ...knownClasses]) {
    const parsed = describeWithCatalog(row);
    if (parsed.number) evidence.set(identity(parsed), parsed);
  }
  const byNumber = new Map<string, ParsedClassName[]>();
  for (const parsed of evidence.values()) {
    const list = byNumber.get(parsed.number!) ?? [];
    list.push(parsed);
    byNumber.set(parsed.number!, list);
  }
  const anchors = new Map<string, ParsedClassName[]>();
  for (const [number, possibilities] of byNumber) {
    // A more specific observation supersedes an incomplete observation as evidence,
    // but an incomplete row can still become a separate ambiguous display group.
    anchors.set(number, possibilities.filter(partial => !possibilities.some(specific =>
      identity(specific) !== identity(partial) && covers(specific, partial))));
  }
  const groupByKey = new Map<string, ClassGroup>();
  const parsedByKey = new Map<string, ParsedClassName>();

  function project(row: ClassRecord): { parsed: ParsedClassName; ambiguous: boolean } {
    const parsed = describeWithCatalog(row);
    if (!parsed.number) return { parsed, ambiguous: false };
    const candidates = (anchors.get(parsed.number) ?? []).filter(candidate => compatible(candidate, parsed));
    const ownAnchor = candidates.find(candidate => identity(candidate) === identity(parsed));
    if (ownAnchor) return {
      parsed: ownAnchor,
      ambiguous: candidates.length > 1 && (!parsed.major || !parsed.year),
    };
    if (candidates.length === 1 && covers(candidates[0], parsed)) {
      return { parsed: candidates[0], ambiguous: false };
    }
    return { parsed, ambiguous: candidates.length > 1 };
  }

  function resolve(row: ClassRecord): ClassGroup {
    const { parsed, ambiguous } = project(row);
    const key = identity(parsed);
    const existing = groupByKey.get(key);
    if (existing) return existing;
    const label = formatClassName(parsed) || "未填写班级";
    const group = {
      key,
      label: ambiguous ? `${label}（待确认）` : label,
      aliases: [] as string[],
      count: 0,
      ambiguous,
    };
    groupByKey.set(key, group);
    parsedByKey.set(key, parsed);
    return group;
  }

  for (const row of records) {
    const group = resolve(row);
    group.count += 1;
    if (!group.aliases.includes(row.class_name)) group.aliases.push(row.class_name);
  }
  const groups = [...groupByKey.values()].sort((a, b) =>
    a.label.localeCompare(b.label, "zh-CN", { numeric: true }));
  for (const group of groups) group.aliases.sort((a, b) => a.localeCompare(b, "zh-CN"));

  function matches(row: ClassRecord, query: string): boolean {
    const trimmed = String(query ?? "").trim();
    if (!trimmed) return true;
    const group = resolve(row);
    if (trimmed.startsWith("class:") || trimmed.startsWith("raw:")) return group.key === trimmed;
    const wanted = describeWithCatalog({ class_name: trimmed.replace(/（待确认）$/, "") });
    const actual = parsedByKey.get(group.key)!;
    if (wanted.number) {
      // Use the resolved cohort, not a substring of the raw name: searching a named
      // class must never silently include unresolved "54班" from other majors.
      return wanted.number === actual.number
        && (!wanted.major || wanted.major === actual.major)
        && (!wanted.year || wanted.year === actual.year);
    }
    const keyword = normalizeMajor(trimmed);
    return compact(group.label).includes(keyword)
      || group.aliases.some(alias => compact(alias).includes(keyword));
  }

  return { groups, resolve, matches };
}
