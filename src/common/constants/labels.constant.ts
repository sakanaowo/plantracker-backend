/**
 * Predefined color palette for labels
 * Inspired by Tailwind CSS colors for consistency
 */
export interface LabelColor {
  name: string;
  hex: string; // Main color (for text/border)
  bg: string; // Light background color
}

export const LABEL_COLORS: LabelColor[] = [
  { name: 'Red', hex: '#EF4444', bg: '#FEE2E2' },
  { name: 'Orange', hex: '#F97316', bg: '#FFEDD5' },
  { name: 'Amber', hex: '#F59E0B', bg: '#FEF3C7' },
  { name: 'Yellow', hex: '#EAB308', bg: '#FEF9C3' },
  { name: 'Lime', hex: '#84CC16', bg: '#ECFCCB' },
  { name: 'Green', hex: '#22C55E', bg: '#DCFCE7' },
  { name: 'Emerald', hex: '#10B981', bg: '#D1FAE5' },
  { name: 'Teal', hex: '#14B8A6', bg: '#CCFBF1' },
  { name: 'Cyan', hex: '#06B6D4', bg: '#CFFAFE' },
  { name: 'Sky', hex: '#0EA5E9', bg: '#E0F2FE' },
  { name: 'Blue', hex: '#3B82F6', bg: '#DBEAFE' },
  { name: 'Indigo', hex: '#6366F1', bg: '#E0E7FF' },
  { name: 'Violet', hex: '#8B5CF6', bg: '#EDE9FE' },
  { name: 'Purple', hex: '#A855F7', bg: '#F3E8FF' },
  { name: 'Fuchsia', hex: '#D946EF', bg: '#FAE8FF' },
  { name: 'Pink', hex: '#EC4899', bg: '#FCE7F3' },
  { name: 'Rose', hex: '#F43F5E', bg: '#FFE4E6' },
  { name: 'Gray', hex: '#6B7280', bg: '#F3F4F6' },
];

/**
 * Maximum number of labels that can be assigned to a single task
 */
export const MAX_LABELS_PER_TASK = 5;

/**
 * Helper function to validate if a color is in the predefined palette
 */
export function isValidLabelColor(hex: string): boolean {
  return LABEL_COLORS.some((color) => color.hex === hex);
}

/**
 * Helper function to get color by name
 */
export function getLabelColorByName(name: string): LabelColor | undefined {
  return LABEL_COLORS.find(
    (color) => color.name.toLowerCase() === name.toLowerCase(),
  );
}

/**
 * Helper function to get color by hex
 */
export function getLabelColorByHex(hex: string): LabelColor | undefined {
  return LABEL_COLORS.find((color) => color.hex === hex);
}

/**
 * Default label suggestions for new workspaces
 */
export const DEFAULT_LABEL_SUGGESTIONS = [
  { name: 'Bug', colorName: 'Red' },
  { name: 'Feature', colorName: 'Blue' },
  { name: 'Enhancement', colorName: 'Green' },
  { name: 'Documentation', colorName: 'Purple' },
  { name: 'High Priority', colorName: 'Orange' },
];
