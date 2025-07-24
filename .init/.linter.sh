#!/bin/bash
cd /home/kavia/workspace/code-generation/modern-pac-man-browser-game-2a9bb19a/pac_man_frontend
npm run build
EXIT_CODE=$?
if [ $EXIT_CODE -ne 0 ]; then
   exit 1
fi

