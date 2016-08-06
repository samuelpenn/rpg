/**
 * Roll Knowledge Skills
 *
 * Rolls all of a character's knowledge and lore skills at once. Only displays
 * those skills that a character actually possesses. Every skill uses the same
 * die roll (which is shown first).
 *
 * Designed to work with the Pathfinder character sheet. Bards and Skalds are
 * automatically detected (by the character classes), and untrained Knowledge
 * skills are allowed in this case.
 *
 * Usage:
 *   !knowledge @{selected|token_id} [[d20]]
 *   !knowledge @{selected|token_id} [[10]]
 *   !knowledge @{selected|token_id} [[20]]
 *   !knowledge @{selected|token_id} [[?{Roll|d20,d20|Take 10,10|Take 20,20}]]
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
 *
 */
on("chat:message", function(msg) {
    if (msg.type !== "api") return;
    if (msg.content.split(" ", 1)[0] === "!knowledge") {
        var player_obj = getObj("player", msg.playerid);
        Knowledge.Process(msg, player_obj);
    }
});

var Knowledge = Knowledge || {};


Knowledge.usage = function() {
    sendChat("", "Usage: !knowledge @{selected|token_id} [[d20]]")
}

/**
 * Setup the basic header for the character sheet template.
 */
Knowledge.setupTemplate = function(name, character) {
    var template = "&{template:pf_generic}";

    var headerImage = getAttrByName(character.id, "header_image-pf_generic");
    var colour = getAttrByName(character.id, "rolltemplate_color");
    var roundedFlag = getAttrByName(character.id, "toggle_rounded_flag");

    template += "{{header_image=" + headerImage + "}}";
    template += "{{color=" + colour + "}}";
    template += " " + roundedFlag + " ";
    template += "{{character_name=" + name + "}}";
    template += "{{subtitle=Knowledge Skills}}";

    return template;
}

/**
 * Is this character a bard? If it has any Bard levels, then it is,
 * and therefore we should allow untrained Knowledge checks.
 */
Knowledge.isBard = function(character) {
    var c = 0;
    while (c < 10) {
        var classNameAttr = "class-"+c+"-name";

        var className = getAttrByName(character.id, classNameAttr);
        if (className != null) {
            className = className.toLowerCase();
            if (className == "bard" || className == "skald") {
                return true;
            }
        }
        c++;
    }

    return false;
}

Knowledge.Process = function(msg, player_obj) {
    var n = msg.content.split(" ");
    if (msg.inlinerolls == null) {
        Knowledge.usage();
        return;
    }
    // Get the result of the die roll.
    var d20roll = msg.inlinerolls[0].results.total;
    var isRoll = msg.inlinerolls[0].results.rolls[0].dice != null;

    var target = getObj("graphic", n[1]);
    if (target == null) {
        sendChat("", "No token found.");
        Knowledge.usage();
        return;
    }
    var title = target.get("name");
    var character_id = target.get("represents")
    var character = getObj("character", character_id)

    if (character == null) {
        sendChat("", "No character found for token.");
        Knowledge.usage();
        return;
    }

    var template = Knowledge.setupTemplate(title, character);
    if (isRoll) {
        template += "{{d20 roll=[[d0cs>21 + " + d20roll + "]]}}";
    } else {
        template += "{{Take " + d20roll + "=[[d0cs>21 + " + d20roll + "]]}}";
    }

    // Basic intelligence roll.
    var intelligence = getAttrByName(character.id, "INT-mod");
    template += "{{Intelligence (" + intelligence + ")=**" + (d20roll + intelligence) + "**}}";

    var isBard = Knowledge.isBard(character);

    // Define all the Knowledge skills, and iterate through the list, outputting
    // only the ones which the character has ranks in.
    var skills = [ "Knowledge-Arcana", "Knowledge-Dungeoneering",
                   "Knowledge-Engineering", "Knowledge-Geography",
                   "Knowledge-History", "Knowledge-Local",
                   "Knowledge-Nature", "Knowledge-Nobility",
                   "Knowledge-Planes", "Knowledge-Religion"
                 ];

    for (var s=0; s < skills.length; s++) {
        var skill = skills[s];
        var ranks = getAttrByName(character.id, skill+"-ranks");
        if (isBard || (ranks != "" && ranks > 0)) {
            var score = parseInt(getAttrByName(character.id, skill));

            skill = skill.replace("Knowledge-", "");
            template += "{{"+skill+" (" + score + ")=**" + (d20roll + score) + "**}}";
        }
    }

    // Now find all the lore skills.
    for (var l=1; l < 11; l++) {
        var skill = "Lore" + ( (l>1)?l:"" );
        var ranks = getAttrByName(character.id, skill+"-ranks");
        if (ranks != "" && ranks > 0) {
            var score = parseInt(getAttrByName(character.id, skill));
            var lore = getAttrByName(character.id, skill+"-name");

            template += "{{*"+lore+"* (" + score + ")=**" + (d20roll + score)  + "**}}";
        }
    }

    sendChat("", template);

    return;

};
