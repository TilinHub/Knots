
import os
import pdfplumber

path = os.path.join(os.getcwd(), 'papers', 'Fabiantesis.pdf')
print(f"Checking {path}")

if not os.path.exists(path):
    print("Does not exist")
else:
    try:
        with pdfplumber.open(path) as pdf:
            print(f"Pages: {len(pdf.pages)}")
            if len(pdf.pages) > 0:
                text = pdf.pages[0].extract_text()
                print("First page text:")
                print(text)
            else:
                print("No pages found")
    except Exception as e:
        print(f"Error: {e}")
