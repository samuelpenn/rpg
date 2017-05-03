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

/**
 * Single event handler for all chat messages.
 */
on("chat:message", function(msg) {
    if (msg.type !== "api") return;
    var args = msg.content.split(" ");
    var command = args.shift();

    if (command == "!pfheal") {
        PfCombat.healCommand(msg);
    } else if (command == "!pfinit") {
        PfCombat.initCommand(msg);
    } else if (command == "!pfsaves") {
        PfCombat.savesCommand(msg);
    } else if (command == "!pfdmg") {
        PfCombat.damageCommand(msg);
    } else if (command == "!pfstabilise") {
        PfCombat.stabiliseCommand(msg);
    } else if (command == "!pfstatus") {
        PfCombat.statusCommand(msg);
    } else if (command == "!pfhitpoints") {
        PfCombat.setHitPoints(msg, args);
    } else if (command == "!pfcustominit") {
        PfCombat.addCustomInitCommand(msg, args);
    }
});

on("change:graphic", function(obj, prev) {
    log("PfCombat: Graphic change event for " + obj.get("name"));
    if (obj.get("_pageid") == Campaign().get("playerpageid")) {
        PfCombat.update(obj, prev, "");
    }
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
    var tokenList = [];
    if (forceExplicit == null) {
        forceExplicit = false;
    }

    if (msg == null || msg == undefined) {
        return null;
    }

    if (msg.selected != null && msg.selected.length > 0) {
        for (var i=0; i < msg.selected.length; i++) {
            var token = getObj("graphic", msg.selected[i]._id);
            if (token == null || token.get("name") == null || token.get("name") == "") {
                continue;
            }
            if (token.get("represents") == null) {
                continue;
            }
            tokenList.push(msg.selected[i]._id);
        }
    } else if (!playerIsGM(msg.playerid)) {
        var currentObjects = findObjs({
            _pageid: Campaign().get("playerpageid"),
            _type: "graphic",
        });
        for (var i=0; i < currentObjects.length; i++) {
            var token = currentObjects[i];
            if (token.get("name") == null || token.get("name") == "") {
                continue;
            }
            var characterId = token.get("represents");
            if (characterId != null && characterId != "") {
                var character = getObj("character", characterId);
                if (character == null) {
                    continue;
                }
                var controlledBy = character.get("controlledby");
                if (controlledBy == null || controlledBy == "") {
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
        if (forceExplicit && tokenList.length != 1) {
            log("PfCombat.getSelectedTokens: forceExplicit is set, and " + tokenList.length + " tokens found.");
            return null;
        }
    }

    return tokenList;
}

PfCombat.statusCommand = function(msg) {
    var tokenList = PfCombat.getSelectedTokens(msg);
    if (tokenList == null || tokenList.length == 0) {
        return;
    }

    var html = "";
    for (var i=0; i < tokenList.length; i++) {
        var token = getObj("graphic", tokenList[i]);
        var currentHp = parseInt(token.get("bar1_value"));
        var maxHp = parseInt(token.get("bar1_max"));
        var nonlethalDamage = parseInt(token.get("bar3_value"));
        var stable = token.get("status_green");
        var dead = token.get("status_dead");

        currentHp -= nonlethalDamage;

        var message = "<b>"+token.get("name") + "</b> ";
        if (dead == true) {
            message += "is dead.";
        } else if (currentHp >= maxHp) {
            message += "is at full hitpoints.";
        } else if (currentHp > 0) {
            message += "has " + currentHp + " out of " + maxHp + " hitpoints.";
        } else if (currentHp == 0) {
            message += "is disabled on zero hitpoints.";
        } else if (stable) {
            message += "is stable on " + currentHp + " hitpoints.";
        } else {
            message += "is dying on " + currentHp + " hitpoints.";
        }
        html += PfCombat.line(message);
    }
    sendChat(msg.who, "/w " + msg.who + " " + html);
}

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
    var hp = 0;

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
}

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
    var tokenList = PfCombat.getSelectedTokens(msg);
    if (tokenList != null && tokenList.length > 0) {
        var option = PfCombat.HP_NORMAL;
        if (args != null && args.length > 0) {
            var arg = args.shift();
            if (arg == "low") {
                option = PfCombat.HP_LOW;
            } else if (arg == "average") {
                option = PfCombat.HP_AVERAGE;
            } else if (arg == "high") {
                option = PfCombat.HP_HIGH;
            } else if (arg == "max") {
                option = PfCombat.HP_MAX;
            }
        }

        for (var i=0; i < tokenList.length; i++) {
            var tokenId = tokenList[i];
            var token = getObj("graphic", tokenId);

            var character_id = token.get("represents");
            if (character_id == null) {
                continue;
            }
            var maxHpLevel1 = getAttrByName(character_id, "maxhp_lvl1");
            var hpAbilityMod = getAttrByName(character_id, "HP-ability-mod");
            var hpFormulaMod = getAttrByName(character_id, "HP-formula-mod");
            var hitpoints = 0;

            // Get hitpoints from racial Hit Dice.
            var npcHd = getAttrByName(character_id, "npc-hd");
            var npcLevel = getAttrByName(character_id, "npc-hd-num");
            if (npcHd != null && npcLevel != null) {
                npcHd = parseInt(npcHd);
                npcLevel = parseInt(npcLevel);

                for (;npcLevel > 0; npcLevel--) {
                    hitpoints += PfCombat.getHitPoints(npcHd, option) + hpAbilityMod;
                }
                log("NPC Hitpoints = " + hitpoints);
            }

            // Get hitpoints from class Hit Dice.
            for (var classIndex=0; classIndex < 10; classIndex++) {
                var hd = getAttrByName(character_id, "class-" + classIndex + "-hd");
                var level = getAttrByName(character_id, "class-" + classIndex + "-level");
                if (hd == null || level == null || hd == "" || level == "") {
                    break;
                }
                hd = parseInt(hd);
                level = parseInt(level);
                if (hd == 0 || level == 0) {
                    break;
                }

                log(hd + ", " + level);

                if (classIndex == 0 && maxHpLevel1 == 1) {
                    hitpoints = hd + hpAbilityMod;
                    if (hitpoints < 1) {
                        hitpoints = 1;
                    }
                    level--;
                    log("First level hitpoints is " + hitpoints);
                }
                for (;level > 0; level--) {
                    var hp = PfCombat.getHitPoints(hd, option) + hpAbilityMod;
                    if (hp < 1) {
                        hp = 1;
                    }
                    log("Rolled " + hp + " hitpoints.");
                    hitpoints += hp;
                }
            }
            hitpoints += parseInt(hpFormulaMod);
            log("Total hitpoints = " + hitpoints);
            token.set("bar1_value", hitpoints);
            token.set("bar1_max", hitpoints);

            sendChat(token.get("name"), "/w GM hitpoints set to " + hitpoints);
        }
    }
}

/**
 * Heal all selected tokens to full hit points. Also removes status effects.
 */
PfCombat.healCommand = function(msg) {
    var healing = null;

    n = msg.content.split(" ");
    if (n.length > 1) {
        healing = parseInt(n[1]);
        if (healing < 1 || isNaN(healing)) {
            return;
        }
    }
    var tokenList = PfCombat.getSelectedTokens(msg);
    if (tokenList != null && tokenList.length > 0) {
        for (var i=0; i < tokenList.length; i++) {
            var tokenId = tokenList[i];
            var token = getObj("graphic", tokenId);
            if (token != null) {
                var prev = {};
                prev["bar1_value"] = token.get("bar1_value");
                prev["bar3_value"] = token.get("bar3_value");

                if (healing != null) {
                    var nonLethal = parseInt(token.get("bar3_value"));
                    if (nonLethal > 0) {
                        nonLethal -= healing;
                        if (nonLethal < 0) {
                            nonLethal = 0;
                        }
                    }
                    var hp = parseInt(token.get("bar1_value"));
                    var hpMax = parseInt(token.get("bar1_max"));
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
                        'status_snail': false
                    });
                }
                PfCombat.update(token, prev, "");
            }
        }
    }
    return;
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
PfCombat.initCommand = function(msg) {
    var turnOrder = [];
    if (Campaign().get("turnorder") != "") {
        turnOrder = JSON.parse(Campaign().get("turnorder"));
    }
    var tokenList = PfCombat.getSelectedTokens(msg);
    for (var i=0; i < tokenList.length; i++) {
        for (var ti=0; ti < turnOrder.length; ti++) {
            if (turnOrder[ti].id == tokenList[i]) {
                turnOrder.splice(ti, 1);
            }
        }
    }

    for (var tIdx=0; tIdx < tokenList.length; tIdx++) {
        var tokenId = tokenList[tIdx];
        var token = getObj("graphic", tokenId);

        var character_id = token.get("represents");
        if (character_id == null) {
            continue;
        }
        var character = getObj("character", character_id);
        var init = getAttrByName(character_id, "init");
        var dex = getAttrByName(character_id, "DEX-base");
        // Avoid dividing by 100, since this sometimes gives arithmetic
        // errors with too many dp.
        if (parseInt(dex) < 10) {
            dex = ("0" + dex);
        }
        var message = "Initiative is [[d20 + " + init + " + 0." + dex + "]]";
        var message = PfCombat.line(message);
        PfCombat.message(token, message, initiativeMsgCallback(tokenId, turnOrder, token, playerIsGM(msg.playerid)));
    }

    return;
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
    var turnOrder = [];
    if (Campaign().get("turnorder") != "") {
        turnOrder = JSON.parse(Campaign().get("turnorder"));
    }
    var tokenList = PfCombat.getSelectedTokens(msg, true);

    var tokenId = tokenList[0];
    var token = getObj("graphic", tokenId);

    var customName = token.get("name") + ":";
    var turns = args.shift();
    log("Custom init for " + customName + " for " + turns);
    while (args.length > 0) {
        customName += " " + args.shift();
    }
    log("Custom init for " + customName);

    turnOrder.push({
        "id": "-1",
        "pr": turns,
        "custom": customName,
        "formula": -1,
    });
    Campaign().set("turnorder", JSON.stringify(turnOrder));

    return;
};

/**
 * Needed when setting the turn order. Otherwise by the time the callback
 * is executed, the value of tokenId that is in scope has changed, and we
 * just end up adding the last token multiple times.
 */
function initiativeMsgCallback(tokenId, turnOrder, token, isGM) {
    return function(ops) {
        var rollresult = ops[0];
        var result = rollresult.inlinerolls[0].results.total;

        if (turnOrder == null) {
            log("turnOrder is not set in initiativeMsgCallback");
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
        if (isGM) {
            PfCombat.whisper(token, PfCombat.line("Joins combat on initiative [[d0 + " + result + "]]"));
        } else {
            PfCombat.message(token, PfCombat.line("Joins combat on initiative [[d0 + " + result + "]]"));
        }
    };
}

PfCombat.savesCommand = function(msg) {
    var params = msg.content.split(" ");
    if (params.length < 2) {
        PfCombat.usageSaves(msg, "Must specify at least a save type.");
        return;
    }
    var saveType = (""+params[1]).toLowerCase();
    var saveName = "";
    var dc = 0;

    if (params.length > 2) {
        dc = parseInt(params[2]);
    }

    var setDamage = false, setStatus = false;
    var damage = null, halfDamage = null, status = null;

    for (var i=3; i < params.length; i++) {
        var arg = params[i];

        if (arg == "0" || parseInt(arg) > 0) {
            if (damage == null) {
                damage = parseInt(arg);

                setDamage = true;
            } else if (halfDamage == null) {
                halfDamage = parseInt(arg);
            } else {
                PfCombat.usageSaves(msg, "Can only specify two damages.");
                return;
            }
        } else if (status == null) {
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

    var tokenList = PfCombat.getSelectedTokens(msg);
    if (tokenList != null && tokenList.length > 0) {
        for (var tIdx=0; tIdx < tokenList.length; tIdx++) {
            var tokenId = tokenList[tIdx];
            var token = getObj("graphic", tokenId);

            var character_id = token.get("represents");
            if (character_id == null) {
                sendChat("", "/w GM " + token.get("name") + " has no associated character");
                return;
            }
            var character = getObj("character", character_id);

            var score = getAttrByName(character_id, saveType);
            if (score == null) {
                sendChat("", "/w GM " + token.get("name") + " has no associated save attribute");
                return;
            }
            var message = "";
            if (dc == 0) {
                message = "Rolls a <b>" + saveName + "</b> save of [[d20 + " + score + "]].";
                PfCombat.message(token, PfCombat.line(message));
                continue;
            }


            var autoSuccess = false;
            var autoFail = false;
            var autoMsg = "";
            var check = randomInteger(20);
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
            var flags = [];
            var prev = [];
            prev["bar1_value"] = token.get("bar1_value");
            prev["bar1_max"] = token.get("bar1_max");
            prev["bar3_value"] = token.get("bar3_value");
            prev["bar3_max"] = token.get("bar3_max");

            if (!autoFail && (check >= dc || autoSuccess)) {
                flags['status_flying-flag'] = false;
                var text = "Succeeds on a " + saveName + " DC " + dc + " check.";
                if (setDamage && halfDamage > 0) {
                    var currentHp = parseInt(token.get("bar1_value"));
                    currentHp -= halfDamage;

                    token.set("bar1_value", currentHp);
                    text += " They take " + halfDamage + "hp damage.";
                }
                message += PfCombat.line(text);
            } else {
                if (setDamage || setStatus) {
                    var text = "Fails a " + saveName + " DC " + dc + " check.";
                    if (setDamage) {
                        var currentHp = parseInt(token.get("bar1_value"));
                        currentHp -= damage;

                        token.set("bar1_value", currentHp);
                        text += " They take " + damage + "hp damage.";
                        if (!setStatus) {
                            message += PfCombat.line(text);
                        }
                    }
                    if (setStatus) {
                        var symbol = PfCombat.status[status].status;
                        var effect = PfCombat.status[status].description;
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
    return;
};

/**
 * Damage all selected tokens by the given amount.
 * Damage is either lethal or nonlethal.
 */
PfCombat.damageCommand = function(msg) {
    var damage = 1;
    var nonlethal = false;
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

    var tokenList = PfCombat.getSelectedTokens(msg, true);
    if (tokenList == null) {
        PfCombat.error("Cannot determine list of selected tokens.");
        return;
    }
    if (tokenList.length > 0) {
        for (var i=0; i < tokenList.length; i++) {
            var tokenId = tokenList[i];
            var token = getObj("graphic", tokenId);

            log(token.get("name"));

            var currentHp = parseInt(token.get("bar1_value"));
            var nonlethalDamage = parseInt(token.get("bar3_value"));
            var prev = {};
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
    return;
};

/**
 * Check to see if any of the selected tokens stabilise.
 */
PfCombat.stabiliseCommand = function(msg) {
    var tokenList = PfCombat.getSelectedTokens(msg, true);
    if (tokenList != null && tokenList.length > 0) {
        for (var i=0; i < tokenList.length; i++) {
            var tokenId = tokenList[i];
            var token = getObj("graphic", tokenId);
            if (token == null) {
                continue;
            }

            var tokenName = token.get("name");
            var character_id = token.get("represents");
            if (character_id == null) {
                sendChat("", "/w GM " + tokenName + " has no associated character");
                return;
            }
            var character = getObj("character", character_id);

            var hpMax = token.get("bar1_max");
            var hpCurrent = token.get("bar1_value");
            var nonlethalDamage = token.get("bar3_value");
            var stable = token.get("status_green");
            var dead = token.get("status_dead");

            var constitution = getAttrByName(character_id, 'CON-mod');
            if (constitution == "") {
                constitution = 0;
            }

            if (dead == true) {
                sendChat("", "/w GM " + tokenName + " is already dead.");
            } else if (hpCurrent >= 0) {
                // Target is healthy, nothing to do.
                sendChat("", "/w GM " + tokenName + " is healthy.");
            } else if (stable == true) {
                sendChat("", "/w GM " + tokenName + " is stable.");
            } else {
                var dc = 10 - hpCurrent;
                var check = randomInteger(20) + parseInt(constitution);
                log(tokenName + " rolls " + check + " to stabilise.");
                if (check >= dc || check == constitution + 20) {
                    token.set({
                        status_green: true
                    });
                    PfCombat.update(token, null, PfCombat.getSymbolHtml("green") + PfCombat.line("<b>" + tokenName + "</b> stops bleeding.</p>"));
                } else {
                    hpCurrent -= 1;
                    token.set({
                        bar1_value: hpCurrent,
                        status_green: false
                    });
                    PfCombat.update(token, null, PfCombat.line("<b>" + tokenName + "</b> bleeds a bit more."));
                }
            }
        }
    }
    return;
};


PfCombat.getSymbolHtml = function(symbol) {
    var statuses = [
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
    var i = _.indexOf(statuses, symbol);

    if (i < 0) {
        return "";
    } else if (i < 7) {
        var colours = [ '#ff0000', '#0000ff', '#00ff00', '#ff7700', '#ff00ff', '#ff7777', '#ffff00' ];
        return "<div style='float: left; background-color: " + colours[i] + "; border-radius: 12px; width: 12px; height: 18px; display: inline-block; margin: 0; border: 0; padding: 0px 3px; margin-right: 6px'></div>";
    } else {
        return '<div style="float: left; width: 24px; height: 24px; display: inline-block; margin: 0; border: 0; cursor: pointer; padding: 0px 3px; background: url(\'https://app.roll20.net/images/statussheet.png\'); background-repeat: no-repeat; background-position: '+((-34)*(i-7))+'px 0px;"></div>';
    }
}

PfCombat.usageSaves = function(msg, errorText) {
    var text = "<i>" + errorText + "</i><br/>";
    text += "Use !pfsaves &lt;Ref|Fort|Will&gt; &lt;DC&gt; [&lt;Damage&gt; [&lt;Half-Damage&gt;]] [&lt;Effect&gt;]<br/>";
    text += "Allowed effects: ";
    for (var s in PfCombat.status) {
        text += s.replace(/ /, "-") + ", ";
    }
    text = text.replace(/, $/, ".");

    sendChat("PfDamage", "/w " + msg.who + " " + text);
}

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
}

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
    //log("PfCombat.update: " + obj.get("name") + ((prev==null)?"":", <prev>") + ", [" + message + "]");

    var takenDamage = false;
    var name = obj.get("name");
    var hpMax = parseInt(obj.get("bar1_max"));
    var hpCurrent = parseInt(obj.get("bar1_value"));
    var nonlethalDamage = parseInt(obj.get("bar3_value"));
    var stable = obj.get("status_green");
    var previousHitpoints = hpCurrent;

    if (prev != null) {
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
    var hpActual = hpCurrent - nonlethalDamage;

    var character_id = obj.get("represents");
    if (character_id == null) {
        return;
    }
    var character = getObj("character", character_id);
    if (character == null) {
        return;
    }
    var constitution = getAttrByName(character.id, 'CON');
    if (constitution == null) {
        constitution = 10;
    }
    var type = getAttrByName(character_id, 'npc-type');
    if (type == null) {
        type = "";
    }
    var living = true;

    // Non-living have special rules.
    if (type.indexOf("Undead") > -1 || type.indexOf("Construct") > -1 || type.indexOf("Inevitable") > -1 || type.indexOf("Swarm") > -1 ) {
        if (nonlethalDamage > 0) {
            obj.set({
                bar3_value: 0
            });
            hpActual += nonlethalDamage;
            nonlethalDamage = 0;

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

    if (!living && hpCurrent < 1) {
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
    } else if (hpCurrent <= 0 - constitution) {
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
        if (hpCurrent < 0 && !stable) {
            message += PfCombat.getSymbolHtml("skull");
            message += PfCombat.line("<b>" + name + "</b> is <i>dying</i>. Each turn " +
                                   "they must make a DC&nbsp;" + (10 - hpCurrent) +
                                   " CON check to stop bleeding.");
        } else if (hpCurrent < 0) {
            message += PfCombat.line("<b>" + name + "</b> is <i>dying but stable</i>.");
        } else {
            message += PfCombat.line("<b>" + name + "</b> is <i>unconscious</i>.");
        }
    } else if (hpActual == 0) {
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
        var msg = "They can only make one standard or move action each round.";
        if (hpCurrent == 0) {
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
        if (prev != null && previousHitpoints > hpMax / 3) {
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
        if (prev != null && previousHitpoints > hpMax * (2/3)) {
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
    if (prev != null && !takenDamage && previousHitpoints < hpActual) {
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
    if (message != "") {
        PfCombat.message(obj, message);
    }
}

PfCombat.getMessageBox = function(token, message, whisper = null) {
    var html = "";
    var x = 30, y = 5;
    if (whisper) {
        x += 30;
        y += 25;
    }
    if (message != null && token != null) {
        var image = token.get("imgsrc");
        var name = token.get("name");
        html += "<div style='" + PfCombat.BOX_STYLE + "'>";
        html += "<img src='"+image+"' width='50px' style='position: absolute; top: " + y +
                "px; left: " + x + "px; background-color: white; border-radius: 25px'/>";

        html += "<div style='position: absolute; top: " + (y+17) +
                "px; left: " + (x+60) + "px; border: 1px solid black; background-color: " +
                "white; padding: 0px 5px 0px 5px'>" + name + "</div>";

        html += "<div style='margin-top: 20px; padding-left: 5px'>" + message + "</div>";
        html += "</div>";

        return html;
    } else if (message != null) {
        html += "<div style='" + PfCombat.BOX_STYLE + "'>";
        html += "<div style='margin-top: 20px; padding-left: 5px'>" + message + "</div>";
        html += "</div>";
    }
    return html;
}

PfCombat.message = function(token, message, func) {
    var html = PfCombat.getMessageBox(token, message);
    if (func == null) {
        sendChat("", "/desc " + html);
    } else {
        sendChat("", "/desc " + html, func);
    }
}

PfCombat.whisper = function(token, message, func) {
    var html = PfCombat.getMessageBox(token, message, true);
    if (func == null) {
        sendChat("GM", "/w GM " + html);
    } else {
        sendChat("GM", "/w GM " + html, func);
    }
}

PfCombat.ERROR_STYLE="background-color: #FFDDDD; color: #000000; margin-top: 30px; padding:0px; border:1px dashed black; border-radius: 10px; padding: 3px; text-align: left; font-style: normal; font-weight: normal";

PfCombat.error = function(message) {
    if (message != null && message != "") {
        log("PfCombat Error: " + message);
        var html = "<div style='" + PfCombat.ERROR_STYLE + "'><b>PfCombat Error:</b> " + message + "</div>";
        sendChat("", "/desc " + html);
    }
}

