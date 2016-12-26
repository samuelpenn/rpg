/**
 * Roll Skills
 *
 * Designed to work with the Pathfinder character sheet for Roll20.
 *
 * Given a character and a named list of skills, rolls once and applies that
 * roll to each of the skills in turn, displaying their total. If the character
 * has no ranks in a skill, and it requires training, then that skill will not
 * be listed.
 *
 * Can also handle attributes (prefix with '%', e.g. '%Strength') or specialised
 * skills such as Craft and Profession (suffix with '*', e.g. 'Perform*').
 *
 * Allows 'Take 10' and 'Take 20', which can be selected at runtime with a
 * macro (example given below).
 *
 * Usage:
 *   !skills <title> <token_id> <roll> <skills>
 *     title: Heading to be shown, use hyphens for spaces, e.g. Movement-Skills
 *     token_id: Usually @{selected|token_id}
 *     roll: Usually [[d20]], or [[10]] to take 10, or [[20]] to take 20.
 *     skills: Comma separated list of skills, e.g. Bluff,Sneak,Sleight-of-Hand
 *
 * There cannot be any spaces in any of the parameters.
 *
 * If you want the player to be able to dynamically select whether to roll,
 * Take 10 or Take 20, then use something like this for the 'roll' parameter:
 *   [[?{Roll|d20,d20|Take 10,10|Take 20,20}]]
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
on("chat:message", function(msg) {
    if (msg.type !== "api") {
        return;
    }
    var command = msg.content.split(" ", 1)[0];

    if (command === "!pfskills") {
        var player_obj = getObj("player", msg.playerid);
        PfSkills.Process(msg, player_obj);
    }
});

var PfSkills = PfSkills || {};

PfSkills.usage = function() {
    sendChat("", "Usage: !skills <title> @{selected|token_id} [[d20]] <list>");
};

/**
 * Setup the basic header for the character sheet template.
 */
PfSkills.setupTemplate = function(name, character, title) {
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
};

PfSkills.getSkill = function(character, skill, d20roll, name) {
    var ranks = getAttrByName(character.id, skill+"-ranks");
    var reqTrain = getAttrByName(character.id, skill+"-ReqTrain");

    if (reqTrain == 0 || (ranks != "" && ranks > 0)) {
        var score = parseInt(getAttrByName(character.id, skill));

        skill = skill.replace("-", " ");
        return "{{" + name + " (" + score + ")=**" + (d20roll + score) + "**}}";
    }
    return "";
};

PfSkills.getAttribute = function(character, attribute, d20roll, name) {
    var score = parseInt(getAttrByName(character.id, attribute+"-mod"));
    var base = parseInt(getAttrByName(character.id, attribute+"-base"));
    var cond = parseInt(getAttrByName(character.id, "checks-cond"));

    score = score + cond;

    return "{{" + name + " (" + base + " / " + score + ")=**" + (d20roll + score) + "**}}";
};

PfSkills.Process = function(msg, player_obj) {
    var n = msg.content.split(" ");
    if (n.length != 5) {
        PfSkills.usage();
        return;
    }
    if (msg.inlinerolls == null) {
        sendChat("", "Roll parameter must be an inline roll");
        PfSkills.usage();
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
        PfSkills.usage();
        return;
    }
    var tokenName = target.get("name");
    if (!isRoll) {
        tokenName += " (Takes " + d20roll + ")";
    }
    var character_id = target.get("represents");
    var character = getObj("character", character_id);

    if (character == null) {
        sendChat("", "No character found for token.");
        PfSkills.usage();
        return;
    }

    var template = PfSkills.setupTemplate(tokenName, character, title);
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
            template += PfSkills.getAttribute(character, skill.substring(1,4).toUpperCase(),
                                            d20roll, skill.replace("%", ""));
        } else if (skill.indexOf("*") > -1) {
            // List of skills.
            var baseSkill = skill.replace("*", "");
            for (var i=1; i < 11; i++) {
                skill = baseSkill + ( (i>1)?i:"" );
                var skillName = getAttrByName(character.id, skill+"-name");
                if (skillName != null && skillName != "") {
                    template += PfSkills.getSkill(character, skill, d20roll, "*" + baseSkill + ": " + skillName + "*");
                }
            }
        } else {
            // Standard skill.
            template += PfSkills.getSkill(character, skill, d20roll, skill.replace("-", " "));
        }
    }

    if (playerIsGM(player_obj.get("id"))) {
        sendChat(getAttrByName(character.id, "character_name"), "/w " + player_obj.get("displayname") + " " + template);
    } else {
        sendChat(getAttrByName(character.id, "character_name"), template);
    }

    return;
};
