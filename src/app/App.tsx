import { useState } from 'react';
import { EditorPage } from "../features/editor/EditorPage";
import { KnotGallery } from "../features/gallery/KnotGallery";

// Tipo para el nudo seleccionado
export interface SelectedKnot {
  id: number;
  name: string;
  nodes: number[];
  edges: [number, number][];
}

export default function App() {
  const [selectedKnot, setSelectedKnot] = useState<SelectedKnot | null>(null);

  if (selectedKnot === null) {
    return <KnotGallery onSelectKnot={setSelectedKnot} />;
  }

  return (
    <EditorPage 
      onBackToGallery={() => setSelectedKnot(null)}
      initialKnot={selectedKnot}
    />
  );
}
