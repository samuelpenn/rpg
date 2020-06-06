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
    let args = msg.content.split(" ");
    let command = args.shift();
    let playerId = msg.playerid;

    if (command === "!heal") {
        let tokens = Combat.getSelectedTokens(msg, false);
        Combat.healCommand(tokens);
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
        status_red: showDown
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
        if (endCur < 0) {
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
            Combat.deadMessage(token, hitsTaken);
        }
    } else if (takenDamage && endDamaged) {
        log("updateHits: Taken damage to END");
        if (endCur >= 0) {
            log("updateHits: Still okay");
            return;
        }
        // END is now negative.
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
            Combat.deadMessage(token, hitsTaken);
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

Combat.deadMessage = function(token, dmg) {
    let messages = [ "is killed", "is killed" ];
    let message = token.get("name") + " ";

    if (dmg > 0) {
        message += `took <b>${dmg}</b> hits and ${messages[randomInteger(messages.length - 1)]}.`;
    } else {
        message += ` ${messages[randomInteger(messages.length - 1)]}.`;
    }
    message += "<br/><i>They are dead.</i>";
    Combat.message(token, message);
};


Traveller.COMBAT_STYLE="background-color: #EEDDDD; color: #000000; padding:2px; border:1px solid black; text-align: left; font-weight: normal; font-style: normal; min-height: 80px";

Combat.message2 = function(name, message) {
    let html = "<div style='" + Traveller.BOX_STYLE + "; text-align: left; padding: 3px; font-weight: normal; '>";
    html += `<b>${name}: </b>${message}`;
    html += "</div>";
    sendChat("", "/desc " + html, null);
};

Combat.message = function(token, message) {
    let html = "<div style='" + Traveller.COMBAT_STYLE + "'>";

    let name = token.get("name");
    let image = token.get("imgsrc");
    log(image);

    html += `<img style='float:right' width='64' src='${image}'>`;
    html += `<h3 style='display: inline-block; border-bottom: 2px solid black; margin-bottom: 2px;'>${name}</h3><br/>`;
    html += message;

    html += "</div>";

    sendChat("", "/desc " + html);
};
