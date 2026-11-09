const { CLASS_CATALOG, DEFAULT_CLASS } = require('./class-catalog');

function includeZhaiAssignments(assignments) {
  if (Array.isArray(assignments.zhai)) return assignments;
  const assigned = new Set(Object.values(assignments).flat());
  return { ...assignments, zhai: CLASS_CATALOG.filter(label => label !== DEFAULT_CLASS && !assigned.has(label)) };
}

const DEFAULT_ASSIGNMENTS = Object.freeze(includeZhaiAssignments({
  july: ['26-储能技术01班', '26-城轨信号54班', '26-城轨信号53班', '26-机车125班', '26-机车124班'],
  lisa: ['26-人工智能16班', '26-测量04班', '26-铁工85班', '26-铁工84班', '26-机车123班', '26-机车122班'],
  alice: ['26-运营116班', '26-新能源汽车33班', '26-新能源汽车32班', '26-智控08班', '26-电气69班', '26-电气68班'],
  cherie: ['26-车辆68班', '26-车辆69班', '26-城轨车辆58班', '26-人工智能15班', '26-城轨运营68班', '26-城轨运营69班'],
}));
const DISPLAY_NAMES = Object.freeze({ july: 'July · 罗钧霖', lisa: 'Lisa · 李思', alice: 'Alice · 汤爱丽', cherie: 'Cherie · 颜钰', zhai: 'Zhai · 翟雪丽' });
module.exports = { DEFAULT_ASSIGNMENTS, DISPLAY_NAMES, includeZhaiAssignments };
