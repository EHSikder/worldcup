// backend/src/cron/notificationCron.js
// ─────────────────────────────────────────────────────────────
//  Daily push-notification scheduler.
//
//  Logic:
//  - Runs every minute, checks if any match day needs a notification.
//  - Two triggers per day:
//      (A) Right after midnight (00:01–00:05 local time) — "day has started"
//          fast-fires if there are already matches today that haven't had a notif.
//      (B) Exactly 4 hours before the first match of the day.
//          e.g. first match at 18:00 → notification sent at 14:00.
//  - Stores sent state in `notification_log` table so it never double-sends.
// ─────────────────────────────────────────────────────────────

const cron = require('node-cron');
const supabase = require('../config/database');
const { sendDailyReminders } = require('../routes/notifications');

// Kuwait timezone offset = UTC+3
const KUWAIT_OFFSET_HOURS = 3;

function toKuwaitTime(date) {
  return new Date(date.getTime() + KUWAIT_OFFSET_HOURS * 60 * 60 * 1000);
}

async function wasAlreadySentToday(dayKey, triggerType) {
  const { data } = await supabase
    .from('notification_log')
    .select('id')
    .eq('day_key', dayKey)
    .eq('trigger_type', triggerType)
    .single();
  return !!data;
}

async function markSent(dayKey, triggerType, meta = {}) {
  await supabase.from('notification_log').insert({
    day_key: dayKey,
    trigger_type: triggerType,
    sent_at: new Date().toISOString(),
    meta: JSON.stringify(meta),
  });
}

async function checkAndSend() {
  try {
    const now = new Date();
    const kuwaitNow = toKuwaitTime(now);

    const kuwaitHour = kuwaitNow.getUTCHours();
    const kuwaitMinute = kuwaitNow.getUTCMinutes();

    // Today's date key in Kuwait time  e.g. "2026-06-15"
    const dayKey = kuwaitNow.toISOString().slice(0, 10);

    // ── Trigger A: midnight fast-fire (00:01–00:10 Kuwait) ──────
    if (kuwaitHour === 0 && kuwaitMinute >= 1 && kuwaitMinute <= 10) {
      const alreadySent = await wasAlreadySentToday(dayKey, 'midnight');
      if (!alreadySent) {
        // Find if there are any matches today
        const startOfDay = new Date(`${dayKey}T00:00:00+03:00`);
        const endOfDay = new Date(`${dayKey}T23:59:59+03:00`);

        const { data: todayMatches } = await supabase
          .from('matches')
          .select('match_number, kickoff_time')
          .in('status', ['scheduled', 'live'])
          .gte('kickoff_time', startOfDay.toISOString())
          .lte('kickoff_time', endOfDay.toISOString());

        if (todayMatches?.length) {
          console.log(`🔔 Midnight trigger: sending notifications for ${todayMatches.length} matches on ${dayKey}`);
          const result = await sendDailyReminders();
          await markSent(dayKey, 'midnight', result);
          console.log(`✅ Midnight notifications: sent=${result.sent}, skipped=${result.skipped}`);
        }
      }
      return;
    }

    // ── Trigger B: 4 hours before first match ──────────────────
    // Look at matches in the next 4h–4h10m window
    const fourHoursFromNow = new Date(now.getTime() + 4 * 60 * 60 * 1000);
    const fourHoursTenFromNow = new Date(now.getTime() + (4 * 60 + 10) * 60 * 1000);

    const { data: soonMatches } = await supabase
      .from('matches')
      .select('match_number, kickoff_time')
      .in('status', ['scheduled', 'live'])
      .gte('kickoff_time', fourHoursFromNow.toISOString())
      .lte('kickoff_time', fourHoursTenFromNow.toISOString())
      .order('kickoff_time', { ascending: true })
      .limit(1);

    if (!soonMatches?.length) return; // No match starting in ~4h

    const matchDay = toKuwaitTime(new Date(soonMatches[0].kickoff_time))
      .toISOString().slice(0, 10);

    const alreadySent = await wasAlreadySentToday(matchDay, 'four_hour');
    if (alreadySent) return;

    console.log(`🔔 4-hour trigger: first match at ${soonMatches[0].kickoff_time}, sending notifications now`);
    const result = await sendDailyReminders();
    await markSent(matchDay, 'four_hour', result);
    console.log(`✅ 4-hour notifications: sent=${result.sent}, skipped=${result.skipped}`);
  } catch (err) {
    console.error('❌ Notification cron error:', err.message);
  }
}

function startNotificationCron() {
  // Run every minute
  cron.schedule('* * * * *', checkAndSend);
  console.log('🔔 Notification cron scheduled (checking every minute)');
}

module.exports = { startNotificationCron };
