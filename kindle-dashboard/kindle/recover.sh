#!/bin/sh
# recover.sh — 退出霸屏，恢复 Kindle 桌面
# 用法：SSH 执行 sh /mnt/us/recover.sh

# 1. 杀掉 kiosk.sh 守护进程
kill $(ps | grep 'kiosk.sh' | grep -v grep | awk '{print $1}') 2>/dev/null
killall -9 kiosk.sh 2>/dev/null

# 2. 杀掉浏览器进程
killall -9 mesquite browser webreader cvm 2>/dev/null

# 3. 恢复屏幕休眠功能
lipc-set-prop -i com.lab126.powerd preventScreenSaver 0 2>/dev/null

# 4. 重启桌面框架
/etc/init.d/framework start 2>/dev/null

echo "已恢复桌面，如未生效请长按电源键约 40 秒强制重启。"
