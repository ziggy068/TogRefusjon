#!/usr/bin/env python3
import re

# Read the file
with open(r'D:\TogRefusjon\frontend\src\app\billetter\add\page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Find and remove the train lookup section (from comment to closing div)
pattern = r'\s*\{/\* Train Lookup Button \(TR-IM-303\) \*/\}.*?\{/\* Arrival Date'
replacement = '            {/* Arrival Date'

content = re.sub(pattern, replacement, content, flags=re.DOTALL)

# Write back
with open(r'D:\TogRefusjon\frontend\src\app\billetter\add\page.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Train lookup section removed successfully!")
