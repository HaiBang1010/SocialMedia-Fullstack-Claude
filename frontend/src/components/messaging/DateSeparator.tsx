import { formatDateSeparator } from '@/lib/format';

interface DateSeparatorProps {
  iso: string;
}

// Phase 5.2 — centered day/time anchor between message bursts (cross-day or >1h gap).
export default function DateSeparator({ iso }: DateSeparatorProps) {
  return (
    <div className="my-3 text-center text-xs text-muted-foreground">{formatDateSeparator(iso)}</div>
  );
}
