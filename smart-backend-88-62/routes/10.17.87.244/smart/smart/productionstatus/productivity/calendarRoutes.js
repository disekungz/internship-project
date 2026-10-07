const express = require('express');
const router = express.Router();
const { pool_ot } = require('../../../../config');

// Helper function to format date string into YYYY-MM-DD
function parseDate(w_date) {
    if (w_date instanceof Date) {
        return w_date.toISOString().split('T')[0];
    }
    if (typeof w_date === 'string' && w_date.includes('/')) {
        const parts = w_date.split('/');
        if (parts.length === 3) {
            const [day, month, year] = parts;
            return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }
    }
    return w_date;
}

// GET /api_p1/production_status/productivity/calendar
// Fetch working day / holiday schedule from MariaDB ot.tbl_date
router.get('/', async (req, res) => {
    try {
        const raw = await pool_ot.query(`
            SELECT w_date, w_result 
            FROM tbl_date
        `);

        const calendarMap = {};
        const rows = Array.isArray(raw) ? raw : (raw[0] || []);
        rows.forEach(row => {
            const dateKey = parseDate(row.w_date);
            const isWorking = (row.w_result && String(row.w_result).trim().toLowerCase() === 'holiday') ? 0 : 1;
            if (dateKey) {
                calendarMap[dateKey] = isWorking;
            }
        });

        res.json(calendarMap);
    } catch (error) {
        console.error('Error fetching calendar data:', error.message);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

module.exports = router;
