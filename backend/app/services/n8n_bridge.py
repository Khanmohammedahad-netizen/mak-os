"""
n8n Bridge Service - Handles communication with n8n workflows

This service provides a clean interface for sending commands to n8n
and manages webhook URLs, authentication, and error handling.
"""
import httpx
from typing import Dict, Any, Optional
from app.config import settings

class N8nBridge:
    """
    Service for communicating with n8n workflows via webhooks
    """
    
    def __init__(self):
        self.webhook_base = settings.n8n_webhook_base
        self.auth_user = settings.n8n_basic_auth_user
        self.auth_password = settings.n8n_basic_auth_password
    
    async def send_webhook(
        self,
        workflow_name: str,
        payload: Dict[str, Any],
        timeout: int = 30
    ) -> tuple[bool, Optional[Dict[str, Any]], Optional[str]]:
        """
        Send a webhook request to an n8n workflow.
        
        Args:
            workflow_name: Name of the workflow (e.g., "enrichment-tech")
            payload: Data to send to the workflow
            timeout: Request timeout in seconds
        
        Returns:
            Tuple of (success: bool, response_data: dict | None, error: str | None)
        """
        url = f"{self.webhook_base}/{workflow_name}"
        
        # Prepare auth if configured
        auth = None
        if self.auth_user and self.auth_password:
            auth = httpx.BasicAuth(self.auth_user, self.auth_password)
        
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.post(
                    url,
                    json=payload,
                    auth=auth
                )
                
                response.raise_for_status()
                
                # Try to parse JSON response
                try:
                    data = response.json()
                except Exception:
                    data = {"status": "ok"}
                
                return True, data, None
        
        except httpx.HTTPStatusError as e:
            error_msg = f"HTTP {e.response.status_code}: {e.response.text[:200]}"
            return False, None, error_msg
        
        except httpx.RequestError as e:
            error_msg = f"Request failed: {str(e)}"
            return False, None, error_msg
        
        except Exception as e:
            error_msg = f"Unexpected error: {str(e)}"
            return False, None, error_msg
    
    async def trigger_tech_debt_analysis(
        self,
        lead_id: int,
        website: str
    ) -> tuple[bool, Optional[str]]:
        """
        Trigger tech debt analysis workflow for a website.
        
        Args:
            lead_id: ID of the lead to analyze
            website: Website URL to analyze
        
        Returns:
            Tuple of (success: bool, error: str | None)
        """
        payload = {
            "lead_id": lead_id,
            "website": website
        }
        
        success, response, error = await self.send_webhook(
            "enrichment-tech",
            payload
        )
        
        return success, error
    
    async def trigger_review_mining(
        self,
        lead_id: int,
        company_name: str
    ) -> tuple[bool, Optional[str]]:
        """
        Trigger review mining workflow for a company.
        
        Args:
            lead_id: ID of the lead
            company_name: Company name to search for reviews
        
        Returns:
            Tuple of (success: bool, error: str | None)
        """
        payload = {
            "lead_id": lead_id,
            "company_name": company_name
        }
        
        success, response, error = await self.send_webhook(
            "enrichment-reviews",
            payload
        )
        
        return success, error

# Singleton instance
n8n_bridge = N8nBridge()
