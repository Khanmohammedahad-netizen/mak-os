"""
OutreachDraft Model - Stores AI-generated outreach messages
"""
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database import Base

class OutreachDraft(Base):
    __tablename__ = "outreach_drafts"
    
    # Primary Key
    id = Column(Integer, primary_key=True, index=True)
    
    # Link to Lead
    lead_id = Column(Integer, ForeignKey("leads.id"), nullable=False)
    
    # Outreach Details
    platform = Column(String(50), nullable=False)  # email, whatsapp, linkedin
    content = Column(Text, nullable=False)
    
    status = Column(
        String(50),
        default="draft",
        nullable=False
    )  # draft, approved, sent
    
    # Timestamp
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    lead = relationship("Lead", back_populates="outreach_drafts")
