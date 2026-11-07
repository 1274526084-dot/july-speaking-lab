'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const { test } = require('node:test');

const sourcePath = path.resolve(
  __dirname,
  '../mainland/src/word-import.ts',
);
const typescriptPath = 'typescript';

let parser;
function parse(text) {
  if (!parser) {
    const ts = require(typescriptPath);
    const source = fs.readFileSync(sourcePath, 'utf8');
    const output = ts.transpileModule(source, {
      fileName: sourcePath,
      compilerOptions: {
        target: ts.ScriptTarget.ES2020,
        module: ts.ModuleKind.CommonJS,
      },
      reportDiagnostics: true,
    });
    const errors = (output.diagnostics || []).filter(
      (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error,
    );
    assert.equal(
      errors.length,
      0,
      errors
        .map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'))
        .join('\n'),
    );
    const loadedModule = { exports: {} };
    const context = vm.createContext({
      module: loadedModule,
      exports: loadedModule.exports,
      require: createRequire(sourcePath),
      console,
    });
    new vm.Script(output.outputText, { filename: sourcePath }).runInContext(context);
    parser = loadedModule.exports.parseWordImport;
    assert.equal(typeof parser, 'function', '真实模块须导出 parseWordImport');
  }
  // The VM has separate Array/Object prototypes; normalize only the returned
  // data so deep equality checks compare the actual public result fields.
  return JSON.parse(JSON.stringify(parser(text)));
}

const entry = (term, meaning = '') => ({ term, meaning });

test('识别截图中的英文词组、空格和中文释义，不再得到0项', () => {
  assert.deepEqual(parse('leave behind 留下\ncareer 职业'), {
    entries: [entry('leave behind', '留下'), entry('career', '职业')],
    rejected: [],
  });
});

test('英文与中文直接相接也能分开', () => {
  assert.deepEqual(parse('remote遥远的\nleave behind留下').entries, [
    entry('remote', '遥远的'),
    entry('leave behind', '留下'),
  ]);
});

test('兼容原有竖线格式及全角竖线', () => {
  assert.deepEqual(parse('carrier | 载体\nleave behind｜留下'), {
    entries: [entry('carrier', '载体'), entry('leave behind', '留下')],
    rejected: [],
  });
});

test('中文圆括号包裹的释义不混入英文词组', () => {
  assert.deepEqual(parse('leave behind（留下）\nremote（遥远的）').entries, [
    entry('leave behind', '留下'),
    entry('remote', '遥远的'),
  ]);
});

test('Excel两列Tab粘贴保留词组与对应释义', () => {
  assert.deepEqual(parse('carrier\t载体\nleave behind\t留下'), {
    entries: [entry('carrier', '载体'), entry('leave behind', '留下')],
    rejected: [],
  });
});

test('中文释义中的中英文逗号和分号完整保留', () => {
  assert.deepEqual(parse('career 职业，生涯；事业\nrespect|尊重,敬意;敬佩'), {
    entries: [entry('career', '职业，生涯；事业'), entry('respect', '尊重,敬意;敬佩')],
    rejected: [],
  });
});

test('纯英文逗号和分号列表仍可批量导入', () => {
  assert.deepEqual(parse('career, remote；respect; dedicate，contribution'), {
    entries: [
      entry('career'),
      entry('remote'),
      entry('respect'),
      entry('dedicate'),
      entry('contribution'),
    ],
    rejected: [],
  });
});

test('空格分隔的多词词组作为一项，不拆成单词', () => {
  assert.deepEqual(
    parse('be pressed for time\nleave a mark on\nenergy storage technology').entries,
    [entry('be pressed for time'), entry('leave a mark on'), entry('energy storage technology')],
  );
});

test('规范曲撇号并保留所有格和缩写', () => {
  assert.deepEqual(parse("one’s life 人的一生\ncan't 不能"), {
    entries: [entry("one's life", '人的一生'), entry("can't", '不能')],
    rejected: [],
  });
});

test('英文词内连字符保留', () => {
  assert.deepEqual(parse('well-being 幸福\nsingle-colored 单色调的').entries, [
    entry('well-being', '幸福'),
    entry('single-colored', '单色调的'),
  ]);
});

test('常见n.和adj.词性标签不被当成待查英文', () => {
  assert.deepEqual(parse('carrier n. 载体\nremote adj. 遥远的'), {
    entries: [entry('carrier', '载体'), entry('remote', '遥远的')],
    rejected: [],
  });
});

test('重复词组按规范化英文去重，后续可补齐首次空释义', () => {
  assert.deepEqual(parse('Career\ncareer 职业\nCAREER|生涯'), {
    entries: [entry('career', '职业')],
    rejected: [],
  });
});

test('拒绝中文说明和未支持IPA行，同时保留有效输入及原行号', () => {
  const heading = '本课重点词汇';
  const ipaLine = 'carrier /ˈkæriə/ 载体';
  assert.deepEqual(parse(`${heading}\n${ipaLine}\nleave behind 留下\nremote 遥远的`), {
    entries: [entry('leave behind', '留下'), entry('remote', '遥远的')],
    rejected: [{ line: 1, text: heading }, { line: 2, text: ipaLine }],
  });
});

test('跳过空行，统一大小写和词组多余空格，兼容CRLF', () => {
  assert.deepEqual(parse(' \r\n  LEAVE   BEHIND   留下  \r\n\r\n remote \r\n'), {
    entries: [entry('leave behind', '留下'), entry('remote')],
    rejected: [],
  });
});

test('带句末标点的英文例句不按空格拆成多个词条', () => {
  const sentence = 'We make good use of our time.';
  assert.deepEqual(parse(`${sentence}\nleave behind 留下`), {
    entries: [entry('leave behind', '留下')],
    rejected: [{ line: 1, text: sentence }],
  });
});

test('保留旧格式支持的复数所有格词组', () => {
  assert.deepEqual(parse("students' union 学生会\nteachers' room 教师办公室").entries, [
    entry("students' union", '学生会'), entry("teachers' room", '教师办公室'),
  ]);
});

test('兼容一行多个竖线词条，同时保留释义内部的中文标点', () => {
  assert.deepEqual(parse('carrier|载体，承载者, remote|遥远的; leave behind｜留下'), {
    entries: [entry('carrier', '载体，承载者'), entry('remote', '遥远的'), entry('leave behind', '留下')],
    rejected: [],
  });
});
