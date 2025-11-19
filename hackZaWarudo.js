/** Uses percentage of total RAM ('limitRam') and fills it with hack, grow and weaken scripts on available targets which fit the 'minServerMoney' requirement. */

/** @param {NS} ns */
export async function main(ns) {

    const threadsMultiplier = Math.floor(
        (ns.getServerMaxRam(ns.getHostname()) ^ 0.666) / (1024));
    const hackThreads = Math.max(1, 1 * threadsMultiplier);
    const growThreads = Math.max(10, 10 * threadsMultiplier);
    const weakenThreads = Math.max(2, 2 * threadsMultiplier);
    const limitRam = 0.95;
    //** TESTING RAM CALCULATION - WAS 16,000,000 FOR 256GB AND 290 HP */
    const minServerMoney = Math.min(512_000_000, (ns.getHackingLevel() / 2) * (1024 ^ 2));
    // const minServerMoney = 32000000;
    const hackingLevelPercentage = 0.75;

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
        // remove purchased servers dynamically
        const purchased = ns.getPurchasedServers();
        for (const p of purchased) scanned.delete(p);
        return [...scanned];
    }

    const servers = scanAll();

    for (let i = 0; (ns.getServerUsedRam(ns.getHostname()) / ns.getServerMaxRam(ns.getHostname())) < limitRam; ++i) {
        const serv = servers[i % servers.length];
        if (ns.getServerMaxMoney(String(serv)) >= minServerMoney &&
            ns.getServerRequiredHackingLevel(serv) <= (ns.getHackingLevel(serv) * hackingLevelPercentage) &&
            ns.hasRootAccess(serv)) {
            ns.run("zaWarudoHack.js", hackThreads, serv);
            ns.run("zaWarudoGrow.js", growThreads, serv);
            ns.run("zaWarudoWeaken.js", weakenThreads, serv);
        }
    }
}