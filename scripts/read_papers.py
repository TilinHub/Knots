import os
import sys

papers_dir = os.path.join(os.path.dirname(__file__), '../papers')
output_file = os.path.join(os.path.dirname(__file__), 'papers_text.txt')

import fitz # PyMuPDF
with open(output_file, 'w', encoding='utf-8') as f:
    for file in os.listdir(papers_dir):
        if file.endswith('.pdf'):
            f.write(f"\n\n{'='*40}\n--- Reading {file} ---\n{'='*40}\n\n")
            try:
                doc = fitz.open(os.path.join(papers_dir, file))
                text = ""
                for page in doc[:3]: # First 3 pages of each
                    text += page.get_text()
                f.write(text)
            except Exception as e:
                f.write(f"Error: {e}\n")

print(f"Done reading. Output saved to {output_file}")
