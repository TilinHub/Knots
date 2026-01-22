"""FastAPI application for Knots mathematical research.

Provides RESTful endpoints for:
- Dubins path calculations (all 6 variants)
- Flexible envelope computations
- Knot topology analysis
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from time import time
import logging

from .models import (
    Pose2D, DubinsPathRequest, DubinsPathResponse,
    FlexibleEnvelopeRequest, FlexibleEnvelopeResponse
)
from .dubins_paths import DubinsPathCalculator

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create FastAPI application
app = FastAPI(
    title="Knots API",
    description="High-precision mathematical research platform for knot topology and Dubins paths",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Dubins path calculator
dubins_calculator = DubinsPathCalculator(min_radius=1.0)

# ========== Health & Info Endpoints ==========

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "version": "1.0.0"}

@app.get("/info")
async def api_info():
    """Get API information."""
    return {
        "name": "Knots Mathematical Research API",
        "version": "1.0.0",
        "features": [
            "Dubins path calculations (6 variants)",
            "Flexible envelope computation",
            "Knot topology analysis"
        ]
    }

# ========== Dubins Path Endpoints ==========

@app.post("/api/dubins/compute", response_model=DubinsPathResponse)
async def compute_dubins_path(request: DubinsPathRequest) -> DubinsPathResponse:
    """Compute optimal Dubins path between two poses.
    
    Args:
        request: DubinsPathRequest with start_pose, end_pose, and min_radius
        
    Returns:
        DubinsPathResponse with optimal path and optionally all 6 variants
    """
    try:
        start_time = time()
        
        # Validate input
        if request.min_radius <= 0:
            raise HTTPException(
                status_code=400,
                detail="min_radius must be positive"
            )
        
        # Update calculator with provided radius
        calculator = DubinsPathCalculator(min_radius=request.min_radius)
        
        # Compute optimal path
        optimal_path = calculator.compute_optimal_path(
            request.start_pose,
            request.end_pose
        )
        
        # Optionally compute all 6 paths
        all_paths = None
        if request.compute_all:
            all_paths = []
            for path_func in [
                calculator.compute_lsl,
                calculator.compute_rsr,
                calculator.compute_lsr,
                calculator.compute_rsl,
                calculator.compute_lrl,
                calculator.compute_rlr,
            ]:
                path = path_func(request.start_pose, request.end_pose)
                if path:
                    all_paths.append(path)
        
        computation_time_ms = (time() - start_time) * 1000
        
        return DubinsPathResponse(
            optimal_path=optimal_path,
            all_paths=all_paths,
            computation_time_ms=computation_time_ms
        )
        
    except ValueError as e:
        logger.error(f"Validation error: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error computing Dubins path: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Internal server error during Dubins path computation"
        )

@app.get("/api/dubins/info")
async def dubins_info():
    """Get information about Dubins path types."""
    return {
        "path_types": [
            {"name": "LSL", "description": "Left-Straight-Left"},
            {"name": "RSR", "description": "Right-Straight-Right"},
            {"name": "LSR", "description": "Left-Straight-Right"},
            {"name": "RSL", "description": "Right-Straight-Left"},
            {"name": "LRL", "description": "Left-Right-Left"},
            {"name": "RLR", "description": "Right-Left-Right"},
        ],
        "reference": "Diaz, A., & Ayala, L. (2020). Census of bounded curvature paths."
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
        log_level="info"
    )
