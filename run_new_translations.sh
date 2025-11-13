#!/bin/bash
export EMERGENT_LLM_KEY="sk-emergent-dA96a94C7Ad40C0676"
cd /app
python3 translate_to_japanese.py > translation_japanese.log 2>&1 &
python3 translate_to_chinese.py > translation_chinese.log 2>&1 &
python3 translate_to_italian.py > translation_italian.log 2>&1 &
echo "All 3 translation processes started!"
sleep 2
ps aux | grep "translate_to_" | grep -v grep
