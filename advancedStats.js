/** This is currently more of a construction site. */

/** @param {NS} ns **/
export async function main(ns) {
    // Config zone
    const SLEEP_TIME = 1024;
    const KARMA_GOAL = - 54_000;
    const AVERAGE_TIMES = 32;

    // Declaration of internal variables
    let AVERAGE_COUNT = 0;
    let KARMA_OLD = 0;
    let KARMA_NEW = 0;
    let GANG_SECONDS_LEFT = 0;
    let GANG_MINUTES_LEFT = 0;
    let GANG_HOURS_LEFT = 0;


    // Hook into game's overview
    const doc = document;
    const hook0 = doc.getElementById('overview-extra-hook-0');
    const hook1 = doc.getElementById('overview-extra-hook-1');

    // This does not work
    //const doc = eval("ns.bypass(document);");

    while (true) {
        try {
            const headers = []
            const values = [];

            let hacknetTotalProduction = 0;
            let hacknetTotalProfit = 0;

            // Calculate total hacknet income & profit
            for (let index = 0; index <= ns.hacknet.numNodes() - 1; index++) {
                hacknetTotalProduction += ns.hacknet.getNodeStats(index).production;
                hacknetTotalProfit += ns.hacknet.getNodeStats(index).totalProduction;

                //ns.tprint("production for " + index + " " + ns.hacknet.getNodeStats(index).production.toPrecision(5));
            }

            headers.push("Hacknet Income: ");
            values.push(ns.nFormat(hacknetTotalProduction.toPrecision(5), "$0.0a") + '/s');

            headers.push("Hacknet Profit: ");
            values.push(ns.nFormat(hacknetTotalProfit.toPrecision(5), "$0.0a"));

            headers.push("Script Income: ");
            values.push(ns.nFormat(ns.getTotalScriptIncome()[0].toPrecision(5), "$0.0a") + '/s');

            headers.push("Script EXP: ");
            values.push(ns.nFormat(ns.getTotalScriptExpGain().toPrecision(5), "0.00a") + '/s');

            headers.push("Share Power: ");
            values.push(((ns.getSharePower().toPrecision(2) * 100)).toFixed(2) + "%");

            headers.push("Karma goal: ");
            values.push(((ns.heart.break() / KARMA_GOAL) * 100).toFixed(2) + "%");


            if (AVERAGE_COUNT === 0) { KARMA_OLD = ns.heart.break(); }
            AVERAGE_COUNT++
            if (AVERAGE_COUNT === AVERAGE_TIMES) {
                KARMA_NEW = ns.heart.break();
                AVERAGE_COUNT = 0;
            }
            if (KARMA_OLD > KARMA_NEW) {
                const karmaProgressPerSec = (KARMA_NEW - KARMA_OLD) / (SLEEP_TIME * AVERAGE_TIMES / 1000);
                const karmaLeft = KARMA_GOAL - KARMA_NEW;
                GANG_SECONDS_LEFT = karmaLeft / karmaProgressPerSec;
                GANG_HOURS_LEFT = Math.floor(GANG_SECONDS_LEFT / 3600);
                GANG_MINUTES_LEFT = Math.floor((GANG_SECONDS_LEFT % 3600) / 60);
            }
            headers.push("Time till gang: ");
            if (GANG_SECONDS_LEFT > 0) { values.push("~" + GANG_HOURS_LEFT + "h" + GANG_MINUTES_LEFT + "m"); }
            else if (KARMA_NEW != 0) { values.push("READY!") }
            else { values.push("TBC") }

            // headers.push("People Killed: ");
            // values.push(ns.getPlayer().numPeopleKilled);

            // headers.push("City: ");
            // values.push(ns.getPlayer().city);

            // headers.push("Location: ");
            // values.push(ns.getPlayer().location.substring(0, 10));

            // headers.push("Local Time: ");
            // values.push(new Date().toLocaleTimeString());

            hook0.innerText = headers.join("\n");
            hook1.innerText = values.join("\n");

        } catch (error) { ns.print("ERROR: Update Skipped: " + String(error)); }

        await ns.sleep(SLEEP_TIME);
    }
}