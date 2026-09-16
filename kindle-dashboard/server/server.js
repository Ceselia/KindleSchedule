// server.js — 主服务：微信回调 + REST API + 页面托管
var express = require('express');
var crypto = require('crypto');
var path = require('path');
var xml2js = require('xml2js');
var config = require('./config');
var parser = require('./parser');
var db = require('./db');

db.initDb();

var app = express();
app.use(express.json());
// 微信推送为 XML，按原始文本收集
app.use('/wechat', express.text({ type: '*/*' }));

// ---------------- 微信回调 ----------------

// 签名校验
function checkSignature(query) {
  var arr = [config.wechat.token, query.timestamp, query.nonce].sort();
  var sha1 = crypto.createHash('sha1').update(arr.join('')).digest('hex');
  return sha1 === query.signature;
}

// GET /wechat 服务器验证
app.get('/wechat', function (req, res) {
  if (checkSignature(req.query)) {
    res.send(req.query.echostr);
  } else {
    res.send('');
  }
});

// POST /wechat 接收消息
app.post('/wechat', function (req, res) {
  res.set('Content-Type', 'application/xml');
  xml2js.parseString(req.body, { explicitArray: false }, function (err, result) {
    if (err || !result || !result.xml) {
      return res.send('');
    }
    var msg = result.xml;
    var msgType = (msg.MsgType || '').toLowerCase();

    // 关注事件发欢迎语，取关等其它事件不回复
    if (msgType === 'event') {
      var ev = (msg.Event || '').toLowerCase();
      if (ev === 'subscribe') {
        return res.send(buildReplyXml(msg.FromUserName, msg.ToUserName, WELCOME));
      }
      return res.send('');
    }

    // 非文字消息（图片/语音等）：引导用户发文字
    if (msgType !== 'text') {
      return res.send(buildReplyXml(msg.FromUserName, msg.ToUserName, '我目前只看得懂文字消息哦～\n' + GUIDE));
    }

    var content = (msg.Content || '').trim();
    var replyText;

    // 空消息或问候/帮助关键词：给出引导话术
    if (!content || /^(帮助|help|你好|您好|怎么用|使用|说明|菜单|\?|？)$/i.test(content)) {
      replyText = GUIDE;
    } else {
      try {
        var parsed = parser.parseMessage(content);
        if (!parsed.title) {
          replyText = '没太看懂您的意思～\n' + GUIDE;
        } else {
          db.insertSchedule(parsed);
          replyText = successText(parsed);
        }
      } catch (e) {
        replyText = '哎呀，创建失败了，请稍后再发一次试试';
      }
    }

    res.send(buildReplyXml(msg.FromUserName, msg.ToUserName, replyText));
  });
});

function buildReplyXml(toUser, fromUser, text) {
  var ts = Math.floor(Date.now() / 1000);
  return '<xml>' +
    '<ToUserName><![CDATA[' + toUser + ']]></ToUserName>' +
    '<FromUserName><![CDATA[' + fromUser + ']]></FromUserName>' +
    '<CreateTime>' + ts + '</CreateTime>' +
    '<MsgType><![CDATA[text]]></MsgType>' +
    '<Content><![CDATA[' + text + ']]></Content>' +
    '</xml>';
}

// ---------------- 微信话术 ----------------

var GUIDE = '按顺序告诉我：日期 时间 提醒内容，我就可以帮您创建日程哦～\n' +
  '比如：明天 下午3点 张医生复查';
var WELCOME = '您好，我是您的日程小助手～\n' + GUIDE;
var WEEK = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

// 把 2026-09-17 格式化为「9月17日 周三」，便于老人阅读
function formatDateHuman(dateStr) {
  var p = dateStr.split('-');
  var d = new Date(+p[0], +p[1] - 1, +p[2]);
  return (+p[1]) + '月' + (+p[2]) + '日 ' + WEEK[d.getDay()];
}

// 创建成功回复：已为您创建日程「日期 时间 提醒内容」
function successText(s) {
  var seg = formatDateHuman(s.date) + ' ' + (s.time || '全天') + ' ' + s.title +
    (s.note ? ' ' + s.note : '');
  return '已为您创建日程「' + seg + '」';
}

// ---------------- REST API ----------------

app.get('/api/schedules', function (req, res) {
  try {
    var rows = db.listSchedules({ date: req.query.date, days: req.query.days, month: req.query.month });
    res.json(rows);
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.post('/api/schedules', function (req, res) {
  try {
    var body = req.body || {};
    var record;
    if (body.raw) {
      record = parser.parseMessage(body.raw);
    } else {
      if (!body.date || !body.title) {
        return res.status(400).json({ success: false, error: '缺少 date 或 title' });
      }
      record = {
        date: body.date, time: body.time || null,
        title: body.title, note: body.note || null, raw: null
      };
    }
    if (!record.title) {
      return res.status(400).json({ success: false, error: '未能识别标题' });
    }
    var saved = db.insertSchedule(record);
    res.json({ success: true, schedule: saved });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.delete('/api/schedules/:id', function (req, res) {
  try {
    var ok = db.deleteSchedule(req.params.id);
    res.json({ success: ok });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.put('/api/schedules/:id/done', function (req, res) {
  try {
    var ok = db.markDone(req.params.id);
    res.json({ success: ok });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.get('/api/config', function (req, res) {
  res.json({ pollInterval: config.pollInterval });
});

// ---------------- 页面路由 ----------------

app.get('/', function (req, res) { res.redirect('/dashboard'); });
app.get('/dashboard', function (req, res) {
  res.sendFile(path.join(__dirname, 'views', 'dashboard.html'));
});
app.get('/add', function (req, res) {
  res.sendFile(path.join(__dirname, 'views', 'add.html'));
});
app.get('/calendar', function (req, res) {
  res.sendFile(path.join(__dirname, 'views', 'calendar.html'));
});

app.listen(config.port, function () {
  console.log('Kindle 日程看板服务已启动: http://localhost:' + config.port);
  console.log('  看板 /dashboard   日历 /calendar   添加 /add   微信回调 /wechat');
});
