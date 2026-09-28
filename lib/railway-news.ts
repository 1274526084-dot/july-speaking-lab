export type RailwayNewsSeed = {
  id: string;
  title: string;
  summary: string;
  url: string;
  source: string;
  publishedDate: string;
  checkedAt: string;
  vocabulary: { word: string; meaning: string }[];
  question: string;
  status: "draft";
};

/**
 * Dated source suggestions for teacher review, not an automatically updated feed.
 * A teacher must review the linked source and explicitly publish each item.
 * publishedDate is the article date; checkedAt is the source-check date.
 */
export const RAILWAY_NEWS_SEEDS: RailwayNewsSeed[] = [
  {
    id: "ecrl-testing-20260918",
    title: "马东铁推进测试，为运营做准备",
    summary:
      "马来西亚 RTM 于 9 月 18 日报道，马东铁正使用综合检测列车进行测试。项目团队争取将运营提前至 2026 年 12 月，但日期仍须以交通部最终决定和正式公告为准。",
    url: "https://berita.rtm.gov.my/nasional/senarai-berita-nasional/senarai-artikel/ecrl-dijangka-memulakan-operasi-seawal-pertengahan-disember/",
    source: "马来西亚广播电视台 RTM",
    publishedDate: "2026-09-18",
    checkedAt: "2026-09-28",
    vocabulary: [
      { word: "inspection", meaning: "检查；检测" },
      { word: "passenger service", meaning: "客运服务" },
      { word: "safety", meaning: "安全" },
    ],
    question:
      "Why should a railway team test a new line before passenger services start?",
    status: "draft",
  },
  {
    id: "ningbo-regional-rail-20260923",
    title: "宁波跨海市域铁路开通，连接城市与半岛",
    summary:
      "交通运输部 9 月 23 日发布消息：宁波轨道交通 12 号线已于 9 月 22 日开通。线路连接宁波中心城区与象山半岛，全长 61.45 公里，设 10 座车站，为沿线通勤提供新选择。",
    url: "https://www.mot.gov.cn/xinwen/tupianxinwen/202609/t20260923_4224766.html",
    source: "中华人民共和国交通运输部",
    publishedDate: "2026-09-23",
    checkedAt: "2026-09-28",
    vocabulary: [
      { word: "commute", meaning: "通勤" },
      { word: "station", meaning: "车站" },
      { word: "connect", meaning: "连接" },
    ],
    question:
      "How can a new railway line make daily travel easier for local people?",
    status: "draft",
  },
  {
    id: "uic-tourism-study-20260923",
    title: "国际铁路联盟：区域铁路如何支持旅游",
    summary:
      "国际铁路联盟 9 月 23 日介绍了一项比较研究，关注葡萄牙杜罗线与意大利卢卡—奥拉线。研究讨论旅游如何帮助维护客流较少的区域铁路，以及铁路如何支持当地发展与可持续旅游。",
    url: "https://uic.org/com/enews/article/now-available-tour-rail-s-comparative-analysis-of-the-douro-and-lucca-aulla",
    source: "国际铁路联盟 UIC",
    publishedDate: "2026-09-23",
    checkedAt: "2026-09-28",
    vocabulary: [
      { word: "regional railway", meaning: "区域铁路" },
      { word: "tourism", meaning: "旅游业" },
      { word: "local community", meaning: "当地社区" },
    ],
    question:
      "What would you tell a visitor about a town they can reach by train?",
    status: "draft",
  },
];
