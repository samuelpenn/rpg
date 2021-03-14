/**
 * Automated Damage Tracking
 *
 * Designed to work with the Pathfinder character sheet for Roll20.
 *
 * Automatically tracks damage and hit points for a character, updating the
 * token with the current status. It also allows automated stabilisation
 * checks for creatures on negative hit points.
 *
 * Assumptions:
 *
 *   bar1 is hitpoints, both current hitpoints and maximum. It goes down as
 *        a character takes damage.
 *
 *   bar3 is nonlethal damage. It goes up as a character takes damage.
 *
 * Notes:
 *
 * Handles undead, constructs, swarms and other creatures which don't use
 * negative hit points. These are automatically 'killed' when hitpoints
 * reach zero. Creature types which ignore nonlethal damage are also handled
 * correctly.
 *
 * Macro Options:
 *
 * There are a number of chat commands that can be used as well.
 *
 * Automatic check to stabilise:
 *   !stabilise @{selected|token_id}
 *
 *   This will automate a constitution check against the current DC for the
 *   character to stabilise. On success, a green marker is placed on the
 *   token, and further attempts to stabilise are ignored. On failure, the
 *   token's hit points are reduced by 1.
 *
 * Heal:
 *   !heal
 *
 *   Heals all selected tokens up to maximum hitpoints, removes non-lethal
 *   damage and removes most status flags. Mostly used to reset tokens
 *   during testing, but might be useful in a game.
 *
 * Damage:
 *   !pfdmg <hitpoints> [nonlethal]
 *
 *   Does the indicated damage to all selected tokens. If the 'nonlethal'
 *   flag is set, then the damage is nonlethal.
 *
 * Saving Throws:
 *   !pfsaves <Fort|Ref|Will> <DC> [<damage> [<halfdamage>]] [<Effect>]
 *
 *   All selected tokens make a saving throw against the given DC. If
 *   no other parameters are supplied, those that fail have a flying-flag
 *   status symbol applied to them.
 *
 *   If damage or effect are specified, then damage and the effect is
 *   applied to those that failed, and half damage to those that succeeded.
 *
 *
 * The MIT License (MIT)
 *
 * Copyright (c) 2016, Samuel Penn, sam@glendale.org.uk
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */


var PfCombat = PfCombat || {};
PfCombat.VERSION = "2.2";

PfCombat.ROUND_MARKER = "==== Start of Round ====";

on("ready", function() {
    log(`==== PfCombat Version ${PfCombat.VERSION} ====`);

    PfInfo.addPlayerHelp("!pfcustominit", "Args: <b>status</b>, <b>[value]</b><br/>Set the status on the selected token.");
    PfInfo.addPlayerHelp("!pfdmg", "Args: <b>status</b>, <b>[value]</b><br/>Unset the status on the selected token.");
    PfInfo.addPlayerHelp("!pfstatus", "Displays the current hitpoint status for selected tokens.");
    PfInfo.addGmHelp("!pfstartcombat", "Args: <b>[Perception DC]</b><br/>Clears a new initiative tracker, and rolls "+
        "initiative for all selected tokens. If an argument is included, makes a Perception check for each token " +
        "against that DC to see if they are surprised or not. " +
        "If only one token is selected, then they gain surprise and take 20 on their initiative roll.");
    PfInfo.addGmHelp("!pfhere", "Moves all the players to the current page.");
});


/**
 * Single event handler for all chat messages.
 */
on("chat:message", function(msg) {
    if (msg.type !== "api") return;
    let args = msg.content.split(" ");
    let command = args.shift();
    let playerId = msg.playerid;


    if (command === "!pfheal") {
        PfCombat.healCommand(msg);
    } else if (command === "!pfinit") {
        PfCombat.initCommand(msg, args);
    } else if (command === "!pfsaves" || command == "!pfsave") {
        PfCombat.savesCommand(msg);
    } else if (command === "!pfdmg") {
        PfCombat.damageCommand(msg);
    } else if (command === "!pfstabilise") {
        PfCombat.stabiliseCommand(msg);
    } else if (command === "!pfstatus") {
        PfCombat.statusCommand(msg);
    } else if (command === "!pfhitpoints") {
        PfCombat.setHitPoints(msg, args);
    } else if (command === "!pfcustominit") {
        PfCombat.addCustomInitCommand(msg, args);
    } else if (command === "!pfstartcombat") {
        let tokens = PfInfo.getSelectedTokens(msg);
        if (!tokens || tokens.length === 0) {
            return;
        }
        let surprise = null;
        if (args.length > 0) {
            surprise = parseInt(args.shift());
        }
        PfCombat.startCombatCommand(playerId, tokens, surprise);
    } else if (command === "!pfaddtocombat") {
        let tokens = PfInfo.getSelectedTokens(msg);
        if (!tokens || tokens.length === 0) {
            return;
        }
        let surprise = null;
        if (args.length > 0) {
            surprise = parseInt(args.shift());
        }
        let skillCheck = "Perception";
        if (args.length > 0) {
            skillCheck = args.shift();
        }
        PfCombat.addToCombatCommand(playerId, tokens, surprise, skillCheck);
    } else if (command === "!pfleavecombat") {
        let tokens = PfInfo.getSelectedTokens(msg);
        if (!tokens || tokens.length === 0) {
            return;
        }
        PfCombat.leaveCombatCommand(tokens);
    } else if (command === "!pfinitflag") {
        PfCombat.flagInitiativeCommand(msg, args);
    } else if (command === "!pfundelay") {
        PfCombat.undelayCommand(msg);
    }
});

on("change:graphic", function(token, prev) {
    if (token.get("_pageid") === Campaign().get("playerpageid")) {
        let startTime = new Date().getTime();
        PfCombat.update(token, prev, "");
        let endTime = new Date().getTime();

        log(`PfCombat: Processed change event for [${token.get("name")}] in ${endTime - startTime}ms`);
    }
});

on("change:campaign:turnorder", function(obj, prev) {
    PfCombat.updateInitiative();
});


/**
 * Returns an array of all the tokens selected, or a list of all
 * controlled tokens if none are selected. List is returned as an
 * array of token ids.
 *
 * If forceExplicit is passed as true, then only allow a single
 * target unless they are explicity selected.
 */
PfCombat.getSelectedTokens = function (msg, forceExplicit) {
    let tokenList = [];
    if (!forceExplicit) {
        forceExplicit = false;
    }

    if (!msg) {
        return null;
    }

    if (msg.selected && msg.selected.length > 0) {
        for (let i=0; i < msg.selected.length; i++) {
            let token = getObj("graphic", msg.selected[i]._id);
            if (!token || !token.get("name")) {
                continue;
            }
            if (!token.get("represents")) {
                continue;
            }
            tokenList.push(msg.selected[i]._id);
        }
    } else if (!playerIsGM(msg.playerid)) {
        let currentObjects = findObjs({
            _pageid: Campaign().get("playerpageid"),
            _type: "graphic",
        });
        for (let i=0; i < currentObjects.length; i++) {
            let token = currentObjects[i];
            if (!token.get("name")) {
                continue;
            }
            let characterId = token.get("represents");
            if (characterId) {
                let character = getObj("character", characterId);
                if (!character) {
                    continue;
                }
                let controlledBy = character.get("controlledby");
                if (!controlledBy) {
                    continue;
                }
                // We only allow tokens that are explicitly controlled by this
                // player. Tokens controlled by "all" are never included. This is
                // to ignore tokens such as spell templates, torches etc.
                if (controlledBy.indexOf(msg.playerid) > -1) {
                    tokenList.push(token.get("_id"));
                }
            }
        }
        if (forceExplicit && tokenList.length !== 1) {
            log("PfCombat.getSelectedTokens: forceExplicit is set, and " + tokenList.length + " tokens found.");
            return null;
        }
    }

    return tokenList;
};

/**
 * A flag is a non-numerical suffix on the initiative number. It is a single character.
 * Passing null for the flag will clear any existing flag.
 *
 * @param tokenId   Token to find and set flag on.
 * @param flag      Flag to set.
 */
PfCombat.setInitiativeFlag = function(tokenId, flag) {
    let turnOrder = [];
    if (Campaign().get("turnorder") !== "") {
        turnOrder = JSON.parse(Campaign().get("turnorder"));
    }
    let token = null;

    for (let i=0; i < turnOrder.length; i++) {
        if (!tokenId || turnOrder[i].id == tokenId) {
            if (turnOrder[i].custom) {
                log(`setInitiativeFlag: Skip custom item ${i}.`);
                continue;
            }
            log(`setInitiativeFlag: Setting item ${i} to ${flag}.`);
            let item = turnOrder[i];
            let pr = "" + item.pr;
            if (!flag) {
                if (!pr.match(/.*[0-9]$/)) {
                    // Flag not set, so clear any flags if they exist.
                    item.pr = pr.substring(0, pr.length - 1);
                    turnOrder[i] = item;
                    Campaign().set("turnorder", JSON.stringify(turnOrder));
                    token = getObj("graphic", item.id);
                    break;
                }
            } else if (pr.match(/.*[0-9]$/)) {
                item.pr = pr + flag;
                turnOrder[i] = item;
                Campaign().set("turnorder", JSON.stringify(turnOrder));
                token = getObj("graphic", item.id);
            } else {
                item.pr = pr.substring(0, pr.length - 1) + flag;
                turnOrder[i] = item;
                Campaign().set("turnorder", JSON.stringify(turnOrder));
                token = getObj("graphic", item.id);
            }
            if (!tokenId) {
                break;
            }
        }
    }

    if (token) {
        if (!flag) {
            token.set("status_stopwatch", false);
            token.set("status_sentry-gun", false);
            token.set("status_frozen-orb", false);
            token.set("status_rolling-bomb", false);
            token.set("tint_color", "transparent");
        } else if (flag === "D") {
            let count = token.get("status_stopwatch");
            log("Stopwatch is " + count);
            count = parseInt(count) + 1;
            token.set("status_stopwatch", count);
            token.set("status_sentry-gun", false);
            token.set("status_frozen-orb", false);
            token.set("status_rolling-bomb", false);
            token.set("tint_color", "0000ff");
        } else if (flag === "R") {
            let count = token.get("status_sentry-gun");
            log("Stopwatch is " + count);
            count = parseInt(count) + 1;
            token.set("status_stopwatch", false);
            token.set("status_sentry-gun", true);
            token.set("status_frozen-orb", false);
            token.set("status_rolling-bomb", false);
            token.set("tint_color", "00ff00");
        }
    }
};


PfCombat.getInitiativeFlag = function(tokenId) {
    let turnOrder = [];
    if (Campaign().get("turnorder") !== "") {
        turnOrder = JSON.parse(Campaign().get("turnorder"));
    }

    for (let i=0; i < turnOrder.length; i++) {
        if (turnOrder[i].id == tokenId) {
            let item = turnOrder[i];
            let pr = "" + item.pr;
            if (!pr.match(/.*[0-9]$/)) {
                return pr.substring(pr.length - 1, 1);
            } else {
                return null;
            }
        }
    }
    return null;
};

PfCombat.updateInitiative = function() {
    log("updateInitiative:");

    // Grab the initiative tracker.
    let turnOrder = [];
    if (Campaign().get("turnorder") !== "") {
        turnOrder = JSON.parse(Campaign().get("turnorder"));
    }

    if (turnOrder.length < 1) {
        return;
    }
    let item = turnOrder[0];
    let pr = "" + item.pr;
    if (pr.indexOf("R") > -1) {
        item.pr = pr.substring(0, pr.length - 1);
        turnOrder[0] = item;
        Campaign().set("turnorder", JSON.stringify(turnOrder));
        let token = getObj("graphic", item.id);
        token.set('status_sentry-gun', false);
        token.set('tint_color', 'transparent');
    } else if (pr.indexOf("D") > -1) {
        let token = getObj("graphic", item.id);
        let count = token.get("status_stopwatch");
        if (isNaN(count)) {
            count = 0;
        }
        count = parseInt(count) + 1;
        if (count > 9) {
            count = 9;
        }
        token.set("status_stopwatch", count);
    }

    let tokenId = item.id;
    let text = "" + item.custom;

    if (text && text === PfCombat.ROUND_MARKER) {
        log(`    Starting round ${item.pr}`);
        PfInfo.message(null, `<b>Starting round ${item.pr}</b>`, null, null);
        if ("" + item.pr === "1") {
            // This is the start of the combat. No processing should be done at the
            // end of the list.
            return;
        }
    } else if (text && text.indexOf(":") > -1) {
        if ("" + item.pr === "0") {
            let effect = text.replace(/.*: /, "");
            let person = text.replace(/:.*/, "");
            PfInfo.message(null, `<i><b>${effect}</b></i> by <b>${person}</b> comes to an end.</b>`);
            turnOrder.splice(0, 1);
            Campaign().set("turnorder", JSON.stringify(turnOrder));
            PfCombat.updateInitiative();
            return;
        }
    } else if (tokenId !== -1) {
        let token = getObj("graphic", tokenId);
        if (token !== null) {
            log(`    Processing [${token.get("name")}].`);
            let owners = PfInfo.getOwners(token);
            if (owners && owners.length > 0) {
                for (let i=0; i < owners.length; i++) {
                    let message = `It is time for <b>${token.get("name")}</b> to act.`;
                    if (token.get("status_rolling-bomb")) {
                        message += " They are aware and can take a single move or standard action in the surprise round.";
                    } else if (token.get("status_frozen-orb")) {
                        message += " They are surprised and cannot act this round.";
                    }
                    PfInfo.whisperTo("GM", owners[i], message, null, null);
                    PfInfo.whisper(owners[i], message, null, null);
                }
            }

            if (!token.get("status_dead") && !token.get("status_broken-shield")) {
                let fastHealing = PfInfo.getAbility(token, "Fast Healing");
                let regeneration = PfInfo.getAbility(token, "Regeneration");

                if (regeneration > 0) {
                    PfInfo.message(token.get("name"), `They regenerate ${regeneration} hp this round.`);
                    PfCombat.heal(token, regeneration);
                } else if (fastHealing > 0) {
                    PfInfo.message(token.get("name"), `They fast heal ${fastHealing} hp this round.`);
                    PfCombat.heal(token, fastHealing);
                }
            } else if (token.get("status_broken-shield")) {
                token.set("status_broken-shield", false);
            }

            let hpCurrent = token.get("bar1_value");
            if (hpCurrent < 0 && !token.get("status_dead") && !token.get("status_green")) {
                PfCombat.stabilise(token);
            }

            if (!token.get("status_dead") && token.get("status_pink")) {
                let bleeding = 0 - parseInt(token.get("status_pink"));
                PfInfo.message(token.get("name"), `They bleed ${bleeding} hp this round.`);
                PfCombat.heal(token, bleeding);
            }

            if (token.get("status_dead")) {
                // Remove token from the initiative list.
                log(`    Token [${token.get("name")}] is dead, removing from initiative track.`);
                turnOrder.splice(0, 1);
                Campaign().set("turnorder", JSON.stringify(turnOrder));
                PfCombat.updateInitiative();
                return;
            } else if (token.get("status_frozen-orb")) {
                log(`    Token [${token.get("name")}] is surprised and cannot act.`);
                PfInfo.whisper(token.get("name"), `<b>${token.get("name")} is surprised and can't act.`);
                toFront(token);
                /*
                let flags = [];
                flags[ 'status_frozen-orb' ] = false;
                flags['tint_color'] = 'transparent';
                token.set(flags);
                if (!(""+item.pr).match(/.*[0-9]$/)) {
                    item.pr = item.pr.substring(item.pr.length - 1, 1);
                }
                turnOrder.splice(0, 1);
                turnOrder.push(item);
                Campaign().set("turnorder", JSON.stringify(turnOrder));
                PfCombat.updateInitiative();
                return;
                */
            } else if (token.get("status_tread")) {
                log(`    Token [${token.get("name")}] is no longer flat footed.`);
                toFront(token);
                token.set("status_tread", false);
                if (token.get("layer") === "objects") {
                    sendPing(token.get("left"), token.get("top"), Campaign().get("playerpageid"), null, null);
                }
            } else {
                log(`    Token [${token.get("name")}] is ready to act normally.`);
                toFront(token);
                if (token.get("layer") === "objects") {
                    sendPing(token.get("left"), token.get("top"), Campaign().get("playerpageid"), null, null);
                }
            }
        }
    }

    item = turnOrder[turnOrder.length - 1];
    if (!item.custom) {
        pr = "" + item.pr;
        let token = item.id?getObj("graphic", item.id):null;
        if (token) {
            if (token.get("status_rolling-bomb") || token.get("status_frozen-orb")) {
                token.set("status_rolling-bomb", false);
                token.set("status_frozen-orb", false);
                token.set("tint_color", "transparent");
                log(`    Removing surprise status for [${token.get("name")}] at end of list.`);
            }
        }
        if (pr.indexOf("*") > -1 || pr.indexOf("!") > -1 || pr.indexOf("½") > -1) {
            item.pr = pr.substring(0, pr.length - 1);
            turnOrder[turnOrder.length - 1] = item;
            Campaign().set("turnorder", JSON.stringify(turnOrder));
        }
    }
};

PfCombat.undelayCommand = function(msg) {
    let tokenList = PfInfo.getSelectedTokens(msg);
    if (!tokenList || tokenList.length === 0) {
        return;
    }

    // Grab the initiative tracker.
    let turnOrder = [];
    if (Campaign().get("turnorder") !== "") {
        turnOrder = JSON.parse(Campaign().get("turnorder"));
    }

    let currentInit = null;
    // Need to pull all affected tokens out in initiative order.
    let inits = [];
    for (let i=0; i < tokenList.length; i++) {
        let token = tokenList[i];
        for (let j=0; j < turnOrder.length; j++) {
            if (turnOrder[j].custom) {
                continue;
            }
            if (currentInit === null) {
                currentInit = ("" + turnOrder[j].pr).replace(/[^-0-9.]*/g, "");
            }
            if (token.get("_id") == turnOrder[j].id) {
                token.set("status_stopwatch", false);
                token.set("status_sentry-gun", false);
                token.set("tint_color", "transparent");
                log(turnOrder[j].pr);
                inits.push(turnOrder[j]);
                turnOrder.splice(j, 1);
                break;
            }
        }
    }
    inits.sort(function(a, b) {
        let apr = ("" + a.pr).replace(/[^-0-9.]*/g, "");
        let bpr = ("" + b.pr).replace(/[^-0-9.]*/g, "");
        return parseInt(bpr) - parseInt(apr);
    });

    for (let i=0; i < inits.length; i++) {
        if (("" + inits[i].pr).indexOf("R") > -1) {
            log(`Adding ${i} as R`);
            inits[i].pr = currentInit;
            turnOrder.splice(0, 0, inits[i]);
        } else {
            log(`Adding ${i} as D`);
            inits[i].pr = currentInit;
            turnOrder.splice(1, 0, inits[i]);
        }
    }
    Campaign().set("turnorder", JSON.stringify(turnOrder));


};

/**
 * Set or unset flag on selected tokens. If first arg is "current", then the selected
 * tokens are ignored, and the first item on the initiative tracker is used. The next
 * argument is the flag to set, or no argument to unset any existing flag.
 *
 * @param msg
 * @param args
 */
PfCombat.flagInitiativeCommand = function(msg, args) {
    let tokenList = PfInfo.getSelectedTokens(msg);
    if (tokenList && tokenList.length === 0) {
        tokenList = null;
    }
    let flag = args.shift();
    if (flag === "current") {
        tokenList = null;
        flag = args.shift();
    } else if (flag) {
        flag = flag.substring(0, 1);
    }

    PfCombat.flagInitiative(tokenList, flag);
};

PfCombat.flagInitiative = function(tokenList, flag) {
    // Grab the initiative tracker.
    let turnOrder = [];
    if (Campaign().get("turnorder") !== "") {
        turnOrder = JSON.parse(Campaign().get("turnorder"));
    }

    if (tokenList) {
        log("flagInitiativeCommand: Updating list of tokens.");
        for (let i = 0; i < tokenList.length; i++) {
            let token = tokenList[i];

            PfCombat.setInitiativeFlag(token.get("_id"), flag);
        }
    } else {
        log("flagInitiativeCommand: Updating current token.");
        PfCombat.setInitiativeFlag(null, flag);
    }
};

/**
 * Start a new combat, at round one. Any existing initiative tracker is cleared. All selected tokens are
 * added to the combat, their initiative determined and then sorted in order. Everyone who doesn't have
 * an ability to prevent it will be added as Flat Footed.
 *
 * @param msg
 */
PfCombat.startCombatCommand = function(playerId, tokenList, surprise) {
    // Create a new initiative tracker.
    let turnOrder = [];
    turnOrder.push({
        "id": "-1",
        "pr": 1,
        "custom": PfCombat.ROUND_MARKER,
        "formula": +1,
    });

    let take20 = (tokenList.length == 1);

    let inits = PfCombat.getInitiatives(tokenList, null, take20);

    for (let i=0; i < inits.length; i++) {
        if (surprise != null) {
            let token = getObj("graphic", inits[i].id);
            let surprised = PfCombat.workOutSurprise(playerId, token, surprise);
            if (surprised) {
                inits[i].pr = "" + inits[i].pr + "!";
            } else {
                inits[i].pr = "" + inits[i].pr + "½";
            }
        }
        turnOrder.push(inits[i]);
    };
    Campaign().set("turnorder", JSON.stringify(turnOrder));

    PfInfo.message(null, `<b>Starting round 1</b>`, null, null);
};

PfCombat.leaveCombatCommand = function(tokenList) {
    let turnOrder = [];
    if (Campaign().get("turnorder") !== "") {
        turnOrder = JSON.parse(Campaign().get("turnorder"));
    }

    for (let i=0; i < tokenList.length; i++) {
        let token = tokenList[i];

        let flags = [];
        flags['status_rolling-bomb'] = false;
        flags['status_frozen-orb'] = false;
        flags['status_tread'] = false;
        flags['status_stopwatch'] = false;
        flags['status_sentry-gun'] = false;
        flags['tint_color'] = 'transparent';
        token.set(flags);

        for (let j=0; j < turnOrder.length; j++) {
            if (turnOrder[j].id === token.get("_id")) {
                turnOrder.splice(j, 1);
                break;
            }
        }
    }
    Campaign().set("turnorder", JSON.stringify(turnOrder));
};

PfCombat.getInitiatives = function(tokenList, existingOrder = null, take20 = false) {
    let inits = [];
    log("getInitiatives:");
    for (let i=0; i < tokenList.length; i++) {
        let token = tokenList[i];

        if (token.get("name") === "Light") {
            // Light sources can be ignored.
            continue;
        }

        // Don't add tokens already on the initiative.
        let exists = false;
        for (let j = 0; existingOrder && j < existingOrder.length; j++) {
            if (existingOrder[j].id && existingOrder[j].id == token.get("_id")) {
                exists = true;
                break;
            }
        }
        if (exists) {
            continue;
        }
        let character_id = token.get("represents");
        if (!character_id) {
            continue;
        }
        let character = getObj("character", character_id);
        let isHaunt = false;
        let type = ("" + getAttrByName(character_id, 'npc-type')).toLowerCase();
        log("For token " + token.get("name") + " type is " + type);
        if (type.indexOf("haunt") > -1) {
            isHaunt = true;
        }

        let flags = [];
        if (isHaunt) {
            flags['status_rolling-bomb'] = true;
            flags['status_stopwatch'] = false;
            flags['status_sentry-gun'] = false;
            flags['status_frozen-orb'] = false;
            token.set(flags);
            token.set('tint_color', 'ff0000');
        } else {
            if (!PfInfo.hasAbility(token, "Uncanny Dodge")) {
                flags['status_tread'] = true;
            }
            flags['status_stopwatch'] = false;
            flags['status_sentry-gun'] = false;
            flags['status_rolling-bomb'] = take20;
            flags['status_frozen-orb'] = false;
            token.set(flags);
            token.set('tint_color', take20 ? 'ff0000' : 'transparent');
        }

        let initiative = 0;

        if (isHaunt) {
            // Haunts always go on initiative 10, and always have surprise.
            initiative = 10;
            let message = `<b>${character.get("name")}</b> has surprise with <b>10</b>`;
            for (let i=1; i <= 10; i++) {
                let n = getAttrByName(character.id, `customn${i}-name`);
                if (n && n === "Haunt") {
                    let notice = "" + getAttrByName(character.id, `customn${i}`);
                    message += `<br>${notice}`;
                }
            }
            PfInfo.message("Initiative for Haunt", message);
        } else {
            let init = getAttrByName(character_id, "init");
            let dex = getAttrByName(character_id, "DEX-base");
            // Avoid dividing by 100, since this sometimes gives arithmetic
            // errors with too many dp.
            if (parseInt(dex) < 10) {
                dex = ("0" + dex);
            }
            let roll = (take20 ? 20 : randomInteger(20));
            initiative = roll + parseInt(init);
            initiative = "" + initiative + "." + dex + (take20 ? "½" : "");
            log(`getInitiatives: Adding ${token.get("name")} to track on ${initiative}.`);
            let perms = character.get("inplayerjournals");
            if (perms === "all" || perms.indexOf("all,") > -1 || perms.indexOf(",all") > -1) {
                PfInfo.message("Initiative for " + character.get("name"), `<b>${character.get("name")}</b> rolled [[${roll}]], for a total of <b>${initiative}</b>`, null, null);
            }
        }

        inits.push({
            "id": token.get("_id"),
            "pr": initiative
        })
    }
    inits.sort(function(a, b) {
        return b.pr - a.pr;
    });
    return inits;
};

PfCombat.getNextInitiative = function(position, turnOrder) {
    // Skip over custom entries.
    while (position < turnOrder.length && turnOrder[position].custom) {
        if (turnOrder[position].custom === PfCombat.ROUND_MARKER) {
            return position;
        }
        position++;
    }
    if (position >= turnOrder.length) {
        position = 0;
        while (position < turnOrder.length && turnOrder[position].custom) {
            position++;
        }
        // It's possible to fall out of here after the end of the array if we
        // only have custom entries. This is okay.
    }
    return position;
};

PfCombat.workOutSurprise = function(playerId, token, surprise, skillCheck="Perception") {
    let surprised = false;
    let aware = false;
    log("Work Out Surprise for " + token.get("name") + " with skill " + skillCheck);

    let skillName = skillCheck.replace("-", " ");

    if (surprise <= -100) {
        aware = true;
    } else if (surprise >= 100) {
        surprised = true;
    } else {
        let skill = 0;
        let characterId = token.get("represents");
        if (characterId) {
            skill = parseInt(getAttrByName(characterId, skillCheck));
        }
        let roll = skill + randomInteger(20);
        log("Roll was " + roll + " (" + skill + ")");
        if (roll >= surprise) {
            aware = true;
            PfInfo.message(token.get("name"), `<b>${token.get("name")}</b> is aware and acts quickly with a <i>${skillName}</i> check of <b>${roll}</b>.`, null, null);
        } else {
            surprised = true;
            PfInfo.message(token.get("name"), `<b>${token.get("name")}</b> is surprised with a <i>${skillName}</i> check of <b>${roll}</b>.`, null, null);
        }
    }

    if (surprised) {
        PfInfo.setStatusCommand(playerId, "Surprised", [ token ]);
    } else if (aware) {
        PfInfo.setStatusCommand(playerId, "Aware", [ token ]);
    }

    return surprised;
};

/**
 * Inserts new tokens into the initiative track, starting immediately after the current token.
 * @param msg
 */
PfCombat.addToCombatCommand = function(playerId, tokenList, surprise, surpriseSkill="Perception") {
    log(`addToCombatCommand: ${tokenList.length} tokens with ${surprise?surprise:'no surprise'}`);

    // Grab the initiative tracker.
    let turnOrder = [];
    if (Campaign().get("turnorder") !== "") {
        turnOrder = JSON.parse(Campaign().get("turnorder"));
    }
    if (turnOrder.length === 0) {
        // No existing combat.
        PfCombat.startCombatCommand(msg);
        return;
    }
    let inits = PfCombat.getInitiatives(tokenList, turnOrder);
    log(`addToCombatCommand: Inserting ${inits.length} tokens.`);

    let doNotWrap = false;
    if (turnOrder[0].custom === PfCombat.ROUND_MARKER) {
        doNotWrap = true;
    }
    let position = 1;

    for (let i=0; i < inits.length; i++) {
        let added = false, wrapped = false, surpriseSuffix = null;

        if (surprise != null) {
            let token = getObj("graphic", inits[i].id);
            let surprised = PfCombat.workOutSurprise(playerId, token, surprise, surpriseSkill);
            if (surprised) {
                surpriseSuffix = "!";
            } else {
                surpriseSuffix = "½";
            }
            inits[i].pr = "" + inits[i].pr + surpriseSuffix;
        }

        let suffix = surpriseSuffix?"":"*";
        while (!added) {
            // Wrap around.
            if (position >= turnOrder.length) {
                if (wrapped) {
                    // Avoid infinite loops.
                    log(`    Append ${i} (${inits[i].pr}) at the end.`);
                    turnOrder.splice(position++, 0, inits[i]);
                    added = true;
                } else {
                    wrapped = true;
                    position = 0;
                }
            } else if (turnOrder[position].custom === PfCombat.ROUND_MARKER) {
                log(`    Insert ${i} (${inits[i].pr}) before round marker.`);
                // Reached the end of round. Just insert everything here now.
                inits[i].pr = "" + inits[i].pr + suffix;
                turnOrder.splice(position++, 0, inits[i]);
                added = true;
            } else if (turnOrder[position].custom) {
                log(`    Skipping custom marker.`);
                position++;
            } else if (parseFloat(inits[i].pr) > parseFloat(turnOrder[position].pr)) {
                log(`    Insert ${i} (${inits[i].pr}) before item at ${turnOrder[position].pr}.`);
                if (!doNotWrap) {
                    inits[i].pr = "" + inits[i].pr + suffix;
                }
                turnOrder.splice(position++, 0, inits[i]);
                added = true;
            } else {
                log(`    Token ${i} (${inits[i].pr}) goes after ${turnOrder[position].pr}.`);
                if (doNotWrap && position === turnOrder.length - 1) {
                    turnOrder.push(inits[i]);
                    added = true;
                }
                position++;
            }
        }
    };
    Campaign().set("turnorder", JSON.stringify(turnOrder));
};

/**
 * Displays the current status of a character token.
 *
 * @param msg   Message data.
 */
PfCombat.statusCommand = function(msg) {
    let tokenList = PfInfo.getSelectedTokens(msg);
    if (!tokenList || tokenList.length === 0) {
        return;
    }

    let html = "";
    for (let i=0; i < tokenList.length; i++) {
        let token = tokenList[i];
        let currentHp = parseInt(token.get("bar1_value"));
        let maxHp = parseInt(token.get("bar1_max"));
        let nonlethalDamage = parseInt(token.get("bar3_value"));
        let stable = token.get("status_green");
        let dead = token.get("status_dead");

        currentHp -= nonlethalDamage;

        let message = "<b>"+token.get("name") + "</b> ";
        if (dead === true) {
            message += "is dead.";
        } else if (currentHp >= maxHp) {
            message += "is at full hitpoints.";
        } else if (currentHp > 0) {
            message += "has " + currentHp + " out of " + maxHp + " hitpoints.";
        } else if (currentHp === 0) {
            message += "is disabled on zero hitpoints.";
        } else if (stable) {
            message += "is stable on " + currentHp + " hitpoints.";
        } else {
            message += "is dying on " + currentHp + " hitpoints.";
        }
        html += PfCombat.line(message);
    }
    if (playerIsGM(msg.playerid)) {
        sendChat(msg.who, "/w GM " + html);
    } else {
        sendChat(msg.who, html);
    }

};

// Constants for hitpoint options.
PfCombat.HP_NORMAL = 0;
PfCombat.HP_LOW = 1;
PfCombat.HP_AVERAGE = 2;
PfCombat.HP_HIGH = 3;
PfCombat.HP_MAX = 4;

/**
 * Roll hitpoints for a given hitdie, possibly weighted according to the
 * options. The value of option can be:
 *
 * HP_NORMAL: Roll die randomly with no weighting.
 * HP_LOW: Roll twice, take the lowest.
 * HP_AVERAGE: Roll twice, take the average (round down).
 * HP_HIGH: Roll twice, take the highest.
 * HP_MAX: Maximum hitpoints.
 */
PfCombat.getHitPoints = function(hitdie, option) {
    let hp = 0;

    switch (option) {
        case PfCombat.HP_LOW:
            hp = Math.min(randomInteger(hitdie), randomInteger(hitdie));
            break;
        case PfCombat.HP_AVERAGE:
            hp = (randomInteger(hitdie) + randomInteger(hitdie))/2;
            break;
        case PfCombat.HP_HIGH:
            hp = Math.max(randomInteger(hitdie), randomInteger(hitdie));
            break;
        case PfCombat.HP_MAX:
            hp = hitdie;
            break;
        default:
            hp = randomInteger(hitdie);
            break;
    }
    return parseInt(hp);
};

/**
 * Randomly roll hitpoints for the token. Checks the class and levels
 * of the character, constitution and other modifiers. Also checks the
 * 'maxhp_lvl1' flag, to see if maximum hitpoints should be set for
 * first level.
 *
 * Argument can be 'low', 'average', 'high' or 'max', which if specified
 * weights the rolls in a particular way, to give below average, average,
 * above average or maximum hitpoints.
 */
PfCombat.setHitPoints = function(msg, args) {
    let tokenList = PfInfo.getSelectedTokens(msg);
    if (tokenList && tokenList.length > 0) {
        let option = PfCombat.HP_NORMAL;
        if (args && args.length > 0) {
            let arg = args.shift();
            if (arg === "low") {
                option = PfCombat.HP_LOW;
            } else if (arg === "average") {
                option = PfCombat.HP_AVERAGE;
            } else if (arg === "high") {
                option = PfCombat.HP_HIGH;
            } else if (arg === "max") {
                option = PfCombat.HP_MAX;
            }
        }

        for (let i=0; i < tokenList.length; i++) {
            let token = tokenList[i];
            let character_id = token.get("represents");
            if (!character_id) {
                continue;
            }
            let maxHpLevel1 = getAttrByName(character_id, "maxhp_lvl1");
            let hpAbilityMod = getAttrByName(character_id, "HP-ability-mod");
            let hpFormulaMod = getAttrByName(character_id, "HP-formula-mod");
            let tempHitpoints = parseInt(getAttrByName(character_id, "HP-temp"));
            let hitpoints = 0;

            log(`Generating hitpoints for '${token.get("name")}'`);

            // Get hitpoints from racial Hit Dice.
            let npcHd = getAttrByName(character_id, "npc-hd");
            let npcLevel = getAttrByName(character_id, "npc-hd-num");
            if (npcHd && npcLevel) {
                npcHd = parseInt(npcHd);
                npcLevel = parseInt(npcLevel);

                log(`  NPC Levels ${npcLevel}D${npcHd}`);
                for (;npcLevel > 0; npcLevel--) {
                    hitpoints += parseInt(PfCombat.getHitPoints(npcHd, option)) + parseInt(hpAbilityMod);
                }
            }

            // Get hitpoints from class Hit Dice.
            for (let classIndex=0; classIndex < 10; classIndex++) {
                let hd = getAttrByName(character_id, "class-" + classIndex + "-hd");
                let level = getAttrByName(character_id, "class-" + classIndex + "-level");

                log(`  Class ${classIndex} Levels ${level}D${hd}`);

                if (!hd || !level) {
                    break;
                }
                hd = parseInt(hd);
                level = parseInt(level);
                if (hd === 0 || level === 0) {
                    break;
                }

                log(hd + ", " + level);

                if (classIndex === 0 && parseInt(maxHpLevel1) === 1) {
                    hitpoints = parseInt(hd) + parseInt(hpAbilityMod);
                    if (hitpoints < 1) {
                        hitpoints = 1;
                    }
                    log("Setting maximum hitpoints to " + hitpoints);
                    level--;
                }
                for (;level > 0; level--) {
                    let hp = parseInt(PfCombat.getHitPoints(hd, option)) + parseInt(hpAbilityMod);
                    if (hp < 1) {
                        hp = 1;
                    }
                    hitpoints += parseInt(hp);
                }
            }
            hitpoints += parseInt(hpFormulaMod);
            log(`  Total hitpoints set to ${hitpoints}`);
            token.set("bar1_value", hitpoints);
            token.set("bar1_max", hitpoints);
            if (tempHitpoints > 0) {
                hitpoints += tempHitpoints;
                token.set("bar1_value", hitpoints);
            }

            PfInfo.whisper(token.get("name"), `Hitpoints set to ${hitpoints}`);
        }
    }
};

PfCombat.heal = function(token, healing) {
    let prev = {};
    prev["bar1_value"] = token.get("bar1_value");
    prev["bar3_value"] = token.get("bar3_value");

    let nonLethal = parseInt(token.get("bar3_value"));
    if (nonLethal > 0) {
        nonLethal -= healing;
        if (nonLethal < 0) {
            nonLethal = 0;
        }
    }
    let hp = parseInt(token.get("bar1_value"));
    let hpMax = parseInt(token.get("bar1_max"));
    hp += healing;
    if (hp > hpMax) {
        hp = hpMax;
    }
    token.set("bar1_value", hp);
    token.set("bar3_value", nonLethal);

    PfCombat.update(token, prev, "");
};

/**
 * Heal all selected tokens to full hit points. Also removes status effects.
 */
PfCombat.healCommand = function(msg) {
    let healing = null;

    n = msg.content.split(" ");
    if (n.length > 1) {
        healing = parseInt(n[1]);
        if (healing < 1 || isNaN(healing)) {
            return;
        }
    }
    let tokenList = PfCombat.getSelectedTokens(msg);
    if (tokenList && tokenList.length > 0) {
        for (let i=0; i < tokenList.length; i++) {
            let tokenId = tokenList[i];
            let token = getObj("graphic", tokenId);
            if (token) {
                let prev = {};
                prev["bar1_value"] = token.get("bar1_value");
                prev["bar3_value"] = token.get("bar3_value");

                if (healing) {
                    let nonLethal = parseInt(token.get("bar3_value"));
                    if (nonLethal > 0) {
                        nonLethal -= healing;
                        if (nonLethal < 0) {
                            nonLethal = 0;
                        }
                    }
                    let hp = parseInt(token.get("bar1_value"));
                    let hpMax = parseInt(token.get("bar1_max"));
                    hp += healing;
                    if (hp > hpMax) {
                        hp = hpMax;
                    }
                    token.set("bar1_value", hp);
                    token.set("bar3_value", nonLethal);
                } else {
                    token.set("bar1_value", token.get("bar1_max"));
                    token.set("bar3_value", 0);
                    token.set({
                        'status_pummeled': false,
                        'status_dead': false,
                        'status_skull': false,
                        'status_red': false,
                        'status_brown': false,
                        'status_green': false,
                        'status_bleeding-eye': false,
                        'status_screaming': false,
                        'status_flying-flag': false,
                        'status_fishing-net': false,
                        'status_sleepy': false,
                        'status_half-haze': false,
                        'status_broken-heart': false,
                        'status_padlock': false,
                        'status_radioactive': false,
                        'status_half-heart': false,
                        'status_cobweb': false,
                        'status_chained-heart': false,
                        'status_drink-me': false,
                        'status_interdiction': false,
                        'status_overdrive': false,
                        'status_fist': false,
                        'status_snail': false,
                        'status_rolling-bomb': false,
                        'status_tread': false,
                        'status_frozen-orb': false
                    });
                    token.set("tint_color", "transparent");
                }
                PfCombat.update(token, prev, "");
            }
        }
    }
};

/**
 * Calculates initiative, and adds to the initiative tracker, for each
 * selected token. If no tokens are selected, and this is a player, then
 * all tokens that belong to that player on the active map are selected.
 *
 * Initiative values have the dexterity * 0.01 of the character appended
 * in order to help break ties.
 *
 * Makes use of initiativeMsgCallback to process the rolled result and
 * add it into the tracker.
 */
PfCombat.initCommand = function(msg, args) {
    let initRoll = null;

    if (args && args.length > 0) {
        initRoll = parseInt(args[0]);
    }

    let turnOrder = [];
    if (Campaign().get("turnorder") !== "") {
        turnOrder = JSON.parse(Campaign().get("turnorder"));
    }
    let tokenList = PfCombat.getSelectedTokens(msg);
    for (let i=0; i < tokenList.length; i++) {
        for (let ti=0; ti < turnOrder.length; ti++) {
            if (turnOrder[ti].id === tokenList[i]) {
                turnOrder.splice(ti, 1);
            }
        }
    }

    for (let tIdx=0; tIdx < tokenList.length; tIdx++) {
        let tokenId = tokenList[tIdx];
        let token = getObj("graphic", tokenId);

        let character_id = token.get("represents");
        if (!character_id) {
            continue;
        }
        let character = getObj("character", character_id);
        let init = getAttrByName(character_id, "init");
        let dex = getAttrByName(character_id, "DEX-base");
        // Avoid dividing by 100, since this sometimes gives arithmetic
        // errors with too many dp.
        if (parseInt(dex) < 10) {
            dex = ("0" + dex);
        }
        let message = "Initiative is [[d20 + " + init + " + 0." + dex + "]]";
        if (initRoll || initRoll === 0) {
            message = "Initiative is [[d0 + " + initRoll + " + 0." + dex + "]]";
        }
        message = PfCombat.line(message);
        let player = getObj("player", msg.playerid);
        sendChat(`player|${msg.playerid}`, message,
            initiativeMsgCallback(tokenId, turnOrder, token, player));
    }
};

/**
 * Add a custom initiative marker. This is designed to be used to track
 * spells and other effects which last a given number of rounds. The
 * first argument is the number of rounds, the rest are the description
 * of the effect being tracked.
 *
 * One token must be selected, and its name is put into the tracker's
 * description. The tracker item is always pushed to the end of the
 * initiative track (it is assumed the current token has initiative,
 * so this will put it just before the current token comes up again).
 */
PfCombat.addCustomInitCommand = function(msg, args) {
    let turnOrder = [];
    if (Campaign().get("turnorder")) {
        turnOrder = JSON.parse(Campaign().get("turnorder"));
    }
    let tokenList = PfCombat.getSelectedTokens(msg, true);

    let tokenId = tokenList[0];
    let token = getObj("graphic", tokenId);

    let customName = token.get("name") + ":";
    let turns = args.shift();
    log("Custom init for [" + customName + "] lasts [" + turns + "] turns.");
    while (args.length > 0) {
        customName += " " + args.shift();
    }
    log("Description is [" + customName + "]");

    turnOrder.push({
        "id": "-1",
        "pr": turns,
        "custom": customName,
        "formula": -1,
    });
    Campaign().set("turnorder", JSON.stringify(turnOrder));
};

/**
 * Needed when setting the turn order. Otherwise by the time the callback
 * is executed, the value of tokenId that is in scope has changed, and we
 * just end up adding the last token multiple times.
 */
function initiativeMsgCallback(tokenId, turnOrder, token, player) {
    return function(ops) {
        let rollresult = ops[0];
        let result = rollresult.inlinerolls[0].results.total;

        if (turnOrder == null) {
            log("turnOrder is not set in initiativeMsgCallback");
            return;
        }
        if (!token) {
            log("token is undefined in initiativeMsgCallback");
            return;
        }

        // Convert the result into a string, and make sure we aren't
        // an dropping unwanted zero.
        result = ("" + result);
        if (result.match(/\.[0-9]$/g)) {
            result += "0";
        }
        turnOrder.push({
            id: tokenId,
            pr: result
        });
        Campaign().set("turnorder", JSON.stringify(turnOrder));
        let text = `${token.get("name")} has initiative [[d0 + ${result} ]]`;
        if (playerIsGM(player.get("id"))) {
            PfInfo.whisper(token.get("name"), text, token.get("name"));
        } else {
            PfInfo.message(`player|${player.get("id")}`, text, token.get("name"));
        }
    };
}

PfCombat.savesCommand = function(msg) {
    let params = msg.content.split(" ");
    if (params.length < 2) {
        PfCombat.usageSaves(msg, "Must specify at least a save type.");
        return;
    }
    let saveType = (""+params[1]).toLowerCase();
    let saveName = "";
    let dc = 0;

    if (params.length > 2) {
        dc = parseInt(params[2]);
    }

    let setDamage = false, setStatus = false;
    let damage = null, halfDamage = null, status = null;

    for (let i=3; i < params.length; i++) {
        let arg = params[i];

        if (arg == "0" || parseInt(arg) > 0) {
            if (!damage) {
                damage = parseInt(arg);

                setDamage = true;
            } else if (!halfDamage) {
                halfDamage = parseInt(arg);
            } else {
                PfCombat.usageSaves(msg, "Can only specify two damages.");
                return;
            }
        } else if (!status) {
            status = arg.replace(/-/, " ").toLowerCase();
            status = status.replace(/\w\S*/g, function (txt) { return txt.charAt(0).toUpperCase() + txt.substr(1); } );
            if (PfCombat.status[status] == null) {
                PfCombat.usageSaves(msg, "Unrecognised token state " + arg + ".");
                return;
            } else {
                setStatus = true;
            }
        } else {
            PfCombat.usageSaves(msg, "Too many arguments.");
            return;
        }
    }

    if (saveType.indexOf("ref") == 0) {
        saveType = "Ref";
        saveName = "Reflex";
    } else if (saveType.indexOf("for") == 0) {
        saveType = "Fort";
        saveName = "Fortitude";
    } else if (saveType.indexOf("wil") == 0) {
        saveType = "Will";
        saveName = "Will";
    } else {
        PfCombat.usageSaves(msg, "Unrecognised saving throw type " + saveType);
        return;
    }

    let tokenList = PfCombat.getSelectedTokens(msg);
    if (tokenList != null && tokenList.length > 0) {
        for (let tIdx=0; tIdx < tokenList.length; tIdx++) {
            let tokenId = tokenList[tIdx];
            let token = getObj("graphic", tokenId);

            let character_id = token.get("represents");
            if (character_id == null) {
                sendChat("", "/w GM " + token.get("name") + " has no associated character");
                return;
            }
            let character = getObj("character", character_id);

            let score = getAttrByName(character_id, saveType);
            if (score == null) {
                sendChat("", "/w GM " + token.get("name") + " has no associated save attribute");
                return;
            }
            let message = "";
            if (dc === 0) {
                message = "Rolls a <b>" + saveName + "</b> save of [[d20 + " + score + "]].";
                PfCombat.message(token, PfCombat.line(message));
                continue;
            }


            let autoSuccess = false;
            let autoFail = false;
            let autoMsg = "";
            let check = randomInteger(20);
            if (check == 1) {
                autoFail = true;
                autoMsg = " Natural [1]";
            } else if (check == 20) {
                autoSuccess = true;
                autoMsg = " Natural [20]";
            }
            check += parseInt(score);

            if (!playerIsGM(msg.playerid)) {
                message += PfCombat.line("Rolls " + check + "" + autoMsg + ". ");
            }
            let flags = [];
            let prev = [];
            prev["bar1_value"] = token.get("bar1_value");
            prev["bar1_max"] = token.get("bar1_max");
            prev["bar3_value"] = token.get("bar3_value");
            prev["bar3_max"] = token.get("bar3_max");

            if (!autoFail && (check >= dc || autoSuccess)) {
                flags['status_flying-flag'] = false;
                let text = "Succeeds on a " + saveName + " DC " + dc + " check.";
                if (setDamage && halfDamage > 0) {
                    let currentHp = parseInt(token.get("bar1_value"));
                    currentHp -= halfDamage;

                    token.set("bar1_value", currentHp);
                    text += " They take " + halfDamage + "hp damage.";
                }
                message += PfCombat.line(text);
            } else {
                if (setDamage || setStatus) {
                    let text = "Fails a " + saveName + " DC " + dc + " check.";
                    if (setDamage) {
                        let currentHp = parseInt(token.get("bar1_value"));
                        currentHp -= damage;

                        token.set("bar1_value", currentHp);
                        text += " They take " + damage + "hp damage.";
                        if (!setStatus) {
                            message += PfCombat.line(text);
                        }
                    }
                    if (setStatus) {
                        let symbol = PfCombat.status[status].status;
                        let effect = PfCombat.status[status].description;
                        flags["status_" + symbol] = true;

                        message += PfCombat.getSymbolHtml(symbol);

                        text += "<br/>They are now <b>" + status + "</b>.";
                        message += PfCombat.line(text);
                    }
                } else {
                    message += PfCombat.line("Fails a " + saveName + " DC " + dc + " check.");
                    flags['status_flying-flag'] = true;
                }
            }
            token.set( flags );
            if (setDamage) {
                PfCombat.update(token, prev, message);
            } else {
                PfCombat.message(token, message);
            }
        }
    }
};

/**
 * Damage all selected tokens by the given amount.
 * Damage is either lethal or nonlethal.
 */
PfCombat.damageCommand = function(msg) {
    let damage = 1;
    let nonlethal = false;
    n = msg.content.split(" ");

    if (n.length > 1) {
        damage = parseInt(n[1]);
        if (damage < 1 || isNaN(damage)) {
            return;
        }
    }
    if (n.length > 2 && n[2] == "nonlethal".substr(0, n[2].length)) {
        nonlethal = true;
    }

    let tokenList = PfCombat.getSelectedTokens(msg, true);
    if (!tokenList) {
        PfCombat.error("Cannot determine list of selected tokens.");
        return;
    }
    if (tokenList.length > 0) {
        for (let i=0; i < tokenList.length; i++) {
            let tokenId = tokenList[i];
            let token = getObj("graphic", tokenId);

            log(token.get("name"));

            let currentHp = parseInt(token.get("bar1_value"));
            let nonlethalDamage = parseInt(token.get("bar3_value"));
            let prev = {};
            prev["bar1_value"] = currentHp;
            prev["bar3_value"] = nonlethalDamage;

            if (nonlethal) {
                token.set("bar3_value", nonlethalDamage + damage);
            } else {
                log("Real hp was " + currentHp);
                currentHp -= damage;
                log("Real hp is now " + currentHp);
                token.set("bar1_value", currentHp);
            }
            PfCombat.update(token, prev, "");
        }
    }
};

/**
 * Check to see if any of the selected tokens stabilise.
 */
PfCombat.stabiliseCommand = function(msg) {
    let tokenList = PfCombat.getSelectedTokens(msg, true);
    if (tokenList && tokenList.length > 0) {
        for (let i=0; i < tokenList.length; i++) {
            let tokenId = tokenList[i];
            let token = getObj("graphic", tokenId);
            if (!token) {
                continue;
            }

            PfCombat.stabilise(token);
        }
    }
};

PfCombat.stabilise = function(token) {
    let tokenName = token.get("name");
    let character_id = token.get("represents");
    if (!character_id) {
        sendChat("", "/w GM " + tokenName + " has no associated character");
        return;
    }
    let character = getObj("character", character_id);

    let hpMax = token.get("bar1_max");
    let hpCurrent = token.get("bar1_value");
    let nonlethalDamage = token.get("bar3_value");
    let stable = token.get("status_green");
    let dead = token.get("status_dead");

    let constitution = getAttrByName(character_id, 'CON-mod');
    if (!constitution) {
        constitution = 0;
    }

    if (dead === true) {
        sendChat("", "/w GM " + tokenName + " is already dead.");
    } else if (hpCurrent >= 0) {
        // Target is healthy, nothing to do.
        sendChat("", "/w GM " + tokenName + " is healthy.");
    } else if (stable === true) {
        sendChat("", "/w GM " + tokenName + " is stable.");
    } else {
        let dc = 10 - hpCurrent;
        let check = randomInteger(20) + parseInt(constitution);
        if (!token.get("light_hassight")) {
            // This is considered a mook, so more likely to die.
            check = randomInteger(10) + parseInt(constitution);
        }
        if (token.get("status_pink")) {
            check = 0;
            log(`{tokenName} is bleeding, so automatically fails to stabilise.`);
        } else {
            log(tokenName + " rolls " + check + " to stabilise.");
        }
        if (check >= dc || check === constitution + 20) {
            token.set({
                status_green: true
            });
            PfCombat.update(token, null, PfCombat.getSymbolHtml("green") + PfCombat.line(`<b>${tokenName}</b> stabilises (${check} v DC ${dc}).</p>`));
        } else {
            hpCurrent -= 1;
            token.set({
                bar1_value: hpCurrent,
                status_green: false
            });
            PfCombat.update(token, null, PfCombat.line(`<b>${tokenName}</b> is closer to death (${check} v DC ${dc}).`));
        }
    }
};


PfCombat.getSymbolHtml = function(symbol) {
    let statuses = [
        'red', 'blue', 'green', 'brown', 'purple', 'pink', 'yellow', // 0-6
        'skull', 'sleepy', 'half-heart', 'half-haze', 'interdiction',
        'snail', 'lightning-helix', 'spanner', 'chained-heart',
        'chemical-bolt', 'death-zone', 'drink-me', 'edge-crack',
        'ninja-mask', 'stopwatch', 'fishing-net', 'overdrive', 'strong',
        'fist', 'padlock', 'three-leaves', 'fluffy-wing', 'pummeled',
        'tread', 'arrowed', 'aura', 'back-pain', 'black-flag',
        'bleeding-eye', 'bolt-shield', 'broken-heart', 'cobweb',
        'broken-shield', 'flying-flag', 'radioactive', 'trophy',
        'broken-skull', 'frozen-orb', 'rolling-bomb', 'white-tower',
        'grab', 'screaming', 'grenade', 'sentry-gun', 'all-for-one',
        'angel-outfit', 'archery-target'
    ];
    let i = _.indexOf(statuses, symbol);

    if (i < 0) {
        return "";
    } else if (i < 7) {
        let colours = [ '#ff0000', '#0000ff', '#00ff00', '#ff7700', '#ff00ff', '#ff7777', '#ffff00' ];
        return "<div style='float: left; background-color: " + colours[i] + "; border-radius: 12px; width: 12px; height: 18px; display: inline-block; margin: 0; border: 0; padding: 0px 3px; margin-right: 6px'></div>";
    } else {
        return '<div style="float: left; width: 24px; height: 24px; display: inline-block; margin: 0; border: 0; cursor: pointer; padding: 0px 3px; background: url(\'https://app.roll20.net/images/statussheet.png\'); background-repeat: no-repeat; background-position: '+((-34)*(i-7))+'px 0px;"></div>';
    }
};

PfCombat.usageSaves = function(msg, errorText) {
    let text = "<i>" + errorText + "</i><br/>";
    text += "Use !pfsaves &lt;Ref|Fort|Will&gt; &lt;DC&gt; [&lt;Damage&gt; [&lt;Half-Damage&gt;]] [&lt;Effect&gt;]<br/>";
    text += "Allowed effects: ";
    for (let s in PfCombat.status) {
        text += s.replace(/ /, "-") + ", ";
    }
    text = text.replace(/, $/, ".");

    sendChat("PfDamage", "/w " + msg.who + " " + text);
};

PfCombat.status = {
    'Blind': { status: "bleeding-eye", description: "-2 penalty to AC; loses Dex bonus to AC; -4 penalty of most Dex and Str checks and opposed Perception checks; Opponents have 50% concealment; Acrobatics DC 10 if move faster than half speed, or prone." },
    'Confused': { status: "screaming", description: "01-25: Act Normally; 26-50: Babble; 51-75: 1d8 + Str damage to self; 76-100: Attack nearest." },
    'Dazzled': { status: "overdrive", description: "-1 attacks and sight based perception checks." },
    'Entangled': { status: "fishing-net", description: "No movement if anchored, otherwise half speed. -2 attack, -4 Dex. Concentration check to cast spells." },
    'Exhausted': { status: "sleepy", description: "Half-speed, -6 to Str and Dex. Rest 1 hour to become fatigued." },
    'Fatigued': { status: "half-haze", description: "Cannot run or charge; -2 to Str and Dex. Rest 8 hours to recover." },
    'Frightened': { status: "broken-heart", description: "-2 attacks, saves, skills and ability checks; must flee from source." },
    'Grappled': { status: "padlock", description: "Cannot move or take actions that require hands. -4 Dex, -2 attacks and combat maneuvers except to escape. Concentration to cast spells, do not threaten." },
    'Nauseated': { status: "radioactive", description: "Can only take a single move action, no spells attacks or concentration." },
    'Panicked': { status: "half-heart", description: "-2 attacks, saves, skills and ability checks; drops items and must flee from source." },
    'Paralyzed': { status: "cobweb", description: "Str and Dex reduced to zero. Flyers fall. Helpless." },
    'Prone': { status: "arrowed", description: "-4 penalty to attack roles and can't use most ranged weapons. Has +4 AC bonus against ranged, but -4 AC against melee." },
    'Shaken': { status: "chained-heart", description: "-2 penalty on all attacks, saves, skills and ability checks." },
    'Sickened': { status: "drink-me", description: "-2 penalty on all attacks, damage, saves, skills and ability checks." },
    'Staggered': { status: "pummeled", description: "Only a move or standard action (plus swift and immediate)." },
    'Stunned': { status: "interdiction", description: "Cannot take actions, drops everything held, takes a -2 penalty to AC, loses its Dex bonus to AC." },
    'Power Attack': { status: "fist", description: "Penalty to hit and bonus to damage based on BAB. Lasts until start of next turn." },
    'Unconscious': { status: "skull", description: "Creature is unconscious and possibly dying." },
    'Dead': { status: "dead", description: "Creature is dead. Gone. Destroyed." }
};

PfCombat.BOX_STYLE="background-color: #EEEEDD; color: #000000; margin-top: 30px; padding:0px; border:1px dashed black; border-radius: 10px; padding: 3px";

PfCombat.line = function(message) {
    return "<p style='margin:0px; padding:0px; padding-bottom: 2px; font-weight: normal; font-style: normal; text-align: left'>" + message + "</p>";
};

/**
 * Called when a token is updated. We check the damage values (bar1 and bar3)
 * and set status on the token depending on results.
 * The prev object contains a map of previous values prior to the token changing,
 * so we can tell how much damage the token has just taken.
 */
PfCombat.update = function(obj, prev, message) {
    if (obj == null || obj.get("bar1_max") === "") return;
    if (message == null) {
        message = "";
    }

    let takenDamage = false;
    let name = obj.get("name");
    let hpMax = parseInt(obj.get("bar1_max"));
    let hpCurrent = parseInt(obj.get("bar1_value"));
    let nonlethalDamage = parseInt(obj.get("bar3_value"));
    let stable = obj.get("status_green");
    let previousHitpoints = hpCurrent;

    if (prev) {
        if (hpCurrent == prev["bar1_value"] && hpMax == prev["bar1_max"] && nonlethalDamage == prev["bar3_value"]) {
            // Whatever has changed is nothing to do with us.
            return;
        }
        if (hpCurrent < prev["bar1_value"]) {
            takenDamage = true;
        }
        if (nonlethalDamage > prev["bar3_value"]) {
            takenDamage = true;
        }
        if (takenDamage) {
            // Taken damage, so remove stable marker.
            obj.set({
                status_green: false
            });
            stable = false;
        } else {
            // In which case we've probably been healed, so stabilise.
            obj.set({
                status_green: true
            });
            stable = true;
        }

        previousHitpoints = prev["bar1_value"] - prev["bar3_value"];
    }

    if (nonlethalDamage === "") {
        nonlethalDamage = 0;
    }
    let hpActual = hpCurrent - nonlethalDamage;

    let character_id = obj.get("represents");
    if (!character_id) {
        return;
    }
    let constitution = getAttrByName(character_id, 'CON');
    if (!constitution) {
        constitution = 10;
    }
    let type = getAttrByName(character_id, 'npc-type');
    if (!type) {
        type = "";
    }
    type = type.toLowerCase();
    let living = true;

    // Non-living have special rules.
    if (type.indexOf("undead") > -1 || type.indexOf("construct") > -1 || type.indexOf("inevitable") > -1 ||
        type.indexOf("swarm") > -1 || type.indexOf("elemental") > -1) {
        if (nonlethalDamage > 0) {
            obj.set({
                bar3_value: 0
            });
            hpActual += nonlethalDamage;
            nonlethalDamage = 0;

        }
        if (hpCurrent < 1) {
            let maxSoulWard = PfInfo.getAbility(obj, "Soul Ward");
            if (maxSoulWard > 0) {
                let soulWard = parseInt(obj.get("bar2_value"));
                log("Soul Ward: " + soulWard);
                if (soulWard > maxSoulWard) {
                    soulWard = maxSoulWard;
                }

                soulWard --;
                if (hpCurrent == 0) {
                    hpCurrent ++;
                } else {
                    soulWard += hpCurrent;
                }
                if (soulWard < 0) {
                    hpCurrent = 0;
                    soulWard = 0;
                } else {
                    hpCurrent = 1;
                    message += PfCombat.line(`<b>${name}</b> taps into its Soul Ward.`);
                }
                obj.set({
                    bar2_value: soulWard
                });
                obj.set("bar1_value", hpCurrent);
                hpActual = hpCurrent;
            }
        }

        if (hpCurrent < 0) {
            hpCurrent = 0;
            // No point having negative hit points for these types of creatures.
            hpActual = hpCurrent;
            obj.set({
                bar1_value: 0
            });
        }
        living = false;
    } else if (nonlethalDamage > hpMax) {
        // NonLethal Damage greater than maximum hitpoints, does lethal damage.
        hpCurrent -= (nonlethalDamage - hpMax);
        nonlethalDamage = hpMax;
        obj.set("bar1_value", hpCurrent);
        obj.set("bar3_value", nonlethalDamage);
    }
    let damageTaken = takenDamage?(previousHitpoints - hpActual):0;
    if (damageTaken > 0) {
        message += PfCombat.line(`<b>${name}</b> has taken ${damageTaken} damage.`);
    }

    // Kill low level mooks more quickly, so they don't hang around forever.
    // Their negative hp limit is equal to half their hitpoints. We define a
    // Mook as not having vision.
    let mook = false;
    if (!obj.get("light_hassight")) {
        log(`${obj.get("name")} is a mook.`);
        mook = true;
        if (constitution > hpMax / 2) {
            constitution = hpMax / 2;
        }
    }

    let cannotDie = false;
    if (PfInfo.hasAbility(obj, "Regeneration") && !obj.get("status_broken-shield")) {
        cannotDie = true;
    }

    log("DamageTaken: " + damageTaken + "; hpMax: " + hpMax + "; nonLethal: " + nonlethalDamage);
    if (!cannotDie && (damageTaken - nonlethalDamage) > 50 && (damageTaken - nonlethalDamage) > hpMax / 2) {
        let owners = PfInfo.getOwners(obj);
        if (owners.length > 0) {
            // This character has owners set, so is possible a PC. Let them make the roll
            // instead of doing it automatically. Also use the battle scar table rather
            // than simple instant death.
            let battleScar = "";
            switch (randomInteger(20)) {
                case 1: case 2: case 3: case 4: case 5:
                    battleScar = "a <b>Minor scar</b> - <i>interesting but otherwise cosmetic</i>";
                    break;
                case 6: case 7: case 8:
                    battleScar = "a <b>Moderate scar</b> - <i>cut on face (+1 bonus on Charisma-based skill checks for first scar only)</i>";
                    break;
                case 9: case 10:
                    battleScar = "a <b>Major scar</b> - <i>severe cut on face (-1 penalty on Charisma-based skill checks)</i>";
                    break;
                case 11: case 12: case 13: case 14:
                    battleScar = "the <b>Loss of a finger</b> <i>(for every 3 fingers lost, -1 Dexterity)</i>";
                    break;
                case 15: case 16:
                    battleScar = "an <b>Impressive wound</b> <i>(-1 Constitution)</i>";
                    break;
                case 17:
                    battleScar = "the <b>Loss of an eye</b> <i>(-4 penalty on all sight-based Perception checks)</i>";
                    break;
                case 18:
                    battleScar = "the <b>Loss of a leg</b> <i>(speed reduced to half, cannot charge)</i>";
                    break;
                case 19:
                    battleScar = "the <b>Loss of a hand</b> <i>(cannot use two-handed items)</i>";
                    break;
                case 20:
                    battleScar = "the <b>Loss of an arm</b> <i>(-1 Strength, cannot use two-handed items</i>";
                    break;
            }
            message += PfCombat.line(`They have taken <b>massive damage</b>, and need to make a Fort DC 15 check or drop to -1 hitpoints and suffer ${battleScar}.`);

        } else {
            let fortBonus = parseInt(getAttrByName(character_id, 'Fort'));
            if (fortBonus + randomInteger(20) > 15) {
                message += PfCombat.line(`They are not killed by massive damage.`);
            } else {
                message += PfCombat.line(`There are killed outright from <b>massive damage</b>, dropping from ${hpCurrent} to zero hitpoints.`);
                obj.set({
                    status_pummeled: false,
                    status_dead: true,
                    status_skull: false,
                    status_red: false,
                    status_brown: false,
                    status_green: false,
                    bar1_value: 0
                });
                PfCombat.message(obj, message);
                return;
            }
        }
    }

    if (!living && hpCurrent < 1 && !cannotDie) {
        obj.set({
            status_pummeled: false,
            status_dead: true,
            status_skull: false,
            status_red: false,
            status_brown: false,
            status_green: false
        });
        if (type.indexOf("Swarm") > -1) {
            message += PfCombat.line("<b>" + name + "</b> is <i>dispersed</i>.");
        } else {
            message += PfCombat.line("<b>" + name + "</b> is <i>destroyed</i>.");
        }
    } else if (hpCurrent <= 0 - constitution && !cannotDie) {
        obj.set({
            status_pummeled: false,
            status_dead: true,
            status_skull: false,
            status_red: false,
            status_brown: false,
            status_green: false
        });
        message += PfCombat.line("<b>" + name + "</b> is <i>dead</i>.");
    } else if (hpActual < 0) {
        obj.set({
            status_pummeled: false,
            status_dead: false,
            status_skull: true,
            status_red: false,
            status_brown: false
        });
        if (cannotDie) {
            message += PfCombat.line(`<b>${name}</b> is down but regenerating.`);
        } else if (hpCurrent < 0 && !stable) {
            message += PfCombat.getSymbolHtml("skull");
            message += PfCombat.line("<b>" + name + "</b> is <i>dying</i>. Each turn " +
                                   "they must make a DC&nbsp;" + (10 - hpCurrent) +
                                   " CON check to stop bleeding.");
        } else if (hpCurrent < 0) {
            message += PfCombat.line("<b>" + name + "</b> is <i>dying but stable</i>.");
        } else {
            message += PfCombat.line("<b>" + name + "</b> is <i>unconscious</i>.");
        }
    } else if (hpActual === 0) {
        // Staggered. Note that a character is staggered if either
        // nonlethal damage increases to their current hitpoints,
        // or their current hitpoints drops to zero.
        obj.set({
            status_pummeled: true,
            status_dead: false,
            status_skull: false,
            status_red: false,
            status_brown: false,
            status_green: false
        });
        let msg = "They can only make one standard or move action each round.";
        if (hpCurrent === 0) {
            message += PfCombat.getSymbolHtml("pummeled");
            message += PfCombat.line("<b>" + name + "</b> is <i>disabled</i>. " + msg);
        } else {
            message += PfCombat.getSymbolHtml("pummeled");
            message += PfCombat.line("<b>" + name + "</b> is <i>staggered</i>. " + msg);
        }
    } else if (hpActual <= hpMax / 3) {
        obj.set({
            status_pummeled: false,
            status_dead: false,
            status_skull: false,
            status_red: true,
            status_brown: true,
            status_green: false
        });
        if (prev && previousHitpoints > hpMax / 3) {
            message += PfCombat.getSymbolHtml("red");
            message += PfCombat.line("<b>" + name + "</b> is now <i>heavily wounded</i>.");
        }
    } else if (hpActual <= hpMax * (2/3)) {
        obj.set({
            status_pummeled: false,
            status_dead: false,
            status_skull: false,
            status_red: false,
            status_brown: true,
            status_green: false
        });
        if (prev && previousHitpoints > hpMax * (2/3)) {
            message += PfCombat.getSymbolHtml("brown");
            message += PfCombat.line("<b>" + name + "</b> is now <i>moderately wounded</i>.");
        }
    } else {
        obj.set({
            status_pummeled: false,
            status_dead: false,
            status_skull: false,
            status_red: false,
            status_brown: false,
            status_green: false
        });
    }
    if (prev && !takenDamage && previousHitpoints < hpActual) {
        // Probably been healed.
        if (hpActual >= hpMax && previousHitpoints < hpMax) {
            message += PfCombat.line("<b>" + name + "</b> is now fully healed.");
        } else if (hpActual > hpMax * (2/3) && previousHitpoints <= hpMax * (2/3)) {
            message += PfCombat.line("<b>" + name + "</b> is feeling a lot better.");
        } else if (hpActual > hpMax / 3 && previousHitpoints <= hpMax / 3) {
            message += PfCombat.getSymbolHtml("brown");
            message += PfCombat.line("<b>" + name + "</b> is now only moderately wounded.");
        } else if (hpActual > 0 && previousHitpoints <= 0) {
            message += PfCombat.getSymbolHtml("red");
            message += PfCombat.line("<b>" + name + "</b> is now more alive than dead.");
        }
    }
    if (message) {
        PfCombat.message(obj, message);
    }
};

PfCombat.getMessageBox = function(token, message, whisper = null) {
    let html = "";
    let x = 30, y = 5;
    if (whisper) {
        x += 30;
        y += 25;
    }
    if (message && token) {
        let image = token.get("imgsrc");
        let name = token.get("name");
        html += "<div style='" + PfInfo.BOX_STYLE + "'>";
        html += "<img src='"+image+"' width='50px' height='50px' style='position: absolute; top: " + y +
                "px; left: " + x + "px; background-color: white; border-radius: 25px'/>";

        html += "<div style='position: absolute; top: " + (y+17) +
                "px; left: " + (x+60) + "px; border: 1px solid black; background-color: " +
                "white; padding: 0px 5px 0px 5px'>" + name + "</div>";

        html += "<div style='margin-top: 20px; padding-left: 5px'>" + message + "</div>";
        html += "</div>";

        return html;
    } else if (message) {
        html += "<div style='" + PfCombat.BOX_STYLE + "'>";
        html += "<div style='margin-top: 20px; padding-left: 5px'>" + message + "</div>";
        html += "</div>";
    }
    return html;
};

PfCombat.message = function(token, message, func) {
    // If object is on player object layer, broadcast the message, otherwise
    // whisper it to the GM.
    if (token.get("layer") === "objects") {
        PfInfo.message(token.get("name"), message, null, func);
    } else {
        PfInfo.whisper(token.get("name"), message, null, func);
    }
};

PfCombat.whisper = function(token, message, func) {
    let html = PfCombat.getMessageBox(token, message, true);
    if (!func) {
        sendChat("GM", "/w GM " + html);
    } else {
        sendChat("GM", "/w GM " + html, null, func);
    }
};

PfCombat.ERROR_STYLE="background-color: #FFDDDD; color: #000000; margin-top: 30px; padding:0px; border:1px dashed black; border-radius: 10px; padding: 3px; text-align: left; font-style: normal; font-weight: normal";

PfCombat.error = function(message) {
    if (message) {
        log("PfCombat Error: " + message);
        let html = "<div style='" + PfCombat.ERROR_STYLE + "'><b>PfCombat Error:</b> " + message + "</div>";
        sendChat("", "/desc " + html);
    }
};
