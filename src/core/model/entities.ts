export type Id = string;

export type KnotNode = {
  id: Id;
  kind: "node";
  x: number;
  y: number;
  r: number;
  label?: string;
};

export type SceneEntity = KnotNode;

export type Scene = {
  entities: SceneEntity[];
};
