const ExcelJS = require('exceljs');
const supabase = require('../config/database');

/**
 * Fetch data for export based on type
 */
async function fetchExportData(type) {
  switch (type) {
    case 'users': {
      const { data, error } = await supabase
        .from('users')
        .select('id, full_name, display_name, company_name, mobile_number, email, civil_id, hear_about_us, is_verified, has_submitted_prediction, total_points, created_at')
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      return {
        columns: [
          { header: 'ID',            key: 'id',                      width: 38 },
          { header: 'Full Name',     key: 'full_name',               width: 25 },
          { header: 'Display Name',  key: 'display_name',            width: 22 },
          { header: 'Company',       key: 'company_name',            width: 22 },
          { header: 'Mobile',        key: 'mobile_number',           width: 18 },
          { header: 'Email',         key: 'email',                   width: 30 },
          { header: 'Civil ID',      key: 'civil_id',                width: 16 },
          { header: 'Heard Via',     key: 'hear_about_us',           width: 22 },
          { header: 'Verified',      key: 'is_verified',             width: 10 },
          { header: 'Submitted',     key: 'has_submitted_prediction', width: 12 },
          { header: 'Points',        key: 'total_points',            width: 10 },
          { header: 'Registered',    key: 'created_at',              width: 22 },
        ],
        rows: data || [],
        sheetName: 'Users',
      };
    }

    case 'predictions': {
      const { data, error } = await supabase
        .from('predictions')
        .select(`
          id,
          match_number,
          predicted_winner_team_id,
          predicted_home_score,
          predicted_away_score,
          is_locked,
          points_earned,
          user_id,
          users!inner(full_name, display_name, mobile_number)
        `)
        .order('match_number', { ascending: true });
      if (error) throw new Error(error.message);

      const rows = (data || []).map((p) => ({
        id: p.id,
        user_name: p.users?.full_name,
        user_display_name: p.users?.display_name,
        user_mobile: p.users?.mobile_number,
        match_number: p.match_number,
        predicted_winner_team_id: p.predicted_winner_team_id,
        predicted_home_score: p.predicted_home_score,
        predicted_away_score: p.predicted_away_score,
        is_locked: p.is_locked,
        points_earned: p.points_earned,
      }));

      return {
        columns: [
          { header: 'ID',                 key: 'id',                      width: 38 },
          { header: 'User',               key: 'user_name',               width: 25 },
          { header: 'Display Name',       key: 'user_display_name',       width: 20 },
          { header: 'Mobile',             key: 'user_mobile',             width: 18 },
          { header: 'Match #',            key: 'match_number',            width: 10 },
          { header: 'Predicted Winner ID',key: 'predicted_winner_team_id',width: 38 },
          { header: 'Home Score',         key: 'predicted_home_score',    width: 12 },
          { header: 'Away Score',         key: 'predicted_away_score',    width: 12 },
          { header: 'Locked',             key: 'is_locked',               width: 10 },
          { header: 'Points',             key: 'points_earned',           width: 10 },
        ],
        rows,
        sheetName: 'Predictions',
      };
    }

    case 'leaderboard': {
      const { data, error } = await supabase
        .from('leaderboard')
        .select('*')
        .order('rank', { ascending: true });
      if (error) throw new Error(error.message);
      return {
        columns: [
          { header: 'Rank',                key: 'rank',                  width: 8  },
          { header: 'Full Name',           key: 'full_name',             width: 25 },
          { header: 'Display Name',        key: 'display_name',          width: 22 },
          { header: 'Points',              key: 'total_points',          width: 10 },
          { header: 'Favorite Team',       key: 'favorite_team_name',    width: 20 },
          { header: 'Correct Predictions', key: 'correct_predictions',   width: 20 },
        ],
        rows: data || [],
        sheetName: 'Leaderboard',
      };
    }

    default:
      throw new Error(`Unknown export type: ${type}`);
  }
}

/**
 * Generate an XLSX file buffer
 */
async function generateXlsx(type) {
  const { columns, rows, sheetName } = await fetchExportData(type);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'WC2026 Predictor';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(sheetName);
  sheet.columns = columns;

  // Style header row
  sheet.getRow(1).font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1A1A2E' },
  };

  for (const row of rows) {
    sheet.addRow(row);
  }

  // Auto-filter
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: columns.length },
  };

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
}

/**
 * Generate a CSV string
 */
async function generateCsv(type) {
  const { columns, rows } = await fetchExportData(type);

  const escape = (val) => {
    if (val === null || val === undefined) return '';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const header = columns.map((c) => escape(c.header)).join(',');
  const body = rows
    .map((row) => columns.map((c) => escape(row[c.key])).join(','))
    .join('\n');

  return `${header}\n${body}`;
}

module.exports = {
  generateXlsx,
  generateCsv,
};
