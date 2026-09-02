// Channel self-registration barrel.
// Each import triggers the channel module's registerChannelAdapter() call.
//
// Main ships with one default channel — `cli`, the always-on local-terminal
// channel. Other channel skills (/add-slack, /add-discord, /add-whatsapp,
// ...) copy their module from the `channels` branch and append a
// self-registration import below.

import './cli.js';
import './telegram.js';
// FORK-LOCAL modules below carry a trailing comment on purpose: the skill
// refresh (scripts/update-skills.ts) only treats bare `import './x.js';`
// lines as skill-managed channels, and neither of these has a registry skill.
import './telegram-fork.js'; // fork wrapper over ./telegram.js (see file header)
import './web.js'; // fork-local webchat channel (installed by /add-webchat, patched locally)
