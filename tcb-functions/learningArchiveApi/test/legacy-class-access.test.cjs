const test = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');

for (const service of ['wordLabApi', 'speakingLabApi']) {
  test(`${service} only exposes assigned classes and reads verified roster mappings`, async () => {
    const { archiveClassAccess } = require(`../../${service}/archive-class-access`);
    const collection = service === 'wordLabApi' ? 'word_attempts' : 'speaking_attempts';
    const row = { id: 'record-1', student_name: '李同学', class_name: '默认班级' };
    const hash = createHash('sha256').update(JSON.stringify(row)).digest('hex');
    const mapping = { project_id: 'lzrtc-public-english-2026', kind: 'roster-reassignment', source_collection: collection, source_id: row.id, source_fingerprint: hash, identity_name: '李同学', class_name: '26-人工智能16班' };
    const db = { collection() { return {
      doc() { return { async get() { return { data: null }; } }; },
      where() { return { limit() { return { async get() { return { data: [mapping] }; } }; } }; },
    }; } };
    const access = await archiveClassAccess(db);
    assert.equal(access.className(row, collection), '26-人工智能16班');
    assert.equal(access.canSee('lisa', row, collection), true);
    assert.equal(access.canSee('cherie', row, collection), false);
    assert.equal(access.canSee('july', row, collection), true);
    assert.equal(access.canSee('lisa', { ...row, student_name: '另一位同学' }, collection), false);
  });
}
