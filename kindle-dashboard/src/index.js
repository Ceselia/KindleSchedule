// src/index.js — Cloudflare Worker 入口（API + 页面 + 微信回调）
import dashboardHtml from './views/dashboard.html';
import calendarHtml from './views/calendar.html';
import addHtml from './views/add.html';
import { parseMessage } from './parser.js';
import * as db from './db.js';
import * as wx from './wechat.js';
import { civilNow } from './time.js';

const HTML_HEADERS = { 'Content-Type': 'text/html; charset=utf-8' };
const XML_HEADERS = { 'Content-Type': 'application/xml; charset=utf-8' };

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    try {
      // ---- 页面 ----
      if (method === 'GET' && path === '/') return Response.redirect(url.origin + '/dashboard', 302);
      if (method === 'GET' && path === '/dashboard') return new Response(dashboardHtml, { headers: HTML_HEADERS });
      if (method === 'GET' && path === '/calendar') return new Response(calendarHtml, { headers: HTML_HEADERS });
      if (method === 'GET' && path === '/add') return new Response(addHtml, { headers: HTML_HEADERS });

      // ---- 配置 ----
      if (method === 'GET' && path === '/api/config') {
        return json({ pollInterval: Number(env.POLL_INTERVAL) || 30 });
      }
      // ROUTES_PART2
      // ---- 日程集合 ----
      if (path === '/api/schedules') {
        if (method === 'GET') {
          const today = civilNow(env.TIMEZONE);
          const rows = await db.listSchedules(env.DB, {
            date: url.searchParams.get('date'),
            days: url.searchParams.get('days'),
            month: url.searchParams.get('month'),
            todayStr: today.str
          });
          return json(rows);
        }
        if (method === 'POST') {
          const body = await request.json().catch(() => ({}));
          let record;
          if (body.raw) {
            record = parseMessage(body.raw, civilNow(env.TIMEZONE).date);
          } else {
            if (!body.date || !body.title) return json({ success: false, error: '缺少 date 或 title' }, 400);
            record = { date: body.date, time: body.time || null, title: body.title, note: body.note || null, raw: null };
          }
          if (!record.title) return json({ success: false, error: '未能识别标题' }, 400);
          const saved = await db.insertSchedule(env.DB, record);
          return json({ success: true, schedule: saved });
        }
      }

      // ---- 单条日程：/api/schedules/:id 、 /api/schedules/:id/done ----
      const mItem = path.match(/^\/api\/schedules\/(\d+)(\/done)?$/);
      if (mItem) {
        const id = Number(mItem[1]);
        if (method === 'DELETE' && !mItem[2]) return json({ success: await db.deleteSchedule(env.DB, id) });
        if (method === 'PUT' && mItem[2]) return json({ success: await db.markDone(env.DB, id) });
      }

      // ---- 微信回调 ----
      if (path === '/wechat') {
        const q = {
          signature: url.searchParams.get('signature'),
          timestamp: url.searchParams.get('timestamp'),
          nonce: url.searchParams.get('nonce')
        };
        if (method === 'GET') {
          const ok = await wx.checkSignature(env.WECHAT_TOKEN, q);
          return new Response(ok ? (url.searchParams.get('echostr') || '') : '',
            { headers: { 'Content-Type': 'text/plain' } });
        }
        if (method === 'POST') {
          if (q.signature && !(await wx.checkSignature(env.WECHAT_TOKEN, q))) {
            return new Response('', { headers: XML_HEADERS });
          }
          const xml = await request.text();
          return new Response(await handleWechatMessage(xml, env), { headers: XML_HEADERS });
        }
      }

      return new Response('Not Found', { status: 404 });
    } catch (e) {
      return json({ success: false, error: e.message }, 500);
    }
  }
};
// HANDLERS_PART3
async function handleWechatMessage(xml, env) {
  const msgType = (wx.getTag(xml, 'MsgType') || '').toLowerCase();
  const fromUser = wx.getTag(xml, 'FromUserName');   // 发消息的用户
  const toUser = wx.getTag(xml, 'ToUserName');        // 公众号
  const reply = (text) => wx.buildReplyXml(fromUser, toUser, text);

  if (msgType === 'event') {
    const ev = (wx.getTag(xml, 'Event') || '').toLowerCase();
    if (ev === 'subscribe') return reply(wx.WELCOME);
    return '';   // 取关等其它事件不回复
  }
  if (msgType !== 'text') return reply('我目前只看得懂文字消息哦～\n' + wx.GUIDE);

  const content = (wx.getTag(xml, 'Content') || '').trim();
  if (!content || /^(帮助|help|你好|您好|怎么用|使用|说明|菜单|\?|？)$/i.test(content)) {
    return reply(wx.GUIDE);
  }
  try {
    const parsed = parseMessage(content, civilNow(env.TIMEZONE).date);
    if (!parsed.title) return reply('没太看懂您的意思～\n' + wx.GUIDE);
    await db.insertSchedule(env.DB, parsed);
    return reply(wx.successText(parsed));
  } catch (e) {
    return reply('哎呀，创建失败了，请稍后再发一次试试');
  }
}

