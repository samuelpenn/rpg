/**
 * DV
 *
 * Commands to handle starship combat maps.
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


var DV = DV || {};
DV.VERSION = "0.7";
DV.DEBUG = true;


on("ready", function() {
    log(`==== Physics Version ${DV.VERSION} ====`);
});


/**
 * Single event handler for all chat messages.
 */
on("chat:message", function(msg) {
    if (msg.type !== "api") return;
    let args = msg.content.replace(/ +/, " ").split(" ");
    let command = args.shift();
    let playerId = msg.playerid;

    if ("!dv".startsWith(command) && command.length > 2) {
        DV.command(playerId, msg, args);
    }
});


DV.STYLE="background-color: #eeeeee; color: #000000; padding:2px; border:1px solid black; border-radius: 5px; text-align: left; font-weight: normal; font-style: normal; min-height: 80px";


DV.whisper = function(token, message, func) {
    let html = "<div style='" + DV.STYLE + "'>";

    let name = token.get("name");
    let image = token.get("imgsrc");

    html += `<img style='float:right' width='64' alt='${name}' src='${image}'>`;
    html += `<h3 style='display: inline-block; border-bottom: 2px solid black; margin-bottom: 2px;'>${name}</h3><br/>`;
    html += message;

    html += "</div>";

    if (func) {
        sendChat(name, "/w GM " + html, func);
    } else {
        sendChat(name, "/w GM " + html);
    }
};

DV.message = function(title, message, func) {
    let html = "<div style='" + DV.STYLE + "'>";

    if (title) {
        html += `<h3 style='display: inline-block; border-bottom: 2px solid black; margin-bottom: 2px;'>${title}</h3><br/>`;
    }
    html += message;
    html += "</div>";

    if (func) {
        sendChat("", "/desc " + html, func);
    } else {
        sendChat("", "/desc " + html);
    }
};

DV.debug = function(title, message) {
    if (DV.DEBUG) {
        sendChat("", `/desc <b>${title}:</b> ${message}`);
    }
    log(`$(title}: ${message}`);
};



DV.command = function (playerId, msg, args) {
    log("dvCommand:");
    if (args === null || args.length === 0) {
        // No commands.
        let html = "You need some commands";

        DV.message("!dv help", html)
    } else {
        let cmd = args.shift();

        if ("set".startsWith(cmd)) {
            let tokens = DV.getSelectedTokens(msg, false);
            DV.setCommand(playerId, tokens, args);
        }
        if ("focus".startsWith(cmd)) {
            let tokens = DV.getSelectedTokens(msg, true);
            DV.focusCommand(playerId, tokens, args);
        }

        if ("info".startsWith(cmd)) {
            let tokens = DV.getSelectedTokens(msg, false);
            DV.infoCommand(playerId, tokens, args);
        }

        if ("turn".startsWith(cmd)) {
            let tokens = DV.getSelectedTokens(msg, false);
            DV.turnCommand(playerId, tokens, args);
        }
    }
};

DV.getSelectedTokens = function (msg, forceExplicit) {
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
            if (!token || !token.get("name")) {
                continue;
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
            log("Combat.getSelectedTokens: forceExplicit is set, and " + tokenList.length + " tokens found.");
            return null;
        }
    }

    return tokenList;
};

DV.ZOOM = 3;
DV.SCALE = 1000;

DV.getVector = function(token) {
    let vector = [];

    if (!token) {
        return null;
    }

    let xy = (""+token.get("bar1_value")).split(",");
    let v = (""+token.get("bar2_value")).split(",");

    vector["x"] = parseInt(xy[0]);
    vector["y"] = parseInt(xy[1]);
    vector["xv"] = parseInt(v[0]);
    vector["yv"] = parseInt(v[1]);
    vector["angle"] = parseInt(xy[2]);

    return vector;
};

DV.setVector = function(token, vector) {
    if (vector === null || vector === undefined) {
        vector = [];
        vector["x"] = 0;
        vector["y"] = 0;
        vector["xv"] = 0;
        vector["yv"] = 0;
        vector["angle"] = parseInt(token.get("rotation") % 360);
    }
    token.set({
        "bar1_value": vector["x"] + "," + vector["y"] + "," + vector["angle"],
        "bar2_value": vector["xv"] + "," + vector["yv"]
    })
};

// Print out details on a planet.
DV.focusCommand = function (playerId, tokens, args) {
    let pageId = Campaign().get("playerpageid");

    let page = getObj("page", pageId);

    let width = parseInt(page.get("width"));
    let height = parseInt(page.get("height"));

    let cx = parseInt(width * 35);
    let cy = parseInt(height * 35);

    // Get the focus ship, move it to centre.
    let focusToken = tokens[0];
    if (!focusToken) {
        return;
    }
    let focusVector = DV.getVector(focusToken);
    let angle = parseInt(focusVector["angle"]);
    log("Focus angle is " + focusVector["angle"] + " so we need to rotate everyone " + angle);
    focusToken.set({
        "left": cx,
        "top": cy,
        "rotation": 0
    });

    let allTokens = findObjs({
        _pageid: Campaign().get("playerpageid"),
        _type: "graphic"
    });
    _.each(allTokens, function(token) {
        if (token.get("name").startsWith("!") && token.get("name") !== focusToken.get("name")) {
            log("Moving " + token.get("name"));
            let vector = DV.getVector(token);
            let dx = vector["x"] - focusVector["x"];
            let dy = vector["y"] - focusVector["y"];
            let a = (vector["angle"] - focusVector["angle"])%360;

            // Get the distance to the other ship.
            let distance = Math.pow(Math.pow(dx, 2) + Math.pow(dy, 2), 0.5);
            log("    Distance to this ship is " + distance);
            log("    Rotating by " + focusVector["angle"]);

            let rad = parseFloat(focusVector["angle"]) * -0.0174533;
            log("rads are " + rad);
            let px = dx * Math.cos(rad) - dy * Math.sin(rad);
            let py = dx * Math.sin(rad) + dy * Math.cos(rad);

            px = cx + 70 * (px / DV.SCALE);
            py = cy + 70 * (py / DV.SCALE);

            let ta = parseInt(token.get("rotation")) - angle;
            //ta = parseInt(ta % 360);
            if (ta < 0) {
                ta + 360;
            }

            token.set({
                "left": px,
                "top": py,
                "rotation": a
            })

        }
    });


};


DV.getValue = function(list, key) {
    // noinspection JSUnresolvedFunction
    log("getValue: [" + key + "]");
    for (let i=0; i < list.length; i++) {
        if (list[i].get("name") == key) {
            return list[i].get("current");
        }
    }
    return "";
};

DV.getValueInt = function(list, key) {
    let value = DV.getValue(list, key);
    if (value === null || value === "") {
        return 0;
    }
    return parseInt(value) || 0;
};


DV.setCommand = function (playerId, tokens, args) {
    for (let i=0; i < tokens.length; i++) {
        let token = tokens[i];
        log(i);
        log(token.get("name"));

        DV.setVector(token, null);
    }
};

DV.infoCommand = function (playerId, tokens, args) {
    for (let i=0; i < tokens.length; i++) {
        let token = tokens[i];

        let vector = DV.getVector(token);

        let html = "<b>X:</b> " + vector["x"] + "<br/>";
        html += "<b>Y:</b> " + vector["y"] + "<br/>";
        html += "<b>Angle:</b> " + parseInt(token.get("rotation"));

        DV.message(token.get("name"), html);
    }
}


DV.turnCommand = function (playerId, tokens, args) {
    let angle = parseInt(args[0]);
    for (let i=0; i < tokens.length; i++) {
        let token = tokens[i];

        let vector = DV.getVector(token);
        vector["angle"] = parseInt((parseInt(vector["angle"]) + angle) % 360)

        DV.setVector(token, vector);

        token.set({
            "rotation": (token.get("rotation") + angle)%360
        });

    }
};


