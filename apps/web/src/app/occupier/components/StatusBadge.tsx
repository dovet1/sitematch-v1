import { Clock, CheckCircle, XCircle, Archive } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface StatusBadgeProps {
  status: 'draft' | 'pending' | 'approved' | 'rejected' | 'archived';
  className?: string;
}

const statusConfig = {
  draft: { 
    color: 'bg-gray-100 text-gray-800 border-gray-200', 
    label: 'Draft', 
    icon: Clock 
  },
  pending: { 
    color: 'bg-yellow-100 text-yellow-800 border-yellow-200', 
    label: 'Under Review', 
    icon: Clock 
  },
  approved: { 
    color: 'bg-green-100 text-green-800 border-green-200', 
    label: 'Published', 
    icon: CheckCircle 
  },
  rejected: { 
    color: 'bg-red-100 text-red-800 border-red-200', 
    label: 'Needs Changes', 
    icon: XCircle 
  },
  archived: { 
    color: 'bg-gray-100 text-gray-800 border-gray-200', 
    label: 'Archived', 
    icon: Archive 
  }
};

export default function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status];
  const Icon = config.icon;
  
  return (
    <Badge 
      variant="outline" 
      className={`${config.color} ${className} flex items-center gap-1 font-medium`}
    >
      <Icon className="w-3 h-3" />
      {config.label}
    </Badge>
  );
}