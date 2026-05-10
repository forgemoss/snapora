import { Check, FolderOpen, ImageIcon, Loader2, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { WindowChrome, WindowShell } from './Layout';
import { Button } from './ui/button';
import { cn } from '@renderer/lib/cn';
import type { EditorAlignment, EditorBackgroundConfig } from '@shared/ipc';

/**
 * Background tool. Pick a color / gradient / custom image to wrap around
 * the captured screenshot, scrub padding / shadow / corners / alignment,
 * click Done to re-composite. Live preview is HTML/CSS; the real
 * composite happens in main via `webContents.capturePage` in
 * `compositor.ts`.
 *
 * Out of scope here, slated for follow-up PRs:
 * - Bundled wallpaper presets (need asset packaging)
 * - Blurred presets (need backdrop-filter mechanism)
 * - Aspect ratio selector + auto-balance
 * - Annotation tools (Konva — v0.3)
 */

const PRESET_COLORS: string[] = [
  '#0f172a', // dark navy
  '#ffffff', // white
  '#dc2626', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#3b82f6', // blue
  '#a855f7', // purple
];

interface GradientPreset {
  id: string;
  css: string;
  swatch: string; // smaller version for the swatch UI
}

const GRADIENT_PRESETS: GradientPreset[] = [
  {
    id: 'sunset',
    css: 'linear-gradient(135deg, #ff6b6b 0%, #f7931e 100%)',
    swatch: 'linear-gradient(135deg, #ff6b6b, #f7931e)',
  },
  {
    id: 'ocean',
    css: 'linear-gradient(135deg, #2193b0 0%, #6dd5ed 100%)',
    swatch: 'linear-gradient(135deg, #2193b0, #6dd5ed)',
  },
  {
    id: 'mint',
    css: 'linear-gradient(135deg, #43cea2 0%, #185a9d 100%)',
    swatch: 'linear-gradient(135deg, #43cea2, #185a9d)',
  },
  {
    id: 'peach',
    css: 'linear-gradient(135deg, #ffafbd 0%, #ffc3a0 100%)',
    swatch: 'linear-gradient(135deg, #ffafbd, #ffc3a0)',
  },
  {
    id: 'violet',
    css: 'linear-gradient(135deg, #614385 0%, #516395 100%)',
    swatch: 'linear-gradient(135deg, #614385, #516395)',
  },
  {
    id: 'amber',
    css: 'linear-gradient(135deg, #fc4a1a 0%, #f7b733 100%)',
    swatch: 'linear-gradient(135deg, #fc4a1a, #f7b733)',
  },
  {
    id: 'rose',
    css: 'linear-gradient(135deg, #ee9ca7 0%, #ffdde1 100%)',
    swatch: 'linear-gradient(135deg, #ee9ca7, #ffdde1)',
  },
  {
    id: 'midnight',
    css: 'linear-gradient(135deg, #232526 0%, #414345 100%)',
    swatch: 'linear-gradient(135deg, #232526, #414345)',
  },
  {
    id: 'mango',
    css: 'linear-gradient(135deg, #ffb75e 0%, #ed8f03 100%)',
    swatch: 'linear-gradient(135deg, #ffb75e, #ed8f03)',
  },
  {
    id: 'lagoon',
    css: 'linear-gradient(135deg, #43c6ac 0%, #f8ffae 100%)',
    swatch: 'linear-gradient(135deg, #43c6ac, #f8ffae)',
  },
];

const ALIGNMENT_GRID: EditorAlignment[] = [
  'top-left',
  'top-center',
  'top-right',
  'center-left',
  'center',
  'center-right',
  'bottom-left',
  'bottom-center',
  'bottom-right',
];

type BgKind = 'none' | 'color' | 'image' | 'gradient';

function alignmentToFlex(alignment: EditorAlignment): {
  justify: string;
  align: string;
} {
  const justify = alignment.endsWith('right')
    ? 'flex-end'
    : alignment.endsWith('left')
      ? 'flex-start'
      : 'center';
  const align = alignment.startsWith('bottom')
    ? 'flex-end'
    : alignment.startsWith('top')
      ? 'flex-start'
      : 'center';
  return { justify, align };
}

function paddingForAlignment(
  alignment: EditorAlignment,
  base: number,
): { top: number; right: number; bottom: number; left: number } {
  let top = base;
  let right = base;
  let bottom = base;
  let left = base;
  if (alignment.startsWith('top')) bottom = base * 2;
  else if (alignment.startsWith('bottom')) top = base * 2;
  if (alignment.endsWith('right')) left = base * 2;
  else if (alignment.endsWith('left')) right = base * 2;
  return { top, right, bottom, left };
}

export function Editor() {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [bgKind, setBgKind] = useState<BgKind>('none');
  const [color, setColor] = useState('#0f172a');
  const [gradient, setGradient] = useState<string>(GRADIENT_PRESETS[0]?.css ?? '');
  const [imagePath, setImagePath] = useState<string | null>(null);
  const [paddingPx, setPaddingPx] = useState(64);
  const [shadowPx, setShadowPx] = useState(30);
  const [cornersPx, setCornersPx] = useState(0);
  const [alignment, setAlignment] = useState<EditorAlignment>('center');
  const [composing, setComposing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const off = window.snapora.editor.onImageReady((url) => setImageUrl(url));
    void window.snapora.editor.requestCurrent().then((url) => {
      if (url) setImageUrl(url);
    });
    return off;
  }, []);

  const previewBg = useMemo(() => {
    if (bgKind === 'color') return color;
    if (bgKind === 'gradient') return gradient;
    if (bgKind === 'image' && imagePath)
      return `center / cover no-repeat url("file://${imagePath}")`;
    return '#1a1a1a'; // editor canvas color when no bg picked
  }, [bgKind, color, gradient, imagePath]);

  const hasImage = imageUrl !== null;
  const canCompose = hasImage && bgKind !== 'none' && (bgKind !== 'image' || !!imagePath);

  const previewPad = useMemo(
    () =>
      bgKind === 'none'
        ? { top: 0, right: 0, bottom: 0, left: 0 }
        : paddingForAlignment(alignment, paddingPx),
    [bgKind, alignment, paddingPx],
  );

  const previewFlex = useMemo(() => alignmentToFlex(alignment), [alignment]);

  const pickImage = async (): Promise<void> => {
    const path = await window.snapora.wallpaper.chooseImage();
    if (path) {
      setImagePath(path);
      setBgKind('image');
    }
  };

  const onOpenFile = async (): Promise<void> => {
    const url = await window.snapora.editor.openFile();
    if (url) setImageUrl(url);
  };

  const onDone = async (): Promise<void> => {
    if (!canCompose) return;
    setComposing(true);
    try {
      const config: EditorBackgroundConfig = {
        type: bgKind === 'color' ? 'color' : bgKind === 'gradient' ? 'gradient' : 'image',
        value: bgKind === 'color' ? color : bgKind === 'gradient' ? gradient : (imagePath ?? ''),
        paddingPx,
        shadowPx,
        cornersPx,
        alignment,
      };
      const result = await window.snapora.editor.compose(config);
      setImageUrl(result.snapUrl);
      setToast('Saved');
      setTimeout(() => setToast(null), 1200);
    } catch (err) {
      console.error('[editor] compose failed', err);
      setToast('Compose failed');
      setTimeout(() => setToast(null), 1500);
    } finally {
      setComposing(false);
    }
  };

  return (
    <WindowShell>
      <WindowChrome
        title={hasImage ? 'Background tool' : 'Snapora — Editor'}
        right={
          hasImage ? (
            <Button
              variant="primary"
              size="sm"
              onClick={() => void onDone()}
              disabled={!canCompose || composing}
              title={canCompose ? 'Apply background and save' : 'Pick a background first'}
            >
              {composing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="h-3.5 w-3.5" />
              )}
              {composing ? 'Saving…' : 'Done'}
            </Button>
          ) : null
        }
      />

      <div className="flex flex-1 overflow-hidden">
        {hasImage ? (
          <Sidebar
            bgKind={bgKind}
            color={color}
            gradient={gradient}
            imagePath={imagePath}
            paddingPx={paddingPx}
            shadowPx={shadowPx}
            cornersPx={cornersPx}
            alignment={alignment}
            onClearBg={() => setBgKind('none')}
            onPickColor={(hex) => {
              setColor(hex);
              setBgKind('color');
            }}
            onPickGradient={(css) => {
              setGradient(css);
              setBgKind('gradient');
            }}
            onPickImage={() => void pickImage()}
            onClearImage={() => {
              setImagePath(null);
              if (bgKind === 'image') setBgKind('none');
            }}
            onPaddingChange={setPaddingPx}
            onShadowChange={setShadowPx}
            onCornersChange={setCornersPx}
            onAlignmentChange={setAlignment}
          />
        ) : null}

        <main className="relative flex-1 overflow-auto bg-[#1a1a1a]">
          {hasImage ? (
            <div className="grid h-full place-items-center p-8">
              <div
                className="rounded-md transition-[padding,background] duration-150"
                style={{
                  background: previewBg,
                  paddingTop: previewPad.top,
                  paddingRight: previewPad.right,
                  paddingBottom: previewPad.bottom,
                  paddingLeft: previewPad.left,
                  display: 'flex',
                  alignItems: previewFlex.align,
                  justifyContent: previewFlex.justify,
                }}
              >
                <img
                  src={imageUrl ?? ''}
                  alt="captured"
                  className="block max-w-full"
                  style={{
                    borderRadius: cornersPx > 0 ? cornersPx : undefined,
                    filter:
                      bgKind !== 'none' && shadowPx > 0
                        ? `drop-shadow(0 ${Math.round(shadowPx / 2)}px ${shadowPx}px rgba(0,0,0,0.45))`
                        : undefined,
                  }}
                />
              </div>
            </div>
          ) : (
            <EmptyState onOpenFile={() => void onOpenFile()} />
          )}

          {toast ? (
            <div className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-emerald-500/90 px-4 py-1.5 text-sm font-medium text-white shadow-lg">
              {toast}
            </div>
          ) : null}
        </main>
      </div>
    </WindowShell>
  );
}

function EmptyState({ onOpenFile }: { onOpenFile: () => void }) {
  return (
    <div className="grid h-full place-items-center text-center text-white/40">
      <div className="space-y-3">
        <p className="text-sm">No image loaded</p>
        <p className="text-xs">
          Take a screenshot, or open an existing image to use the Background tool.
        </p>
        <Button variant="primary" size="sm" onClick={onOpenFile}>
          <FolderOpen className="h-3.5 w-3.5" />
          Open file…
        </Button>
      </div>
    </div>
  );
}

interface SidebarProps {
  bgKind: BgKind;
  color: string;
  gradient: string;
  imagePath: string | null;
  paddingPx: number;
  shadowPx: number;
  cornersPx: number;
  alignment: EditorAlignment;
  onClearBg: () => void;
  onPickColor: (hex: string) => void;
  onPickGradient: (css: string) => void;
  onPickImage: () => void;
  onClearImage: () => void;
  onPaddingChange: (n: number) => void;
  onShadowChange: (n: number) => void;
  onCornersChange: (n: number) => void;
  onAlignmentChange: (a: EditorAlignment) => void;
}

function Sidebar(props: SidebarProps) {
  const noBg = props.bgKind === 'none';

  return (
    <aside className="flex w-60 shrink-0 flex-col gap-4 overflow-y-auto border-r border-white/5 bg-white/[0.015] p-3 text-white/95">
      <button
        type="button"
        onClick={props.onClearBg}
        className={cn(
          'w-full rounded-md border border-white/10 px-3 py-1.5 text-sm transition',
          noBg ? 'bg-white/10 text-white' : 'bg-transparent text-white/70 hover:bg-white/5',
        )}
      >
        None
      </button>

      <div>
        <SectionLabel>Gradients</SectionLabel>
        <div className="grid grid-cols-5 gap-1.5">
          {GRADIENT_PRESETS.map((g) => {
            const active = props.bgKind === 'gradient' && props.gradient === g.css;
            return (
              <button
                key={g.id}
                type="button"
                onClick={() => props.onPickGradient(g.css)}
                title={g.id}
                aria-label={`Gradient ${g.id}`}
                className={cn(
                  'h-8 w-8 rounded-md ring-1 ring-white/15 transition',
                  active && 'ring-2 ring-amber-400',
                )}
                style={{ background: g.swatch }}
              />
            );
          })}
        </div>
      </div>

      <div>
        <SectionLabel>Plain color</SectionLabel>
        <div className="mb-2 grid grid-cols-8 gap-1.5">
          {PRESET_COLORS.map((hex) => {
            const active = props.bgKind === 'color' && props.color === hex;
            return (
              <button
                key={hex}
                type="button"
                onClick={() => props.onPickColor(hex)}
                title={hex}
                aria-label={`Color ${hex}`}
                className={cn(
                  'h-5 w-5 rounded-full ring-1 ring-white/15 transition',
                  active && 'ring-2 ring-amber-400',
                )}
                style={{ backgroundColor: hex }}
              />
            );
          })}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={props.color}
            onChange={(e) => props.onPickColor(e.target.value)}
            className="h-7 w-10 cursor-pointer rounded border border-white/10 bg-transparent"
          />
          <input
            type="text"
            value={props.color}
            onChange={(e) => props.onPickColor(e.target.value)}
            spellCheck={false}
            className="h-7 flex-1 rounded-md border border-white/10 bg-white/[0.04] px-2 font-mono text-xs text-white/95 outline-none focus:border-amber-400/50"
          />
        </div>
      </div>

      <div>
        <SectionLabel>Custom image</SectionLabel>
        <div className="space-y-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={props.onPickImage}
            className="w-full justify-center"
          >
            <FolderOpen className="h-3.5 w-3.5" />
            {props.imagePath ? 'Replace…' : 'Choose…'}
          </Button>
          {props.imagePath ? (
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded border border-white/10 bg-white/[0.04]">
                <img
                  src={`file://${props.imagePath}`}
                  alt=""
                  className="h-full w-full object-cover"
                />
              </div>
              <div
                className="min-w-0 flex-1 truncate text-xs text-white/60"
                title={props.imagePath}
              >
                {props.imagePath.split('/').pop()}
              </div>
              <button
                type="button"
                onClick={props.onClearImage}
                className="grid h-6 w-6 place-items-center rounded text-white/50 hover:bg-white/5 hover:text-white/90"
                title="Clear image"
                aria-label="Clear image"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-md border border-dashed border-white/10 px-2 py-2 text-xs text-white/35">
              <ImageIcon className="h-3.5 w-3.5" />
              No image chosen
            </div>
          )}
        </div>
      </div>

      <NumericRow
        label="Padding"
        value={props.paddingPx}
        min={0}
        max={200}
        onChange={props.onPaddingChange}
        disabled={noBg}
      />
      <NumericRow
        label="Shadow"
        value={props.shadowPx}
        min={0}
        max={80}
        onChange={props.onShadowChange}
        disabled={noBg}
      />
      <NumericRow
        label="Corners"
        value={props.cornersPx}
        min={0}
        max={48}
        onChange={props.onCornersChange}
        disabled={noBg}
      />

      <div>
        <SectionLabel>Alignment</SectionLabel>
        <AlignmentGrid value={props.alignment} onChange={props.onAlignmentChange} disabled={noBg} />
      </div>
    </aside>
  );
}

function NumericRow({
  label,
  value,
  min,
  max,
  onChange,
  disabled,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <SectionLabel>{label}</SectionLabel>
      <div className="flex items-center gap-2">
        <input
          type="range"
          min={min}
          max={max}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(Number(e.target.value))}
          className="flex-1 accent-amber-400 disabled:opacity-50"
        />
        <span className="w-10 shrink-0 text-right font-mono text-xs text-white/60">{value}</span>
      </div>
    </div>
  );
}

function AlignmentGrid({
  value,
  onChange,
  disabled,
}: {
  value: EditorAlignment;
  onChange: (a: EditorAlignment) => void;
  disabled?: boolean;
}) {
  return (
    <div className="inline-grid grid-cols-3 gap-1 rounded-md border border-white/10 bg-white/[0.04] p-1">
      {ALIGNMENT_GRID.map((a) => {
        const active = value === a;
        return (
          <button
            key={a}
            type="button"
            onClick={() => onChange(a)}
            disabled={disabled}
            title={a}
            aria-label={`Align ${a}`}
            className={cn(
              'h-7 w-7 rounded transition',
              active
                ? 'bg-amber-400 text-slate-900'
                : 'bg-white/[0.04] text-white/40 hover:bg-white/10 hover:text-white/70',
              disabled && 'cursor-not-allowed opacity-50',
            )}
          >
            <span className="grid place-items-center text-[10px] leading-none">●</span>
          </button>
        );
      })}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-white/45">
      {children}
    </div>
  );
}
