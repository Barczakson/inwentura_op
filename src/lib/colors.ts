// High-contrast color palette for file tagging with distinct visual differences
export const FILE_COLORS = [
  'bg-blue-600 border-blue-700',       // Deep Blue
  'bg-emerald-500 border-emerald-600', // Emerald Green  
  'bg-amber-500 border-amber-600',     // Amber/Orange
  'bg-rose-500 border-rose-600',       // Rose Pink
  'bg-violet-600 border-violet-700',   // Deep Purple
  'bg-cyan-500 border-cyan-600',       // Cyan Blue
  'bg-red-600 border-red-700',         // Deep Red
  'bg-lime-500 border-lime-600',       // Bright Lime
  'bg-fuchsia-500 border-fuchsia-600', // Magenta
  'bg-orange-500 border-orange-600',   // Orange
  'bg-indigo-600 border-indigo-700',   // Deep Indigo
  'bg-teal-600 border-teal-700',       // Deep Teal
  'bg-pink-400 border-pink-500',       // Light Pink
  'bg-sky-500 border-sky-600',         // Sky Blue
  'bg-green-600 border-green-700',     // Forest Green
  'bg-yellow-400 border-yellow-500',   // Bright Yellow
];

// Function to get a consistent color for a file based on its ID
export function getFileColorClass(fileId: string): string {
  let hash = 0;
  for (let i = 0; i < fileId.length; i++) {
    hash = fileId.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % FILE_COLORS.length;
  return FILE_COLORS[index];
}

// Function to get only the background color part (for circles and indicators)
export function getFileBackgroundColor(fileId: string): string {
  const fullColorClass = getFileColorClass(fileId);
  return fullColorClass.split(' ')[0]; // Returns just the bg-color-xxx part
}

// Function to get only the border color part (for borders)
export function getFileBorderColor(fileId: string): string {
  const fullColorClass = getFileColorClass(fileId);
  const borderClass = fullColorClass.split(' ')[1];
  return borderClass.replace('border-', 'border-l-'); // Convert to left border
}

// Enhanced color mappings with hex values for maximum contrast
export const FILE_COLOR_MAP = {
  'bg-blue-600': { bg: '#2563eb', border: '#1d4ed8', text: '#ffffff' },
  'bg-emerald-500': { bg: '#10b981', border: '#059669', text: '#ffffff' },
  'bg-amber-500': { bg: '#f59e0b', border: '#d97706', text: '#000000' },
  'bg-rose-500': { bg: '#f43f5e', border: '#e11d48', text: '#ffffff' },
  'bg-violet-600': { bg: '#7c3aed', border: '#6d28d9', text: '#ffffff' },
  'bg-cyan-500': { bg: '#06b6d4', border: '#0891b2', text: '#ffffff' },
  'bg-red-600': { bg: '#dc2626', border: '#b91c1c', text: '#ffffff' },
  'bg-lime-500': { bg: '#84cc16', border: '#65a30d', text: '#000000' },
  'bg-fuchsia-500': { bg: '#d946ef', border: '#c026d3', text: '#ffffff' },
  'bg-orange-500': { bg: '#f97316', border: '#ea580c', text: '#ffffff' },
  'bg-indigo-600': { bg: '#4f46e5', border: '#4338ca', text: '#ffffff' },
  'bg-teal-600': { bg: '#0d9488', border: '#0f766e', text: '#ffffff' },
  'bg-pink-400': { bg: '#f472b6', border: '#ec4899', text: '#000000' },
  'bg-sky-500': { bg: '#0ea5e9', border: '#0284c7', text: '#ffffff' },
  'bg-green-600': { bg: '#16a34a', border: '#15803d', text: '#ffffff' },
  'bg-yellow-400': { bg: '#facc15', border: '#eab308', text: '#000000' }
};

// Function to get color details with hex values
export function getFileColorDetails(fileId: string) {
  const fullColorClass = getFileColorClass(fileId);
  const bgClass = fullColorClass.split(' ')[0];
  return FILE_COLOR_MAP[bgClass as keyof typeof FILE_COLOR_MAP] || FILE_COLOR_MAP['bg-blue-600'];
}

// Function to get inline style for maximum contrast
export function getFileInlineStyle(fileId: string) {
  const colors = getFileColorDetails(fileId);
  return {
    backgroundColor: colors.bg,
    borderColor: colors.border,
    color: colors.text
  };
}

// Function to get inline style with enhanced shadow for better visibility
export function getFileInlineStyleWithShadow(fileId: string) {
  const colors = getFileColorDetails(fileId);
  return {
    backgroundColor: colors.bg,
    borderColor: colors.border,
    color: colors.text,
    boxShadow: `0 2px 4px ${colors.border}40` // Add shadow with border color
  };
}

// Function to get file name abbreviation
export function abbreviateFileName(fileName: string, maxLength: number = 20): string {
  if (fileName.length <= maxLength) {
    return fileName;
  }
  return fileName.substring(0, maxLength - 3) + '...';
}

// Debug function to preview all color combinations
export function previewAllColors() {
  console.log('🎨 File Color Palette Preview:');
  FILE_COLORS.forEach((colorClass, index) => {
    const bgClass = colorClass.split(' ')[0];
    const colors = FILE_COLOR_MAP[bgClass as keyof typeof FILE_COLOR_MAP];
    if (colors) {
      console.log(
        `%c ${index + 1}. ${bgClass} `,
        `background-color: ${colors.bg}; color: ${colors.text}; padding: 4px 8px; border-radius: 4px; font-weight: bold; margin-right: 4px;`,
        `- Hex: ${colors.bg}`
      );
    }
  });
}