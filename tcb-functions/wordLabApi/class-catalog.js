/* Generated from lib/class-catalog.ts. */
/* oxlint-disable typescript/no-require-imports */
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CLASS_CATALOG = exports.SCHOOL_COLLEGES = exports.COLLEGE_CLASSES = exports.DEFAULT_COLLEGE = exports.DEFAULT_CLASS = void 0;
exports.collegeForClass = collegeForClass;
/** School roster confirmed by the teacher's screenshot and existing classes. */
exports.DEFAULT_CLASS = '默认班级（测试）';
exports.DEFAULT_COLLEGE = '默认学院（测试）';
exports.COLLEGE_CLASSES = {
    汽车与新能源学院: [
        '26-储能技术01班',
        '26-新能源汽车32班',
        '26-新能源汽车33班',
    ],
    人工智能及机器人学院: [
        '26-人工智能15班',
        '26-人工智能16班',
        '26-无人机1班',
        '26-无人机2班',
    ],
    铁道工程学院: ['26-测量04班', '26-铁工84班', '26-铁工85班'],
    铁道机车车辆学院: [
        '26-机车122班',
        '26-机车123班',
        '26-机车124班',
        '26-机车125班',
        '26-车辆68班',
        '26-车辆69班',
        '26-城轨车辆58班',
    ],
    铁道通信信号学院: ['26-城轨信号53班', '26-城轨信号54班'],
    铁道运输管理学院: [
        '26-运营116班',
        '26-城轨运营68班',
        '26-城轨运营69班',
        '26-酒店6班',
    ],
    智能制造学院: [
        '26-智控08班',
        '26-电气68班',
        '26-电气69班',
        '26-机电37班',
        '26-机电38班',
    ],
    [exports.DEFAULT_COLLEGE]: [exports.DEFAULT_CLASS],
};
exports.SCHOOL_COLLEGES = Object.keys(exports.COLLEGE_CLASSES);
exports.CLASS_CATALOG = Object.values(exports.COLLEGE_CLASSES).flat();
function collegeForClass(className) {
    return (exports.SCHOOL_COLLEGES.find((college) => exports.COLLEGE_CLASSES[college].includes(className)) || exports.DEFAULT_COLLEGE);
}
