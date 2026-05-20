import { motion } from 'framer-motion';

interface OcclusogramLegendProps {
  visible: boolean;
}

// Contact pressure colors matching OcclusogramHeatmapOverlay.tsx
const CONTACT_LEGEND = [
  { color: '#0066ff', label: 'No Contact' },
  { color: '#00ccff', label: 'Light' },
  { color: '#00ff88', label: 'Moderate' },
  { color: '#ffff00', label: 'Normal' },
  { color: '#ff6600', label: 'High' },
  { color: '#a00a0a', label: 'Excessive' },
];

export default function OcclusogramLegend({ visible }: OcclusogramLegendProps) {
  if (!visible) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
      transition={{ duration: 0.4 }}
      className="absolute bottom-6 right-6 z-30"
    >
      <div className="bg-white/90 backdrop-blur-sm rounded-lg p-4 shadow-lg border border-gray-200">
        <h3 className="font-medium text-sm text-gray-700 mb-3">Contact Pressure</h3>
        <div className="flex flex-col gap-2">
          {CONTACT_LEGEND.map((item, i) => (
            <div key={i} className="flex items-center gap-2">
              <div 
                className="w-4 h-4 rounded border border-gray-300" 
                style={{ backgroundColor: item.color }}
              />
              <span className="text-sm text-gray-600">{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}