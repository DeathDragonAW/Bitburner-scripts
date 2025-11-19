/** Start right after gang has been created, needs around 30gb of RAM. Will take care of training, equipment and territory. Had no reason to implement wanted level reduction as the penalty goes close towards 0 over time anyway. Logs will show member assignments, ascensions and equipment purchases. */

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("sleep");
    ns.disableLog("gang.setMemberTask");
    ns.disableLog("gang.ascendMember");
    ns.disableLog("gang.purchaseEquipment");
    ns.disableLog("gang.setTerritoryWarfare");

    let MEMBER_AMOUNT = ns.gang.getMemberNames().length;
    const MEMBER_MAXIMUM = 12;
    let MEMBER_LIMIT = false;
    const TASK_TRAINING = `Train Combat`;
    const TASK_JOB = 'Human Trafficking';
    const TASK_CLASH = 'Territory Warfare';
    const STATS_COMBAT = ['str', 'def', 'dex', 'agi'];
    const ASCENSION_MINIMUM = 16 * 1024;
    const SLEEP_DURATION = 64;
    const TRAING_MULTIPLIER = 6;
    const EQUIPMENT_BUDGET = 0.01;
    const CLASH_MINIMUM_CHANCE = 0.9;
    let GANGS_STRONGER = null;

    function recruitMembers() {
        if (ns.gang.canRecruitMember()) {
            ns.gang.recruitMember(MEMBER_AMOUNT + 1);
            MEMBER_AMOUNT = ns.gang.getMemberNames().length;
        }
    }

    async function getAvgCombatTrnRatio(i) {
        const memberInfo = ns.gang.getMemberInformation(i);
        let combatAvgSum = 0;
        for (const c of STATS_COMBAT) {
            const combatStatExp = c + '_exp'
            const combatStatAscMulti = c + '_asc_mult'
            combatAvgSum += memberInfo[combatStatExp] / memberInfo[combatStatAscMulti];
            await ns.sleep(SLEEP_DURATION);
        }
        const combatAvg = combatAvgSum / STATS_COMBAT.length;
        await ns.sleep(SLEEP_DURATION);
        return combatAvg;
    }

    async function ascendGangMember(memberNo) {
        if (await getAvgCombatTrnRatio(memberNo) > ASCENSION_MINIMUM) {
            ns.gang.ascendMember(memberNo);
            ns.print(`Member #${memberNo} ascended!`)
        }
        // else { ns.print(`Member ${memberNo}: ⌀ combat train ratio: ${getAvgCombatTrnRatio(memberNo)}, required to ascend: >${ASCENSION_MINIMUM}`) }
        await ns.sleep(SLEEP_DURATION);
    }

    function trainMember(memberNo) {
        const currentTask = ns.gang.getMemberInformation(memberNo).task;
        ns.gang.setMemberTask(memberNo, TASK_TRAINING);
        if (currentTask !== TASK_TRAINING) { ns.print(`Member #${memberNo} assigned to ${TASK_TRAINING}!`) }
    }

    async function getAvgAscMultis(memberNo) {
        let ascMultis = 0;
        for (const c of STATS_COMBAT) {
            const memberInfo = ns.gang.getMemberInformation(memberNo);
            const combatStatAscMulti = c + '_asc_mult'
            ascMultis += memberInfo[combatStatAscMulti];
            await ns.sleep(SLEEP_DURATION);
        }
        const avgAscMultis = ascMultis / STATS_COMBAT.length;
        await ns.sleep(SLEEP_DURATION);
        return avgAscMultis;
    }

    function assignMemberJob(memberNo) {
        const currentTask = ns.gang.getMemberInformation(memberNo).task;
        ns.gang.setMemberTask(memberNo, TASK_JOB);
        if (currentTask !== TASK_JOB) { ns.print(`Member #${memberNo} assigned to ${TASK_JOB}!`) }
    }

    function assignMemberWar(memberNo) {
        const currentTask = ns.gang.getMemberInformation(memberNo).task;
        ns.gang.setMemberTask(memberNo, TASK_CLASH);
        if (currentTask !== TASK_CLASH) { ns.print(`Member #${memberNo} assigned to ${TASK_CLASH}!`) }
    }

    async function buyEquipment(memberNo) {
        const equipmentList = ns.gang.getEquipmentNames();
        const memberUpgradesList = ns.gang.getMemberInformation(memberNo).upgrades;
        const memberAugmentationsList = ns.gang.getMemberInformation(memberNo).augmentations;
        const memberEquipmentList = memberUpgradesList + memberAugmentationsList;
        let purchasedEquipmentAmount = 0;
        for (const equipment of equipmentList) {
            if (ns.gang.getEquipmentCost(equipment) < (ns.getPlayer().money * EQUIPMENT_BUDGET) &&
                !memberEquipmentList.includes(equipment)) {
                ns.gang.purchaseEquipment(memberNo, equipment);
                purchasedEquipmentAmount++;
            }
            await ns.sleep(SLEEP_DURATION);
        }
        if (purchasedEquipmentAmount > 1) { ns.print(`Member #${memberNo} equipped with ${purchasedEquipmentAmount} items!`); }
        await ns.sleep(SLEEP_DURATION);
    }

    function getOtherGangs() {
        let gangsJson = ns.gang.getOtherGangInformation();
        const ownGang = ns.gang.getGangInformation().faction;
        delete gangsJson[ownGang];
        return gangsJson;
    }

    async function setTerritoryWarfareGang() {
        ns.gang.setTerritoryWarfare(true);
    }

    async function getStrongerOtherGangs() {
        GANGS_STRONGER = 0;
        const gangs = getOtherGangs();
        for (const gang in gangs) {
            if (ns.gang.getChanceToWinClash(gang) < CLASH_MINIMUM_CHANCE) { GANGS_STRONGER++; }
            await ns.sleep(SLEEP_DURATION);
        }
        await ns.sleep(SLEEP_DURATION);
    }

    async function getOtherGangsTerritories() {
        let otherGangsTerritories = 0;
        const gangsJson = getOtherGangs();
        for (const gang in gangsJson) {
            otherGangsTerritories += ns.gang.getOtherGangInformation()[gang].territory;
            await ns.sleep(SLEEP_DURATION);
        }
        await ns.sleep(SLEEP_DURATION);
        return otherGangsTerritories;
    }

    async function memberTask(memberNo) {
        const otherGangsTerritories = await getOtherGangsTerritories();
        await getStrongerOtherGangs();
        if (await getAvgAscMultis(memberNo) < TRAING_MULTIPLIER * (0.5 + memberNo * 0.5)) {
            trainMember(memberNo);
            return;
        } else if (MEMBER_LIMIT && otherGangsTerritories > 0 && GANGS_STRONGER > 0) {
            assignMemberWar(memberNo);
        }
        else { assignMemberJob(memberNo); }
        await buyEquipment(memberNo);
        await ns.sleep(SLEEP_DURATION);
    }

    function declareWar() {
        if (GANGS_STRONGER === 0) ns.gang.setTerritoryWarfare(true);
    }

    /** Main loop */
    while (true) {
        if (MEMBER_AMOUNT < MEMBER_MAXIMUM) recruitMembers();
        else MEMBER_LIMIT = true;
        for (let memberNo = 1; memberNo <= MEMBER_AMOUNT; memberNo++) {
            await memberTask(memberNo);
            declareWar();
            await ascendGangMember(memberNo);
            await ns.sleep(SLEEP_DURATION);
        }
        await ns.sleep(SLEEP_DURATION);
    }
}