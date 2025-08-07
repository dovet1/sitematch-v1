import { Clock, CheckCircle, XCircle, Archive, Eye } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface StatusBadgeProps {
  status: string;
  className?: string;
}

const statusConfig: Record<string, { color: string; label: string; icon: any }> = {
  draft: { 
    color: 'bg-gradient-to-r from-slate-100 to-slate-50 text-slate-700 border-slate-200/80 shadow-sm', 
    label: 'Draft', 
    icon: Clock 
  },
  pending: { 
    color: 'bg-gradient-to-r from-amber-100 to-amber-50 text-amber-800 border-amber-200/80 shadow-sm ring-1 ring-amber-500/20', 
    label: 'Under Review', 
    icon: Clock 
  },
  pending_review: { 
    color: 'bg-gradient-to-r from-blue-100 to-blue-50 text-blue-800 border-blue-200/80 shadow-sm ring-1 ring-blue-500/20', 
    label: 'Awaiting Review', 
    icon: Eye 
  },
  approved: { 
    color: 'bg-gradient-to-r from-emerald-100 to-emerald-50 text-emerald-800 border-emerald-200/80 shadow-sm ring-1 ring-emerald-500/20', 
    label: 'Published', 
    icon: CheckCircle 
  },
  rejected: { 
    color: 'bg-gradient-to-r from-red-100 to-red-50 text-red-800 border-red-200/80 shadow-sm ring-1 ring-red-500/20', 
    label: 'Needs Changes', 
    icon: XCircle 
  },
  archived: { 
    color: 'bg-gradient-to-r from-slate-100 to-slate-50 text-slate-700 border-slate-200/80 shadow-sm', 
    label: 'Archived', 
    icon: Archive 
  }
};

export default function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status] || statusConfig['draft']; // Fallback to draft if status not found
  const Icon = config.icon;
  
  return (
    <Badge 
      variant="outline" 
      className={`${config.color} ${className} flex items-center gap-1.5 font-medium text-xs px-2.5 py-1 rounded-md transition-all duration-200 hover:scale-105`}
    >
      <Icon className="w-3 h-3" />
      {config.label}
    </Badge>
  );
}