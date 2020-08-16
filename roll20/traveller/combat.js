/**
 * Automated Damage Tracking
 *
 * Automatically tracks damage and hit points for a character, updating the
 * token with the current status. It also allows automated stabilisation
 * checks for creatures on negative hit points.
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


var Combat = Combat || {};
Combat.VERSION = "1.0";

Combat.ROUND_MARKER = "==== Start of Round ====";

on("ready", function() {
    log(`==== Traveller Combat Version ${Combat.VERSION} ====`);

});


/**
 * Single event handler for all chat messages.
 */
on("chat:message", function(msg) {
    if (msg.type !== "api") return;
    let args = msg.content.replace(/ +/, " ").split(" ");
    let command = args.shift();
    let playerId = msg.playerid;

    if (command === "!heal") {
        let tokens = Combat.getSelectedTokens(msg, false);
        Combat.healCommand(tokens);
    }
    if (command === "!attack" || command === "!attacks") {
        let tokens = Combat.getSelectedTokens(msg, false);
        Combat.attackCommand(playerId, tokens, args);
    }
    if (command === "!skill") {
        let tokens = Combat.getSelectedTokens(msg, false);
        Combat.skillCommand(playerId, tokens, args);
    }
    if (command === "!skills") {
        let tokens = Combat.getSelectedTokens(msg, false);
        Combat.listSkillsCommand(playerId, tokens, args);
    }
    if (command === "!react") {
        let tokens = Combat.getSelectedTokens(msg, false);
        Combat.reactCommand(playerId, tokens, args);
    }
    if (command === "!name") {
        let tokens = Combat.getSelectedTokens(msg, false);
        Combat.nameCommand(playerId, tokens);
    }
    if (command === "!set") {
        let tokens = Combat.getSelectedTokens(msg, false);
        Combat.setCommand(playerId, tokens, args);
    }
});

/**
 * Returns an array of all the tokens selected, or a list of all
 * controlled tokens if none are selected. List is returned as an
 * array of token ids.
 *
 * Tokens are guaranteed to have a name, and to represent a valid
 * character.
 *
 * If forceExplicit is passed as true, then only allow a single
 * target unless they are explicity selected.
 */
Combat.getSelectedTokens = function (msg, forceExplicit) {
    let tokenList = [];
    let token = null;

    if (!msg) {
        return null;
    }

    if (!forceExplicit) {
        forceExplicit = false;
    }

    if (msg.selected && msg.selected.length > 0) {
        for (let i=0; i < msg.selected.length; i++) {
            token = getObj("graphic", msg.selected[i]._id);
            if (!token || !token.get("name")) {
                continue;
            }
            tokenList.push(token);
        }
    } else if (!playerIsGM(msg.playerid)) {
        let currentObjects = findObjs({
            _pageid: Campaign().get("playerpageid"),
            _type: "graphic",
        });
        for (let i=0; i < currentObjects.length; i++) {
            token = currentObjects[i];
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
                    tokenList.push(token);
                }
            }
        }
        if (forceExplicit && tokenList.length !== 1) {
            log("Combat.getSelectedTokens: forceExplicit is set, and " + tokenList.length + " tokens found.");
            return null;
        }
    }

    return tokenList;
};


Combat.healCommand = function (tokens) {
    log("healCommand:");
    if (tokens && tokens.length > 0) {
        for (let i = 0; i < tokens.length; i++) {
            let token = tokens[i];
            if (token) {
                let endMax = parseInt(token.get("bar3_max"));
                let strMax = parseInt(token.get("bar1_max"));
                let dexMax = parseInt(token.get("bar2_max"));

                if (strMax > 0 && dexMax > 0) {
                    log("healCommand: Complex");
                    token.set({
                        bar3_value: endMax,
                        bar1_value: strMax,
                        bar2_value: dexMax
                    });
                } else {
                    log("healCommand: Simple");
                    token.set({
                        bar3_value: endMax
                    });
                }
                Combat.setStatus(token, endMax, strMax, dexMax, (strMax + dexMax == 0)?endMax:0);
            }
        }
    }
};

on("change:graphic", function(token, prev) {
    if (token.get("_pageid") === Campaign().get("playerpageid")) {
        Combat.updateHits(token, prev, "");
    }
});

Combat.setStatus = function(token, endCur, strCur, dexCur, hits) {
    let showHurt = false;
    let showDown = false;
    let showDead = false;

    if (hits > 0) {
        if (endCur <= 0) {
            showDead = true;
        } else if (endCur <= parseInt(hits / 10)) {
            showDown = true;
        } else if (endCur <= parseInt(hits / 2)) {
            showHurt = true;
        }
    } else {

        if (endCur + strCur + dexCur <= 0) {
            showDead = true;
        } else if (strCur <= 0 || dexCur <= 0) {
            showDown = true;
        } else if (endCur <= 0) {
            showHurt = true;
        }
    }
    token.set({
        status_dead: showDead,
        status_brown: showHurt,
        status_skull: showDown
    });
};

Combat.DEAD = 0;
Combat.UNCONSCIOUS = 1;
Combat.HURT = 2;
Combat.OKAY = 3;

Combat.getStatus = function(end, str, dex, hits) {
    let status = Combat.OKAY;

    if (hits > 0) {
        if (end <= parseInt(hits / 2)) {
            status = Combat.HURT;
        }
        if (end <= parseInt(hits / 10)) {
            status = Combat.UNCONSCIOUS;
        }
        if (end <= 0) {
            status = Combat.DEAD;
        }
    } else {
        if (end <= 0) {
            status = Combat.HURT;
        }
        if (str <= 0 || dex <= 0) {
            status = Combat.UNCONSCIOUS;
        }
        if (end <= 0 && str <= 0 && dex <= 0) {
            status = Combat.DEAD;
        }
    }
    return status;
};


Combat.getInt = function(token, key) {
    let val = token.get(key);
    if (val === null || val === "") {
        return 0;
    }
    return parseInt(val);
};

/**
 * Called when a token is updated. We check the damage values (bar1 and bar3)
 * and set status on the token depending on results.
 * The prev object contains a map of previous values prior to the token changing,
 * so we can tell how much damage the token has just taken.
 *
 * bar3 (Red)   - End
 * bar1 (Green) - Str
 * bar2 (Blue)  - Dex
 */
Combat.updateHits = function(token, prev, message) {
    log("updateHits:");
    if (token == null || token.get("bar3_max") === "") return;
    if (message == null) {
        message = "";
    }

    let takenDamage = false;
    let endDamaged = false;
    let strDamaged = false;
    let dexDamaged = false;
    let name = token.get("name");

    let endMax = Combat.getInt(token, "bar3_max");
    let strMax = Combat.getInt(token, "bar1_max");
    let dexMax = Combat.getInt(token, "bar2_max");

    let endCur = Combat.getInt(token, "bar3_value");
    let strCur = Combat.getInt(token, "bar1_value");
    let dexCur = Combat.getInt(token, "bar2_value");

    // If this token doesn't had Str and Dex set, it is a simple animal that only has 'hits'.
    let hits = 0;
    let hitsTaken = 0;
    if (strMax + dexMax == 0) {
        hits = endMax;
    }

    let prevStatus = Combat.OKAY;
    if (prev) {
        if (endCur == prev["bar3_value"] && endMax == prev["bar3_max"] && strCur == prev["bar1_value"] && dexCur == prev["bar2_value"]) {
            // Whatever has changed is nothing to do with us.
            log("updateHits: Nothing changed");
            return;
        }
        let endPrev = parseInt(prev["bar3_value"]);
        let strPrev = parseInt(prev["bar1_value"]);
        let dexPrev = parseInt(prev["bar2_value"]);

        log(`${endPrev} / ${strPrev} / ${dexPrev} -> ${endCur} / ${strCur} / ${dexCur}`);

        if (endCur < endPrev) {
            takenDamage = true;
            endDamaged = true;
            hitsTaken = endPrev - endCur;
        }
        if (strCur < strPrev) {
            takenDamage = true;
            strDamaged = true;
        }
        if (dexCur < dexPrev) {
            takenDamage = true;
            dexDamaged = true;
        }
        prevStatus = Combat.getStatus(endPrev, strPrev, dexPrev, hits);
    }
    Combat.setStatus(token, endCur, strCur, dexCur, hits);

    if (takenDamage && hits > 0) {
        let overkill = 0;
        if (endCur < 0) {
            overkill = endCur;
            endCur = 0;
            token.set({
                bar3_value: endCur
            });
        }
        let status = Combat.getStatus(endCur, 0, 0, hits);
        Combat.setStatus(token, endCur, 0, 0, hits);
        if (status === Combat.HURT && prevStatus === Combat.OKAY) {
            Combat.hurtMessage(token, hitsTaken);
        } else if (status === Combat.UNCONSCIOUS && prevStatus > Combat.UNCONSCIOUS) {
            Combat.unconsciousMessage(token, hitsTaken);
        } else if (status === Combat.DEAD && prevStatus > Combat.DEAD) {
            Combat.deadMessage(token, hitsTaken, overkill);
        }
    } else if (takenDamage && endDamaged) {
        log("updateHits: Taken damage to END");
        if (endCur >= 0) {
            log("updateHits: Still okay");
            return;
        }
        // END is now negative.
        let overkill = 0;
        let dmg = parseInt(0 - endCur);
        endCur = 0;
        if (dmg < strCur && (strCur < dexCur || dmg >= dexCur)) {
            // We can take it off STR safely.
            strCur -= dmg;
        } else if (dmg < dexCur) {
            // We can take it off DEX safely.
            dexCur -= dmg;
        } else {
            // We can't take it off either safely, so take off STR first.
            strCur -= dmg;
            if (strCur < 0) {
                dmg = -strCur;
                dexCur += strCur;
                strCur = 0;
            }
            if (dexCur < 0) {
                overkill = dexCur;
                dexCur = 0;
            }
        }
        Combat.setStatus(token, endCur, strCur, dexCur, hits);
        token.set({
            bar3_value: endCur,
            bar1_value: strCur,
            bar2_value: dexCur,
        });
        let status = Combat.getStatus(endCur, strCur, dexCur, hits);
        if (status === Combat.HURT && prevStatus === Combat.OKAY) {
            Combat.hurtMessage(token, hitsTaken);
        } else if (status === Combat.UNCONSCIOUS && prevStatus > Combat.UNCONSCIOUS) {
            Combat.unconsciousMessage(token, hitsTaken);
        } else if (status === Combat.DEAD && prevStatus > Combat.DEAD) {
            Combat.deadMessage(token, hitsTaken, overkill);
        }
    }
};

Combat.hurtMessage = function(token, dmg) {
    let messages = [ "scratched", "hurt", "injured", "a bit hurt" ];
    let message = token.get("name") + " ";

    if (dmg > 0) {
        message += `took <b>${dmg}</b> hits and is ${messages[randomInteger(messages.length - 1)]}.`;
    } else {
        message += `is ${messages[randomInteger(messages.length - 1)]}.`;
    }
    message += "<br/><i>They are still standing.</i>";
    Combat.message(token, message);
};

Combat.unconsciousMessage = function(token, dmg) {
    let messages = [ "is knocked unconscious", "is knocked out", "falls over", "collapses" ];
    let message = token.get("name") + " ";

    if (dmg > 0) {
        message += `took <b>${dmg}</b> hits and ${messages[randomInteger(messages.length - 1)]}.`;
    } else {
        message += ` ${messages[randomInteger(messages.length - 1)]}.`;
    }
    message += "<br/><i>They are now unconscious.</i>";
    Combat.message(token, message);
};

Combat.deadMessage = function(token, dmg, overkill) {
    let message = token.get("name") + " ";

    let roll = randomInteger(6) + randomInteger(6);
    if (overkill > -3) {
        roll += 4;
    } else if (overkill > -6) {
        roll +=2;
    } else if (overkill > -9) {
        roll += 0;
    } else {
        roll += parseInt(overkill / 5);
    }
    log(roll);
    if (roll < 2) {
        message += "is killed instantly and finally.";
    } else if (roll <= 3) {
        message += "is mortally wounded and will die in [[1D3]] rounds.";
    } else if (roll <= 5) {
        message += "will die in [[2D6]] rounds unless given medical (10+) assistance. They will suffer " +
                  "a permanent major injury, such as loss of a limb or eye.";
    } else if (roll <= 7) {
        message += "will die in [[1D6]] minutes unless given medical (8+) assistance. If they survive, " +
            "they will lose 1D from any one of STR, DEX or END, and D3 from the others.";
    } else if (roll <= 9) {
        message += "will survive if given basic medical (6+) assistance within [[3D6]] minutes. " +
            "If they do not receive proper medical treatment whilst recovering, they will permanently lose " +
            "D3 points from both STR and END.";
    } else if (roll <= 11) {
        message += "will survive despite their injuries and will make a full recovery if medical (4+) " +
            "attention is successfully provided in [[1D6]] hours.";
    } else {
        message += "is terribly hurt but will somehow cling to life and begin to recover even if " +
            "medical attention is not provided. They will recover consciousness in [[1D6]] hours.";
    }
    Combat.message(token, message);
};


Traveller.COMBAT_STYLE="background-color: #EEDDDD; color: #000000; padding:2px; border:1px solid black; text-align: left; font-weight: normal; font-style: normal; min-height: 80px";


Combat.whisper = function(token, message, func) {
    let html = "<div style='" + Traveller.COMBAT_STYLE + "'>";

    let name = token.get("name");
    let image = token.get("imgsrc");

    html += `<img style='float:right' width='64' alt='${name}' src='${image}'>`;
    html += `<h3 style='display: inline-block; border-bottom: 2px solid black; margin-bottom: 2px;'>${name}</h3><br/>`;
    html += message;

    html += "</div>";

    if (func) {
        sendChat(name, "/w GM " + html, func);
    } else {
        sendChat(name, "/w GM " + html);
    }
};

Combat.message = function(token, message, func) {
    let html = "<div style='" + Traveller.COMBAT_STYLE + "'>";

    let name = token.get("name");
    let image = token.get("imgsrc");

    html += `<img style='float:right' width='64' alt='${name}' src='${image}'>`;
    html += `<h3 style='display: inline-block; border-bottom: 2px solid black; margin-bottom: 2px;'>${name}</h3><br/>`;
    html += message;

    html += "</div>";

    if (func) {
        sendChat("", "/desc " + html, func);
    } else {
        sendChat("", "/desc " + html);
    }
};

Combat.getValue = function(list, key) {
    // noinspection JSUnresolvedFunction
    log("getValue: [" + key + "]");
    for (let i=0; i < list.length; i++) {
        if (list[i].get("name") == key) {
            return list[i].get("current");
        }
    }
    return "";
};

Combat.getValueInt = function(list, key) {
    let value = Combat.getValue(list, key);
    if (value === null || value === "") {
        return 0;
    }
    return parseInt(value) || 0;
};

Combat.listAttacks = function(playerId, token, list) {
    let message = "Attacks available:<br/>";
    for (let i=0; i < list.length; i++) {
        let key = list[i].get("name");
        let current = list[i].get("current");
        if (key.indexOf("weapon_name-") === 0 && current.length > 0) {
            log("Looking at [" + current + "]");
            let id = key.replace(/[^0-9]*/g, "");
            log(id);
            let name = current;
            let dm = Combat.getValue(list, "weapon_DM-" + id);
            let dmMod = Combat.getValueInt(list, dm.replace(/[^a-zA-Z_-]*/g, ""));
            let skill = Combat.getValueInt(list, "weapon_skill-" + id);
            let dmg = Combat.getValue(list, "weapon_damage-" + id);
            let range = Combat.getValueInt(list, "weapon_range-" + id);

            let s = dmMod + skill;
            if (s >= 0) {
                s = `+${s}`;
            }
            message += `[${name} : ${s} / ${dmg} / ${range}m](!attack ${name})<br/>`;
        }
    }
    if (playerIsGM(playerId)) {
        Combat.whisper(token, message);
    } else {
        Combat.message(token, message);
    }

};


Combat.makeAttack = function(playerId, token, list, id, boon, dm) {
    log("makeAttack: [" + id + "]");
    let name = Combat.getValue(list,"weapon_name-" + id);
    let wpnDm = Combat.getValue(list, "weapon_DM-" + id);
    let addDmToDmg = (wpnDm.indexOf("Strength") > -1);
    let dmMod = parseInt(Combat.getValue(list, wpnDm.replace(/[^a-zA-Z_-]*/g, "")));
    let strMod = parseInt(Combat.getValue(list, "mod-Strength"));
    let skill = parseInt(Combat.getValue(list, "weapon_skill-" + id));
    let dmg = Combat.getValue(list, "weapon_damage-" + id);
    let range = Combat.getValueInt(list, "weapon_range-" + id);

    if (range === 0) {
        // If using Strength, add Strength DM to damage.
        dmg += " + " + strMod;
    }

    let reactPenalty = Combat.getReact(token);
    let message = "<div style='line-height: 150%'>";
    message += `Attacks with <b>${name}</b>:<br/>`;
    message += `<b>${name}</b> / ${dmMod} + ${skill} / ${dmg}<br/>`;
    if (reactPenalty > 0) {
        message += `<i>Penalty from reactions -${reactPenalty}</i><br/>`;
    }

    let dice = "2d6";
    let mod = "";
    if (boon < 0) {
        dice = "3d6kl2";
        mod = "Bane"
    } else if (boon > 0) {
        dice = "3d6k2";
        mod = "Boon"
    }
    if (dm > 0) {
        mod += "+" + dm;
    } else if (dm < 0) {
        mod += dm;
    }
    if (mod != "") {
        mod = " (" + mod + ")";
    }

    message += `<b>Attack${mod}:</b> [[${dice} + ${dmMod} + ${skill} + ${dm} - ${reactPenalty}]]<br/>`;
    message += `<b>Damage:</b> [[${dmg}]]<br/>`;
    if (range === 0) {
        message += `<b>Range:</b> Melee (+${strMod} STR)`;
    } else {
        let short = parseInt(range / 4);
        let medium = parseInt(range);
        let long = parseInt(range * 2);
        let extreme = parseInt(range * 4);
        message += `<b>Range:</b> ${short}m (+1) / <b>${medium}m</b> / ${long}m (-2) / ${extreme}m (-4)`;
    }
    message += "</div>";

    if (playerIsGM(playerId)) {
        Combat.whisper(token, message);
    } else {
        Combat.message(token, message);
    }
};

Combat.attackCommand = function(playerId, tokens, args) {
    log("attackCommand:");
    let boon = 0;
    let dm = 0;

    let attack = "";
    while (args.length > 0) {
        let arg = args.shift();
        if (arg === "+") {
            boon = 1;
            log("Boon");
        } else if (arg === "-") {
            boon = -1;
            log("Bane");
        } else if (arg.match("^[+-][0-9]")) {
            dm = parseInt(arg);
            log("DM is [" + dm + "]");
        } else {
            attack += arg + " ";
        }
    }
    attack = attack.trim();

    sendChat("", `/desc ${tokens.length} attacks with ${attack}`);
    for (let i=0; i < tokens.length; i++) {
        Combat.attack(playerId, tokens[i], attack, boon, dm);
    }
};


Combat.attack = function(playerId, token, attack, boon, dm) {
    if (token === null) {
        log("No token");
        return;
    }
    let characterId = token.get("represents");
    if (characterId) {
        let character = getObj("character", characterId);
        if (!character) {
            log("No character");
            return;
        }

        log("Getting list of attributes");
        let list = findObjs({
            type: 'attribute',
            characterid: characterId
        });
        if (attack === "") {
            Combat.listAttacks(playerId, token, list);
            return;
        }

        log(`[${token.get("name")} with [${attack}]`);

        // Look for the best weapon match:
        //   If there is an exact match, use the first one found.
        //   Otherwise use the first begins with match we find.
        //   Otherwise use the first contains in match we find.
        // If you have attacks defind: "Laser Pistol", "Laser Rifle", "Laser", then
        //   "laser" will match to "Laser"
        //   "las" will match to "Laser Pistol"
        //   "rifle" will match to "Laser Rifle"
        //   "r" will match to "Laser Pistol"
        let idx = -1;
        for (let i=0; i < list.length; i++) {
            let key = list[i].get("name");
            let current = list[i].get("current");
            //log(name + ": " + current);
            if (key.indexOf("weapon_name-") === 0) {
                log("Looking at [" + current + "]");
                if (current.toLowerCase() === attack.toLowerCase()) {
                    log("We have an exact match [" + key + "]!");
                    idx = parseInt(key.replace(/[^0-9]*/g, ""));
                    break;
                } else if (idx < 1000 && current.toLowerCase().indexOf(attack.toLowerCase()) == 0) {
                    log("We have a begin match [" + key + "]!");
                    idx = 1000 + parseInt(key.replace(/[^0-9]*/g, ""));
                } else if (idx < 0 && current.toLowerCase().indexOf(attack.toLowerCase()) > -1) {
                    log("We have a contains match [" + key + "]!");
                    idx = parseInt(key.replace(/[^0-9]*/g, ""));
                }
            }
        }
        if (idx > -1) {
            Combat.makeAttack(playerId, token, list, idx % 1000, boon, dm);
        } else {
            Combat.message(token, "Cannot find attack <b>" + attack + "</b>");
        }
    }
};

/**
 * Creatures a function for a callback. Need to ensure we preserve the variable state during the callback.
 * This is called after Roll20 rolls the dice, so we can then add the speciality bonuses and display them
 * as well.
 */
Combat.skillRollCallBack = function(playerId, token, list, mod, skillChar, skillName, skillKey, untrained, skillCharMod, skillLevel, dm) {
    return function(ops) {
        let rollresult = ops[0];
        let diceTotal = rollresult.inlinerolls[0].results.total;
        let reactPenalty = Combat.getReact(token);

        let message = "<div style='line-height: 150%'>";
        skillChar = skillChar.substring(0, 3).toUpperCase();
        message += `<b>${skillChar}</b> [${skillCharMod}] + <b>${skillName}</b> [${skillLevel}]<br/>`;
        if (reactPenalty > 0) {
            message += `<i>Penalty from reactions -${reactPenalty}</i><br/>`;
        }
        message += `<b>${skillName}${mod}:</b> [[d0 + ${diceTotal}[Dice] + ${skillCharMod}[${skillChar}] + ${skillLevel}[Skill] + ${dm}[DM] - ${reactPenalty}[React]]]<br/>`;

        log("Look for specialisations based on " + skillKey);

        let m = "repeating_" + skillKey.toLowerCase() + "spec_.*skill";

        // There are a pair of values for each speciality, the name and the level.
        // Need to find them all, and match them up before we can output them.
        let specs = [];
        for (let i=0; i < list.length; i++) {
            let key = list[i].get("name").toLowerCase();
            if (key.match(m)) {
                let x = key.replace(/.*_-/, "").replace(/_.*$/, "");
                if (!specs[x]) {
                    specs[x] = new Object();
                    specs[x]["level"] = 0;
                }
                let o = specs[x];
                if (key.indexOf("skillspeciality") > -1) {
                    o["name"] = list[i].get("current");
                } else if (key.indexOf("skilllevel") > -1) {
                    o["level"] = parseInt(list[i].get("current"));
                }
            }
        }

        for (let spec in specs) {
            log(spec);
            log("Spec is " + specs[spec]["name"]);

            let specName = specs[spec]["name"];
            let specLevel = specs[spec]["level"];
            let s = specLevel;
            if (s >= 0) {
                s = `+${specLevel}`;
            }
            message += `<i>${specName} [${s}]</i>: [[d0 + ${diceTotal}[Dice] + ${skillCharMod}[${skillChar}] + ${skillLevel + specLevel}[Skill] + ${dm}[DM]]]<br/>`;
        }

        message += "</div>";

        if (playerIsGM(playerId)) {
            Combat.whisper(token, message);
        } else {
            Combat.message(token, message);
        }
    };

};

Combat.makeSkillRoll = function(playerId, token, list, skillChar, skillKey, boon, dm) {
    let dice = "2d6";
    let mod = "";
    if (boon < 0) {
        dice = "3d6kl2";
        mod = "Bane"
    } else if (boon > 0) {
        dice = "3d6k2";
        mod = "Boon"
    }
    if (dm > 0) {
        mod += "+" + dm;
    } else if (dm < 0) {
        mod += dm;
    }
    if (mod != "") {
        mod = " (" + mod + ")";
    }

    let skillCharMod = Combat.getValueInt(list, "mod-"+skillChar);

    if (skillKey === null) {
        skillChar = skillChar.substring(0, 3).toUpperCase();
        let message = `<b>${skillChar}</b>${mod} [${skillCharMod}] [[${dice}]]`;
        if (playerIsGM(playerId)) {
            Combat.whisper(token, message);
        } else {
            Combat.message(token, message);
        }
        return;
    }

    let name = skillKey.replace(/([a-z])([A-Z])/g, "$1 $2");
    let skillLevel = Combat.getValueInt(list, "skilllevel-"+skillKey);

    let untrained = Combat.getValueInt(list, "untrained-"+skillKey);
    if (Combat.getValue(list, "untrained-"+skillKey) == "") {
        // Jack of all Trades reduces the penalty for not having a skill.
        let jack = Combat.getValueInt(list, "skilllevel-JackOfAllTrades");
        untrained = -3;
        if (parseInt(jack) > 0) {
            untrained += parseInt(jack);
            if (untrained > 0) {
                untrained = 0;
            }
        }
    }
    skillLevel += untrained;

    message = `[[${dice}]]`;

    sendChat("", message, Combat.skillRollCallBack(playerId, token, list, mod, skillChar, name, skillKey, untrained, skillCharMod, skillLevel, dm));
};


Combat.listSkillsCommand = function(playerId, tokens, args) {
    let token = tokens[0];

    let characterId = token.get("represents");
    if (characterId) {
        let character = getObj("character", characterId);
        if (!character) {
            log("No character");
            return;
        }

        log("Getting list of attributes");
        let list = findObjs({
            type: 'attribute',
            characterid: characterId
        });

        let message = "";
        message += "Characteristics:<br/>";
        message += "[STR (" + Combat.getValueInt(list, "mod-Strength") + ")](!skill STR) ";
        message += "[DEX (" + Combat.getValueInt(list, "mod-Dexterity") + ")](!skill DEX) ";
        message += "[END (" + Combat.getValueInt(list, "mod-Endurance") + ")](!skill END) ";
        message += "<br/>";
        message += "[INT (" + Combat.getValueInt(list, "mod-Intellect") + ")](!skill INT) ";
        message += "[EDU (" + Combat.getValueInt(list, "mod-Education") + ")](!skill EDU) ";
        message += "[SOC (" + Combat.getValueInt(list, "mod-Social") + ")](!skill SOC) ";

        message += "<br/>";
        message += "Skills available:<br/>";
        for (let i = 0; i < list.length; i++) {
            let key = list[i].get("name");
            let current = list[i].get("current");

            if (key.match(/[0-9]_show$/) || key.match(/_spec_show$/) || key.match(/JackOfAllTrades/)) {
                continue;
            }

            if (key.match("show$")) {
                let skillName = key.replace(/_show/, "");
                let name = skillName.replace(/([a-z])([A-Z])/g, "$1 $2");
                let char = Combat.getValue(list, "skillCharacteristicDM-"+skillName);
                let mod = Combat.getValueInt(list, "skilllevel-"+skillName);
                if (current === 1) {
                    char = char.replace(/.*([A-Z][a-z]*).*/g, "$1");
                    message += `[${name}-${mod}](!skill ${char} ${name}) `;
                }
            }
        }

        if (playerIsGM(playerId)) {
            Combat.whisper(token, message);
        } else {
            Combat.message(token, message);
        }
    }
};

Combat.skill = function(playerId, token, char, skill, boon, dm) {
    if (token === null) {
        log("No token");
        return;
    }
    let characterId = token.get("represents");
    if (characterId) {
        let character = getObj("character", characterId);
        if (!character) {
            log("No character");
            return;
        }

        log("Getting list of attributes");
        let list = findObjs({
            type: 'attribute',
            characterid: characterId
        });
        if (skill === "" || skill === null) {
            // Just roll the characteristic.
            log("No skill");
            Combat.makeSkillRoll(playerId, token, list, char, null, boon, dm);
            return;
        }

        log(`[${token.get("name")} with [${skill}]`);

        let skillKeyName = skill.toLowerCase().replace(/ /g, "");

        // Search for a matching skill, looking at skills in order, in preference of:
        //   Exact match is preferred over
        //   Begins with match, which is preferred over
        //   Contains in match
        // So a search for "i" will find "Investigate" (not "Admin"), and "Combat" will
        // find "Gun Combat", but "Gun" will find "Gunner", and "x" finds "Explosives"
        let foundKey = null;
        let startMatch = false;
        for (let i=0; i < list.length; i++) {
            let key = list[i].get("name");

            if (key.indexOf("_show") === -1 || key.match("[0-9]")) {
                // Get rid of anything that isn't a basic skill
                continue;
            }
            if (key.toLowerCase() === skillKeyName + "_show") {
                log("Found exact match [" + key + "]");
                foundKey = key.replace(/_show/, "");
                break;
            } else if (!startMatch && key.toLowerCase().indexOf(skillKeyName) === 0) {
                log("Found start match [" + key + "]");
                foundKey = key.replace(/_show/, "");
                startMatch = true;
            } else if (foundKey === null && key.toLowerCase().indexOf(skillKeyName) > -1) {
                log("Found contains match [" + key + "]");
                foundKey = key.replace(/_show/, "");
            }
        }
        if (foundKey != null) {
            Combat.makeSkillRoll(playerId, token, list, char, foundKey, boon, dm);
            return;
        }

        log("Haven't found anything, look again for " + skillKeyName);

        // Oops, we haven't found anything. Now look for a skill the character doesn't have.
        // Not sure that we need this anymore. Leaving it here just in case.
        for (let i=0; i < list.length; i++) {
            let key = list[i].get("name");
            let current = list[i].get("current");

            if (key.toLowerCase() === skillKeyName) {
                log("Found key [" + key + "]");
                Combat.makeSkillRoll(playerId, token, list, char, key, boon, dm);
                return;
            }
        }
        sendChat("", "Can't find a skill named " + skillKeyName);


    }
};

Combat.skillCommand = function(playerId, tokens, args) {
    log("====== skillCommand ======");
    let boon = 0;
    let dm = 0;
    let char = "";
    let skill = "";

    let chars = [ "Intellect", "Education", "Social", "Strength", "Dexterity", "Endurance" ];
    char = args.shift().toLowerCase();
    let found = false;
    for (let i = 0; i < chars.length; i++) {
        if (chars[i].toLowerCase().indexOf(char) == 0) {
            char = chars[i];
            found = true;
            break;
        }
    }
    if (!found) {
        log("Not found matching characteristic");
        return;
    }
    log("Found [" + char + "]");

    while (args.length > 0) {
        let arg = args.shift();
        if (arg === "+") {
            boon = 1;
            log("Boon");
        } else if (arg === "-") {
            boon = -1;
            log("Bane");
        } else if (arg.match("^[+-][0-9]")) {
            dm = parseInt(arg);
            log("DM is [" + dm + "]");
        } else {
            skill += arg + " ";
        }
    }
    skill = skill.trim();

    //sendChat("", `/desc ${tokens.length} uses skill ${skill}`);
    for (let i=0; i < tokens.length; i++) {
        Combat.skill(playerId, tokens[i], char, skill, boon, dm);
    }
};

Combat.setCommand = function(playerId, tokens, args) {
    log("====== setCommand ======");

    for (let i=0; i < tokens.length; i++) {
        let token = tokens[i];

        let characterId = token.get("represents");
        if (!characterId) {
            log("No character");
            return;
        }

        let character = getObj("character", characterId);
        if (!character) {
            log("No character");
            return;
        }

        log("Getting list of attributes");
        let list = findObjs({
            type: 'attribute',
            characterid: characterId
        });

        if (args.length === 0) {
            let str = Combat.getValueInt(list, "base-Strength");
            let dex = Combat.getValueInt(list, "base-Dexterity");
            let end = Combat.getValueInt(list, "base-Endurance");

            token.set({
                bar3_value: end,
                bar3_max: end,
                bar1_value: str,
                bar1_max: str,
                bar2_value: dex,
                bar2_max: dex
            });
        }
    }

};

Combat.reactCommand = function(playerId, tokens, args) {
    log("====== reactCommand ======");
    let value = null;
    if (args.length > 0) {
        value = parseInt(args.shift());
    }

    for (let i=0; i < tokens.length; i++) {
        Combat.react(tokens[i], value);
    }
};

Combat.react = function(token, value) {
    let reacts = token.get("status_blue");
    log("Reactions: " + reacts);

    if (value != null) {
        reacts = parseInt(value);
    } else if (reacts) {
        reacts = parseInt(reacts) + 1;
    } else {
        reacts = 1;
    }
    token.set("status_blue", (reacts > 0)?reacts:false);
};

// Gets the current penalty from dodging and other reactions.
Combat.getReact = function(token) {
    let reacts = token.get("status_blue");
    if (reacts && parseInt(reacts) > 0) {
        return parseInt(reacts);
    }
    return 0;
};

/**
 * Gets a list of all the names on the current page, which is determined by the
 * token that is passed. The occurrences of each name is counted, and returned
 * as hash map with the count.
 *
 * @param token Token to use in order to determine the current page.
 */
Combat.getCurrentNames = function(token) {
    let nameList = {};

    if (!token || !token.get("_pageid")) {
        return nameList;
    }

    let tokens = findObjs({
        _pageid: token.get("_pageid"),
        _type: "graphic"
    });
    for (let i=0; i < tokens.length; i++) {
        let t = tokens[i];
        if (t && t.get("name")) {
            let name = t.get("name");
            if (!nameList[name]) {
                nameList[name] = 1;
            } else {
                nameList[name] ++;
            }
        }
    }

    return nameList;
};


Combat.name = function(nameList, token) {
    let currentName = token.get("name");
    let name = null;

    if (currentName.indexOf("#") !== -1) {
        // Is already a numbered mook. Is it a duplicate?
        if (nameList[currentName] > 1) {
            currentName = currentName.replace(/ #.*/, "");
        }
    }

    if (currentName.indexOf("#") === -1) {
        for (let suffix = 1; suffix < 1000; suffix ++) {
            name = currentName + " #" + suffix;
            if (!nameList[name]) {
                log(`${currentName} -> ${name}`);
                token.set("name", name);
                nameList[name] = 1;

                // Is this a multi-sided token?
                let sides = token.get("sides").split("|");
                log(sides.length);
                log(token.get("currentside") + " or " + token.get("currentSide"));
                if (sides.length > 0) {
                    let side = (suffix - 1) % sides.length;
                    log(side);
                    token.set("currentSide", side);
                    token.set("imgsrc", decodeURIComponent(sides[side]).replace(/max/, "thumb"));
                }
                break;
            }
        }
    }
};

Combat.nameCommand = function(playerId, tokens) {
    if (!playerIsGM(playerId)) {
        log("Player is not the GM");
        return;
    }

    let nameList = Combat.getCurrentNames(tokens[0]);
    for (let i=0; i < tokens.length; i++) {
        Combat.name(nameList, tokens[i]);
    }
};
