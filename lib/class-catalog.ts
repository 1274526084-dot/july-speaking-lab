/** School roster confirmed by the teacher's screenshot and existing classes. */
export const DEFAULT_CLASS = '默认班级（测试）';
export const DEFAULT_COLLEGE = '默认学院（测试）';
export const COLLEGE_CLASSES: Readonly<Record<string, readonly string[]>> = {
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
  [DEFAULT_COLLEGE]: [DEFAULT_CLASS],
};
export const SCHOOL_COLLEGES = Object.keys(COLLEGE_CLASSES);
export const CLASS_CATALOG: readonly string[] =
  Object.values(COLLEGE_CLASSES).flat();
export function collegeForClass(className: string): string {
  return (
    SCHOOL_COLLEGES.find((college) =>
      COLLEGE_CLASSES[college].includes(className),
    ) || DEFAULT_COLLEGE
  );
}
