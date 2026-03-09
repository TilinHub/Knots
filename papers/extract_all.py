import pypdf
import os
import glob

pdf_files = glob.glob(r"c:\Users\tomas\OneDrive\Desktop\Knots\papers\*.pdf")
for pdf in pdf_files:
    txt_path = pdf.replace(".pdf", ".txt")
    if not os.path.exists(txt_path):
        print(f"Extracting {pdf}...")
        try:
            with open(pdf, 'rb') as f:
                reader = pypdf.PdfReader(f)
                text = ''
                for page in reader.pages:
                    if page.extract_text():
                        text += page.extract_text() + '\n\n'
            with open(txt_path, 'w', encoding='utf-8') as f:
                f.write(text)
        except Exception as e:
            print(f"Error on {pdf}: {e}")
