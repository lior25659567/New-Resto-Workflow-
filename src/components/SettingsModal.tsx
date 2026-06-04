import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import teethModelImg from "../assets/Clincheck weave model.png";

// Figma design asset URLs (valid for 7 days from design fetch)
const ICON_BRIGHTNESS  = "https://www.figma.com/api/mcp/asset/47379381-4592-483c-b389-6fdba18ab2e5";
const ICON_VOLUME_A    = "https://www.figma.com/api/mcp/asset/c9cdf331-a79d-417f-89d7-7f81b06eb694";
const ICON_VOLUME_B    = "https://www.figma.com/api/mcp/asset/b9fc50dd-3aaa-4aff-aade-9066f9db7c00";
const ICON_VOLUME_C    = "https://www.figma.com/api/mcp/asset/b6a15cfd-597e-47cd-b86b-7b52e88757c7";
const ICON_WIFI_A      = "https://www.figma.com/api/mcp/asset/4cc6b08f-4f46-45c5-881b-ed0fbf96d9bb";
const ICON_WIFI_B      = "https://www.figma.com/api/mcp/asset/93a24203-79ed-4a48-912d-dd5363426fd0";
const ICON_WIFI_C      = "https://www.figma.com/api/mcp/asset/913f94d2-88d2-4b80-925f-2d8a040b13dd";
const ICON_WIFI_D      = "https://www.figma.com/api/mcp/asset/02d57ac8-127a-47d4-8ff8-6fcb1a8abdc7";
const ICON_TIMEZONE    = "https://www.figma.com/api/mcp/asset/cac7be1e-9f8a-42a1-8b0f-8c708b34d1a6";
const ICON_SCAN        = "https://www.figma.com/api/mcp/asset/e7a27935-8d5a-4019-89e6-9db4dedb3154";
const ICON_RX          = "https://www.figma.com/api/mcp/asset/3b1d3412-f285-4ecf-8f45-3ab336e39f09";
const ICON_SIG         = "https://www.figma.com/api/mcp/asset/ffde915e-c422-4b16-be15-80fdd43631fe";
const ICON_LANG_V1     = "https://www.figma.com/api/mcp/asset/ccf8e055-e91d-4669-be44-c377f2fddae0";
const ICON_LANG_V2     = "https://www.figma.com/api/mcp/asset/7eee7834-2a22-46e9-9268-4c7f1ce69eeb";
const ICON_LANG_V3     = "https://www.figma.com/api/mcp/asset/baf7c986-67a2-408a-83b4-96f6b636f40e";
const ICON_LANG_V4     = "https://www.figma.com/api/mcp/asset/046686fb-59d4-44f6-aa16-64c6cc6c3696";
const ICON_LOGIN_BG    = "https://www.figma.com/api/mcp/asset/a2379368-7501-4c6c-85f7-51961a631f35";
const ICON_LOGIN_SVG   = "https://www.figma.com/api/mcp/asset/f10c1856-15db-4e0d-a076-d25661fcfaf9";
const ICON_DIAG_BG     = "https://www.figma.com/api/mcp/asset/e46ef657-91c5-4123-aaf7-3217f842e134";
const ICON_DIAG_SVG    = "https://www.figma.com/api/mcp/asset/ccaf689e-d39c-4d36-a07e-29478431156c";
const ICON_LICENSES    = "https://www.figma.com/api/mcp/asset/92cc3f1c-882a-4092-b1ec-ef5294c034d1";
const ICON_SYSINFO     = "https://www.figma.com/api/mcp/asset/8a5b26a3-4f26-4665-8884-391cbd64362d";
const ICON_SYNC        = "https://www.figma.com/api/mcp/asset/7b4d548b-e9ca-4e2f-99cb-0b2701dc8c30";
const ICON_EXPORT_BG   = "https://www.figma.com/api/mcp/asset/07e73a76-ed66-44eb-8dc9-3aeb9b5209be";
const ICON_EXPORT_SVG  = "https://www.figma.com/api/mcp/asset/13b7bce3-054f-40cd-b8b1-b6546073d524";

interface SettingsModalProps {
  onClose: () => void;
  canvasBg?: string;
  onCanvasBgChange?: (color: string) => void;
}

type SettingsPage = 'main' | 'screen-appearance' | 'brightness';

const BG_THEMES = [
  { color: "#E0EDF4", label: "Default", isDefault: true },
  { color: "#FAFAFA", label: "Light", isDefault: false },
  { color: "#F4F4F5", label: "Light Medium", isDefault: false },
  { color: "#D4D4D8", label: "Medium", isDefault: false },
  { color: "#71717A", label: "Dark Medium", isDefault: false },
  { color: "#3F3F46", label: "Dark", isDefault: false },
];

/* ── Figma-sourced icon components ── */

function FigmaBrightnessIcon() {
  return (
    <div className="relative w-[40px] h-[40px]">
      <img alt="" className="absolute inset-0 w-full h-full object-contain" src={ICON_BRIGHTNESS} />
    </div>
  );
}

function FigmaVolumeIcon() {
  return (
    <div className="relative w-[40px] h-[40px]">
      <div className="absolute" style={{ left: '50%', top: '50%', transform: 'translate(-50%, -50%)', width: 22.2, height: 34.535 }}>
        <img alt="" className="block w-full h-full" src={ICON_VOLUME_A} />
      </div>
      <div className="absolute" style={{ left: '50%', top: '50%', transform: 'translate(-50%, -50%)', marginLeft: 10.2, width: 5.723, height: 18.156 }}>
        <img alt="" className="block w-full h-full" src={ICON_VOLUME_B} />
      </div>
      <div className="absolute" style={{ left: '50%', top: '50%', transform: 'translate(-50%, -50%)', marginLeft: 14.41, width: 7.177, height: 25.11 }}>
        <img alt="" className="block w-full h-full" src={ICON_VOLUME_C} />
      </div>
    </div>
  );
}

function FigmaWifiIcon() {
  return (
    <div className="relative w-[40px] h-[40px] overflow-hidden">
      <div className="absolute" style={{ inset: '78.22% 43.75% 8.89% 43.36%' }}>
        <img alt="" className="absolute inset-0 w-full h-full" src={ICON_WIFI_A} />
      </div>
      <div className="absolute" style={{ inset: '8.89% 0 63.18% 0' }}>
        <img alt="" className="absolute inset-0 w-full h-full" src={ICON_WIFI_B} />
      </div>
      <div className="absolute" style={{ inset: '31.55% 14.26% 46.97% 14.26%' }}>
        <img alt="" className="absolute inset-0 w-full h-full" src={ICON_WIFI_C} />
      </div>
      <div className="absolute" style={{ inset: '54.39% 29.87% 30.76% 29.51%' }}>
        <img alt="" className="absolute inset-0 w-full h-full" src={ICON_WIFI_D} />
      </div>
    </div>
  );
}

function FigmaTimezoneIcon() {
  return (
    <div className="relative w-[44px] h-[44px]">
      <img alt="" className="absolute inset-0 w-full h-full object-contain" src={ICON_TIMEZONE} />
    </div>
  );
}

function FigmaScanIcon() {
  return (
    <svg width="43" height="41" viewBox="0 0 43 41" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M31.1272 39.9993L14.2599 23.132C14.0279 22.8853 13.8988 22.5594 13.8988 22.2208C13.8988 21.8821 14.0279 21.5563 14.2599 21.3096L23.0128 12.5567C23.2602 12.3208 23.5889 12.1893 23.9307 12.1893C24.2725 12.1893 24.6012 12.3208 24.8485 12.5567L41.7025 29.4107" stroke="#2BABE2" strokeWidth="2.5" strokeMiterlimit="10"/>
      <path d="M22.8664 12.7037L14.4061 21.1639L1.70245 6.34519L8.04764 0L22.8664 12.7037Z" stroke="#2BABE2" strokeWidth="2.5" strokeMiterlimit="10"/>
      <path d="M5.93274 8.4728L10.1762 4.22937" stroke="#2BABE2" strokeWidth="2.5" strokeMiterlimit="10"/>
      <path d="M22.4786 17.3306L19.036 20.7733C18.8178 20.9914 18.8178 21.3452 19.036 21.5634L25.6579 28.1853C25.8761 28.4035 26.2298 28.4035 26.448 28.1853L29.8906 24.7427C30.1088 24.5245 30.1088 24.1707 29.8907 23.9525L23.2687 17.3306C23.0506 17.1124 22.6968 17.1125 22.4786 17.3306Z" stroke="#2BABE2" strokeWidth="2.5" strokeMiterlimit="10"/>
    </svg>
  );
}

function FigmaRxIcon() {
  return (
    <div className="relative w-[40px] h-[40px] overflow-hidden">
      <div className="absolute" style={{ inset: '5.81% 6.05% 5.81% 4.65%' }}>
        <img alt="" className="absolute inset-0 w-full h-full" src={ICON_RX} />
      </div>
    </div>
  );
}

function FigmaSignatureIcon() {
  return (
    <div className="relative w-[45px] h-[45px]">
      <div className="absolute" style={{ inset: '-0.56%' }}>
        <img alt="" className="block w-full h-full" src={ICON_SIG} />
      </div>
    </div>
  );
}

function FigmaLanguageIcon() {
  return (
    <div className="relative w-[40px] h-[40px] overflow-hidden">
      <div className="absolute" style={{ left: '50%', top: '50%', transform: 'translate(-50%, -50%)', width: 36.19, height: 36.19 }}>
        <img alt="" className="block w-full h-full" src={ICON_LANG_V1} />
      </div>
      <div className="absolute" style={{ left: 'calc(50% + 10.95px)', top: 'calc(50% + 1.52px)', transform: 'translate(-50%, -50%)', width: 18.095, height: 19.619 }}>
        <img alt="" className="block w-full h-full" src={ICON_LANG_V2} />
      </div>
      <div className="absolute" style={{ left: 'calc(50% + 10.95px)', top: 'calc(50% - 4.28px)', transform: 'translate(-50%, -50%)', width: 90.476, height: 48.571 }}>
        <img alt="" className="block w-full h-full" src={ICON_LANG_V3} />
      </div>
      <div className="absolute" style={{ left: '50%', top: '50%', transform: 'translate(-50%, -50%)', width: 40.952, height: 33.333 }}>
        <div className="absolute" style={{ inset: '-4.29% -3.49%' }}>
          <img alt="" className="block w-full h-full" src={ICON_LANG_V4} />
        </div>
      </div>
    </div>
  );
}

function FigmaLoginIcon() {
  return (
    <div className="relative w-[40px] h-[40px] overflow-hidden">
      <div className="absolute" style={{ inset: '6.49% 89.19% 91.62% 8.11%' }}>
        <img alt="" className="absolute inset-0 w-full h-full" src={ICON_LOGIN_BG} />
      </div>
      <div className="absolute" style={{ left: 'calc(50% + 0.5px)', top: 'calc(50% + 0.07px)', transform: 'translate(-50%, -50%)', width: 24.216, height: 34.811 }}>
        <img alt="" className="block w-full h-full" src={ICON_LOGIN_SVG} />
      </div>
    </div>
  );
}

function FigmaDiagnosticsIcon() {
  return (
    <div className="relative w-[40px] h-[40px] overflow-hidden">
      <div className="absolute" style={{ left: 'calc(50% - 17.35px)', top: 'calc(50% - 17.03px)', transform: 'translate(-50%, -50%)', width: 0.757, height: 0.757 }}>
        <img alt="" className="block w-full h-full" src={ICON_DIAG_BG} />
      </div>
      <div className="absolute" style={{ left: '50%', top: '50%', transform: 'translate(-50%, -50%)', width: 40, height: 40 }}>
        <img alt="" className="block w-full h-full" src={ICON_DIAG_SVG} />
      </div>
    </div>
  );
}

function FigmaLicensesIcon() {
  return (
    <div className="relative w-[40px] h-[40px] overflow-hidden">
      <div className="absolute" style={{ inset: '6.77% 0 6.75% 0' }}>
        <img alt="" className="absolute inset-0 w-full h-full" src={ICON_LICENSES} />
      </div>
    </div>
  );
}

function FigmaSysInfoIcon() {
  return (
    <div className="relative w-[40px] h-[40px] overflow-hidden">
      <div className="absolute" style={{ inset: '4.26% 6.38% 6.38% 4.26%' }}>
        <img alt="" className="absolute inset-0 w-full h-full" src={ICON_SYSINFO} />
      </div>
    </div>
  );
}

function FigmaSyncIcon() {
  return (
    <div className="relative w-[40px] h-[40px] overflow-hidden">
      <div className="absolute" style={{ left: 'calc(50% - 0.03px)', top: 'calc(50% - 0.43px)', transform: 'translate(-50%, -50%)', width: 38.063, height: 32.395 }}>
        <img alt="" className="block w-full h-full" src={ICON_SYNC} />
      </div>
    </div>
  );
}

function FigmaExportIcon() {
  return (
    <div className="relative w-[40px] h-[40px]">
      <div className="absolute" style={{ inset: '4.94% 94.94% 93.83% 4.07%' }}>
        <img alt="" className="absolute inset-0 w-full h-full" src={ICON_EXPORT_BG} />
      </div>
      <div className="absolute" style={{ left: 'calc(50% - 0.1px)', top: 'calc(50% + 0.05px)', transform: 'translate(-50%, -50%)', width: 45.728, height: 36.147 }}>
        <img alt="" className="block w-full h-full" src={ICON_EXPORT_SVG} />
      </div>
    </div>
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

function AccountPairingIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 48 48" fill="none">
      <circle cx="19" cy="20" r="6" stroke="#009ACE" strokeWidth="2.5"/>
      <circle cx="31" cy="20" r="6" stroke="#009ACE" strokeWidth="2.5"/>
      <path d="M10 38c0-5 4-9 9-9h4" stroke="#009ACE" strokeWidth="2.5" strokeLinecap="round"/>
      <path d="M26 38c0-5 4-9 9-9" stroke="#009ACE" strokeWidth="2.5" strokeLinecap="round"/>
    </svg>
  );
}

function PinIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 48 48" fill="none">
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

interface SettingsTileProps {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
}

function SettingsTile({ icon, label, onClick }: SettingsTileProps) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center justify-start hover:bg-[rgba(144,235,255,0.12)] active:bg-[rgba(144,235,255,0.22)] transition-colors cursor-pointer shrink-0"
      style={{ width: 105, minHeight: 75, background: 'rgba(144,235,255,0)', padding: 0 }}
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
            lineHeight: '20px',
            color: '#3e3d40',
            textAlign: 'center',
            whiteSpace: 'normal',
            wordBreak: 'break-word',
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
        lineHeight: '19px',
        color: '#3e3d40',
        marginBottom: 30,
        whiteSpace: 'nowrap',
      }}
    >
      {title}
    </p>
  );
}

function MainPage({ onNavigate, canvasBg, onCanvasBgChange }: { onNavigate: (page: SettingsPage) => void; canvasBg: string; onCanvasBgChange?: (color: string) => void }) {
  return (
    <div className="flex flex-col">
      {/* Computer Settings */}
      <div className="flex flex-col pr-[10px] py-[10px]">
        <SectionHead title="Computer Settings" />
        <div className="flex gap-[30px] items-start pb-[38px]">
          <SettingsTile icon={<FigmaBrightnessIcon />} label="Brightness" onClick={() => onNavigate('brightness')} />
          <SettingsTile icon={<FigmaVolumeIcon />} label="Volume" />
          <SettingsTile icon={<FigmaWifiIcon />} label="Wi-Fi" />
          <SettingsTile icon={<FigmaTimezoneIcon />} label="Time Zone" />
        </div>
      </div>

      <SectionDivider />

      {/* User Settings */}
      <div className="flex flex-col pr-[10px] py-[10px]">
        <SectionHead title="User Settings" />
        <div className="flex gap-[30px] items-start pb-[38px]">
          <SettingsTile icon={<FigmaScanIcon />} label="Scan Settings" />
          <SettingsTile icon={<FigmaRxIcon />} label="Rx Settings" />
          <SettingsTile icon={<FigmaSignatureIcon />} label="Signature Settings" />
          <SettingsTile icon={<FigmaLanguageIcon />} label="Language" />
          <SettingsTile icon={<ScreenAppearanceIcon />} label="View Appearance" onClick={() => onNavigate('screen-appearance')} />
        </div>
      </div>

      <SectionDivider />

      {/* System Settings */}
      <div className="flex flex-col pr-[10px] py-[10px]">
        <SectionHead title="System Settings" />
        <div className="flex gap-[30px] items-start pb-[38px]">
          <SettingsTile icon={<FigmaLoginIcon />} label="Login" />
          <SettingsTile icon={<FigmaDiagnosticsIcon />} label="Diagnostics" />
          <SettingsTile icon={<FigmaLicensesIcon />} label="Licenses" />
          <SettingsTile icon={<FigmaSysInfoIcon />} label="System Information" />
          <SettingsTile icon={<FigmaSyncIcon />} label="Sync Configuration" />
          <SettingsTile icon={<FigmaExportIcon />} label="Export Settings" />
        </div>
      </div>
    </div>
  );
}

function VariantCards({ canvasBg, onCanvasBgChange }: { canvasBg: string; onCanvasBgChange?: (color: string) => void }) {
  return (
    <div className="grid grid-cols-3 gap-[20px] w-full">
      {BG_THEMES.map((theme) => {
        const isSelected = canvasBg === theme.color;
        const isDark = theme.color === '#71717A' || theme.color === '#3F3F46';
        return (
          <div key={theme.color} className="flex flex-col items-center gap-[8px] w-full">
            {/* Theme preview card - top */}
            <div
              className="w-full aspect-video rounded-[10px] border-[1px] border-[#e5e5e5] hover:border-[#d1d1d1] transition-all relative overflow-hidden cursor-pointer"
              style={{ backgroundColor: theme.color }}
              onClick={() => onCanvasBgChange?.(theme.color)}
            >
              <div className="absolute inset-0 p-[6px] flex flex-col">
                <div className="h-[8px] rounded-[2px] w-full" style={{ backgroundColor: isDark ? '#ffffff' : '#3e3d40', opacity: 0.15 }} />
                <div className="flex-1 relative">
                  <div className="absolute top-[6px] left-[2px] w-[28px] flex flex-col gap-[3px]">
                    <div className="h-[5px] w-full rounded-[1px]" style={{ backgroundColor: isDark ? '#ffffff' : '#3e3d40', opacity: 0.18 }} />
                    <div className="h-[5px] w-[20px] rounded-[1px]" style={{ backgroundColor: isDark ? '#ffffff' : '#3e3d40', opacity: 0.12 }} />
                    <div className="h-[5px] w-[24px] rounded-[1px]" style={{ backgroundColor: isDark ? '#ffffff' : '#3e3d40', opacity: 0.10 }} />
                  </div>
                  <div className="absolute top-[6px] right-[2px] flex gap-[2px]">
                    {[0,1,2,3].map(i => (
                      <div key={i} className="w-[8px] h-[8px] rounded-[2px]" style={{ backgroundColor: isDark ? '#ffffff' : '#3e3d40', opacity: 0.18 }} />
                    ))}
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <img src={teethModelImg} alt="Dental model" className="max-w-[38%] max-h-[38%] object-contain drop-shadow-md" />
                  </div>
                </div>
              </div>
            </div>
            
            {/* Radio button + label section - bottom */}
            <div className="flex items-center gap-[8px] w-full">
              <button
                onClick={() => onCanvasBgChange?.(theme.color)}
                className={`w-[20px] h-[20px] rounded-full border-[2px] transition-all duration-200 relative flex items-center justify-center flex-shrink-0 ${
                  isSelected 
                    ? 'border-[#009ACE] bg-white' 
                    : 'border-[#d1d5db] bg-white hover:border-[#9ca3af] focus:border-[#009ACE] focus:ring-2 focus:ring-[#009ACE]/20'
                }`}
                aria-label={`Select ${theme.label} theme`}
                role="radio"
                aria-checked={isSelected}
              >
                {/* Radio button dot with smooth animation */}
                <div 
                  className={`w-[10px] h-[10px] rounded-full transition-all duration-200 ease-out ${
                    isSelected 
                      ? 'bg-[#009ACE] scale-100 opacity-100' 
                      : 'bg-transparent scale-75 opacity-0'
                  }`} 
                />
              </button>
              
              {/* Theme label */}
              <button
                onClick={() => onCanvasBgChange?.(theme.color)}
                className={`font-['Roboto',sans-serif] text-[13px] leading-[18px] transition-colors duration-200 text-left flex-1 min-w-0 ${
                  isSelected ? 'font-medium text-[#1f2937]' : 'font-normal text-[#4b5563] hover:text-[#1f2937]'
                }`}
                style={{ fontVariationSettings: "'wdth' 100" }}
              >
                <span className="block truncate">
                  {theme.label}
                </span>
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function VariantCards3Col({ canvasBg, onCanvasBgChange }: { canvasBg: string; onCanvasBgChange?: (color: string) => void }) {
  return (
    <div className="grid grid-cols-3 gap-[12px]">
      {BG_THEMES.map((theme) => {
        const isSelected = canvasBg === theme.color;
        const isDark = theme.color === '#71717A' || theme.color === '#3F3F46';
        return (
          <button
            key={theme.color}
            onClick={() => onCanvasBgChange?.(theme.color)}
            className="flex flex-col items-center gap-[8px] cursor-pointer group w-full"
          >
            <div
              className={`w-full aspect-video rounded-[10px] transition-all relative overflow-hidden ${
                isSelected ? 'border-[2px] border-[#009ACE] shadow-[0_0_0_1px_rgba(0,154,206,0.2)]' : 'border-[1px] border-[#e5e5e5] group-hover:border-[#d1d1d1]'
              }`}
              style={{ backgroundColor: theme.color }}
            >
              <div className="absolute inset-0 p-[6px] flex flex-col">
                <div className="h-[8px] rounded-[2px] w-full" style={{ backgroundColor: isDark ? '#ffffff' : '#3e3d40', opacity: 0.15 }} />
                <div className="flex-1 relative">
                  <div className="absolute top-[6px] left-[2px] w-[28px] flex flex-col gap-[3px]">
                    <div className="h-[5px] w-full rounded-[1px]" style={{ backgroundColor: isDark ? '#ffffff' : '#3e3d40', opacity: 0.18 }} />
                    <div className="h-[5px] w-[20px] rounded-[1px]" style={{ backgroundColor: isDark ? '#ffffff' : '#3e3d40', opacity: 0.12 }} />
                    <div className="h-[5px] w-[24px] rounded-[1px]" style={{ backgroundColor: isDark ? '#ffffff' : '#3e3d40', opacity: 0.10 }} />
                  </div>
                  <div className="absolute top-[6px] right-[2px] flex gap-[2px]">
                    {[0,1,2,3].map(i => (
                      <div key={i} className="w-[8px] h-[8px] rounded-[2px]" style={{ backgroundColor: isDark ? '#ffffff' : '#3e3d40', opacity: 0.18 }} />
                    ))}
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <img src={teethModelImg} alt="Dental model" className="max-w-[38%] max-h-[38%] object-contain drop-shadow-md" />
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
            </div>
          </button>
        );
      })}
    </div>
  );
}

function VariantLivePreview({ canvasBg, onCanvasBgChange }: { canvasBg: string; onCanvasBgChange?: (color: string) => void }) {
  const isDark = canvasBg === '#71717A' || canvasBg === '#3F3F46';
  const ui = (a: number) => isDark ? `rgba(255,255,255,${a})` : `rgba(62,61,64,${a})`;

  return (
    <div className="flex flex-col gap-[20px]">
      {/* Live preview frame — flex column so children use flex sizing, not % heights */}
      <div
        className="w-full rounded-[10px] overflow-hidden border-[2px] border-[#c0c0c0] shadow-[0_4px_24px_rgba(0,0,0,0.18)] flex flex-col"
        style={{ aspectRatio: '16/9' }}
      >
        {/* App header */}
        <div
          className="bg-[#1c1c1c] flex items-center justify-between shrink-0 px-[2%]"
          style={{ flex: '0 0 9%' }}
        >
          <div className="flex items-center gap-[6px]">
            <div className="rounded-[3px] bg-[#009ACE]" style={{ width: 18, height: 18 }} />
            <div className="rounded-[2px]" style={{ width: 48, height: 7, background: 'rgba(255,255,255,0.25)' }} />
          </div>
          <div className="flex gap-[6px] items-center">
            <div className="rounded-[2px]" style={{ width: 70, height: 6, background: 'rgba(255,255,255,0.35)' }} />
            <div className="rounded-[2px]" style={{ width: 44, height: 6, background: 'rgba(255,255,255,0.2)' }} />
          </div>
          <div className="flex gap-[6px]">
            {[22, 16, 16].map((w, i) => (
              <div key={i} className="rounded-[3px]" style={{ width: w, height: 16, background: 'rgba(255,255,255,0.18)' }} />
            ))}
          </div>
        </div>

        {/* Main canvas area */}
        <div className="flex flex-1 min-h-0" style={{ background: canvasBg }}>

          {/* Left: jaw selector panel */}
          <div className="flex flex-col items-center shrink-0 pt-[3%] gap-[5%]" style={{ width: '9%' }}>
            <div className="rounded-[4px] border" style={{
              width: '65%', aspectRatio: '1/1.9',
              background: ui(0.22), borderColor: ui(0.3),
            }} />
            <div className="rounded-[3px]" style={{ width: '65%', height: 14, background: ui(0.35) }} />
          </div>

          {/* Center canvas */}
          <div className="flex-1 flex flex-col items-center justify-center relative">
            {/* Chrome tabs */}
            <div className="absolute top-[8%] flex gap-[3px]">
              {['Upper', 'Lower', 'Both'].map((label, i) => (
                <div key={label} className="rounded-[3px]" style={{
                  padding: '2px 7px',
                  background: i === 0 ? 'rgba(255,255,255,0.85)' : ui(0.18),
                  fontSize: 7, fontFamily: 'Roboto, sans-serif',
                  color: i === 0 ? '#3e3d40' : ui(0.8),
                  lineHeight: '13px',
                }}>
                  {label}
                </div>
              ))}
            </div>

            {/* 3D model */}
            <img
              src={teethModelImg}
              alt="Dental model preview"
              style={{ maxWidth: '34%', maxHeight: '58%', objectFit: 'contain', filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.22))' }}
            />

            {/* Bottom-left panel hint */}
            <div className="absolute bottom-[7%] left-[2%] rounded-[4px]" style={{
              width: '14%', height: '18%',
              background: ui(0.18), border: `1px solid ${ui(0.2)}`,
            }} />
          </div>

          {/* Right: toolbar */}
          <div className="flex flex-col items-center shrink-0 pt-[3%] gap-[3%]" style={{ width: '6%' }}>
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="rounded-[3px]" style={{
                width: '55%', aspectRatio: '1/1',
                background: i === 0 ? 'rgba(0,154,206,0.75)' : ui(0.22),
              }} />
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
                    ? 'border-[2px] border-[#009ACE] scale-105 shadow-[0_0_0_1px_rgba(0,154,206,0.25)]'
                    : 'border-[1px] border-[#e5e5e5] group-hover:border-[#d1d1d1] group-hover:scale-102'
                }`}
                style={{ width: 48, height: 48, backgroundColor: theme.color }}
              />
              <span
                className={`font-['Roboto',sans-serif] text-[11px] text-center leading-[14px] transition-colors ${
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
  const [variant, setVariant] = useState<1 | 2 | 3 | 4 | 5 | 6>(1);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '1') setVariant(1);
      else if (e.key === '2') setVariant(2);
      else if (e.key === '3') setVariant(3);
      else if (e.key === '4') setVariant(4);
      else if (e.key === '5') setVariant(5);
      else if (e.key === '6') setVariant(6);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="flex flex-col gap-[24px] w-full">
      <p
        className="font-['Roboto',sans-serif] font-medium text-[18px] text-[#3e3d40] leading-[24px]"
        style={{ fontVariationSettings: "'wdth' 100" }}
      >
        Choose a canvas background to suit your workspace.
      </p>

      {/* Active variant */}
      {variant === 1 && <VariantCards canvasBg={canvasBg} onCanvasBgChange={onCanvasBgChange} />}
      {variant === 2 && <VariantDropdown canvasBg={canvasBg} onCanvasBgChange={onCanvasBgChange} />}
      {variant === 3 && <VariantCircles canvasBg={canvasBg} onCanvasBgChange={onCanvasBgChange} />}
      {variant === 4 && <VariantSwatches canvasBg={canvasBg} onCanvasBgChange={onCanvasBgChange} />}
      {variant === 5 && <VariantCards3Col canvasBg={canvasBg} onCanvasBgChange={onCanvasBgChange} />}
      {variant === 6 && <VariantLivePreview canvasBg={canvasBg} onCanvasBgChange={onCanvasBgChange} />}
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
            className={`relative w-[48px] h-[48px] rounded-[8px] transition-all cursor-pointer ${
              isSelected
                ? 'border-[2px] border-[#009ACE] shadow-[0_0_0_1px_rgba(0,154,206,0.3)] scale-105'
                : 'border-[1px] border-[#e5e5e5] hover:border-[#d1d1d1] hover:scale-102'
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
  const [variant, setVariant] = useState<1 | 2 | 3 | 4 | 5 | 6>(1);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '1') setVariant(1);
      else if (e.key === '2') setVariant(2);
      else if (e.key === '3') setVariant(3);
      else if (e.key === '4') setVariant(4);
      else if (e.key === '5') setVariant(5);
      else if (e.key === '6') setVariant(6);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

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
        <p
          className="font-['Roboto',sans-serif] font-medium text-[18px] text-[#3e3d40] leading-[24px]"
          style={{ fontVariationSettings: "'wdth' 100" }}
        >
          Choose a canvas background to suit your workspace.
        </p>

        {/* Active variant */}
        {variant === 1 && <VariantCards canvasBg={canvasBg} onCanvasBgChange={onCanvasBgChange} />}
        {variant === 2 && <VariantDropdown canvasBg={canvasBg} onCanvasBgChange={onCanvasBgChange} />}
        {variant === 3 && <VariantCircles canvasBg={canvasBg} onCanvasBgChange={onCanvasBgChange} />}
        {variant === 4 && <VariantSwatches canvasBg={canvasBg} onCanvasBgChange={onCanvasBgChange} />}
        {variant === 5 && <VariantCards3Col canvasBg={canvasBg} onCanvasBgChange={onCanvasBgChange} />}
      {variant === 6 && <VariantLivePreview canvasBg={canvasBg} onCanvasBgChange={onCanvasBgChange} />}
      </div>
    </div>
  );
}

export default function SettingsModal({ onClose, canvasBg = '#E0EDF4', onCanvasBgChange }: SettingsModalProps) {
  const [currentPage, setCurrentPage] = useState<SettingsPage>('main');

  const pageTitle = currentPage === 'main' ? 'Settings'
    : currentPage === 'screen-appearance' ? 'View Appearance'
    : 'Display Settings';

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ zIndex: 99999, pointerEvents: "auto" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="flex flex-col"
        style={{
          width: 898,
          height: 732,
          background: '#f4f4f5',
          border: '1px solid #000',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header — matches Figma HEAD row */}
        <div className="flex items-start px-[15px] py-[20px] shrink-0 w-full">
          <div className="flex flex-1 items-start p-[15px] min-w-0">
            {currentPage === 'main' ? (
              <button
                onClick={onClose}
                className="shrink-0 leading-none hover:opacity-70 transition-opacity"
                style={{
                  fontFamily: "'Avenir', 'Avenir Next', sans-serif",
                  fontWeight: 900,
                  fontSize: 60,
                  lineHeight: '34px',
                  color: '#ace1f5',
                  width: 36,
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                }}
              >
                ×
              </button>
            ) : (
              <button
                onClick={() => setCurrentPage('main')}
                className="shrink-0 leading-none hover:opacity-70 transition-opacity flex items-center"
                style={{
                  color: '#ace1f5',
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  width: 36,
                  height: 34,
                }}
              >
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ace1f5" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 18l-6-6 6-6"/>
                </svg>
              </button>
            )}
            {/* Centered title */}
            <div className="flex flex-1 items-center justify-center pr-[36px] min-w-0">
              <p
                className="shrink-0 whitespace-nowrap"
                style={{
                  fontFamily: "'Avenir', 'Avenir Next', sans-serif",
                  fontWeight: 500,
                  fontSize: 24,
                  lineHeight: '34px',
                  color: '#3e3d40',
                }}
              >
                {pageTitle}
              </p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-hidden pb-[30px] flex flex-col w-full" style={{ paddingLeft: 30, paddingRight: currentPage === 'main' ? 90 : 30 }}>
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
