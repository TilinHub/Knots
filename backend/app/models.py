from pydantic import BaseModel
from typing import List, Optional, Literal

# Dubins Path Models

class Pose2D(BaseModel):
    """2D position and heading (x, y, theta)"""
    x: float
    y: float
    theta: float  # Heading angle in radians

class DubinsSegment(BaseModel):
    """Single segment of a Dubins path (arc or line)"""
    type: Literal["arc_left", "arc_right", "line"]
    length: float
    start_point: Pose2D
    end_point: Pose2D
    center: Optional[Pose2D] = None  # For circular arcs
    radius: Optional[float] = None    # For circular arcs

class DubinsPath(BaseModel):
    """Complete Dubins path solution"""
    path_type: Literal["LSL", "RSR", "LSR", "RSL", "LRL", "RLR"]
    segments: List[DubinsSegment]
    total_length: float
    start_pose: Pose2D
    end_pose: Pose2D

class DubinsPathRequest(BaseModel):
    """Request to compute Dubins path"""
    start_pose: Pose2D
    end_pose: Pose2D
    min_radius: float = 1.0
    compute_all: bool = False  # If True, return all 6 path types

class DubinsPathResponse(BaseModel):
    """Response with optimal Dubins path(s)"""
    optimal_path: DubinsPath
    all_paths: Optional[List[DubinsPath]] = None
    computation_time_ms: float

# Flexible Envelope Models

class Disk(BaseModel):
    """Disk in 2D space (center + radius)"""
    center: Pose2D
    radius: float

class EnvelopePoint(BaseModel):
    """Point on the convex envelope"""
    x: float
    y: float
    tangent_angle: Optional[float] = None

class FlexibleEnvelopeRequest(BaseModel):
    """Request to compute flexible envelope"""
    disks: List[Disk]
    smoothing_factor: float = 0.8  # Bezier curve smoothing [0-1]

class FlexibleEnvelopeResponse(BaseModel):
    """Response with envelope data"""
    envelope_points: List[EnvelopePoint]
    convex_hull_indices: List[int]
    smoothed_curve: List[Pose2D]
    computation_time_ms: float
