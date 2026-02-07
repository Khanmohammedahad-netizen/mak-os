"""
Project Model - Tracks converted leads through delivery
"""
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Numeric
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database import Base

class Project(Base):
    __tablename__ = "projects"
    
    # Primary Key
    id = Column(Integer, primary_key=True, index=True)
    
    # Link to Lead
    lead_id = Column(Integer, ForeignKey("leads.id"), nullable=True)
    
    # Project Details
    stage = Column(
        String(50),
        default="discovery",
        nullable=False
    )  # discovery, build, launch
    
    value = Column(Numeric(10, 2), nullable=True)  # Project value in USD
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    lead = relationship("Lead", back_populates="projects")
