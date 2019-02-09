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

var PfDescribe = PfDescribe || {};
PfDescribe.VERSION = "2.0";

on("ready", function() {
    log(`==== PfDescribe Version ${PfDescribe.VERSION} ====`);

    if (PfInfo) {
        // Player commands.
        PfInfo.addPlayerHelp("!pfdescribe", "Args: <b>tokenId</b><br/>Describe the selected token, " +
                             "outputting avatar and description to the chat window.");
        PfInfo.addPlayerHelp("!pfmissions", "List all available currently active jobs.");

        // GM Only commands.
        //PfInfo.addGmHelp("!pflights", "Args: <b>duration</b>, <b>tokenId</b><br/>Reduce time left on light sources.");
    } else {
        sendChat("PfDescribe", "PfDescribe API depends on PfInfo, which is missing.");
    }
});



// API COMMAND HANDLER
on("chat:message", function(msg) {
    if (msg.type !== "api") return;

    let player = getObj("player", msg.playerid);
    let args = PfInfo.getArgs(msg);

    if (!args || args.length === 0) {
        sendChat("", "/w \"" + player.get("_displayname") + "\" No command found");
        return;
    }

    let command = args.shift();

    if (command === "!pfdescribe") {
        if (args.length === 0) {
            PfInfo.error(player, "!pfdescribe expects a parameter, e.g. !pfdescribe &#64;{selected|token_id}");
            return;
        }
        let id = args.shift();

        PfDescribe.describe(msg, player, id);
    } else if (command === "!pfmissions") {
        let verbose = false;
        let whisper = false;
        while (flag = args.shift()) {
            if (flag === "verbose") {
                verbose = true;
            }
            if (flag === "whisper") {
                whisper = true;
            }
        }
        PfDescribe.missions(msg, player, verbose, whisper);
    } else if (command === "!pfmission") {
        if (args.length === 0) {
            PfInfo.error(player, "!pfmission expects a parameter. Use !pfmissions to get list of missions.");
            return;
        }
        let id = args.shift();

        if (id === "Job:") {
            if (playerIsGM(player.get("id"))) {
                let title = msg.content.replace(/!mission /g, "");
                let list = findObjs({
                    _type: "handout",
                    name: title
                });
                if (list === null || list.length === 0) {
                    PfInfo.error(player, "Cannot find mission \"" + title + "\"");
                    return;
                }
                id = list[0].get("id");
                PfDescribe.mission(msg, player, id, true);
            } else{
                PfDescribe.error(player, "Only the GM can do this.");
            }
        } else {
            let whisper = args.shift();
            if (whisper === "whisper") {
                PfDescribe.mission(msg, player, id, true);
            } else {
                PfDescribe.mission(msg, player, id);
            }
        }
    }

});


PfDescribe.BOX_STYLE="background-color: #EEEEDD; color: #000000; padding:0px; border:1px solid black; border-radius: 5px 5px 10px 10px;";
PfDescribe.TITLE_STYLE="background-color: black; color: #FFFFFF; padding: 1px; font-style: normal; text-align: center; border-radius: 5px 5px 0px 0px;";
PfDescribe.TEXT_STYLE="padding: 5px; text-align: left; font-weight: normal; font-style: normal";


PfDescribe.getHTML = function(title, image, text, extra) {
    let html = "";

    if (!title) {
        title = "";
    }

    if (image) {
        html += "<img src='" + image + "' width='100%'/>";
    }
    html += "<div>" + text + "</div>";
    if (extra) {
        html += extra;
    }

    return html;
};

PfDescribe.missionHandout = function(handout, player, callback, whisper=false) {
    if (!handout) {
        PfInfo.error(player, "No mission handout defined.");
        return;
    }
    handout.get("notes", function(notes) {
        notes = unescape(notes);

        handout.get("gmnotes", function(gmnotes) {
            gmnotes = unescape(gmnotes);

            let firstline = gmnotes.replace(/<br>.*/, "");
            let title = handout.get("name").replace(/Job: */, "");

            let faction = null;
            let reward = null;
            let complexity = null;
            if (firstline.indexOf(",") !== -1) {
                let details = firstline.split(",");
                faction = details.shift();
                reward = details.shift();
                complexity = details.shift();

                if (!faction) {
                    faction = null;
                } else {
                    faction = faction.trim();
                }
                if (!reward) {
                    reward = null;
                } else {
                    reward = reward.trim();
                }
                if (!complexity) {
                    complexity = null;
                } else {
                    complexity = complexity.trim();
                }
            }

            callback.call(this, handout, player, title, faction, reward, complexity, notes, whisper);
        });
    });

};

/**
 * Given a faction name, either returns the faction name or the
 * character id of a matching character formatted for use in a
 * sendChat() call. e.g. "character|aBcD34567".
 */
PfDescribe.getFaction = function(faction) {
    if (!faction) {
        return null;
    }

    let list = findObjs({
        _type: "character",
        _name: faction
    });
    if (!list) {
        return faction;
    }
    return "character|" + list[0].get("id");
};

PfDescribe.getFactionImage = function(faction) {
    if (!faction) {
        return null;
    }

    let list = findObjs({
        _type: "character",
        _name: faction
    });
    if (!list) {
        return null;
    }
    return list[0].get("avatar");
};

PfDescribe.missionDetails = function(handout, player, title, faction, reward, complexity, notes, whisper) {
    let text = "";
    if (faction) {
        /*
        var image = Describe.getFactionImage(faction);
        if (image != null) {
            text += "<img src='" + image + "' width='50px' style='float:right'/>";
        }
        */
        text += "<b>Faction: </b>" + faction + "<br/>";
    }
    if (reward) {
        text += "<b>Reward: </b>" + reward + "<br/>";
    }
    if (complexity) {
        text += "<b>Complexity: </b>" + complexity + "<br/>";
    }
    if (faction || reward) {
        text += "<br/>";
    }
    let avatar = handout.get("avatar");
    if (avatar !== null) {
        text += "<img src='" + avatar + "' width='100%'/>";
    }

    text += notes;

    faction = PfDescribe.getFaction(faction);
    if (playerIsGM(player.get("id")) && !whisper) {
        sendChat(faction?faction:"", "" + PfDescribe.getHTML(title, null, text));
    } else {
        sendChat(faction?faction:"", "/w \"" + player.get("displayname") + "\" " + PfDescribe.getHTML(title, null, text));
    }
};

PfDescribe.missionList = function(handout, player, title, faction, reward, complexity, notes, whisper) {
    if (reward) {
        title += " (" + reward + ")";
    }
    let text = "";
    if (whisper) {
        text = "[" + title + "](!pfmission " + handout.get("_id") + " whisper)";
    } else {
        text = "[" + title + "](!pfmission " + handout.get("_id") + ")";
    }

    faction = PfDescribe.getFaction(faction);
    if (playerIsGM(player.get("id")) && !whisper) {
        sendChat(faction?faction:"", text);
    } else {
        sendChat(faction?faction:"", "/w \"" + player.get("displayname") + "\" " + text);
    }
};

PfDescribe.mission = function(msg, player, id, whisper = false) {
    let list = findObjs({
        _type: "handout",
        _id: id
    });
    if (!list || list.length === 0) {
        PfDescribe.error(player, "Failed to find mission handout with id [" + id + "]");
        return;
    }
    let handout = list[0];
    PfDescribe.missionHandout(handout, player, PfDescribe.missionDetails, whisper);
};


PfDescribe.missions = function(msg, player, verbose = false, whisper = false) {
    let list = null;
    if (whisper && playerIsGM(player.get("id"))) {
        list = findObjs({
            _type: "handout",
            archived: false
        });
    } else {
        list = findObjs({
            _type: "handout",
            inplayerjournals: "all",
            archived: false
        });
    }
    if (!list || list.length === 0) {
        PfDescribe.error(player, "No missions are currently available for listing.");
        return;
    }
    let jobs = [];
    for (let i=0; i < list.length; i++) {
        if (list[i].get("name").startsWith("Job:")) {
            jobs.push(list[i]);
        }
    }

    if (playerIsGM(player.get("id")) && !whisper) {
        sendChat("player|" + player.get("id"),
                 "The following jobs are currently listed as being available.");
    } else if (playerIsGM(player.get("id"))) {
        sendChat("player|" + player.get("id"),
                 "/w \"" + player.get("displayname") + "\" " +
                 "The following jobs are currently listed as being available.");
    }
    for (let i=0; i < jobs.length; i++) {
        let handout = jobs[i];
        if (verbose === true) {
            PfDescribe.missionHandout(handout, player, PfDescribe.missionDetails, whisper);
        } else {
            PfDescribe.missionHandout(handout, player, PfDescribe.missionList, whisper);
        }
    }
};

/**
 * Given the name of a handout, finds the handout and returns the URL of
 * the image for that handout, or null if none is found.
 */
PfDescribe.getHandoutImage = function(handoutName) {
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
PfDescribe.convertLinks = function(text) {
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
                    let avatarUrl = PfDescribe.getHandoutImage(match);
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

PfDescribe.describe = function(msg, player, target_id) {
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
                text = PfDescribe.convertLinks(text);

                let description = PfDescribe.getHTML(title, null, text);
                if (!gmOnly && playerIsGM(player.get("id"))) {
                    PfInfo.message(player, description, title);
                } else {
                    PfInfo.whisper(player, description, title);
                }
                if (!gmOnly && gmText && playerIsGM(player.get("id"))) {
                    description = PfDescribe.getHTML("GM Notes", null, gmText);
                    PfInfo.whisper(player, description, "GM Notes");
                }
            } else {
                log("This is a handout");
                let handout = list[0];
                let image = handout.get("avatar");
                if (!image) {
                    image = null;
                }
                handout.get("notes", function (notes) {
                    let text = PfDescribe.getHTML(title, image, unescape(notes));
                    if (!gmOnly && playerIsGM(player.get("id")) && title) {
                        PfInfo.message(player, text, title);
                    } else {
                        PfInfo.whisper(player, text, title);
                    }
                });
            }
        } else {
            let image = character.get("avatar");
            character.get("bio", function(bio) {
                if (!bio || bio === "null") {
                    PfInfo.error(player, "Character has no bio defined.");
                    return;
                } else {
                    bio = bio.replace(/<br>--<br>.*/, "");
                    bio = bio.replace(/<p>--<\/p>.*/, "");
                    if (bio) {
                        let size = getAttrByName(character.id, "size_display");
                        if (size) {
                            // Size attribute used to be capitalised, now we need to
                            // enforce this manually.
                            size  = size.substr(0, 1).toUpperCase() + size.substr(1);
                            if (size !== "Medium") {
                                size = "<div style='text-align: center; font-style: italic'>(" + size + ")</div>";
                                bio = size + bio;
                            }
                        }
                    }

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

                    if (typeof PfInfo !== 'undefined') {
                        let statusText = PfInfo.getStatusText(target);
                        if (statusText) {
                            extra += "<div style='" + PfDescribe.TEXT_STYLE + "'>" + statusText + "</div>";
                        }
                    }
                    let description = PfDescribe.getHTML(title, image, unescape(bio) + extra);

                    if (playerIsGM(player.get("id"))) {
                        PfInfo.message(player, description, title);
                    } else {
                        PfInfo.whisperTo(player, player, description, title);
                    }
                }
            });
        }
    } else {
        PfInfo.error(player, "Nothing selected.");
    }
};
