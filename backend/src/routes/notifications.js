// backend/src/routes/notifications.js
// ─────────────────────────────────────────────────────────────
//  Push subscription storage + daily match-reminder sender.
//
//  Requires:  npm install web-push
//  Generate VAPID keys once:
//    node -e "const wp=require('web-push'); const k=wp.generateVAPIDKeys(); console.log(k)"
//  Then add to backend .env:
//    VAPID_PUBLIC_KEY=...
//    VAPID_PRIVATE_KEY=...
//    VAPID_EMAIL=mailto:you@example.com
//  And to frontend .env.local:
//    NEXT_PUBLIC_VAPID_PUBLIC_KEY=<same public key>
// ─────────────────────────────────────────────────────────────

const express = require('express');
const router = express.Router();
const webpush = require('web-push');
const supabase = require('../config/database');
const auth = require('../middleware/auth');

// Configure web-push with VAPID keys from env
webpush.setVapidDetails(
  process.env.VAPID_EMAIL || 'mailto:admin@wc2026.com',
  process.env.VAPID_PUBLIC_KEY || '',
  process.env.VAPID_PRIVATE_KEY || ''
);

// ── POST /api/notifications/subscribe ────────────────────────
// Save a push subscription for the authenticated user.
router.post('/subscribe', auth, async (req, res, next) => {
  try {
    const { subscription } = req.body;
    if (!subscription?.endpoint) {
      return res.status(400).json({ success: false, message: 'Invalid subscription object' });
    }

    // Upsert: one subscription per endpoint
    const { error } = await supabase
      .from('push_subscriptions')
      .upsert(
        {
          user_id: req.user.id,
          endpoint: subscription.endpoint,
          p256dh: subscription.keys?.p256dh,
          auth_key: subscription.keys?.auth,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'endpoint' }
      );

    if (error) {
      console.error('Push subscribe error:', error);
      return res.status(500).json({ success: false, message: 'Failed to save subscription' });
    }

    res.json({ success: true, message: 'Subscribed to push notifications' });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/notifications/unsubscribe ──────────────────────
// Remove a push subscription.
router.post('/unsubscribe', auth, async (req, res, next) => {
  try {
    const { endpoint } = req.body;
    if (!endpoint) return res.status(400).json({ success: false, message: 'Endpoint required' });

    await supabase
      .from('push_subscriptions')
      .delete()
      .eq('endpoint', endpoint)
      .eq('user_id', req.user.id);

    res.json({ success: true, message: 'Unsubscribed' });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/notifications/send-daily (admin / cron) ────────
//
//  Called by your cron scheduler (e.g. node-cron, Render cron, or a GitHub Action).
//  Logic:
//    1. Find all matches with a kickoff_time TODAY (or in the next 24 h if it's past midnight).
//    2. For each user who has a push subscription, find which of those matches they haven't
//       predicted yet (no row in `predictions` for that match_number).
//    3. Build one grouped notification per user listing those matches.
//    4. Send immediately if we're less than 4 hours before the FIRST match of the day;
//       otherwise the caller (cron) handles scheduling to fire at the right time.
//
//  Protect this endpoint with the admin token.
const adminAuth = require('../middleware/adminAuth');

router.post('/send-daily', adminAuth, async (req, res, next) => {
  try {
    const results = await sendDailyReminders();
    res.json({ success: true, ...results });
  } catch (err) {
    next(err);
  }
});

// ── Core send logic (also exported for cron use) ─────────────
async function sendDailyReminders() {
  const now = new Date();

  // Window: from now up to 32 hours ahead, snapped to today's matches
  const windowStart = now.toISOString();
  const windowEnd = new Date(now.getTime() + 32 * 60 * 60 * 1000).toISOString();

  // 1. Fetch today's / upcoming unpredicted matches
  const { data: todayMatches, error: matchErr } = await supabase
    .from('matches')
    .select('match_number, kickoff_time, home_placeholder, away_placeholder, home_team:home_team_id(name), away_team:away_team_id(name)')
    .in('status', ['scheduled', 'live'])
    .gte('kickoff_time', windowStart)
    .lte('kickoff_time', windowEnd)
    .order('kickoff_time', { ascending: true });

  if (matchErr || !todayMatches?.length) {
    return { sent: 0, skipped: 0, reason: 'No upcoming matches in window' };
  }

  // Group by calendar day (local UTC date string)
  const dayGroups = {};
  for (const m of todayMatches) {
    const day = m.kickoff_time.slice(0, 10); // "2026-06-15"
    (dayGroups[day] = dayGroups[day] || []).push(m);
  }

  // The soonest day that has matches
  const firstDay = Object.keys(dayGroups).sort()[0];
  const dayMatches = dayGroups[firstDay];
  const firstKickoff = new Date(dayMatches[0].kickoff_time);

  // How many hours until first match of the day?
  const hoursUntil = (firstKickoff - now) / (1000 * 60 * 60);

  // We only fire notifications if:
  //   (a) it's before 4 AM local time (day just started) — fire immediately
  //   (b) we're between 3 h 50 min and 4 h 10 min before first match — the "4-hour window"
  // The cron job should call this endpoint twice per day:
  //   - At 00:05 (catches any matches where today started at midnight)
  //   - At (firstKickoff - 4h), calculated before the day
  // This function sends regardless — the caller decides timing.

  const matchNumbers = dayMatches.map(m => m.match_number);

  // 2. Fetch all push subscriptions
  const { data: subs, error: subErr } = await supabase
    .from('push_subscriptions')
    .select('user_id, endpoint, p256dh, auth_key');

  if (subErr || !subs?.length) return { sent: 0, skipped: 0, reason: 'No subscriptions' };

  const userIds = [...new Set(subs.map(s => s.user_id))];

  // 3. Fetch existing predictions for these matches & these users (bulk)
  const { data: existingPreds } = await supabase
    .from('predictions')
    .select('user_id, match_number')
    .in('user_id', userIds)
    .in('match_number', matchNumbers);

  // Build a Set of "userId:matchNumber" that are already predicted
  const predictedSet = new Set((existingPreds || []).map(p => `${p.user_id}:${p.match_number}`));

  // 4. Send one notification per user, listing only their unpredicted matches
  let sent = 0;
  let skipped = 0;
  const staleEndpoints = [];

  for (const sub of subs) {
    const unpredicted = dayMatches.filter(
      m => !predictedSet.has(`${sub.user_id}:${m.match_number}`)
    );

    if (unpredicted.length === 0) {
      skipped++;
      continue;
    }

    const matchList = unpredicted.map(m => {
      const home = m.home_team?.name || m.home_placeholder || '?';
      const away = m.away_team?.name || m.away_placeholder || '?';
      const time = new Date(m.kickoff_time).toLocaleTimeString('en-US', {
        hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kuwait'
      });
      return `${home} vs ${away} (${time})`;
    });

    const count = unpredicted.length;
    const title = `⚽ ${count} match${count > 1 ? 'es' : ''} today — predict now!`;
    const body = matchList.join('\n');

    const pushPayload = JSON.stringify({
      title,
      body,
      url: '/predictions',
      matches: unpredicted.map(m => m.match_number),
    });

    const pushSub = {
      endpoint: sub.endpoint,
      keys: { p256dh: sub.p256dh, auth: sub.auth_key },
    };

    try {
      await webpush.sendNotification(pushSub, pushPayload);
      sent++;
    } catch (err) {
      // 410 Gone = subscription expired; clean it up
      if (err.statusCode === 410 || err.statusCode === 404) {
        staleEndpoints.push(sub.endpoint);
      }
      console.error('Push send error for', sub.endpoint, err.message);
    }
  }

  // Clean up stale subscriptions
  if (staleEndpoints.length) {
    await supabase.from('push_subscriptions').delete().in('endpoint', staleEndpoints);
  }

  return { sent, skipped, stale_removed: staleEndpoints.length, day: firstDay, matches: matchNumbers.length };
}

// ── GET /api/notifications/status ────────────────────────────
// Returns subscription count (for admin dashboard curiosity)
router.get('/status', adminAuth, async (req, res, next) => {
  try {
    const { count } = await supabase
      .from('push_subscriptions')
      .select('*', { count: 'exact', head: true });
    res.json({ success: true, subscription_count: count || 0 });
  } catch (err) {
    next(err);
  }
});

// POST /api/notifications/broadcast — send to all subscribers (admin only)
router.post('/broadcast', adminAuth, async (req, res, next) => {
  try {
    const { title = '⚽ WC2026', body = '', url = '/predictions' } = req.body;
    const result = await broadcastToAll({ title, body, url });
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
});

async function broadcastToAll({ title, body, url }) {
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth_key');

  if (!subs?.length) return { sent: 0 };

  const payload = JSON.stringify({ title, body, url });
  const stale = [];
  let sent = 0;

  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } },
        payload
      );
      sent++;
    } catch (err) {
      if (err.statusCode === 410 || err.statusCode === 404) stale.push(sub.endpoint);
    }
  }

  if (stale.length) {
    await supabase.from('push_subscriptions').delete().in('endpoint', stale);
  }

  return { sent, stale_removed: stale.length, total: subs.length };
}

module.exports = router;
module.exports.sendDailyReminders = sendDailyReminders;
