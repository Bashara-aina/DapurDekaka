import React, { createContext, useContext } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { DraggableSyntheticListeners } from '@dnd-kit/core';

// Create a context to pass down listeners and attributes
const DragHandleContext = createContext<{
  listeners?: DraggableSyntheticListeners;
  attributes?: React.HTMLAttributes<HTMLElement>;
}>({});

// Hook to access the drag handle context
export function useDragHandle() {
  return useContext(DragHandleContext);
}

interface SortableItemProps {
  id: string | number;
  children: React.ReactNode;
}

export function SortableItem({ id, children }: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <DragHandleContext.Provider value={{ listeners, attributes }}>
      <div ref={setNodeRef} style={style}>
        {children}
      </div>
    </DragHandleContext.Provider>
  );
}

// Drag handle component to be used inside sortable items
interface DragHandleProps {
  className?: string;
  children?: React.ReactNode;
}

export function DragHandle({ className, children }: DragHandleProps) {
  const { listeners, attributes } = useDragHandle();
  
  return (
    <div 
      className={`drag-handle cursor-grab ${className || ''}`} 
      {...listeners} 
      {...attributes}
    >
      {children}
    </div>
  );
}