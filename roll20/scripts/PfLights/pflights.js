/**
 * Control lights.
 *
 * A light is anything with !Light as the first part of the GM Notes on the token.
 *
 * bar2 is considered to hold the duration of the light source, in minutes. Every
 * time the script is invoked (optionally, with a number of minutes), the duration
 * is reduced.
 *
 * At the end of their life, light sources reduce in luminosity until they go out.
 *
 * Magical sources (anything with 'Spell' in the token name) are constant brightness
 * right up to the end, then go out very quickly.
 *
 * Non-magical sources begin to decay towards the end, and then die out gradually
 * when the duration expires.
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

var PfLight = PfLight || {};

PfLight.BOX_STYLE="background-color: #EEEEDD; color: #000000; padding:0px; border:1px dashed black; border-radius: 10px; padding: 3px; font-style: normal; font-weight: normal; text-align: left";

/**
 * Displays an error back to the player. Errors are always whispered so
 * as not to annoy everyone else.
 */
PfLight.error = function(player, message) {
    if (player !== null) {
        sendChat("pfLight", "/w \"" + player.get("displayname") + "\" " + message);
    } else {
        sendChat("pfLight", "/w GM " + message);
    }
};

PfLight.actionMessage = function(token, message) {
    var characterId = token.get("represents");

    var html = "<div style='" + PfLight.BOX_STYLE + "'>";
    var image = token.get("imgsrc");
    html += "<img src='" + image + "' width='50px' style='float:left; margin-top:-25px; padding-top: 0px; background-color: white; border-radius: 25px;'/>";
    html += "<div style='margin-left: 60px; padding-bottom: 10px'>";
    html += message + "</div>";
    html += "</div>";

    sendChat("character|"+characterId, "/desc " + html);
};


// API COMMAND HANDLER
on("chat:message", function(msg) {
   if (msg.type !== "api") return;

   var args = msg.content.split(" ");
   var command = args.shift();
   var player = getObj("player", msg.playerid);
   var isGM = playerIsGM(player.get("_id"));
   var token = null;
   var tokenId = null;

    if (command === "!pftake") {
       if (args.length !== 1) {
           PfLight.error(player, "Must be exactly one argument.");
           return;
       }
       tokenId = args.shift();
       if (tokenId) {
           token = getObj("graphic", tokenId);
           PfLight.takeCommand(player, token);
       } else {
           PfLight.error(player, "Missing argument <i>token_id</i>");
       }
    } else if (command === "!pfdrop") {
       if (args.length !== 1) {
           PfLight.error(player, "Must be exactly one argument.");
           return;
       }
       tokenId = args.shift();
       if (tokenId) {
           token = getObj("graphic", tokenId);
           PfLight.dropCommand(player, token);
       } else {
           PfLight.error(player, "Missing argument <i>token_id</i>");
       }
    } else if (command === "!pfvision") {
        if (!isGM) {
            PfLight.error(player, "You must be the GM to be able to run this.");
        } else if (args.length !== 1) {
            PfLight.error(player, "Must be exactly one argument, <i>light_level</i>.");
        } else {
            var lightLevel = args.shift();
            PfLight.setVisionCommand(player, args);
        }
    } else if (command === "!pflights") {
        if (!isGM) {
            PfLight.error(player, "You must be the GM to be able to run this.");
        } else {
            var duration = args.shift();
            tokenId = args.shift();
            if (!duration) {
                duration = 0;
            } else {
                duration = parseInt(duration);
                if (duration < 0) {
                    duration = 0;
                }
            }
            if (tokenId) {
                token = getObj("graphic", tokenId);
                if (token === undefined) {
                    token = null;
                }
            }
            PfLight.lightsCommand(duration, token);
        }
    }
});



PfLight.setVision = function(token, radius, dimRadius) {
    var hasSight = token.get("light_hassight");
    if (hasSight !== true) {
        // No vision, so nothing to do.
        return;
    }
    var lightMultiplier = token.get("light_multiplier");
    if (lightMultiplier !== null && lightMultiplier !== "") {
        lightMultiplier = parseFloat(lightMultiplier);
    } else {
        lightMultiplier = 1.0;
    }
    var characterId = token.get("represents");
    if (characterId === null) {
        // This isn't a character, so nothing to do.
        return;
    }
    log("    Character has sight.");
    var vision = getAttrByName(characterId, "vision");
    if (vision !== null && vision !== "") {
        vision = vision.toLowerCase();
    } else {
        vision = "";
    }
    // If a character has darkvision, then increase their vision out
    // to their darkvision limit.
    if (vision.indexOf("darkvision") > -1) {
        var darkVisionRadius = 60;
        var dr = vision.replace(/.*darkvision +([0-9]+).*/, "$1");
        if (parseInt(dr) > 0) {
            dr = parseInt(dr);
            log("    Character has darkvision " + dr);
            if (lightMultiplier > 1) {
                // If they also have low-light vision, then darkvision radius
                // shouldn't be multiplied, so we divide radius first, so when
                // it's multiplied by the engine it is correct.
                dr = dr / lightMultiplier;
            }
            if (radius === null || dr > parseInt(radius)) {
                radius = dr;
            }
            if (dimRadius === null || dr > parseInt(dimRadius)) {
                dimRadius = dr;
            }
            log("    Setting vision to be " + radius);
        }
    }
    // A character's Perception can modify how far they can see.
    var perception = getAttrByName(characterId, "Perception");
    log("    Character Perception " + perception);
    if (perception !== null && parseInt(perception) !== 0 && radius !== null) {
        var bonus = parseInt(perception) * (radius / 20.0);
        radius += parseInt(bonus);
        if (dimRadius !== null && dimRadius >= 0) {
            dimRadius += parseInt(bonus);
        }
    }

    token.set({
        'light_radius': radius,
        'light_dimradius': dimRadius,
    });
};

PfLight.VARIANCE = 5;
PfLight.ATTRIBUTE = "pf_heldObject";

/**
 * Pick up a light source.
 */
PfLight.takeCommand = function(player, token) {
    if (token === null) {
        PfLight.error(player, "You must specify a character token.");
        return;
    }
    var characterId = token.get("represents");
    if (characterId === null) {
        PfLight.error(player, "Selected token is not a character.");
        return;
    }
    var x = token.get("left");
    var y = token.get("top");
    var tokenName = token.get("name");

    log(tokenName + " is at " + x + "," + y);
    var objects = findObjs({
        _pageid: Campaign().get("playerpageid"),
        _type: "graphic", _subtype: "token", _name: "Light",
    });
    log(objects.length);
    var takenItem = null;
    for (var i=0; i < objects.length; i++) {
        log("Checking object " + i);
        var object = objects[i];
        if (object === null) {
            PfLight.error(player, "Returned object is null");
            continue;
        }
        var ox = object.get("left");
        var oy = object.get("top");
        if (Math.abs(ox - x) <= PfLight.VARIANCE && Math.abs(oy - y) <= PfLight.VARIANCE) {
            takenItem = object;
            break;
        }
    }
    if (takenItem === null) {
        PfLight.error(player, "Nothing for " + tokenName + " to pick up.");

        return;
    } else {
        log("Found object to take");
        log("Object is " + takenItem.get("name"));
        if (takenItem.get("represents") === null || takenItem.get("represents") === "") {
            PfLight.error(player, "Found item does not represent a character.");
            return;
        }
        var itemCharacter = getObj("character", takenItem.get("represents"));
        if (itemCharacter === null) {
            PfLight.error(player, "Found item has an invalid character.");
            return;
        }
        var message = tokenName + " picks up a " + itemCharacter.get("name") + ".";
        PfLight.actionMessage(token, message);
        toBack(takenItem);
        takenItem.set({
            'left': x,
            'top': y,
        });
        var character = getObj("character", characterId);
        var attribute = findObjs({
            type: 'attribute',
            characterid: characterId,
            name: PfLight.ATTRIBUTE
        }, {caseInsensitive: false})[0];
        if (!attribute) {
            attribute = createObj('attribute', {
                characterid: characterId,
                name: PfLight.ATTRIBUTE,
                current: takenItem.get("_id"),
                max: ""
            });
        } else {
            attribute.set({
                current: takenItem.get("_id")
            });
        }
    }
};

PfLight.dropCommand = function(player, token) {
    if (!token) {
        log("No token specified.");
        return;
    }
    var characterId = token.get("represents");
    var character = getObj("character", characterId);
    var attribute = findObjs({
        type: 'attribute',
        characterid: characterId,
        name: PfLight.ATTRIBUTE
    }, {caseInsensitive: false})[0];

    if (!attribute || attribute.get("current") === "") {
        PfLight.error(player, token.get("_name") + " is not carrying anything.");
        return;
    } else {
        var message = token.get("_name") + " drops what they are carrying.";
        PfLight.actionMessage(token, message);
        attribute.set({
            current: ""
        });
    }
}

on("change:graphic", function(obj, prev) {
    log("PfLight: Graphic change event for " + obj.get("name"));
    if (obj.get("_pageid") === Campaign().get("playerpageid")) {
        PfLight.move(obj);
    }
});

PfLight.move = function(token) {
    var characterId = token.get("represents");
    if (characterId !== null && token.get("light_hassight") === true) {
        var carrying = getAttrByName(characterId, PfLight.ATTRIBUTE, "current");
        if (carrying !== null && carrying !== "") {
            var takenItem = getObj("graphic", carrying);
            if (takenItem === null || takenItem === undefined) {
                PfLight.dropCommand(null, token);
            } else {
                takenItem.set({
                    left: token.get("left"),
                    top: token.get("top")
                });
            }
        }
    }
}


PfLight.setVisionCommand = function(player, args) {
    var radius = null;
    var dimRadius = null;
    var mesg = null;

    var VISION = [];
    VISION['day'] = { 'light': 960, 'dim': null, 'msg': "Full daylight" };
    VISION['overcast'] = { 'light': 480, 'dim': 360, 'msg': "Overcast daylight" };
    VISION['twilight'] = { 'light': 240, 'dim': 120, 'msg': "Twilight" };
    VISION['dusk'] = { 'light': 120, 'dim': 30, 'msg': "Dusk" };
    VISION['fullmoon'] = { 'light': 60, 'dim': -5, 'msg': "Full Moon" };
    VISION['quarter'] = { 'light': 30, 'dim': -5, 'msg': "Quarter Moon" };
    VISION['crescent'] = { 'light': 15, 'dim': -5, 'msg': "Crescent Moon" };
    VISION['starlight'] = { 'light': 10, 'dim': -5, 'msg': "Starlight" };
    VISION['dark'] = { 'light': null, 'dim': null, 'msg': "Complete darkness" };

    if (args.length > 1) {
        var lightLevel = args[1];
        if (VISION[lightLevel] !== null) {
            radius = VISION[lightLevel].light;
            dimRadius = VISION[lightLevel].dim;
            mesg = VISION[lightLevel].msg;
        } else {
            log("Unrecognised light level argument");
            return;
        }
    } else {
        log("No light level argument provided");
        return;
    }
    log(radius + ", " + dimRadius);
    var message = "Setting light level to be <b>" + mesg + "</b>";
    if (radius !== null) {
        var dim = "";
        if (dimRadius !== null && dimRadius < 0) {
            dim = "dim to ";
        }
        message += ". Base sight is " + dim + "<b>" + radius + "'</b>";
    }
    if (dimRadius !== null && dimRadius >= 0) {
        message += ", and dim light is from <b>" + dimRadius + "'</b>.";
    } else {
        message += ".";
    }
    sendChat("", "/desc <div style='" + PfLight.BOX_STYLE + "'>" + message + "</div>");

    if (msg.selected !== null && msg.selected.length > 0) {
        log("Using selected characters");
        for (var i=0; i < msg.selected.length; i++) {
            var token = getObj("graphic", msg.selected[i]._id);
            if (token.get("name") != null && token.get("name") != "") {
                log("Selected object: " + token.get("name"));
                PfLight.setVision(token, radius, dimRadius);
            }
        }
    } else {
        var currentObjects = findObjs({
            _pageid: Campaign().get("playerpageid"),
            _type: "graphic",
        });
        log("Looking for characters");
        _.each(currentObjects, function(token) {
            log("Found object: " + token.get("name"));
            PfLight.setVision(token, radius, dimRadius);
        });
    }
}

PfLight.lightsCommand = function(duration, token) {
    var message = "";
    if (duration < 1) {
        // Output nothing.
    } else {
        if (duration === 1) {
            message = "1 minute passes.";
        } else {
            message = "" + duration + " minutes pass.";
        }
        sendChat("PfLight", "/w GM <div style='" + PfLight.BOX_STYLE + "'>" + message + "</div>");
    }

    var objects = null;
    if (!token) {
        objects = findObjs({
            _pageid: Campaign().get("playerpageid"),
            _type: "graphic", _subtype: "token", _name: "Light"
        });
    } else {
        objects = [ token ];
    }

    var count = 0;
    for (var i=0; i < objects.length && objects[i]; i++) {
        var obj = objects[i];
        var notes = obj.get("gmnotes");
        if (notes) {
            notes = unescape(notes);
            if (notes.indexOf("!Light") > -1) {
                var max = obj.get("bar2_max");
                var current = obj.get("bar2_value");
                var onOff = obj.get("bar3_value");

                var params = notes.split(" ");
                var type = params[1];
                var defaultLight = params[2];
                var defaultDim = params[3];

                var lightRadius = obj.get("light_radius");
                var dimRadius = obj.get("light_dimradius");

                var spell = false;
                if (obj.get("name").indexOf("Spell") > -1) {
                    spell = true;
                }
                if (duration === 0) {
                    onOff = 1 - onOff;
                    obj.set({
                        bar3_value: onOff
                    });
                }

                if (onOff === 0 && lightRadius !== "") {
                    notes = "!Light " + type + " " + defaultLight + " " + defaultDim + " " + lightRadius + " " + dimRadius;
                    obj.set({
                        gmnotes: notes,
                        light_radius: "",
                        light_dimradius: ""
                    });
                    continue;
                } else if (onOff === 0) {
                    continue;
                } else if (onOff === 1 && lightRadius === "" && params.length > 4) {
                    lightRadius = params[4];
                    dimRadius = params[5];
                } else if (onOff === 1 && lightRadius === "") {
                    obj.set({
                        bar3_value: 0
                    });
                    continue;
                }

                for (var d=0; d < duration; d++) {
                    if (current === 0 && lightRadius === "" && dimRadius === "") {
                        // Nothing to do.
                        obj.set({
                            gmnotes: "!Light " + type + " " + defaultLight + " " + defaultDim,
                            bar3_value: 0
                        });
                        break;
                    } else if (current === 0 && lightRadius === 0 && dimRadius === 0) {
                        dimRadius = "";
                        lightRadius = "";
                    } else if (type === "magic") {
                        // Magic items are considered permanent. Nothing to do.
                    } else if (type === "spell") {
                        // Spells decay at predictable rate, and end quickly.
                        if (current === 0) {
                            lightRadius = Math.floor(lightRadius / 5);
                            dimRadius = 0;
                        } else {
                            current--;
                        }
                    } else if (type === "lamp") {
                        // Lamps stay bright until the end.
                        if (current === 0) {
                            lightRadius -= 10;
                            dimRadius -= 10;
                            if (dimRadius < 0) {
                                dimRadius = 0;
                            }
                            if (lightRadius < 0) {
                                lightRadius = 0;
                            }
                        } else {
                            current -= Math.floor(Math.random()*3);
                        }
                    } else {
                        // Natural light sources are less predictable.
                        if (current === 0) {
                            lightRadius -= 10;
                            dimRadius -= 10;
                            if (dimRadius < 0) {
                                dimRadius = 0;
                            }
                            if (lightRadius < 0) {
                                lightRadius = 0;
                            }
                        } else if (current < max / 3) {
                            if (dimRadius > current * 2) {
                                dimRadius -= 2;
                                lightRadius -= 1;
                            } else if (dimRadius > current && Math.random() < 0.5) {
                                dimRadius -= 1;
                            }
                            current -= Math.floor(Math.random()*3);
                        } else {
                            current -= Math.floor(Math.random()*3);
                        }
                    }
                }
                if (current < 0) {
                    current = 0;
                }
                obj.set({
                    gmnotes: "!Light " + type + " " + defaultLight + " " + defaultDim + " " + lightRadius + " " + dimRadius,
                    bar2_value: current,
                    light_radius: lightRadius,
                    light_dimradius: dimRadius
                });
            }
        }
    }
};

