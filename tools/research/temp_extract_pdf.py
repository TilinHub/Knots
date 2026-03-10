import pypdf
import sys

def extract_text(pdf_path, txt_path):
    with open(pdf_path, 'rb') as f:
        reader = pypdf.PdfReader(f)
        text = ''
        for page in reader.pages:
            text += page.extract_text() + '\n\n'
    with open(txt_path, 'w', encoding='utf-8') as f:
        f.write(text)

if __name__ == "__main__":
    pdf_path = r"c:\Users\tomas\OneDrive\Desktop\Knots\papers\2005.13168v1.pdf"
    txt_path = r"c:\Users\tomas\OneDrive\Desktop\Knots\papers\extracted_text.txt"
    try:
        extract_text(pdf_path, txt_path)
        print("Successfully extracted text to", txt_path)
    except Exception as e:
        print("Error:", e)
