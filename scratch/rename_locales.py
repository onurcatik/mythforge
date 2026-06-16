import os
import re

locales_dir = "/Users/onurcatik/Downloads/initiative 4/frontend/public/locales"

replacements = [
    (re.compile(r'\bInitiatives\b'), "Mythforges"),
    (re.compile(r'\binitiatives\b'), "mythforges"),
    (re.compile(r'\bInitiative\b'), "Mythforge"),
    (re.compile(r'\binitiative\b'), "mythforge"),
]

for root, dirs, files in os.walk(locales_dir):
    for file in files:
        if file.endswith('.json'):
            path = os.path.join(root, file)
            with open(path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            orig = content
            for pattern, replacement in replacements:
                content = pattern.sub(replacement, content)
            
            if content != orig:
                print(f"Updating {path}")
                with open(path, 'w', encoding='utf-8') as f:
                    f.write(content)
