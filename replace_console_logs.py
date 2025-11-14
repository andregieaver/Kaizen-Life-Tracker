#!/usr/bin/env python3
"""
Replace console.log statements with logger utility
Preserves console.error and console.warn but migrates them to logger
"""

import os
import re
from pathlib import Path

# Statistics
stats = {
    'files_processed': 0,
    'console_log_replaced': 0,
    'console_error_replaced': 0,
    'console_warn_replaced': 0,
    'console_info_replaced': 0,
    'files_modified': 0
}

def add_logger_import(content, filepath):
    """Add logger import if not present"""
    # Check if logger is already imported
    if "from './utils/logger'" in content or 'from "../utils/logger"' in content or 'from "../../utils/logger"' in content:
        return content
    
    # Determine relative path to utils
    parts = filepath.split('/')
    src_index = parts.index('src')
    depth = len(parts) - src_index - 2  # -2 for src and filename
    
    if depth == 0:
        relative_path = './utils/logger'
    else:
        relative_path = '../' * depth + 'utils/logger'
    
    # Find the last import statement
    import_pattern = r'^import\s+.*?from\s+[\'"].*?[\'"];?\s*$'
    imports = list(re.finditer(import_pattern, content, re.MULTILINE))
    
    if imports:
        last_import = imports[-1]
        insert_pos = last_import.end()
        new_import = f"\nimport {{ logger }} from '{relative_path}';"
        content = content[:insert_pos] + new_import + content[insert_pos:]
    else:
        # No imports found, add at the beginning (after any comments)
        first_code_line = re.search(r'^[^/\n]', content, re.MULTILINE)
        if first_code_line:
            insert_pos = first_code_line.start()
            new_import = f"import {{ logger }} from '{relative_path}';\n\n"
            content = content[:insert_pos] + new_import + content[insert_pos:]
    
    return content

def replace_console_statements(content):
    """Replace console statements with logger equivalents"""
    modified = content
    changes_made = 0
    
    # Replace console.log with logger.debug
    pattern = r'console\.log\('
    matches = len(re.findall(pattern, modified))
    if matches > 0:
        modified = re.sub(pattern, 'logger.debug(null, ', modified)
        stats['console_log_replaced'] += matches
        changes_made += matches
    
    # Replace console.error with logger.error
    pattern = r'console\.error\('
    matches = len(re.findall(pattern, modified))
    if matches > 0:
        modified = re.sub(pattern, 'logger.error(null, ', modified)
        stats['console_error_replaced'] += matches
        changes_made += matches
    
    # Replace console.warn with logger.warn
    pattern = r'console\.warn\('
    matches = len(re.findall(pattern, modified))
    if matches > 0:
        modified = re.sub(pattern, 'logger.warn(null, ', modified)
        stats['console_warn_replaced'] += matches
        changes_made += matches
    
    # Replace console.info with logger.info
    pattern = r'console\.info\('
    matches = len(re.findall(pattern, modified))
    if matches > 0:
        modified = re.sub(pattern, 'logger.info(null, ', modified)
        stats['console_info_replaced'] += matches
        changes_made += matches
    
    return modified, changes_made

def process_file(filepath):
    """Process a single JavaScript file"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Check if file has console statements
        if 'console.' not in content:
            return
        
        # Replace console statements
        modified_content, changes_made = replace_console_statements(content)
        
        if changes_made > 0:
            # Add logger import
            modified_content = add_logger_import(modified_content, filepath)
            
            # Write back
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(modified_content)
            
            stats['files_modified'] += 1
            print(f"✓ {filepath.replace('/app/frontend/src/', '')} - {changes_made} replacements")
        
        stats['files_processed'] += 1
        
    except Exception as e:
        print(f"✗ Error processing {filepath}: {e}")

def main():
    """Main execution"""
    print("=" * 60)
    print("Console.log Replacement Script")
    print("=" * 60)
    print()
    
    # Find all JavaScript files
    src_dir = Path('/app/frontend/src')
    js_files = list(src_dir.rglob('*.js')) + list(src_dir.rglob('*.jsx'))
    
    print(f"Found {len(js_files)} JavaScript files\n")
    
    # Process each file
    for filepath in js_files:
        process_file(str(filepath))
    
    # Print summary
    print()
    print("=" * 60)
    print("Summary")
    print("=" * 60)
    print(f"Files processed: {stats['files_processed']}")
    print(f"Files modified: {stats['files_modified']}")
    print(f"console.log → logger.debug: {stats['console_log_replaced']}")
    print(f"console.error → logger.error: {stats['console_error_replaced']}")
    print(f"console.warn → logger.warn: {stats['console_warn_replaced']}")
    print(f"console.info → logger.info: {stats['console_info_replaced']}")
    print(f"Total replacements: {sum([stats['console_log_replaced'], stats['console_error_replaced'], stats['console_warn_replaced'], stats['console_info_replaced']])}")
    print()
    print("✅ Console logging cleanup complete!")

if __name__ == '__main__':
    main()
