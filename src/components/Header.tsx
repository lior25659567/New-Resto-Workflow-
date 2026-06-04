import { useState } from "react";
import svgPaths from "../imports/svg-9qmivtwjge";
import imgStepIcon from "figma:asset/07f97a5be96fd814ee3e830a2d5bb8ecc4ab9638.png";
import { imgPath4141 } from "../imports/svg-o9n46";
import SettingsModal from "./SettingsModal";
import RxIcon from "../imports/RxIcon";
import EmailIcon from "../imports/Icon-287-18";
import SearchIconImport from "../imports/Icon-287-132";

// Rx Icon Component
function RxIconWrapper({ isActive = false }: { isActive?: boolean }) {
  return (
    <div className={`relative rounded-[6px] shrink-0 size-[60px] transition-all cursor-pointer ${
      isActive ? 'bg-[#8FE5FC]' : 'bg-white'
    }`}>
      <RxIcon />
    </div>
  );
}

// Step Icon Container
function StepIconContainer({ isActive = false, onClick }: { isActive?: boolean; onClick?: () => void }) {
  return (
    <div 
      onClick={onClick}
      className={`flex items-center justify-center shrink-0 size-[60px] rounded-[6px] transition-all cursor-pointer ${
        isActive ? 'bg-[#A6E2F9]' : 'bg-white'
      }`}>
      <div className="w-[48px] h-[48px] flex items-center justify-center">
        <img alt="Step icon" className="w-full h-full object-contain" src={imgStepIcon} />
      </div>
    </div>
  );
}

// Scan Icon
function ScanIcon({ isActive = false }: { isActive?: boolean }) {
  return (
    <div className="relative shrink-0 size-[60px]">
      <div className={`absolute inset-0 rounded-[6px] transition-all cursor-pointer ${
        isActive ? 'bg-[#A6E2F9]' : 'bg-white'
      }`} />
      <div className="absolute inset-[8.84%_12.54%_35.21%_28.64%]">
        <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 36 34">
          <path d={svgPaths.p518f010} fill="white" />
        </svg>
      </div>
      <div className="absolute inset-[15.03%_26.97%_15.53%_26.74%]">
        <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 28 42">
          <path d={svgPaths.p24ea1480} fill="url(#paint0_linear_scan)" />
          <path d={svgPaths.p39d20b00} fill="#717073" />
          <path d={svgPaths.p2a684700} fill="#F3F3F3" />
          <defs>
            <linearGradient gradientUnits="userSpaceOnUse" id="paint0_linear_scan" x1="13.9051" x2="13.9051" y1="0.410845" y2="41.2563">
              <stop stopColor="white" />
              <stop offset="1" stopColor="#D4D5D6" />
            </linearGradient>
          </defs>
        </svg>
      </div>
      <div className="absolute inset-[16.4%_28.34%_41.4%_43.07%]">
        <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 18 26">
          <path d={svgPaths.p11694100} fill="url(#paint0_linear_scan2)" />
          <path d={svgPaths.p3df8e700} fill="#CECFD1" />
          <defs>
            <linearGradient gradientUnits="userSpaceOnUse" id="paint0_linear_scan2" x1="8.16892" x2="8.16892" y1="0" y2="25.3237">
              <stop stopColor="white" />
              <stop offset="1" stopColor="#D4D5D6" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    </div>
  );
}

// Chevron
function Chevron() {
  return (
    <div className="h-[20px] shrink-0 w-[16px]">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 16 20">
        <path d="M13 10L3 20V0L13 10Z" fill="#4A4B4D" />
      </svg>
    </div>
  );
}

// Help Icon
function HelpIcon() {
  return (
    <div className="relative size-[32px]">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 32 34">
        <path d={svgPaths.p3636c900} fill="url(#paint0_linear_help)" />
        <path d={svgPaths.p37642ec0} fill="#399927" />
        <path d={svgPaths.p22856e80} fill="#DAEBBA" />
        <defs>
          <linearGradient gradientUnits="userSpaceOnUse" id="paint0_linear_help" x1="16" x2="16" y1="0.526316" y2="33.1579">
            <stop stopColor="#B5D776" />
            <stop offset="1" stopColor="#8AC562" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-[21.87%_31.25%]">
        <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 12 19">
          <path d={svgPaths.p21006400} fill="white" />
          <path d={svgPaths.p140a97f0} fill="white" />
        </svg>
      </div>
    </div>
  );
}

// Settings Icon
function SettingsIcon() {
  return (
    <div className="relative size-[34px]">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 34 36">
        <path d={svgPaths.p15b8880} fill="url(#paint0_linear_settings)" />
        <path d={svgPaths.p3d793080} fill="#717073" />
        <path d={svgPaths.p3fa1ba00} fill="#F3F3F3" />
        <defs>
          <linearGradient gradientUnits="userSpaceOnUse" id="paint0_linear_settings" x1="17.0042" x2="17.0042" y1="0.0236045" y2="35.7872">
            <stop stopColor="#E7E7E8" />
            <stop offset="1" stopColor="#C9CACB" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-[20.6%_20.58%_20.59%_20.57%]">
        <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 20 22">
          <path d={svgPaths.p15ddd700} stroke="#939598" strokeMiterlimit="10" fill="none" />
        </svg>
      </div>
    </div>
  );
}

// Battery Icon
function BatteryIcon() {
  return (
    <div className="relative w-[19px] h-[35px]">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 20 35">
        <rect fill="url(#paint0_linear_battery)" height="31" width="17" x="1" y="3" />
        <path d={svgPaths.p3b5e7d00} fill="#CECECE" />
        <path d={svgPaths.pe459180} fill="#CECECE" />
        <path d={svgPaths.p1803b900} fill="#868686" />
        <rect fill="#CECECE" height="2" width="7" x="6.80469" />
        <defs>
          <linearGradient gradientUnits="userSpaceOnUse" id="paint0_linear_battery" x1="9.5" x2="8.02823" y1="43.6875" y2="-2.1558">
            <stop stopColor="#C4C4C4" />
            <stop offset="1" stopColor="#FFFBFB" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}

// New Scan Icon
function NewScanIcon() {
  return (
    <div className="flex gap-[2px] items-start rounded-[2px] shrink-0 size-[36px]">
      {/* Left side */}
      <div className="basis-0 flex flex-col gap-[2px] grow h-full">
        <div className="basis-0 bg-[#a0daf8] grow rounded-[2px]" />
        <div className="basis-0 bg-[#b6d77b] grow rounded-[2px]" />
      </div>
      {/* Right side */}
      <div className="basis-0 flex flex-col gap-[2px] grow h-full">
        <div className="basis-0 bg-[#b6d77b] grow rounded-[2px]" />
        <div className="basis-0 bg-[#a0daf8] grow rounded-[2px]" />
      </div>
    </div>
  );
}

interface HeaderProps {
  activeSteps?: {
    rx?: boolean;
    stepIcon?: boolean;
    scan?: boolean;
    search?: boolean;
    email?: boolean;
  };
  onStepToggle?: (step: 'rx' | 'stepIcon' | 'scan' | 'search' | 'email') => void;
  onNavigateToRx?: () => void;
  onNavigateToScan?: () => void;
  onNavigateToView?: () => void;
  onNavigateToSummary?: () => void;
  canvasBg?: string;
  onCanvasBgChange?: (color: string) => void;
}

export default function Header({ activeSteps = { scan: true }, onStepToggle, onNavigateToRx, onNavigateToScan, onNavigateToView, onNavigateToSummary, canvasBg, onCanvasBgChange }: HeaderProps) {
  const [showSettings, setShowSettings] = useState(false);
  return (
    <div className="bg-white flex flex-col items-start relative w-full shrink-0 shadow-[0px_1px_2px_0px_rgba(0,0,0,0.1),0px_2px_8px_0px_rgba(0,0,0,0.15)] sticky top-0 z-[250]">
      {/* Main Header Bar - Single Row */}
      <div className="h-[76px] relative w-full bg-white">
        {/* New Scan - Left */}
        <div className="absolute left-[20px] top-1/2 -translate-y-1/2 flex gap-[16px] items-center">
          <NewScanIcon />
          <div className="font-['Roboto',sans-serif] font-medium text-[#474955] text-[24px] leading-[36px]">
            New Scan
          </div>
        </div>

        {/* Wizard Navigation - Center */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex gap-[5px] items-center z-10">
          <button 
            onClick={() => {
              onStepToggle?.('rx');
              onNavigateToRx?.();
            }}
            className={`relative rounded-[6px] shrink-0 size-[60px] transition-all cursor-pointer ${
              activeSteps?.rx ? 'bg-[#A6E2F9]' : 'bg-white'
            }`}
          >
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-[48px] h-[48px]">
                <RxIcon />
              </div>
            </div>
          </button>
          <Chevron />
          <StepIconContainer isActive={activeSteps?.stepIcon || false} onClick={() => {
            onStepToggle?.('stepIcon');
            onNavigateToScan?.();
          }} />
          <Chevron />
          <button 
            onClick={() => {
              onStepToggle?.('search');
              onNavigateToView?.();
            }}
            className={`relative rounded-[6px] shrink-0 size-[60px] transition-all cursor-pointer ${
              activeSteps?.search ? 'bg-[#A6E2F9]' : 'bg-white'
            }`}
          >
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-[44px] h-[37px]">
                <SearchIconImport />
              </div>
            </div>
          </button>
          <Chevron />
          <button 
            onClick={() => {
              onStepToggle?.('email');
              onNavigateToSummary?.();
            }}
            className={`relative shrink-0 size-[60px] rounded-[6px] transition-all cursor-pointer ${
              activeSteps?.email ? 'bg-[#A6E2F9]' : 'bg-white'
            }`}
          >
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-[48px] h-[27px] relative">
                <EmailIcon />
              </div>
            </div>
          </button>
        </div>

        {/* Right Icons */}
        <div className="absolute right-[17px] top-1/2 -translate-y-1/2 flex gap-[24px] items-center">
          <button className="transition-opacity hover:opacity-80">
            <BatteryIcon />
          </button>
          <button className="transition-opacity hover:opacity-80" onClick={() => setShowSettings(true)}>
            <SettingsIcon />
          </button>
          <button className="transition-opacity hover:opacity-80">
            <HelpIcon />
          </button>
        </div>
      </div>
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} canvasBg={canvasBg} onCanvasBgChange={onCanvasBgChange} />}
    </div>
  );
}