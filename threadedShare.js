/** @param {NS} ns */
export async function main(ns) {
    while (true) {
        try { await ns.share(); }
        catch (e) {
            ns.print(`share() error: ${e}`);
            await ns.sleep(1000);
        }
        await ns.sleep(0);
    }
}