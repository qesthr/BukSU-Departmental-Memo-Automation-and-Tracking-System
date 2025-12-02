const path = require('path');

/**
 * Create layout helpers (header, footer, tables) for the report PDF.
 * Keeps all drawing/styling logic in one place.
 *
 * @param {PDFDocument} doc
 * @param {Object} options
 * @param {string} options.digitalSignature
 * @param {string} options.generatedDate
 * @param {string|Date} options.startDate
 * @param {string|Date} options.endDate
 */
function createReportLayout(doc, { digitalSignature, startDate, endDate }) {
    // Footer state
    let pageCount = 0;
    let totalPagesEstimate = 1; // Will be updated as pages are added
    const pagesWithFooter = new Set();
    const footerAreaHeight = 60; // Space reserved for footer at bottom of page

    /**
     * Add footer to the current page (document tracking + page number)
     */
    const addPageFooter = () => {
        let currentPageNum;
        try {
            const range = doc.bufferedPageRange();
            currentPageNum = range.start + range.count - 1;
            totalPagesEstimate = range.count;
        } catch {
            currentPageNum = pageCount;
        }

        if (!pagesWithFooter.has(currentPageNum)) {
            pageCount++;
            pagesWithFooter.add(currentPageNum);

            const footerY = doc.page.height - 50;
            const savedY = doc.y;
            const savedX = doc.x;

            // Separator line
            doc.moveTo(50, footerY - 5)
                .lineTo(doc.page.width - 50, footerY - 5)
                .strokeColor('#CCCCCC')
                .lineWidth(0.5)
                .stroke();

            // Left: digital signature
            doc.fontSize(8)
                .font('Helvetica')
                .fillColor('#666666')
                .text(`Document Tracking # ${digitalSignature}`, 50, footerY, {
                    width: (doc.page.width - 100) / 2,
                    align: 'left'
                });

            // Right: page X/Y (always show X/Y format)
            const pageText = `Page ${pageCount}/${totalPagesEstimate}`;
            doc.fillColor('#666666')
                .text(pageText, doc.page.width / 2, footerY, {
                    width: (doc.page.width - 100) / 2,
                    align: 'right'
                })
                .fillColor('black');

            doc.x = savedX;
            doc.y = savedY;
        }
    };

    /**
     * Simple table renderer with professional styling
     */
    const drawTable = ({ headers, rows, columnWidths, rowHeight = 24 }) => {
        if (!headers || !headers.length) {return;}
        const startX = 50;
        const maxTableWidth = doc.page.width - 100;
        const cols = headers.length;

        let widths = columnWidths && columnWidths.length === cols
            ? columnWidths.slice(0, cols)
            : Array(cols).fill(maxTableWidth / cols);

        const totalWidth = widths.reduce((a, b) => a + b, 0);
        if (totalWidth > maxTableWidth) {
            const scale = maxTableWidth / totalWidth;
            widths = widths.map(w => w * scale);
        }

        const ensureSpaceForRow = () => {
            if (doc.y + rowHeight > doc.page.height - footerAreaHeight) {
                // Add footer to current page before adding new page
                addPageFooter();
                doc.addPage();
                // Update total pages estimate after adding page
                try {
                    const range = doc.bufferedPageRange();
                    totalPagesEstimate = range.count;
                } catch {
                    totalPagesEstimate++;
                }
                // Reset Y position for new page (top margin)
                doc.y = 80;
            }
        };

        // Header row
        ensureSpaceForRow();
        let x = startX;
        doc.fontSize(10).font('Helvetica-Bold').fillColor('#111827');

        const headerTopY = doc.y;
        const headerBottomY = headerTopY + rowHeight;

        doc.save();
        doc.rect(startX, headerTopY, widths.reduce((a, b) => a + b, 0), rowHeight)
            .fill('#E5E7EB');
        doc.restore();

        doc.moveTo(startX, headerBottomY)
            .lineTo(startX + widths.reduce((a, b) => a + b, 0), headerBottomY)
            .strokeColor('#D1D5DB')
            .lineWidth(0.5)
            .stroke();

        headers.forEach((header, idx) => {
            const cellWidth = widths[idx];
            doc.text(String(header || ''), x + 4, headerTopY + 6, {
                width: cellWidth - 8,
                align: 'left'
            });
            x += cellWidth;
        });
        doc.y = headerBottomY;

        // Body rows
        doc.font('Helvetica').fontSize(10).fillColor('#111827');
        rows.forEach((row, rowIndex) => {
            ensureSpaceForRow();
            x = startX;
            const rowTopY = doc.y;
            const rowBottomY = rowTopY + rowHeight;

            if (rowIndex % 2 === 1) {
                doc.save();
                doc.rect(startX, rowTopY, widths.reduce((a, b) => a + b, 0), rowHeight)
                    .fill('#F9FAFB');
                doc.restore();
            }

            doc.moveTo(startX, rowBottomY)
                .lineTo(startX + widths.reduce((a, b) => a + b, 0), rowBottomY)
                .strokeColor('#E5E7EB')
                .lineWidth(0.5)
                .stroke();

            row.forEach((cell, idx) => {
                const cellWidth = widths[idx];
                doc.text(
                    cell !== undefined && cell !== null ? String(cell) : '',
                    x + 4,
                    rowTopY + 6,
                    {
                        width: cellWidth - 8,
                        align: 'left'
                    }
                );
                x += cellWidth;
            });
            doc.y = rowBottomY;
        });

        doc.moveDown(0.5);
    };

    /**
     * Render the report header (logo, title, report period)
     */
    const addHeader = () => {
        try {
            const memofyLogoPath = path.join(__dirname, '..', 'frontend', 'public', 'images', 'memofy-logo.png');

            // Smaller logo, higher placement, centered
            const logoWidth = 90;
            const logoX = (doc.page.width - logoWidth) / 2;
            doc.image(memofyLogoPath, logoX, 24, {
                fit: [logoWidth, 60],
                align: 'center'
            });

            doc.y = 95;
        } catch {
            doc.y = 80;
        }

        // Title - centered, bold, no underline, ~22pt
        doc.fontSize(22)
            .font('Helvetica-Bold')
            .text('Memofy Analytics Report', { align: 'center' })
            .moveDown(0.5);

        // Date range - smaller, muted gray, centered
        const formatDate = (value) => {
            const d = new Date(value);
            return d.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        };

        doc.fontSize(11)
            .font('Helvetica')
            .fillColor('#4B5563')
            .text(`Report Period: ${formatDate(startDate)} to ${formatDate(endDate)}`, { align: 'center' })
            .fillColor('black')
            .moveDown(0.75);

        // Divider line
        doc.moveTo(50, doc.y)
            .lineTo(doc.page.width - 50, doc.y)
            .strokeColor('#CCCCCC')
            .lineWidth(0.5)
            .stroke()
            .moveDown(1);
    };

    return {
        addHeader,
        addPageFooter,
        drawTable,
        footerAreaHeight
    };
}

module.exports = {
    createReportLayout
};
