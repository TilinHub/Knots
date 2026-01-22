/**
 * Ejemplos ilustrativos de los 6 tipos de Dubins paths
 * 
 * Estos ejemplos demuestran las condiciones geométricas necesarias
 * para cada tipo de path según la clasificación de Dubins (1957)
 */

import { DubinsPathCalculator, Pose2D, DubinsPathType } from './DubinsPaths';
import { KnotLengthCalculator, Point2D } from './KnotLength';

/**
 * Configuraciones de ejemplo que garantizan cada tipo de Dubins path
 */
export const DUBINS_EXAMPLES = {
  /**
   * LSL: Left-Straight-Left
   * 
   * Condición: Los círculos izquierdos no se intersectan
   * Tangente externa entre círculos izquierdos
   */
  LSL: {
    start: { x: 0, y: 0, theta: 0 } as Pose2D,
    end: { x: 10, y: 0, theta: 0 } as Pose2D,
    description: 'Movimiento recto con giros suaves a la izquierda',
    expectedType: 'LSL' as DubinsPathType
  },

  /**
   * RSR: Right-Straight-Right
   * 
   * Simétrico a LSL pero con giros a la derecha
   */
  RSR: {
    start: { x: 0, y: 0, theta: 0 } as Pose2D,
    end: { x: 10, y: 0, theta: 0 } as Pose2D,
    description: 'Movimiento recto con giros suaves a la derecha',
    expectedType: 'RSR' as DubinsPathType
  },

  /**
   * LSR: Left-Straight-Right
   * 
   * Condición: d(c_l(start), c_r(end)) >= 2r
   * Tangente interna entre círculo izquierdo y derecho
   */
  LSR: {
    start: { x: 0, y: 0, theta: 0 } as Pose2D,
    end: { x: 5, y: 3, theta: Math.PI } as Pose2D,
    description: 'Giro izquierdo, recto, luego giro derecho (S-curve)',
    expectedType: 'LSR' as DubinsPathType
  },

  /**
   * RSL: Right-Straight-Left
   * 
   * Condición: d(c_r(start), c_l(end)) >= 2r
   * Simétrico a LSR
   */
  RSL: {
    start: { x: 0, y: 0, theta: 0 } as Pose2D,
    end: { x: 5, y: -3, theta: Math.PI } as Pose2D,
    description: 'Giro derecho, recto, luego giro izquierdo (S-curve invertida)',
    expectedType: 'RSL' as DubinsPathType
  },

  /**
   * LRL: Left-Right-Left
   * 
   * Condición: d(c_l(start), c_l(end)) <= 4r
   * Tres círculos tangentes (L-R-L)
   */
  LRL: {
    start: { x: 0, y: 0, theta: 0 } as Pose2D,
    end: { x: 3, y: 0, theta: Math.PI } as Pose2D,
    description: 'U-turn compleja con tres arcos (izq-der-izq)',
    expectedType: 'LRL' as DubinsPathType
  },

  /**
   * RLR: Right-Left-Right
   * 
   * Condición: d(c_r(start), c_r(end)) <= 4r
   * Simétrico a LRL
   */
  RLR: {
    start: { x: 0, y: 0, theta: 0 } as Pose2D,
    end: { x: 3, y: 0, theta: Math.PI } as Pose2D,
    description: 'U-turn compleja con tres arcos (der-izq-der)',
    expectedType: 'RLR' as DubinsPathType
  }
};

/**
 * Ejecuta todos los ejemplos y muestra resultados
 */
export function runAllExamples(): void {
  console.log('='.repeat(70));
  console.log('EJEMPLOS DE LOS 6 TIPOS DE DUBINS PATHS');
  console.log('Basado en Dubins (1957) y Díaz & Ayala (2020)');
  console.log('='.repeat(70));
  console.log();

  const calculator = new DubinsPathCalculator(1.0); // Radio = 1.0

  for (const [type, example] of Object.entries(DUBINS_EXAMPLES)) {
    console.log(`--- ${type}: ${example.description} ---`);
    console.log(`Start: (${example.start.x}, ${example.start.y}, ${rad2deg(example.start.theta)}°)`);
    console.log(`End:   (${example.end.x}, ${example.end.y}, ${rad2deg(example.end.theta)}°)`);
    console.log();

    // Calcular todos los paths
    const result = calculator.computeAllPaths(example.start, example.end);

    console.log(`Paths válidos encontrados: ${result.paths.length}`);
    
    // Mostrar todos los paths válidos ordenados por longitud
    const sortedPaths = result.paths
      .filter(p => p.isValid)
      .sort((a, b) => a.totalLength - b.totalLength);

    sortedPaths.forEach((path, i) => {
      const isOptimal = path === result.optimal;
      console.log(
        `  ${i + 1}. ${path.type}: L = ${path.totalLength.toFixed(4)} ${isOptimal ? '(*ÓPTIMO*)' : ''}`
      );
      
      // Mostrar descomposición de segmentos
      const segmentInfo = path.segments
        .map(s => `${s.type}(${s.length.toFixed(2)})`)
        .join(' + ');
      console.log(`     Segmentos: ${segmentInfo}`);
    });

    console.log();
  }
}

/**
 * Ejemplo: Trefoil knot (nudo trébol)
 * 
 * Demuestra cómo calcular la longitud de un nudo clásico
 */
export function trefoilKnotExample(): void {
  console.log('='.repeat(70));
  console.log('EJEMPLO: TREFOIL KNOT (Nudo Trébol)');
  console.log('='.repeat(70));
  console.log();

  // Puntos de control del trefoil knot (parametrización aproximada)
  const trefoilPoints: Point2D[] = [];
  const numPoints = 12;
  
  for (let i = 0; i < numPoints; i++) {
    const t = (2 * Math.PI * i) / numPoints;
    
    // Parametrización del trefoil: (sin(t) + 2*sin(2t), cos(t) - 2*cos(2t))
    const x = 3 * (Math.sin(t) + 2 * Math.sin(2 * t));
    const y = 3 * (Math.cos(t) - 2 * Math.cos(2 * t));
    
    trefoilPoints.push({ x, y });
  }

  const calculator = new KnotLengthCalculator({
    minRadius: 0.5,  // Radio más pequeño para nudo compacto
    closed: true
  });

  console.log(`Número de puntos de control: ${trefoilPoints.length}`);
  console.log(`Radio mínimo de curvatura: 0.5`);
  console.log();

  const result = calculator.computeLength(trefoilPoints);

  console.log(`--- RESULTADOS ---`);
  console.log(`Longitud total (Dubins): ${result.totalLength.toFixed(4)}`);
  console.log(`Curvatura promedio: ${result.averageCurvature.toFixed(4)}`);
  console.log(`Curvatura máxima: ${result.maxCurvature.toFixed(4)}`);
  console.log();

  console.log(`--- Distribución de tipos de paths ---`);
  const total = Object.values(result.statistics).reduce((a, b) => a + b, 0);
  for (const [type, count] of Object.entries(result.statistics)) {
    if (count > 0) {
      const pct = ((count / total) * 100).toFixed(1);
      console.log(`  ${type}: ${count} segmentos (${pct}%)`);
    }
  }
  console.log();

  // Generar reporte completo
  console.log(calculator.generateReport(trefoilPoints));
}

/**
 * Comparación de diferentes radios de curvatura
 */
export function curvatureComparison(): void {
  console.log('='.repeat(70));
  console.log('COMPARACIÓN: Efecto del radio de curvatura en la longitud');
  console.log('='.repeat(70));
  console.log();

  // Nudo simple: cuadrado
  const squareKnot: Point2D[] = [
    { x: 0, y: 0 },
    { x: 4, y: 0 },
    { x: 4, y: 4 },
    { x: 0, y: 4 }
  ];

  const radii = [0.1, 0.5, 1.0, 2.0];

  console.log('Nudo: Cuadrado 4x4');
  console.log();
  console.log('Radio | Longitud | Energía Curvatura');
  console.log('------|----------|------------------');

  for (const r of radii) {
    const calc = new KnotLengthCalculator({ minRadius: r, closed: true });
    const result = calc.computeLength(squareKnot);
    const energy = calc.computeCurvatureEnergy(squareKnot);

    console.log(
      `${r.toFixed(1).padStart(5)} | ${result.totalLength.toFixed(4).padStart(8)} | ${energy.toFixed(4).padStart(16)}`
    );
  }

  console.log();
  console.log('Observación: A menor radio, mayor longitud total debido a los giros.');
  console.log();
}

/**
 * Visualización ASCII de un Dubins path
 */
export function visualizePath(type: DubinsPathType): void {
  const example = DUBINS_EXAMPLES[type];
  if (!example) {
    console.error(`Tipo desconocido: ${type}`);
    return;
  }

  console.log(`=== ${type}: ${example.description} ===`);
  console.log();

  const calculator = new DubinsPathCalculator(1.0);
  const path = calculator.computeOptimalPath(example.start, example.end);

  if (!path || !path.isValid) {
    console.log('Path no válido');
    return;
  }

  console.log(`Tipo: ${path.type}`);
  console.log(`Longitud total: ${path.totalLength.toFixed(4)}`);
  console.log();
  console.log('Segmentos:');

  path.segments.forEach((seg, i) => {
    console.log(`  ${i + 1}. [${seg.type}] Longitud: ${seg.length.toFixed(4)}`);
    
    if (seg.type !== 'S') {
      console.log(`     Centro: (${seg.center!.x.toFixed(2)}, ${seg.center!.y.toFixed(2)})`);
      console.log(`     Radio: ${seg.radius!.toFixed(2)}`);
      console.log(`     Ángulo: ${rad2deg(seg.startAngle!).toFixed(1)}° → ${rad2deg(seg.endAngle!).toFixed(1)}°`);
    }
  });

  console.log();
}

/**
 * Caso especial: Comparación de paths LRL vs RLR para U-turn
 */
export function uturnComparison(): void {
  console.log('='.repeat(70));
  console.log('CASO ESPECIAL: U-turn (180°) - Comparación LRL vs RLR');
  console.log('='.repeat(70));
  console.log();

  const start: Pose2D = { x: 0, y: 0, theta: 0 };
  const end: Pose2D = { x: 3, y: 0, theta: Math.PI };

  const calculator = new DubinsPathCalculator(1.0);
  const result = calculator.computeAllPaths(start, end);

  console.log(`Start: (${start.x}, ${start.y}, ${rad2deg(start.theta)}°)`);
  console.log(`End:   (${end.x}, ${end.y}, ${rad2deg(end.theta)}°)`);
  console.log();
  console.log(`Distancia euclidiana: ${Math.sqrt((end.x - start.x) ** 2).toFixed(4)}`);
  console.log();

  console.log('Paths válidos:');
  result.paths
    .filter(p => p.isValid)
    .forEach(p => {
      const isOptimal = p === result.optimal;
      console.log(
        `  ${p.type}: L = ${p.totalLength.toFixed(4)} ${isOptimal ? '<<< ÓPTIMO' : ''}`
      );
    });

  console.log();
  console.log('Nota: Para U-turns, LRL y RLR suelen ser óptimos cuando d ≤ 4r.');
  console.log();
}

// ============================================================================
// UTILIDADES
// ============================================================================

function rad2deg(rad: number): number {
  return (rad * 180) / Math.PI;
}

function deg2rad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Ejecuta todos los ejemplos
 */
export function runAllDemos(): void {
  runAllExamples();
  console.log('\n');
  
  trefoilKnotExample();
  console.log('\n');
  
  curvatureComparison();
  console.log('\n');
  
  uturnComparison();
  console.log('\n');
  
  // Visualizar cada tipo
  for (const type of ['LSL', 'RSR', 'LSR', 'RSL', 'LRL', 'RLR'] as DubinsPathType[]) {
    visualizePath(type);
    console.log('\n');
  }
}

// Si se ejecuta directamente
if (typeof require !== 'undefined' && require.main === module) {
  runAllDemos();
}
