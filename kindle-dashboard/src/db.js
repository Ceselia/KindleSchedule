// src/db.js — Cloudflare D1 数据访问（全部 async）
// 调用方传入 db = env.DB

var ORDER = ' ORDER BY date ASC, (time IS NULL) DESC, time ASC';

export async function insertSchedule(db, s) {
  var row = await db.prepare(
    'INSERT INTO schedules (date, time, title, note, raw) VALUES (?, ?, ?, ?, ?) ' +
    'RETURNING id, date, time, title, note, done'
  ).bind(s.date, s.time || null, s.title, s.note || null, s.raw || null).first();
  return row;
}

// opts: { date, days, month, todayStr }（todayStr 由调用方按时区算好）
export async function listSchedules(db, opts) {
  opts = opts || {};
  if (opts.date) {
    return (await db.prepare(
      'SELECT id,date,time,title,note,done FROM schedules WHERE date = ?' + ORDER
    ).bind(opts.date).all()).results;
  }
  if (opts.month) {
    return (await db.prepare(
      'SELECT id,date,time,title,note,done FROM schedules WHERE date LIKE ?' + ORDER
    ).bind(opts.month + '-%').all()).results;
  }
  if (opts.days) {
    var end = addDays(opts.todayStr, parseInt(opts.days, 10) - 1);
    return (await db.prepare(
      'SELECT id,date,time,title,note,done FROM schedules WHERE date >= ? AND date <= ?' + ORDER
    ).bind(opts.todayStr, end).all()).results;
  }
  return (await db.prepare(
    'SELECT id,date,time,title,note,done FROM schedules WHERE date >= ?' + ORDER
  ).bind(opts.todayStr).all()).results;
}

export async function deleteSchedule(db, id) {
  var r = await db.prepare('DELETE FROM schedules WHERE id = ?').bind(id).run();
  return r.meta.changes > 0;
}

export async function markDone(db, id) {
  var r = await db.prepare('UPDATE schedules SET done = 1 WHERE id = ?').bind(id).run();
  return r.meta.changes > 0;
}

function pad(n) { return n < 10 ? '0' + n : '' + n; }
function addDays(dateStr, n) {
  var p = dateStr.split('-');
  var d = new Date(+p[0], +p[1] - 1, +p[2] + n);
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}
