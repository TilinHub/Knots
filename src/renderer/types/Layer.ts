/**
 * Interface for a renderable layer in the CSCanvas.
 * Each feature (Knot, Dubins, Grid) should implement its own layer.
 */
export interface LayerProps {
    visible: boolean;
    // The specific data needed by this layer.
    // Layers should define their own specific props extending this if needed, 
    // or take a context object.
    blocks: any[];
    context?: any;
}

export interface Layer {
    id: string;
    render(props: LayerProps): React.ReactNode;
}
