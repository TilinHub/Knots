export type Id = string;

export type Point = {
  id: Id;
  kind: "point";
  x: number;
  y: number;
};

export type Segment = {
  id: Id;
  kind: "segment";
  a: Id; // point id
  b: Id; // point id
};

export type Arc = {
  id: Id;
  kind: "arc";
  c: { x: number; y: number }; // centro (x,y)
  startAngle: number; // radianes
  endAngle: number; // radianes
  sweep: "ccw" | "cw";
};

export type Primitive = Segment | Arc;

export type Scene = {
  radius: number; // radio geométrico (para cálculos, usar 1)
  visualRadius: number; // radio visual (para renderizado, puede ser grande)
  points: Point[];
  primitives: Primitive[];
};
