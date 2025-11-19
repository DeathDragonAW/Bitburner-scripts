/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("sleep");
    ns.disableLog("getServerMaxRam");
    ns.disableLog("getScriptRam");
    ns.disableLog("scp");
    ns.disableLog("exec");
    ns.disableLog("getHackingLevel");
    ns.disableLog("scan");
    ns.disableLog("getServerNumPortsRequired");
    ns.disableLog("getServerRequiredHackingLevel");
    ns.disableLog("getServerUsedRam");
    ns.disableLog("nuke");
    ns.ramOverride(8);

    const SCRIPT = "early-hack-template.js";
    const LOOP_SLEEP = 32 * 1024;
    const INTER_SERVER_SLEEP = 32;
    let HACK_ONLY = true;
    let [SKIP_LEVEL_COUNT, SKIP_PORT_COUNT, SKIP_HACKED_COUNT, SKIP_RAM_COUNT] = [0, 0, 0, 0];

    if (!ns.fileExists(SCRIPT, "home")) {
        ns.print(`ERROR: ${SCRIPT} not found on home. Place the script on home and re-run.`);
        return;
    }

    // Recursively scan network from home and return list (excluding home and purchased servers)
    function scanAll() {
        const scanned = new Set();
        const stack = ["home"];
        while (stack.length) {
            const current = stack.pop();
            if (scanned.has(current)) continue;
            scanned.add(current);
            const neighbor = ns.scan(current);
            for (const n of neighbor) { if (!scanned.has(n)) stack.push(n); }
        }
        scanned.delete("home");
        const purchased = ns.getPurchasedServers();
        for (const p of purchased) scanned.delete(p);
        return [...scanned];
    }

    // Detect which port openers you currently own (in canonical order)
    function getAvailableOpeners() {
        const tools = [];
        if (ns.fileExists("BruteSSH.exe", "home")) tools.push("brutessh");
        if (ns.fileExists("FTPCrack.exe", "home")) tools.push("ftpcrack");
        if (ns.fileExists("relaySMTP.exe", "home")) tools.push("relaysmtp");
        if (ns.fileExists("HTTPWorm.exe", "home")) tools.push("httpworm");
        if (ns.fileExists("SQLInject.exe", "home")) tools.push("sqlinject");
        return tools;
    }

    // Open exactly 'required' ports using available tool names
    function openPortsByReq(serv, required, tools) {
        if (required === 0) return true;
        if (tools.length < required) return false;
        for (let i = 0; i < required; i++) { ns[tools[i]](serv); }
        return true;
    }

    // Start the target script on the target server (if there's RAM and not already running)
    function startThreadedScript(serv) {
        const scriptRam = ns.getScriptRam(SCRIPT);
        const maxRam = ns.getServerMaxRam(serv);
        const usedRam = ns.getServerUsedRam(serv);
        const freeRam = Math.max(0, maxRam - usedRam);
        const threads = Math.floor(freeRam / scriptRam);
        if (threads < 1) {
            ns.print(`WARN: Not enough free RAM on ${serv} to run ${SCRIPT}: free ${freeRam}GB, need ${scriptRam}GB`);
            return;
        }

        // Pass the target server as the first arg so the worker knows what to attack
        const pid = ns.exec(SCRIPT, serv, threads, serv);
        if (!pid) { ns.print(`Failed to exec ${SCRIPT} on ${serv}. ns.exec returned ${pid}`); }
        else { ns.print(`Launched ${SCRIPT} on ${serv} (PID ${pid}) with ${threads} threads targeting ${serv}`); }
    }

    // Skip server if: hacking lvl too low, not enough port openers or script already running
    async function skipByReq(serv, required, tools) {
        const requiredLevel = ns.getServerRequiredHackingLevel(serv);
        if (ns.getHackingLevel() < requiredLevel) {
            SKIP_LEVEL_COUNT++;
            await ns.sleep(INTER_SERVER_SLEEP);
            return true;
        }
        else if (tools.length < required) {
            SKIP_PORT_COUNT++;
            await ns.sleep(INTER_SERVER_SLEEP);
            return true;
        }
        else if (ns.scriptRunning(SCRIPT, serv)) {
            SKIP_HACKED_COUNT++;
            await ns.sleep(INTER_SERVER_SLEEP);
            return true;
        }
        else if (ns.getServerMaxRam(serv) - ns.getServerUsedRam(serv) < ns.getScriptRam(SCRIPT)) {
            SKIP_RAM_COUNT++;
            return true;
        }
        return false;
    }

    // If root access to server is available, copy (if necessary) and start script
    async function copyAndStartScript(serv) {
        if (ns.hasRootAccess(serv)) {
            let needCopy = false;
            try {
                if (!ns.fileExists(SCRIPT, serv)) needCopy = true;
                else { if (ns.read(SCRIPT) !== ns.read(SCRIPT, serv)) needCopy = true; }
            }
            catch (e) { needCopy = true; }
            if (needCopy) {
                ns.scp(SCRIPT, serv);
                ns.print(`Copied ${SCRIPT} -> ${serv}`);
            }
            startThreadedScript(serv);
            await ns.sleep(INTER_SERVER_SLEEP);
            // continue;
        }
    }

    async function openPortsAndNuke(serv, required, tools) {
        const opened = openPortsByReq(serv, required, tools);
        if (!opened) {
            ns.print(`ERROR: Failed to open ports on ${serv}`);
            // continue;
        }
        else {
            try {
                ns.nuke(serv);
                ns.print(`INFO: Nuked ${serv}`);
            } catch (e) {
                ns.print(`ERROR: Nuke failed on ${serv}: ${e}`);
                // continue;
            }
        };
        await ns.sleep(INTER_SERVER_SLEEP);
    }

    function outputResetCounts() {
        if (SKIP_LEVEL_COUNT > 0) ns.print(`INFO: Skipped ${SKIP_LEVEL_COUNT} server(s) due to too low hacking level.`);
        if (SKIP_PORT_COUNT > 0) ns.print(`INFO: Skipped ${SKIP_PORT_COUNT} server(s) due to missing port openers.`);
        if (SKIP_RAM_COUNT > 0) ns.print(`INFO: Skipped ${SKIP_RAM_COUNT} server(s) due to server RAM being to small.`);
        if (SKIP_RAM_COUNT > 0) ns.print(`INFO: Iteration complete — scripts running on ${SKIP_HACKED_COUNT} server(s). Sleeping ${LOOP_SLEEP / 1000}s before next scan.`)
        SKIP_LEVEL_COUNT = 0;
        SKIP_PORT_COUNT = 0;
        SKIP_HACKED_COUNT = 0;
        SKIP_RAM_COUNT = 0;
    }

    while (true) {
        const discovered = scanAll();
        ns.print(`Scan found ${discovered.length} server(s), excl. 'home' and purchased servers...`);
        for (const serv of discovered) {
            try {
                const required = ns.getServerNumPortsRequired(serv);
                const tools = getAvailableOpeners();
                const skipping = await skipByReq(serv, required, tools);
                if (!skipping) {
                    await openPortsAndNuke(serv, required, tools);
                    if (!HACK_ONLY) await copyAndStartScript(serv);
                };
            }
            catch (err) { ns.print(`ERROR: Error while processing ${serv}: ${err}`); }
            await ns.sleep(INTER_SERVER_SLEEP);
        }
        HACK_ONLY = false;
        outputResetCounts();
        await ns.sleep(LOOP_SLEEP);
    }
}