// Predefined vibrant color palette for file tagging
export const FILE_COLORS = [
  'bg-blue-500 border-blue-600',    // Blue
  'bg-green-500 border-green-600',  // Green
  'bg-yellow-500 border-yellow-600', // Yellow
  'bg-pink-500 border-pink-600',    // Pink
  'bg-purple-500 border-purple-600', // Purple
  'bg-indigo-500 border-indigo-600', // Indigo
  'bg-red-500 border-red-600',      // Red
  'bg-teal-500 border-teal-600',    // Teal
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

// Function to get file name abbreviation
export function abbreviateFileName(fileName: string, maxLength: number = 20): string {
  if (fileName.length <= maxLength) {
    return fileName;
  }
  return fileName.substring(0, maxLength - 3) + '...';
}