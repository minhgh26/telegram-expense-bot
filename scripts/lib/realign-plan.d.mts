export const WORKBOOK_YEAR: number;
export const GROUPS: string[];
export const SPEND_GROUPS: string[];
export const SOURCE_TOKENS: string[];
export function serialToDate(serial: number): { y: number; m: number; d: number };
export interface PlanChange {
  index: number;
  oldValue: unknown[];
  newValue: unknown[];
  target: string | null;
  reason: 'off-month' | 'cc' | 'other-year' | 'no-date';
  starred: boolean;
  kind: 'move' | 'retag' | 'stay';
  /** Ô mô tả của newValue khác oldValue. */
  descChanged: boolean;
}
export function planSheet(group: string, sheetMonth: number, rows: unknown[][]): PlanChange[];
