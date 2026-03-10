# primitives/

## Responsabilidad
Primitivas matemáticas geométricas puras sin dependencias de dominio.
Son los bloques atómicos usados por todos los demás módulos de geometry/.

## Archivos
| Archivo | Descripción |
|---------|-------------|
| `bitangents.ts` | Cálculo de segmentos bitangentes entre dos discos |
| `intersections.ts` | Detección de intersecciones geométricas (segmento-disco, segmento-segmento) |

## Dependencias internas
- Importa de: `../types/cs` (Point2D), `../types/contactGraph` (tipos base)
- Es importado por: `envelope/`, `hull/`, `algorithms/`
