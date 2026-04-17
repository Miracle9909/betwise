/**
 * BetWise Daily Plan → DOCX Converter
 * Usage: node export-docx.js [date] 
 * Example: node export-docx.js 2026-04-17
 */

const fs = require('fs');
const path = require('path');
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
    WidthType, HeadingLevel, AlignmentType, BorderStyle,
    ShadingType, convertInchesToTwip } = require('docx');

const date = process.argv[2] || new Date().toISOString().slice(0, 10);
const mdFile = path.join(__dirname, `${date}.md`);
const docxFile = path.join(__dirname, `${date}.docx`);

if (!fs.existsSync(mdFile)) {
    console.error(`❌ File not found: ${mdFile}`);
    process.exit(1);
}

const md = fs.readFileSync(mdFile, 'utf-8');
const lines = md.split(/\r?\n/);

// Colors
const NAVY = '080C25';
const GREEN = '3FFF8B';
const WHITE = 'FFFFFF';
const GRAY = 'CCCCCC';
const LIGHT_BG = 'F0F4FF';

function createStyledRun(text, opts = {}) {
    return new TextRun({
        text,
        bold: opts.bold || false,
        size: opts.size || 22,
        font: 'Segoe UI',
        color: opts.color || '333333',
        ...opts,
    });
}

function parseTableRows(startIdx) {
    const rows = [];
    let i = startIdx;
    // Skip separator line (|---|---|...)
    while (i < lines.length && lines[i].trim().startsWith('|')) {
        const line = lines[i].trim();
        if (line.match(/^\|[\s-:|]+\|$/)) { i++; continue; }
        const cells = line.split('|').filter(c => c.trim() !== '').map(c => c.trim());
        if (cells.length > 0) rows.push(cells);
        i++;
    }
    return rows;
}

function createTable(tableRows) {
    if (tableRows.length === 0) return null;
    const isHeader = (idx) => idx === 0;

    return new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: tableRows.map((cells, rowIdx) =>
            new TableRow({
                children: cells.map(cell =>
                    new TableCell({
                        children: [new Paragraph({
                            children: [createStyledRun(cell.replace(/\*\*/g, ''), {
                                bold: isHeader(rowIdx) || cell.includes('**'),
                                size: 20,
                                color: isHeader(rowIdx) ? WHITE : '333333',
                            })],
                            spacing: { before: 40, after: 40 },
                        })],
                        shading: isHeader(rowIdx)
                            ? { type: ShadingType.SOLID, color: NAVY }
                            : rowIdx % 2 === 0
                                ? { type: ShadingType.SOLID, color: LIGHT_BG }
                                : undefined,
                        width: { size: Math.floor(100 / cells.length), type: WidthType.PERCENTAGE },
                    })
                ),
            })
        ),
    });
}

// Parse markdown into document sections
const children = [];
let i = 0;
let inCodeBlock = false;
let codeLines = [];

while (i < lines.length) {
    const line = lines[i];

    // Code blocks
    if (line.trim().startsWith('```')) {
        if (inCodeBlock) {
            children.push(new Paragraph({
                children: [createStyledRun(codeLines.join('\n'), {
                    font: 'Consolas', size: 18, color: '2D5016'
                })],
                shading: { type: ShadingType.SOLID, color: 'F5F5F0' },
                spacing: { before: 100, after: 100 },
            }));
            codeLines = [];
            inCodeBlock = false;
        } else {
            inCodeBlock = true;
        }
        i++;
        continue;
    }

    if (inCodeBlock) {
        codeLines.push(line);
        i++;
        continue;
    }

    // Tables
    if (line.trim().startsWith('|') && line.includes('|')) {
        const tableRows = parseTableRows(i);
        const table = createTable(tableRows);
        if (table) {
            children.push(table);
            children.push(new Paragraph({ spacing: { after: 120 } }));
        }
        while (i < lines.length && lines[i].trim().startsWith('|')) i++;
        continue;
    }

    // H1
    if (line.startsWith('# ')) {
        children.push(new Paragraph({
            children: [createStyledRun(line.replace(/^#+\s*/, '').replace(/[🎯]/g, '').trim(), {
                bold: true, size: 36, color: NAVY
            })],
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 200, after: 100 },
        }));
        i++;
        continue;
    }

    // H2  
    if (line.startsWith('## ')) {
        children.push(new Paragraph({
            children: [createStyledRun(line.replace(/^#+\s*/, '').trim(), {
                bold: true, size: 28, color: NAVY
            })],
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 200, after: 80 },
        }));
        i++;
        continue;
    }

    // H3
    if (line.startsWith('### ')) {
        children.push(new Paragraph({
            children: [createStyledRun(line.replace(/^#+\s*/, '').trim(), {
                bold: true, size: 24, color: '1a1a2e'
            })],
            heading: HeadingLevel.HEADING_3,
            spacing: { before: 150, after: 60 },
        }));
        i++;
        continue;
    }

    // Blockquote
    if (line.startsWith('>')) {
        const text = line.replace(/^>\s*/, '').replace(/\*\*/g, '');
        if (text.trim()) {
            children.push(new Paragraph({
                children: [createStyledRun(text.trim(), {
                    italics: true, size: 20, color: '555555'
                })],
                indent: { left: convertInchesToTwip(0.3) },
                spacing: { before: 60, after: 60 },
            }));
        }
        i++;
        continue;
    }

    // Horizontal rule
    if (line.trim() === '---') {
        children.push(new Paragraph({
            children: [createStyledRun('─'.repeat(60), { color: GRAY, size: 16 })],
            spacing: { before: 100, after: 100 },
        }));
        i++;
        continue;
    }

    // Empty line
    if (line.trim() === '') {
        i++;
        continue;
    }

    // Regular text
    const cleanText = line.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1');
    const isBold = line.includes('**');
    children.push(new Paragraph({
        children: [createStyledRun(cleanText.trim(), {
            bold: isBold, size: 20
        })],
        spacing: { before: 40, after: 40 },
    }));
    i++;
}

// Create document
const doc = new Document({
    styles: {
        default: {
            document: {
                run: { font: 'Segoe UI', size: 22 },
            },
        },
    },
    sections: [{
        properties: {
            page: {
                margin: {
                    top: convertInchesToTwip(0.7),
                    bottom: convertInchesToTwip(0.7),
                    left: convertInchesToTwip(0.8),
                    right: convertInchesToTwip(0.8),
                },
            },
        },
        children,
    }],
});

Packer.toBuffer(doc).then(buffer => {
    fs.writeFileSync(docxFile, buffer);
    console.log(`✅ Exported: ${docxFile}`);
    console.log(`   Size: ${(buffer.length / 1024).toFixed(1)} KB`);
}).catch(err => {
    console.error('❌ Error:', err.message);
});
