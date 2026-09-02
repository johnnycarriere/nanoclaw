/**
 * FORK: OneCLI-in-Docker reachability on Linux hosts.
 *
 * On Linux, OneCLI itself runs in Docker (compose project `onecli`, network
 * `onecli_onecli`, service container `onecli-app-1`). Docker's DOCKER-USER
 * iptables chain commonly blocks container→docker0-bridge traffic, so the
 * gateway-injected proxy at `host.docker.internal:10255` times out from
 * inside an agent container. Joining the OneCLI compose network gives the
 * agent direct in-docker DNS to `onecli-app-1`, and the proxy env the
 * gateway contributes is rewritten to that hostname so proxy auth/DNS work.
 *
 * Two consumers, one decision:
 *   - `src/drivers/index.ts` (dockerNetworkArgs) adds `--network onecli_onecli`
 *   - `src/gateway-providers/onecli.ts` rewrites the contributed proxy env
 *
 * macOS uses host networking for OneCLI, so this is a Linux-only no-op there.
 * Pre-seam history: `onecliNetworkArgs` in container-runtime.ts + the argv
 * rewrite loop in container-runner.ts (commit 4b8e4fe6).
 */
import { execSync } from 'node:child_process';
import os from 'node:os';

export const ONECLI_DOCKER_NETWORK = 'onecli_onecli';
export const ONECLI_IN_NETWORK_HOST = 'onecli-app-1';
const HOST_GATEWAY_NAME = 'host.docker.internal';

/** True when this Linux Docker host has the OneCLI compose network. Checked per spawn (cheap, never cached). */
export function onecliDockerNetworkAvailable(): boolean {
  if (os.platform() !== 'linux') return false;
  try {
    execSync(`docker network inspect ${ONECLI_DOCKER_NETWORK}`, { stdio: 'pipe', timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Rewrite `host.docker.internal` → `onecli-app-1` in every contributed env
 * value (HTTPS_PROXY / HTTP_PROXY / lowercase twins). Pure; returns a new map.
 */
export function rewriteGatewayHostForOnecliNetwork(env: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    out[key] = value.includes(HOST_GATEWAY_NAME) ? value.split(HOST_GATEWAY_NAME).join(ONECLI_IN_NETWORK_HOST) : value;
  }
  return out;
}
