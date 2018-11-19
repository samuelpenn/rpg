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
 *   !pfskills <title> <roll> <skills>
 *     title: Heading to be shown, use hyphens for spaces, e.g. Movement-Skills
 *     roll: Usually [[d20]], or [[10]] to take 10, or [[20]] to take 20.
 *     skills: Comma separated list of skills, e.g. Bluff,Sneak,Sleight-of-Hand
 *
 *   !pfskill [<roll>] <skill>
 *     roll: Optional, if missed then a separate d20 roll is made for each skill.
 *     skill: A single skill, but can be a wildcard.
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
    } else if (command === "!pfperformance") {
        PfSkills.performanceIncome(msg);
    }
});

var PfSkills = PfSkills || {};

PfSkills.usage = function() {
    sendChat("", "Usage: !pfskills <title> @{selected|token_id} [[d20]] <list>");
};



PfSkills.singleSkillCommand = function(msg) {
    var tokenList = PfCombat.getSelectedTokens(msg, true);
    if (!tokenList || tokenList.length !== 1) {
        PfSkills.error("Must have exactly one token selected.");
        return;
    }

    var d20roll = null;
    var isRoll = true;
    var notRolled = false;
    var n = msg.content.split(" ");

    // Get the result of the die roll.
    if (!msg.inlinerolls) {
        notRolled = true;
    } else {
        d20roll = msg.inlinerolls[0].results.total;
        if (!msg.inlinerolls[0].results.rolls[0].dice) {
            isRoll = false;
        }
    }

    var token = getObj("graphic", tokenList[0]);
    var characterId = token.get("represents");
    var tokenName = token.get("name");
    if (!isRoll) {
        tokenName += " (Takes " + d20roll + ")";
    }
    var characterName = getAttrByName(characterId, "character_name");

    var character = getObj("character", characterId);

    // Get the skill.
    var skillName = n[n.length - 1];
    var title = skillName.replace(/-/g, " ").replace(/%/g, " ");
    log(skillName);

    // Setup the template.
    var template = PfSkills.setupTemplate(tokenName, character, title);
    if (notRolled) {
        // Do nothing.
    } else if (isRoll) {
        template += "{{d20 roll=[[d0cs>21 + " + d20roll + "]]}}";
    } else {
        template += "{{Take " + d20roll + "=[[d0cs>21 + " + d20roll + "]]}}";
    }

    var attributes = PfSkills.getAllAttributes(characterId);
    template += PfSkills.getSkillResult(characterName, attributes, skillName, d20roll);

    var player_obj = getObj("player", msg.playerid)
    if (playerIsGM(player_obj.get("id"))) {
        sendChat(getAttrByName(character.id, "character_name"), "/w " + player_obj.get("displayname") + " " + template);
    } else {
        sendChat(getAttrByName(character.id, "character_name"), template);
    }
}

PfSkills.performanceIncome = function(msg) {
    let tokenList = PfCombat.getSelectedTokens(msg, true);
    if (!tokenList || tokenList.length !== 1) {
        PfSkills.error("Must have exactly one token selected.");
        return;
    }

    let d20roll = null;
    let isRoll = true;
    let notRolled = false;
    let args = msg.content.split(" ");
    args.shift();
    let days = parseInt(args.shift());
    let performanceSkill = args.shift();
    if (!days) {
        days = 1;
    }

    let token = getObj("graphic", tokenList[0]);
    let characterId = token.get("represents");
    let tokenName = token.get("name");
    let characterName = getAttrByName(characterId, "character_name");

    let character = getObj("character", characterId);
    let attributes = PfSkills.getAllAttributes(characterId);

    let html = "";

    log("Number of days: " + days);
    log("Specified skill: " + performanceSkill);

    let baseSkill = "Perform";
    let score = null, bestSkill = null;
    for (let i=1; i < 11; i++) {
        skill = baseSkill + ( (i>1)?i:"" );
        let skillName = PfSkills.getAttributeValue(attributes, skill + "-name");
        if (skillName) {
            log("Trying " + skillName);
            if (!performanceSkill) {
                if (score === null || parseInt(PfSkills.getAttributeValue(attributes, skill)) > score) {
                    score = parseInt(PfSkills.getAttributeValue(attributes, skill));
                    bestSkill = skillName;
                    log("Best so far is " + skillName + " at " + score);
                }
            } else if (skillName.toLowerCase() === performanceSkill.toLowerCase()) {
                log("Found match for " + skillName);
                score = parseInt(PfSkills.getAttributeValue(attributes, skill));
                performanceSkill = skillName;
                log("Has a score of " + score);
                break;
            }
        }
    }
    if (bestSkill) {
        performanceSkill = bestSkill;
    }
    if (!performanceSkill) {
        performanceSkill = "Untrained";
    }
    if (score === null) {
        score = parseInt(PfSkills.getAttributeValue(attributes, "CHA-mod"));
    }
    let title = `${tokenName} performs for ${days} day${(days>1)?"s":""}`;
    html = `<p><i>Perform (${performanceSkill}) ${score}</i></p>`;

    let cp = 0, sp = 0, gp = 0;
    for (let day=0; day < days; day++) {
        let roll = score + randomInteger(20);
        let result = "";
        if (roll >= 30) {
            let gold = randomInteger(6) + randomInteger(6) + randomInteger(6);
            gp += gold;
            result = "<b>Extraordinary (" + roll + "):</b> " + gold + "gp";
        } else if (roll >= 25) {
            let gold = randomInteger(6);
            gp += gold;
            result = "<b>Memorable (" + roll + "):</b> " + gold + "gp";
        } else if (roll >= 20) {
            let silver = randomInteger(10) + randomInteger(10) + randomInteger(10);
            sp += silver;
            result = "<b>Great (" + roll + "):</b> " + silver + "sp";
        } else if (roll >= 15) {
            let silver = randomInteger(10);
            sp += silver;
            result = "<b>Enjoyable (" + roll + "):</b> " + silver + "sp";
        } else if (roll > 10) {
            let copper = randomInteger(10);
            cp += copper;
            result = "<b>Routine (" + roll + "):</b> " + copper + "cp";
        } else {
            result = "<b>Poor (" + roll + "): </b>Nothing";
        }
        if (result) {
            html += "<p>" + result + "</p>";
        }
    }
    while (cp >= 10) {
        cp -= 10;
        sp += 1;
    }
    while (sp >= 10) {
        sp -= 10;
        gp += 1;
    }

    if (gp + sp + cp > 0) {
        html += `<p>${tokenName} earns a total of <b>`;
        if (gp > 0) html += gp + "gp ";
        if (sp > 0) html += sp + "sp ";
        if (cp > 0) html += cp + "cp ";
        html += "</b>.</p>";
    } else {
        html += `<p>${tokenName} doesn't earn anything.</p>`;
    }

    PfInfo.message(tokenName, html, title);
};


PfSkills.cache = PfSkills.cache || {};

/**
 * Setup the basic header for the character sheet template.
 */
PfSkills.setupTemplate = function(name, character, title) {
    var template = "&{template:pf_generic}";

    var cacheObj = PfSkills.cache[name];
    if (!cacheObj) {
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
PfSkills.getSkill = function(characterName, list, skill, d20roll, name, buff) {
    let ranks = PfSkills.getAttributeValue(list, skill + "-ranks");

    if (!ranks || parseInt(ranks) === 0) {
        let reqTrain = PfSkills.getAttributeValue(list, skill + "-ReqTrain");
        if (reqTrain && parseInt(reqTrain) === 1) {
            return "";
        }
    }
    let skillNote = PfSkills.getAttributeValue(list, skill + "-note");

    if (skillNote) {
        skillNote = "\n" + skillNote.replace(/@{([^|}]*)}/g, "@{"+characterName+"|$1}");
    } else {
        skillNote = "";
    }

    let score = parseInt(PfSkills.getAttributeValue(list, skill) + buff);
    if (score !== parseInt(score)) {
        return "";
    }

    skill = skill.replace("-", " ");
    let template = "";
    if (d20roll) {
        template = "{{<b>" + name + " (" + score + ")</b>" + skillNote + "=<b>" + (d20roll + score) + "</b>}}";
    } else {
        template = "{{<b>" + name + " (" + score + ")</b>" + skillNote + "=[[d20 + " + score + "]]}}";
    }
    return template;
};

PfSkills.getAttribute = function(list, attribute, d20roll, name, buff) {
    let base = parseInt(PfSkills.getAttributeValue(list, attribute));
    let cond = parseInt(PfSkills.getAttributeValue(list, "checks-cond"));

    // Calculate score ourselves, because we can do it quicker than reading
    // it from the character sheet.
    if (base >= 10) {
        var score = parseInt((base - 10) / 2);
    } else {
        var score = parseInt((base - 11) / 2);
    }

    score = score + cond + buff;

    if (d20roll) {
        return "{{" + name + " (" + base + " / " + score + ")=**" + (d20roll + score) + "**}}";
    } else {
        return "{{" + name + " (" + base + " / " + score + ")=**[[d20 + " + score + "]]**}}";
    }
};

PfSkills.defaults = PfSkills.defaults || {};

PfSkills.getSkillsBuff = function(characterId) {
    let value = getAttrByName(characterId, "buff_check_skills-total");
    if (value) {
        value = parseInt(value);
    } else {
        value = 0;
    }
    return value;
};

PfSkills.getAbilityBuff = function(characterId) {
    let value = getAttrByName(characterId, "buff_check_ability-total");
    if (value) {
        value = parseInt(value);
    } else {
        value = 0;
    }
    return value;
};

PfSkills.getDefaultValue = function(list, key) {
    if (PfSkills.defaults[key]) {
        return PfSkills.defaults[key];
    }

    let characterId = list[0].get("_characterid");
    let value = getAttrByName(characterId, key);

    PfSkills.defaults[key] = value;
    //log("Default [" + key + "]: [" + value + "]");

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
    log("Getting list of attributes");
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
    if (n[3].indexOf(",") === -1 && n[3].indexOf(";") > -1) {
        skills = n[3].split(";");
    }
    if (target == null) {
        sendChat("", "No token found.");
        PfSkills.usage();
        return;
    }
    var tokenName = target.get("name");
    if (!isRoll) {
        tokenName += " (Takes " + d20roll + ")";
    }
    var characterId = target.get("represents");
    var character = getObj("character", characterId);

    if (character == null) {
        sendChat("", "No character found for token.");
        PfSkills.usage();
        return;
    }
    var characterName = getAttrByName(characterId, "character_name");

    //PfSkills.timer("Prepare template");
    var template = PfSkills.setupTemplate(tokenName, character, title);
    if (isRoll) {
        template += "{{d20 roll=[[d0cs>21 + " + d20roll + "]]}}";
    } else {
        template += "{{Take " + d20roll + "=[[d0cs>21 + " + d20roll + "]]}}";
    }

    // Define all the Knowledge skills, and iterate through the list, outputting
    // only the ones which the character has ranks in.

    //PfSkills.timer("Getting attributes");
    var attributes = PfSkills.getAllAttributes(characterId);
    //PfSkills.timer("Got attributes");

    let skillsBuff = PfSkills.getSkillsBuff(characterId);
    let abilityBuff = PfSkills.getAbilityBuff(characterId);

    for (var s=0; s < skills.length; s++) {
        var skill = skills[s];

        template += PfSkills.getSkillResult(characterName, attributes, skill, d20roll, skillsBuff, abilityBuff);
    }
    //PfSkills.timer("Done");

    if (playerIsGM(player_obj.get("id"))) {
        sendChat(characterName, "/w " + player_obj.get("displayname") + " " + template);
    } else {
        sendChat(characterName, template);
    }

    return;
};

PfSkills.getSkillResult = function(characterName, attributes, skill, d20roll, skillsBuff, abilityBuff) {
    var html = "";
    if (skill.indexOf("%") == 0) {
        // This is an attribute.
        html += PfSkills.getAttribute(attributes, skill.substring(1,4).toUpperCase(),
                                        d20roll, skill.replace("%", ""), abilityBuff);
    } else if (skill.indexOf("*") > -1) {
        // List of skills.
        var baseSkill = skill.replace("*", "");
        for (var i=1; i < 11; i++) {
            skill = baseSkill + ( (i>1)?i:"" );
            var skillName = PfSkills.getAttributeValue(attributes, skill + "-name");
            if (skillName != null && skillName != "") {
                html += PfSkills.getSkill(characterName, attributes, skill, d20roll, "*" + baseSkill + ": " + skillName + "*", skillsBuff);
            } else {
                break;
            }
        }
    } else {
        // Standard skill.
        html += PfSkills.getSkill(characterName, attributes, skill, d20roll, skill.replace(/-/g, " "), skillsBuff);
    }
    return html;
};


PfSkills.ERROR_STYLE="background-color: #FFDDDD; color: #000000; margin-top: 30px; padding:0px; border:1px dashed black; border-radius: 10px; padding: 3px; text-align: left; font-style: normal; font-weight: normal";

PfSkills.error = function(message) {
    if (message != null && message != "") {
        log("PfSkills Error: " + message);
        var html = "<div style='" + PfCombat.ERROR_STYLE + "'><b>PfSkills Error:</b> " + message + "</div>";
        sendChat("", "/desc " + html);
    }
}
