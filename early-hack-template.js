/** @param {NS} ns */
export async function main(ns) {
    function getTarget() {
        if (0 <= ns.getHackingLevel() <= 50) {
            return 'foodnstuff';
        }
        if (50 <= ns.getHackingLevel() <= 100) {
            return 'harakiri-sushi';
        }
        if (ns.getHackingLevel() > 100) {
            return 'phantasy';
        }
    }

    const target = getTarget();
    const moneyThresh = ns.getServerMaxMoney(target);
    const securityThresh = ns.getServerMinSecurityLevel(target);

    while (true) {
        if (ns.getServerSecurityLevel(target) > securityThresh) {
            await ns.weaken(target);
        } else if (ns.getServerMoneyAvailable(target) < moneyThresh) {
            await ns.grow(target);
        } else {
            await ns.hack(target);
        }
    }
}