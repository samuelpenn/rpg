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
 * Macro Option:
 *
 * There is an api command that can be called from a macro as follows:
 *   !stabilise @{selected|token_id}
 *
 * This will automate a constitution check against the current DC for the
 * character to stabilise. On success, a green marker is placed on the
 * token, and further attempts to stabilise are ignored. On failure, the
 * token's hit points are reduced by 1.
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

/**
 * Heal all selected tokens to full hit points.
 */
on("chat:message", function(msg) {
    if (msg.type !== "api") return;
    if (msg.content.split(" ", 1)[0] != "!heal") return;

    if (msg.selected.length > 0) {
        for (var i=0; i < msg.selected.length; i++) {
            var tokenId = msg.selected[i]._id;
            var token = getObj("graphic", tokenId);
            if (token != null) {
                token.set("bar1_value", token.get("bar1_max"));
                token.set("bar3_value", 0);
                token.set({
                    status_pummeled: false,
                    status_dead: false,
                    status_skull: false,
                    status_red: false,
                    status_brown: false,
                    status_green: false
                });
            }
        }
    }
    return;
});

/**
 * Damage all selected tokens by the given amount.
 * Damage is either lethal or nonlethal.
 */
on("chat:message", function(msg) {
    if (msg.type !== "api") return;
    if (msg.content.split(" ", 1)[0] != "!damage") return;

    var damage = 1;
    var nonlethal = false;
    n = msg.content.split(" ");

    if (n.length > 1) {
        damage = parseInt(n[1]);
        if (damage < 1 || isNaN(damage)) {
            return;
        }
        log("Damage is " + damage);
    }
    if (n.length > 2 && n[2] == "nonlethal") {
        nonlethal = true;
    }

    if (msg.selected.length > 0) {
        for (var i=0; i < msg.selected.length; i++) {
            var tokenId = msg.selected[i]._id;
            var token = getObj("graphic", tokenId);

            log(token.get("name"));

            var currentHp = parseInt(token.get("bar1_value"));
            var nonlethalDamage = parseInt(token.get("bar3_value"));



            if (nonlethal) {
                token.set("bar3_value", nonlethalDamage + damage);
            } else {
                log("Real hp was " + currentHp);
                currentHp -= damage;
                log("Real hp is now " + currentHp);
                token.set("bar1_value", currentHp);
            }
            Damage.update(token, null, "");
        }
    }
    return;
});

/**
 * Check to see if any of the selected tokens stabilise.
 */
on("chat:message", function(msg) {
    if (msg.type !== "api") return;
    if (msg.content.split(" ", 1)[0] != "!stabilise") return;

    if (msg.selected.length > 0) {
        for (var i=0; i < msg.selected.length; i++) {
            var tokenId = msg.selected[i]._id;
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
                    Damage.update(token, null, Damage.line("<b>" + tokenName + "</b> stops bleeding.</p>"));
                } else {
                    hpCurrent -= 1;
                    token.set({
                        bar1_value: hpCurrent,
                        status_green: false
                    });
                    Damage.update(token, null, Damage.line("<b>" + tokenName + "</b> bleeds a bit more."));
                }
            }
        }
    }
    return;
});

var Damage = Damage || {};

on("change:graphic", function(obj, prev) {
    Damage.update(obj, prev, "");
});

Damage.BOX_STYLE="background-color: #EEEEDD; color: #000000; margin-top: 30px; padding:0px; border:1px dashed black; border-radius: 10px; padding: 3px";

Damage.line = function(message) {
    return "<p style='margin:0px; padding:0px; padding-bottom: 2px; font-weight: normal; font-style: normal; text-align: left'>" + message + "</p>";
}

Damage.update = function(obj, prev, message) {
    if (obj.get("bar1_max") === "") return;
    if (message == null) {
        message = "";
    }

    var takenDamage = false;
    var name = obj.get("name");
    var hpMax = obj.get("bar1_max");
    var hpCurrent = obj.get("bar1_value");
    var nonlethalDamage = obj.get("bar3_value");
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

        previousHitpoints = prev["bar1_value"] - prev["bar3_value"]
    }

    if (nonlethalDamage === "") {
        nonlethalDamage = 0;
    }
    var hpActual = hpCurrent - nonlethalDamage;

    var character_id = obj.get("represents");
    var character = getObj("character", character_id);
    var constitution = getAttrByName(character.id, 'CON');
    if (constitution == null) {
        constitution = 10;
    }
    var type = getAttrByName(character_id, 'npc-type');
    if (type == null) {
        type = "";
    }
    var living = true;

    // Undead have special rules.
    if (type.indexOf("Undead") > -1 || type.indexOf("Construct") > -1 || type.indexOf("Inevitable") > -1 || type.indexOf("Swarm") > -1 ) {
        if (nonlethalDamage > 0) {
            obj.set({
                bar3_value: 0
            });
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
            message += Damage.line("<b>" + name + "</b> is <i>dispersed</i>.");
        } else {
            message += Damage.line("<b>" + name + "</b> is <i>destroyed</i>.");
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
        message += Damage.line("<b>" + name + "</b> is <i>dead</i>.");
    } else if (hpActual < 0) {
        obj.set({
            status_pummeled: false,
            status_dead: false,
            status_skull: true,
            status_red: false,
            status_brown: false
        });
        if (hpCurrent < 0 && !stable) {
            message += Damage.line("<b>" + name + "</b> is <i>dying</i>. Each turn " +
                                   "they must make a DC&nbsp;" + (10 - hpCurrent) +
                                   " CON check to stop bleeding.");
        } else if (hpCurrent < 0) {
            message += Damage.line("<b>" + name + "</b> is <i>dying but stable</i>.");
        } else {
            message += Damage.line("<b>" + name + "</b> is <i>unconscious</i>.");
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
            message += Damage.line("<b>" + name + "</b> is <i>disabled</i>. " + msg);
        } else {
            message += Damage.line("<b>" + name + "</b> is <i>staggered</i>. " + msg);
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
            message += Damage.line("<b>" + name + "</b> is now <i>heavily wounded</i>.");
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
            message += Damage.line("<b>" + name + "</b> is now <i>moderately wounded</i>.");
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
    if (message != "") {
        Damage.message(obj, message);
    }
}

Damage.message = function(token, message) {
    if (message != null) {
        var image = token.get("imgsrc");
        var name = token.get("name");
        var html = "<div style='" + Damage.BOX_STYLE + "'>";
        html += "<img src='"+image+"' width='50px' style='position: absolute; top: 5px; left: 30px; background-color: white; border-radius: 25px'/>";
        html += "<div style='position: absolute; top: 22px; left: 90px; border: 1px solid black; background-color: white; padding: 0px 5px 0px 5px'>" + name + "</div>";
        html += "<div style='margin-top: 20px; padding-left: 5px'>" + message + "</div>";
        html += "</div>";

        sendChat("", "/desc " + html);
    }
}
