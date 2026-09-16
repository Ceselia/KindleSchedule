// src/time.js — 时区工具
// Workers 运行在 UTC，需按目标时区（默认 Asia/Shanghai）计算"今天"的年月日，
// 以保证"今天/明天/下周三"等相对日期在跨零点时正确。

function pad(n) { return n < 10 ? '0' + n : '' + n; }

// 返回目标时区当前的 civil 日期：{ y, m, d, str:'YYYY-MM-DD', date:Date }
// date 为 new Date(y, m-1, d)，其 getDay()/年月日 用于传给 parser 做相对日期运算。
export function civilNow(tz) {
  var fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz || 'Asia/Shanghai',
    year: 'numeric', month: '2-digit', day: '2-digit'
  });
  var parts = fmt.formatToParts(new Date());
  var y = 0, m = 0, d = 0;
  for (var i = 0; i < parts.length; i++) {
    if (parts[i].type === 'year') y = +parts[i].value;
    else if (parts[i].type === 'month') m = +parts[i].value;
    else if (parts[i].type === 'day') d = +parts[i].value;
  }
  return { y: y, m: m, d: d, str: y + '-' + pad(m) + '-' + pad(d), date: new Date(y, m - 1, d) };
}
