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

DV.number = function(number) {
    let formatter = new Intl.NumberFormat('en-GB', { });

    return formatter.format(parseInt(number));
}

DV.distance = function(metres) {
    let formatter = new Intl.NumberFormat('en-GB', {
    });
    let result = metres;

    if (Math.abs(metres) < 10000) {
        result = formatter.format(metres) + "m";
    } else if (Math.abs(metres) < 1000000000) {
        let km = parseInt(metres / 1000);
        result = formatter.format(km) + "km";
    } else {
        let mkm = parseInt(metres / 1000000000);
        result = formatter.format(mkm) + " Mkm";
    }

    return result;
}

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

        if ("scale".startsWith(cmd)) {
            let tokens = DV.getSelectedTokens(msg, false);
            DV.scaleCommand(playerId, tokens, args);
        }

        if ("thrust".startsWith(cmd)) {
            let tokens = DV.getSelectedTokens(msg, false);
            DV.thrustCommand(playerId, tokens, args);
        }
        if ("move".startsWith(cmd)) {
            DV.moveCommand(playerId);
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
DV.SCALE = 10;          // Kilometres per 'square'
DV.TURN_SECONDS = 360;  // Seconds in a turn.

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

DV.getFocusToken = function(allTokens) {
    let pageId = Campaign().get("playerpageid");
    let page = getObj("page", pageId);

    if (allTokens === null || allTokens === undefined) {
        allTokens = findObjs({
            _pageid: Campaign().get("playerpageid"),
            _type: "graphic"
        });
    }
    for (let t=0; t < allTokens.length; t++) {
        let token = allTokens[t];
        if (token.get("name").startsWith("!") && token.get("status_flying-flag")) {
            return token;
        }
    }
    return null;
}

// Print out details on a planet.
DV.focusCommand = function (playerId, tokens, args) {
    let pageId = Campaign().get("playerpageid");
    let page = getObj("page", pageId);

    let width = parseInt(page.get("width"));
    let height = parseInt(page.get("height"));

    let cx = parseInt(width * 35);
    let cy = parseInt(height * 35);

    // Get the focus ship, move it to centre.
    let focusToken = null;

    let allTokens = findObjs({
        _pageid: Campaign().get("playerpageid"),
        _type: "graphic"
    });
    if (tokens != null && tokens.length > 0) {
        focusToken = tokens[0];
        if (!focusToken) {
            return;
        }
    } else {
        focusToken = DV.getFocusToken(allTokens);
    }
    let focusVector = DV.getVector(focusToken);
    let angle = parseInt(focusVector["angle"]);
    log("Focus angle is " + focusVector["angle"] + " so we need to rotate everyone " + angle);
    focusToken.set({
        "left": cx,
        "top": cy,
        "rotation": 0,
        "status_flying-flag": true
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

            let rad = parseFloat(focusVector["angle"]) * 0.0174533;
            log("rads are " + rad);
            let px = dx * Math.cos(rad) - dy * Math.sin(rad);
            let py = dx * Math.sin(rad) + dy * Math.cos(rad);

            px = cx + 70 * (px / DV.SCALE);
            py = cy - 70 * (py / DV.SCALE);

            let ta = parseInt(token.get("rotation")) - angle;
            //ta = parseInt(ta % 360);
            if (ta < 0) {
                ta + 360;
            }

            token.set({
                "left": px,
                "top": py,
                "rotation": a,
                "status_flying-flag": false
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
    let allObjs = findObjs({
        _pageid: Campaign().get("playerpageid"),
        _type: "graphic"
    });
    let focus = null;
    _.each(allObjs, function (token) {
        if (token.get("name").startsWith("!") && token.get("status_flying-flag")) {
            focus = token;
        }
    });
    if (focus) {
        DV.message(null, "Info centred on " + focus.get("name"));
    } else {
        return;
    }
    let focusVector = DV.getVector(focus);

    if (tokens.length == 0) {

    }

    for (let i=0; i < tokens.length; i++) {
        let token = tokens[i];

        let vector = DV.getVector(token);
        let x = vector["x"] - focusVector["x"];
        let y = vector["y"] - focusVector["y"];

        let html = "<b>X:</b> " + DV.distance(x) + "<br/>";
        html += "<b>Y:</b> " + DV.distance(y) + "<br/>";
        html += "<b>Angle:</b> " + parseInt(token.get("rotation")) + "° (" + parseInt(vector["angle"]) + "°)<br/>";
        html += "<b>Xv:</b> " + parseInt( vector["xv"] / 1000) + "km/s<br/>";
        html += "<b>Yv:</b> " + parseInt( vector["yv"] / 1000) + "km/s<br/>";

        DV.message(token.get("name"), html);
    }
};


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


// Taken from here:
// https://github.com/djmoorehead/roll20-api-scripts/blob/master/Radar/Radar.js
DV.buildCircle = function(rad) {
    let circlePoints;
    let steps, stepSize;
    let deg2rad = Math.PI/180;

    steps = Math.min(Math.max(Math.round( (Math.PI*2*Math.sqrt((2*rad*rad)/2))/35),4),20);

    const at = (theta) => ({x: Math.cos(theta)*rad, y: Math.sin(theta)*rad});

    //Build a full circle
    stepSize = Math.PI/(2*steps);

    let acc=[[],[],[],[]];
    let th=0;
    _.times(steps+1,()=>{
        let pt=at(th);
        acc[0].push([pt.x,pt.y]);
        acc[1].push([-pt.x,pt.y]);
        acc[2].push([-pt.x,-pt.y]);
        acc[3].push([pt.x,-pt.y]);
        th+=stepSize;
    });
    acc = acc[0].concat(
        acc[1].reverse().slice(1),
        acc[2].slice(1),
        acc[3].reverse().slice(1)
    );

    //Some js wizardry from TheAaron with the array map function. I couldn't make it work without returning the outer (1st & last) square brackets
    //So, we will take this string, strip the last "]", then append the grid points to the path
    circlePoints = JSON.stringify(acc.map((v,i)=>([(i?'L':'M'),rad+v[0],rad+v[1]])));
    circlePoints = circlePoints.substring(0, circlePoints.length - 1);

    return circlePoints + "]";
}

DV.scaleCommand = function (playerId, tokens, args) {
    log("scaleCommand:");
    let pageId = Campaign().get("playerpageid");
    let page = getObj("page", pageId);

    let width = parseInt(page.get("width"));
    let height = parseInt(page.get("height"));

    let cx = parseInt(width * 35);
    let cy = parseInt(height * 35);

    if (args.length > 0) {
        let scale = parseInt(args[0]);
        DV.SCALE = scale * 1000;
    } else {
        log("Working out auto scale");
        let allObjs = tokens;

        if (!tokens || tokens.length == 0) {
            allObjs = findObjs({
                _pageid: Campaign().get("playerpageid"),
                _type: "graphic"
            });
        }
        log("Number of objects: " + allObjs.length);
        let focusToken = DV.getFocusToken(allObjs);

        if (!focusToken) {
            log("Nothing to scale against");
            return;
        }

        let vector = DV.getVector(focusToken);
        let focusX = vector["x"];
        let focusY = vector["y"];
        let maxD = 0;

        for (let i=0; i < allObjs.length; i++) {
            let token = allObjs[i];
            if (token.get("name").startsWith("!")) {
                let vector = DV.getVector(token);
                let x = vector["x"] - focusX;
                let y = vector["y"] - focusY;
                let d = Math.sqrt(x * x + y * y);
                if (d > maxD) {
                    maxD = d;
                    log(token.get("name") + ": Set maximum distance to " + DV.number(maxD));
                }
            }
        }
        DV.SCALE = parseInt(maxD / (width / 3));
        if (DV.SCALE < 100) {
            DV.SCALE = 100;
        }
        log("Auto scale set to be " + DV.SCALE);
        DV.message("Scale", "Auto scale set to be " + DV.SCALE);
    }

    // Delete existing paths.
    let allPaths = findObjs({
        _pageid: Campaign().get("playerpageid"),
        _type: "path"
    });
    for (let p=0; p < allPaths.length; p++) {
        allPaths[p].remove();
    }

    // Delete existing text.
    let allText = findObjs({
        _pageid: Campaign().get("playerpageid"),
        _type: "text"
    });
    for (let p=0; p < allText.length; p++) {
        allText[p].remove();
    }

    let zones = [ 1, 10, 1250, 10000, 25000, 50000, 100000, 200000, 500000 ];

    zones.forEach(function(distance) {
        let radius = (70 * (1000 * distance / DV.SCALE));
        if (radius >= 70 && radius < cx * 4) {
            let circlePoints = DV.buildCircle(radius);
            createObj("path", {
                "_pageid": pageId,
                "fill": "transparent",
                "stroke": "#000000",
                "rotation": 0,
                "layer": "map",
                "stroke_width": 5,
                "_path": circlePoints,
                "width": radius * 2,
                "height": radius * 2,
                "top": cy,
                "left": cx
            });

            createObj("text", {
               "_pageid": pageId,
               "layer": "map",
               "text": DV.number(distance) + "km",
               "top": cy - radius,
                "left": cx,
                "font_size": 48,
                "font_family": "Arial"
            });
        }
    });
    DV.focusCommand(playerId, null, null);
}

/**
 * Accelerate a ship along its current facing using the specified acceleration.
 *
 * @param playerId
 * @param tokens
 * @param args
 */
DV.thrustCommand = function(playerId, tokens, args) {
    let focusToken = tokens[0];
    if (!focusToken) {
        return;
    }
    let focusVector = DV.getVector(focusToken);
    let accl = parseInt(args[0]);

    log("Accl: " + accl);

    let xv = focusVector["xv"];
    let yv = focusVector["yv"];

    let rad = parseFloat(focusVector["angle"]) * 0.0174533;
    xv += accl * Math.sin(rad) * DV.TURN_SECONDS;
    yv += accl * Math.cos(rad) * DV.TURN_SECONDS;
    focusVector["xv"] = parseInt(xv);
    focusVector["yv"] = parseInt(yv);
    DV.setVector(focusToken, focusVector);
}

DV.moveCommand = function(playerId) {
    let allTokens = findObjs({
        _pageid: Campaign().get("playerpageid"),
        _type: "graphic"
    });

    _.each(allTokens, function(token) {
        if (token.get("name").startsWith("!")) {
            log("Moving " + token.get("name"));
            let vector = DV.getVector(token);
            vector["x"] += vector["xv"] * DV.TURN_SECONDS;
            vector["y"] += vector["yv"] * DV.TURN_SECONDS;

            DV.setVector(token, vector);
        }
    });
    DV.focusCommand(playerId, null, null);
}