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
 *
 * The MIT License (MIT)
 *
 * Copyright (c) 2020, Samuel Penn, sam@notasnark.net
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

var Traveller = Traveller || {};
Traveller.VERSION = "1.0";

on("ready", function() {
    log(`==== Traveller Version ${Traveller.VERSION} ====`);
});

Traveller.getArgs = function(msg) {
    if (msg && msg.content) {
        return msg.content.split(" ");
    }  else {
        return [];
    }
};

// API COMMAND HANDLER
on("chat:message", function(msg) {
    if (msg.type !== "api") return;

    let player = getObj("player", msg.playerid);
    let args = Traveller.getArgs(msg);

    if (!args || args.length === 0) {
        sendChat("", "/w \"" + player.get("_displayname") + "\" No command found");
        return;
    }

    let command = args.shift();

    if (command === "!describe") {
        if (args.length === 0) {
            Traveller.error(player, "!describe expects a parameter, e.g. !describe &#64;{selected|token_id}");
            return;
        }
        let id = args.shift();

        Traveller.describe(msg, player, id);        
    }

});


Traveller.BOX_STYLE="background-color: #EEEEDD; color: #000000; padding:0px; border:1px solid black; border-radius: 5px 5px 10px 10px;";
Traveller.TITLE_STYLE="background-color: black; color: #FFFFFF; padding: 1px; font-style: normal; text-align: center; border-radius: 5px 5px 0px 0px;";
Traveller.TEXT_STYLE="padding: 5px; text-align: left; font-weight: normal; font-style: normal";


Traveller.getHTML = function(title, image, text, extra) {
    let html = "";

    if (!title) {
        title = "";
    }

    if (image) {
        html += "<img src='" + image + "' width='100%'/>";
    }
    html += "<div style='text-align: left; font-weight: normal;'>" + text + "</div>";
    if (extra) {
        html += extra;
    }

    return html;
};


/**
 * Given the name of a handout, finds the handout and returns the URL of
 * the image for that handout, or null if none is found.
 */
Traveller.getHandoutImage = function(handoutName) {
    if (handoutName) {
        let list = findObjs({
            _type: "handout",
            name: handoutName.trim()
        });
        if (list && list.length > 0) {
            let handout = list[0];
            if (handout) {
                log("Got handout");
                let avatarUrl = handout.get("avatar");
                if (avatarUrl) {
                    return avatarUrl;
                }
            }
        }
    }
    return null;
};

/**
 * Given unescaped text, searches for text between << and >>, and replaces that
 * with the image from the handout of the same name. This allows images to be
 * inserted into descriptive text.
 */
Traveller.convertLinks = function(text) {
    if (text && text.indexOf("&lt;&lt;") > -1) {
        let matches = text.match(/&lt;&lt;(.*?)&gt;&gt;/g);
        if (matches && matches.length > 0) {
            let replacedText = text;
            for (var i=0; i < matches.length; i++) {
                let match = matches[i].replace(/&..;/g, "");
                if (match.startsWith("http")) {
                    let left = replacedText.substring(0, replacedText.indexOf("&lt;&lt;"));
                    let right = replacedText.substring(replacedText.indexOf("&gt;&gt;") + 8);

                    replacedText = `${left}<img src='${match}' wdith='100%'/>${right}`;
                } else {
                    let avatarUrl = Traveller.getHandoutImage(match);
                    if (avatarUrl) {
                        let left = replacedText.substring(0, replacedText.indexOf("&lt;&lt;"));
                        let right = replacedText.substring(replacedText.indexOf("&gt;&gt;") + 8);

                        replacedText = left + "<img src='" + avatarUrl + "' width='100%'/>" + right;
                    }
                }
            }
            return replacedText;
        }
    }

    return text;
};

Traveller.describe = function(msg, player, target_id) {
    let target = getObj("graphic", target_id);
    if (target) {
        let title = target.get("name");
        let gmOnly = false;
        log("Title: " + title);
        if (title) {
            if (title.startsWith("~")) {
                gmOnly = true;
            }
            if (title.split(":").length > 1) {
                title = title.split(":")[1];
            }
            if (gmOnly) {
                title += " (Secret)";
            }
        }
        let character_id = target.get("represents");
        let character = getObj("character", character_id);
        if (!character) {
            // This might be a map symbol that links to a handout.
            // Look for a handout with the same name.
            let list = findObjs({
                _type: "handout",
                name: title
            });
            if (!list || list.length === 0) {
                log("This is not a handout");
                let image = target.get("imgsrc");
                let text = unescape(target.get("gmnotes"));
                let gmText = null;

                log(text);
                if (text.match("<br>--<br>")) {
                    gmText = text.replace(/.*<br>--<br>/, "");
                } else if (text.match("<p[^>]*>--</p>")) {
                    gmText = text.replace(/.*<p[^>]*>--<\/p>/, "");
                }

                text = text.replace(/<br>--<br>.*/, "");
                text = text.replace(/<p[^>]*>--<\/p>.*/, "");
                text = Traveller.convertLinks(text);

                let description = Traveller.getHTML(title, null, text);
                if (!gmOnly && playerIsGM(player.get("id"))) {
                    Traveller.message(player, description, title);
                } else {
                    Traveller.whisper(player, description, title);
                }
                if (!gmOnly && gmText && playerIsGM(player.get("id"))) {
                    description = Traveller.getHTML("GM Notes", null, gmText);
                    Traveller.whisper(player, description, "GM Notes");
                }
            } else {
                log("This is a handout");
                let handout = list[0];
                let image = handout.get("avatar");
                if (!image) {
                    image = null;
                }
                handout.get("notes", function (notes) {
                    let text = Traveller.getHTML(title, image, unescape(notes));
                    if (!gmOnly && playerIsGM(player.get("id")) && title) {
                        Traveller.message(player, text, title);
                    } else {
                        Traveller.whisper(player, text, title);
                    }
                });
            }
        } else {
            let image = character.get("avatar");
            character.get("bio", function(bio) {
                if (!bio || bio === "null") {
                    return;
                } else {
                    bio = bio.replace(/<br>--<br>.*/, "");
                    bio = bio.replace(/<p>--<\/p>.*/, "");

                    let extra = "";
                    gmnotes = target.get("gmnotes");
                    if (gmnotes != null && gmnotes != "" && gmnotes != "null") {
                        gmnotes = unescape(gmnotes);
                        let matches = gmnotes.match(/~~(.*?)~~/g);
                        if (matches != null && matches.length > 0) {
                            extra += "<div style='font-style: italic'>";
                            for (var i=0; i < matches.length; i++) {
                                text = matches[i];
                                text = text.replace(/~~/g, "");
                                extra += text + "<BR>";
                            }
                            extra += "</div>";
                        }
                    }

                    let description = Traveller.getHTML(title, image, unescape(bio) + extra);

                    if (playerIsGM(player.get("id"))) {
                        Traveller.message(player, description, title);
                    } else {
                        Traveller.whisperTo(player, player, description, title);
                    }
                }
            });
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
Traveller.message = function(player, message, title, func) {
    if (message) {
        let html = "<div style='" + Traveller.BOX_STYLE + "'>";
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
Traveller.whisper = function(player, message, title, func) {
    if (message) {
        let html = "<div style='" + Traveller.BOX_STYLE + "'>";
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
Traveller.whisperTo = function(from, to, message, title, func) {
    if (message && to) {
        let html = "<div style='" + Traveller.BOX_STYLE + "'>";
        if (title) {
            html += `<h3>${title}</h3>`;
        }
        html += message;
        html += "</div>";

        if (!to || !to.get) {
            sendChat("", `/desc ${html}`, func);
        } else if (from && typeof(from) === "object") {
            sendChat(`player|${from.get("_id")}`, `/w "${to.get("displayname")}" ${html}`, func);
        } else if (from && typeof(from) === "string") {
            sendChat(from, `/w "${to.get("displayname")}" ${html}`, func);
        } else if (to) {
            sendChat("", `/w "${to.get("displayname")}" ${html}`, func);
        }
    }
};

Traveller.error = function(player, message) {
    if (!message) {
        message = "Unknown error.";
    }

    try {
        if (player && typeof(player) === "object") {
            sendChat("Traveller", `/w "${player.get("_displayname")}" ${message}`);
        } else if (player && typeof(player) === "string") {
            let player = getObj("player", player);
            if (player) {
                sendChat("Traveller", `/w "${player.get("_displayname")}" ${message}`);
            } else {
                sendChat("Traveller", `/w GM ${message}`);
            }
        } else {
            sendChat("Traveller", `/w GM ${message}`);
        }
    } catch (err) {
        sendChat("Traveller", `/w GM Something went very wrong reporting error: ${message}`);
    }
};

