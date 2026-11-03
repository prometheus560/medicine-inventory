import ExcelJS from 'exceljs/dist/exceljs.min.js';

const FILL = { ok: 'FFD1FAE5', low: 'FFFEF3C7', soon: 'FFFEF3C7', exp: 'FFFEE2E2' };
const INK = { ok: 'FF047857', low: 'FFB45309', soon: 'FFB45309', exp: 'FFB91C1C' };
const line = { style: 'thin', color: { argb: 'FFE2E8F0' } };
const box = { top: line, bottom: line, left: line, right: line };
const solid = argb => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });
const utcDate = s => { const [y, m, d] = s.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
const localAsUtc = d => new Date(d.getTime() - d.getTimezoneOffset() * 60000);

function head(ws, rowNo, labels) {
  const r = ws.getRow(rowNo);
  r.values = labels;
  r.height = 22;
  r.eachCell(c => {
    c.fill = solid('FF0B1F3A');
    c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    c.alignment = { vertical: 'middle', horizontal: 'center' };
  });
}

export async function exportExcel(meds, hist, status) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'MedStock';
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const ymd = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

  const ws = wb.addWorksheet('Inventory', { views: [{ state: 'frozen', ySplit: 4 }] });
  ws.columns = [28, 16, 10, 10, 10, 13, 14, 10, 15, 16, 24].map(width => ({ width }));
  ws.mergeCells('A1:K1');
  ws.getCell('A1').value = 'Medical-Dental Health Unit – San Carlos Campus';
  ws.getCell('A1').font = { bold: true, size: 14 };
  ws.mergeCells('A2:K2');
  ws.getCell('A2').value = `Medicine Inventory Report · ${now.toLocaleDateString()}`;
  ws.getCell('A2').font = { color: { argb: 'FF64748B' } };
  head(ws, 4, ['Medicine', 'Category', 'Quantity', 'Unit', 'Reorder level', 'Batch no.', 'Expiry date', 'Days left', 'Status', 'Supplier', 'Remarks']);

  const sorted = [...meds].sort((a, b) => a.name.localeCompare(b.name));
  sorted.forEach(m => {
    const [k, label] = status(m);
    const days = Math.round((utcDate(m.expiry_date) - utcDate(ymd)) / 864e5);
    const row = ws.addRow([m.name, m.category, m.quantity, m.unit, m.reorder_level, m.batch_no || '', utcDate(m.expiry_date), days, label, m.supplier || '', m.remarks || '']);
    row.eachCell({ includeEmpty: true }, c => { c.border = box; c.alignment = { vertical: 'middle' }; });
    row.getCell(7).numFmt = 'dd mmm yyyy';
    [3, 4, 5, 7, 8].forEach(i => { row.getCell(i).alignment = { vertical: 'middle', horizontal: 'center' }; });
    const s = row.getCell(9);
    s.fill = solid(FILL[k]);
    s.font = { bold: true, color: { argb: INK[k] } };
    s.alignment = { vertical: 'middle', horizontal: 'center' };
    if (m.quantity <= m.reorder_level) row.getCell(3).font = { bold: true, color: { argb: 'FFB91C1C' } };
  });
  if (sorted.length) {
    const last = 4 + sorted.length;
    ws.addRow([]);
    const t = ws.addRow(['Total units in stock', '', { formula: `SUM(C5:C${last})`, result: sorted.reduce((a, m) => a + m.quantity, 0) }]);
    t.font = { bold: true };
    ws.autoFilter = { from: 'A4', to: `K${last}` };
  }
  ws.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };

  const hs = wb.addWorksheet('Stock history', { views: [{ state: 'frozen', ySplit: 1 }] });
  hs.columns = [22, 28, 12, 10, 28, 14, 22, 14, 28].map(width => ({ width }));
  head(hs, 1, ['Date', 'Medicine', 'Type', 'Quantity', 'Note', 'By', 'Patient', 'Patient ID', 'Purpose']);
  hist.forEach(t => {
    const when = localAsUtc(new Date(t.created_at.replace(' ', 'T') + 'Z'));
    const row = hs.addRow([when, t.medicine_name, t.type === 'IN' ? 'Stock in' : 'Stock out', t.quantity, t.note || '', t.performed_by || '', t.patient || '', t.patient_id || '', t.purpose || '']);
    row.eachCell({ includeEmpty: true }, c => { c.border = box; });
    row.getCell(1).numFmt = 'dd mmm yyyy hh:mm';
    row.getCell(3).font = { bold: true, color: { argb: t.type === 'IN' ? 'FF047857' : 'FFB91C1C' } };
  });

  const buf = await wb.xlsx.writeBuffer();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  a.download = `medicine-inventory-${ymd}.xlsx`;
  a.click();
}
