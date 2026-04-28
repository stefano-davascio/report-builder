'use client';

import { Plus, Undo2, Redo2, Grid3x3, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EditModeToolbarProps {
  onAddModule: () => void;
  showGrid: boolean;
  onToggleGrid: () => void;
  moduleCount: number;
}

export function EditModeToolbar({
  onAddModule,
  showGrid,
  onToggleGrid,
  moduleCount,
}: EditModeToolbarProps) {
  return (
    <div className="bg-indigo-600 px-8 py-2.5 flex items-center justify-between flex-shrink-0">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-indigo-300 animate-pulse" />
          <span className="text-xs font-semibold text-indigo-100">Editing</span>
        </div>
        <div className="w-px h-4 bg-indigo-500" />
        <span className="text-xs text-indigo-300">
          {moduleCount} module{moduleCount !== 1 ? 's' : ''}
        </span>
        <span className="text-xs text-indigo-400">· Drag to move, resize from corner</span>
      </div>

      <div className="flex items-center gap-2">
        {/* Grid toggle */}
        <button
          onClick={onToggleGrid}
          className={cn(
            'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors',
            showGrid
              ? 'bg-indigo-500 text-white'
              : 'text-indigo-300 hover:bg-indigo-500/50 hover:text-white'
          )}
        >
          <Grid3x3 className="w-3.5 h-3.5" />
          Grid
        </button>

        {/* Add module button */}
        <button
          onClick={onAddModule}
          className="flex items-center gap-2 px-3 py-1.5 bg-white text-indigo-600 text-xs font-bold rounded-lg hover:bg-indigo-50 transition-colors shadow-sm"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Module
        </button>
      </div>
    </div>
  );
}
