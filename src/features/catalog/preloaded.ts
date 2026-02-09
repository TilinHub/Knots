
import type { CatalogEntry } from './catalogTypes';

export const PRELOADED_CATALOG: CatalogEntry[] = [
    {
        "knotId": "3 disks-g0",
        "numCrossings": 3,
        "initialConfig": {
            "blocks": [
                { "id": "d0", "kind": "disk", "center": { "x": 0.866, "y": -0.5 }, "radius": 1, "visualRadius": 50, "label": "D0" },
                { "id": "d1", "kind": "disk", "center": { "x": -0.866, "y": -0.5 }, "radius": 1, "visualRadius": 50, "label": "D1" },
                { "id": "d2", "kind": "disk", "center": { "x": 0, "y": 1 }, "radius": 1, "visualRadius": 50, "label": "D2" }
            ],
            "closed": true,
            "valid": true
        },
        "diskSequence": ["d0", "d1", "d2"],
        "timestamp": 1735700000000,
        "results": [
            {
                "movingDiskId": "d0",
                "direction": "right",
                "finalConfig": {
                    "blocks": [
                        { "id": "d0", "kind": "disk", "center": { "x": 0.866, "y": -0.5 }, "radius": 1, "visualRadius": 50, "label": "D0" },
                        { "id": "d1", "kind": "disk", "center": { "x": -0.866, "y": -0.5 }, "radius": 1, "visualRadius": 50, "label": "D1" },
                        { "id": "d2", "kind": "disk", "center": { "x": 0, "y": 1 }, "radius": 1, "visualRadius": 50, "label": "D2" }
                    ],
                    "closed": true,
                    "valid": true
                },
                "pathLength": 13.5,
                "stepsTaken": 1,
                "status": "Stable",
                // Manually Verified Chiralities for Trefoil
                "chiralities": ["L", "L", "L"]
            }
        ]
    }
];
