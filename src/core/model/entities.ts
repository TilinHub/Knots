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
  // Centro en coordenadas mundo (puedes cambiar a Point id si quieres)
  c: { x: number; y: number };
  startAngle: number; // radianes
  endAngle: number; // radianes
  sweep: "ccw" | "cw";
};

export type Primitive = Segment | Arc;

export type Scene = {
  radius: number; // radio global fijo para arcos
  points: Point[];
  primitives: Primitive[];
};
