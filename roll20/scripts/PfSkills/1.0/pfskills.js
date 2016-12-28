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
    } else if (command === "!pfskill") {
        PfSkills.singleSkillCommand(msg);
    }
});

var PfSkills = PfSkills || {};

PfSkills.usage = function() {
    sendChat("", "Usage: !pfskills <title> @{selected|token_id} [[d20]] <list>");
};

PfSkills.singleSkillCommand = function(msg) {
    var tokenList = PfCombat.getSelectedTokens(msg, true);
    if (tokenList == null || tokenList.length != 1) {
        PfSkills.error("Must have exactly one token selected.");
        return;
    }
    var token = getObj("graphic", tokenList[0]);
    var characterId = token.get("represents");

    var skillName = msg.content.split(" ")[1];
}

PfSkills.cache = PfSkills.cache || {};

/**
 * Setup the basic header for the character sheet template.
 */
PfSkills.setupTemplate = function(name, character, title) {
    var template = "&{template:pf_generic}";

    var cacheObj = PfSkills.cache[name];
    if (cacheObj == null) {
        var headerImage = getAttrByName(character.id, "header_image-pf_generic");
        var colour = getAttrByName(character.id, "rolltemplate_color");

        PfSkills.cache[name] = {'img': headerImage, 'colour': colour };
        cacheObj = PfSkills.cache[name];
    }
    var headerImage = cacheObj.img;
    var colour = cacheObj.colour;

    //var roundedFlag = getAttrByName(character.id, "toggle_rounded_flag");

    template += "{{header_image=" + headerImage + "}}";
    template += "{{color=" + colour + "}}";
    //template += " " + roundedFlag + " ";
    template += "{{character_name=" + name + "}}";
    template += "{{subtitle=" + title + "}}";

    return template;
};


/**
 * Reading character sheet attributes is very slow, so we want to try and optimise
 * things to make as few requests as possible.
 */
PfSkills.getSkill = function(list, skill, d20roll, name) {
    var ranks = PfSkills.getAttributeValue(list, skill + "-ranks");
    if (ranks == null || ranks == "" || ranks == 0) {
        var reqTrain = PfSkills.getAttributeValue(list, skill + "-ReqTrain");
        if (reqTrain == 1) {
            return "";
        }
    }

    var score = parseInt(PfSkills.getAttributeValue(list, skill));

    skill = skill.replace("-", " ");
    return "{{" + name + " (" + score + ")=**" + (d20roll + score) + "**}}";
};

PfSkills.getAttribute = function(list, attribute, d20roll, name) {
    var base = parseInt(PfSkills.getAttributeValue(list, attribute+"-base"));
    var cond = parseInt(PfSkills.getAttributeValue(list, "checks-cond"));

    // Calculate score ourselves, because we can do it quicker than reading
    // it from the character sheet.
    if (base >= 10) {
        var score = parseInt((base - 10) / 2);
    } else {
        var score = parseInt((base - 11) / 2);
    }

    score = score + cond;

    return "{{" + name + " (" + base + " / " + score + ")=**" + (d20roll + score) + "**}}";
};

PfSkills.defaults = PfSkills.defaults || {};

PfSkills.getDefaultValue = function(list, key) {
    if (PfSkills.defaults[key] != null) {
        return PfSkills.defaults[key];
    }

    var characterId = list[0].get("_characterid");
    var value = getAttrByName(characterId, key);

    PfSkills.defaults[key] = value;
    log("Default [" + key + "]: [" + value + "]");

    return value;
};

/**
 * Get the current value of the named attribute from our array.
 */
PfSkills.getAttributeValue = function(list, key) {
    for (var i=0; i < list.length; i++) {
        if (list[i].get("name") == key) {
            return list[i].get("current");
        }
    }
    return PfSkills.getDefaultValue(list, key);
};

/**
 * Get all the attributes for this character, into one big array.
 */
PfSkills.getAllAttributes = function(characterId) {
    var list = findObjs({
        type: 'attribute',
        characterid: characterId
    });

    return list;
};

PfSkills.startTime = 0;
PfSkills.timer = function(label) {
    log(label + ": " + (new Date().getTime() - PfSkills.startTime));
};

PfSkills.Process = function(msg, player_obj) {
    var n = msg.content.split(" ");
    if (n.length != 4) {
        PfSkills.usage();
        return;
    }
    if (msg.inlinerolls == null) {
        sendChat("", "Roll parameter must be an inline roll");
        PfSkills.usage();
        return;
    }
    PfSkills.startTime = new Date().getTime();
    var tokenList = PfCombat.getSelectedTokens(msg, true);
    if (tokenList == null || tokenList.length != 1) {
        PfSkills.error("Must have exactly one token selected (have " + ((tokenList==null)?0:tokenList.length) + ").");
        return;
    }
    var target = getObj("graphic", tokenList[0]);

    // Get the result of the die roll.
    var d20roll = msg.inlinerolls[0].results.total;
    var isRoll = msg.inlinerolls[0].results.rolls[0].dice != null;

    var title = n[1].replace("-", " ");
    var skills = n[3].split(",");
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

    PfSkills.timer("Prepare template");
    var template = PfSkills.setupTemplate(tokenName, character, title);
    if (isRoll) {
        template += "{{d20 roll=[[d0cs>21 + " + d20roll + "]]}}";
    } else {
        template += "{{Take " + d20roll + "=[[d0cs>21 + " + d20roll + "]]}}";
    }

    // Define all the Knowledge skills, and iterate through the list, outputting
    // only the ones which the character has ranks in.

    PfSkills.timer("Getting attributes");
    var attributes = PfSkills.getAllAttributes(character_id);
    for (var i=0; i < attributes.length; i++) {
        //log(attributes[i].get("name") + ": " + attributes[i].get("current"));
    }
    PfSkills.timer("Got attributes");

    for (var s=0; s < skills.length; s++) {
        var skill = skills[s];

        if (skill.indexOf("%") == 0) {
            // This is an attribute.
            template += PfSkills.getAttribute(attributes, skill.substring(1,4).toUpperCase(),
                                            d20roll, skill.replace("%", ""));
        } else if (skill.indexOf("*") > -1) {
            // List of skills.
            var baseSkill = skill.replace("*", "");
            for (var i=1; i < 11; i++) {
                skill = baseSkill + ( (i>1)?i:"" );
                //var skillName = getAttrByName(character.id, skill+"-name");
                var skillName = PfSkills.getAttributeValue(attributes, skill + "-name");
                if (skillName != null && skillName != "") {
                    template += PfSkills.getSkill(attributes, skill, d20roll, "*" + baseSkill + ": " + skillName + "*");
                } else {
                    break;
                }
            }
        } else {
            // Standard skill.
            template += PfSkills.getSkill(attributes, skill, d20roll, skill.replace("-", " "));
        }
    }
    PfSkills.timer("Done");

    if (playerIsGM(player_obj.get("id"))) {
        sendChat(getAttrByName(character.id, "character_name"), "/w " + player_obj.get("displayname") + " " + template);
    } else {
        sendChat(getAttrByName(character.id, "character_name"), template);
    }

    return;
};

PfSkills.ERROR_STYLE="background-color: #FFDDDD; color: #000000; margin-top: 30px; padding:0px; border:1px dashed black; border-radius: 10px; padding: 3px; text-align: left; font-style: normal; font-weight: normal";

PfSkills.error = function(message) {
    if (message != null && message != "") {
        log("PfSkills Error: " + message);
        var html = "<div style='" + PfCombat.ERROR_STYLE + "'><b>PfSkills Error:</b> " + message + "</div>";
        sendChat("", "/desc " + html);
    }
}
