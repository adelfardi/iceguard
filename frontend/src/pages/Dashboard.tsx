import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, rectSortingStrategy, useSortable, sortableKeyboardCoordinates, arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useState } from 'react';
import { GripVertical, LayoutDashboard, Pencil, Check } from 'lucide-react';
import { dashboardWidgetApi } from '@/api/client';
import { DashboardWidgetCard, AddWidgetGallery, WIDGET_REGISTRY } from '@/components/dashboard/widgets';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { DashboardWidget } from '@/types';

function SortableWidget({ widget, onRemove, editMode }: { widget: DashboardWidget; onRemove: (id: number) => void; editMode: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: widget.id, disabled: !editMode });
  const wide = WIDGET_REGISTRY[widget.widgetType]?.wide;
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(wide && 'lg:col-span-2', isDragging && 'z-20 opacity-70')}
    >
      <DashboardWidgetCard
        id={widget.id}
        title={widget.title}
        widgetType={widget.widgetType}
        catalogId={widget.catalogId}
        namespace={widget.namespace}
        tableName={widget.tableName}
        params={widget.params}
        onRemove={onRemove}
        editMode={editMode}
        dragHandle={
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab touch-none text-muted-foreground/60 hover:text-foreground active:cursor-grabbing"
            title="Drag to reorder"
            aria-label="Drag to reorder"
          >
            <GripVertical className="h-4 w-4" />
          </button>
        }
      />
    </div>
  );
}

export function Dashboard() {
  const queryClient = useQueryClient();
  const [editMode, setEditMode] = useState(false);
  const { data: widgets, isLoading } = useQuery({
    queryKey: ['dashboard-widgets'],
    queryFn: dashboardWidgetApi.list,
  });
  const removeMutation = useMutation({
    mutationFn: (id: number) => dashboardWidgetApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dashboard-widgets'] }),
  });
  const reorderMutation = useMutation({
    mutationFn: (ids: number[]) => dashboardWidgetApi.reorder(ids),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dashboard-widgets'] }),
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id || !widgets) return;
    const oldIndex = widgets.findIndex((w) => w.id === active.id);
    const newIndex = widgets.findIndex((w) => w.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(widgets, oldIndex, newIndex);
    queryClient.setQueryData(['dashboard-widgets'], next); // optimistic
    reorderMutation.mutate(next.map((w) => w.id));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <div className="flex items-center gap-2">
          {editMode && <AddWidgetGallery />}
          <Button variant={editMode ? 'default' : 'outline'} size="sm" onClick={() => setEditMode((v) => !v)}>
            {editMode ? <><Check className="mr-1 h-4 w-4" /> Done</> : <><Pencil className="mr-1 h-4 w-4" /> Edit</>}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-32 w-full" />)}
        </div>
      ) : !widgets || widgets.length === 0 ? (
        <Card className="glass shadow-card">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <LayoutDashboard className="mb-3 h-10 w-10 text-muted-foreground" />
            <p className="text-lg font-medium">No widgets yet</p>
            <p className="mb-4 text-sm text-muted-foreground">
              Add a global widget above, or pin a table widget from a table's Storage / Overview tab.
            </p>
            <AddWidgetGallery />
          </CardContent>
        </Card>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={widgets.map((w) => w.id)} strategy={rectSortingStrategy}>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {widgets.map((w) => (
                <SortableWidget key={w.id} widget={w} onRemove={(id) => removeMutation.mutate(id)} editMode={editMode} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}
