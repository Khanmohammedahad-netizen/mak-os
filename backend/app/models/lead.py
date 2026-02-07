"""
Lead Model - Core entity for the CRM pipeline
"""
from sqlalchemy import Column, Integer, String, Text, DateTime, JSON
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database import Base

class Lead(Base):
    __tablename__ = "leads"
    
    # Primary Key
    id = Column(Integer, primary_key=True, index=True)
    
    # Company Information
    company_name = Column(String(255), nullable=False, index=True)
    website = Column(String(500), nullable=True)
    region = Column(String(100), nullable=True, index=True)
    
    # Pipeline Status
    status = Column(
        String(50),
        default="new",
        nullable=False,
        index=True
    )  # new, vetted, enriched, contacted, closed
    
    vetting_status = Column(
        String(50),
        default="pending",
        nullable=False,
        index=True
    )  # pending, approved, rejected
    
    # Pain Points & Scoring
    pain_points = Column(JSON, nullable=True)  # Flexible JSON storage
    score = Column(Integer, default=0)  # 0-100 lead quality score
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    projects = relationship("Project", back_populates="lead")
    outreach_drafts = relationship("OutreachDraft", back_populates="lead")
