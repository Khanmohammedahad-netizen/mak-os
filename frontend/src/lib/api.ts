/**
 * API Client for MAK OS V2
 */
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Lead API
export const leadsApi = {
    list: (params?: { skip?: number; limit?: number; status?: string }) =>
        api.get('/api/leads', { params }),

    get: (id: number) =>
        api.get(`/api/leads/${id}`),

    create: (data: any) =>
        api.post('/api/leads', data),

    update: (id: number, data: any) =>
        api.patch(`/api/leads/${id}`, data),

    delete: (id: number) =>
        api.delete(`/api/leads/${id}`),
};

// Project API
export const projectsApi = {
    list: (params?: { skip?: number; limit?: number }) =>
        api.get('/api/projects', { params }),

    get: (id: number) =>
        api.get(`/api/projects/${id}`),

    create: (data: any) =>
        api.post('/api/projects', data),

    update: (id: number, data: any) =>
        api.patch(`/api/projects/${id}`, data),
};

// Agent API
export const agentsApi = {
    execute: (agentName: string, context?: any) =>
        api.post('/api/agents/execute', { agent_name: agentName, context }),

    getLogs: (params?: { skip?: number; limit?: number; agent_name?: string }) =>
        api.get('/api/agents/logs', { params }),
};
