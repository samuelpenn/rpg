/**
 * Roll Skills
 *
 * Rolls a given list of skills.
 *
 * Designed to work with the Pathfinder character sheet. Bards and Skalds are
 * automatically detected (by the character classes), and untrained Knowledge
 * skills are allowed in this case.
 *
 * Usage:
 *   !skills Movement_Skills @{selected|token_id} [[d20]] Acrobatics,Climb,Escape_Artist,Swim
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
    if (msg.content.split(" ", 1)[0] === "!skills") {
        var player_obj = getObj("player", msg.playerid);
        Skills.Process(msg, player_obj);
    }
});

var Skills = Skills || {};


Skills.usage = function() {
    sendChat("", "Usage: !skills <title> @{selected|token_id} [[d20]] <list>")
}

/**
 * Setup the basic header for the character sheet template.
 */
Skills.setupTemplate = function(name, character, title) {
    var template = "&{template:pf_generic}";

    var headerImage = getAttrByName(character.id, "header_image-pf_generic");
    var colour = getAttrByName(character.id, "rolltemplate_color");
    var roundedFlag = getAttrByName(character.id, "toggle_rounded_flag");

    template += "{{header_image=" + headerImage + "}}";
    template += "{{color=" + colour + "}}";
    template += " " + roundedFlag + " ";
    template += "{{character_name=" + name + "}}";
    template += "{{subtitle=" + title + "}}";

    return template;
}

Skills.getSkill = function(character, skill, d20roll, name) {
    var ranks = getAttrByName(character.id, skill+"-ranks");
    var reqTrain = getAttrByName(character.id, skill+"-ReqTrain");

    if (reqTrain == 0 || (ranks != "" && ranks > 0)) {
        var score = parseInt(getAttrByName(character.id, skill));

        skill = skill.replace("-", " ");
        return "{{" + name + " (" + score + ")=**" + (d20roll + score) + "**}}";
    }
    return "";
}

Skills.getAttribute = function(character, attribute, d20roll, name) {
    var score = parseInt(getAttrByName(character.id, attribute+"-mod"));
    var base = parseInt(getAttrByName(character.id, attribute+"-base"));

    return "{{" + name + " (" + base + " / " + score + ")=**" + (d20roll + score) + "**}}";
}

Skills.Process = function(msg, player_obj) {
    var n = msg.content.split(" ");
    if (msg.inlinerolls == null) {
        Skills.usage();
        return;
    }
    // Get the result of the die roll.
    var d20roll = msg.inlinerolls[0].results.total;
    var isRoll = msg.inlinerolls[0].results.rolls[0].dice != null;

    var title = n[1].replace("-", " ");
    var target = getObj("graphic", n[2]);
    var skills = n[4].split(",");
    if (target == null) {
        sendChat("", "No token found.");
        Skills.usage();
        return;
    }
    var tokenName = target.get("name");
    if (!isRoll) {
        tokenName += " (Take " + d20roll + ")";
    }
    var character_id = target.get("represents")
    var character = getObj("character", character_id)

    if (character == null) {
        sendChat("", "No character found for token.");
        Skills.usage();
        return;
    }

    var template = Skills.setupTemplate(tokenName, character, title);
    if (isRoll) {
        template += "{{d20 roll=[[d0cs>21 + " + d20roll + "]]}}";
    } else {
        template += "{{Take " + d20roll + "=[[d0cs>21 + " + d20roll + "]]}}";
    }

    // Define all the Knowledge skills, and iterate through the list, outputting
    // only the ones which the character has ranks in.

    for (var s=0; s < skills.length; s++) {
        var skill = skills[s];
        if (skill.indexOf("%") == 0) {
            // This is an attribute.
            template += Skills.getAttribute(character, skill.substring(1,4).toUpperCase(),
                                            d20roll, skill.replace("%", ""));
        } else if (skill.indexOf("*") > -1) {
            // List of skills.
            var baseSkill = skill.replace("*", "");
            for (var i=1; i < 11; i++) {
                skill = baseSkill + ( (i>1)?i:"" );
                var skillName = getAttrByName(character.id, skill+"-name");
                if (skillName != null && skillName != "") {
                    template += Skills.getSkill(character, skill, d20roll, "*" + baseSkill + ": " + skillName + "*");
                }
            }
        } else {
            // Standard skill.
            template += Skills.getSkill(character, skill, d20roll, skill.replace("-", " "));
        }
    }

    sendChat("", template);

    return;

};
