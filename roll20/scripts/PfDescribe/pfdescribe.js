/**
 * Output a description of a character to the chat window.
 *
 * !describe @{selected|token_id}
 *
 * Outputs a picture (if available) and descriptive text of a character to
 * the chat window. Allows players to see a description of tokens on the map
 * which they don't otherwise have permission to access.
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
 * If the PfInfo script is available, then the current status of the token
 * is also displayed. e.g., health, stun effects etc.
 *
 * If the token does not represent a character, then looks for a handout
 * with the same name. If found, the descriptive text (and graphic) of the
 * handout is displayed in its place. This allows symbols to be placed on
 * a large scale map (such as a city, or a country) which players can select
 * and get information on.
 *
 * !missions [verbose]
 *
 * Lists all missions available to players characters. Handouts which begin
 * "Job: " are considered a mission, and they must be available to all players.
 * They are listed with their reward price and faction, with a link to the
 * full description of the mission.
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

// API COMMAND HANDLER
on("chat:message", function(msg) {
    if (msg.type !== "api") return;

    var player = getObj("player", msg.playerid);
    var args = msg.content.split(" ");

    if (args == null || args.length == 0) {
        sendChat("", "/w " + player.get("displayname") + " No command found");
        return;
    }

    var command = args.shift();

    if (command == "!describe") {
        if (args.length == 0) {
            Describe.error(player, "!describe expects a parameter, e.g. !describe &#64;{selected|token_id}");
            return;
        }
        var id = args.shift();
        Describe.describe(msg, player, id);
        return;
    } else if (command == "!missions") {
        var verbose = false;
        var flag = args.shift();
        if (flag == "verbose") {
            verbose = true;
        }
        Describe.missions(msg, player, verbose);
        return;
    } else if (command === "!mission") {
        if (args.length == 0) {
            Describe.error(player, "!mission expects a parameter. Use !missions to get list of missions.");
            return;
        }
        var id = args.shift();
        log(id);
        Describe.mission(msg, player, id);
        return;
    }

});

var Describe = Describe || {};

Describe.BOX_STYLE="background-color: #EEEEDD; color: #000000; padding:0px; border:1px solid black; border-radius: 5px 5px 10px 10px;";
Describe.TITLE_STYLE="background-color: black; color: #FFFFFF; padding: 1px; font-style: normal; text-align: center; border-radius: 5px 5px 0px 0px;";
Describe.TEXT_STYLE="padding: 5px; text-align: left; font-weight: normal; font-style: normal";


/**
 * Displays an error back to the player. Errors are always whispered so
 * as not to annoy everyone else.
 */
Describe.error = function(player, message) {
    sendChat("pfDescribe", "/w \"" + player.get("displayname") + "\" " + message);
}


Describe.getHTML = function(title, image, text, extra) {
    var html = "<div style='" + Describe.BOX_STYLE + "'>";

    if (title == null) {
        title = "";
    }

    html += "<div style='" + Describe.TITLE_STYLE + "'>" + title + "</div>";
    if (image != null && image != "") {
        html += "<img src='" + image + "' width='100%'/>";
    }
    html += "<div style='" + Describe.TEXT_STYLE + "'>" + text + "</div>";
    if (extra != null) {
        html += extra;
    }
    html += "</div>";

    return html;
};

Describe.missionHandout = function(handout, player, callback) {
    if (handout == null) {
        Describe.error(player, "No mission handout defined.");
        return;
    }
    handout.get("notes", function(notes) {
        var notes = unescape(notes);

        handout.get("gmnotes", function(gmnotes) {
            gmnotes = unescape(gmnotes);

            var firstline = gmnotes.replace(/<br>.*/, "");
            var title = handout.get("name").replace(/Job: */, "");

            var faction = null;
            var reward = null;
            if (firstline.indexOf(",") != -1) {
                faction = firstline.replace(/,.*/, "");
                reward = firstline.replace(/.*, /g, "");

                if (faction == "") {
                    faction = null;
                }
                if (reward == "") {
                    reward = null;
                }
            }

            callback.call(this, handout, player, title, faction, reward, notes);
        });
    });

};

/**
 * Given a faction name, either returns the faction name or the
 * character id of a matching character formatted for use in a
 * sendChat() call. e.g. "character|aBcD34567".
 */
Describe.getFaction = function(faction) {
    if (faction == null || faction == "") {
        return null;
    }

    var list = findObjs({
        _type: "character",
        _name: faction
    });
    if (list == null || list.length == 0) {
        return faction;
    }
    return "character|" + list[0].get("id");
}

Describe.missionDetails = function(handout, player, title, faction, reward, notes) {
    var text = "";
    if (faction != null) {
        text += "<b>Faction: </b>" + faction + "<br/>";
    }
    if (reward != null) {
        text += "<b>Reward: </b>" + reward + "<br/>";
    }
    if (faction != null || reward != null) {
        text += "<br/>";
    }

    text += notes;

    faction = Describe.getFaction(faction);
    if (playerIsGM(player.get("id"))) {
        sendChat(faction?faction:"", "/desc " + Describe.getHTML(title, null, text));
    } else {
        sendChat(faction?faction:"", "/w \"" + player.get("displayname") + "\" " + Describe.getHTML(title, null, text));
    }
}

Describe.missionList = function(handout, player, title, faction, reward, notes) {
    if (reward != null) {
        title += " (" + reward + ")";
    }
    var text = "[" + title + "](!mission " + handout.get("_id") + ")";

    faction = Describe.getFaction(faction);
    if (playerIsGM(player.get("id"))) {
        sendChat(faction?faction:"", text);
    } else {
        sendChat(faction?faction:"", "/w \"" + player.get("displayname") + "\" " + text);
    }
}

Describe.mission = function(msg, player, id) {
    var list = findObjs({
        _type: "handout",
        _id: id
    });
    if (list == null || list.length == 0) {
        Describe.error(player, "Failed to find mission handout with id [" + id + "]");
        return;
    }
    var handout = list[0];
    Describe.missionHandout(handout, player, Describe.missionDetails);
};


Describe.missions = function(msg, player, verbose) {
    var list = findObjs({
        _type: "handout",
        inplayerjournals: "all"
    });
    if (list == null || list.length == 0) {
        Describe.error(player, "No missions are currently available for listing.");
        return;
    }
    var jobs = [];
    for (var i=0; i < list.length; i++) {
        if (list[i].get("name").startsWith("Job:")) {
            jobs.push(list[i]);
        }
    }

    if (playerIsGM(player.get("id"))) {
        sendChat("player|" + player.get("id"),
                 "The following jobs are currently listed as being available.");
    }
    for (var i=0; i < jobs.length; i++) {
        var handout = jobs[i];
        if (verbose == true) {
            Describe.missionHandout(handout, player, Describe.missionDetails);
        } else {
            Describe.missionHandout(handout, player, Describe.missionList);
        }
    }
};

Describe.describe = function(msg, player, target_id) {
    var target = getObj("graphic", target_id);
    if (target != undefined) {
        var title = target.get("name");
        if (title != undefined ) {

            if (title.split(":").length > 1) {
                title = title.split(":")[1];
            }
        }
        var character_id = target.get("represents");
        var character = getObj("character", character_id);
        if (character == null) {
            // This might be a map symbol that links to a handout.
            // Look for a handout with the same name.
            var list = findObjs({
                _type: "handout",
                name: title
            });
            if (list == null || list.length == 0) {
                Describe.error(player, "Target [" + title + "] has no associated character or handout.", target);
                return;
            }
            var handout = list[0];
            var image = handout.get("avatar");
            if (image == "") {
                image = null;
            }
            handout.get("notes", function(notes) {
                var text = Describe.getHTML(title, image, unescape(notes));
                if (playerIsGM(player.get("id"))) {
                    sendChat("Map", "/desc " + text);
                } else {
                    sendChat("Map", "/w \"" + player.get("displayname") + "\" " + text);
                }
            });
        } else {
            var image = null;
            if (image == null || image == "") {
                image = character.get("avatar");
            }
            character.get("bio", function(bio) {
                if (bio == undefined || bio.length == 0 || bio == "null") {
                    Describe.error(player, "Character has no bio defined.");
                    return;
                } else {
                    bio = bio.replace(/<br>-- <br>.*/, "");
                    if (title != null && title != "") {
                        var size = getAttrByName(character.id, "size_display");
                        if (size != null && size != "" && size != "Medium") {
                            title += "<br/>(" + size + ")";
                        }
                    }

                    var extra = "";
                    gmnotes = target.get("gmnotes");
                    if (gmnotes != null && gmnotes != "" && gmnotes != "null") {
                        gmnotes = unescape(gmnotes);
                        matches = gmnotes.match(/~~(.*?)~~/g);
                        if (matches != null && matches.length > 0) {
                            extra += "<div style='" + Describe.TEXT_STYLE + "'>";
                            for (var i=0; i < matches.length; i++) {
                                text = matches[i];
                                text = text.replace(/~~/g, "");
                                extra += text + "<BR>";
                            }
                            extra += "</div>";
                        }
                    }

                    if (typeof Info !== 'undefined') {
                        var statusText = Info.getStatusText(target);
                        if (statusText != "") {
                            extra += "<div style='" + Describe.TEXT_STYLE + "'>" + statusText + "</div>";
                        }
                    }
                    var html = Describe.getHTML(title, image, unescape(bio) + extra);

                    if (playerIsGM(player.get("id"))) {
                        sendChat("character|"+character.get("id"), "/desc " + html);
                    } else {
                        sendChat("character|"+character.get("id"),
                                 "/w \"" + player.get("displayname") + "\" " + html);
                    }
                }
            });
        }
    } else {
        Describe.error(player, "Nothing selected.");
    }
};
