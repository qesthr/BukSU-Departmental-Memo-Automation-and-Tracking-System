const PDFDocument = require('pdfkit');
const reportService = require('./reportService');

/**
 * Generate PDF report with all statistics and data
 */
async function generateReportPDF(startDate, endDate) {
    return new Promise((resolve, reject) => {
        (async () => {
            try {
                // Create PDF in landscape orientation
                const doc = new PDFDocument({
                    margin: 50,
                    size: [842, 595], // A4 landscape: width=842pt, height=595pt
                    layout: 'landscape'
                });
                const chunks = [];

                // Generate unique digital signature with current year and milliseconds
                const now = new Date();
                const year = now.getFullYear();
                const month = String(now.getMonth() + 1).padStart(2, '0');
                const day = String(now.getDate()).padStart(2, '0');
                const hours = String(now.getHours()).padStart(2, '0');
                const minutes = String(now.getMinutes()).padStart(2, '0');
                const seconds = String(now.getSeconds()).padStart(2, '0');
                const milliseconds = now.getMilliseconds().toString().padStart(3, '0');
                // Format: YYYYMMDDHHMMSS + milliseconds + / + identifier (last 2 digits of timestamp)
                // Example: 202511133827/11
                const digitalSignature = `${year}${month}${day}${hours}${minutes}${seconds}${milliseconds}/${String(Math.floor(now.getTime() % 100)).padStart(2, '0')}`;
                const generatedDate = now.toLocaleString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: true
                });

                // Track page count for footer
                let pageCount = 0;
                let totalPagesEstimate = 1; // Will be updated as pages are added
                const pagesWithFooter = new Set();

                const addPageFooter = () => {
                    // Get current page number using bufferedPageRange
                    let currentPageNum;
                    try {
                        const range = doc.bufferedPageRange();
                        currentPageNum = range.start + range.count - 1;
                        // Update total pages estimate based on buffered pages
                        totalPagesEstimate = range.count;
                    } catch (e) {
                        // Fallback: use pageCount
                        currentPageNum = pageCount;
                    }

                    // Only add footer if we haven't added it to this page yet
                    if (!pagesWithFooter.has(currentPageNum)) {
                        pageCount++;
                        pagesWithFooter.add(currentPageNum);

                        // Position footer inside the page margins (50pt margin)
                        const footerY = doc.page.height - 50; // 50pt from bottom (inside margin)
                        const savedY = doc.y;
                        const savedX = doc.x;

                        // Draw footer background line (inside margins)
                        doc.moveTo(50, footerY - 5)
                            .lineTo(doc.page.width - 50, footerY - 5)
                            .strokeColor('#CCCCCC')
                            .lineWidth(0.5)
                            .stroke();

                        // Left side: Digital Signature (inside left margin)
                        doc.fontSize(8)
                            .font('Helvetica')
                            .fillColor('#666666')
                            .text(
                                digitalSignature,
                                50,
                                footerY,
                                {
                                    width: (doc.page.width - 100) / 2,
                                    align: 'left'
                                }
                            );

                        // Right side: Page number (Page X/Y format, inside right margin)
                        // Use totalPagesEstimate if we have multiple pages
                        const pageText = totalPagesEstimate > 1 ? `Page ${pageCount}/${totalPagesEstimate}` : `Page ${pageCount}`;
                        doc.text(
                            pageText,
                            doc.page.width / 2,
                            footerY,
                            {
                                width: (doc.page.width - 100) / 2,
                                align: 'right'
                            }
                        )
                            .fillColor('black'); // Reset color

                        // Restore position
                        doc.x = savedX;
                        doc.y = savedY;
                    }
                };

                // Collect PDF data
                doc.on('data', chunk => chunks.push(chunk));
                doc.on('end', () => resolve(Buffer.concat(chunks)));
                doc.on('error', reject);

                // Fetch all statistics
                const [overallStats, memoStats, memosOverTime, memosByDept, userStats, recentActivity] = await Promise.all([
                    reportService.getOverallStats(),
                    reportService.getMemoStatsForDateRange(startDate, endDate),
                    reportService.getMemosOverTime(startDate, endDate),
                    reportService.getMemoStatsByDepartment(startDate, endDate),
                    reportService.getUserStats(),
                    reportService.getRecentActivity(20)
                ]);

                // Title
                doc.fontSize(24)
                    .font('Helvetica-Bold')
                    .text('Memofy Analytics Report', { align: 'center' })
                    .moveDown(0.5);

                // Date range
                doc.fontSize(12)
                    .font('Helvetica')
                    .text(`Report Period: ${formatDate(startDate)} to ${formatDate(endDate)}`, { align: 'center' })
                    .moveDown(0.5);

                // Document Tracking Section
                doc.fontSize(14)
                    .font('Helvetica-Bold')
                    .text('Document Tracking Information', { align: 'center', underline: true })
                    .moveDown(0.3);

                doc.fontSize(10)
                    .font('Helvetica')
                    .fillColor('#333333')
                    .text(`Report ID: ${digitalSignature}`, { align: 'center' })
                    .text(`Generated Date: ${generatedDate}`, { align: 'center' })
                    .text(`Report Period: ${formatDate(startDate)} to ${formatDate(endDate)}`, { align: 'center' })
                    .fillColor('black')
                    .moveDown(0.5);

                // Add a separator line
                doc.moveTo(50, doc.y)
                    .lineTo(doc.page.width - 50, doc.y)
                    .strokeColor('#CCCCCC')
                    .lineWidth(0.5)
                    .stroke()
                    .moveDown(1);

                // Add footer to first page
                addPageFooter();

                // Overall Statistics Section
                doc.fontSize(16)
                    .font('Helvetica-Bold')
                    .text('Overall Statistics', { underline: true })
                    .moveDown(0.5);

                doc.fontSize(11)
                    .font('Helvetica')
                    .text(`Total Memos: ${overallStats.totalMemos.toLocaleString()}`, { indent: 20 })
                    .text(`Total Users: ${overallStats.totalUsers.toLocaleString()}`, { indent: 20 })
                    .text(`Total Departments: ${overallStats.totalDepartments.toLocaleString()}`, { indent: 20 })
                    .text(`Total Calendar Events: ${overallStats.totalEvents.toLocaleString()}`, { indent: 20 })
                    .moveDown(1);

                // Memo Statistics Section
                doc.fontSize(16)
                    .font('Helvetica-Bold')
                    .text('Memo Statistics (Selected Period)', { underline: true })
                    .moveDown(0.5);

                doc.fontSize(11)
                    .font('Helvetica')
                    .text(`Total Memos: ${memoStats.total.toLocaleString()}`, { indent: 20 })
                    .text(`Sent: ${memoStats.sent.toLocaleString()}`, { indent: 20 })
                    .text(`Read: ${memoStats.read.toLocaleString()}`, { indent: 20 })
                    .text(`Pending: ${memoStats.pending.toLocaleString()}`, { indent: 20 })
                    .moveDown(0.5);

                // Memos by Priority
                if (memoStats.byPriority && memoStats.byPriority.length > 0) {
                    doc.fontSize(12)
                        .font('Helvetica-Bold')
                        .text('Memos by Priority:', { indent: 20 })
                        .moveDown(0.3);

                    doc.fontSize(10)
                        .font('Helvetica');

                    memoStats.byPriority.forEach(item => {
                        doc.text(`  ${item._id || 'Unknown'}: ${item.count.toLocaleString()}`, { indent: 30 });
                    });
                    doc.moveDown(0.5);
                }

                // Memos by Department
                if (memosByDept && memosByDept.length > 0) {
                    doc.fontSize(12)
                        .font('Helvetica-Bold')
                        .text('Top Departments by Memo Count:', { indent: 20 })
                        .moveDown(0.3);

                    doc.fontSize(10)
                        .font('Helvetica');

                    memosByDept.slice(0, 10).forEach((item, index) => {
                        doc.text(`  ${index + 1}. ${item._id || 'Admin'}: ${item.count.toLocaleString()} memos`, { indent: 30 });
                    });
                    doc.moveDown(1);
                }

                // User Statistics Section
                doc.fontSize(16)
                    .font('Helvetica-Bold')
                    .text('User Statistics', { underline: true })
                    .moveDown(0.5);

                if (userStats.byRole && userStats.byRole.length > 0) {
                    doc.fontSize(12)
                        .font('Helvetica-Bold')
                        .text('Users by Role:', { indent: 20 })
                        .moveDown(0.3);

                    doc.fontSize(10)
                        .font('Helvetica');

                    userStats.byRole.forEach(item => {
                        doc.text(`  ${item._id || 'Unknown'}: ${item.count.toLocaleString()} (${item.active.toLocaleString()} active)`, { indent: 30 });
                    });
                    doc.moveDown(0.5);
                }

                if (userStats.byDepartment && userStats.byDepartment.length > 0) {
                    doc.fontSize(12)
                        .font('Helvetica-Bold')
                        .text('Users by Department:', { indent: 20 })
                        .moveDown(0.3);

                    doc.fontSize(10)
                        .font('Helvetica');

                    userStats.byDepartment.slice(0, 10).forEach(item => {
                        doc.text(`  ${item._id || 'Unknown'}: ${item.count.toLocaleString()} users`, { indent: 30 });
                    });
                    doc.moveDown(1);
                }

                // Memos Over Time Summary
                if (memosOverTime && memosOverTime.length > 0) {
                    doc.fontSize(16)
                        .font('Helvetica-Bold')
                        .text('Memos Over Time Summary', { underline: true })
                        .moveDown(0.5);

                    doc.fontSize(10)
                        .font('Helvetica')
                        .text(`Total days with activity: ${memosOverTime.length}`, { indent: 20 })
                        .text(`Average memos per day: ${(memosOverTime.reduce((sum, item) => sum + item.count, 0) / memosOverTime.length).toFixed(1)}`, { indent: 20 })
                        .text(`Peak day: ${memosOverTime.reduce((max, item) => item.count > max.count ? item : max, memosOverTime[0])._id} (${memosOverTime.reduce((max, item) => item.count > max.count ? item : max, memosOverTime[0]).count} memos)`, { indent: 20 })
                        .moveDown(1);
                }

                // Recent Activity Section
                if (recentActivity && recentActivity.length > 0) {
                    doc.fontSize(16)
                        .font('Helvetica-Bold')
                        .text('Recent Activity', { underline: true })
                        .moveDown(0.5);

                    doc.fontSize(10)
                        .font('Helvetica');

                    recentActivity.slice(0, 15).forEach((activity, index) => {
                        const date = new Date(activity.date).toLocaleDateString();
                        const sender = activity.sender ? activity.sender.name : 'Unknown';
                        const recipient = activity.recipient ? activity.recipient.name : 'Unknown';
                        const status = activity.status || 'unknown';
                        const subject = activity.subject || 'No subject';

                        // Check if we need a new page (adjusted for landscape: height is 595pt)
                        // Reserve space for footer (50pt from bottom) + some padding
                        const footerAreaHeight = 60; // Space reserved for footer
                        if (doc.y > doc.page.height - footerAreaHeight) {
                            // Add footer to current page before adding new page
                            addPageFooter();
                            doc.addPage();
                            // Update total pages estimate
                            try {
                                const range = doc.bufferedPageRange();
                                totalPagesEstimate = range.count;
                            } catch (e) {
                                totalPagesEstimate++;
                            }
                        }

                        doc.text(`${index + 1}. ${date} - ${status.toUpperCase()}`, { indent: 20 })
                            .font('Helvetica-Oblique')
                            .text(`   Subject: ${subject}`, { indent: 30 })
                            .font('Helvetica')
                            .text(`   From: ${sender} → To: ${recipient}`, { indent: 30 })
                            .moveDown(0.3);
                    });
                    doc.moveDown(1);
                }

                // Ensure footer is added to the last page
                // At this point, totalPages should reflect the actual total
                addPageFooter();

                doc.end();
            } catch (error) {
                reject(error);
            }
        })();
    });
}

/**
 * Format date for display
 */
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

module.exports = {
    generateReportPDF
};

