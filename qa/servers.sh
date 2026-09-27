#!/usr/bin/env bash
pkill -f mockpg.mjs 2>/dev/null
pkill -f "http.server 8899" 2>/dev/null
sleep 1
cd /home/claude && setsid nohup node mockpg.mjs > /tmp/mock.log 2>&1 < /dev/null &
cd /home/claude/radar/build && setsid nohup python3 -m http.server 8899 --bind 127.0.0.1 > /tmp/srv.log 2>&1 < /dev/null &
sleep 4
curl -s -o /dev/null -w "web:%{http_code} " http://127.0.0.1:8899/
curl -s -o /dev/null -w "mock:%{http_code}\n" "http://127.0.0.1:8877/__delay?ms=0"
