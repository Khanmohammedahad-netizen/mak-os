"""
AgentLog Model - Tracks agent execution history
"""
from sqlalchemy import Column, Integer, String, Text, DateTime
from sqlalchemy.sql import func
from app.database import Base

class AgentLog(Base):
    __tablename__ = "agent_logs"
    
    # Primary Key
    id = Column(Integer, primary_key=True, index=True)
    
    # Agent Info
    agent_name = Column(String(100), nullable=False, index=True)
    
    # Execution Tracking
    start_time = Column(DateTime(timezone=True), server_default=func.now())
    end_time = Column(DateTime(timezone=True), nullable=True)
    
    status = Column(String(50), nullable=False)  # success, failed, partial
    leads_processed = Column(Integer, default=0)
    error_message = Column(Text, nullable=True)
    
    # Timestamp
    created_at = Column(DateTime(timezone=True), server_default=func.now())
