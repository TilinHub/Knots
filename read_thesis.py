
import os
import pdfplumber

papers_dir = os.path.join(os.getcwd(), 'papers')
target_files = ['Fabiantesis.pdf', 'Instrucciones.pdf']

def read_pdf(file_path):
    try:
        with pdfplumber.open(file_path) as pdf:
            text = ""
            # Limit to first 20 pages to avoid huge output, or just first 50k chars
            for i, page in enumerate(pdf.pages):
                if i > 20: break 
                text += page.extract_text() + "\n"
            
            print(f"\n\n--- START OF {os.path.basename(file_path)} ---\n")
            print(text[:50000]) 
            print(f"\n--- END OF {os.path.basename(file_path)} ---\n")
    except Exception as e:
        print(f"Error reading {file_path}: {e}")

if __name__ == "__main__":
    for fname in target_files:
        path = os.path.join(papers_dir, fname)
        if os.path.exists(path):
            read_pdf(path)
        else:
            print(f"File not found: {path}")
