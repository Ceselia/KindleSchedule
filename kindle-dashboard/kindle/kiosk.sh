#!/bin/sh
# kiosk.sh — Kindle 霸屏启动脚本
# 用法：修改下方 SERVER_URL 后，SSH 传到 Kindle 执行： sh /mnt/us/kiosk.sh
# 退出霸屏：SSH 执行 sh /mnt/us/recover.sh；兜底：长按电源键约 40 秒强制重启。

SERVER_URL="http://192.168.1.100:3000/dashboard"   # 改成你的服务器地址

# ---------- 系统层：禁止屏幕休眠，保持常亮 ----------
lipc-set-prop -i com.lab126.powerd preventScreenSaver 1 2>/dev/null

# ---------- 进程层：杀掉桌面框架，防止误触回到桌面 ----------
killall -9 homeframework 2>/dev/null

# ---------- 浏览器层：找到可用浏览器并全屏加载页面 ----------
launch_browser() {
  if [ -x /usr/bin/mesquite ]; then
    /usr/bin/mesquite "$SERVER_URL" 2>/dev/null &
  elif [ -x /usr/bin/browser ]; then
    /usr/bin/browser "$SERVER_URL" 2>/dev/null &
  elif [ -x /usr/bin/webreader ]; then
    /usr/bin/webreader "$SERVER_URL" 2>/dev/null &
  elif [ -x /usr/java/bin/cvm ]; then
    /usr/java/bin/cvm -jar /opt/amazon/ebook/lib/BrowserApp.jar "$SERVER_URL" 2>/dev/null &
  fi
  # 禁用浏览器地址栏/工具栏（型号差异，失败忽略）
  lipc-set-prop -i com.lab126.appmgrd start app://com.lab126.browser 2>/dev/null
}

launch_browser

# ---------- 守护进程：每 30 秒检测浏览器，崩溃自动重启 ----------
while true; do
  sleep 30
  if ! pidof mesquite browser webreader cvm >/dev/null 2>&1; then
    launch_browser
  fi
done

# ---------- 开机自启（F-12，理想需求，按需启用） ----------
# 方式一：将本脚本软链到 /etc/init.d/ 并注册 rc.d
# 方式二：安装 KUAL，在其 config 中添加开机执行项
# 因型号差异较大，此处仅注释说明，不默认实现。
