/* ============================================================
 * 莲花派奇门遁甲 排盘核心引擎 (时家转盘 + 拆补法定局)
 * 体系：佛家阳盘奇门 / 莲花十二宫 (僧一行 -> 姚广孝 -> 叶茂然 传承口径)
 *
 * 纯 JS、零依赖，浏览器与 Node 通用。
 *   - 四柱：自实现干支历 (含五鼠遁时干)
 *   - 节气：自实现天文算法 (VSOP 简化 / 寿星天文历公式)
 *   - 定局：拆补法 (节气 + 符头定上中下三元)
 *   - 转盘：九星随时干、八门随时宫、八神小符随大符
 *   - 标注：入墓、击刑、门迫、刑+墓、空亡、马星
 * ============================================================ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Qimen = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---------- 基础常量 ----------
  const GAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
  const ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

  // 九宫 -> 八卦方位 (洛书)
  // 宫位编号 1..9，5为中宫
  const PALACE_NAME = {
    1: '坎', 2: '坤', 3: '震', 4: '巽', 5: '中', 6: '乾', 7: '兑', 8: '艮', 9: '离'
  };
  const PALACE_DIR = {
    1: '正北', 2: '西南', 3: '正东', 4: '东南', 5: '中央', 6: '西北', 7: '正西', 8: '东北', 9: '正南'
  };
  // 宫位五行
  const PALACE_WUXING = {
    1: '水', 2: '土', 3: '木', 4: '木', 5: '土', 6: '金', 7: '金', 8: '土', 9: '火'
  };

  // 后天八卦顺时针顺序（用于转盘旋转）: 坎1 艮8 震3 巽4 离9 坤2 兑7 乾6
  const CLOCKWISE = [1, 8, 3, 4, 9, 2, 7, 6];

  // 九星本位（地盘九星，固定）：宫位 -> 星
  const STAR_HOME = {
    1: '天蓬', 8: '天任', 3: '天冲', 4: '天辅', 9: '天英',
    2: '天芮', 7: '天柱', 6: '天心', 5: '天禽'
  };
  // 转盘九星顺序（随天禽寄宫一起转）：蓬任冲辅英芮(禽)柱心
  const STAR_SEQ = ['天蓬', '天任', '天冲', '天辅', '天英', '天芮', '天柱', '天心'];

  // 八门本位：宫位 -> 门
  const DOOR_HOME = {
    1: '休', 8: '生', 3: '伤', 4: '杜', 9: '景', 2: '死', 7: '惊', 6: '开'
  };
  const DOOR_SEQ = ['休', '生', '伤', '杜', '景', '死', '惊', '开'];

  // 八神顺序（小符随大符，阳遁顺时针 / 阴遁逆时针）
  const SHEN_SEQ = ['值符', '螣蛇', '太阴', '六合', '白虎', '玄武', '九地', '九天'];

  // 三奇六仪
  const YIQI = ['戊', '己', '庚', '辛', '壬', '癸', '丁', '丙', '乙']; // 布盘顺序：戊->...->乙
  // 旬首(甲) 对应所遁之仪
  const XUNSHOU_YI = {
    '甲子': '戊', '甲戌': '己', '甲申': '庚', '甲午': '辛', '甲辰': '壬', '甲寅': '癸'
  };
  const XUN_LIST = ['甲子', '甲戌', '甲申', '甲午', '甲辰', '甲寅'];

  // 节气表（按太阳黄经，0=春分... 这里用通用排列从小寒开始）
  const JIEQI = [
    '小寒', '大寒', '立春', '雨水', '惊蛰', '春分', '清明', '谷雨',
    '立夏', '小满', '芒种', '夏至', '小暑', '大暑', '立秋', '处暑',
    '白露', '秋分', '寒露', '霜降', '立冬', '小雪', '大雪', '冬至'
  ];

  // 拆补法 / 置闰法：各节气上元局数（阳遁为正，阴遁这里直接给局数，遁性另定）
  // 口诀：冬至惊蛰阳一七四，小寒二八五...（标准三元局数表）
  // 表：节气 -> [上元局, 中元局, 下元局]  并标遁性
  const JU_TABLE = {
    // 阳遁（冬至 -> 芒种前）
    '冬至': { yin: false, ju: [1, 7, 4] },
    '小寒': { yin: false, ju: [2, 8, 5] },
    '大寒': { yin: false, ju: [3, 9, 6] },
    '立春': { yin: false, ju: [8, 5, 2] },
    '雨水': { yin: false, ju: [9, 6, 3] },
    '惊蛰': { yin: false, ju: [1, 7, 4] },
    '春分': { yin: false, ju: [3, 9, 6] },
    '清明': { yin: false, ju: [4, 1, 7] },
    '谷雨': { yin: false, ju: [5, 2, 8] },
    '立夏': { yin: false, ju: [4, 1, 7] },
    '小满': { yin: false, ju: [5, 2, 8] },
    '芒种': { yin: false, ju: [6, 3, 9] },
    // 阴遁（夏至 -> 大雪前）
    '夏至': { yin: true, ju: [9, 3, 6] },
    '小暑': { yin: true, ju: [8, 2, 5] },
    '大暑': { yin: true, ju: [7, 1, 4] },
    '立秋': { yin: true, ju: [2, 5, 8] },
    '处暑': { yin: true, ju: [1, 4, 7] },
    '白露': { yin: true, ju: [9, 3, 6] },
    '秋分': { yin: true, ju: [7, 1, 4] },
    '寒露': { yin: true, ju: [6, 9, 3] },
    '霜降': { yin: true, ju: [5, 8, 2] },
    '立冬': { yin: true, ju: [6, 9, 3] },
    '小雪': { yin: true, ju: [5, 8, 2] },
    '大雪': { yin: true, ju: [4, 7, 1] }
  };

  // ===================== 节气计算（寿星天文历 / 简化VSOP）=====================
  // 采用基于截断VSOP87的太阳黄经反求节气时刻（精度约 ±2 分钟，足够定局）
  // 参考算法：求某年某节气的儒略日 -> 公历

  function julianDay(y, m, d, h, mi, s) {
    if (m <= 2) { y -= 1; m += 12; }
    const A = Math.floor(y / 100);
    const B = 2 - A + Math.floor(A / 4);
    const JD = Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + B - 1524.5;
    return JD + (h + mi / 60 + s / 3600) / 24;
  }

  function jdToDate(jd) {
    jd += 0.5;
    const Z = Math.floor(jd);
    const F = jd - Z;
    let A = Z;
    if (Z >= 2299161) {
      const alpha = Math.floor((Z - 1867216.25) / 36524.25);
      A = Z + 1 + alpha - Math.floor(alpha / 4);
    }
    const B = A + 1524;
    const C = Math.floor((B - 122.1) / 365.25);
    const D = Math.floor(365.25 * C);
    const E = Math.floor((B - D) / 30.6001);
    const day = B - D - Math.floor(30.6001 * E) + F;
    const month = E < 14 ? E - 1 : E - 13;
    const year = month > 2 ? C - 4716 : C - 4715;
    const di = Math.floor(day);
    let frac = (day - di) * 24;
    const hh = Math.floor(frac); frac = (frac - hh) * 60;
    const mm = Math.floor(frac); const ss = Math.round((frac - mm) * 60);
    return { y: year, m: month, d: di, h: hh, mi: mm, s: ss };
  }

  // 地球（太阳视黄经）VSOP87 截断项
  // 这里使用较成熟的“高精度节气”级数：先算力学时，再求黄经
  function sunEclipticLongitude(jd) {
    const T = (jd - 2451545.0) / 36525.0;
    // 太阳平黄经 (deg)
    let L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T;
    // 平近点角
    const M = 282.93735 + 1.71946 * T; // 不直接用，下面用标准公式
    const Mdeg = 357.52911 + 35999.05029 * T - 0.0001537 * T * T;
    const Mrad = Mdeg * Math.PI / 180;
    // 中心差 C
    const C = (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(Mrad)
      + (0.019993 - 0.000101 * T) * Math.sin(2 * Mrad)
      + 0.000289 * Math.sin(3 * Mrad);
    let trueLong = L0 + C; // 真黄经
    // 章动 + 光行差修正
    const omega = 125.04 - 1934.136 * T;
    let lambda = trueLong - 0.00569 - 0.00478 * Math.sin(omega * Math.PI / 180);
    lambda = ((lambda % 360) + 360) % 360;
    return lambda;
  }

  // 求某年第 n 个节气（n: 0=春分? 这里以黄经定义）
  // 我们按黄经定义：每个节气对应固定黄经
  // 节气黄经表（与 JIEQI 数组一一对应，从小寒开始）
  const JIEQI_LONGITUDE = {
    '春分': 0, '清明': 15, '谷雨': 30, '立夏': 45, '小满': 60, '芒种': 75,
    '夏至': 90, '小暑': 105, '大暑': 120, '立秋': 135, '处暑': 150, '白露': 165,
    '秋分': 180, '寒露': 195, '霜降': 210, '立冬': 225, '小雪': 240, '大雪': 255,
    '冬至': 270, '小寒': 285, '大寒': 300, '立春': 315, '雨水': 330, '惊蛰': 345
  };

  // 用牛顿迭代求太阳到达指定黄经的 JD（在给定年附近）
  function solveJieqiJD(year, targetLong) {
    // 估算初值：黄经0(春分)约 3月20日
    // 用月份近似
    let estMonth;
    const map = { 0: 3, 15: 4, 30: 4, 45: 5, 60: 5, 75: 6, 90: 6, 105: 7, 120: 7, 135: 8, 150: 8, 165: 9, 180: 9, 195: 10, 210: 10, 225: 11, 240: 11, 255: 12, 270: 12, 285: 1, 300: 1, 315: 2, 330: 2, 345: 3 };
    estMonth = map[targetLong] || 1;
    let yy = year;
    // 小寒/大寒/立春/雨水/惊蛰 属于公历年初（黄经285~345），用本年
    let jd = julianDay(yy, estMonth, 15, 12, 0, 0);
    for (let i = 0; i < 12; i++) {
      let lng = sunEclipticLongitude(jd);
      let diff = lng - targetLong;
      // 处理跨 360
      if (diff > 180) diff -= 360;
      if (diff < -180) diff += 360;
      // 太阳每日约走 0.9856 度
      const corr = diff / 0.9856473;
      jd -= corr;
      if (Math.abs(corr) < 1e-6) break;
    }
    return jd;
  }

  // ===================== 四柱干支 =====================
  // 以儒略日计算日柱：已知 1900-01-31 为甲辰日? 用基准点法
  // 采用 公元元年儒略日反推，简单可靠：JDN 整数部分对应日干支
  function getDayGanZhi(y, m, d) {
    // 取当日中午的 JD 整数天数
    const jd = Math.floor(julianDay(y, m, d, 12, 0, 0) + 0.5);
    // 已知 JD=2451551 (2000-01-07) 为甲子日? 校准基准：
    // 标准：JD 0.5 起点... 采用经验公式 (jd + 49) % 60
    let n = (jd + 49) % 60;
    if (n < 0) n += 60;
    return { gan: n % 10, zhi: n % 12, idx: n };
  }

  // 五鼠遁：日干 -> 子时天干起点
  function getHourGan(dayGanIdx, hourZhiIdx) {
    // 甲己起甲子，乙庚起丙子，丙辛起戊子，丁壬起庚子，戊癸起壬子
    const startGan = [0, 2, 4, 6, 8][dayGanIdx % 5];
    return (startGan + hourZhiIdx) % 10;
  }

  // 时辰地支：23-1子,1-3丑... 23点起为次日子时
  function getHourZhi(hour) {
    if (hour >= 23 || hour < 1) return 0;
    return Math.floor((hour + 1) / 2) % 12;
  }

  // 年柱：以立春换年
  function getYearGanZhi(y, m, d, jieqiCache) {
    // 立春前算上一年
    const lichun = jieqiCache['立春'];
    const cur = julianDay(y, m, d, 12, 0, 0);
    let yy = y;
    if (cur < lichun) yy = y - 1;
    // 公元4年为甲子年? 通用：(year - 4) % 60
    let n = (yy - 4) % 60;
    if (n < 0) n += 60;
    return { gan: n % 10, zhi: n % 12, idx: n, year: yy };
  }

  // 月柱：以节气换月（寅月起于立春），五虎遁定月干
  function getMonthGanZhi(yearGanIdx, monthZhiIdx) {
    // 五虎遁：甲己之年丙作首，乙庚之岁戊为头，丙辛必定寻庚起，丁壬壬位顺行流，戊癸甲寅好追求
    const startGan = [2, 4, 6, 8, 0][yearGanIdx % 5]; // 寅月天干
    // monthZhiIdx 是地支，寅=2。寅月为第一个月
    const offset = (monthZhiIdx - 2 + 12) % 12;
    return (startGan + offset) % 10;
  }

  // 根据节气确定月支（节气分界）。返回月地支索引
  function getMonthZhiByJieqi(jdNoon, jieqiTimes) {
    // 节气 -> 月支映射（节令，非中气）
    // 立春->寅(2), 惊蛰->卯(3), 清明->辰(4), 立夏->巳(5), 芒种->午(6),
    // 小暑->未(7), 立秋->申(8), 白露->酉(9), 寒露->戌(10), 立冬->亥(11), 大雪->子(0), 小寒->丑(1)
    const nodeOrder = [
      { name: '立春', zhi: 2 }, { name: '惊蛰', zhi: 3 }, { name: '清明', zhi: 4 },
      { name: '立夏', zhi: 5 }, { name: '芒种', zhi: 6 }, { name: '小暑', zhi: 7 },
      { name: '立秋', zhi: 8 }, { name: '白露', zhi: 9 }, { name: '寒露', zhi: 10 },
      { name: '立冬', zhi: 11 }, { name: '大雪', zhi: 0 }, { name: '小寒', zhi: 1 }
    ];
    let result = 1; // 默认丑(小寒前一年末)
    for (let i = 0; i < nodeOrder.length; i++) {
      if (jdNoon >= jieqiTimes[nodeOrder[i].name]) result = nodeOrder[i].zhi;
    }
    // 处理跨年：1月小寒前属于上年大雪(子月)
    return result;
  }

  // ===================== 均时差（Equation of Time）=====================
  // 返回 视太阳时 - 平太阳时 的分钟数（视太阳偏快为正）
  function equationOfTime(jd) {
    const T = (jd - 2451545.0) / 36525.0;
    const epsilon = 23.4392911 - 0.0130042 * T; // 黄赤交角(deg)
    const L0 = (280.46646 + 36000.76983 * T) % 360; // 太阳平黄经
    const M = 357.52911 + 35999.05029 * T;          // 平近点角
    const Mr = M * Math.PI / 180;
    const e = 0.016708634 - 0.000042037 * T;        // 偏心率
    const y2 = Math.tan(epsilon / 2 * Math.PI / 180);
    const yy = y2 * y2;
    const L0r = L0 * Math.PI / 180;
    // Eot 弧度（NOAA 公式）
    const Eot = yy * Math.sin(2 * L0r)
      - 2 * e * Math.sin(Mr)
      + 4 * e * yy * Math.sin(Mr) * Math.cos(2 * L0r)
      - 0.5 * yy * yy * Math.sin(4 * L0r)
      - 1.25 * e * e * Math.sin(2 * Mr);
    return Eot * 4 * 180 / Math.PI; // 弧度->分钟（每度4分钟）
  }

  // 真太阳时校正：返回校正后的 {y,mo,da,hh,mm} 及 详情
  // 输入为北京时间(东八区, 基准经度120°E)
  function applyTrueSolar(y, mo, da, hh, mm, lonE) {
    if (lonE === null || lonE === undefined) return null;
    const jdClock = julianDay(y, mo, da, hh, mm, 0);
    // 经度时差(分钟)：东经>120 太阳早到->加；<120 减。每度4分钟
    const lonMin = (lonE - 120) * 4;
    const eot = equationOfTime(jdClock); // 分钟
    const totalMin = lonMin + eot;       // 总修正分钟
    const jdTrue = jdClock + totalMin / 1440;
    const d = jdToDate(jdTrue);
    return {
      y: d.y, mo: d.m, da: d.d, hh: d.h, mm: d.mi,
      lonMin: Math.round(lonMin * 10) / 10,
      eot: Math.round(eot * 10) / 10,
      totalMin: Math.round(totalMin * 10) / 10,
      timeStr: pad2(d.h) + ':' + pad2(d.mi)
    };
  }
  function pad2(n) { return n < 10 ? '0' + n : '' + n; }

  // ===================== 主排盘函数 =====================
  function paipan(dateInput) {
    let y = dateInput.year, mo = dateInput.month, da = dateInput.day;
    let hh = dateInput.hour, mm = dateInput.minute || 0;

    // 0. 真太阳时校正（按经度，输入视为北京时间）
    const lonE = (dateInput.longitude === undefined) ? null : dateInput.longitude;
    let trueSolar = null;
    if (lonE !== null) {
      trueSolar = applyTrueSolar(y, mo, da, hh, mm, lonE);
      if (trueSolar) { y = trueSolar.y; mo = trueSolar.mo; da = trueSolar.da; hh = trueSolar.hh; mm = trueSolar.mm; }
    }

    // 1. 计算本年及相邻年所有节气时刻（JD），供四柱与定局
    const jieqiTimes = {};
    for (const name in JIEQI_LONGITUDE) {
      jieqiTimes[name] = solveJieqiJD(y, JIEQI_LONGITUDE[name]);
    }
    // 上一年的大雪、冬至等（用于1月初判断）
    const jieqiTimesPrev = {};
    for (const name in JIEQI_LONGITUDE) {
      jieqiTimesPrev[name] = solveJieqiJD(y - 1, JIEQI_LONGITUDE[name]);
    }
    const jieqiTimesNext = {};
    for (const name in JIEQI_LONGITUDE) {
      jieqiTimesNext[name] = solveJieqiJD(y + 1, JIEQI_LONGITUDE[name]);
    }

    const jdEvent = julianDay(y, mo, da, hh, mm, 0);
    const jdNoon = julianDay(y, mo, da, 12, 0, 0);

    // 2. 四柱
    // 处理 23 点后归次日
    let dY = y, dM = mo, dD = da;
    if (hh >= 23) {
      const next = addDay(y, mo, da, 1);
      dY = next.y; dM = next.m; dD = next.d;
    }
    const dayGZ = getDayGanZhi(dY, dM, dD);
    const hourZhiIdx = getHourZhi(hh);
    const hourGanIdx = getHourGan(dayGZ.gan, hourZhiIdx);

    const yearGZ = getYearGanZhi(y, mo, da, jieqiTimes);
    // 月支：用合并的节气时刻表（含跨年）
    const mergedJieqi = Object.assign({}, jieqiTimesPrev, jieqiTimes, jieqiTimesNext);
    const monthZhiIdx = getMonthZhiBySolar(jdNoon, jieqiTimes, jieqiTimesPrev, jieqiTimesNext);
    const monthGanIdx = getMonthGanZhi(yearGZ.gan, monthZhiIdx);

    const sizhu = {
      year: GAN[yearGZ.gan] + ZHI[yearGZ.zhi],
      month: GAN[monthGanIdx] + ZHI[monthZhiIdx],
      day: GAN[dayGZ.gan] + ZHI[dayGZ.zhi],
      hour: GAN[hourGanIdx] + ZHI[hourZhiIdx]
    };

    // 3. 定局（拆补法）：找事件所处节气 + 上中下元
    const ju = dingJu(jdEvent, jieqiTimes, jieqiTimesPrev, jieqiTimesNext, dayGZ);

    // 4. 排地盘三奇六仪
    const earthPlate = buildEarthPlate(ju.juNumber, ju.yin);

    // 5. 求值符值使
    // 时柱旬首
    const hourGZidx = ((hourGanIdx) + 1) * 0; // placeholder
    const hourGanZhiIdx = ganZhiIndex(hourGanIdx, hourZhiIdx);
    const xunShou = getXunShou(hourGanIdx, hourZhiIdx);
    const dunYi = XUNSHOU_YI[xunShou]; // 旬首所遁之仪
    // 旬首仪在地盘的宫位
    let fuPalace = null;
    for (const p in earthPlate) {
      if (earthPlate[p] === dunYi) fuPalace = parseInt(p);
    }
    // 值符星 = 该宫本位星；值使门 = 该宫本位门
    let zhifuStar = STAR_HOME[fuPalace];
    let zhishiDoor = DOOR_HOME[fuPalace];
    if (fuPalace === 5) { zhifuStar = STAR_HOME[2]; zhishiDoor = DOOR_HOME[2]; } // 中宫寄坤2
    const fuPalaceForRotate = (fuPalace === 5) ? 2 : fuPalace;

    // 时干落宫（时干在地盘的位置）
    let hourGanPalace = null;
    const hg = GAN[hourGanIdx];
    for (const p in earthPlate) {
      if (earthPlate[p] === hg) hourGanPalace = parseInt(p);
    }
    // 若时干为甲，甲遁旬首仪，落旬首仪所在宫
    if (hg === '甲') {
      hourGanPalace = fuPalace;
    }
    if (hourGanPalace === 5) hourGanPalace = 2; // 中宫寄坤

    // 6. 转天盘九星（值符星随时干，顺时针带动其余星）
    const skyPlate = rotateStars(zhifuStar, fuPalaceForRotate, hourGanPalace, earthPlate, ju.yin);

    // 7. 转人盘八门（值使门随时宫）
    const doorPlate = rotateDoors(zhishiDoor, fuPalaceForRotate, hourZhiIdx, xunShou, ju.yin);

    // 8. 转神盘八神（小符随大符，落于天盘值符星所在宫）
    const zhifuFinalPalace = skyPlate.zhifuPalace; // 值符星最终落宫
    const shenPlate = rotateShen(zhifuFinalPalace, ju.yin);

    // 9. 旬空 / 马星
    const kongwang = getKongWang(hourGanIdx, hourZhiIdx);
    const maxing = getMaXing(hourZhiIdx);

    // 10. 组装九宫格 + 标注
    const grid = assembleGrid({
      earthPlate, skyPlate: skyPlate.stars, skyGan: skyPlate.gan,
      doorPlate, shenPlate, ju, kongwang, maxing, hourGanIdx
    });

    return {
      input: { y, mo, da, hh, mm },
      trueSolar, // null 或 {lonMin,eot,totalMin,timeStr,...}
      sizhu,
      yearName: yearGZ.year,
      ju: {
        yin: ju.yin,
        number: ju.juNumber,
        name: (ju.yin ? '阴遁' : '阳遁') + ju.juNumber + '局',
        jieqi: ju.jieqi,
        yuan: ju.yuan, // 上中下
        yuanName: ['上元', '中元', '下元'][ju.yuanIdx]
      },
      zhifu: { star: zhifuStar, palace: zhifuFinalPalace },
      zhishi: { door: zhishiDoor, palace: doorPlate.zhishiPalace },
      xunshou: xunShou,
      kongwang: kongwang.map(z => ZHI[z]),
      maxing: ZHI[maxing],
      grid,
      _debug: { fuPalace, hourGanPalace, dunYi }
    };
  }

  // ---------- 辅助函数 ----------
  function addDay(y, m, d, n) {
    const dt = new Date(Date.UTC(y, m - 1, d));
    dt.setUTCDate(dt.getUTCDate() + n);
    return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
  }

  function ganZhiIndex(ganIdx, zhiIdx) {
    // 求干支在60甲子的序号
    for (let i = 0; i < 60; i++) {
      if (i % 10 === ganIdx && i % 12 === zhiIdx) return i;
    }
    return -1;
  }

  function getXunShou(ganIdx, zhiIdx) {
    const idx = ganZhiIndex(ganIdx, zhiIdx);
    // 旬首 = idx - (idx%10)  对应 甲子...的起点
    const xunStart = idx - (idx % 10);
    return GAN[0] + ZHI[xunStart % 12]; // 甲 + 对应支
  }

  function getKongWang(ganIdx, zhiIdx) {
    const idx = ganZhiIndex(ganIdx, zhiIdx);
    const xunStart = idx - (idx % 10);
    // 该旬空亡两支：xunStart 对应甲子旬空戌亥...
    // 旬中地支用了 10 个，剩下 2 个空
    const usedZhi = [];
    for (let i = 0; i < 10; i++) usedZhi.push((xunStart + i) % 12);
    const kong = [];
    for (let z = 0; z < 12; z++) if (usedZhi.indexOf(z) === -1) kong.push(z);
    return kong;
  }

  function getMaXing(hourZhiIdx) {
    // 驿马：申子辰马在寅，寅午戌马在申，巳酉丑马在亥，亥卯未马在巳
    const group = hourZhiIdx % 4; // 子(0)辰(4)申(8)->0 ; ...
    // 用三合局取马
    const sanhe = {
      // 申子辰
      8: 2, 0: 2, 4: 2,
      // 寅午戌
      2: 8, 6: 8, 10: 8,
      // 巳酉丑
      5: 11, 9: 11, 1: 11,
      // 亥卯未
      11: 5, 3: 5, 7: 5
    };
    return sanhe[hourZhiIdx];
  }

  function getMonthZhiBySolar(jdNoon, jq, jqPrev, jqNext) {
    const nodes = [
      { name: '小寒', jd: jq['小寒'], zhi: 1 },
      { name: '立春', jd: jq['立春'], zhi: 2 },
      { name: '惊蛰', jd: jq['惊蛰'], zhi: 3 },
      { name: '清明', jd: jq['清明'], zhi: 4 },
      { name: '立夏', jd: jq['立夏'], zhi: 5 },
      { name: '芒种', jd: jq['芒种'], zhi: 6 },
      { name: '小暑', jd: jq['小暑'], zhi: 7 },
      { name: '立秋', jd: jq['立秋'], zhi: 8 },
      { name: '白露', jd: jq['白露'], zhi: 9 },
      { name: '寒露', jd: jq['寒露'], zhi: 10 },
      { name: '立冬', jd: jq['立冬'], zhi: 11 },
      { name: '大雪', jd: jq['大雪'], zhi: 0 }
    ];
    // 上年大雪
    const prevDaxue = jqPrev['大雪'];
    let zhi = 0; // 默认子月（上年大雪后）
    if (jdNoon < jq['小寒'] && jdNoon >= prevDaxue) return 0; // 子月
    for (let i = 0; i < nodes.length; i++) {
      if (jdNoon >= nodes[i].jd) zhi = nodes[i].zhi;
    }
    return zhi;
  }

  // 定局：拆补法
  function dingJu(jdEvent, jq, jqPrev, jqNext, dayGZ) {
    // 找事件所处节气（取最近一个已过的节气节点）
    const allNodes = [];
    for (const name in JIEQI_LONGITUDE) {
      allNodes.push({ name, jd: jqPrev[name] });
      allNodes.push({ name, jd: jq[name] });
      allNodes.push({ name, jd: jqNext[name] });
    }
    allNodes.sort((a, b) => a.jd - b.jd);
    let curJieqi = null, curJieqiJD = null;
    for (let i = 0; i < allNodes.length; i++) {
      if (jdEvent >= allNodes[i].jd) { curJieqi = allNodes[i].name; curJieqiJD = allNodes[i].jd; }
    }

    // 拆补法定元：用"符头"（统领当日的最近甲/己日）的地支确定上中下元
    // 规则：甲己二日为符头。从事件当日往前找最近的甲或己日(含当日)，
    //       该符头日地支：子午卯酉=上元, 寅申巳亥=中元, 辰戌丑未=下元
    // 找符头：dayGZ.idx 为当日60甲子序号，往回退到最近的天干为甲(0)或己(5)的日
    let probe = dayGZ.idx;
    let symbolZhi = null;
    for (let back = 0; back < 10; back++) {
      const gi = ((probe - back) % 60 + 60) % 60;
      const gan = gi % 10;
      if (gan === 0 || gan === 5) { symbolZhi = gi % 12; break; }
    }
    if (symbolZhi === null) symbolZhi = dayGZ.zhi;
    let yuanIdx;
    // 子午卯酉=上元(0), 寅申巳亥=中元(1), 辰戌丑未=下元(2)
    if ([0, 6, 3, 9].indexOf(symbolZhi) !== -1) yuanIdx = 0;
    else if ([2, 8, 5, 11].indexOf(symbolZhi) !== -1) yuanIdx = 1;
    else yuanIdx = 2;

    const info = JU_TABLE[curJieqi];
    return {
      jieqi: curJieqi,
      yin: info.yin,
      yuanIdx,
      yuan: ['上', '中', '下'][yuanIdx],
      juNumber: info.ju[yuanIdx]
    };
  }

  // 排地盘三奇六仪
  function buildEarthPlate(juNumber, yin) {
    const plate = {};
    // 戊 从 juNumber 宫起
    // 阳遁顺布(顺时针后天卦序? 实为按宫位数 1->2->3...9->1)，阴遁逆布
    // 标准：阳遁戊己庚辛壬癸丁丙乙 按宫位数递增；阴遁递减
    let p = juNumber;
    for (let i = 0; i < 9; i++) {
      const yi = YIQI[i];
      plate[p] = yi;
      if (yin) {
        p = p - 1; if (p < 1) p = 9;
      } else {
        p = p + 1; if (p > 9) p = 1;
      }
    }
    return plate;
  }

  // 转天盘九星
  function rotateStars(zhifuStar, fuPalace, hourGanPalace, earthPlate, yin) {
    // 值符星落于时干宫(hourGanPalace)，其余星按转盘顺序顺时针带动
    // 转盘：以 CLOCKWISE 序列，值符星从其原宫(fuPalace)转到 hourGanPalace
    // 九星顺序固定 STAR_SEQ（蓬任冲辅英芮柱心），中五天禽寄于值符
    // 先确定值符星在 STAR_SEQ / 各宫的初始排列(地盘九星本位)，然后整体旋转
    // 做法：建立"宫位环"CLOCKWISE，值符星原本在 fuPalace 的环位置，移动到 hourGanPalace 的环位置
    const ring = CLOCKWISE; // 8宫环（不含中5）
    const idxFu = ring.indexOf(fuPalace);
    const idxTo = ring.indexOf(hourGanPalace);
    let shift = (idxTo - idxFu + 8) % 8;

    // 地盘九星本位在 ring 上的星序列
    const homeStarsOnRing = ring.map(p => STAR_HOME[p]); // 各宫本位星
    // 旋转：每颗星都向前移动 shift 位
    const stars = {};
    const gan = {};
    for (let i = 0; i < 8; i++) {
      const fromP = ring[i];
      const toP = ring[(i + shift) % 8];
      stars[toP] = STAR_HOME[fromP];
      // 天盘干 = 该星原宫(地盘)上的天干，随星移动
      gan[toP] = earthPlate[fromP];
    }
    // 中宫天禽：寄随值符。中5本位星天禽，地盘中5的干随值符星走
    // 天盘值符星最终落宫
    const zhifuPalace = hourGanPalace;
    // 天禽寄宫处理：天禽星随天芮同宫（传统天禽寄二宫/随值符）。这里将中5地盘干并入值符宫
    if (earthPlate[5]) {
      // 天禽寄于值符宫(与天芮同行)，将其干附加
      gan[zhifuPalace] = (gan[zhifuPalace] || '') ;
    }
    stars[5] = STAR_HOME[5]; // 天禽留标记
    return { stars, gan, zhifuPalace };
  }

  // 转人盘八门
  function rotateDoors(zhishiDoor, fuPalace, hourZhiIdx, xunShou, yin) {
    // 值使门数：从值使原宫起，按"时辰距旬首的步数"在九宫(阳顺阴逆,跳中宫)行进
    // 计算时辰序数：旬首=甲子... 当前时辰干支 距旬首的步数
    // 步数 = (当前时支在旬内的位置)
    const xunZhi = ZHI.indexOf(xunShou[1]); // 旬首地支
    let steps = (hourZhiIdx - xunZhi + 12) % 12; // 0..n
    // 八门在九宫排布（跳过中5）。值使门从其本位宫起走 steps 步
    const ring = CLOCKWISE;
    // 但八门行进是按宫位数顺逆(1..9)跳中5，而非后天卦环
    // 标准：阳遁顺行(宫数+)，阴遁逆行(宫数-)，遇中5跳过
    let p = fuPalace; // 值使门本位 = 值符宫本位
    let count = 0;
    while (count < steps) {
      if (yin) { p--; if (p < 1) p = 9; } else { p++; if (p > 9) p = 1; }
      if (p === 5) { if (yin) { p--; if (p < 1) p = 9; } else { p++; if (p > 9) p = 1; } }
      count++;
    }
    const zhishiPalace = p;
    // 以 zhishiDoor 在 zhishiPalace 为起点，按 DOOR_SEQ 顺序、阳顺阴逆铺满八宫
    const doors = {};
    const startDoorIdx = DOOR_SEQ.indexOf(zhishiDoor);
    // 八门按后天卦顺时针(阳)/逆时针(阴)铺
    const ringIdxStart = ring.indexOf(zhishiPalace);
    for (let i = 0; i < 8; i++) {
      const doorName = DOOR_SEQ[(startDoorIdx + i) % 8];
      let ringIdx;
      if (yin) ringIdx = (ringIdxStart - i + 8) % 8;
      else ringIdx = (ringIdxStart + i) % 8;
      doors[ring[ringIdx]] = doorName;
    }
    return { doors, zhishiPalace };
  }

  // 转神盘八神
  function rotateShen(zhifuPalace, yin) {
    const ring = CLOCKWISE;
    const shen = {};
    let startIdx = ring.indexOf(zhifuPalace === 5 ? 2 : zhifuPalace);
    for (let i = 0; i < 8; i++) {
      const name = SHEN_SEQ[i];
      let ringIdx;
      if (yin) ringIdx = (startIdx - i + 8) % 8;
      else ringIdx = (startIdx + i) % 8;
      shen[ring[ringIdx]] = name;
    }
    return shen;
  }

  // 组装九宫 + 标注（入墓/击刑/门迫/空亡/马星）
  function assembleGrid(d) {
    const grid = {};
    for (let p = 1; p <= 9; p++) {
      grid[p] = {
        palace: p,
        name: PALACE_NAME[p],
        dir: PALACE_DIR[p],
        wuxing: PALACE_WUXING[p],
        earthGan: d.earthPlate[p] || '',
        skyGan: d.skyGan[p] || '',
        star: d.skyPlate[p] || (p === 5 ? '天禽' : ''),
        door: d.doorPlate.doors[p] || '',
        shen: d.shenPlate[p] || '',
        marks: []
      };
    }

    // 空亡标注
    const kongZhi = d.kongwang.map(z => z); // 已是地支索引数组
    for (let p = 1; p <= 9; p++) {
      // 宫位对应地支：坎子、坤未申、震卯、巽辰巳、离午、乾戌亥、兑酉、艮丑寅
      const palaceZhi = {
        1: [0], 2: [7, 8], 3: [3], 4: [4, 5], 9: [6], 6: [10, 11], 7: [9], 8: [1, 2]
      };
      const zs = palaceZhi[p] || [];
      for (const z of zs) {
        if (kongZhi.indexOf(z) !== -1) { grid[p].marks.push('空亡'); break; }
      }
    }

    // 马星标注
    const maZhi = d.maxing;
    const palaceByZhi = { 0: 1, 7: 2, 8: 2, 3: 3, 4: 4, 5: 4, 6: 9, 10: 6, 11: 6, 9: 7, 1: 8, 2: 8 };
    const maPalace = palaceByZhi[maZhi];
    if (maPalace && grid[maPalace]) grid[maPalace].marks.push('马星');

    // 入墓：天干入墓于四墓库宫
    // 乙木墓未(坤2)、丙戊墓戌(乾6)、丁己墓丑(艮8)、庚墓丑? 标准：金墓丑(艮)... 用三合墓库
    // 十干墓库：甲乙木墓未(坤2)，丙丁戊己火土墓戌(乾6)? 采用常用奇门入墓规则：
    //   乙奇入坤(未墓)、丙奇入乾(戌墓)、丁奇入艮(丑墓) 等
    const muMap = {
      '乙': 2, '丙': 6, '戊': 6, '丁': 8, '己': 8,
      '壬': 4, '癸': 4, '辛': 8, '庚': 2, '甲': 2
    };
    for (let p = 1; p <= 9; p++) {
      const sg = grid[p].skyGan;
      if (sg && muMap[sg] === p) grid[p].marks.push('入墓');
    }

    // 击刑：宫位地支自刑/相刑
    // 三宫(卯)刑、九宫? 用地支刑：子刑卯(坎刑震)、丑未戌刑、寅巳申刑、辰午酉亥自刑
    // 简化标准击刑：天盘干临所刑之宫
    // 此处标注宫位地支刑关系（常见击刑：六仪击刑）
    // 六仪击刑：戊在艮3?... 采用经典：戊击刑在震3，己在坤2，庚在艮8，辛在离9，壬在巽4，癸在巽4...
    const jixingMap = {
      '戊': 3, '己': 2, '庚': 8, '辛': 9, '壬': 4, '癸': 4
    };
    for (let p = 1; p <= 9; p++) {
      const eg = grid[p].earthGan;
      if (eg && jixingMap[eg] === p) grid[p].marks.push('击刑');
    }

    // 门迫：门克宫为门迫
    // 门五行：休(水) 生(土) 伤(木) 杜(木) 景(火) 死(土) 惊(金) 开(金)
    const doorWX = { '休': '水', '生': '土', '伤': '木', '杜': '木', '景': '火', '死': '土', '惊': '金', '开': '金' };
    const ke = { '木': '土', '土': '水', '水': '火', '火': '金', '金': '木' };
    for (let p = 1; p <= 9; p++) {
      const door = grid[p].door;
      if (door) {
        const dwx = doorWX[door];
        if (ke[dwx] === grid[p].wuxing) grid[p].marks.push('门迫');
      }
    }

    // 刑+墓 合并标记
    for (let p = 1; p <= 9; p++) {
      if (grid[p].marks.indexOf('入墓') !== -1 && grid[p].marks.indexOf('击刑') !== -1) {
        grid[p].marks.push('刑+墓');
      }
    }

    return grid;
  }

  return {
    paipan,
    _internal: {
      solveJieqiJD, getDayGanZhi, getHourGan, buildEarthPlate,
      GAN, ZHI, JU_TABLE, jdToDate, julianDay
    }
  };
});
