'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  EASING_PRESETS,
  EASING_CATEGORIES,
  EasingPreset,
  getPresetsByCategory,
  getCategoryColor,
  parseCubicBezier,
  toCubicBezierString,
} from '@/lib/easing-presets';
import { solveCubicBezier } from '@/lib/anim/math-core';
import { generateEasingSVGPath } from '@/lib/easing-preview';
import {
  Search,
  X,
  ChevronDown,
  ChevronRight,
  GalleryVerticalEnd,
  PenTool,
  Save,
  Check
} from 'lucide-react';

// LocalStorage key for custom presets
const CUSTOM_PRESETS_KEY = 'vectoria-custom-easings';

interface EasingPresetPickerProps {
  onApply: (preset: EasingPreset, mode: 'out' | 'in' | 'both') => void;
  onClose: () => void;
  selectedKeyframeCount?: number;
  anchorPosition?: { x: number; y: number };
}

// Load custom presets from localStorage
function loadCustomPresets(): EasingPreset[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(CUSTOM_PRESETS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

// Save custom presets to localStorage
function saveCustomPresets(presets: EasingPreset[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(CUSTOM_PRESETS_KEY, JSON.stringify(presets));
}

// ============ EasingPreview Component ============
function EasingPreview({ controlPoints }: { controlPoints: { x1: number; y1: number; x2: number; y2: number } }) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const requestRef = React.useRef<number>();
  const startTimeRef = React.useRef<number>(0);

  const DURATION = 1000;
  const DELAY = 500;

  const animate = useCallback((time: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (!startTimeRef.current) startTimeRef.current = time;

    // Cycle logic: 0 -> 1 (duration) -> wait (delay) -> reset
    const elapsed = time - startTimeRef.current;
    const totalCycle = DURATION + DELAY;
    const progress = (elapsed % totalCycle) / DURATION;

    // Clear
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Draw Track
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    ctx.moveTo(10, h / 2);
    ctx.lineTo(w - 10, h / 2);
    ctx.stroke();

    // Calculate Position
    let t = Math.min(1, Math.max(0, progress));
    // If we are in the delay phase
    if (elapsed % totalCycle > DURATION) {
      t = 1;
    }

    const value = solveCubicBezier(controlPoints.x1, controlPoints.y1, controlPoints.x2, controlPoints.y2, t);

    // Position = Start + (End - Start) * EasedValue(t)
    const posX = 10 + (w - 20) * value;

    // Draw Moving Circle
    ctx.beginPath();
    ctx.fillStyle = '#4D96FF';
    ctx.shadowColor = '#4D96FF';
    ctx.shadowBlur = 10;
    ctx.arc(posX, h / 2, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    requestRef.current = requestAnimationFrame(animate);
  }, [controlPoints]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [animate]);

  return (
    <div className="w-full h-12 bg-black/40 border-b border-white/5 relative overflow-hidden flex items-center justify-center shrink-0">
      <canvas
        ref={canvasRef}
        width={320}
        height={48}
        className="w-full h-full"
      />
      <div className="absolute top-1 right-2 text-[10px] text-white/20 font-mono tracking-widest pointer-events-none">PREVIEW</div>
    </div>
  );
}

export function EasingPresetPicker({
  onApply,
  onClose,
  selectedKeyframeCount = 0,
  anchorPosition,
}: EasingPresetPickerProps) {
  const [selectedPreset, setSelectedPreset] = useState<EasingPreset | null>(null);
  const [applyMode, setApplyMode] = useState<'out' | 'in' | 'both'>('both');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(['ease', 'sine', 'back', 'custom'])
  );

  // Phase 8.6: Manual cubic-bezier input
  const [manualInput, setManualInput] = useState('');
  const [parsedManual, setParsedManual] = useState<EasingPreset | null>(null);

  // Phase 8.7: Custom presets
  const [customPresets, setCustomPresets] = useState<EasingPreset[]>([]);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');

  // Load custom presets on mount
  useEffect(() => {
    setCustomPresets(loadCustomPresets());
  }, []);

  // Parse manual input in real-time
  useEffect(() => {
    if (!manualInput.trim()) {
      setParsedManual(null);
      return;
    }
    const parsed = parseCubicBezier(manualInput);
    if (parsed) {
      setParsedManual({
        id: 'manual-input',
        name: 'manual',
        displayName: 'Custom',
        category: 'custom',
        controlPoints: parsed,
        description: toCubicBezierString(parsed),
      });
    } else {
      setParsedManual(null);
    }
  }, [manualInput]);

  // Combine built-in and custom presets
  const allPresets = useMemo(() => {
    return [...EASING_PRESETS, ...customPresets];
  }, [customPresets]);

  // Filter presets by search
  const filteredPresets = useMemo(() => {
    if (!searchQuery.trim()) return allPresets;
    const query = searchQuery.toLowerCase();
    return allPresets.filter(
      p =>
        p.name.toLowerCase().includes(query) ||
        p.displayName.toLowerCase().includes(query) ||
        p.category.toLowerCase().includes(query)
    );
  }, [searchQuery, allPresets]);

  // Group by category
  const presetsByCategory = useMemo(() => {
    const groups: Record<string, EasingPreset[]> = {};
    filteredPresets.forEach(preset => {
      if (!groups[preset.category]) groups[preset.category] = [];
      groups[preset.category].push(preset);
    });
    return groups;
  }, [filteredPresets]);

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(categoryId)) next.delete(categoryId);
      else next.add(categoryId);
      return next;
    });
  };

  const handleApply = useCallback(() => {
    const presetToApply = parsedManual || selectedPreset;
    if (presetToApply) {
      onApply(presetToApply, applyMode);
    }
  }, [selectedPreset, parsedManual, applyMode, onApply]);

  const handleDoubleClick = useCallback((preset: EasingPreset) => {
    onApply(preset, applyMode);
  }, [applyMode, onApply]);

  // Save current manual input as custom preset
  const handleSaveCustom = useCallback(() => {
    if (!parsedManual || !newPresetName.trim()) return;

    const newPreset: EasingPreset = {
      id: `custom-${Date.now()}`,
      name: newPresetName.toLowerCase().replace(/\s+/g, '-'),
      displayName: newPresetName,
      category: 'custom',
      controlPoints: parsedManual.controlPoints,
      description: toCubicBezierString(parsedManual.controlPoints),
    };

    const updated = [...customPresets, newPreset];
    setCustomPresets(updated);
    saveCustomPresets(updated);
    setShowSaveDialog(false);
    setNewPresetName('');
    setManualInput('');
  }, [parsedManual, newPresetName, customPresets]);

  // Delete custom preset
  const handleDeleteCustom = useCallback((presetId: string) => {
    const updated = customPresets.filter(p => p.id !== presetId);
    setCustomPresets(updated);
    saveCustomPresets(updated);
    if (selectedPreset?.id === presetId) {
      setSelectedPreset(null);
    }
  }, [customPresets, selectedPreset]);

  // Draggable popover state
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [dragPosition, setDragPosition] = useState<{ x: number; y: number } | null>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);

  // Reset drag position when component mounts (each time popover opens)
  useEffect(() => {
    setDragPosition(null);
  }, []);

  // Calculate initial position based on anchor
  const initialPosition = useMemo(() => {
    if (!anchorPosition) {
      // Center of screen fallback
      return { x: (window.innerWidth - 420) / 2, y: 100 };
    }

    const popoverWidth = 320; // Corrected width
    const popoverHeight = 500;
    const padding = 16;

    // Position ABOVE the button
    let x = anchorPosition.x - popoverWidth; // Left of button
    let y = anchorPosition.y - popoverHeight - padding; // Above button

    // Ensure within viewport
    if (x < padding) x = padding;
    if (y < padding) y = padding;
    if (x + popoverWidth > window.innerWidth - padding) {
      x = window.innerWidth - popoverWidth - padding;
    }
    // If still off screen at bottom, move to visible area
    if (y + popoverHeight > window.innerHeight - padding) {
      y = window.innerHeight - popoverHeight - padding;
    }

    return { x, y };
  }, [anchorPosition]);

  // Handle drag start
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault(); // Prevent text selection
    if (panelRef.current) {
      const rect = panelRef.current.getBoundingClientRect();
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
      setIsDragging(true);
    }
  }, []);

  // Handle drag move
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      setDragPosition({
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset]);

  // Determine points for preview
  const currentPreviewCP = useMemo(() => {
    if (parsedManual) return parsedManual.controlPoints;
    if (selectedPreset) return selectedPreset.controlPoints;
    return null;
  }, [parsedManual, selectedPreset]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      ref={panelRef}
      className="fixed z-[9999] w-[320px] flex flex-col bg-zinc-900/95 backdrop-blur-md border border-white/10 rounded-lg shadow-2xl overflow-hidden ring-1 ring-white/10 pointer-events-auto"
      style={{
        left: dragPosition ? dragPosition.x : initialPosition.x,
        top: dragPosition ? dragPosition.y : initialPosition.y,
        maxHeight: '500px',
      }}
      onClick={e => e.stopPropagation()}
      onMouseDown={e => e.stopPropagation()}
      onPointerDown={e => e.stopPropagation()}
      onPointerUp={e => e.stopPropagation()}
    >
      {/* Header - Draggable Area */}
      <div
        className="flex items-center justify-between p-3 border-b border-white/10 cursor-grab active:cursor-grabbing bg-white/5 shrink-0"
        onMouseDown={handleDragStart}
      >
        <div className="flex items-center gap-2 pointer-events-none">
          <GalleryVerticalEnd size={14} className="text-white" />
          <span className="text-sm font-semibold text-white">Easing Presets</span>
        </div>
        <button
          className="text-zinc-400 hover:text-white transition-colors p-1 hover:bg-white/10 rounded"
          onClick={onClose}
        >
          <X size={14} />
        </button>
      </div>

      {/* Preview Section */}
      {currentPreviewCP && (
        <EasingPreview controlPoints={currentPreviewCP} />
      )}

      {/* Search */}
      <div className="p-3 border-b border-white/10 shrink-0">
        <div className="relative">
          <Search size={12} className="absolute left-2.5 top-2.5 text-zinc-500" />
          <input
            type="text"
            placeholder="Search presets..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-2 bg-black/20 border border-white/10 rounded-md text-white text-xs placeholder:text-zinc-500 focus:outline-none focus:border-[#4D96FF]"
          />
        </div>
      </div>

      {/* Categories */}
      <div className="flex-1 overflow-y-auto p-2">
        {/* Manual Input Section */}
        <div className="mb-2 p-3 bg-black/20 rounded-md border border-white/5">
          <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 uppercase mb-2">
            <PenTool size={10} />
            <span>Custom Cubic-Bezier</span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="0.42, 0, 0.58, 1"
              value={manualInput}
              onChange={e => setManualInput(e.target.value)}
              className="flex-1 px-2 py-1.5 bg-black/20 border border-white/10 rounded font-mono text-xs text-white focus:border-[#4D96FF] focus:outline-none"
            />
            {parsedManual && (
              <div className="flex items-center gap-1">
                <svg width="32" height="32" viewBox="0 0 40 40" className="bg-black/40 rounded">
                  <path
                    d={generateEasingSVGPath(parsedManual.controlPoints, 40)}
                    fill="none"
                    stroke="#eab308"
                    strokeWidth="2"
                  />
                </svg>
                <button
                  onClick={() => setShowSaveDialog(true)}
                  className="p-1 hover:bg-white/10 rounded text-sm text-zinc-400 hover:text-white"
                  title="Save as preset"
                >
                  <Save size={14} />
                </button>
              </div>
            )}
          </div>
          {parsedManual && (
            <div className="mt-1 text-[10px] text-zinc-500 font-mono">
              {toCubicBezierString(parsedManual.controlPoints)}
            </div>
          )}
        </div>

        {/* Save Dialog */}
        {showSaveDialog && (
          <div className="flex gap-2 p-2 mb-2 bg-blue-500/10 border border-blue-500/20 rounded text-xs">
            <input
              type="text"
              placeholder="Preset name..."
              value={newPresetName}
              onChange={e => setNewPresetName(e.target.value)}
              autoFocus
              className="flex-1 px-2 py-1 bg-black/40 border border-white/10 rounded text-white"
            />
            <button onClick={handleSaveCustom} disabled={!newPresetName.trim()} className="text-blue-400 hover:text-white">Save</button>
            <button onClick={() => setShowSaveDialog(false)} className="text-zinc-400 hover:text-white">Cancel</button>
          </div>
        )}

        {/* Built-in Categories */}
        {EASING_CATEGORIES.map(category => {
          const presets = presetsByCategory[category.id];
          if (!presets || presets.length === 0) return null;

          const isExpanded = expandedCategories.has(category.id);
          const isCustom = category.id === 'custom';

          return (
            <div key={category.id} className="mb-1">
              <button
                className="flex items-center gap-2 w-full p-2 hover:bg-white/5 rounded transition-colors text-left group"
                onClick={() => toggleCategory(category.id)}
                style={{ borderLeft: `3px solid ${category.color}` }}
              >
                <div className="text-zinc-500 group-hover:text-zinc-300">
                  {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                </div>
                <span className="flex-1 text-xs font-medium text-zinc-300 group-hover:text-white uppercase from-neutral-300">{category.name}</span>
                <span className="text-[10px] text-zinc-600">{presets.length}</span>
              </button>

              {isExpanded && (
                <div className="grid grid-cols-4 gap-2 p-2">
                  {presets.map(preset => (
                    <EasingCard
                      key={preset.id}
                      preset={preset}
                      selected={selectedPreset?.id === preset.id}
                      onClick={() => {
                        setSelectedPreset(preset);
                        setParsedManual(null);
                        setManualInput('');
                      }}
                      onDoubleClick={() => handleDoubleClick(preset)}
                      onDelete={isCustom ? () => handleDeleteCustom(preset.id) : undefined}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-white/10 flex flex-col gap-3 shrink-0">
        {/* Apply Mode */}
        <div className="flex items-center gap-4 text-xs text-zinc-400">
          <span>Apply to:</span>
          <label className="flex items-center gap-1 cursor-pointer hover:text-white">
            <input type="radio" name="applyMode" checked={applyMode === 'out'} onChange={() => setApplyMode('out')} className="accent-blue-500" />
            Ease Out
          </label>
          <label className="flex items-center gap-1 cursor-pointer hover:text-white">
            <input type="radio" name="applyMode" checked={applyMode === 'in'} onChange={() => setApplyMode('in')} className="accent-blue-500" />
            Ease In
          </label>
          <label className="flex items-center gap-1 cursor-pointer hover:text-white">
            <input type="radio" name="applyMode" checked={applyMode === 'both'} onChange={() => setApplyMode('both')} className="accent-blue-500" />
            Both
          </label>
        </div>

        {/* Apply Button */}
        <button
          className="w-full py-2 bg-[#4D96FF] hover:bg-[#007AFF] text-white rounded text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
          onClick={handleApply}
          disabled={!selectedPreset && !parsedManual}
        >
          <Check size={12} />
          Apply{selectedKeyframeCount > 0 ? ` (${selectedKeyframeCount} keyframes)` : ''}
        </button>
      </div>
    </div>,
    document.body
  );
}

// ============ EasingCard Component ============

interface EasingCardProps {
  preset: EasingPreset;
  selected?: boolean;
  onClick?: () => void;
  onDoubleClick?: () => void;
  onDelete?: () => void;
}

function EasingCard({ preset, selected, onClick, onDoubleClick, onDelete }: EasingCardProps) {
  const color = getCategoryColor(preset.category);
  const svgPath = generateEasingSVGPath(preset.controlPoints, 50);

  return (
    <div className="relative">
      <button
        className={`flex flex-col items-center gap-1 p-2 bg-black/20 border-2 rounded-lg cursor-pointer transition-all w-full hover:bg-black/30 hover:scale-105 hover:shadow-lg ${selected ? 'border-[#eab308] bg-black/30' : 'border-transparent'}`}
        onClick={onClick}
        onDoubleClick={onDoubleClick}
        title={preset.description}
      >
        <svg width="50" height="50" viewBox="0 0 50 50" className="block">
          <rect width="50" height="50" fill="#1a1a1a" rx="4" />
          <line x1="0" y1="50" x2="50" y2="0" stroke="#333" strokeWidth="0.5" strokeDasharray="2,2" />
          <path d={svgPath} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />
          <circle cx="0" cy="50" r="2" fill={color} />
          <circle cx="50" cy="0" r="2" fill={color} />
        </svg>
        <span className="text-[10px] text-zinc-400 text-center whitespace-nowrap overflow-hidden text-ellipsis max-w-full">{preset.displayName}</span>
      </button>
      {onDelete && (
        <button
          className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          title="Delete preset"
        >
          <X size={10} />
        </button>
      )}
    </div>
  );
}


export default EasingPresetPicker;
