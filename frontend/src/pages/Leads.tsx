import { useEffect, useState } from 'react';
import { leadsApi } from '../lib/api';
import {
    DndContext,
    DragOverlay,
    PointerSensor,
    useSensor,
    useSensors,
    useDroppable,
    useDraggable,
} from '@dnd-kit/core';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import { Globe, MapPin, TrendingUp } from 'lucide-react';

interface Lead {
    id: number;
    company_name: string;
    website: string | null;
    region: string | null;
    status: string;
    vetting_status: string;
    score: number;
    pain_points: any;
}

const COLUMNS = [
    { id: 'new', label: 'New', color: 'zinc' },
    { id: 'vetted', label: 'Vetted', color: 'blue' },
    { id: 'enriching', label: 'Enriching', color: 'purple' },
    { id: 'enriched', label: 'Enriched', color: 'green' },
    { id: 'contacted', label: 'Contacted', color: 'orange' },
];

export function Leads() {
    const [leads, setLeads] = useState<Lead[]>([]);
    const [activeId, setActiveId] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        })
    );

    useEffect(() => {
        fetchLeads();
    }, []);

    const fetchLeads = async () => {
        try {
            const response = await leadsApi.list({ limit: 100 });
            setLeads(response.data);
        } catch (error) {
            console.error('Failed to fetch leads:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as number);
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;

        if (!over) {
            setActiveId(null);
            return;
        }

        const leadId = active.id as number;
        const newStatus = over.id as string;

        // Update lead status locally
        setLeads(prev => prev.map(lead =>
            lead.id === leadId ? { ...lead, status: newStatus } : lead
        ));

        // Update on server
        try {
            await leadsApi.update(leadId, { status: newStatus });
        } catch (error) {
            console.error('Failed to update lead:', error);
            // Revert on error
            fetchLeads();
        }

        setActiveId(null);
    };

    const getLeadsByStatus = (status: string) => {
        return leads.filter(lead => lead.status === status);
    };

    const activeLead = leads.find(lead => lead.id === activeId);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="text-zinc-500">Loading leads...</div>
            </div>
        );
    }

    return (
        <div className="p-8 h-full flex flex-col">
            <div className="mb-8">
                <h1 className="text-3xl font-bold">Leads Pipeline</h1>
                <p className="text-zinc-400 mt-2">Drag and drop leads between stages</p>
            </div>

            <DndContext
                sensors={sensors}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
            >
                <div className="flex-1 flex gap-4 overflow-x-auto pb-4">
                    {COLUMNS.map(column => (
                        <KanbanColumn
                            key={column.id}
                            id={column.id}
                            label={column.label}
                            color={column.color}
                            leads={getLeadsByStatus(column.id)}
                        />
                    ))}
                </div>

                <DragOverlay>
                    {activeLead && <LeadCard lead={activeLead} isDragging />}
                </DragOverlay>
            </DndContext>
        </div>
    );
}

interface KanbanColumnProps {
    id: string;
    label: string;
    color: string;
    leads: Lead[];
}

function KanbanColumn({ id, label, color, leads }: KanbanColumnProps) {
    const { setNodeRef } = useDroppable({ id });

    return (
        <div
            ref={setNodeRef}
            className="flex-shrink-0 w-80 bg-zinc-950 rounded-xl border border-zinc-800 flex flex-col"
        >
            <div className="p-4 border-b border-zinc-800">
                <div className="flex items-center justify-between">
                    <h3 className="font-bold text-lg">{label}</h3>
                    <span className="text-sm text-zinc-500 bg-zinc-900 px-2 py-1 rounded">
                        {leads.length}
                    </span>
                </div>
            </div>

            <div className="flex-1 p-3 space-y-3 overflow-y-auto">
                {leads.map(lead => (
                    <DraggableLeadCard key={lead.id} lead={lead} />
                ))}

                {leads.length === 0 && (
                    <div className="text-center text-zinc-600 text-sm py-8">
                        No leads in this stage
                    </div>
                )}
            </div>
        </div>
    );
}

interface DraggableLeadCardProps {
    lead: Lead;
}

function DraggableLeadCard({ lead }: DraggableLeadCardProps) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: lead.id,
    });

    const style = transform ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    } : undefined;

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...listeners}
            {...attributes}
            className={isDragging ? 'opacity-50' : ''}
        >
            <LeadCard lead={lead} />
        </div>
    );
}

interface LeadCardProps {
    lead: Lead;
    isDragging?: boolean;
}

function LeadCard({ lead, isDragging = false }: LeadCardProps) {
    return (
        <div className={`
      bg-zinc-900 border border-zinc-800 rounded-lg p-4 cursor-grab active:cursor-grabbing
      hover:border-zinc-700 transition-all
      ${isDragging ? 'shadow-2xl rotate-3' : ''}
    `}>
            <div className="flex items-start justify-between mb-3">
                <h4 className="font-semibold text-white line-clamp-1">{lead.company_name}</h4>
                {lead.score > 0 && (
                    <div className="flex items-center gap-1 text-xs text-green-400 bg-green-500/10 px-2 py-1 rounded">
                        <TrendingUp size={12} />
                        {lead.score}
                    </div>
                )}
            </div>

            <div className="space-y-2 text-sm text-zinc-400">
                {lead.website && (
                    <div className="flex items-center gap-2">
                        <Globe size={14} className="flex-shrink-0" />
                        <span className="truncate text-xs">{lead.website}</span>
                    </div>
                )}

                {lead.region && (
                    <div className="flex items-center gap-2">
                        <MapPin size={14} className="flex-shrink-0" />
                        <span className="text-xs">{lead.region}</span>
                    </div>
                )}
            </div>

            <div className="mt-3 flex items-center gap-2">
                <span className={`
          text-xs px-2 py-1 rounded
          ${lead.vetting_status === 'approved' ? 'bg-green-500/10 text-green-400' :
                        lead.vetting_status === 'rejected' ? 'bg-red-500/10 text-red-400' :
                            'bg-yellow-500/10 text-yellow-400'}
        `}>
                    {lead.vetting_status}
                </span>
            </div>
        </div>
    );
}


