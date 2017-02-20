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
    if (msg.content.split(" ", 1)[0] === "!describe") {
        var player_obj = getObj("player", msg.playerid);
        Describe.Process(msg, player_obj);
    } else if (msg.content.split(" ", 1)[0] === "!missions") {
        var player_obj = getObj("player", msg.playerid);
        Describe.missions(msg, player_obj);
    } else if (msg.content.split(" ", 1)[0] === "!mission") {
        var id = msg.content.split(" ")[1];
        Describe.mission(msg, player_obj, id);
    }
});

var Describe = Describe || {};

Describe.BOX_STYLE="background-color: #EEEEDD; color: #000000; padding:0px; border:1px solid black; border-radius: 5px 5px 10px 10px;";
Describe.TITLE_STYLE="background-color: black; color: #FFFFFF; padding: 1px; font-style: normal; text-align: center; border-radius: 5px 5px 0px 0px;";
Describe.TEXT_STYLE="padding: 5px; text-align: left; font-weight: normal; font-style: normal";

Describe.getHTML = function(title, image, text) {
    var html = "<div style='" + Describe.BOX_STYLE + "'>";

    if (title == null) {
        title = "";
    }

    html += "<div style='" + Describe.TITLE_STYLE + "'>" + title + "</div>";
    if (image != null) {
        html += "<img src='" + image + "' width='100%'/>";
    }
    html += "<div style='" + Describe.TEXT_STYLE + "'>" + text + "</div>";
    html += "</div>";

    return html;
};

Describe.missionHandout = function(handout, callback) {
    handout.get("notes", function(notes) {
        var notes = unescape(notes);

        handout.get("gmnotes", function(gmnotes) {
            gmnotes = unescape(gmnotes);

            var firstline = gmnotes.replace(/<br>.*/, "");
            var title = handout.get("name");

            var faction = firstline.replace(/,.*/, "");
            var reward = firstline.replace(/.*, /g, "");

            var text = "<b>Faction: </b>" + faction + "<br/>";
            text += "<b>Reward: </b>" + reward + "<br/>";
            text += "<br/>";

            text += notes;
            
            callback.call(this, handout, title, faction, reward, notes);

//            text += "<br>[Details](!mission " + handout.get("_id")+")";
//            sendChat("", "/desc " + Describe.getHTML(title, null, text));
        });
    });

};

Describe.missionDetails = function(handout, title, faction, reward, notes) {
    var text = "<b>Faction: </b>" + faction + "<br/>";
    text += "<b>Reward: </b>" + reward + "<br/>";
    text += "<br/>";

    text += notes;

    sendChat("", "/desc " + Describe.getHTML(title, null, text));
}

Describe.missionList = function(handout, title, faction, reward, notes) {
    var text = "[" + title + " (" + faction + ", " + reward+")](!mission " + handout.get("_id") + ")";
    sendChat("", text);
}

Describe.mission = function(msg, player_obj, id) {
    var list = findObjs({
        _type: "handout",
        _id: id
    });
    var handout = list[0];
    Describe.missionHandout(handout, Describe.missionDetails);
};


Describe.missions = function(msg, player_obj) {
    var list = findObjs({
        _type: "handout",
        inplayerjournals: "all"
    });
    if (list == null || list.length == 0) {
        sendChat("Jobs Board", "/desc No missions available");
        return;
    }

    sendChat("", "The following jobs are currently listed as being available.");
    for (var i=0; i < list.length; i++) {
        var handout = list[i];
        Describe.missionHandout(handout, Describe.missionList);
    }
};

Describe.Process = function(msg, player_obj) {
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
            // This might be a map symbol that links to a handout.
            // Look for a handout with the same name.
            var list = findObjs({
                _type: "handout",
                name: title
            });
            if (list == null) {
                sendChat("", "/w " + player_obj.get("displayname") + " No character found");
                return;
            }
            var handout = list[0];
            var image = handout.get("avatar");
            if (image == "") {
                image = null;
            }
            handout.get("notes", function(notes) {
                var text = Describe.getHTML(title, image, unescape(notes));
                if (playerIsGM(player_obj.get("id"))) {
                    sendChat("", "/desc " + text);
                } else {
                    sendChat("", "/w " + player_obj.get("displayname") + " " + text);
                }
            });
        } else {
            var image = null;
            if (image == null || image == "") {
                image = character.get("avatar");
            }
            character.get("bio", function(bio) {
                if (bio == undefined || bio.length == 0) {
                    sendChat("", "/w " + player_obj.get("displayname") + " No bio defined");
                } else {
                    bio = bio.replace(/<br>-- <br>.*/, "");
                    if (title != undefined) {
                        var size = getAttrByName(character.id, "size_display");
                        if (size != null && size != "" && size != "Medium") {
                            title += "<br/>(" + size + ")";
                        }
                    }

                    var html = Describe.getHTML(title, image, unescape(bio));

                    gmnotes = target.get("gmnotes");
                    if (gmnotes != null && gmnotes != "") {
                        gmnotes = unescape(gmnotes);
                        matches = gmnotes.match(/~~(.*?)~~/g);
                        if (matches != null && matches.length > 0) {
                            html += "<div style='" + TEXT_STYLE + "'>";
                            for (var i=0; i < matches.length; i++) {
                                text = matches[i];
                                text = text.replace(/~~/g, "");
                                html += text + "<BR>";
                            }
                            html += "</div>";
                        }
                    }

                    var statusText = Info.getStatusText(target);
                    if (statusText != "") {
                        html += "<div style='" + TEXT_STYLE + "'>" + statusText + "</div>";
                    }

                    if (playerIsGM(player_obj.get("id"))) {
                        sendChat("", "/desc " + html);
                    } else {
                        sendChat("", "/w " + player_obj.get("displayname") + " " + html);
                    }
                }
            });
        }
    } else {
        sendChat("", "/w " + player_obj.get("displayname") + " Nothing selected.");
    }
};
