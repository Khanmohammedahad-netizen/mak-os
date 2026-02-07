"""
BaseAgent - Abstract base class for all MAK OS agents

All agents must inherit from this class and implement the execute() method.
The base class provides:
- Automatic logging to agent_logs table
- Consistent error handling
- Async execution pattern
"""
from abc import ABC, abstractmethod
from datetime import datetime
from typing import Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import AsyncSessionLocal
from app.models import AgentLog
from dataclasses import dataclass

@dataclass
class AgentResult:
    """Result of an agent execution"""
    status: str  # 'success', 'failed', 'partial'
    leads_processed: int
    error_message: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None

class BaseAgent(ABC):
    """
    Abstract base class for all agents.
    
    Usage:
        class MyAgent(BaseAgent):
            def __init__(self):
                super().__init__(name="My Agent", description="Does something")
            
            async def execute(self, context: dict) -> AgentResult:
                # Your agent logic here
                return AgentResult(
                    status='success',
                    leads_processed=10
                )
    """
    
    def __init__(self, name: str, description: str = ""):
        self.name = name
        self.description = description
        self._start_time: Optional[datetime] = None
        self._log_id: Optional[int] = None
    
    @abstractmethod
    async def execute(self, context: Optional[Dict[str, Any]] = None) -> AgentResult:
        """
        Execute the agent's main logic.
        
        Args:
            context: Optional context dictionary with parameters for the agent
            
        Returns:
            AgentResult with status, leads_processed, and optional error_message
        """
        pass
    
    async def run(self, context: Optional[Dict[str, Any]] = None) -> AgentResult:
        """
        Run the agent with automatic logging.
        This method should be called instead of execute() directly.
        """
        self._start_time = datetime.utcnow()
        
        async with AsyncSessionLocal() as db:
            # Create initial log entry
            log = AgentLog(
                agent_name=self.name,
                start_time=self._start_time,
                status='running',
                leads_processed=0
            )
            db.add(log)
            await db.flush()
            await db.refresh(log)
            self._log_id = log.id
            await db.commit()
        
        try:
            # Execute the agent logic
            result = await self.execute(context)
            
            # Update log with success
            await self._update_log(
                status=result.status,
                leads_processed=result.leads_processed,
                error_message=result.error_message
            )
            
            return result
            
        except Exception as e:
            # Update log with failure
            error_msg = f"{type(e).__name__}: {str(e)}"
            await self._update_log(
                status='failed',
                leads_processed=0,
                error_message=error_msg
            )
            
            # Re-raise the exception
            raise
    
    async def _update_log(
        self,
        status: str,
        leads_processed: int,
        error_message: Optional[str] = None
    ):
        """Update the agent log entry"""
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(AgentLog).where(AgentLog.id == self._log_id)
            )
            log = result.scalar_one_or_none()
            
            if log:
                log.end_time = datetime.utcnow()
                log.status = status
                log.leads_processed = leads_processed
                if error_message:
                    log.error_message = error_message
                
                await db.commit()
