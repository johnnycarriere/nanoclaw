// Kid Browser Monitor — Chrome Extension Service Worker
// Periodically syncs browsing history to the collection server.

const KID_ID = "johnny3";
const API_KEY = "3b592b51d5fc36531d15c46153d6143ea6c8c4edc8ac7ec564084fd1c4ad909b";
const SERVER_URL = "http://192.168.86.65:9847/api/history";
const SYNC_INTERVAL_MIN = 30;

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get("lastSyncTime", (data) => {
    if (!data.lastSyncTime) {
      chrome.storage.local.set({ lastSyncTime: Date.now() });
    }
  });
  chrome.alarms.create("syncHistory", { periodInMinutes: SYNC_INTERVAL_MIN });
  console.log(`[KBM] Extension installed for ${KID_ID}. Syncing every ${SYNC_INTERVAL_MIN} min.`);
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "syncHistory") {
    syncHistory();
  }
});

async function syncHistory() {
  try {
    const data = await chrome.storage.local.get("lastSyncTime");
    const since = data.lastSyncTime || Date.now() - 30 * 60 * 1000;

    const results = await chrome.history.search({
      text: "",
      startTime: since,
      maxResults: 5000,
    });

    if (!results || results.length === 0) {
      console.log("[KBM] No new history entries.");
      return;
    }

    const entries = results.map((item) => ({
      url: item.url,
      title: item.title || "",
      lastVisitTime: item.lastVisitTime || 0,
    }));

    const response = await fetch(SERVER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kid: KID_ID,
        apiKey: API_KEY,
        entries: entries,
      }),
    });

    if (response.ok) {
      chrome.storage.local.set({ lastSyncTime: Date.now() });
      const result = await response.json();
      console.log(`[KBM] Synced ${result.inserted} entries.`);
    } else {
      console.warn(`[KBM] Server returned ${response.status}`);
    }
  } catch (err) {
    // Server unreachable (school firewall, etc.) — retry next cycle.
    // lastSyncTime stays unchanged so no data is lost.
    console.warn(`[KBM] Sync failed: ${err.message}`);
  }
}
