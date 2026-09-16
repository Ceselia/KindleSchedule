# Kindle 霸屏日程看板（Cloudflare Workers + D1）

将越狱 Kindle 改造为常驻显示的日程看板。家人用微信或网页发一句话即可新增日程，Kindle 端自动解析并以 Apple 风格卡片展示，支持左右滑动切换日期，并提供月历汇总页。后端运行在 Cloudflare Workers，数据存 Cloudflare D1。

## 目录结构

```
kindle-dashboard/
├── wrangler.toml          Cloudflare 配置（D1 绑定 + vars + Text 规则）
├── package.json           wrangler 依赖 + 脚本
├── schema.sql             D1 建表
├── src/
│   ├── index.js           Worker 入口（路由：页面 + API + 微信）
│   ├── parser.js          自然语言解析（ESM）
│   ├── db.js              D1 数据访问
│   ├── wechat.js          微信签名(WebCrypto) + XML + 话术
│   ├── time.js            时区工具（Asia/Shanghai 求今天）
│   └── views/
│       ├── dashboard.html 单日看板（默认常驻页）
│       ├── calendar.html  月历汇总页
│       └── add.html       手机端添加页（测试用）
├── kindle/                kiosk.sh / recover.sh
├── 测试流程.md / 测试方法.md / 正式部署.md
└── README.md
```

## 一、本地开发（wrangler dev + 本地 D1）

```bash
npm install
# 首次：创建 D1 数据库，把输出的 database_id 填进 wrangler.toml
npx wrangler d1 create kindle-dashboard
# 本地建表
npm run db:init:local
# 启动本地开发服务器（默认 http://localhost:8787）
npm run dev
```

页面入口（本地端口 8787）：

- 单日看板：`/dashboard`　月历页：`/calendar`　添加页（测试用）：`/add`
- 微信回调：`/wechat`　配置：`/api/config`

## 二、部署到 Cloudflare

```bash
# 远程 D1 建表（首次）
npm run db:init:remote
# 部署 Worker
npm run deploy
```

也可把仓库推到 GitHub，在 Cloudflare 控制台的 Workers 里连接该仓库开启自动部署，或用 GitHub Actions 调 `cloudflare/wrangler-action`。部署后 Worker 自带 HTTPS 域名。详见 `正式部署.md`。

## 三、配置微信公众号

后台「开发 → 基本配置 → 服务器配置」：

- URL：`https://<worker域名>/wechat`
- Token：与 `wrangler.toml` 中 `WECHAT_TOKEN` 一致
- 消息加解密方式：**明文模式**

家人发消息即可新增日程（GET 与 POST 回调均已做 SHA1 签名校验）：

```
明天下午3点 张医生复查
10月20号上午10点 买菜  带环保袋
```

> 备注需用「两个空格」或「逗号」与标题分隔。公众号按场景自动回复：关注→欢迎+引导；成功→「已为您创建日程「9月17日 周四 15:00 张医生复查」」；无法识别/非文字→引导话术。

## 四、API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/schedules` | 今日及以后；支持 `?date=YYYY-MM-DD`、`?days=N`、`?month=YYYY-MM`（整月，含过去） |
| POST | `/api/schedules` | body `{raw}` 走解析，或 `{date,time,title,note}` |
| DELETE | `/api/schedules/:id` | 删除 |
| PUT | `/api/schedules/:id/done` | 标记完成 |
| GET | `/api/config` | 返回 `{pollInterval}` |

## 五、Kindle 端

编辑 `kindle/kiosk.sh` 的 `SERVER_URL` 为 `https://<worker域名>/dashboard`，SSH 传到 Kindle 执行 `sh /mnt/us/kiosk.sh`；退出 `sh /mnt/us/recover.sh`。两个展示页右上角可互相跳转。

**断网韧性**：拉取失败每 5 秒自动重试，并监听 `online`/`visibilitychange`，Wi-Fi 恢复后立即重新拉取最新日程；同时用 localStorage 缓存最近一次数据，**断网时（含刷新/重启后）仍显示离线前最新的日程**，联网后自动覆盖为最新。

## 六、配置与环境变量（wrangler.toml [vars]）

| 变量 | 说明 | 默认 |
|------|------|------|
| WECHAT_TOKEN | 微信服务器配置 Token | kindle_dashboard_token |
| POLL_INTERVAL | 前端轮询间隔（秒） | 30 |
| TIMEZONE | 计算"今天"的时区 | Asia/Shanghai |

## 七、已知限制

- 解析器不支持「下个月」「年底」等复杂语义，请用表单模式。
- 绝对日期若已过当天，自动顺延到明年（有意设计）。
- Kindle 旧版 WebKit：前端用 ES5 + XMLHttpRequest + Flexbox，无框架。
- 改 HTML/代码后需 `wrangler dev` 重载或 `wrangler deploy` 才生效（不再是改文件即时刷新）。
- Kiosk 非持久化，Kindle 重启需重新执行 `kiosk.sh`。
