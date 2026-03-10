# experiments/

Scripts de exploración y debug. NO son tests automatizados.

## Convención
- Ejecutar con: `npx tsx <archivo>.ts`
- No usar describe / it / expect
- Nombres descriptivos sin prefijo `test_`
- Un directorio por tema: intersection/, ribbon/, etc.

## Diferencia con tests/
| | experiments/ | tests/ |
|---|---|---|
| Runner | npx tsx | vitest |
| Assertion | console.log | expect() |
| CI | ✗ no corre | ✅ corre siempre |
| Prefijo | ninguno | *.test.ts |
