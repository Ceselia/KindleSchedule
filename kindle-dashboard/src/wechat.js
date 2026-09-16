// src/wechat.js — 微信回调工具（Workers 运行时）

// WebCrypto SHA1 -> hex
export async function sha1Hex(str) {
  var buf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(str));
  var bytes = new Uint8Array(buf);
  var hex = '';
  for (var i = 0; i < bytes.length; i++) {
    hex += (bytes[i] < 16 ? '0' : '') + bytes[i].toString(16);
  }
  return hex;
}

// 校验微信服务器签名
export async function checkSignature(token, q) {
  var arr = [token, q.timestamp || '', q.nonce || ''].sort();
  var sig = await sha1Hex(arr.join(''));
  return sig === q.signature;
}

// 从微信 XML 中提取字段（支持 CDATA 与纯文本），替代 xml2js
export function getTag(xml, name) {
  var re = new RegExp('<' + name + '>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?</' + name + '>');
  var m = (xml || '').match(re);
  return m ? m[1].trim() : '';
}

export function buildReplyXml(toUser, fromUser, text) {
  var ts = Math.floor(Date.now() / 1000);
  return '<xml>' +
    '<ToUserName><![CDATA[' + toUser + ']]></ToUserName>' +
    '<FromUserName><![CDATA[' + fromUser + ']]></FromUserName>' +
    '<CreateTime>' + ts + '</CreateTime>' +
    '<MsgType><![CDATA[text]]></MsgType>' +
    '<Content><![CDATA[' + text + ']]></Content>' +
    '</xml>';
}

// ---------------- 话术 ----------------
export var GUIDE = '按顺序告诉我：日期 时间 提醒内容，我就可以帮您创建日程哦～\n' +
  '比如：明天 下午3点 张医生复查';
export var WELCOME = '您好，我是您的日程小助手～\n' + GUIDE;

var WEEK = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
function pad(n) { return n < 10 ? '0' + n : '' + n; }

// 2026-09-17 -> 「9月17日 周三」
function formatDateHuman(dateStr) {
  var p = dateStr.split('-');
  var d = new Date(+p[0], +p[1] - 1, +p[2]);
  return (+p[1]) + '月' + (+p[2]) + '日 ' + WEEK[d.getDay()];
}

// 创建成功回复：已为您创建日程「日期 时间 提醒内容」
export function successText(s) {
  var seg = formatDateHuman(s.date) + ' ' + (s.time || '全天') + ' ' + s.title +
    (s.note ? ' ' + s.note : '');
  return '已为您创建日程「' + seg + '」';
}
