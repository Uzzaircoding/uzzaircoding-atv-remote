#!/usr/bin/env bash

BASE_URL="${REMOTE_URL:-http://localhost:3000}"

while true; do
  clear
  echo "=============================="
  echo "     TOSHIBA / ANDROID TV"
  echo "=============================="
  echo
  echo " U = Up       D = Down"
  echo " L = Left     R = Right"
  echo " O = OK       B = Back"
  echo " H = Home     + = Volume Up"
  echo " - = Volume Down"
  echo " M = Mute"
  echo " Q = Quit"
  echo
  read -n 1 -p "Command: " key
  echo

  case "$key" in
    u|U) button="up" ;;
    d|D) button="down" ;;
    l|L) button="left" ;;
    r|R) button="right" ;;
    o|O) button="ok" ;;
    b|B) button="back" ;;
    h|H) button="home" ;;
    +) button="volup" ;;
    -) button="voldown" ;;
    m|M) button="mute" ;;
    q|Q) exit 0 ;;
    *) continue ;;
  esac

  curl -s -X POST "$BASE_URL/api/key" \
    -H "Content-Type: application/json" \
    -d "{\"key\":\"$button\"}" >/dev/null
done
