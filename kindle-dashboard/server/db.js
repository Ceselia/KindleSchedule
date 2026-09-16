// db.js — SQLite 数据访问封装（better-sqlite3，同步 API）
var Database = require('better-sqlite3');
var config = require('./config');

var db = new Database(config.dbFile);
db.pragma('journal_mode = WAL');

function initDb() {
  db.exec(
    'CREATE TABLE IF NOT EXISTS schedules (' +
    '  id INTEGER PRIMARY KEY AUTOINCREMENT,' +
    '  date TEXT NOT NULL,' +
    '  time TEXT,' +
    '  title TEXT NOT NULL,' +
    '  note TEXT,' +
    '  raw TEXT,' +
    '  done INTEGER DEFAULT 0,' +
    "  created_at TEXT DEFAULT (datetime('now','localtime'))" +
    ')'
  );
}

function insertSchedule(s) {
  var stmt = db.prepare(
    'INSERT INTO schedules (date, time, title, note, raw) VALUES (?, ?, ?, ?, ?)'
  );
  var info = stmt.run(s.date, s.time || null, s.title, s.note || null, s.raw || null);
  return getById(info.lastInsertRowid);
}

function getById(id) {
  return db.prepare('SELECT id,date,time,title,note,done FROM schedules WHERE id = ?').get(id);
}

// 无参：今日及以后全部；date：指定日期；days：未来 N 天
function listSchedules(opts) {
  opts = opts || {};
  // 全天日程(time IS NULL)排在当天最前，其余按时间升序
  var order = ' ORDER BY date ASC, (time IS NULL) DESC, time ASC';
  var today = new Date();
  var todayStr = today.getFullYear() + '-' +
    pad(today.getMonth() + 1) + '-' + pad(today.getDate());

  if (opts.date) {
    return db.prepare(
      'SELECT id,date,time,title,note,done FROM schedules WHERE date = ?' + order
    ).all(opts.date);
  }
  if (opts.month) {
    // month = 'YYYY-MM'，返回整月全部日程（含已过去日期，不做今日过滤）
    return db.prepare(
      'SELECT id,date,time,title,note,done FROM schedules WHERE date LIKE ?' + order
    ).all(opts.month + '-%');
  }
  if (opts.days) {
    var end = new Date(today.getFullYear(), today.getMonth(), today.getDate() + parseInt(opts.days, 10) - 1);
    var endStr = end.getFullYear() + '-' + pad(end.getMonth() + 1) + '-' + pad(end.getDate());
    return db.prepare(
      'SELECT id,date,time,title,note,done FROM schedules WHERE date >= ? AND date <= ?' + order
    ).all(todayStr, endStr);
  }
  return db.prepare(
    'SELECT id,date,time,title,note,done FROM schedules WHERE date >= ?' + order
  ).all(todayStr);
}

function deleteSchedule(id) {
  var info = db.prepare('DELETE FROM schedules WHERE id = ?').run(id);
  return info.changes > 0;
}

function markDone(id) {
  var info = db.prepare('UPDATE schedules SET done = 1 WHERE id = ?').run(id);
  return info.changes > 0;
}

function pad(n) { return n < 10 ? '0' + n : '' + n; }

module.exports = {
  initDb: initDb,
  insertSchedule: insertSchedule,
  listSchedules: listSchedules,
  deleteSchedule: deleteSchedule,
  markDone: markDone
};
