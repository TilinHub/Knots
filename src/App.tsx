import { useState } from 'react';
import { EditorPage } from "./features/editor/EditorPage";
import { KnotGallery } from "./features/gallery/KnotGallery";

export default function App() {
  const [showGallery, setShowGallery] = useState(true);

  if (showGallery) {
    return <KnotGallery onSelectKnot={() => setShowGallery(false)} />;
  }

  return <EditorPage />;
}
