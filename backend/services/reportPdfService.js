const PDFDocument = require('pdfkit');
const reportService = require('./reportService');

/**
 * Generate PDF report with all statistics and data
 */
async function generateReportPDF(startDate, endDate) {
    return new Promise(async (resolve, reject) => {
        try {
            const doc = new PDFDocument({ margin: 50, size: 'A4' });
            const chunks = [];

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
                .moveDown(1);

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

                    // Check if we need a new page
                    if (doc.y > 700) {
                        doc.addPage();
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

            // Track pages and add footer to each page as it's created
            let pageCount = 1;
            const generatedDate = new Date().toLocaleString();

            // Add footer to first page
            doc.fontSize(8)
                .font('Helvetica')
                .text(
                    `Page ${pageCount} | Generated on ${generatedDate}`,
                    { align: 'center', y: doc.page.height - 30 }
                );

            // Add footer when new pages are added
            doc.on('pageAdded', () => {
                pageCount++;
                doc.fontSize(8)
                    .font('Helvetica')
                    .text(
                        `Page ${pageCount} | Generated on ${generatedDate}`,
                        { align: 'center', y: doc.page.height - 30 }
                    );
            });

            doc.end();
        } catch (error) {
            reject(error);
        }
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

