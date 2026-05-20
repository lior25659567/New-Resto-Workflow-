import BiteToolbar from "../imports/BiteToolbar";
import CentricIcon from "../imports/CentricIcon";
import RightLateralIcon from "../imports/RightLateralIcon";
import LeftLateralIcon from "../imports/LeftLateralIcon";
import ProtrusiveIcon from "../imports/ProtrusiveIcon";
import RetrusiveIcon from "../imports/RetrusiveIcon";

interface BiteToolbarContainerProps {
  selectedBiteOptions: string[];
  activeBite?: string;
  onBiteClick?: (bite: string) => void;
  onBiteToggle?: (bite: string) => void;
}

export function BiteToolbarContainer({
  selectedBiteOptions,
  activeBite,
  onBiteClick,
  onBiteToggle
}: BiteToolbarContainerProps) {
  // Get icon component for bite type
  const getBiteIcon = (option: string) => {
    switch (option) {
      case "Centric":
        return (
          <div className="w-[42px] h-[42px]">
            <CentricIcon />
          </div>
        );
      case "Right lateral":
        return (
          <div className="w-[42px] h-[42px]">
            <RightLateralIcon />
          </div>
        );
      case "Left lateral":
        return (
          <div className="w-[42px] h-[42px]">
            <LeftLateralIcon />
          </div>
        );
      case "Additional centric":
        return (
          <div className="w-[42px] h-[42px]">
            <CentricIcon />
          </div>
        );
      case "Protrusive":
        return (
          <div className="w-[42px] h-[42px]">
            <ProtrusiveIcon />
          </div>
        );
      case "Retrusive":
        return (
          <div className="w-[42px] h-[42px]">
            <RetrusiveIcon />
          </div>
        );
      default:
        return (
          <svg width="42" height="42" viewBox="0 0 32 32" fill="none">
            <circle cx="16" cy="16" r="8" stroke="currentColor" strokeWidth="2" fill="none"/>
          </svg>
        );
    }
  };

  // Build bite options to display: only selected bites (Centric Occlusion is now a regular selectable option)
  const displayBiteOptions = selectedBiteOptions.map(bite => ({
    key: bite,
    label: bite,
    alwaysOn: false
  }));

  const handleBiteClick = (bite: string) => {
    // Just switch to the clicked bite without removing it
    onBiteClick?.(bite);
  };

  return (
    <div className="bg-white rounded-[8px] p-2 w-fit flex gap-2 items-center relative z-[100]">
      <div className="flex gap-2 items-center">
        {displayBiteOptions.map((bite) => {
          const isActive = activeBite === bite.key;
          const icon = getBiteIcon(bite.key);

          return (
            <div
              key={bite.key}
              className="flex flex-col items-center justify-center px-2 py-1"
            >
              <button
                onClick={() => handleBiteClick(bite.key)}
                className={`w-[60px] h-[60px] rounded-[10px] flex items-center justify-center transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-[#dff5fc] border border-[#00adef]'
                    : 'bg-white hover:bg-gray-50'
                }`}
                style={{ fontFamily: "'Roboto', sans-serif" }}
                title={bite.label}
              >
                <div className="w-full h-full flex items-center justify-center scale-[1.33] pointer-events-none">
                  {icon}
                </div>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}