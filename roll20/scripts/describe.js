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
    if (msg.content.split(" ", 1)[0] === "!describe") {
        var player_obj = getObj("player", msg.playerid);
        Describe.Process(msg, player_obj);
    }
});

var Describe = Describe || {};


Describe.Process = function(msg, player_obj) {
    var BOX_STYLE="background-color: #BBBB99; color: #000000; padding:0px; border:1px solid black; border-radius: 5px;"
    var TITLE_STYLE="background-color: #000000; color: #FFFFFF; padding: 1px; text-align: center";
    var TEXT_STYLE="padding: 5px;"

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
            image = getAttrByName(character.id, 'Picture');
            if (image == null || image == "") {
                image = character.get("avatar");
            }
            character.get("bio", function(bio) {
                if (bio == undefined || bio.length == 0) {
                    sendChat("", "/w " + player_obj.get("displayname") + " No bio defined");
                } else {
                    bio = bio.replace(/<br>-- <br>.*/, "");
                    var html = "<div style='" + BOX_STYLE + "'>";
                    if (title != undefined) {
                        html += "<div style='" + TITLE_STYLE + "'>" + title + "</div>";
                    }
                    if (image != null) {
                        html += "<img src='"+image+"' width='100%'/>";
                    }
                    html += "<div style='" + TEXT_STYLE + "'>" + unescape(bio) + "</div>";

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
                    if (playerIsGM(player_obj.get("id"))) {
                        sendChat("", "/direct " + html);
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