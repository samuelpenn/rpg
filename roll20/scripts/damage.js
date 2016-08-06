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

    var hpMax = token.get("bar1_max");
    var hpCurrent = token.get("bar1_value");
    var nonlethalDamage = token.get("bar3_value");
    var stable = token.get("status_green");
    var dead = token.get("status_dead");

    var constitution = getAttrByName(character_id, 'CON-mod');
    log("My CON is " + constitution);
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
        log(randomInteger(20));

        if (check >= dc) {
            sendChat("", "/w GM " + tokenName + " has stabilised with a roll of " + check + ".");
            token.set({
                status_greenmarker: true
            });
        } else {
            sendChat("", "/w GM " + tokenName + " is bleeding on a roll of " + check + " versus DC " + dc + "." );
            hpCurrent -= 1;
            token.set({
                bar1_value: hpCurrent
            });
            Damage.update(token);
        }
    }
    return;
});

var Damage = Damage || {};

on("change:graphic", function(obj) {
    Damage.update(obj);
});

Damage.update = function(obj) {
    if (obj.get("bar1_max") === "") return;

    var name = obj.get("name");
    var hpMax = obj.get("bar1_max");
    var hpCurrent = obj.get("bar1_value");
    var nonlethalDamage = obj.get("bar3_value");

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
    var message = "";

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
            status_redmarker: false,
            status_brownmarker: false
        });
        if (type.indexOf("Swarm") > -1) {
            message = name + " is <b>dispersed</b>.";
        } else {
            message = name + " is <b>destroyed</b>.";
        }
    } else if (hpCurrent <= 0 - constitution) {
        obj.set({
            status_pummeled: false,
            status_dead: true,
            status_skull: false,
            status_redmarker: false,
            status_brownmarker: false
        });
        message = name + " is <b>dead</b>.";
    } else if (hpActual < 0) {
        obj.set({
            status_pummeled: false,
            status_dead: false,
            status_skull: true,
            status_redmarker: false,
            status_brownmarker: false
        });
        if (hpCurrent < 0) {
            message = name + " is <b>dying</b>. ";
            message += "<i>On their next turn, they must make a DC " + (10 - hpCurrent) + " Constitution check or lose 1 hp.</i>";
        } else {
            message = name + " is <b>unconscious</b>.";
        }
    } else if (hpActual == 0) {
        // Staggered. Note that a character is staggered if either
        // nonlethal damage increases to their current hitpoints,
        // or their current hitpoints drops to zero.
        obj.set({
            status_pummeled: true,
            status_dead: false,
            status_skull: false,
            status_redmarker: false,
            status_brownmarker: false
        });
        if (hpCurrent == 0) {
            message = name + " is <b>disabled</b>. ";
        } else {
            message = name + " is <b>staggered</b>. ";
        }
        message += "<i>They can only make a single standard or move action each round.</i>";
    } else if (hpActual <= hpMax / 3) {
        obj.set({
            status_pummeled: false,
            status_dead: false,
            status_skull: false,
            status_redmarker: true,
            status_brownmarker: true
        });
    } else if (hpActual <= hpMax * (2/3)) {
        obj.set({
            status_pummeled: false,
            status_dead: false,
            status_skull: false,
            status_redmarker: false,
            status_brownmarker: true
        });
    } else {
        obj.set({
            status_pummeled: false,
            status_dead: false,
            status_skull: false,
            status_redmarker: false,
            status_brownmarker: false
        });
    }
    if (message != "") {
        var BOX_STYLE="background-color: #EEEE99; color: #000000; padding:0px; border:1px solid black; border-radius: 5px; padding: 5px";

        var image = character.get("avatar");

        var html = "<div style='" + BOX_STYLE + "'>";
        html += "<img src='"+image+"' width='64px' style='float:left; padding-right: 5px'/>";
        html += message;
        html += "<p style='clear:both'></p>";
        html += "</div>";

        sendChat("", html);
    }
}
