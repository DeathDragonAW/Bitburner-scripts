/** @param {NS} ns */
export async function main(ns) {


    /** Configurable global variables */
    const SLEEP_DURATION = 64 * 1024;
    const MIN_CHANCE = 0.999;
    const MIN_COUNT = 32;
    const MIN_RANGE = 0.05;
    const SAFE_OPERATIONS = ["Investigation", "Undercover Operation"]
    const SAFE_CONTRACTS = ns.bladeburner.getContractNames();


    /** Internal global variables */
    const SKILL_LIST = ns.bladeburner.getSkillNames();
    let NEXT_BLACK_OP = "";
    let DOABLE_OPERATION = "";
    let DOABLE_CONTRACT = "";


    /** General helper functions */
    function getActionChance(type, name) {
        const chanceRange = ns.bladeburner.getActionEstimatedSuccessChance(type, name);
        return Math.min(...chanceRange);
    }
    function getActionCount(type, name) {
        return ns.bladeburner.getActionCountRemaining(type, name);
    }
    function startAction(type, name) {
        let currentAction = "";
        if (ns.bladeburner.getCurrentAction() != null) {
            currentAction = ns.bladeburner.getCurrentAction().name;
        }
        if (name != currentAction) ns.bladeburner.startAction(type, name);
    }


    /** SKIPPING FOR NOW */
    function w0r1d_d43m0nHackable() {
        return false;
    }
    function hackW0r1d_d43m0n() {
        ns.singularity.destroyW0r1dD43m0n();
    }


    /** Upgrade all  once if there are enough skill points */
    function skillsUpgradable() {
        let skillpointsForRound = 0;
        SKILL_LIST.forEach((skill) =>
            skillpointsForRound += ns.bladeburner.getSkillUpgradeCost(skill)
        );
        if (ns.bladeburner.getSkillPoints() >= skillpointsForRound) return true;
        else ns.print('INFO: Waiting for more skill points.')
    }
    function upgradeSkills() {
        SKILL_LIST.forEach((skill) =>
            ns.bladeburner.upgradeSkill(skill)
        );
        ns.print('INFO: All skills upgraded once.')
    }


    /** SKIPPING FOR NOW */
    function betterCityAvailable() {
        return false;
    }
    function changeCity() {
        ns.bladeburner.switchCity();
    }


    /** Do next black operation if chance is high enough */
    function blackOpsDoable() {
        NEXT_BLACK_OP = ns.bladeburner.getNextBlackOp().name;
        if (getActionChance("Black Operations", NEXT_BLACK_OP) >= MIN_CHANCE) return true;
        else ns.print('INFO: Chance for next Black Op too low!');
    }
    function doBlackOps() {
        ns.bladeburner.startAction(
            "Black Operations",
            NEXT_BLACK_OP
        )
        ns.print(`INFO: Executing Black Operation "${NEXT_BLACK_OP}"`);
    }


    /** Do one of the specified operations if chance and count are high enough */
    function operationsDoable() {
        DOABLE_OPERATION = "";
        SAFE_OPERATIONS.forEach((operation) => {
            if (getActionCount("Operations", operation) >= MIN_COUNT &&
                getActionChance("Operations", operation) >= MIN_CHANCE) {
                DOABLE_OPERATION = operation;
                return;
            }
        })
        if (DOABLE_OPERATION != "") return true;
        else ns.print('INFO: Chance for Operations too low!')
    }
    function doOperations() {
        startAction("Operations", DOABLE_OPERATION);
        // ns.print(`INFO: Excecuting Operation "${DOABLE_OPERATION}"`);
    };


    /** Do one of the specified contracts if chance and count are high enough */
    function contractsDoable() {
        DOABLE_CONTRACT = "";
        SAFE_CONTRACTS.forEach((contract) => {
            if (getActionCount("Contracts", contract) >= MIN_COUNT &&
                getActionChance("Contracts", contract) >= MIN_CHANCE) {
                DOABLE_CONTRACT = contract;
                return;
            }
        })
        if (DOABLE_CONTRACT != "") return true;
        else ns.print('INFO: Chance for Contrats too low!')
    }
    function doContracts() {
        startAction("Contracts", DOABLE_CONTRACT);
    }


    /** Increase accuracy if estamination too low */
    function estimationLow() {
        const chanceRange = ns.bladeburner.getActionEstimatedSuccessChance("Contracts", SAFE_CONTRACTS[0]);
        const rangeDifference = Math.abs(chanceRange[0] - chanceRange[1]);
        if (rangeDifference > MIN_RANGE) return true;
        else ns.print('INFO: Populations estamination is accurate.')
    }
    function doFieldAnalysis() {
        startAction("General", "Field Analysis");
    }


    /** Start training as last resort, if all other requirements are not met */
    function doTraining() {
        startAction("General", "Training");
        ns.print('INFO: Falling back to training.')
    }


    /** Main repeating loop */
    while (true) {
        if (w0r1d_d43m0nHackable()) hackW0r1d_d43m0n();
        else if (skillsUpgradable()) upgradeSkills();
        else if (betterCityAvailable()) changeCity();
        else if (blackOpsDoable()) doBlackOps();
        else if (operationsDoable()) doOperations();
        else if (contractsDoable()) doContracts();
        else if (estimationLow()) doFieldAnalysis();
        else doTraining();
        await ns.sleep(SLEEP_DURATION);
    }
}