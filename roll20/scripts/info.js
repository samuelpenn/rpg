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
 */

// API COMMAND HANDLER
on("chat:message", function(msg) {
    if (msg.type !== "api") return;
    if (msg.content.split(" ", 1)[0] === "!info") {
        var player_obj = getObj("player", msg.playerid);
        Info.Process(msg, player_obj);
    }
});

var Info = Info || {};

Info.BOX_STYLE="background-color: #DDDDAA; color: #000000; padding:0px; border:1px solid COLOUR; border-radius: 5px;"
Info.TITLE_STYLE="background-color: COLOUR; color: #FFFFFF; padding: 1px; text-align: center";
Info.TEXT_STYLE="padding: 5px; padding-top: 0px; padding-bottom: 0px;"
Info.PARA_STYLE="padding: 0px; margin: 0px;";
Info.P = "<p style='"+Info.PARA_STYLE+"'>";


Info.cell = function cell(property, value) {
    if (value == undefined || value == "") {
        return "";
    }
    return "<b>" + property + "</b> " + value + " ";
}

Info.line = function line(property, value) {
    if (value == undefined || value == "") {
        return "";
    }
    return "<p style='"+Info.PARA_STYLE+"'><b>" + property + "</b> " + value + " </p>";
}

Info.text = function text(text) {
    return "<p style='"+Info.PARA_STYLE+"'><b>" + text + "</b></p>";
}

Info.Process = function(msg, player_obj) {
    var n = msg.content.split(" ");
    var target = getObj("graphic", n[1]);
    if (target != undefined) {
        var title = target.get("name");
        if (title != undefined ) {

            if (title.split(":").length > 1) {
                title = title.split(":")[1];
            }
        }
        var character_id = target.get("represents")
        var character = getObj("character", character_id)
        if (character == null) {
            sendChat("", "/w " + player_obj.get("displayname") + " No character found");
        } else {
            var colour = getAttrByName(character.id, 'rolltemplate_color');
            if (colour == null || colour == "") {
                colour = "#000000";
            }
            var image = null
            if (image == null || image == "") {
                image = character.get("avatar");
            }

            var html = "<div style='" + Info.BOX_STYLE.replace("COLOUR", colour) + "'>";
            if (title != undefined) {
                html += "<div style='" + Info.TITLE_STYLE.replace("COLOUR", colour) + "'>" + title + "</div>";
            }

            html += "<div style='" + Info.TEXT_STYLE.replace(/COLOUR/g, colour) + "'>";
            if (image != null) {
                html += "<table><tr>";
                html += "<td style='width:110px; vertical-align: top'><img src='"+image+"' width='100px' align='left'/></td>";
                html += "<td style='width: auto; vertical-align: top'>";
            }
            var currentHitpoints = target.get("bar1_value");
            var totalHitpoints = target.get("bar1_max");
            var nonlethalDamage = target.get("bar3_value");
            var bab = getAttrByName(character.id, "bab");
            var type = getAttrByName(character.id, "npc-type");
            var size = getAttrByName(character.id, "size_display");
            var alignment = getAttrByName(character.id, "alignment");
            var hitDice = getAttrByName(character.id, "level");
            var ac = getAttrByName(character.id, "AC");
            var acTouch = getAttrByName(character.id, "Touch");
            var acFlat = getAttrByName(character.id, "Flat-Footed");

            currentHitpoints = parseInt(currentHitpoints);
            totalHitpoints = parseInt(totalHitpoints);
            nonlethalDamage = parseInt(nonlethalDamage);

            var c = 0;
            var classLevels = ""
            while (c < 10) {
                var classNameAttr = "class-"+c+"-name";
                var classLevelAttr = "class-"+c+"-level";

                var className = getAttrByName(character.id, classNameAttr);
                var classLevel = getAttrByName(character.id, classLevelAttr);

                if (className != null && className != "") {
                    if (classLevels != "") {
                        classLevels += " / ";
                    }
                    classLevels += className + " " + classLevel;
                } else {
                    break;
                }
                c++;
            }

            html += Info.text(size + " " + type);
            html += Info.text(classLevels);
            html += Info.text(alignment);
            html += "<br/>";

            if (nonlethalDamage > 0) {
                var hp = currentHitpoints - nonlethalDamage;
                html += Info.text("Hitpoints: (" + hp + ") " +
                        currentHitpoints + " / " + totalHitpoints);
            } else {
                html += Info.text("Hitpoints: " + currentHitpoints + " / " + totalHitpoints);
            }
            html += Info.P;
            html += Info.cell("AC", ac) + Info.cell("Flat", acFlat) + Info.cell("Touch", acTouch);
            html += "</p>";

            html += Info.P;
            var babMelee = getAttrByName(character.id, "attk-melee");
            var babRanged = getAttrByName(character.id, "attk-melee");
            var cmb = getAttrByName(character.id, "CMB");
            var cmd = getAttrByName(character.id, "CMD");

            html += Info.cell("BAB", babMelee);
            if (babRanged != babMelee) {
                html += Info.cell("Ranged", babRanged)
            }
            html += Info.cell("CMB", cmb) + Info.cell("CMD", cmd);
            html += "</p><br/>";

            if (image != null) {
                html += "</td></tr></table>";
            }

            html += Info.P;
            var speedBase = getAttrByName(character.id, "speed-base");
            var speedModified = getAttrByName(character.id, "speed-modified");
            var speedFly = getAttrByName(character.id, "speed-fly");
            var speedSwim = getAttrByName(character.id, "speed-swim");
            var speedClimb = getAttrByName(character.id, "speed-climb");
            var speedMisc = getAttrByName(character.id, "speed-misc");
            var speedMult = getAttrByName(character.id, "speed-run-mult");
            var speedRun = getAttrByName(character.id, "speed-run");

            html += Info.P;
            html += Info.cell("Move", speedModified) + Info.cell("Run", speedRun);
            html += "</p>";

            if (speedFly > 0 || speedSwim > 0 || speedClimb > 0) {
                html += Info.P;
                if (speedFly > 0) html += Info.cell("Fly", speedFly);
                if (speedSwim > 0) html += Info.cell("Swim", speedSwim);
                if (speedClimb > 0) html += Info.cell("Climb", speedClimb);
                html += "</p>";
            }

            var dr = getAttrByName(character.id, "DR");
            var resistences = getAttrByName(character.id, "resistances");
            var immunities = getAttrByName(character.id, "immunities");
            var sr = getAttrByName(character.id, "SR");
            var weaknesses = getAttrByName(character.id, "weaknesses");

            html += Info.P + Info.cell("DR", dr) + Info.cell("SR", sr) + "</p>";
            html += Info.line("Resistences", resistences);
            html += Info.line("Immunities", immunities);
            html += Info.line("Weaknesses", weaknesses);

            html += "</div>";
            html += "</div>";

            sendChat("", "/w " + player_obj.get("displayname") + " " + html);
        }
    } else {
        sendChat("", "/w " + player_obj.get("displayname") + " Nothing selected.");
    }
};
