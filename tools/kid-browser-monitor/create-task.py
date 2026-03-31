#!/usr/bin/env python3
"""Insert the daily browser monitor task into the NanoClaw database."""

import sqlite3
import json
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

DB_PATH = "/home/jlc/nanoclaw/store/messages.db"
TASK_ID = "kid-browser-daily-report"

SCRIPT = '''#!/bin/bash
DB="/workspace/group/kid-browser-history.db"

if [ ! -f "$DB" ]; then
  echo '{"wakeAgent": true, "data": {"error": "Database not found", "entries": []}}'
  exit 0
fi

SINCE=$(python3 -c "import time; print(int((time.time() - 86400) * 1000))")

python3 -c "
import sqlite3, json

db = '/workspace/group/kid-browser-history.db'
since = $SINCE

conn = sqlite3.connect(db)
conn.row_factory = sqlite3.Row
rows = conn.execute(
    'SELECT kid, url, title, visit_time FROM history WHERE visit_time >= ? ORDER BY kid, visit_time',
    (since,)
).fetchall()

by_kid = {}
for r in rows:
    kid = r['kid']
    by_kid.setdefault(kid, []).append({
        'url': r['url'],
        'title': r['title'],
        'visit_time': r['visit_time']
    })

result = {
    'wakeAgent': True,
    'data': {
        'history_by_kid': by_kid,
        'total_entries': len(rows),
        'period': '24h',
        'kids_found': list(by_kid.keys())
    }
}
print(json.dumps(result))
"
'''

PROMPT = (
    "You are generating a daily browsing history report for a parent monitoring "
    "their kids' internet usage.\n\n"
    "Analyze the browsing history data provided by the script and create a clear, "
    "readable report.\n\n"
    "KIDS:\n"
    '- "johnny3" = Johnny Carriere III (oldest, Windows PC)\n'
    '- "sebastian" = Sebastian Carriere (youngest, Chromebook)\n\n'
    "ANALYSIS INSTRUCTIONS:\n"
    "1. For each kid, categorize sites visited:\n"
    "   - Educational (school sites, Khan Academy, research, educational YouTube)\n"
    "   - Social Media (Instagram, TikTok, Snapchat, Reddit, Twitter/X, etc.)\n"
    "   - Gaming (Roblox, Steam, Minecraft, game sites)\n"
    "   - Video/Entertainment (YouTube non-educational, Netflix, Twitch, etc.)\n"
    "   - Search (Google/Bing searches - note what they searched for from URLs)\n"
    "   - Communication (Gmail, Discord, messaging)\n"
    "   - FLAGGED/CONCERNING (adult content, violence, drugs, weapons, gambling, "
    "dating, dark web, anonymous browsing, VPN/proxy sites suggesting circumvention)\n\n"
    "2. For any FLAGGED items, explain WHY and include the URL.\n\n"
    "3. Include in the summary:\n"
    "   - Top 5 most-visited domains per kid\n"
    "   - Any patterns (late-night browsing, repetitive visits, concerning trends)\n"
    "   - Overall assessment per kid: All clear / Worth discussing / Needs attention\n\n"
    "4. Format the report nicely for messaging (use bold, line breaks, etc.)\n\n"
    "5. If no data was collected, note that the extension may need checking.\n\n"
    "DELIVERY - you MUST do BOTH of these:\n\n"
    "A) Send Johnny's copy to Telegram using the send_message tool:\n"
    "   Target: tg:1644976441\n\n"
    "B) Send Kelli's copy to WhatsApp via the WA Schedular API using Bash.\n"
    "   First login to get a session cookie, then schedule the message:\n\n"
    "   Step 1 - Login:\n"
    '   COOKIE=$(curl -s -c - -X POST http://45.56.77.135:8081/api/login '
    "-H 'Content-Type: application/json' "
    """-d '{"password":"johnny22"}' | grep connect.sid | awk '{print $NF}')\n\n"""
    "   Step 2 - Send (set sendAt to 1 minute from now in epoch milliseconds):\n"
    "   curl -s -X POST http://45.56.77.135:8081/api/scheduled "
    "-H 'Content-Type: application/json' "
    """-H \"Cookie: connect.sid=$COOKIE\" """
    """-d '{\"chatId\":\"220941808316484@lid\",\"chatName\":\"Kelli Carriere\","""
    """\"message\":\"REPORT_TEXT_HERE\",\"sendAt\":EPOCH_MS}'\n\n"""
    "   Replace REPORT_TEXT_HERE with the actual report text (escape quotes properly).\n"
    "   Replace EPOCH_MS with current time + 60000 (1 minute from now).\n\n"
    "IMPORTANT: Do NOT skip sending to either recipient. Both must receive the report."
)

def main():
    tz = ZoneInfo("America/Chicago")
    now = datetime.now(tz)
    next_8am = now.replace(hour=8, minute=0, second=0, microsecond=0)
    if next_8am <= now:
        next_8am += timedelta(days=1)

    conn = sqlite3.connect(DB_PATH)

    # Remove existing task if present
    existing = conn.execute(
        "SELECT id FROM scheduled_tasks WHERE id = ?", (TASK_ID,)
    ).fetchone()
    if existing:
        conn.execute("DELETE FROM scheduled_tasks WHERE id = ?", (TASK_ID,))
        print(f"Removed existing task: {TASK_ID}")

    conn.execute(
        "INSERT INTO scheduled_tasks "
        "(id, group_folder, chat_jid, prompt, script, schedule_type, "
        "schedule_value, context_mode, next_run, status, created_at) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (
            TASK_ID,
            "telegram_main",
            "tg:1644976441",
            PROMPT,
            SCRIPT,
            "cron",
            "0 8 * * *",
            "isolated",
            next_8am.isoformat(),
            "active",
            now.isoformat(),
        ),
    )
    conn.commit()
    conn.close()

    print(f"Task created: {TASK_ID}")
    print(f"Next run: {next_8am.isoformat()}")
    print(f"Schedule: 0 8 * * * (daily 8am Central)")

if __name__ == "__main__":
    main()
