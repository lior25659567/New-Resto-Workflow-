import { useState } from "react";
import { createPortal } from "react-dom";
import teethModelImg from "../assets/Clincheck weave model.png";

interface SettingsModalProps {
  onClose: () => void;
  canvasBg?: string;
  onCanvasBgChange?: (color: string) => void;
  overlay?: boolean;
}

type SettingsPage = 'main' | 'screen-appearance' | 'brightness';

const BG_THEMES = [
  { color: "#D6E7F1", label: "iTero Blue", isDefault: true },
  { color: "#5F5F5F", label: "Medium Gray" },
  { color: "#595959", label: "Dark Gray" },
  { color: "#737373", label: "Gray" },
  { color: "#F7F7F7", label: "Light" },
];

function BrightnessIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
      <circle cx="24" cy="24" r="8" stroke="#009ACE" strokeWidth="2.5"/>
      <path d="M24 6v6M24 36v6M6 24h6M36 24h6M11.5 11.5l4.2 4.2M32.3 32.3l4.2 4.2M36.5 11.5l-4.2 4.2M15.7 32.3l-4.2 4.2" stroke="#009ACE" strokeWidth="2.5" strokeLinecap="round"/>
    </svg>
  );
}

function VolumeIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
      <path d="M12 20h6l8-8v24l-8-8h-6a2 2 0 01-2-2v-4a2 2 0 012-2z" stroke="#009ACE" strokeWidth="2.5" strokeLinejoin="round"/>
      <path d="M32 18a8 8 0 010 12" stroke="#009ACE" strokeWidth="2.5" strokeLinecap="round"/>
      <path d="M36 14a14 14 0 010 20" stroke="#009ACE" strokeWidth="2.5" strokeLinecap="round"/>
    </svg>
  );
}

function WifiIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
      <path d="M8 20c8.8-8 23.2-8 32 0" stroke="#009ACE" strokeWidth="2.5" strokeLinecap="round"/>
      <path d="M13 26c6.1-5.5 15.9-5.5 22 0" stroke="#009ACE" strokeWidth="2.5" strokeLinecap="round"/>
      <path d="M18 32c3.3-3 8.7-3 12 0" stroke="#009ACE" strokeWidth="2.5" strokeLinecap="round"/>
      <circle cx="24" cy="37" r="2" fill="#009ACE"/>
    </svg>
  );
}

function TimeZoneIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
      <circle cx="24" cy="24" r="16" stroke="#009ACE" strokeWidth="2.5"/>
      <path d="M24 12v12l8 4" stroke="#009ACE" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function ScanSettingsIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
      <rect x="16" y="8" width="16" height="32" rx="4" stroke="#009ACE" strokeWidth="2.5"/>
      <path d="M20 14h8M20 18h8" stroke="#009ACE" strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="24" cy="34" r="3" stroke="#009ACE" strokeWidth="2"/>
      <path d="M22 26h4" stroke="#009ACE" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

function RxSettingsIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
      <path d="M16 10h6c4 0 7 3 7 7s-3 7-7 7h-6V10z" stroke="#009ACE" strokeWidth="2.5"/>
      <path d="M16 10v28" stroke="#009ACE" strokeWidth="2.5" strokeLinecap="round"/>
      <path d="M22 24l10 14" stroke="#009ACE" strokeWidth="2.5" strokeLinecap="round"/>
      <path d="M28 24l-4 6" stroke="#009ACE" strokeWidth="2.5" strokeLinecap="round"/>
    </svg>
  );
}

function SignatureSettingsIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
      <path d="M10 34c4-8 6 4 10-2s4 6 8 0 4 4 8-2 2 6 4 2" stroke="#009ACE" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M10 38h28" stroke="#009ACE" strokeWidth="2" strokeLinecap="round" strokeDasharray="2 3"/>
    </svg>
  );
}

function LocalizationIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
      <circle cx="24" cy="24" r="14" stroke="#009ACE" strokeWidth="2.5"/>
      <ellipse cx="24" cy="24" rx="7" ry="14" stroke="#009ACE" strokeWidth="2"/>
      <path d="M10 24h28" stroke="#009ACE" strokeWidth="2"/>
      <path d="M12 17h24M12 31h24" stroke="#009ACE" strokeWidth="1.5"/>
    </svg>
  );
}

function AccountPairingIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
      <circle cx="19" cy="20" r="6" stroke="#009ACE" strokeWidth="2.5"/>
      <circle cx="31" cy="20" r="6" stroke="#009ACE" strokeWidth="2.5"/>
      <path d="M10 38c0-5 4-9 9-9h4" stroke="#009ACE" strokeWidth="2.5" strokeLinecap="round"/>
      <path d="M26 38c0-5 4-9 9-9" stroke="#009ACE" strokeWidth="2.5" strokeLinecap="round"/>
    </svg>
  );
}

function PinIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
      <rect x="12" y="12" width="6" height="8" rx="1" stroke="#009ACE" strokeWidth="2"/>
      <rect x="21" y="12" width="6" height="8" rx="1" stroke="#009ACE" strokeWidth="2"/>
      <rect x="30" y="12" width="6" height="8" rx="1" stroke="#009ACE" strokeWidth="2"/>
      <rect x="12" y="24" width="6" height="8" rx="1" stroke="#009ACE" strokeWidth="2"/>
      <rect x="21" y="24" width="6" height="8" rx="1" stroke="#009ACE" strokeWidth="2"/>
      <rect x="30" y="24" width="6" height="8" rx="1" stroke="#009ACE" strokeWidth="2"/>
      <circle cx="15" cy="16" r="1" fill="#009ACE"/>
      <circle cx="24" cy="16" r="1" fill="#009ACE"/>
      <circle cx="33" cy="16" r="1" fill="#009ACE"/>
      <circle cx="15" cy="28" r="1" fill="#009ACE"/>
      <circle cx="24" cy="28" r="1" fill="#009ACE"/>
      <circle cx="33" cy="28" r="1" fill="#009ACE"/>
    </svg>
  );
}

function LoginSettingsIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
      <rect x="10" y="10" width="28" height="28" rx="4" stroke="#009ACE" strokeWidth="2.5"/>
      <circle cx="24" cy="20" r="5" stroke="#009ACE" strokeWidth="2"/>
      <path d="M15 34c0-5 4-9 9-9s9 4 9 9" stroke="#009ACE" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}

function DiagnosticsIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
      <circle cx="24" cy="24" r="14" stroke="#009ACE" strokeWidth="2.5"/>
      <path d="M24 14v4M24 30v4M14 24h4M30 24h4" stroke="#009ACE" strokeWidth="2" strokeLinecap="round"/>
      <path d="M17 17l3 3M28 28l3 3M31 17l-3 3M20 28l-3 3" stroke="#009ACE" strokeWidth="2" strokeLinecap="round"/>
      <circle cx="24" cy="24" r="4" stroke="#009ACE" strokeWidth="2"/>
    </svg>
  );
}

function LicensesIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
      <rect x="10" y="8" width="28" height="32" rx="3" stroke="#009ACE" strokeWidth="2.5"/>
      <path d="M16 16h16M16 22h16M16 28h10" stroke="#009ACE" strokeWidth="2" strokeLinecap="round"/>
      <path d="M30 30l2 2 4-4" stroke="#009ACE" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function SystemInfoIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
      <circle cx="24" cy="24" r="14" fill="#009ACE"/>
      <path d="M24 18v0" stroke="white" strokeWidth="3" strokeLinecap="round"/>
      <path d="M24 24v10" stroke="white" strokeWidth="3" strokeLinecap="round"/>
    </svg>
  );
}

function SyncConfigIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
      <path d="M14 24a10 10 0 0118-6" stroke="#009ACE" strokeWidth="2.5" strokeLinecap="round"/>
      <path d="M34 24a10 10 0 01-18 6" stroke="#009ACE" strokeWidth="2.5" strokeLinecap="round"/>
      <path d="M30 14l2 4 4-2" stroke="#009ACE" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M18 34l-2-4-4 2" stroke="#009ACE" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function PracticeSettingsIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
      <path d="M12 38V18l12-8 12 8v20H12z" stroke="#009ACE" strokeWidth="2.5" strokeLinejoin="round"/>
      <rect x="20" y="26" width="8" height="12" stroke="#009ACE" strokeWidth="2"/>
      <path d="M18 22h12" stroke="#009ACE" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}

function ScreenAppearanceIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
      <rect x="8" y="10" width="32" height="22" rx="3" stroke="#009ACE" strokeWidth="2.5"/>
      <path d="M18 36h12" stroke="#009ACE" strokeWidth="2.5" strokeLinecap="round"/>
      <path d="M24 32v4" stroke="#009ACE" strokeWidth="2.5" strokeLinecap="round"/>
      <circle cx="16" cy="21" r="4" fill="#D6E7F1" stroke="#009ACE" strokeWidth="1.5"/>
      <circle cx="24" cy="21" r="4" fill="#5F5F5F" stroke="#009ACE" strokeWidth="1.5"/>
      <circle cx="32" cy="21" r="4" fill="#2C2C2C" stroke="#009ACE" strokeWidth="1.5"/>
    </svg>
  );
}

interface SettingsTileProps {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
}

function SettingsTile({ icon, label, onClick }: SettingsTileProps) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-[6px] py-[12px] px-[8px] rounded-[4px] hover:bg-[#eaeaea] active:bg-[#ddd] transition-colors cursor-pointer"
      style={{ width: 120 }}
    >
      <div className="w-[48px] h-[48px] flex items-center justify-center">
        {icon}
      </div>
      <span
        className="font-['Roboto',sans-serif] font-normal text-[13px] text-[#3e3d40] text-center leading-[16px]"
        style={{ fontVariationSettings: "'wdth' 100" }}
      >
        {label}
      </span>
    </button>
  );
}

function MainPage({ onNavigate, canvasBg, onCanvasBgChange }: { onNavigate: (page: SettingsPage) => void; canvasBg: string; onCanvasBgChange?: (color: string) => void }) {
  return (
    <div className="flex flex-col gap-[20px]">
      {/* Device Settings */}
      <section>
        <h4
          className="font-['Roboto',sans-serif] font-medium text-[16px] text-[#3e3d40] mb-[8px] pl-[4px]"
          style={{ fontVariationSettings: "'wdth' 100" }}
        >
          Device Settings
        </h4>
        <div className="border-t border-[#d1d1d1] pt-[12px]">
          <div className="flex flex-wrap gap-[4px]">
            <SettingsTile icon={<BrightnessIcon />} label="Display Settings" onClick={() => onNavigate('brightness')} />
            <SettingsTile icon={<VolumeIcon />} label="Volume" />
            <SettingsTile icon={<WifiIcon />} label="Wi-Fi" />
            <SettingsTile icon={<TimeZoneIcon />} label="Time Zone" />
          </div>
        </div>
      </section>

      {/* User Settings */}
      <section>
        <h4
          className="font-['Roboto',sans-serif] font-medium text-[16px] text-[#3e3d40] mb-[8px] pl-[4px]"
          style={{ fontVariationSettings: "'wdth' 100" }}
        >
          User Settings
        </h4>
        <div className="border-t border-[#d1d1d1] pt-[12px]">
          <div className="flex flex-nowrap gap-[4px]">
            <SettingsTile icon={<ScanSettingsIcon />} label="Scan Settings" />
            <SettingsTile icon={<RxSettingsIcon />} label="Rx Settings" />
            <SettingsTile icon={<SignatureSettingsIcon />} label="Signature Settings" />
            <SettingsTile icon={<LocalizationIcon />} label="Localization" />
            <SettingsTile icon={<AccountPairingIcon />} label="Account Pairing" />
            <SettingsTile icon={<PinIcon />} label="PIN" />
            <SettingsTile icon={<ScreenAppearanceIcon />} label="View Appearance" onClick={() => onNavigate('screen-appearance')} />
          </div>
        </div>
      </section>

      {/* System Settings */}
      <section>
        <h4
          className="font-['Roboto',sans-serif] font-medium text-[16px] text-[#3e3d40] mb-[8px] pl-[4px]"
          style={{ fontVariationSettings: "'wdth' 100" }}
        >
          System Settings
        </h4>
        <div className="border-t border-[#d1d1d1] pt-[12px]">
          <div className="flex flex-wrap gap-[4px]">
            <SettingsTile icon={<LoginSettingsIcon />} label="Login Settings" />
            <SettingsTile icon={<DiagnosticsIcon />} label="Diagnostics" />
            <SettingsTile icon={<LicensesIcon />} label="Licenses" />
            <SettingsTile icon={<SystemInfoIcon />} label="System Information" />
            <SettingsTile icon={<SyncConfigIcon />} label="Sync Configuration" />
            <SettingsTile icon={<PracticeSettingsIcon />} label="Practice Settings" />
          </div>
        </div>
      </section>

    </div>
  );
}

function VariantCards({ canvasBg, onCanvasBgChange }: { canvasBg: string; onCanvasBgChange?: (color: string) => void }) {
  return (
    <div className="grid grid-cols-2 gap-[12px]">
      {BG_THEMES.map((theme) => {
        const isSelected = canvasBg === theme.color;
        const isDark = theme.color !== '#D6E7F1' && theme.color !== '#F7F7F7';
        return (
          <button
            key={theme.color}
            onClick={() => onCanvasBgChange?.(theme.color)}
            className="flex flex-col items-center gap-[8px] cursor-pointer group w-full"
          >
            <div
              className={`w-full h-[200px] rounded-[10px] border-[2.5px] transition-all relative overflow-hidden ${
                isSelected ? 'border-[#009ACE] shadow-[0_0_0_2px_rgba(0,154,206,0.2)]' : 'border-[#d1d1d1] group-hover:border-[#a0a0a0]'
              }`}
              style={{ backgroundColor: theme.color }}
            >
              {/* View page skeleton */}
              <div className="absolute inset-0 p-[6px] flex flex-col">
                {/* Header bar */}
                <div className="h-[8px] rounded-[2px] w-full" style={{ backgroundColor: isDark ? '#ffffff' : '#3e3d40', opacity: 0.15 }} />
                {/* Body */}
                <div className="flex-1 relative">
                  {/* Left layer panel skeleton */}
                  <div className="absolute top-[6px] left-[2px] w-[28px] flex flex-col gap-[3px]">
                    <div className="h-[5px] w-full rounded-[1px]" style={{ backgroundColor: isDark ? '#ffffff' : '#3e3d40', opacity: 0.18 }} />
                    <div className="h-[5px] w-[20px] rounded-[1px]" style={{ backgroundColor: isDark ? '#ffffff' : '#3e3d40', opacity: 0.12 }} />
                    <div className="h-[5px] w-[24px] rounded-[1px]" style={{ backgroundColor: isDark ? '#ffffff' : '#3e3d40', opacity: 0.10 }} />
                  </div>
                  {/* Right toolbar skeleton */}
                  <div className="absolute top-[6px] right-[2px] flex gap-[2px]">
                    <div className="w-[8px] h-[8px] rounded-[2px]" style={{ backgroundColor: isDark ? '#ffffff' : '#3e3d40', opacity: 0.18 }} />
                    <div className="w-[8px] h-[8px] rounded-[2px]" style={{ backgroundColor: isDark ? '#ffffff' : '#3e3d40', opacity: 0.18 }} />
                    <div className="w-[8px] h-[8px] rounded-[2px]" style={{ backgroundColor: isDark ? '#ffffff' : '#3e3d40', opacity: 0.18 }} />
                    <div className="w-[8px] h-[8px] rounded-[2px]" style={{ backgroundColor: isDark ? '#ffffff' : '#3e3d40', opacity: 0.18 }} />
                  </div>
                  {/* Center teeth model */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <img
                      src={teethModelImg}
                      alt="Dental model"
                      className="max-w-[45%] max-h-[45%] object-contain drop-shadow-md"
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="flex flex-col items-center gap-[2px]">
              <span
                className={`font-['Roboto',sans-serif] text-[13px] text-center leading-[16px] transition-colors ${
                  isSelected ? 'font-medium text-[#009ACE]' : 'font-normal text-[#3e3d40]'
                }`}
                style={{ fontVariationSettings: "'wdth' 100" }}
              >
                {theme.label}
              </span>
              {theme.isDefault && (
                <span
                  className="font-['Roboto',sans-serif] text-[11px] text-[#999] leading-[14px]"
                  style={{ fontVariationSettings: "'wdth' 100" }}
                >
                  Default
                </span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

function VariantDropdown({ canvasBg, onCanvasBgChange }: { canvasBg: string; onCanvasBgChange?: (color: string) => void }) {
  const [open, setOpen] = useState(false);
  const selectedTheme = BG_THEMES.find(t => t.color === canvasBg) || BG_THEMES[0];

  return (
    <div className="relative w-[360px]">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-[12px] px-[16px] bg-white border border-[#d1d1d1] rounded-[8px] hover:border-[#a0a0a0] transition-colors cursor-pointer"
        style={{ minHeight: 60 }}
      >
        <div
          className="w-[36px] h-[36px] rounded-[6px] border border-[#d1d1d1] shrink-0"
          style={{ backgroundColor: selectedTheme.color }}
        />
        <span
          className="font-['Roboto',sans-serif] font-normal text-[14px] text-[#3e3d40] flex-1 text-left"
          style={{ fontVariationSettings: "'wdth' 100" }}
        >
          {selectedTheme.label}
          {selectedTheme.isDefault ? ' (Default)' : ''}
        </span>
        <svg
          width="16" height="16" viewBox="0 0 16 16" fill="none"
          className={`transition-transform ${open ? 'rotate-180' : ''}`}
        >
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
                className={`w-full flex items-center gap-[12px] px-[16px] transition-colors cursor-pointer ${
                  isSelected ? 'bg-[#f0f9ff]' : 'hover:bg-[#f5f5f5]'
                }`}
                style={{ minHeight: 60 }}
              >
                <div
                  className="w-[36px] h-[36px] rounded-[6px] border border-[#d1d1d1] shrink-0"
                  style={{ backgroundColor: theme.color }}
                />
                <span
                  className={`font-['Roboto',sans-serif] text-[14px] flex-1 text-left ${
                    isSelected ? 'font-medium text-[#009ACE]' : 'font-normal text-[#3e3d40]'
                  }`}
                  style={{ fontVariationSettings: "'wdth' 100" }}
                >
                  {theme.label}
                  {theme.isDefault ? ' (Default)' : ''}
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

function VariantCircles({ canvasBg, onCanvasBgChange }: { canvasBg: string; onCanvasBgChange?: (color: string) => void }) {
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
                  ? 'border-[#009ACE] scale-110 shadow-[0_0_0_3px_rgba(0,154,206,0.2)]'
                  : 'border-[#d1d1d1] group-hover:border-[#999] group-hover:scale-105'
              }`}
              style={{ backgroundColor: theme.color }}
            />
            <span
              className={`font-['Roboto',sans-serif] text-[12px] text-center leading-[14px] transition-colors ${
                isSelected ? 'font-medium text-[#009ACE]' : 'font-normal text-[#717073]'
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


function ScreenAppearancePage({ canvasBg, onCanvasBgChange }: { canvasBg: string; onCanvasBgChange?: (color: string) => void }) {
  const [variant, setVariant] = useState<1 | 2 | 3 | 4>(1);

  const variantLabels = [
    { id: 1 as const, label: 'Cards' },
    { id: 2 as const, label: 'Dropdown' },
    { id: 3 as const, label: 'Circles' },
    { id: 4 as const, label: 'Swatches' },
  ];

  return (
    <div className="flex flex-col gap-[28px]">
      {/* Variant switcher */}
      <div className="flex items-center gap-[8px]">
        <span className="font-['Roboto',sans-serif] text-[12px] text-[#999] mr-[4px]" style={{ fontVariationSettings: "'wdth' 100" }}>
          UI Variant:
        </span>
        {variantLabels.map((v) => (
          <button
            key={v.id}
            onClick={() => setVariant(v.id)}
            className={`px-[10px] py-[4px] rounded-[4px] font-['Roboto',sans-serif] text-[12px] transition-colors cursor-pointer ${
              variant === v.id
                ? 'bg-[#009ACE] text-white font-medium'
                : 'bg-[#e8e8e8] text-[#555] hover:bg-[#ddd]'
            }`}
            style={{ fontVariationSettings: "'wdth' 100" }}
          >
            {v.label}
          </button>
        ))}
      </div>

      {/* Description */}
      <div className="flex flex-col gap-[6px]">
        <p
          className="font-['Roboto',sans-serif] font-medium text-[15px] text-[#3e3d40] leading-[20px]"
          style={{ fontVariationSettings: "'wdth' 100" }}
        >
          Canvas Background
        </p>
        <p
          className="font-['Roboto',sans-serif] font-normal text-[13px] text-[#717073] leading-[18px]"
          style={{ fontVariationSettings: "'wdth' 100" }}
        >
          Select a background color for the View page canvas. This changes the area behind the 3D scan model.
        </p>
      </div>

      {/* Active variant */}
      {variant === 1 && <VariantCards canvasBg={canvasBg} onCanvasBgChange={onCanvasBgChange} />}
      {variant === 2 && <VariantDropdown canvasBg={canvasBg} onCanvasBgChange={onCanvasBgChange} />}
      {variant === 3 && <VariantCircles canvasBg={canvasBg} onCanvasBgChange={onCanvasBgChange} />}
      {variant === 4 && <VariantSwatches canvasBg={canvasBg} onCanvasBgChange={onCanvasBgChange} />}
    </div>
  );
}

function VariantSwatches({ canvasBg, onCanvasBgChange }: { canvasBg: string; onCanvasBgChange?: (color: string) => void }) {
  return (
    <div className="flex flex-wrap gap-[10px]">
      {BG_THEMES.map((theme) => {
        const isSelected = canvasBg === theme.color;
        return (
          <button
            key={theme.color}
            onClick={() => onCanvasBgChange?.(theme.color)}
            className={`relative w-[48px] h-[48px] rounded-[8px] border-[2.5px] transition-all cursor-pointer ${
              isSelected
                ? 'border-[#009ACE] shadow-[0_0_0_2px_rgba(0,154,206,0.25)] scale-110'
                : 'border-[#d1d1d1] hover:border-[#999] hover:scale-105'
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

function DisplaySettingsPage({ canvasBg, onCanvasBgChange }: { canvasBg: string; onCanvasBgChange?: (color: string) => void }) {
  const [brightness, setBrightness] = useState(75);
  const [variant, setVariant] = useState<1 | 2 | 3 | 4>(1);

  const variantLabels = [
    { id: 1 as const, label: 'Cards' },
    { id: 2 as const, label: 'Dropdown' },
    { id: 3 as const, label: 'Circles' },
    { id: 4 as const, label: 'Swatches' },
  ];

  return (
    <div className="flex flex-col gap-[32px]">
      {/* Brightness section */}
      <div className="flex flex-col gap-[12px]">
        <p
          className="font-['Roboto',sans-serif] font-medium text-[15px] text-[#3e3d40] leading-[20px]"
          style={{ fontVariationSettings: "'wdth' 100" }}
        >
          Brightness
        </p>
        <div className="w-full max-w-[400px] flex flex-col gap-[8px]">
          <input
            type="range"
            min="0"
            max="100"
            value={brightness}
            onChange={(e) => setBrightness(Number(e.target.value))}
            className="w-full h-[4px] appearance-none bg-[#d1d1d1] rounded-full outline-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-[20px] [&::-webkit-slider-thumb]:h-[20px] [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-[#d1d1d1] [&::-webkit-slider-thumb]:rounded-[4px] [&::-webkit-slider-thumb]:cursor-pointer"
          />
          <div className="flex justify-between">
            <span className="font-['Roboto',sans-serif] text-[13px] text-[#717073]">0</span>
            <span className="font-['Roboto',sans-serif] text-[13px] text-[#717073]">100</span>
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-[#d1d1d1]" />

      {/* Appearance section */}
      <div className="flex flex-col gap-[20px]">
        <div className="flex flex-col gap-[6px]">
          <p
            className="font-['Roboto',sans-serif] font-medium text-[15px] text-[#3e3d40] leading-[20px]"
            style={{ fontVariationSettings: "'wdth' 100" }}
          >
            Canvas Background
          </p>
          <p
            className="font-['Roboto',sans-serif] font-normal text-[13px] text-[#717073] leading-[18px]"
            style={{ fontVariationSettings: "'wdth' 100" }}
          >
            Select a background color for the View page canvas. This changes the area behind the 3D scan model.
          </p>
        </div>

        {/* Variant switcher */}
        <div className="flex items-center gap-[8px]">
          <span className="font-['Roboto',sans-serif] text-[12px] text-[#999] mr-[4px]" style={{ fontVariationSettings: "'wdth' 100" }}>
            UI Variant:
          </span>
          {variantLabels.map((v) => (
            <button
              key={v.id}
              onClick={() => setVariant(v.id)}
              className={`px-[10px] py-[4px] rounded-[4px] font-['Roboto',sans-serif] text-[12px] transition-colors cursor-pointer ${
                variant === v.id
                  ? 'bg-[#009ACE] text-white font-medium'
                  : 'bg-[#e8e8e8] text-[#555] hover:bg-[#ddd]'
              }`}
              style={{ fontVariationSettings: "'wdth' 100" }}
            >
              {v.label}
            </button>
          ))}
        </div>

        {/* Active variant */}
        {variant === 1 && <VariantCards canvasBg={canvasBg} onCanvasBgChange={onCanvasBgChange} />}
        {variant === 2 && <VariantDropdown canvasBg={canvasBg} onCanvasBgChange={onCanvasBgChange} />}
        {variant === 3 && <VariantCircles canvasBg={canvasBg} onCanvasBgChange={onCanvasBgChange} />}
        {variant === 4 && <VariantSwatches canvasBg={canvasBg} onCanvasBgChange={onCanvasBgChange} />}
      </div>
    </div>
  );
}

export default function SettingsModal({ onClose, canvasBg = '#D6E7F1', onCanvasBgChange, overlay = false }: SettingsModalProps) {
  const [currentPage, setCurrentPage] = useState<SettingsPage>('main');

  const pageTitle = currentPage === 'main' ? 'Settings'
    : currentPage === 'screen-appearance' ? 'View Appearance'
    : 'Display Settings';

  return createPortal(
    <div
      className={`fixed inset-0 flex items-center justify-center ${overlay ? 'bg-black/50' : 'bg-[#6b6b6b]'}`}
      style={{ zIndex: 99999, pointerEvents: "auto" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="bg-[#f0f0f0] w-[1060px] h-[700px] flex flex-col"
        style={{ border: '2px solid #1a1a1a', boxShadow: '0px 8px 32px 0px rgba(0,0,0,0.4)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center px-[24px] h-[64px] relative shrink-0">
          {currentPage === 'main' ? (
            <button
              onClick={onClose}
              className="w-[48px] h-[48px] flex items-center justify-center text-[#3FC1F3] hover:text-[#009ACE] transition-colors"
            >
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>
          ) : (
            <button
              onClick={() => setCurrentPage('main')}
              className="w-[48px] h-[48px] flex items-center justify-center text-[#3FC1F3] hover:text-[#009ACE] transition-colors"
            >
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6"/>
              </svg>
            </button>
          )}
          <h3
            className="absolute left-1/2 -translate-x-1/2 font-['Roboto',sans-serif] font-medium text-[22px] text-[#3e3d40] leading-[28px]"
            style={{ fontVariationSettings: "'wdth' 100" }}
          >
            {pageTitle}
          </h3>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-[32px] pb-[32px]">
          {currentPage === 'main' && (
            <MainPage onNavigate={setCurrentPage} canvasBg={canvasBg} onCanvasBgChange={onCanvasBgChange} />
          )}
          {currentPage === 'screen-appearance' && (
            <ScreenAppearancePage canvasBg={canvasBg} onCanvasBgChange={onCanvasBgChange} />
          )}
          {currentPage === 'brightness' && (
            <DisplaySettingsPage canvasBg={canvasBg} onCanvasBgChange={onCanvasBgChange} />
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
