/**
 * Output a description of a character to the chat window.
 *
 * If the character has a Picture attribute, then the URL from this is used to
 * download an image, otherwise the standard avatar image is used. This allows
 * images to be used without uploading them to Roll20.
 *
 * The 'bio' field is used for the text of the character description. However,
 * it also checks the 'gmnotes' section of the token, looking for any text
 * between '~~' sequences. If found, these are appended to the end of the
 * description. This allows token specific descriptive text to be added.
 *
 * e.g. Text such as "~~Her leg is broken.~~" will cause "Her leg is broken."
 * to be added to the description. If multiple such sequences are found, they
 * are all output on separate lines.
 *
 * All HTML formatting is preserved.
 *
 * The MIT License (MIT)
 *
 * Copyright (c) 2017, Samuel Penn, sam@glendale.org.uk
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

var PfInfo = PfInfo || {};

PfInfo.VERSION = "2.0";

PfInfo.gmHelp = PfInfo.gmHelp || {};
PfInfo.playerHelp = PfInfo.playerHelp || {};

on("ready", function() {
    log(`==== PfInfo Version ${PfInfo.VERSION} ====`);
    log(`Type !pfhelp for help.`);

    PfInfo.addPlayerHelp("!pfhelp", "This message text.");
    PfInfo.addPlayerHelp("!pfsetstatus", "Args: <b>status</b>, <b>[value]</b><br/>Set the status on the selected token.");
    PfInfo.addPlayerHelp("!pfunsetstatus", "Args: <b>status</b>, <b>[value]</b><br/>Unset the status on the selected token.");
    PfInfo.addGmHelp("!pfinfo", "Args: <b>tokenId</b><br/>Output status and information on a token and character.");
});

PfInfo.addGmHelp = function(command, text) {
    PfInfo.gmHelp[command] = text;
};

PfInfo.addPlayerHelp = function(command, text) {
    PfInfo.playerHelp[command] = text;
};

PfInfo.getArgs = function(msg) {
    if (msg && msg.content) {
        return msg.content.split(" ");
    }  else {
        return [];
    }
};


PfInfo.help = function(playerId) {
    let html = `<div style='${PfInfo.BOX_STYLE}'>`;
    let player = getObj("player", playerId);

    if (playerIsGM(playerId)) {
        html += "<h3>GM Commands</h3>";
        for (let i in PfInfo.gmHelp) {
            html += `<h4>${i}</h4>`;
            html += `<p>${PfInfo.gmHelp[i]}</p>`;
        }
        html += "<h3>Player Commands</h3>";
    }

    for (let i in PfInfo.playerHelp) {
        html += `<h4>${i}</h4>`;
        html += `<p>${PfInfo.playerHelp[i]}</p>`;
    }
    html += "</div>";

    sendChat("PfInfo", `/w "${player.get('_displayname')}" ${html}`);
};

PfInfo.error = function(player, message) {
    if (!message) {
        message = "Unknown error.";
    }

    try {
        if (player && typeof(player) === "object") {
            sendChat("PfInfo", `/w "${player.get("_displayname")}" ${message}`);
        } else if (player && typeof(player) === "string") {
            let player = getObj("player", player);
            if (player) {
                sendChat("PfInfo", `/w "${player.get("_displayname")}" ${message}`);
            } else {
                sendChat("PfInfo", `/w GM ${message}`);
            }
        } else {
            sendChat("PfInfo", `/w GM ${message}`);
        }
    } catch (err) {
        sendChat("PfInfo", `/w GM Something went very wrong reporting error: ${message}`);
    }
};

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
PfInfo.getSelectedTokens = function (msg, forceExplicit) {
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
            if (!token || !token.get("name") || !token.get("represents")) {
                continue;
            }
            let characterId = token.get("represents");
            if (characterId) {
                let character = getObj("character", characterId);
                if (!character) {
                    continue;
                }
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
            log("PfCombat.getSelectedTokens: forceExplicit is set, and " + tokenList.length + " tokens found.");
            return null;
        }
    }

    return tokenList;
};




// API COMMAND HANDLER
on("chat:message", function(msg) {
    if (msg.type !== "api") return;

    let args = msg.content.split(" ");
    let command = args.shift();
    let playerId = msg.playerid;

    if (command === "!pfinfo") {
        let tokenId = args.shift();
        if (!tokenId) {
            PfInfo.error(playerId, "!pfinfo requires a token id argument.");
        } else {
            let token = getObj("graphic", tokenId);
            if (token) {
                if (PfInfo.hasPermission(getObj("player", playerId), token)) {
                    PfInfo.infoCommand(playerId, token);
                } else {
                    PfInfo.playerInfoCommand(playerId, token);
                }
            } else {
                PfInfo.error(playerId, "Specified token id is invalid.");
            }
        }
    } else if (command === "!pfsetstatus" || command === "!pfunsetstatus") {
        let status = args.shift();
        let value = args.shift();
        let tokenId = args.shift();
        let tokens = [];
        if (tokenId) {
            tokens.push(getObj("graphic", tokenId));
        } else {
            tokens = PfInfo.getSelectedTokens(msg, false);
        }
        PfInfo.setStatusCommand(playerId, status, tokens, value, (command === "!pfsetstatus"));
    } else if (command === "!pfhelp") {
        PfInfo.help(playerId);
    }
});


PfInfo.BOX_STYLE="background-color: #DDDDAA; color: #000000; padding:0px; margin-top: -10px; border:1px solid COLOUR; border-radius: 5px;";
PfInfo.TITLE_STYLE="background-color: COLOUR; color: #FFFFFF; padding: 1px; text-align: center";
PfInfo.TEXT_STYLE="padding: 5px; padding-top: 0px; padding-bottom: 0px;";
PfInfo.PARA_STYLE="padding: 0px; margin: 0px; text-align: left;";
PfInfo.P = "<p style='"+PfInfo.PARA_STYLE+"'>";


PfInfo.cell = function(property, value) {
    if (!value || value === "0") {
        return "";
    }

    return "<b>" + property + "</b>: " + value + " ";
};

PfInfo.line = function(property, value) {
    if (!value) {
        return "";
    }
    value = value.replace(/\n/g, "<br>");
    return "<p style='"+PfInfo.PARA_STYLE+"'><b>" + property + "</b>: " + value + " </p>";
};

PfInfo.text = function(text) {
    return "<p style='"+PfInfo.PARA_STYLE+"'>" + text + "</p>";
};

PfInfo.inset = function(text, emphasis) {
    if (emphasis) {
        emphasis = " font-weight: bold; color: #770000;";
    } else {
        emphasis = "";
    }
    return `<div style="${PfInfo.INSET_STYLE}${emphasis}">${text}</div>`;
};

PfInfo.showStatus = function( token, symbol, name, text, value) {

    let html = "";
    let statuses = [
        'red', 'blue', 'green', 'brown', 'purple', 'pink', 'yellow', // 0-6
        'skull', 'sleepy', 'half-heart', 'half-haze', 'interdiction',
        'snail', 'lightning-helix', 'spanner', 'chained-heart',
        'chemical-bolt', 'death-zone', 'drink-me', 'edge-crack',
        'ninja-mask', 'stopwatch', 'fishing-net', 'overdrive', 'strong',
        'fist', 'padlock', 'three-leaves', 'fluffy-wing', 'pummeled',
        'tread', 'arrowed', 'aura', 'back-pain', 'black-flag',
        'bleeding-eye', 'bolt-shield', 'broken-heart', 'cobweb',
        'broken-shield', 'flying-flag', 'radioactive', 'trophy',
        'broken-skull', 'frozen-orb', 'rolling-bomb', 'white-tower',
        'grab', 'screaming', 'grenade', 'sentry-gun', 'all-for-one',
        'angel-outfit', 'archery-target'
    ];

    if (!value) {
        value = token ? token.get("status_" + symbol) : true;
    }
    if (value) {
        let i = _.indexOf(statuses, symbol);
        let number = parseInt(value);

        if (number > 0) {
            name = name + " (<span style='color:red'>" + number + "</span>)";
            number = "";
        } else {
            number = "";
        }

        if (i > 6) {
            html += '<div style="float: left; width: 24px; height: 24px; display: inline-block; ' +
                    'margin: 0; border: 0; cursor: pointer; padding: 0 3px; background: ' +
                    'url(\'https://app.roll20.net/images/statussheet.png\'); background-repeat: no-repeat; ' +
                    'background-position: '+((-34)*(i-7))+'px 0;">'+number+'</div>';

            html += PfInfo.line(name, text);
        } else {
            // Use one of the colour circles.
            let colour = symbol;
            if (colour === "brown") {
                colour = "orange";
            }
            html += '<div style="float: left; width: 16px; height: 12px; display: inline-block; ' +
                    'margin: 0; margin-right: 8px; border: 0; cursor: pointer; padding: 5px 3px; ' +
                    'background: ' + colour + '; border-radius: 12px">'+number+'</div>';
            html += PfInfo.line(name, text);
        }

        return html;
    }

    return "";
};

PfInfo.defaults = PfInfo.defaults || {};

/**
 * Get all the attributes for this character, into one big array.
 */
PfInfo.getAllAttributes = function(characterId) {
    let attrList = findObjs({
        type: 'attribute',
        characterid: characterId
    });
    return attrList;
};

PfInfo.getDefaultValue = function(attrList, key) {
    if (PfInfo.defaults[key]) {
        return PfInfo.defaults[key];
    }

    if (attrList && attrList[0]) {
        let characterId = attrList[0].get("_characterid");
        let value = getAttrByName(characterId, key);

        PfInfo.defaults[key] = value;

        return value;
    }
    return "";
};

/**
 * Get the current value of the named attribute from our array.
 */
PfInfo.getAttributeValue = function(attrList, key) {
    for (let i=0; i < attrList.length; i++) {
        if (attrList[i].get("name") === key) {
            return attrList[i].get("current");
        }
    }
    return PfInfo.getDefaultValue(attrList, key);
};

PfInfo.parseCustomFields = function(characterName, text) {
    if (!text) {
        return null;
    }
    return text.replace(/@{([^|}]*)}/g, "@{" + characterName + "|$1}");
};

PfInfo.playerInfoCommand = function(playerId, token) {
    let title = token.get("name");
    if (!title) {
        PfInfo.error(playerId, "Token has no name.");
        return;
    }

    let characterId = token.get("represents");
    if (!characterId) {
        PfInfo.error(playerId, "Token has no associated character.");
        return;
    }
    let character = getObj("character", characterId);
    if (!character) {
        PfInfo.error(playerid, "Token has an invalid character associated with it.");
        return;
    }
    let html = "";

    // Get character values.
    let sizeMod = getAttrByName(character.id, "size");
    let size = "Medium";

    if (sizeMod) {
        // Size attribute used to be capitalised, now we need to
        // enforce this manually.
        sizeMod = parseInt(sizeMod);
        switch (sizeMod) {
            case 8:
                size = "Fine";
                break;
            case 4:
                size = "Diminutive";
                break;
            case 2:
                size = "Tiny";
                break;
            case 1:
                size = "Small";
                break;
            case -1:
                size = "Large";
                break;
            case -2:
                size = "Huge";
                break;
            case -4:
                size = "Gargantuan";
                break;
            case -8:
                size = "Colossal";
                break;
            default:
                size = "Medium";
        }
    } else {
        size = "Medium";
    }
    html += PfInfo.text(`${size?size:""}`);
    html += "<br/>";

    // Token statuses
    html += PfInfo.getStatusText(token);

    let player = getObj("player", playerId);
    let displayName = ""+player.get("displayname");

    // Call asynchronous function.
    character.get("bio", function(notes) {
        if (notes !== null && notes !== "" && notes !== "null") {
            if (notes.indexOf("<br>--<br>") !== -1) {
                notes = notes.substring(0, notes.indexOf("<br>--<br>"));
            }
            html += PfInfo.inset(notes);
        }

        html += "</div>";
        PfInfo.infoBlock(null, displayName, token, html);
    });
};

PfInfo.infoCommand = function(playerId, token) {
    let title = token.get("name");
    if (!title) {
        PfInfo.error(playerId, "Token has no name.");
        return;
    }

    let characterId = token.get("represents");
    if (!characterId) {
        PfInfo.error(playerId, "Token has no associated character.");
        return;
    }
    let character = getObj("character", characterId);
    if (!character) {
        PfInfo.error(playerid, "Token has an invalid character associated with it.");
        return;
    }

    let startTime = new Date().getTime();

    let attrList = PfInfo.getAllAttributes(character.id);
    let characterName = PfInfo.getAttributeValue(attrList, "character_name");
    let gender = PfInfo.getAttributeValue(attrList, "gender");
    let race = PfInfo.getAttributeValue(attrList, "race");

    let html = "";
    // Get token values.
    let currentHitpoints = token.get("bar1_value");
    let totalHitpoints = token.get("bar1_max");
    let nonlethalDamage = token.get("bar3_value");

    // Get character values.
    let bab = PfInfo.getAttributeValue(attrList, "bab");
    let type = PfInfo.getAttributeValue(attrList, "npc-type");
    let sizeMod = PfInfo.getAttributeValue(attrList, "size");
    let size = "Medium";
    let alignment = PfInfo.getAttributeValue(attrList, "alignment");
    let ac = PfInfo.getAttributeValue(attrList, "AC");
    let acTouch = PfInfo.getAttributeValue(attrList, "Touch");
    let acFlat = PfInfo.getAttributeValue(attrList, "Flat-Footed");
    let str = PfInfo.getAttributeValue(attrList, "STR");
    let dex = PfInfo.getAttributeValue(attrList, "DEX");
    let con = PfInfo.getAttributeValue(attrList, "CON");
    let int = PfInfo.getAttributeValue(attrList, "INT");
    let wis = PfInfo.getAttributeValue(attrList, "WIS");
    let cha = PfInfo.getAttributeValue(attrList, "CHA");

    currentHitpoints = parseInt(currentHitpoints);
    totalHitpoints = parseInt(totalHitpoints);
    nonlethalDamage = parseInt(nonlethalDamage);

    if (sizeMod) {
        // Size attribute used to be capitalised, now we need to
        // enforce this manually.
        sizeMod = parseInt(sizeMod);
        switch (sizeMod) {
            case 8:
                size = "Fine";
                break;
            case 4:
                size = "Diminutive";
                break;
            case 2:
                size = "Tiny";
                break;
            case 1:
                size = "Small";
                break;
            case -1:
                size = "Large";
                break;
            case -2:
                size = "Huge";
                break;
            case -4:
                size = "Gargantuan";
                break;
            case -8:
                size = "Colossal";
                break;
            default:
                size = "Medium";
        }
    } else {
        size = "Medium";
    }

    let c = 0;
    let classLevels = "";
    while (c < 10) {
        let classNameAttr = "class-"+c+"-name";
        let classLevelAttr = "class-"+c+"-level";

        let className = PfInfo.getAttributeValue(attrList, classNameAttr);
        let classLevel = PfInfo.getAttributeValue(attrList, classLevelAttr);

        if (className) {
            if (classLevels) {
                classLevels += " / ";
            }
            classLevels += `${className} ${classLevel}`;
        } else {
            break;
        }
        c++;
    }

    html += PfInfo.text(`${size?size:""} ${type}`);
    let raceGender = "";
    if (gender) {
        raceGender = gender + " ";
    }
    if (race) {
        raceGender += race;
    }
    if (raceGender) {
        html += PfInfo.text(raceGender);
    }
    html += PfInfo.text(classLevels);
    html += PfInfo.text(alignment);
    html += "<br/>";

    if (nonlethalDamage > 0) {
        let hp = currentHitpoints - nonlethalDamage;
        html += PfInfo.line("Hitpoints", "(" + hp + ") " +
                currentHitpoints + " / " + totalHitpoints);
    } else {
        html += PfInfo.line("Hitpoints", currentHitpoints + " / " + totalHitpoints);
    }
    html += PfInfo.P;
    html += PfInfo.cell("S", str) + PfInfo.cell("D", dex) + PfInfo.cell("C", con);
    html += PfInfo.cell("I", int) + PfInfo.cell("W", wis) + PfInfo.cell("C", cha);
    html += "</p>";
    html += PfInfo.P;
    html += PfInfo.cell("AC", ac) + PfInfo.cell("Flat", acFlat) + PfInfo.cell("Touch", acTouch);
    html += "</p>";

    html += PfInfo.P;
    let babMelee = PfInfo.getAttributeValue(attrList, "attk-melee");
    let babRanged = PfInfo.getAttributeValue(attrList, "attk-melee");
    let cmb = PfInfo.getAttributeValue(attrList, "CMB");
    let cmd = PfInfo.getAttributeValue(attrList, "CMD");

    html += PfInfo.cell("BAB", babMelee);
    if (babRanged !== babMelee) {
        html += PfInfo.cell("Ranged", babRanged)
    }
    html += PfInfo.cell("CMB", cmb) + PfInfo.cell("CMD", cmd);
    html += "</p><br/>";

    html += PfInfo.P;
    let speedModified = PfInfo.getAttributeValue(attrList, "speed-modified");
    let speedFly = PfInfo.getAttributeValue(attrList, "speed-fly");
    let speedSwim = PfInfo.getAttributeValue(attrList, "speed-swim");
    let speedClimb = PfInfo.getAttributeValue(attrList, "speed-climb");
    let speedRun = PfInfo.getAttributeValue(attrList, "speed-run");

    html += PfInfo.P;
    html += PfInfo.cell("Move", speedModified) + PfInfo.cell("Run", speedRun);
    html += "</p>";

    if (speedFly > 0 || speedSwim > 0 || speedClimb > 0) {
        html += PfInfo.P;
        if (speedFly > 0) html += PfInfo.cell("Fly", speedFly);
        if (speedSwim > 0) html += PfInfo.cell("Swim", speedSwim);
        if (speedClimb > 0) html += PfInfo.cell("Climb", speedClimb);
        html += "</p>";
    }

    let dr = PfInfo.getAttributeValue(attrList, "DR");
    let resistances = PfInfo.getAttributeValue(attrList, "resistances");
    let immunities = PfInfo.getAttributeValue(attrList, "immunities");
    let sr = PfInfo.getAttributeValue(attrList, "SR");
    let weaknesses = PfInfo.getAttributeValue(attrList, "weaknesses");

    html += PfInfo.P + PfInfo.cell("DR", dr) + PfInfo.cell("SR", sr) + "</p>";
    html += PfInfo.line("Resistances", resistances);
    html += PfInfo.line("Immunities", immunities);
    html += PfInfo.line("Weaknesses", weaknesses);

    let meleeAttackNotes = PfInfo.getAttributeValue(attrList, "melee-attack-notes");
    meleeAttackNotes = PfInfo.parseCustomFields(characterName, meleeAttackNotes);
    let rangedAttackNotes = PfInfo.getAttributeValue(attrList, "ranged-attack-notes");
    rangedAttackNotes = PfInfo.parseCustomFields(characterName, rangedAttackNotes);
    let cmbNotes = PfInfo.getAttributeValue(attrList, "CMB-notes");
    cmbNotes = PfInfo.parseCustomFields(characterName, cmbNotes);
    let attackNotes = PfInfo.getAttributeValue(attrList, "attack-notes");
    attackNotes = PfInfo.parseCustomFields(characterName, attackNotes);
    let defenseNotes = PfInfo.getAttributeValue(attrList, "defense-notes");
    defenseNotes = PfInfo.parseCustomFields(characterName, defenseNotes);

    html += PfInfo.line("Melee Attacks", meleeAttackNotes);
    html += PfInfo.line("Ranged Attacks", rangedAttackNotes);
    html += PfInfo.line("CMB", cmbNotes);
    html += PfInfo.line("Attacks", attackNotes);
    html += PfInfo.line("Defence", defenseNotes);

    // Find and display custom notes (type A).
    for (let i=1; i < 10; i++) {
        let baseField = "customa" + i;
        let nameField = baseField + "-name";
        let modField = baseField + "-mod";

        let name = PfInfo.getAttributeValue(attrList, nameField);
        if (name) {
            let mod = PfInfo.getAttributeValue(attrList, modField);
            if (mod) {
                html += PfInfo.line(name, mod);
            }
        }
    }

    // Find and display custom notes (type B).
    for (let i=1; i < 7; i++) {
        let baseField = "customc" + i;
        let nameField = baseField + "-name";
        let modField = baseField + "-mod";
        let maxField = baseField + "-mod";

        let name = PfInfo.getAttributeValue(attrList, nameField);
        if (name) {
            let mod = PfInfo.getAttributeValue(attrList, modField);
            mod = PfInfo.parseCustomFields(characterName, mod);
            let max = PfInfo.getAttributeValue(attrList, maxField, "max");
            if (max && mod) {
                max = PfInfo.parseCustomFields(characterName, max);
                html += PfInfo.line(name, "[[d0 + " + mod + "]] / [[d0 + " + max + "]]");
            } else if (mod) {
                html += PfInfo.line(name, "[[d0 + " + mod + "]]");
            }
        }
    }

    //html += PfInfo.line("Attacks", "[Attacks](!& #13;& #37;{" + characterName + "|attacks})");

    let spellBooks = "";
    for (let i=0; i < 5; i++) {
        let spellbookField = "spellbook-" + i;
        let spellclassField = "spellclass-" + i + "-name";
        let spellclass = PfInfo.getAttributeValue(attrList, spellclassField);
        if (spellclass) {
            // Somehow the escape sequences got expanded by the Roll20 script editor,
            // breaking the script. Try and break them up so this doesn't happen.
            spellBooks += `[${spellclass} Spells](!&` + `#13;&` + `#37;{${characterName}|${spellbookField}}) `;
        }
    }
    if (spellBooks) {
        html += PfInfo.text(spellBooks);
    }

    // Token statuses
    html += PfInfo.getStatusText(token);

    let player = getObj("player", playerId);
    let displayName = ""+player.get("displayname");

    let endTime = new Date().getTime();
    log(endTime - startTime);

    // Call asynchronous function.
    character.get("gmnotes", function(notes) {
        if (notes !== null && notes !== "" && notes !== "null") {
            if (notes.indexOf("<br>--<br>") !== -1) {
                notes = notes.substring(0, notes.indexOf("<br>--<br>"));
            }
            html += PfInfo.inset(notes);
        }

        for (let i=1; i <= 10; i++) {
            let n = getAttrByName(character.id, `customn${i}-name`);
            if (n && n === "NB") {
                let nb = getAttrByName(character.id, `customn${i}`);
                if (nb) {
                    html += PfInfo.inset(nb, true);
                }
            }
        }

        let gmnotes = token.get("gmnotes");
        if (gmnotes && gmnotes !== "null") {
            gmnotes = unescape(gmnotes);
            let matches = gmnotes.match(/!!(.*?)!!/g);
            if (matches && matches.length > 0) {
                html += "<div style='" + PfInfo.INSET_STYLE + "'>";
                for (let i=0; i < matches.length; i++) {
                    let text = matches[i];
                    text = text.replace(/!!/g, "");
                    html += text + "<BR>";
                }
                html += "</div>";
            }
        }

        html += "</div>";
        PfInfo.infoBlock(character, displayName, token, html);
    });
};

PfInfo.INSET_STYLE = "font-style: italic; border: 1px dotted black; margin: 3px; padding: 3px;";

PfInfo.getStatusText = function(target) {
    let html = "";

    html += PfInfo.showStatus(target, "green", "Stablized", "Is unconscious but not dying.");
    if (!target.get("status_red")) {
        // We show both red and brown status symbols for accessibility reasons,
        // but the actual descriptive text only needs to display the worst.
        html += PfInfo.showStatus(target, "brown", "Moderately wounded", "Has less than two third hitpoints.");
    }
    html += PfInfo.showStatus(target, "red", "Heavily Wounded", "Has less than one third hitpoints.");

    for (let status in PfInfo.statusEffects) {
        let effect = PfInfo.statusEffects[status];
        html += PfInfo.showStatus(target, effect.status, status, effect.description);
    }

    return html;
};

/**
 * Returns true if the character represented by this token is a single
 * individual. It is considered unique if the token's hitpoints are linked
 * to the character's hitpoints.
 */
PfInfo.isNamedCharacter = function(token) {
    if (token) {
        let characterId = token.get("represents");
        let link = token.get("bar1_link");

        if (getObj("character", characterId) && link) {
            return true;
        }
    }
    return false;
};

PfInfo.hasAbility = function(token, ability) {
    let characterId = token.get("represents");
    let attrList = PfInfo.getAllAttributes(characterId);

    log("Looking for " + ability);
    for (let i=0; i < attrList.length; i++) {
        //log(attrList[i].get("name"));
        let name = "" + attrList[i].get("name");
        if (name.match(/repeating_ability_-[a-zA-Z0-9]*_name/)) {
            let val = "" + attrList[i].get("current");
            log("Token " + token.get("name") + " has " + val);
            if (val.toLowerCase() == ability.toLowerCase()) {
                return true;
            }
        }
    }
    return false;
};

/**
 * Returns true iff the player has permission to edit the character that this
 * token represents.
 *
 * @param player    Player doing the action.
 * @param token     Token being acted upon.
 */
PfInfo.hasPermission = function(player, token) {
    if (!player || !token) {
        return false;
    }
    if (playerIsGM(player.get("_id"))) {
        return true;
    }
    let characterId = token.get("represents");
    if (characterId) {
        let character = getObj("character", characterId);
        if (character) {
            let controlledBy = character.get("controlledby");
            if (controlledBy) {
                log("ControlledBy: " + controlledBy);
                let controllers = controlledBy.split(",");
                for (let p = 0;  p < controllers.length; p++) {
                    let id = controllers[p].trim();
                    if (id === "all" || id === player.get("_id")) {
                        return true;
                    }
                }
            }
        }
    }

    return false;
};

/**
 * Return array containing a list of the players that have permission
 * to edit this token. Only applies if the token has a character sheet
 * associated with it.
 *
 * @param token     Token to check ownership of.
 */
PfInfo.getOwners = function(token) {
    let ownersList = [];

    if (token && token.get("represents")) {
        let character = getObj("character", token.get("represents"));
        if (character) {
            let controlledBy = character.get("controlledby");
            let controllers = controlledBy.split(",");
            for (let p = 0; p < controllers.length; p++) {
                let id = controllers[p].trim();
                if (id === "all") {
                    return [ "all" ];
                } else {
                    let player = getObj("player", id);
                    if (player) {
                        ownersList.push(player);
                    }
                }
            }
        }
    }

    return ownersList;
};

PfInfo.statusEffects = {
    'Blind': { status: "bleeding-eye", attribute: "condition-Blinded", value: "2", description:
                "-2 penalty to AC; loses Dex bonus to AC; -4 penalty of most Dex and Str checks and opposed Perception "+
                "checks; Opponents have 50% concealment; Acrobatics DC 10 if move faster than half speed, or prone." },
    'Confused': { status: "screaming", description:
                "01-25: Act Normally; 26-50: Babble; 51-75: 1d8 + Str damage to self; 76-100: Attack nearest." },
    'Dazzled': { status: "overdrive", attribute: "condition-Dazzled", value: "1", description:
                "-1 attacks and sight based perception checks." },
    'Entangled': { status: "fishing-net", attribute: "condition-Entangled", value: "2", description:
                "No movement if anchored, otherwise half speed. -2 attack, -4 Dex. Concentration check to cast spells." },
    'Exhausted': { status: "sleepy", attribute: "condition-Fatigued", value: "3", description:
                "Half-speed, -6 to Str and Dex. Rest 1 hour to become fatigued." },
    'Fatigued': { status: "half-haze", attribute: "condition-Fatigued", value: "3", description:
                "Cannot run or charge; -2 to Str and Dex. Rest 8 hours to recover." },
    'Flat Footed': { status: "tread", attribute: "condition-Flat-Footed", value: "1", description:
                "Lose dex bonus to AC and CMD, and can't make attacks of opportunity (unless has Combat Reflexes)." },
    'Frightened': { status: "broken-heart", attribute: "condition-Fear", value: "2", description:
                "-2 attacks, saves, skills and ability checks; must flee from source." },
    'Grappled': { status: "fist", attribute: "condition-Grappled", value: "2", description:
                "Cannot move or take actions that require hands. -4 Dex, -2 attacks and combat maneuvers "+
                "except to escape. Concentration to cast spells, do not threaten." },
    'Invisible': { status: "ninja-mask", attribute: "condition-Invisible", value: "2", description:
                "+2 bonus on attacks, ignores Dex bonus to AC. +40/+20 bonus to stealth if stationary/moving. "+
                "50% concealment." },
    'Pinned': { status: "padlock", attribute: "condition-Pinned", value: "4", description:
                "Cannot move or take actions that require hands. -4 AC, -4 Dex, -2 attacks and combat maneuvers "+
                "except to escape. Concentration to cast spells, do not threaten." },
    'Nauseated': { status: "radioactive", description: "Can only take a single move action, no spells attacks or "+
                "concentration." },
    'Panicked': { status: "half-heart", description: "-2 attacks, saves, skills and ability checks; drops items and "+
                "must flee from source." },
    'Paralyzed': { status: "cobweb", description:
                "Str and Dex reduced to zero. Flyers fall. Helpless." },
    'Prone': { status: "arrowed", attribute: "condition-Prone", value: "4", description:
                "-4 penalty to attack roles and can't use most ranged weapons. "+
                "Has +4 AC bonus against ranged, but -4 AC against melee." },
    'Shaken': { status: "chained-heart", description:
                "-2 penalty on all attacks, saves, skills and ability checks." },
    'Sickened': { status: "drink-me", attribute: "condition-Sickened", value: "2", description:
                "-2 penalty on all attacks, damage, saves, skills and ability checks." },
    'Slowed': { status: "snail", description:
                "Half normal speed (round down), only a single move or standard action. -1 to attack, AC and reflex." },
    'Stabilized': { status: "green", description:
                "Is unconscious but not dying." },
    'Staggered': { status: "pummeled", description:
                "Only a move or standard action (plus swift and immediate)." },
    'Stunned': { status: "interdiction", attribute: "condition-Stunned", value: "2", description:
                "Cannot take actions, drops everything held, takes a -2 penalty to AC, loses Dex bonus to AC." },
    'Surprised': { status: "frozen-orb", tint: "ffffff", description:
                "Cannot take an action in the surprise round." },
    'Helpless': { status: "aura", attribute: "condition-Helpless", value: "1", description:
                "Dexterity is 0 (-5)." },
    'Unconscious': { status: "skull", description:
                "Is unconscious and dying." },
    'Dead': { status: "dead", description:
                "Creature is dead. Gone. Destroyed." },
    'Bleeding': { status: "pink", description: "Is bleeding HP every round. Heal DC 15 or cure effect to stop." },
    'Attack Bonus': { status: "all-for-one", description: "Gets a bonus to all attack rolls." },
    'Damage Bonus': { status: "grenade", description: "Gets a bonus to all damage rolls." },
    'AC Bonus': { status: "bolt-shield", description: "Gets a bonus to AC." }
};


PfInfo.setStatusCommand = function(playerId, status, tokens, value, set = true) {
    let player = getObj("player", playerId);

    if (!player || !playerId) {
        PfInfo.error(null, "No player found.");
        return;
    }
    if (value && (parseInt(value) < 0 || parseInt(value) > 9)) {
        PfInfo.error(player, "Status value must be between 0 and 9 inclusive.");
        return;
    }
    if (status) {
        status = status.replace(/-/, " ");
    } else {
        PfInfo.error(player, "No status provided.");
        return;
    }

    if (PfInfo.statusEffects[status]) {
        let effect = PfInfo.statusEffects[status];
        for (let i=0; i < tokens.length; i++) {
            // Need to reset flags each time, since each call to token.set() updates it.
            if (!playerIsGM(player.get("_id")) && !PfInfo.hasPermission(player, tokens[i])) {
                log("No permission on " + tokens[i].get("name"));
                continue;
            }
            let flags = [];
            if (value && set) {
                flags['status_' + effect.status] = value;
            } else {
                flags['status_' + effect.status] = set;
            }
            tokens[i].set( flags );
            if (effect.tint) {
                tokens[i].set("tint_color", effect.tint);
            }
            if (PfInfo.isNamedCharacter(tokens[i])) {
                PfInfo.setCharacterStatus(tokens[i], effect, set);
                if (set && playerIsGM(player.get("_id"))) {
                    log("Player is GM");
                    let character = getObj("character", tokens[i].get("represents"));
                    let controlledBy = character.get("controlledby");
                    log("Controlled By = " + controlledBy);
                    if (controlledBy) {
                        let controllers = controlledBy.split(",");
                        for (let p = 0; p < controllers.length; p++) {
                            let id = controllers[p].trim();
                            log(id);
                            let otherPlayer = getObj("player", id);
                            if (otherPlayer) {
                                log("Whispering to " + otherPlayer.get("displayname"));
                                PfInfo.whisperTo(tokens[i].get("name"), otherPlayer, PfInfo.showStatus(null, effect.status, status, effect.description, value));
                            }
                        }
                    }
                }
            }
        }
        if (set) {
            PfInfo.whisper(player, PfInfo.showStatus(null, effect.status, status, effect.description, value));
        }

        return 0;
    } else {
        let msg = "";
        for (s in PfInfo.statusEffects) {
            if (msg) {
                msg += ", " + s;
            } else {
                msg = s;
            }
        }
        PfInfo.error(player, `Unknown status '${status}', use one of: ${msg}`);
        return -1;
    }
};

/**
 * Set the given status on the token's character sheet.
 *
 * @param token     Token that represents the character.
 * @param status    Status information to set.
 * @param set       If true, then set, otherwise unset.
 */
PfInfo.setCharacterStatus = function(token, status, set) {
    if (!token || !status) {
        return;
    }
    let characterId = token.get("represents");
    if (!characterId) {
        return;
    }
    let character = getObj("character", characterId);
    if (!character) {
        return;
    }
    if (status.attribute) {
        let value = 0;
        if (!set) {
            value = 0;
        } else if (status.value) {
            value = status.value;
        } else {
            value = 1;
        }
        log("Setting character attribute " + status.attribute + " to " + value);
        let  attributes = findObjs({
            _type: "attribute",
            _characterid: characterId,
            name: status.attribute
        });
        if (attributes && attributes.length > 0) {
            let attr = attributes[0];
            log("Have attribute");
            attr.set("current", value);
        } else {
            log("Creating attribute");
            createObj("attribute", {
                type: "attribute",
                name: status.attribute,
                characterid: characterId,
                current: value
            });
        }
    }
};

PfInfo.BOX_STYLE="background-color: #EEEEDD; color: #000000; margin-top: 0px; " +
                 "padding:5px; border:1px dashed black; border-radius: 10px; " +
                 "font-weight: normal; font-style: normal; text-align: left; "+
                 "background-image: url(http://imgsrv.roll20.net/?src=i.imgur.com/BLDFC8xg.jpg)";

PfInfo.infoBlock = function(character, displayName, token, message, func) {
    if (message) {
        let image = token.get("imgsrc");
        let name = token.get("name");
        let html = "<div style='" + PfInfo.BOX_STYLE + "'>";
        html += `<img style='float:right' width='64' src='${image}'>`;
        html += `<h3>${name}</h3>`;
        html += message;
        html += "</div>";

        let from = displayName;
        if (character) {
            from = "character|"+character.get("id");
        }
        if (!func) {
            sendChat(from, "/w \"" + displayName + "\" " + html);
        } else {
            sendChat(from, "/w \"" + displayName + "\" " + html, func);
        }
    }
};

/**
 * Display a message in the chat window to everyone.
 *
 * @param player    Player object or string describing who message came from, or null.
 * @param message   The message to be output.
 * @param title     Title to be displayed at top of message box. Null for no message.
 */
PfInfo.message = function(player, message, title, func) {
    if (message) {
        let html = "<div style='" + PfInfo.BOX_STYLE + "'>";
        if (title) {
            html += `<h3>${title}</h3>`;
        }
        html += message;
        html += "</div>";

        if (player && typeof(player) === "object") {
            sendChat(`player|${player.get("_id")}`, `/desc ${html}`, func);
        } else if (player && typeof(player) === "string") {
            sendChat(player, `/desc ${html}`, func);
        } else {
            sendChat("", `/desc ${html}`, func);
        }
    }
};

/**
 * Whisper message to the GM only.
 *
 * @param player
 * @param message
 * @param title
 * @param func
 */
PfInfo.whisper = function(player, message, title, func) {
    if (message) {
        let html = "<div style='" + PfInfo.BOX_STYLE + "'>";
        if (title) {
            html += `<h3>${title}</h3>`;
        }
        html += message;
        html += "</div>";

        if (player && typeof(player) === "object") {
            sendChat(`player|${player.get("_id")}`, `/w GM ${html}`, func);
        } else if (player && typeof(player) === "string") {
            sendChat(player, `/w GM ${html}`, func);
        } else {
            sendChat("", `/w GM ${html}`, func);
        }
    }
};

/**
 * Whisper message to another player.
 *
 * @param from
 * @param to
 * @param message
 * @param title
 * @param func
 */
PfInfo.whisperTo = function(from, to, message, title, func) {
    if (message && to) {
        let html = "<div style='" + PfInfo.BOX_STYLE + "'>";
        if (title) {
            html += `<h3>${title}</h3>`;
        }
        html += message;
        html += "</div>";

        if (from && typeof(from) === "object") {
            sendChat(`player|${from.get("_id")}`, `/w "${to.get("displayname")}" ${html}`, func);
        } else if (from && typeof(from) === "string") {
            sendChat(from, `/w "${to.get("displayname")}" ${html}`, func);
        } else {
            sendChat("", `/w "${to.get("displayname")}" ${html}`, func);
        }
    }
};
