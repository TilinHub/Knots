
import os
import pdfplumber

papers_dir = os.path.join(os.getcwd(), 'papers')
files = [f for f in os.listdir(papers_dir) if f.endswith('.pdf')]

def read_pdf(file_path):
    try:
        with pdfplumber.open(file_path) as pdf:
            text = ""
            for page in pdf.pages:
                text += page.extract_text() + "\n"
            
            output_text = f"\n\n--- START OF {os.path.basename(file_path)} ---\n"
            output_text += text[:50000] # Limit to 50k chars per file
            output_text += f"\n--- END OF {os.path.basename(file_path)} ---\n"
            
            with open('pdfs_extracted.txt', 'a', encoding='utf-8') as f:
                f.write(output_text)
            print(f"Processed {file_path}")
    except Exception as e:
        print(f"Error reading {file_path}: {e}")

if __name__ == "__main__":
    for file in files:
        read_pdf(os.path.join(papers_dir, file))
