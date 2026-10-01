"use client";

import React, { useRef, useState, useEffect } from "react";
import { Stage, Layer, Rect, Text, Group, Line, Circle } from "react-konva";
import type { KonvaEventObject } from "konva/lib/Node";
import { ZoomIn, ZoomOut, Maximize, Minimize, Target } from "lucide-react";

const NODE_W = 240;
const ITEM_H = 36;
const PADDING = 14;
const TEAM_GAP = 60;

interface DropZone {
  type: "manager" | "karyawan" | "unassigned";
  teamId: string | null;
  x: number;
  y: number;
  w: number;
  h: number;
}

export default function KonvaTree({ data, onAssignUserToTeam, canDrag }: any) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<any>(null);
  const [dimensions, setDimensions] = useState({ w: 800, h: 600 });
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [isDraggingObj, setIsDraggingObj] = useState(false);
  const [hoveredZoneId, setHoveredZoneId] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Dynamic Theme State
  const [theme, setTheme] = useState({
    bg: '#f8f9fa',
    surface: '#ffffff',
    text: '#111827',
    textMuted: '#6b7280',
    border: '#e2e8f0',
    borderStrong: '#cbd5e1',
    accent: '#5c8bd6',
    accentLight: '#eff6ff',
    danger: '#ef4444',
    dangerLight: '#fee2e2'
  });

  useEffect(() => {
    const updateTheme = () => {
      const root = document.documentElement;
      const style = getComputedStyle(root);
      setTheme({
        bg: style.getPropertyValue('--color-bg').trim() || '#f8f9fa',
        surface: style.getPropertyValue('--color-surface').trim() || '#ffffff',
        text: style.getPropertyValue('--color-text').trim() || '#111827',
        textMuted: style.getPropertyValue('--color-text-muted').trim() || '#6b7280',
        border: style.getPropertyValue('--color-border').trim() || '#e2e8f0',
        borderStrong: style.getPropertyValue('--color-border-strong').trim() || '#cbd5e1',
        accent: style.getPropertyValue('--color-accent').trim() || '#5c8bd6',
        accentLight: style.getPropertyValue('--color-accent-light').trim() || 'rgba(92, 139, 214, 0.1)',
        danger: style.getPropertyValue('--color-danger').trim() || '#ef4444',
        dangerLight: style.getPropertyValue('--color-danger-light').trim() || 'rgba(239, 68, 68, 0.1)'
      });
    };

    updateTheme();
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((m) => {
        if (m.attributeName === 'class') updateTheme();
      });
    });
    observer.observe(document.documentElement, { attributes: true });
    return () => observer.disconnect();
  }, []);

  // Update dimensions on resize
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const { clientWidth, clientHeight } = containerRef.current;
        setDimensions({ w: clientWidth, h: clientHeight });
      }
    };
    
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, [isFullscreen]);

  // Center the view initially and whenever fullscreen mode toggles
  useEffect(() => {
    if (dimensions.w > 0 && dimensions.h > 0) {
      // Only auto-reset if it's the very first load (pos.x === 0) OR if we just toggled fullscreen
      if (pos.x === 0 && pos.y === 0) {
        handleResetView();
      }
    }
  }, [dimensions.w, dimensions.h]);

  // Force reset view when fullscreen toggles
  useEffect(() => {
    if (dimensions.w > 0) {
      handleResetView();
    }
  }, [isFullscreen]);

  const handleZoom = (direction: 1 | -1) => {
    const scaleBy = 1.2;
    const oldScale = scale;
    const newScale = direction > 0 ? oldScale * scaleBy : oldScale / scaleBy;
    const clampedScale = Math.max(0.2, Math.min(newScale, 3));
    
    // Zoom towards center of screen
    const center = { x: dimensions.w / 2, y: dimensions.h / 2 };
    const mousePointTo = {
      x: (center.x - pos.x) / oldScale,
      y: (center.y - pos.y) / oldScale,
    };
    
    setScale(clampedScale);
    setPos({
      x: center.x - mousePointTo.x * clampedScale,
      y: center.y - mousePointTo.y * clampedScale,
    });
  };

  const handleResetView = () => {
    setScale(1);
    let offsetX = dimensions.w / 2;
    
    if (isFullscreen) {
      const sidebar = document.querySelector('.sidebar');
      if (sidebar) {
        offsetX += sidebar.clientWidth / 2;
      }
    }
    
    setPos({ x: offsetX, y: 80 });
  };

  const handleWheel = (e: KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const scaleBy = 1.05;
    const stage = stageRef.current;
    if (!stage) return;
    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();
    if (!pointer) return;
    
    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    };

    const newScale = e.evt.deltaY < 0 ? oldScale * scaleBy : oldScale / scaleBy;
    const clampedScale = Math.max(0.2, Math.min(newScale, 3));

    setScale(clampedScale);
    setPos({
      x: pointer.x - mousePointTo.x * clampedScale,
      y: pointer.y - mousePointTo.y * clampedScale,
    });
  };

  const dropZones = useRef<DropZone[]>([]);
  dropZones.current = [];

  const totalTeamsW = data.teams.length * (NODE_W + TEAM_GAP) - TEAM_GAP;
  const startX = -(totalTeamsW / 2);

  const companyNode = { x: -NODE_W / 2, y: 0, w: NODE_W, h: 60 };

  let maxY = companyNode.y + companyNode.h;

  const teamNodes = data.teams.map((team: any, i: number) => {
    const x = startX + i * (NODE_W + TEAM_GAP);
    const y = 140;
    
    const mgrH = Math.max(1, team.managers.length) * ITEM_H + PADDING * 2 + 24; 
    const memH = Math.max(1, team.members.length) * ITEM_H + PADDING * 2 + 24;
    
    const mgrY = y + 50;
    const memY = mgrY + mgrH + 20;

    dropZones.current.push({ type: 'manager', teamId: team.id, x, y: mgrY, w: NODE_W, h: mgrH });
    dropZones.current.push({ type: 'karyawan', teamId: team.id, x, y: memY, w: NODE_W, h: memH });

    if (memY + memH > maxY) maxY = memY + memH;

    return { ...team, x, y, mgrH, memH, mgrY, memY };
  });

  const unassignedX = startX + data.teams.length * (NODE_W + TEAM_GAP) + 60;
  const unassignedH = Math.max(1, data.unassignedMembers.length) * ITEM_H + PADDING * 2 + 24;
  
  if (canDrag) {
    dropZones.current.push({ type: 'unassigned', teamId: null, x: unassignedX, y: 140, w: NODE_W, h: unassignedH });
  }

  if (140 + unassignedH > maxY) maxY = 140 + unassignedH;

  // Minimap calculations
  const mapBounds = {
    x: Math.min(companyNode.x, startX) - 40,
    y: -40,
    w: Math.max(totalTeamsW, (unassignedX + NODE_W - startX)) + 120,
    h: maxY + 100
  };
  const minimapW = 200;
  const minimapH = 140;
  const mapScale = Math.min(minimapW / mapBounds.w, minimapH / mapBounds.h);

  const viewRect = {
    x: -pos.x / scale,
    y: -pos.y / scale,
    w: dimensions.w / scale,
    h: dimensions.h / scale
  };

  const handleDragEnd = (e: KonvaEventObject<DragEvent>, userId: string, currentRole: string) => {
    setIsDraggingObj(false);
    const stage = stageRef.current;
    if (!stage) return;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const dropX = (pointer.x - stage.x()) / stage.scaleX();
    const dropY = (pointer.y - stage.y()) / stage.scaleY();

    let targetZone = null;
    for (const zone of dropZones.current) {
      if (
        dropX >= zone.x && dropX <= zone.x + zone.w &&
        dropY >= zone.y && dropY <= zone.y + zone.h
      ) {
        targetZone = zone;
        break;
      }
    }

    setHoveredZoneId(null);
    
    if (targetZone) {
      // Drop Valid - Jangan balik ke posisi awal, biarkan di tempat sampai state React memuat ulang
      if (targetZone.type === 'unassigned') {
        onAssignUserToTeam(userId, null);
      } else {
        onAssignUserToTeam(userId, targetZone.teamId, targetZone.type);
      }
      // Efek snap instan ke tengah kotak
      e.target.to({ x: targetZone.x + PADDING, duration: 0.15 });
    } else {
      // Drop Tidak Valid - Kembalikan ke posisi awal
      e.target.to({ x: e.target.attrs.startX, y: e.target.attrs.startY, duration: 0.3 });
    }
  };

  const renderBezierCurve = (x1: number, y1: number, x2: number, y2: number, stroke: string) => {
    const midY = (y1 + y2) / 2;
    return <Line points={[x1, y1, x1, midY, x2, midY, x2, y2]} bezier={true} stroke={stroke} strokeWidth={2} opacity={0.6} />;
  };

  const renderDraggableItem = (user: any, x: number, y: number, role: string, isMini = false) => {
    const initial = user.name.charAt(0).toUpperCase();
    if (isMini) {
      return <Rect key={`mini-${user.id}`} x={x} y={y} width={NODE_W - PADDING*2} height={ITEM_H - 4} fill={theme.borderStrong} cornerRadius={2} />;
    }
    return (
      <Group
        key={user.id}
        x={x}
        y={y}
        draggable={canDrag}
        onDragStart={(e) => {
          setIsDraggingObj(true);
          e.target.setAttrs({ startX: x, startY: y, scaleX: 1.05, scaleY: 1.05, shadowBlur: 15, shadowColor: "rgba(0,0,0,0.2)" });
          e.target.moveToTop();
        }}
        onDragEnd={(e) => {
          e.target.setAttrs({ scaleX: 1, scaleY: 1, shadowBlur: 0 });
          handleDragEnd(e, user.id, role);
        }}
        onMouseEnter={(e) => {
          if (canDrag && !isDraggingObj) {
            const container = e.target.getStage()?.container();
            if (container) container.style.cursor = 'grab';
          }
        }}
        onMouseLeave={(e) => {
          if (canDrag && !isDraggingObj) {
            const container = e.target.getStage()?.container();
            if (container) container.style.cursor = 'default';
          }
        }}
      >
        <Rect width={NODE_W - PADDING*2} height={ITEM_H - 4} fill={theme.surface} cornerRadius={6} stroke={theme.border} strokeWidth={1} />
        <Circle x={16} y={ITEM_H/2 - 2} radius={10} fill={theme.bg} stroke={theme.borderStrong} strokeWidth={1} />
        <Text text={initial} x={6} y={ITEM_H/2 - 7} width={20} align="center" fontSize={10} fill={theme.textMuted} fontStyle="bold" />
        <Text text={user.name} x={34} y={ITEM_H/2 - 8} align="center" fontSize={12} fill={theme.text} fontStyle="bold" width={NODE_W - PADDING*2 - 40} ellipsis={true} wrap="none" />
      </Group>
    );
  };

  const renderTreeNodes = (isMini = false) => (
    <>
      <Group x={companyNode.x} y={companyNode.y}>
        <Rect width={companyNode.w} height={companyNode.h} fill={theme.surface} cornerRadius={12} shadowBlur={isMini ? 0 : 20} shadowColor="rgba(0,0,0,0.1)" shadowOffsetY={4} stroke={theme.accent} strokeWidth={2} />
        {!isMini && (
          <>
            <Text text={data.companyName} x={0} y={15} width={companyNode.w} align="center" fontSize={16} fontStyle="bold" fill={theme.text} />
            <Text text="Company Structure" x={0} y={35} width={companyNode.w} align="center" fontSize={11} fill={theme.textMuted} />
          </>
        )}
      </Group>

      {teamNodes.map((team: any) => (
        <Group key={`conn-${team.id}`}>
          {renderBezierCurve(0, companyNode.y + companyNode.h, team.x + NODE_W / 2, team.y, theme.borderStrong)}
        </Group>
      ))}

      {teamNodes.map((team: any) => (
        <Group key={team.id}>
          <Rect x={team.x} y={team.y} width={NODE_W} height={40} fill={theme.accent} cornerRadius={[12, 12, 0, 0] as any} shadowBlur={isMini ? 0 : 10} shadowColor="rgba(0,0,0,0.1)" shadowOffsetY={2} />
          {!isMini && <Text text={team.name} x={team.x} y={team.y + 12} width={NODE_W} align="center" fontSize={14} fontStyle="bold" fill="#ffffff" />}

          <Rect x={team.x} y={team.mgrY} width={NODE_W} height={team.mgrH} fill={hoveredZoneId === `manager-${team.id}` && !isMini ? theme.accentLight : theme.surface} stroke={theme.accent} strokeWidth={2} strokeDash={isDraggingObj && !isMini ? [5, 5] : []} cornerRadius={[0, 0, 12, 12] as any} />
          {!isMini && <Text text="MANAGERS" x={team.x + PADDING} y={team.mgrY + PADDING} fontSize={10} fill={theme.accent} fontStyle="bold" />}
          
          {team.managers.map((m: any, idx: number) => 
            renderDraggableItem(m, team.x + PADDING, team.mgrY + PADDING + 24 + idx * ITEM_H, "manager", isMini)
          )}

          {renderBezierCurve(team.x + NODE_W/2, team.mgrY + team.mgrH, team.x + NODE_W/2, team.memY, theme.borderStrong)}

          <Rect x={team.x} y={team.memY} width={NODE_W} height={team.memH} fill={hoveredZoneId === `karyawan-${team.id}` && !isMini ? theme.bg : theme.surface} stroke={theme.borderStrong} strokeWidth={hoveredZoneId === `karyawan-${team.id}` && !isMini ? 3 : 2} strokeDash={isDraggingObj && !isMini ? [5, 5] : []} cornerRadius={12} shadowBlur={isMini ? 0 : 10} shadowColor="rgba(0,0,0,0.05)" />
          {!isMini && <Text text="SALES REPS" x={team.x + PADDING} y={team.memY + PADDING} fontSize={10} fill={theme.textMuted} fontStyle="bold" />}
          
          {team.members.map((m: any, idx: number) => 
            renderDraggableItem(m, team.x + PADDING, team.memY + PADDING + 24 + idx * ITEM_H, "karyawan", isMini)
          )}
        </Group>
      ))}

      {canDrag && (
        <Group>
          <Rect x={unassignedX} y={140} width={NODE_W} height={unassignedH} fill={hoveredZoneId === 'unassigned-null' && !isMini ? '#fecdd3' : theme.dangerLight} stroke={theme.danger} strokeWidth={hoveredZoneId === 'unassigned-null' && !isMini ? 3 : 2} strokeDash={[6, 4]} cornerRadius={12} />
          {!isMini && <Text text="UNASSIGNED USERS" x={unassignedX + PADDING} y={140 + PADDING} fontSize={10} fill={theme.danger} fontStyle="bold" />}
          
          {data.unassignedMembers.map((m: any, idx: number) => 
            renderDraggableItem(m, unassignedX + PADDING, 140 + PADDING + 24 + idx * ITEM_H, m.role, isMini)
          )}
        </Group>
      )}
    </>
  );

  return (
    <div 
      ref={containerRef} 
      className={`overflow-hidden ${isFullscreen ? 'fixed inset-0 bg-[var(--color-bg)]' : 'relative w-full h-[calc(100vh-180px)] min-h-[500px] rounded-xl border border-[var(--color-border)]'}`}
      style={!isFullscreen ? { backgroundColor: theme.bg } : { zIndex: 45 }}
    >

      {/* Toolbar */}
      <div className="absolute top-4 right-4 z-10 flex flex-col gap-2 p-1.5 rounded-lg shadow-md border" style={{ backgroundColor: theme.surface, borderColor: theme.border }}>
        <button onClick={() => handleZoom(1)} className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" title="Zoom In" style={{ color: theme.text }}>
          <ZoomIn className="w-5 h-5" />
        </button>
        <button onClick={() => handleZoom(-1)} className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" title="Zoom Out" style={{ color: theme.text }}>
          <ZoomOut className="w-5 h-5" />
        </button>
        <div className="w-full h-px opacity-50" style={{ backgroundColor: theme.border }}></div>
        <button onClick={handleResetView} className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" title="Reset View" style={{ color: theme.text }}>
          <Target className="w-5 h-5" />
        </button>
        <div className="w-full h-px opacity-50" style={{ backgroundColor: theme.border }}></div>
        <button onClick={() => setIsFullscreen(!isFullscreen)} className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" title="Toggle Fullscreen" style={{ color: theme.text }}>
          {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
        </button>
      </div>

      {/* Main Canvas */}
      <Stage
        ref={stageRef}
        width={dimensions.w}
        height={dimensions.h}
        onWheel={handleWheel}
        draggable
        x={pos.x}
        y={pos.y}
        scaleX={scale}
        scaleY={scale}
        onDragMove={(e) => {
          if (e.target !== e.currentTarget) {
            const stage = stageRef.current;
            if (stage) {
              const pointer = stage.getPointerPosition();
              if (pointer) {
                const dropX = (pointer.x - stage.x()) / stage.scaleX();
                const dropY = (pointer.y - stage.y()) / stage.scaleY();
                let foundZone = null;
                for (const zone of dropZones.current) {
                  if (dropX >= zone.x && dropX <= zone.x + zone.w && dropY >= zone.y && dropY <= zone.y + zone.h) {
                    foundZone = zone.type + '-' + zone.teamId;
                    break;
                  }
                }
                setHoveredZoneId(foundZone);
              }
            }
            return;
          }
          setPos({ x: e.target.x(), y: e.target.y() });
        }}
      >
        <Layer>{renderTreeNodes(false)}</Layer>
      </Stage>

      {/* Minimap View */}
      <div 
        className="absolute bottom-4 right-4 rounded-lg shadow-xl border overflow-hidden pointer-events-none opacity-80" 
        style={{ width: minimapW, height: minimapH, backgroundColor: theme.surface, borderColor: theme.borderStrong }}
      >
        <Stage width={minimapW} height={minimapH} scaleX={mapScale} scaleY={mapScale} x={-mapBounds.x * mapScale} y={-mapBounds.y * mapScale}>
          <Layer>
            {renderTreeNodes(true)}
            {/* Viewport Highlight */}
            <Rect 
              x={viewRect.x} 
              y={viewRect.y} 
              width={viewRect.w} 
              height={viewRect.h} 
              fill={theme.accent + '33'} 
              stroke={theme.accent} 
              strokeWidth={2 / mapScale} 
            />
          </Layer>
        </Stage>
      </div>
    </div>
  );
}
