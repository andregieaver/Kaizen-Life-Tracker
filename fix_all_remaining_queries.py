#!/usr/bin/env python3
"""
Final batch fix for all remaining unbounded queries
"""

import re

# Read file
with open('/app/backend/server.py', 'r') as f:
    lines = f.readlines()

# Track changes
changes = 0

# Fix all .to_list(length=None) without .limit() before them
for i, line in enumerate(lines):
    if '.to_list(length=None)' in line and '.limit(' not in lines[i-1] if i > 0 else True:
        # Determine appropriate limit based on context
        limit = 100  # default
        
        # Context-specific limits
        if 'subscription_plans' in line or 'plans' in line:
            limit = 50
        elif 'workout' in line or 'activity' in line or 'strava' in line:
            limit = 500
        elif 'journal' in line or 'supplement' in line or 'nutrition' in line:
            limit = 200
        elif 'memory' in line or 'document' in line:
            limit = 200
        elif 'test' in line or 'analytics' in line:
            limit = 500
        elif 'chat' in line or 'message' in line:
            limit = 200
        elif 'notification' in line:
            limit = 200
        elif 'recommendation' in line:
            limit = 100
        
        # Replace
        old_line = line
        new_line = line.replace('.to_list(length=None)', f'.limit({limit}).to_list(length={limit})')
        
        if old_line != new_line:
            lines[i] = new_line
            changes += 1
            print(f"Line {i+1}: Fixed (limit={limit})")

# Write back
with open('/app/backend/server.py', 'w') as f:
    f.writelines(lines)

print(f"\n✅ Total changes: {changes}")
