// src/parser.js — 自然语言日程解析（ESM）
// parseMessage(text, now) => { date:'YYYY-MM-DD', time:'HH:MM'|null, title, note:string|null, raw }

function pad(n) { return n < 10 ? '0' + n : '' + n; }

export function formatDate(d) {
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}

// 时段前缀 -> 小时换算（12 小时制转 24 小时制）
function hourWithPeriod(period, hour) {
  if (period === '下午' || period === '晚上') {
    return hour < 12 ? hour + 12 : hour;
  }
  if (period === '中午') {
    return hour === 12 ? 12 : hour; // 中午12点=12:00
  }
  // 上午 / 早上 / 清晨 / 无前缀：保持
  if (hour === 24) return 0;
  return hour;
}

// 中文数字 -> 阿拉伯（仅覆盖星期与小时可能出现的一位数）
var CN_NUM = { '日': 0, '天': 0, '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7 };

export function parseMessage(text, now) {
  now = now || new Date();
  var raw = String(text || '').trim();
  var rest = raw;
  var date = null;
  var time = null;

  // ---------- 1. 日期解析 ----------
  // 1.1 相对日期
  var relMap = { '大后天': 3, '后天': 2, '明天': 1, '今天': 0 };
  var relKeys = ['大后天', '后天', '明天', '今天']; // 长的优先，避免「后天」被「天」误伤
  for (var i = 0; i < relKeys.length && date === null; i++) {
    var k = relKeys[i];
    if (rest.indexOf(k) !== -1) {
      var d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + relMap[k]);
      date = formatDate(d);
      rest = rest.replace(k, ' ');
    }
  }

  // 1.2 绝对日期：X月X号 / X月X日
  if (date === null) {
    var m = rest.match(/(\d{1,2})月(\d{1,2})[号日]/);
    if (m) {
      date = buildAbsoluteDate(now, parseInt(m[1], 10), parseInt(m[2], 10));
      rest = rest.replace(m[0], ' ');
    }
  }

  // 1.3 斜杠/横杠日期：MM-DD / MM/DD
  if (date === null) {
    var s = rest.match(/(\d{1,2})[\/\-](\d{1,2})/);
    if (s) {
      date = buildAbsoluteDate(now, parseInt(s[1], 10), parseInt(s[2], 10));
      rest = rest.replace(s[0], ' ');
    }
  }
  // PARSER_PART2
  // 1.4 星期：下下周X / 下周X / 这周X / 周X / 星期X / 礼拜X（中文只有一个「周」字兼作前缀与标记）
  if (date === null) {
    var w = rest.match(/(下下|下|这|本)?\s*(周|星期|礼拜)([一二三四五六日天])/);
    if (w) {
      date = buildWeekdayDate(now, w[1], CN_NUM[w[3]]);
      rest = rest.replace(w[0], ' ');
    }
  }

  // 1.5 默认今天
  if (date === null) {
    date = formatDate(new Date(now.getFullYear(), now.getMonth(), now.getDate()));
  }

  // ---------- 2. 时间解析 ----------
  // 2.1 带时段前缀：上午/下午/晚上/中午/早上/清晨 + X点[半|X分]
  var tm = rest.match(/(上午|下午|晚上|中午|早上|清晨)?\s*(\d{1,2})点(半)?(\d{1,2})?分?/);
  if (tm) {
    var hour = parseInt(tm[2], 10);
    var minute = 0;
    if (tm[3]) minute = 30;             // X点半
    else if (tm[4]) minute = parseInt(tm[4], 10); // X点X分
    if (tm[1]) hour = hourWithPeriod(tm[1], hour);
    time = pad(hour) + ':' + pad(minute);
    rest = rest.replace(tm[0], ' ');
  } else {
    // 2.2 纯数字 HH:MM
    var hm = rest.match(/(\d{1,2}):(\d{2})/);
    if (hm) {
      time = pad(parseInt(hm[1], 10)) + ':' + pad(parseInt(hm[2], 10));
      rest = rest.replace(hm[0], ' ');
    }
  }

  // ---------- 3. 标题 / 备注 ----------
  // 先按「两个及以上空格」或「逗号」切分（保留用户的分隔意图），再各自规整空白
  rest = rest.trim();
  var title, note = null;
  var parts = rest.split(/\s{2,}|[,，]/);
  if (parts.length > 1) {
    title = parts[0].replace(/\s+/g, ' ').trim();
    note = parts.slice(1).join(' ').replace(/\s+/g, ' ').trim() || null;
  } else {
    title = rest.replace(/\s+/g, ' ').trim();
  }

  return { date: date, time: time, title: title, note: note, raw: raw };
}

// 绝对日期：若该日期早于今天则顺延到明年
function buildAbsoluteDate(now, month, day) {
  var year = now.getFullYear();
  var candidate = new Date(year, month - 1, day);
  var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (candidate < today) {
    candidate = new Date(year + 1, month - 1, day);
  }
  return formatDate(candidate);
}

// 星期日期：以周一为一周起点
// prefix: 下(+7) / 下下(+14) / 这|本|undefined(本周内，若已过则取下周同一天)
function buildWeekdayDate(now, prefix, targetDow) {
  var todayDow = now.getDay() === 0 ? 7 : now.getDay();
  var target = targetDow === 0 ? 7 : targetDow; // 中文「日/天」=周日=7
  var diff = target - todayDow;

  if (prefix === '下') {
    diff += 7;
  } else if (prefix === '下下') {
    diff += 14;
  } else {
    if (diff < 0) diff += 7;   // 本周内，若已过则取下周同一天
  }

  var d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diff);
  return formatDate(d);
}
