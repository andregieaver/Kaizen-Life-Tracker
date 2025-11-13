#!/bin/bash

# Set the Emergent LLM Key
export EMERGENT_LLM_KEY="sk-emergent-dA96a94C7Ad40C0676"

cd /app

# Run all 4 translations in parallel
python3 translate_to_danish.py > translation_danish.log 2>&1 &
python3 translate_to_german.py > translation_german.log 2>&1 &
python3 translate_to_spanish.py > translation_spanish.log 2>&1 &
python3 translate_to_french.py > translation_french.log 2>&1 &

echo "All 4 translation processes started!"
echo "Danish PID: $(pgrep -f translate_to_danish)"
echo "German PID: $(pgrep -f translate_to_german)"
echo "Spanish PID: $(pgrep -f translate_to_spanish)"
echo "French PID: $(pgrep -f translate_to_french)"
