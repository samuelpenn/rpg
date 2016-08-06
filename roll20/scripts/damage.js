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
 *
 * ISC License
 *
 * Copyright (c) 2016, Samuel Penn, sam@glendale.org.uk
 *
 * Permission to use, copy, modify, and/or distribute this software for any
 * purpose with or without fee is hereby granted, provided that the above
 * copyright notice and this permission notice appear in all copies.
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
 * WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
 * ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
 * WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
 * ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
 * OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
 */

on("chat:message", function(msg) {
    if (msg.type !== "api") return;
    if (msg.content.split(" ", 1)[0] != "!stabilise") return;

    var params = msg.content.split(" ");
    if (params.length != 2) {
        return;
    }
    var tokenId = params[1];
    var token = getObj("graphic", tokenId);
    if (token == null) {
        sendChat("", "/w GM Token not found");
        return;
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
        var check = randomInteger(20) + constitution;

        if (check >= dc || check == constitution + 20) {
            token.set({
                status_green: true
            });
            Damage.update(token, null, "<p><b>" + tokenName + "</b> stops bleeding.</p>");
        } else {
            hpCurrent -= 1;
            token.set({
                bar1_value: hpCurrent,
                status_green: false
            });
            Damage.update(token, null, "<p><b>" + tokenName + "</b> bleeds a bit more.</p>");
        }
    }
    return;
});

var Damage = Damage || {};

on("change:graphic", function(obj, prev) {
    Damage.update(obj, prev, "");
});

Damage.BOX_STYLE="background-color: #DDDDAA; color: #000000; padding:0px; border:1px solid black; border-radius: 5px; padding: 5px";

Damage.line = function(message) {
    return "<p>" + message + "</p>";
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
            hpActual = hpCurrent;
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
            message += Damage.line("<b>" + name + "</b> is <i>dying</i>. On their next " +
                                   "turn, they must make a DC " + (10 - hpCurrent) +
                                   " Constitution check or lose 1 hp.");
        } else if (hpCurrent < 0) {
            message += Damage.line("<b>" + name + "</b> is <i>dying but stable</i>. No further checks are necessary.");
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
        var msg = "They can only make a single standard or move action each round.";
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
    } else if (hpActual <= hpMax * (2/3)) {
        obj.set({
            status_pummeled: false,
            status_dead: false,
            status_skull: false,
            status_red: false,
            status_brown: true,
            status_green: false
        });
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
        Damage.message(character, message);
    }
}

Damage.message = function(character, message) {
    if (message != null) {
        var image = character.get("avatar");
        var html = "<div style='" + Damage.BOX_STYLE + "'>";
        html += "<table><tr><td style='width:68px; vertical-align: top'>";
        html += "<img src='"+image+"' width='64px' style='float:left; padding-right: 5px;'/>";
        html += "</td><td style='width:auto; vertical-align: top'>";
        html += message;
        html += "</td></tr></table>";
        html += "</div>";

        sendChat("", html);
    }
}
