export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

export type Database = {
    public: {
        Tables: {
            clients: {
                Row: {
                    id: string
                    created_at: string
                    name: string
                    owner_id: string
                }
                Insert: {
                    id?: string
                    created_at?: string
                    name: string
                    owner_id: string
                }
                Update: {
                    id?: string
                    created_at?: string
                    name?: string
                    owner_id?: string
                }
                Relationships: []
            }
            projects: {
                Row: {
                    id: string
                    created_at: string
                    name: string
                    client_id: string
                    owner_id: string
                }
                Insert: {
                    id?: string
                    created_at?: string
                    name: string
                    client_id: string
                    owner_id: string
                }
                Update: {
                    id?: string
                    created_at?: string
                    name?: string
                    client_id?: string
                    owner_id?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "projects_client_id_fkey"
                        columns: ["client_id"]
                        referencedRelation: "clients"
                        referencedColumns: ["id"]
                    }
                ]
            }
            repositories: {
                Row: {
                    id: string
                    created_at: string
                    name: string
                    url: string
                    project_id: string | null
                    owner_id: string
                }
                Insert: {
                    id?: string
                    created_at?: string
                    name: string
                    url: string
                    project_id?: string | null
                    owner_id: string
                }
                Update: {
                    id?: string
                    created_at?: string
                    name?: string
                    url?: string
                    project_id?: string | null
                    owner_id?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "repositories_project_id_fkey"
                        columns: ["project_id"]
                        referencedRelation: "projects"
                        referencedColumns: ["id"]
                    }
                ]
            }
            leads: {
                Row: {
                    id: string
                    created_at: string
                    company: string
                    email: string | null
                    phone: string | null
                    city: string | null
                    category: string | null
                    website: string | null
                    source: string | null
                    first_name: string | null
                    last_name: string | null
                    contact_method: string | null
                    contacted_at: string | null
                    message_id: string | null
                    outreach_message: string | null
                    priority_score: number | null
                    status: string
                    owner_id: string | null
                }
                Insert: {
                    id?: string
                    created_at?: string
                    company: string
                    email?: string | null
                    phone?: string | null
                    city?: string | null
                    category?: string | null
                    website?: string | null
                    source?: string | null
                    first_name?: string | null
                    last_name?: string | null
                    contact_method?: string | null
                    contacted_at?: string | null
                    message_id?: string | null
                    outreach_message?: string | null
                    priority_score?: number | null
                    status?: string
                    owner_id?: string | null
                }
                Update: {
                    id?: string
                    created_at?: string
                    company?: string
                    email?: string | null
                    phone?: string | null
                    city?: string | null
                    category?: string | null
                    website?: string | null
                    source?: string | null
                    first_name?: string | null
                    last_name?: string | null
                    contact_method?: string | null
                    contacted_at?: string | null
                    message_id?: string | null
                    outreach_message?: string | null
                    priority_score?: number | null
                    status?: string
                    owner_id?: string | null
                }
                Relationships: []
            }
            outreach_logs: {
                Row: {
                    id: string
                    created_at: string
                    lead_id: string
                    message: string
                    type: string
                    owner_id: string
                }
                Insert: {
                    id?: string
                    created_at?: string
                    lead_id: string
                    message: string
                    type: string
                    owner_id: string
                }
                Update: {
                    id?: string
                    created_at?: string
                    lead_id?: string
                    message?: string
                    type?: string
                    owner_id?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "outreach_logs_lead_id_fkey"
                        columns: ["lead_id"]
                        referencedRelation: "leads"
                        referencedColumns: ["id"]
                    }
                ]
            }
            deployments: {
                Row: {
                    id: string
                    created_at: string
                    project_id: string
                    status: string
                    environment: string
                    owner_id: string
                }
                Insert: {
                    id?: string
                    created_at?: string
                    project_id: string
                    status: string
                    environment: string
                    owner_id: string
                }
                Update: {
                    id?: string
                    created_at?: string
                    project_id?: string
                    status?: string
                    environment?: string
                    owner_id?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "deployments_project_id_fkey"
                        columns: ["project_id"]
                        referencedRelation: "projects"
                        referencedColumns: ["id"]
                    }
                ]
            }
            workflow_executions: {
                Row: {
                    id: string
                    created_at: string
                    workflow_name: string
                    status: string
                    owner_id: string
                }
                Insert: {
                    id?: string
                    created_at?: string
                    workflow_name: string
                    status: string
                    owner_id: string
                }
                Update: {
                    id?: string
                    created_at?: string
                    workflow_name?: string
                    status?: string
                    owner_id?: string
                }
                Relationships: []
            }
            ai_usage: {
                Row: {
                    id: string
                    created_at: string
                    tokens_used: number
                    model: string
                    owner_id: string
                }
                Insert: {
                    id?: string
                    created_at?: string
                    tokens_used: number
                    model: string
                    owner_id: string
                }
                Update: {
                    id?: string
                    created_at?: string
                    tokens_used?: number
                    model?: string
                    owner_id?: string
                }
                Relationships: []
            }
        }
        Views: {
            [_ in never]: never
        }
        Functions: {
            [_ in never]: never
        }
        Enums: {
            [_ in never]: never
        }
        CompositeTypes: {
            [_ in never]: never
        }
    }
}
