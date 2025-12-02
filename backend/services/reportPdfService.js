const PDFDocument = require('pdfkit');
const reportService = require('./reportService');
const { createReportLayout } = require('./reportPdfLayout');

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
                    size: [842, 595], // A4 landscape
                    layout: 'landscape'
                });
                const chunks = [];

                // Generate unique digital signature
                const now = new Date();
                const year = now.getFullYear();
                const month = String(now.getMonth() + 1).padStart(2, '0');
                const day = String(now.getDate()).padStart(2, '0');
                const hours = String(now.getHours()).padStart(2, '0');
                const minutes = String(now.getMinutes()).padStart(2, '0');
                const seconds = String(now.getSeconds()).padStart(2, '0');
                const milliseconds = now.getMilliseconds().toString().padStart(3, '0');
                const digitalSignature = `${year}${month}${day}${hours}${minutes}${seconds}${milliseconds}/${String(Math.floor(now.getTime() % 100)).padStart(2, '0')}`;

                // Layout helpers (header, footer, tables)
                const { addHeader, addPageFooter, drawTable } = createReportLayout(doc, {
                    digitalSignature,
                    startDate,
                    endDate
                });

                // Note: Footer is added manually in ensureSpaceForRow() before adding new pages
                // and at the end, so we don't need the pageAdded event handler

                // Collect PDF data
                doc.on('data', chunk => chunks.push(chunk));
                doc.on('end', () => resolve(Buffer.concat(chunks)));
                doc.on('error', reject);

                // Fetch all statistics
                const [
                    overallStats,
                    ,
                    memosOverTime,
                    memosByDept,
                    ,
                    recentActivity
                ] = await Promise.all([
                    reportService.getOverallStats(),
                    reportService.getMemoStatsForDateRange(startDate, endDate),
                    reportService.getMemosOverTime(startDate, endDate),
                    reportService.getMemoStatsByDepartment(startDate, endDate),
                    reportService.getUserStats(),
                    reportService.getRecentActivity(20)
                ]);

                // Header
                addHeader();

                // === Overall Metrics (separate table) ===
                doc.fontSize(16)
                    .font('Helvetica-Bold')
                    .text('Overall Metrics', { underline: true, align: 'center' })
                    .moveDown(0.5);

                drawTable({
                    headers: ['Metric', 'Value'],
                    rows: [
                        ['Total Memos', overallStats.totalMemos.toLocaleString()],
                        ['Total Users', overallStats.totalUsers.toLocaleString()],
                        ['Total Departments', overallStats.totalDepartments.toLocaleString()],
                        ['Total Calendar Events', overallStats.totalEvents.toLocaleString()]
                    ],
                    columnWidths: [260, 180]
                });

                // === Top Departments by Memo Count (separate table) ===
                if (memosByDept && memosByDept.length > 0) {
                    doc.fontSize(16)
                        .font('Helvetica-Bold')
                        .text('Top Departments by Memo Count', { underline: true, align: 'center' })
                        .moveDown(0.5);

                    const deptRows = memosByDept.slice(0, 10).map((item, index) => [
                        index + 1,
                        item._id || 'Admin',
                        item.count.toLocaleString()
                    ]);

                    drawTable({
                        headers: ['Rank', 'Department', 'Memo Count'],
                        rows: deptRows,
                        columnWidths: [60, 280, 140]
                    });
                }

                // === Memos Over Time Summary (separate table) ===
                if (memosOverTime && memosOverTime.length > 0) {
                    doc.fontSize(16)
                        .font('Helvetica-Bold')
                        .text('Memos Over Time Summary', { underline: true, align: 'center' })
                        .moveDown(0.5);

                    const totalDays = memosOverTime.length;
                    const totalMemosOverTime = memosOverTime.reduce((sum, item) => sum + item.count, 0);
                    const avgPerDay = (totalMemosOverTime / totalDays).toFixed(1);
                    const peak = memosOverTime.reduce((max, item) => (item.count > max.count ? item : max), memosOverTime[0]);

                    const overTimeRows = [
                        ['Total days with activity', totalDays.toLocaleString()],
                        ['Average memos per day', avgPerDay],
                        ['Peak day', `${peak._id} (${peak.count.toLocaleString()} memos)`]
                    ];

                    drawTable({
                        headers: ['Metric', 'Value'],
                        rows: overTimeRows,
                        columnWidths: [260, 180]
                    });
                }

                // Recent Activity Section (table)
                if (recentActivity && recentActivity.length > 0) {
                    doc.fontSize(16)
                        .font('Helvetica-Bold')
                        .text('Recent Activity', { underline: true, align: 'center' })
                        .moveDown(0.5);

                    const activityRows = recentActivity.slice(0, 15).map((activity, index) => {
                        const date = new Date(activity.date).toLocaleDateString();
                        const sender = activity.sender ? activity.sender.name : 'Unknown';
                        const recipient = activity.recipient ? activity.recipient.name : 'Unknown';
                        const status = (activity.status || 'unknown').toUpperCase();
                        const subject = activity.subject || 'No subject';
                        return [
                            index + 1,
                            date,
                            status,
                            subject,
                            sender,
                            recipient
                        ];
                    });

                    drawTable({
                        headers: ['#', 'Date', 'Status', 'Subject', 'From', 'To'],
                        rows: activityRows,
                        columnWidths: [30, 80, 70, 260, 140, 140]
                    });
                }

                // Ensure footer is added to the last page
                addPageFooter();

                doc.end();
            } catch (error) {
                reject(error);
            }
        })();
    });
}

module.exports = {
    generateReportPDF
};
