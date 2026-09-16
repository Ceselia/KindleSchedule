# Kindle 霸屏日程看板

将越狱 Kindle 改造为常驻显示的日程看板。家人用微信或网页发一句话即可新增日程，Kindle 端自动解析并以 Apple 风格卡片展示，支持左右滑动切换日期，并提供月历汇总页可翻查任意一天。

## 目录结构

```
kindle-dashboard/
├── server/                Node.js 服务端
│   ├── package.json       依赖 (express + better-sqlite3 + xml2js)
│   ├── config.js          端口 / 轮询间隔 / 微信 Token
│   ├── parser.js          自然语言解析（node parser.js 可自测）
│   ├── db.js              SQLite 数据访问
│   ├── server.js          主服务（微信回调 + REST API + 页面托管）
│   └── views/
│       ├── dashboard.html Kindle 单日看板（默认常驻页）
│       ├── calendar.html  月历汇总页（点某天展开当天详情）
│       └── add.html       手机端添加页（仅测试用）
├── kindle/
│   ├── kiosk.sh           霸屏启动脚本
│   └── recover.sh         恢复桌面脚本
├── 测试流程.md            本地 demo 全流程测试
├── 测试方法.md            日历页测试与边界用例
├── 正式部署.md            接入公众号的正式部署（公网/nginx/HTTPS）
└── README.md
```

## 一、启动服务端

```bash
cd server
npm install
node server.js
```

> 需 Node.js >= 14。依赖 `better-sqlite3` 为原生模块，Node 新版本请用 `^13`（本项目已锁定）。
> 若本机 node 装在 `~/node` 未加入全局 PATH，启动前先执行 `export PATH="$HOME/node/bin:$PATH"`。

启动后访问：

- 单日看板（Kindle 常驻默认页）：`http://<服务器IP>:3000/dashboard`
- 月历汇总页：`http://<服务器IP>:3000/calendar`
- 添加页（手机测试用）：`http://<服务器IP>:3000/add`
- 微信回调：`http://<服务器IP>:3000/wechat`

两个展示页右上角有互相跳转的菜单按钮（看板 ⇄ 日历）。

验证解析器：`node parser.js`（打印内置 7 个示例的通过情况，预期 7/7）。

## 二、配置微信公众号

在公众号后台「开发 → 基本配置 → 服务器配置」填写：

- URL：`http://<公网地址>/wechat`（微信只接受 80/443 端口，本地 `localhost:3000` 微信访问不到）
- Token：与 `config.js` 中 `wechat.token` 一致（默认 `kindle_dashboard_token`）
- 消息加解密方式：**明文模式**（后端按明文 XML 解析，选加密模式会失败）

> 完整的公网/nginx/HTTPS 部署步骤见 `正式部署.md`。本地仅测试可用 curl 模拟微信回调，见 `测试流程.md`。

家人在公众号内发消息即可新增日程，例如：

```
明天下午3点 张医生复查
10月20号上午10点 买菜  带环保袋
```

> 备注需用「两个空格」或「逗号」与标题分隔。

公众号会按场景自动回复：关注时发欢迎+引导语；正常创建回「已为您创建日程「9月17日 周四 15:00 张医生复查」」；无法识别或发来非文字消息时回引导话术。

## 三、部署 Kindle 端

1. 编辑 `kindle/kiosk.sh`，把 `SERVER_URL` 改成你的展示页地址。
2. 通过 SSH/USB 把脚本传到 Kindle（如 `/mnt/us/`）。
3. SSH 执行：`sh /mnt/us/kiosk.sh`。

退出霸屏：SSH 执行 `sh /mnt/us/recover.sh`；兜底方案为长按电源键约 40 秒强制重启。

## 四、OTA 更新

| 更新对象 | 操作 | 生效延迟 |
|---------|------|---------|
| 日程内容 | 微信发消息 / `/add` 提交 | 30 秒内 |
| 页面布局 / 交互 | 改 `views/dashboard.html`、`views/calendar.html` | 刷新即生效（静态文件） |
| 解析规则 | 改 `parser.js` 后重启服务 | 即时 |
| 轮询间隔 | 改 `config.js` 后重启服务 | 即时 |

Kindle 端是纯展示终端，改服务端后无需在 Kindle 上做任何操作。日历页会在每 30 秒轮询时刷新数据，跨天后自动回到当前月并高亮今天。

## 五、API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/schedules` | 今日及以后全部；支持 `?date=YYYY-MM-DD`、`?days=N`、`?month=YYYY-MM`（整月，含过去日期） |
| POST | `/api/schedules` | body `{raw}` 走解析，或 `{date,time,title,note}` |
| DELETE | `/api/schedules/:id` | 删除 |
| PUT | `/api/schedules/:id/done` | 标记完成 |
| GET | `/api/config` | 返回 `{pollInterval}` |

## 六、已知限制

- 解析器不支持「下个月」「年底」等复杂语义，请改用表单模式。
- 绝对日期若已过当天，会自动顺延到明年（有意设计）。
- Kindle 浏览器基于旧版 WebKit，前端使用 ES5 + XMLHttpRequest + Flexbox，不引入任何框架。
- Kiosk 模式非持久化，Kindle 重启后需重新执行 `kiosk.sh`（开机自启见脚本内注释）。
- 安全：`GET /wechat` 已做签名校验，但 `POST /wechat` 暂未校验签名；正式上线前建议补上并启用 HTTPS（见 `正式部署.md`）。

## 七、相关文档

- `测试流程.md`：本地 demo 全流程测试（解析器 / API / 微信话术 / 两个页面）。
- `测试方法.md`：日历汇总页测试与边界用例。
- `正式部署.md`：接入公众号的正式部署（公网地址 / nginx / HTTPS / 安全加固）。
