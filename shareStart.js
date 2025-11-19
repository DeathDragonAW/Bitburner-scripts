/** Shares all currently available RAM on 'home' for bonus with factions. */

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("sleep");
    ns.disableLog("getServerUsedRam");
    ns.disableLog("getServerMaxRam");
    ns.disableLog("getScriptRam");
    ns.disableLog("ps");
    ns.disableLog("exec");

    /** args example: [scriptName = "threadedShare.js", ramResPercentage = 0.05, ramResGb = 8] */
    const script = ns.args[0] ? String(ns.args[0]) : "threadedShare.js";
    let ramResPercentage = ns.args[1] !== undefined ? Number(ns.args[1]) : 0.05;
    let ramResGb = ns.args[2] !== undefined ? Number(ns.args[2]) : 8;

    if (isNaN(ramResPercentage) || ramResPercentage <= 0 || ramResPercentage > 1) {
        ns.tprint(`Invalid ramResPercentage '${ns.args[1]}'; using default 0.05`);
        ramResPercentage = 0.05;
    }
    if (isNaN(ramResGb) || ramResGb < 0) {
        ns.tprint(`Invalid ramResGb '${ns.args[2]}'; using 8`);
        ramResGb = 8;
    }

    const server = ns.getHostname();
    if (!ns.fileExists(script, server)) {
        if (ns.fileExists(script, "home")) {
            ns.print(`${script} not on ${server}; copying from home...`);
            await ns.scp(script, server);
            if (!ns.fileExists(script, server)) {
                ns.tprint(`ERROR: failed to copy ${script} to ${server}. Aborting.`);
                return;
            }
        } else {
            ns.tprint(`ERROR: ${script} not found on ${server} or home. Aborting.`);
            return;
        }
    }
    const scriptRam = ns.getScriptRam(script);
    if (scriptRam <= 0) {
        ns.tprint(`ERROR: ${script} has invalid script RAM: ${scriptRam}. Aborting.`);
        return;
    }

    // kill any running instances of the script on this host (robust)
    const running = ns.ps(server).filter(p => p.filename === script);
    if (running.length) {
        ns.print(`Found ${running.length} running instance(s) of ${script}; killing...`);
        for (const p of running) {
            try {
                if (typeof ns.kill === "function") { ns.kill(p.pid); }
                else { ns.scriptKill(script, server); }
            }
            catch (e) { ns.print(`Warning: failed to kill pid ${p.pid} (${e}).`); }
        }
        await ns.sleep(150);
    }

    const maxRam = ns.getServerMaxRam(server);
    const usedRam = ns.getServerUsedRam(server);
    const freeRam = Math.max(0, maxRam - usedRam);

    /** Using the smaller value of reserved RAM, so that at least 5% but max 8GB are left unused on the server. */
    const ramReserved = Math.min((maxRam * ramResPercentage), ramResGb);

    const usableRam = Math.max(0, freeRam - ramReserved);
    const desiredThreads = Math.floor(usableRam / scriptRam);

    ns.print(`Host: ${server} — Max: ${maxRam}GB, Used: ${usedRam}GB, Free: ${freeRam}GB`);
    ns.print(`Script: ${script} uses ${scriptRam}GB; ramReserved=${ramReserved}`);
    ns.print(`Usable RAM: ${usableRam.toFixed(3)}GB -> desired threads: ${desiredThreads}`);

    if (desiredThreads < 1) {
        ns.print(`Not enough usable RAM to start a single thread of ${script}.`);
        return;
    }

    const pid = ns.exec(script, server, desiredThreads);
    if (!pid) {
        ns.print(`Failed to exec ${script} with ${desiredThreads} threads. Likely insufficient RAM or race condition.`);
        return;
    }

    ns.print(`Launched ${script} +${desiredThreads} threads (pid ${pid}).`);
}