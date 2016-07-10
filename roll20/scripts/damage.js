/**
 * Calculates damage and hitpoints for Pathfinder, and updates tokens
 * with current status.
 *
 * bar1 is hitpoints, both current hitpoints and maximum. It goes down as
 * a character takes damage.
 *
 * bar3 is nonlethal damage. It goes up as a character takes damage.
 */

on("change:graphic", function(obj) {
    if (obj.get("bar1_max") === "") return;

    var name = obj.get("name");
    var hpMax = obj.get("bar1_max");
    var hpCurrent = obj.get("bar1_value");
    var nonlethalDamage = obj.get("bar3_value");

    if (nonlethalDamage === "") {
        nonlethalDamage = 0;
    }
    var hpActual = hpCurrent - nonlethalDamage;

    var character_id = obj.get("represents")
    var character = getObj("character", character_id);
    var constitution = getAttrByName(character_id, 'CON');
    if (constitution == "") {
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
        html += "<img src='"+image+"' width='64px' style='float:left'/>";
        html += message;
        html += "<p style='clear:both'></p>";
        html += "</div>";

        sendChat("", html);
    }
});
