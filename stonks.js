/** Script currently is 100% copy-paste from chatGPT, seems to work good and had no reason to dive into this rabbithole yet. */

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("sleep");
    ns.disableLog("getServerMoneyAvailable");

    // ===================== CONFIG =====================
    const LONG_IN = 0.58;
    const SHORT_IN = 0.42;
    const NEUTRAL_HI = 0.52;
    const NEUTRAL_LO = 0.48;

    const RISK_BUDGET = 0.60;
    const MAX_POS_PCT = 0.20;
    const CASH_BUFFER = 0.05;

    const FALLBACK_EMA_LEN = 6;
    const LOG_TRADES = true;

    // =================== COMPAT HELPERS ===================
    function getOwnedSourceFilesCompat() {
        // 1) top-level API (newer builds)
        try {
            if (typeof ns.getOwnedSourceFiles === "function") {
                return ns.getOwnedSourceFiles();
            }
        } catch (e) { /* ignore */ }

        // 2) singularity namespace (older builds)
        try {
            if (ns.singularity && typeof ns.singularity.getOwnedSourceFiles === "function") {
                return ns.singularity.getOwnedSourceFiles();
            }
        } catch (e) { /* ignore */ }

        // 3) fallback: inspect player object for possible fields (best-effort)
        try {
            const player = ns.getPlayer?.();
            if (player) {
                if (Array.isArray(player.sourceFiles)) return player.sourceFiles;
                if (Array.isArray(player.ownedSourceFiles)) return player.ownedSourceFiles;
                if (Array.isArray(player.ownedSF)) return player.ownedSF;
            }
        } catch (e) { /* ignore */ }

        // 4) nothing available on this build
        return [];
    }

    // safe accessor for an SF entry's number/level — various versions use slightly different shapes
    function sfNumber(sf) {
        if (!sf) return undefined;
        return sf.n ?? sf.id ?? sf.sf ?? sf[0];
    }
    function sfLevel(sf) {
        if (!sf) return 0;
        return sf.lvl ?? sf.level ?? sf[1] ?? 0;
    }

    // ================= CAPABILITY DETECTION (robust) =================
    // BN-8 check (always allow shorts in BN-8)
    const inBN8 = (ns.getPlayer?.()?.bitNodeN === 8);

    // Get owned SFs using compatibility wrapper
    const ownedSFs = getOwnedSourceFilesCompat(); // returns [] if none / API missing
    // find sf8 entry (if any)
    const sf8 = Array.isArray(ownedSFs) ? ownedSFs.find(x => sfNumber(x) === 8) : undefined;
    const sf8lvl = sfLevel(sf8);

    // SHORTS are allowed if BN8 or Source-File 8 level >= 2
    const SHORTS_OK = inBN8 || (sf8lvl >= 2);

    // ============== 4S / TIX detection (same as before) ==============
    const have4STix = !!(ns.stock?.has4SDataTIXAPI && ns.stock.has4SDataTIXAPI());
    const have4S = have4STix || !!(ns.stock?.has4SData && ns.stock.has4SData());
    const use4S = have4STix || have4S;

    if (!ns.stock?.hasWSEAccount?.() || !ns.stock?.hasTIXAPIAccess?.()) {
        ns.tprint("ERROR: WSE/TIX access required for this script.");
        return;
    }

    const syms = ns.stock.getSymbols();
    if (!syms || syms.length === 0) {
        ns.tprint("ERROR: No tradable symbols found.");
        return;
    }

    // EMA state
    const ema = Object.fromEntries(syms.map(s => [s, ns.stock.getPrice(s)]));

    // small helpers used later
    function getPositionSafe(sym) {
        const p = ns.stock.getPosition(sym);
        return {
            longS: Number(p?.[0] ?? 0),
            longAvg: Number(p?.[1] ?? 0),
            shortS: Number(p?.[2] ?? 0),
            shortAvg: Number(p?.[3] ?? 0),
        };
    }
    function calcEquity() {
        let cash = ns.getServerMoneyAvailable("home");
        let port = 0;
        for (const s of syms) {
            const { longS, shortS } = getPositionSafe(s);
            if (longS > 0) port += ns.stock.getSaleGain(s, longS, "Long");
            if (SHORTS_OK && shortS > 0) port += ns.stock.getSaleGain(s, shortS, "Short");
        }
        return cash + port;
    }
    function str4S(sym) {
        const f = ns.stock.getForecast(sym);
        const v = ns.stock.getVolatility(sym);
        const strength = (f - 0.5) * 2 * v;
        return { f, v, strength };
    }
    function strEMA(sym) {
        const price = ns.stock.getPrice(sym);
        const k = 2 / (FALLBACK_EMA_LEN + 1);
        ema[sym] = price * k + ema[sym] * (1 - k);
        const slope = (price - ema[sym]) / Math.max(1, ema[sym]);
        const f = 0.5 + 0.1 * Math.sign(slope);
        return { f, v: 0, strength: slope };
    }
    function logTrade(txt) { if (LOG_TRADES) ns.print(txt); }
    function sumAbs(arr) { return arr.reduce((a, x) => a + Math.abs(x || 0), 0); }
    function safeDiv(a, b) { return b === 0 ? 0 : a / b; }
    function fmt(n) { if (!isFinite(n)) return `${n}`; if (Math.abs(n) >= 1e12) return (n / 1e12).toFixed(2) + "T"; if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(2) + "B"; if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(2) + "M"; if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(2) + "k"; return n.toFixed(2); }
    function fmtShares(n) { return n >= 1e6 ? (n / 1e6).toFixed(2) + "M" : n >= 1e3 ? (n / 1e3).toFixed(2) + "k" : String(n); }

    ns.tprint(`Stonks bot started. Shorts ${SHORTS_OK ? "ENABLED" : "DISABLED"} | 4S ${use4S ? "ON" : "OFF (EMA fallback)"}`);

    while (true) {
        await ns.stock.nextUpdate();

        const snap = syms.map(s => {
            const ask = ns.stock.getAskPrice(s);
            const bid = ns.stock.getBidPrice(s);
            const { longS, shortS } = getPositionSafe(s);
            const sig = use4S ? str4S(s) : strEMA(s);
            return { s, ask, bid, longS, shortS, ...sig };
        });

        const longs = snap.filter(x => x.f >= LONG_IN).sort((a, b) => Math.abs(b.strength) - Math.abs(a.strength));
        const shorts = SHORTS_OK ? snap.filter(x => x.f <= SHORT_IN).sort((a, b) => Math.abs(b.strength) - Math.abs(a.strength)) : [];

        // EXITs
        for (const x of snap) {
            if (x.longS > 0 && x.f < NEUTRAL_HI) {
                const gain = ns.stock.getSaleGain(x.s, x.longS, "Long");
                if (ns.stock.sellStock(x.s, x.longS) > 0) logTrade(`EXIT LONG ${x.s} | f=${x.f.toFixed(3)} | proceeds=${fmt(gain)}`);
            }
            if (SHORTS_OK && x.shortS > 0 && x.f > NEUTRAL_LO) {
                const gain = ns.stock.getSaleGain(x.s, x.shortS, "Short");
                if (ns.stock.sellShort(x.s, x.shortS) > 0) logTrade(`EXIT SHORT ${x.s} | f=${x.f.toFixed(3)} | proceeds=${fmt(gain)}`);
            }
        }

        // ENTRIES
        const eq = calcEquity();
        const reserve = eq * CASH_BUFFER;
        const cashAvail = Math.max(0, ns.getServerMoneyAvailable("home") - reserve);
        const deployMax = eq * RISK_BUDGET;
        let cashToUse = Math.min(cashAvail, deployMax);

        const wLong = sumAbs(longs.map(x => x.strength));
        const wShort = sumAbs(shorts.map(x => x.strength));

        // Longs
        for (const x of longs) {
            if (cashToUse <= 0) break;
            const weight = safeDiv(Math.abs(x.strength), wLong);
            const capMoney = Math.min(MAX_POS_PCT * eq, cashToUse * weight);
            const price = x.ask;
            if (!(price > 0 && isFinite(price))) continue;
            const maxShares = ns.stock.getMaxShares(x.s);
            const { longS } = getPositionSafe(x.s);
            const targetShares = Math.min(maxShares, Math.floor(capMoney / price));
            const toBuy = Math.max(0, targetShares - longS);
            if (toBuy <= 0) continue;
            const cost = ns.stock.getPurchaseCost(x.s, toBuy, "Long");
            if (cost > cashToUse) continue;
            const filled = ns.stock.buyStock(x.s, toBuy);
            if (filled > 0) {
                cashToUse -= cost;
                logTrade(`ENTER LONG ${x.s} +${fmtShares(toBuy)} @~${fmt(price)} | f=${x.f.toFixed(3)} | cost=${fmt(cost)}`);
            }
        }

        // Shorts (guarded)
        if (SHORTS_OK) {
            for (const x of shorts) {
                if (cashToUse <= 0) break;
                const weight = safeDiv(Math.abs(x.strength), wShort);
                const capMoney = Math.min(MAX_POS_PCT * eq, cashToUse * weight);
                const price = x.bid;
                if (!(price > 0 && isFinite(price))) continue;
                const maxShares = ns.stock.getMaxShares(x.s);
                const { shortS } = getPositionSafe(x.s);
                const targetShares = Math.min(maxShares, Math.floor(capMoney / price));
                const toSellShort = Math.max(0, targetShares - shortS);
                if (toSellShort <= 0) continue;
                const cost = ns.stock.getPurchaseCost(x.s, toSellShort, "Short");
                if (cost > cashToUse) continue;
                const filled = ns.stock.buyShort(x.s, toSellShort);
                if (filled > 0) {
                    cashToUse -= cost;
                    logTrade(`ENTER SHORT ${x.s} +${fmtShares(toSellShort)} @~${fmt(price)} | f=${x.f.toFixed(3)} | cost=${fmt(cost)}`);
                }
            }
        }
    }
}