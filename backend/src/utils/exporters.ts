import ExcelJS from 'exceljs';

export type TableRow = Array<string | number | null>;

const DATETIME_LOCALE = 'ja-JP';
const DATETIME_TZ = 'Asia/Tokyo';

const DEFAULT_END_LABEL = '\u7d99\u7d9a\u4e2d';

const CSV_BOM = '\uFEFF';

export function formatDateTimeISO(value: string | null | undefined, fallback: string = ''): string {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toLocaleString(DATETIME_LOCALE, {
    timeZone: DATETIME_TZ,
    hour12: false,
  });
}

export function formatBookingEnd(value: string | null | undefined): string {
  return value ? formatDateTimeISO(value) : DEFAULT_END_LABEL;
}

export function toCsvBuffer(headers: string[], rows: TableRow[]): Buffer {
  const escapeCell = (cell: string | number | null): string => {
    if (cell === null || cell === undefined) return '';
    const value = String(cell);
    if (/[",\n]/.test(value)) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  };

  const lines = [headers.map(escapeCell).join(',')];
  for (const row of rows) {
    lines.push(headers.map((_, idx) => escapeCell(row[idx] ?? '')).join(','));
  }
  return Buffer.from(CSV_BOM + lines.join('\n'), 'utf8');
}

export async function toXlsxBuffer(sheetName: string, headers: string[], rows: TableRow[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.created = new Date();
  const sheet = workbook.addWorksheet(sheetName || '\u30b7\u30fc\u30c81');
  sheet.addRow(headers);
  for (const row of rows) {
    sheet.addRow(row);
  }

  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];

  headers.forEach((header, index) => {
    let maxLength = header.length;
    rows.forEach((row) => {
      const cellValue = row[index];
      if (cellValue !== null && cellValue !== undefined) {
        const len = String(cellValue).length;
        if (len > maxLength) maxLength = len;
      }
    });
    sheet.getColumn(index + 1).width = Math.min(48, Math.max(12, maxLength + 2));
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export function japaneseVehicleType(type: string | null | undefined): string {
  switch (type) {
    case 'large':
      return '\u5927\u578b\u8eca';
    case 'other':
      return '\u305d\u306e\u4ed6';
    case 'normal':
    default:
      return '\u666e\u901a\u8eca';
  }
}

export function sanitizeForFilename(value: string): string {
  return value.replace(/[\\/:*?"<>|]/g, '_');
}

export function currentTokyoTimestamp(): string {
  const formatter = new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts = formatter.formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}${get('month')}${get('day')}_${get('hour')}${get('minute')}${get('second')}`;
}
