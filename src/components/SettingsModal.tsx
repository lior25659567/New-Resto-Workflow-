import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import teethModelImg from "../assets/Clincheck weave model.png";

// ─── Types ────────────────────────────────────────────────────────────────────
interface SettingsModalProps {
  onClose: () => void;
  canvasBg?: string;
  onCanvasBgChange?: (color: string) => void;
}

type SettingsPage = "main" | "screen-appearance" | "brightness";

interface ThemeConfig {
  color: string;
  label: string;
}

type ThemePickerVariant = 1 | 2 | 3 | 4 | 5 | 6;

// ─── Data ─────────────────────────────────────────────────────────────────────
const BG_THEMES: ThemeConfig[] = [
  { color: "#E0EDF4", label: "Default" },
  { color: "#FAFAFA", label: "Light" },
  { color: "#F4F4F5", label: "Light Medium" },
  { color: "#D4D4D8", label: "Medium" },
  { color: "#71717A", label: "Dark Medium" },
  { color: "#3F3F46", label: "Dark" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const DARK_COLORS = new Set(["#71717A", "#3F3F46"]);
const isDark = (color: string) => DARK_COLORS.has(color);
const uiAlpha = (color: string, a: number) =>
  isDark(color) ? `rgba(255,255,255,${a})` : `rgba(62,61,64,${a})`;

// ─── Hook: variant keyboard switcher (keys 1–N) ───────────────────────────────
function useVariantKey(count: number): ThemePickerVariant {
  const [variant, setVariant] = useState<ThemePickerVariant>(1);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const n = Number(e.key);
      if (n >= 1 && n <= count) setVariant(n as ThemePickerVariant);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [count]);
  return variant;
}

// ─── Primitive: Svg ───────────────────────────────────────────────────────────
// Shared wrapper for the self-contained inline icons. All icons share one
// stroke color + line style so the grid reads as a consistent set.
const ICON_STROKE = "#2BABE2";
function Svg({ children, size = 40 }: { children: React.ReactNode; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      stroke={ICON_STROKE}
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

// ─── Primitive: MockAppPreview ────────────────────────────────────────────────
// The mini iTero app chrome rendered inside every theme preview card.
// Fill the parent with `className="absolute inset-0"`.
function MockAppPreview({ color, className }: { color: string; className?: string }) {
  const ui = (a: number) => uiAlpha(color, a);
  return (
    <div className={`overflow-hidden ${className ?? "relative"}`} style={{ backgroundColor: color }}>
      {/* Header bar */}
      <div className="absolute left-[8px] right-[8px] top-[8px] h-[9px] rounded-[2px]" style={{ backgroundColor: ui(0.15) }} />

      {/* Sidebar text lines */}
      <div className="absolute top-[26px] left-[10px] flex flex-col gap-[3px]">
        <div className="h-[5px] w-[28px] rounded-[1px]" style={{ backgroundColor: ui(0.18) }} />
        <div className="h-[5px] w-[20px] rounded-[1px]" style={{ backgroundColor: ui(0.12) }} />
        <div className="h-[5px] w-[24px] rounded-[1px]" style={{ backgroundColor: ui(0.10) }} />
      </div>

      {/* Toolbar icon dots */}
      <div className="absolute top-[26px] right-[6px] flex gap-[3px]">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="w-[9px] h-[9px] rounded-[2px]" style={{ backgroundColor: ui(0.18) }} />
        ))}
      </div>

      {/* Teeth model centered */}
      <div className="absolute inset-0 flex items-center justify-center pt-[14px]">
        <img src={teethModelImg} alt="" className="max-w-[38%] max-h-[48%] object-contain drop-shadow-md" />
      </div>
    </div>
  );
}

// ─── Primitive: RadioButton ───────────────────────────────────────────────────
function RadioButton({
  selected,
  onSelect,
  label,
}: {
  selected: boolean;
  onSelect: () => void;
  label?: string;
}) {
  return (
    <button
      onClick={onSelect}
      role="radio"
      aria-checked={selected}
      aria-label={label}
      className={`w-[20px] h-[20px] rounded-full border-[2px] transition-all duration-200 relative flex items-center justify-center shrink-0 ${
        selected
          ? "border-[#009ACE] bg-white"
          : "border-[#d1d5db] bg-white hover:border-[#9ca3af] focus:border-[#009ACE] focus:ring-2 focus:ring-[#009ACE]/20"
      }`}
    >
      <div
        className={`w-[10px] h-[10px] rounded-full transition-all duration-200 ease-out ${
          selected ? "bg-[#009ACE] scale-100 opacity-100" : "bg-transparent scale-75 opacity-0"
        }`}
      />
    </button>
  );
}

// ─── Primitive: ThemeCard ─────────────────────────────────────────────────────
// Shared card: preview + selection ring + label row.
// variant="radio"  → radio button + left-aligned label below
// variant="border" → no radio, centered label, border-only selection ring
function ThemeCard({
  theme,
  selected,
  variant,
  onSelect,
}: {
  theme: ThemeConfig;
  selected: boolean;
  variant: "radio" | "border";
  onSelect: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-[8px] w-full">
      {/* Preview card + selection ring */}
      <div
        onClick={onSelect}
        className={`w-full aspect-video rounded-[10px] overflow-hidden relative cursor-pointer transition-all ${
          selected
            ? "border-[2px] border-[#009ACE] shadow-[0_0_0_4px_rgba(0,154,206,0.12)]"
            : "border-[1px] border-[#e5e5e5] hover:border-[#d1d1d1]"
        }`}
      >
        <MockAppPreview color={theme.color} className="absolute inset-0" />
      </div>

      {/* Label row */}
      {variant === "radio" ? (
        <div className="flex items-center gap-[8px] w-full">
          <RadioButton selected={selected} onSelect={onSelect} label={`Select ${theme.label}`} />
          <span
            onClick={onSelect}
            className={`font-['Roboto',sans-serif] text-[13px] leading-[18px] truncate flex-1 cursor-pointer transition-colors duration-200 ${
              selected ? "font-medium text-[#1f2937]" : "font-normal text-[#4b5563] hover:text-[#1f2937]"
            }`}
            style={{ fontVariationSettings: "'wdth' 100" }}
          >
            {theme.label}
          </span>
        </div>
      ) : (
        <span
          className={`font-['Roboto',sans-serif] text-[13px] text-center leading-[16px] transition-colors ${
            selected ? "font-medium text-[#009ACE]" : "font-normal text-[#3e3d40]"
          }`}
          style={{ fontVariationSettings: "'wdth' 100" }}
        >
          {theme.label}
        </span>
      )}
    </div>
  );
}

// ─── Primitive: SettingsTile ──────────────────────────────────────────────────
function SettingsTile({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center justify-start hover:bg-[rgba(144,235,255,0.12)] active:bg-[rgba(144,235,255,0.22)] transition-colors cursor-pointer shrink-0"
      style={{ width: 105, minHeight: 75, background: "rgba(144,235,255,0)", padding: 0 }}
    >
      <div className="flex flex-col items-center gap-[15px]">
        <div className="flex items-center justify-center" style={{ width: 44, height: 44 }}>
          {icon}
        </div>
        <span
          style={{
            fontFamily: "'Avenir', 'Avenir Next', sans-serif",
            fontWeight: 500,
            fontSize: 14,
            lineHeight: "20px",
            color: "#3e3d40",
            textAlign: "center",
            whiteSpace: "normal",
            wordBreak: "break-word",
          }}
        >
          {label}
        </span>
      </div>
    </button>
  );
}

function SectionDivider() {
  return <div className="w-full h-px bg-[#c4c4c4] mb-[20px]" />;
}

function SectionHead({ title }: { title: string }) {
  return (
    <p
      style={{
        fontFamily: "'Avenir', 'Avenir Next', sans-serif",
        fontWeight: 500,
        fontSize: 18,
        lineHeight: "19px",
        color: "#3e3d40",
        marginBottom: 30,
        whiteSpace: "nowrap",
      }}
    >
      {title}
    </p>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────
function BrightnessIcon() {
  return (
    <Svg>
      <circle cx="20" cy="20" r="6" />
      <path d="M20 4v4M20 32v4M4 20h4M32 20h4M8.3 8.3l2.8 2.8M28.9 28.9l2.8 2.8M31.7 8.3l-2.8 2.8M11.1 28.9l-2.8 2.8" />
    </Svg>
  );
}

function VolumeIcon() {
  return (
    <Svg>
      <path d="M6 16v8h4l6 5V11l-6 5H6z" />
      <path d="M21 15a6 6 0 0 1 0 10" />
      <path d="M25 11a11 11 0 0 1 0 18" />
    </Svg>
  );
}

function WifiIcon() {
  return (
    <Svg>
      <path d="M4 14a24 24 0 0 1 32 0" />
      <path d="M9 20a16 16 0 0 1 22 0" />
      <path d="M14 26a8 8 0 0 1 12 0" />
      <circle cx="20" cy="32" r="1.4" fill={ICON_STROKE} stroke="none" />
    </Svg>
  );
}

function TimezoneIcon() {
  return (
    <Svg>
      <circle cx="20" cy="20" r="14" />
      <path d="M20 12v8l5 3" />
    </Svg>
  );
}

function ScanIcon() {
  return (
    <svg width="43" height="41" viewBox="0 0 43 41" fill="none">
      <path d="M31.1272 39.9993L14.2599 23.132C14.0279 22.8853 13.8988 22.5594 13.8988 22.2208C13.8988 21.8821 14.0279 21.5563 14.2599 21.3096L23.0128 12.5567C23.2602 12.3208 23.5889 12.1893 23.9307 12.1893C24.2725 12.1893 24.6012 12.3208 24.8485 12.5567L41.7025 29.4107" stroke="#2BABE2" strokeWidth="2.5" strokeMiterlimit="10"/>
      <path d="M22.8664 12.7037L14.4061 21.1639L1.70245 6.34519L8.04764 0L22.8664 12.7037Z" stroke="#2BABE2" strokeWidth="2.5" strokeMiterlimit="10"/>
      <path d="M5.93274 8.4728L10.1762 4.22937" stroke="#2BABE2" strokeWidth="2.5" strokeMiterlimit="10"/>
      <path d="M22.4786 17.3306L19.036 20.7733C18.8178 20.9914 18.8178 21.3452 19.036 21.5634L25.6579 28.1853C25.8761 28.4035 26.2298 28.4035 26.448 28.1853L29.8906 24.7427C30.1088 24.5245 30.1088 24.1707 29.8907 23.9525L23.2687 17.3306C23.0506 17.1124 22.6968 17.1125 22.4786 17.3306Z" stroke="#2BABE2" strokeWidth="2.5" strokeMiterlimit="10"/>
    </svg>
  );
}

function RxIcon() {
  return (
    <Svg>
      <rect x="9" y="6" width="22" height="28" rx="2" />
      <path d="M14 14h12M14 20h12M14 26h7" />
    </Svg>
  );
}

function SignatureIcon() {
  return (
    <Svg>
      <path d="M5 30c5 1 7-7 10-7s2 5 5 5 4-9 7-9" />
      <path d="M27 28l3-3 4 4-3 3z" />
      <path d="M6 35h24" />
    </Svg>
  );
}

function LanguageIcon() {
  return (
    <Svg>
      <circle cx="20" cy="20" r="14" />
      <path d="M6 20h28M20 6v28" />
      <path d="M20 6c5 4 5 24 0 28M20 6c-5 4-5 24 0 28" />
    </Svg>
  );
}

function LoginIcon() {
  return (
    <Svg>
      <circle cx="20" cy="14" r="6" />
      <path d="M8 33c0-7 5-11 12-11s12 4 12 11" />
    </Svg>
  );
}

function DiagnosticsIcon() {
  return (
    <Svg>
      <rect x="5" y="9" width="30" height="22" rx="2" />
      <path d="M9 21h5l3-7 4 12 3-5h6" />
    </Svg>
  );
}

function LicensesIcon() {
  return (
    <Svg>
      <circle cx="20" cy="15" r="9" />
      <path d="M15 23l-2 12 7-4 7 4-2-12" />
      <path d="M16 15l3 3 5-6" />
    </Svg>
  );
}

function SysInfoIcon() {
  return (
    <Svg>
      <circle cx="20" cy="20" r="14" />
      <path d="M20 19v8" />
      <circle cx="20" cy="13" r="1.4" fill={ICON_STROKE} stroke="none" />
    </Svg>
  );
}

function SyncIcon() {
  return (
    <Svg>
      <path d="M8 18a12 12 0 0 1 20-7l3 3" />
      <path d="M31 6v8h-8" />
      <path d="M32 22a12 12 0 0 1-20 7l-3-3" />
      <path d="M9 34v-8h8" />
    </Svg>
  );
}

function ExportIcon() {
  return (
    <Svg>
      <path d="M20 25V8" />
      <path d="M13 15l7-7 7 7" />
      <path d="M8 24v8h24v-8" />
    </Svg>
  );
}

function ScreenAppearanceIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 48 48" fill="none">
      <rect x="8" y="10" width="32" height="22" rx="3" stroke="#009ACE" strokeWidth="2.5"/>
      <path d="M18 36h12" stroke="#009ACE" strokeWidth="2.5" strokeLinecap="round"/>
      <path d="M24 32v4" stroke="#009ACE" strokeWidth="2.5" strokeLinecap="round"/>
      <circle cx="16" cy="21" r="4" fill="#E0EDF4" stroke="#009ACE" strokeWidth="1.5"/>
      <circle cx="24" cy="21" r="4" fill="#5F5F5F" stroke="#009ACE" strokeWidth="1.5"/>
      <circle cx="32" cy="21" r="4" fill="#2C2C2C" stroke="#009ACE" strokeWidth="1.5"/>
    </svg>
  );
}

// ─── Theme Picker Variants ────────────────────────────────────────────────────

interface ThemePickerProps {
  canvasBg: string;
  onCanvasBgChange?: (color: string) => void;
}

// Variant 1 — Radio button + preview card grid
function VariantCards({ canvasBg, onCanvasBgChange }: ThemePickerProps) {
  return (
    <div className="grid grid-cols-3 gap-[20px] w-full">
      {BG_THEMES.map((theme) => (
        <ThemeCard
          key={theme.color}
          theme={theme}
          selected={canvasBg === theme.color}
          variant="radio"
          onSelect={() => onCanvasBgChange?.(theme.color)}
        />
      ))}
    </div>
  );
}

// Variant 2 — Dropdown selector
function VariantDropdown({ canvasBg, onCanvasBgChange }: ThemePickerProps) {
  const [open, setOpen] = useState(false);
  const selected = BG_THEMES.find((t) => t.color === canvasBg) ?? BG_THEMES[0];

  return (
    <div className="relative w-[360px]">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-[12px] px-[16px] bg-white border border-[#d1d1d1] rounded-[8px] hover:border-[#a0a0a0] transition-colors cursor-pointer"
        style={{ minHeight: 60 }}
      >
        <div className="w-[36px] h-[36px] rounded-[6px] border border-[#d1d1d1] shrink-0" style={{ backgroundColor: selected.color }} />
        <span className="font-['Roboto',sans-serif] font-normal text-[14px] text-[#3e3d40] flex-1 text-left" style={{ fontVariationSettings: "'wdth' 100" }}>
          {selected.label}
        </span>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className={`transition-transform ${open ? "rotate-180" : ""}`}>
          <path d="M4 6l4 4 4-4" stroke="#717073" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-[4px] bg-white border border-[#d1d1d1] rounded-[8px] shadow-[0_4px_12px_rgba(0,0,0,0.1)] overflow-hidden z-10">
          {BG_THEMES.map((theme) => {
            const isSelected = canvasBg === theme.color;
            return (
              <button
                key={theme.color}
                onClick={() => { onCanvasBgChange?.(theme.color); setOpen(false); }}
                className={`w-full flex items-center gap-[12px] px-[16px] transition-colors cursor-pointer ${isSelected ? "bg-[#f0f9ff]" : "hover:bg-[#f5f5f5]"}`}
                style={{ minHeight: 60 }}
              >
                <div className="w-[36px] h-[36px] rounded-[6px] border border-[#d1d1d1] shrink-0" style={{ backgroundColor: theme.color }} />
                <span
                  className={`font-['Roboto',sans-serif] text-[14px] flex-1 text-left ${isSelected ? "font-medium text-[#009ACE]" : "font-normal text-[#3e3d40]"}`}
                  style={{ fontVariationSettings: "'wdth' 100" }}
                >
                  {theme.label}
                </span>
                {isSelected && (
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M3 8l3.5 3.5L13 5" stroke="#009ACE" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Variant 3 — Circle swatches
function VariantCircles({ canvasBg, onCanvasBgChange }: ThemePickerProps) {
  return (
    <div className="flex items-center gap-[20px]">
      {BG_THEMES.map((theme) => {
        const isSelected = canvasBg === theme.color;
        return (
          <button
            key={theme.color}
            onClick={() => onCanvasBgChange?.(theme.color)}
            className="flex flex-col items-center gap-[8px] cursor-pointer group"
            style={{ minWidth: 60, minHeight: 60 }}
          >
            <div
              className={`w-[60px] h-[60px] rounded-full border-[3px] transition-all ${
                isSelected
                  ? "border-[#009ACE] scale-110 shadow-[0_0_0_3px_rgba(0,154,206,0.2)]"
                  : "border-[#d1d1d1] group-hover:border-[#999] group-hover:scale-105"
              }`}
              style={{ backgroundColor: theme.color }}
            />
            <span
              className={`font-['Roboto',sans-serif] text-[12px] text-center leading-[14px] transition-colors ${
                isSelected ? "font-medium text-[#009ACE]" : "font-normal text-[#717073]"
              }`}
              style={{ fontVariationSettings: "'wdth' 100" }}
            >
              {theme.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// Variant 4 — Small square swatches (no label)
function VariantSwatches({ canvasBg, onCanvasBgChange }: ThemePickerProps) {
  return (
    <div className="flex flex-wrap gap-[10px]">
      {BG_THEMES.map((theme) => {
        const isSelected = canvasBg === theme.color;
        return (
          <button
            key={theme.color}
            onClick={() => onCanvasBgChange?.(theme.color)}
            className={`relative w-[48px] h-[48px] rounded-[8px] transition-all cursor-pointer ${
              isSelected
                ? "border-[2px] border-[#009ACE] shadow-[0_0_0_1px_rgba(0,154,206,0.3)] scale-105"
                : "border-[1px] border-[#e5e5e5] hover:border-[#d1d1d1]"
            }`}
            style={{ backgroundColor: theme.color }}
            title={theme.label}
          >
            {isSelected && (
              <svg className="absolute inset-0 m-auto" width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M4 9l3.5 3.5L14 6" stroke="#009ACE" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </button>
        );
      })}
    </div>
  );
}

// Variant 5 — Border-only selection, centered label (no radio)
function VariantCards3Col({ canvasBg, onCanvasBgChange }: ThemePickerProps) {
  return (
    <div className="grid grid-cols-3 gap-[12px]">
      {BG_THEMES.map((theme) => (
        <ThemeCard
          key={theme.color}
          theme={theme}
          selected={canvasBg === theme.color}
          variant="border"
          onSelect={() => onCanvasBgChange?.(theme.color)}
        />
      ))}
    </div>
  );
}

// Variant 6 — Full live preview of the iTero app canvas + swatch strip
function VariantLivePreview({ canvasBg, onCanvasBgChange }: ThemePickerProps) {
  const ui = (a: number) => uiAlpha(canvasBg, a);

  return (
    <div className="flex flex-col gap-[20px]">
      {/* Live app preview */}
      <div
        className="w-full rounded-[10px] overflow-hidden border-[2px] border-[#c0c0c0] shadow-[0_4px_24px_rgba(0,0,0,0.18)] flex flex-col"
        style={{ aspectRatio: "16/9" }}
      >
        {/* App header bar */}
        <div className="bg-[#1c1c1c] flex items-center justify-between shrink-0 px-[2%]" style={{ flex: "0 0 9%" }}>
          <div className="flex items-center gap-[6px]">
            <div className="rounded-[3px] bg-[#009ACE]" style={{ width: 18, height: 18 }} />
            <div className="rounded-[2px]" style={{ width: 48, height: 7, background: "rgba(255,255,255,0.25)" }} />
          </div>
          <div className="flex gap-[6px] items-center">
            <div className="rounded-[2px]" style={{ width: 70, height: 6, background: "rgba(255,255,255,0.35)" }} />
            <div className="rounded-[2px]" style={{ width: 44, height: 6, background: "rgba(255,255,255,0.2)" }} />
          </div>
          <div className="flex gap-[6px]">
            {[22, 16, 16].map((w, i) => (
              <div key={i} className="rounded-[3px]" style={{ width: w, height: 16, background: "rgba(255,255,255,0.18)" }} />
            ))}
          </div>
        </div>

        {/* Canvas */}
        <div className="flex flex-1 min-h-0" style={{ background: canvasBg }}>
          {/* Left panel */}
          <div className="flex flex-col items-center shrink-0 pt-[3%] gap-[5%]" style={{ width: "9%" }}>
            <div className="rounded-[4px] border" style={{ width: "65%", aspectRatio: "1/1.9", background: ui(0.22), borderColor: ui(0.3) }} />
            <div className="rounded-[3px]" style={{ width: "65%", height: 14, background: ui(0.35) }} />
          </div>

          {/* Center canvas */}
          <div className="flex-1 flex flex-col items-center justify-center relative">
            <div className="absolute top-[8%] flex gap-[3px]">
              {["Upper", "Lower", "Both"].map((label, i) => (
                <div key={label} className="rounded-[3px]" style={{
                  padding: "2px 7px",
                  background: i === 0 ? "rgba(255,255,255,0.85)" : ui(0.18),
                  fontSize: 7,
                  fontFamily: "Roboto, sans-serif",
                  color: i === 0 ? "#3e3d40" : ui(0.8),
                  lineHeight: "13px",
                }}>
                  {label}
                </div>
              ))}
            </div>
            <img src={teethModelImg} alt="" style={{ maxWidth: "34%", maxHeight: "58%", objectFit: "contain", filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.22))" }} />
            <div className="absolute bottom-[7%] left-[2%] rounded-[4px]" style={{ width: "14%", height: "18%", background: ui(0.18), border: `1px solid ${ui(0.2)}` }} />
          </div>

          {/* Right toolbar */}
          <div className="flex flex-col items-center shrink-0 pt-[3%] gap-[3%]" style={{ width: "6%" }}>
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="rounded-[3px]" style={{ width: "55%", aspectRatio: "1/1", background: i === 0 ? "rgba(0,154,206,0.75)" : ui(0.22) }} />
            ))}
          </div>
        </div>
      </div>

      {/* Swatch row */}
      <div className="flex items-center gap-[16px]">
        {BG_THEMES.map((theme) => {
          const isSelected = canvasBg === theme.color;
          return (
            <button
              key={theme.color}
              onClick={() => onCanvasBgChange?.(theme.color)}
              className="flex flex-col items-center gap-[5px] cursor-pointer group"
            >
              <div
                className={`rounded-[8px] transition-all ${
                  isSelected
                    ? "border-[2px] border-[#009ACE] scale-105 shadow-[0_0_0_1px_rgba(0,154,206,0.25)]"
                    : "border-[1px] border-[#e5e5e5] group-hover:border-[#d1d1d1]"
                }`}
                style={{ width: 48, height: 48, backgroundColor: theme.color }}
              />
              <span
                className={`font-['Roboto',sans-serif] text-[11px] text-center leading-[14px] transition-colors ${
                  isSelected ? "font-medium text-[#009ACE]" : "font-normal text-[#717073]"
                }`}
                style={{ fontVariationSettings: "'wdth' 100" }}
              >
                {theme.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Pages ────────────────────────────────────────────────────────────────────

function MainPage({
  onNavigate,
  canvasBg,
  onCanvasBgChange,
}: {
  onNavigate: (page: SettingsPage) => void;
  canvasBg: string;
  onCanvasBgChange?: (color: string) => void;
}) {
  return (
    <div className="flex flex-col">
      <div className="flex flex-col pr-[10px] py-[10px]">
        <SectionHead title="Computer Settings" />
        <div className="flex gap-[30px] items-start pb-[38px]">
          <SettingsTile icon={<BrightnessIcon />} label="Brightness" onClick={() => onNavigate("brightness")} />
          <SettingsTile icon={<VolumeIcon />} label="Volume" />
          <SettingsTile icon={<WifiIcon />} label="Wi-Fi" />
          <SettingsTile icon={<TimezoneIcon />} label="Time Zone" />
        </div>
      </div>

      <SectionDivider />

      <div className="flex flex-col pr-[10px] py-[10px]">
        <SectionHead title="User Settings" />
        <div className="flex gap-[30px] items-start pb-[38px]">
          <SettingsTile icon={<ScanIcon />} label="Scan Settings" />
          <SettingsTile icon={<RxIcon />} label="Rx Settings" />
          <SettingsTile icon={<SignatureIcon />} label="Signature Settings" />
          <SettingsTile icon={<LanguageIcon />} label="Language" />
          <SettingsTile icon={<ScreenAppearanceIcon />} label="View Appearance" onClick={() => onNavigate("screen-appearance")} />
        </div>
      </div>

      <SectionDivider />

      <div className="flex flex-col pr-[10px] py-[10px]">
        <SectionHead title="System Settings" />
        <div className="flex gap-[30px] items-start pb-[38px]">
          <SettingsTile icon={<LoginIcon />} label="Login" />
          <SettingsTile icon={<DiagnosticsIcon />} label="Diagnostics" />
          <SettingsTile icon={<LicensesIcon />} label="Licenses" />
          <SettingsTile icon={<SysInfoIcon />} label="System Information" />
          <SettingsTile icon={<SyncIcon />} label="Sync Configuration" />
          <SettingsTile icon={<ExportIcon />} label="Export Settings" />
        </div>
      </div>
    </div>
  );
}

function ScreenAppearancePage({ canvasBg, onCanvasBgChange }: ThemePickerProps) {
  const variant = useVariantKey(6);

  const VARIANTS: Record<number, React.ReactNode> = {
    1: <VariantCards canvasBg={canvasBg} onCanvasBgChange={onCanvasBgChange} />,
    2: <VariantDropdown canvasBg={canvasBg} onCanvasBgChange={onCanvasBgChange} />,
    3: <VariantCircles canvasBg={canvasBg} onCanvasBgChange={onCanvasBgChange} />,
    4: <VariantSwatches canvasBg={canvasBg} onCanvasBgChange={onCanvasBgChange} />,
    5: <VariantCards3Col canvasBg={canvasBg} onCanvasBgChange={onCanvasBgChange} />,
    6: <VariantLivePreview canvasBg={canvasBg} onCanvasBgChange={onCanvasBgChange} />,
  };

  return (
    <div className="flex flex-col gap-[24px] w-full">
      <p
        className="font-['Roboto',sans-serif] font-medium text-[18px] text-[#3e3d40] leading-[24px]"
        style={{ fontVariationSettings: "'wdth' 100" }}
      >
        Choose a canvas background to suit your workspace.
      </p>
      {VARIANTS[variant]}
    </div>
  );
}

function BrightnessPage({ canvasBg, onCanvasBgChange }: ThemePickerProps) {
  const [brightness, setBrightness] = useState(75);
  const variant = useVariantKey(6);

  const VARIANTS: Record<number, React.ReactNode> = {
    1: <VariantCards canvasBg={canvasBg} onCanvasBgChange={onCanvasBgChange} />,
    2: <VariantDropdown canvasBg={canvasBg} onCanvasBgChange={onCanvasBgChange} />,
    3: <VariantCircles canvasBg={canvasBg} onCanvasBgChange={onCanvasBgChange} />,
    4: <VariantSwatches canvasBg={canvasBg} onCanvasBgChange={onCanvasBgChange} />,
    5: <VariantCards3Col canvasBg={canvasBg} onCanvasBgChange={onCanvasBgChange} />,
    6: <VariantLivePreview canvasBg={canvasBg} onCanvasBgChange={onCanvasBgChange} />,
  };

  return (
    <div className="flex flex-col gap-[32px]">
      <div className="flex flex-col gap-[12px]">
        <p className="font-['Roboto',sans-serif] font-medium text-[15px] text-[#3e3d40] leading-[20px]" style={{ fontVariationSettings: "'wdth' 100" }}>
          Brightness
        </p>
        <div className="w-full max-w-[400px] flex flex-col gap-[8px]">
          <input
            type="range" min="0" max="100" value={brightness}
            onChange={(e) => setBrightness(Number(e.target.value))}
            className="w-full h-[4px] appearance-none bg-[#d1d1d1] rounded-full outline-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-[20px] [&::-webkit-slider-thumb]:h-[20px] [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-[#d1d1d1] [&::-webkit-slider-thumb]:rounded-[4px] [&::-webkit-slider-thumb]:cursor-pointer"
          />
          <div className="flex justify-between">
            <span className="font-['Roboto',sans-serif] text-[13px] text-[#717073]">0</span>
            <span className="font-['Roboto',sans-serif] text-[13px] text-[#717073]">100</span>
          </div>
        </div>
      </div>

      <div className="border-t border-[#d1d1d1]" />

      <div className="flex flex-col gap-[20px]">
        <p className="font-['Roboto',sans-serif] font-medium text-[18px] text-[#3e3d40] leading-[24px]" style={{ fontVariationSettings: "'wdth' 100" }}>
          Choose a canvas background to suit your workspace.
        </p>
        {VARIANTS[variant]}
      </div>
    </div>
  );
}

// ─── SettingsModal ────────────────────────────────────────────────────────────
export default function SettingsModal({
  onClose,
  canvasBg = "#E0EDF4",
  onCanvasBgChange,
}: SettingsModalProps) {
  const [currentPage, setCurrentPage] = useState<SettingsPage>("main");

  const pageTitle =
    currentPage === "main" ? "Settings" :
    currentPage === "screen-appearance" ? "View Appearance" :
    "Display Settings";

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ zIndex: 99999, pointerEvents: "auto" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="flex flex-col"
        style={{ width: 898, height: 732, background: "#f4f4f5", border: "1px solid #000" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start px-[15px] py-[20px] shrink-0 w-full">
          <div className="flex flex-1 items-start p-[15px] min-w-0">
            {currentPage === "main" ? (
              <button
                onClick={onClose}
                className="shrink-0 leading-none hover:opacity-70 transition-opacity"
                style={{ fontFamily: "'Avenir', 'Avenir Next', sans-serif", fontWeight: 900, fontSize: 60, lineHeight: "34px", color: "#ace1f5", width: 36, background: "none", border: "none", padding: 0, cursor: "pointer" }}
              >
                ×
              </button>
            ) : (
              <button
                onClick={() => setCurrentPage("main")}
                className="shrink-0 leading-none hover:opacity-70 transition-opacity flex items-center"
                style={{ color: "#ace1f5", background: "none", border: "none", padding: 0, cursor: "pointer", width: 36, height: 34 }}
              >
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ace1f5" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 18l-6-6 6-6"/>
                </svg>
              </button>
            )}
            <div className="flex flex-1 items-center justify-center pr-[36px] min-w-0">
              <p
                className="shrink-0 whitespace-nowrap"
                style={{ fontFamily: "'Avenir', 'Avenir Next', sans-serif", fontWeight: 500, fontSize: 24, lineHeight: "34px", color: "#3e3d40" }}
              >
                {pageTitle}
              </p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div
          className="flex-1 overflow-hidden pb-[30px] flex flex-col w-full"
          style={{ paddingLeft: 30, paddingRight: currentPage === "main" ? 90 : 30 }}
        >
          {currentPage === "main" && (
            <MainPage onNavigate={setCurrentPage} canvasBg={canvasBg} onCanvasBgChange={onCanvasBgChange} />
          )}
          {currentPage === "screen-appearance" && (
            <ScreenAppearancePage canvasBg={canvasBg} onCanvasBgChange={onCanvasBgChange} />
          )}
          {currentPage === "brightness" && (
            <BrightnessPage canvasBg={canvasBg} onCanvasBgChange={onCanvasBgChange} />
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
