# tools/

Utilidades de desarrollo. No forman parte del build ni del runtime.

## research/
Scripts para procesar y leer papers académicos de referencia matemática.
- `extract_all.py` — extrae texto de PDFs
- `read_papers.js / read_papers.py` — lectura estructurada de papers
- `temp_extract_pdf.py` — extracción rápida temporal
- `data/papers_text.txt` — texto extraído (output generado)

## debug/
Scripts de reproducción manual de bugs y casos de prueba aislados.
No son tests formales — son herramientas de investigación de problemas.
- `reproduce_bent.ts` — reproduce caso de curvatura bent
- `test_matrix.ts` — prueba manual de operaciones de matriz
