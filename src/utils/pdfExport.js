import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PIPELINE_STAGES } from './constants';

// ============== COLOR PALETTE ==============
const COLORS = {
  headerBg: [15, 23, 42],
  headerText: [255, 255, 255],
  accent: [6, 182, 212],
  cuentas: {
    tableHeaderBg: [6, 182, 212],
    tableHeaderText: [255, 255, 255],
  },
  leads: {
    tableHeaderBg: [139, 92, 246],
    tableHeaderText: [255, 255, 255],
  },
  pipeline: {
    tableHeaderBg: [245, 158, 11],
    tableHeaderText: [255, 255, 255],
  },
  rowEven: [255, 255, 255],
  rowOdd: [241, 245, 249],
  textDark: [30, 41, 59],
  footerText: [100, 116, 139],
  borderColor: [203, 213, 225],
};

// ============== HELPERS ==============
const formatFecha = (fechaStr) => {
  if (!fechaStr) return '—';
  const d = new Date(fechaStr);
  if (isNaN(d.getTime())) return fechaStr;
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
};

const getFechaHoy = () =>
  new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' });

const generateDocNumber = (tipo) => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const codes = { cuentas: 'CTA', leads: 'LED', pipeline: 'PIP' };
  return `DOC-EON-${year}-RPT-${codes[tipo] || 'GEN'}-${month}${day}`;
};

const loadLogo = () =>
  new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      canvas.getContext('2d').drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => resolve(null);
    img.src = '/logo-eon.png';
  });

// ============== HEADER (Institutional Format) ==============
const drawHeader = (doc, subtitulo, totalLabel, logoData, companyName, docNumber) => {
  const pageWidth = doc.internal.pageSize.getWidth();

  // Dark header bar
  doc.setFillColor(...COLORS.headerBg);
  doc.rect(0, 0, pageWidth, 38, 'F');

  // Accent line
  doc.setFillColor(...COLORS.accent);
  doc.rect(0, 38, pageWidth, 2.5, 'F');

  // Logo
  let textX = 14;
  if (logoData) {
    doc.addImage(logoData, 'PNG', 10, 7, 24, 24);
    textX = 38;
  }

  // Company name
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...COLORS.headerText);
  doc.text(companyName, textX, 17);

  // Subtitle
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(180, 200, 220);
  doc.text('Documento Institucional', textX, 25);

  // Subtitle detail
  doc.setFontSize(8.5);
  doc.setTextColor(150, 170, 190);
  doc.text(subtitulo, textX, 32);

  // Right side: doc number, date, classification
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(180, 200, 220);
  doc.text(docNumber, pageWidth - 14, 12, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(150, 170, 190);
  doc.text(`Fecha: ${getFechaHoy()}`, pageWidth - 14, 19, { align: 'right' });
  doc.text(`Clasificacion: Interno`, pageWidth - 14, 25, { align: 'right' });
  doc.text(totalLabel, pageWidth - 14, 32, { align: 'right' });

  return 46;
};

// ============== FOOTER (Institutional Format) ==============
const drawFooter = (doc, companyName, docNumber) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Accent line
  doc.setFillColor(...COLORS.accent);
  doc.rect(0, pageHeight - 14, pageWidth, 0.5, 'F');

  // Left: company + doc number
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...COLORS.footerText);
  doc.text(`${companyName} — Documento Interno — ${docNumber}`, 14, pageHeight - 7);

  // Right: page number
  const pageNumber = doc.internal.getCurrentPageInfo().pageNumber;
  const totalPages = doc.internal.getNumberOfPages();
  doc.text(`Pagina ${pageNumber} de ${totalPages}`, pageWidth - 14, pageHeight - 7, { align: 'right' });
};

// ============== EXPORT: CUENTAS ==============
export const exportarPDFCuentas = async (cuentas, companyName = 'Grupo EON CRM') => {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const logoData = await loadLogo();
  const colors = COLORS.cuentas;
  const docNumber = generateDocNumber('cuentas');

  const startY = drawHeader(doc, 'Reporte de Cuentas', `${cuentas.length} cuentas`, logoData, companyName, docNumber);

  autoTable(doc, {
    head: [['#', 'Empresa', 'Industria', 'Servicio', 'Num. Empleados', 'Fecha Creacion']],
    body: cuentas.map((c, i) => [
      i + 1, c.empresa || '—', c.industria || '—', c.servicio || '—',
      c.numeroEmpleados || '—', formatFecha(c.fechaCreacion)
    ]),
    startY,
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 9, cellPadding: 4, textColor: COLORS.textDark, lineColor: COLORS.borderColor, lineWidth: 0.2 },
    headStyles: { fillColor: colors.tableHeaderBg, textColor: colors.tableHeaderText, fontSize: 10, fontStyle: 'bold', halign: 'center' },
    alternateRowStyles: { fillColor: COLORS.rowOdd },
    columnStyles: {
      0: { halign: 'center', cellWidth: 12 },
      1: { cellWidth: 'auto', fontStyle: 'bold' },
      2: { halign: 'center' },
      3: { halign: 'center' },
      4: { halign: 'center', cellWidth: 30 },
      5: { halign: 'center', cellWidth: 35 },
    },
    margin: { top: 46, left: 14, right: 14, bottom: 20 },
    didDrawPage: (data) => {
      if (data.pageNumber > 1) drawHeader(doc, 'Reporte de Cuentas', `${cuentas.length} cuentas`, logoData, companyName, docNumber);
      drawFooter(doc, companyName, docNumber);
    },
  });

  doc.save(`cuentas_reporte_${docNumber}.pdf`);
};

// ============== EXPORT: LEADS ==============
export const exportarPDFLeads = async (leads, companyName = 'Grupo EON CRM') => {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const logoData = await loadLogo();
  const colors = COLORS.leads;
  const docNumber = generateDocNumber('leads');

  const startY = drawHeader(doc, 'Reporte de Leads', `${leads.length} leads`, logoData, companyName, docNumber);

  autoTable(doc, {
    head: [['#', 'Empresa', 'Contacto', 'Cargo', 'Email', 'Telefono', 'Industria', 'Fuente', 'Prioridad', 'Fecha']],
    body: leads.map((l, i) => [
      i + 1, l.empresa || '—', l.contacto || '—', l.cargo || '—',
      l.email || '—', l.telefono || '—', l.industria || '—',
      l.fuente || '—', l.prioridad || '—', formatFecha(l.fechaCreacion)
    ]),
    startY,
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 8, cellPadding: 3, textColor: COLORS.textDark, lineColor: COLORS.borderColor, lineWidth: 0.2 },
    headStyles: { fillColor: colors.tableHeaderBg, textColor: colors.tableHeaderText, fontSize: 9, fontStyle: 'bold', halign: 'center' },
    alternateRowStyles: { fillColor: COLORS.rowOdd },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      1: { cellWidth: 'auto', fontStyle: 'bold' },
      2: { cellWidth: 30 },
      3: { cellWidth: 25 },
      4: { cellWidth: 40, fontSize: 7 },
      5: { cellWidth: 28 },
      6: { halign: 'center', cellWidth: 25 },
      7: { halign: 'center', cellWidth: 22 },
      8: { halign: 'center', cellWidth: 20 },
      9: { halign: 'center', cellWidth: 25 },
    },
    margin: { top: 46, left: 10, right: 10, bottom: 20 },
    didDrawPage: (data) => {
      if (data.pageNumber > 1) drawHeader(doc, 'Reporte de Leads', `${leads.length} leads`, logoData, companyName, docNumber);
      drawFooter(doc, companyName, docNumber);
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 8) {
        const val = (data.cell.raw || '').toString().toLowerCase();
        if (val === 'alta') { data.cell.styles.textColor = [220, 38, 38]; data.cell.styles.fontStyle = 'bold'; }
        else if (val === 'media') { data.cell.styles.textColor = [217, 119, 6]; data.cell.styles.fontStyle = 'bold'; }
        else if (val === 'baja') { data.cell.styles.textColor = [22, 163, 74]; }
      }
    },
  });

  doc.save(`leads_reporte_${docNumber}.pdf`);
};

// ============== EXPORT: PIPELINE ==============
export const exportarPDFPipeline = async (pipeline, companyName = 'Grupo EON CRM') => {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const logoData = await loadLogo();
  const colors = COLORS.pipeline;
  const docNumber = generateDocNumber('pipeline');

  const stageColorMap = {
    prospecto: [100, 116, 139],
    contacto: [59, 130, 246],
    diagnostico: [6, 182, 212],
    piloto: [139, 92, 246],
    negociacion: [245, 158, 11],
    cerrado: [16, 185, 129],
    perdido: [239, 68, 68],
  };

  const startY = drawHeader(doc, 'Reporte de Pipeline', `${pipeline.length} oportunidades`, logoData, companyName, docNumber);

  autoTable(doc, {
    head: [['#', 'Proyecto', 'Empresa', 'Etapa', 'Valor Estimado', 'Seguimiento', 'Notas', 'Fecha Creacion']],
    body: pipeline.map((p, i) => [
      i + 1, p.nombre || '—', p.empresa || '—',
      PIPELINE_STAGES.find(s => s.id === p.etapa)?.name || p.etapa || '—',
      p.valorEstimado ? `$${parseFloat(p.valorEstimado).toLocaleString('es-MX')}` : '—',
      formatFecha(p.fechaSeguimiento), p.notas || '—', formatFecha(p.fechaCreacion)
    ]),
    startY,
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 3.5, textColor: COLORS.textDark, lineColor: COLORS.borderColor, lineWidth: 0.2 },
    headStyles: { fillColor: colors.tableHeaderBg, textColor: colors.tableHeaderText, fontSize: 9.5, fontStyle: 'bold', halign: 'center' },
    alternateRowStyles: { fillColor: COLORS.rowOdd },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      1: { cellWidth: 'auto', fontStyle: 'bold' },
      2: { cellWidth: 35 },
      3: { halign: 'center', cellWidth: 30 },
      4: { halign: 'right', cellWidth: 30 },
      5: { halign: 'center', cellWidth: 28 },
      6: { cellWidth: 50, fontSize: 7.5 },
      7: { halign: 'center', cellWidth: 28 },
    },
    margin: { top: 46, left: 10, right: 10, bottom: 20 },
    didDrawPage: (data) => {
      if (data.pageNumber > 1) drawHeader(doc, 'Reporte de Pipeline', `${pipeline.length} oportunidades`, logoData, companyName, docNumber);
      drawFooter(doc, companyName, docNumber);
    },
    didParseCell: (data) => {
      if (data.section === 'body') {
        if (data.column.index === 3) {
          const etapaName = data.cell.raw;
          const stage = PIPELINE_STAGES.find(s => s.name === etapaName);
          if (stage && stageColorMap[stage.id]) {
            data.cell.styles.textColor = stageColorMap[stage.id];
            data.cell.styles.fontStyle = 'bold';
          }
        }
        if (data.column.index === 4 && data.cell.raw !== '—') {
          data.cell.styles.fontStyle = 'bold';
        }
      }
    },
  });

  doc.save(`pipeline_reporte_${docNumber}.pdf`);
};
