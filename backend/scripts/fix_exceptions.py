#!/usr/bin/env python3
"""Script to fix bare exception handlers"""
import re
import sys

def fix_bare_excepts(filepath):
    """Replace bare except: with specific exceptions"""
    with open(filepath, 'r') as f:
        content = f.read()
    
    # Pattern to find bare except:
    original = content
    
    # Common replacements
    replacements = [
        (r'(\s+)except:\n(\s+)pass', r'\1except Exception as e:\n\2logger.debug(f"Suppressed exception: {e}")\n\2pass'),
        (r'(\s+)except:\n(\s+)logger', r'\1except Exception as e:\n\2logger'),
    ]
    
    for pattern, replacement in replacements:
        content = re.sub(pattern, replacement, content)
    
    if content != original:
        with open(filepath, 'w') as f:
            f.write(content)
        return True
    return False

if __name__ == '__main__':
    files = [
        '/app/backend/routes/nutrition_complete.py',
        '/app/backend/routes/schedules_complete.py',
        '/app/backend/routes/recommendations_complete.py',
        '/app/backend/routes/files_complete.py',
        '/app/backend/routes/crm_complete.py',
        '/app/backend/routes/test_results_complete.py'
    ]
    
    for f in files:
        try:
            if fix_bare_excepts(f):
                print(f'Fixed: {f}')
        except Exception as e:
            print(f'Error fixing {f}: {e}')
