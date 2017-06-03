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

PfLight.VERSION = "2.0";
PfLight.BOX_STYLE="background-color: #EEEEDD; color: #000000; padding:0px; border:1px dashed black; border-radius: 10px; padding: 3px; font-style: normal; font-weight: normal; text-align: left";

on("ready", function() {
    log(`==== PfLight Version ${PfLight.VERSION} ====`);

    if (PfInfo) {
        // Player commands.
        PfInfo.addPlayerHelp("!pftake", "Args: <b>tokenId</b><br/>This token will pick up a light token it is standing on.");
        PfInfo.addPlayerHelp("!pfdrop", "Args: <b>tokenId</b><br/>This token will drop the light token it is carrying.");
        PfInfo.addPlayerHelp("!pfturnlight", "Args: <b>tokenId</b> <b>direction</b><br/>Rotates the given light source according to the direction. Either (c) or (a) for clockwise or anti-clockwise, or a value (0-359) to set to that facing.");

        // GM Only commands.
        PfInfo.addGmHelp("!pflights", "Args: <b>duration</b>, <b>tokenId</b><br/>Reduce time left on light sources.");
    } else {
        sendChat("PfLight", "PfLight API depends on PfInfo, which is missing.");
    }
});

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
    let characterId = token.get("represents");

    let html = "<div style='" + PfLight.BOX_STYLE + "'>";
    let image = token.get("imgsrc");
    html += "<img src='" + image + "' width='50px' style='float:left; margin-top:-25px; padding-top: 0; "+
            "background-color: white; border-radius: 25px;'/>";
    html += "<div style='margin-left: 60px; padding-bottom: 10px'>";
    html += message + "</div>";
    html += "</div>";

    sendChat("character|"+characterId, "/desc " + html);
};


// API COMMAND HANDLER
on("chat:message", function(msg) {
    if (msg.type !== "api") return;

    let args = msg.content.split(" ");
    let command = args.shift();
    let player = getObj("player", msg.playerid);
    let isGM = playerIsGM(player.get("_id"));
    let token = null;
    let tokenId = null;

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
            let lightLevel = args.shift();
            if (lightLevel) {
                PfLight.setVisionCommand(lightLevel, msg.selected);
            } else {
                PfLight.error(player, "<i>light_level</i> is not valid");
            }
        }
    } else if (command === "!pflights") {
        if (!isGM) {
            PfLight.error(player, "You must be the GM to be able to run this.");
        } else {
            let duration = args.shift();
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
    } else if (command === "!pfturnlight") {
        tokenId = args.shift();
        let direction = args.shift();

        if (!tokenId || !direction) {
            PfLight.error(player, "You must specify <i>token_id</i> and <i>clockwise (c)</i> or <i>anti-clockwise (a)</i>.");
        } else {
            token = getObj("graphic", tokenId);
            if (token) {
                if (token.get("name") !== "Light") {
                    PfLight.error(player, `Selected token ${token.get('name')} is not a light source.`);
                } else {
                    PfLight.turnLightCommand(token, direction);
                }
            } else {
                PfLight.error(player, "Not a valid token id.");
            }
        }
    }
});



PfLight.setVision = function(token, radius, dimRadius) {
    let hasSight = token.get("light_hassight");
    if (hasSight !== true) {
        // No vision, so nothing to do.
        return;
    }
    let lightMultiplier = token.get("light_multiplier");
    if (lightMultiplier !== null && lightMultiplier !== "") {
        lightMultiplier = parseFloat(lightMultiplier);
    } else {
        lightMultiplier = 1.0;
    }
    let characterId = token.get("represents");
    if (characterId === null) {
        // This isn't a character, so nothing to do.
        return;
    }
    log("    Character has sight.");
    let vision = getAttrByName(characterId, "vision");
    if (vision !== null && vision !== "") {
        vision = vision.toLowerCase();
    } else {
        vision = "";
    }
    // If a character has darkvision, then increase their vision out
    // to their darkvision limit.
    if (vision.indexOf("darkvision") > -1) {
        let dr = vision.replace(/.*darkvision +([0-9]+).*/, "$1");
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
    let perception = getAttrByName(characterId, "Perception");
    log("    Character Perception " + perception);
    if (perception !== null && parseInt(perception) !== 0 && radius !== null) {
        let bonus = parseInt(perception) * (radius / 20.0);
        radius += parseInt(bonus);
        if (dimRadius !== null && dimRadius >= 0) {
            dimRadius += parseInt(bonus);
        }
    }

    token.set({
        'light_radius': radius,
        'light_dimradius': dimRadius
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
    let characterId = token.get("represents");
    if (characterId === null) {
        PfLight.error(player, "Selected token is not a character.");
        return;
    }
    let x = token.get("left");
    let y = token.get("top");
    let tokenName = token.get("name");

    log(tokenName + " is at " + x + "," + y);
    let objects = findObjs({
        _pageid: Campaign().get("playerpageid"),
        _type: "graphic", _subtype: "token", _name: "Light"
    });
    log(objects.length);
    let takenItem = null;
    for (let i=0; i < objects.length; i++) {
        log("Checking object " + i);
        let object = objects[i];
        if (object === null) {
            PfLight.error(player, "Returned object is null");
            continue;
        }
        let ox = object.get("left");
        let oy = object.get("top");
        if (Math.abs(ox - x) <= PfLight.VARIANCE && Math.abs(oy - y) <= PfLight.VARIANCE) {
            takenItem = object;
            break;
        }
    }
    if (takenItem === null) {
        PfLight.error(player, "Nothing for " + tokenName + " to pick up.");
    } else {
        log("Found object to take");
        log("Object is " + takenItem.get("name"));
        if (takenItem.get("represents") === null || takenItem.get("represents") === "") {
            PfLight.error(player, "Found item does not represent a character.");
            return;
        }
        let itemCharacter = getObj("character", takenItem.get("represents"));
        if (itemCharacter === null) {
            PfLight.error(player, "Found item has an invalid character.");
            return;
        }
        let message = tokenName + " picks up a " + itemCharacter.get("name") + ".";
        PfLight.actionMessage(token, message);
        toBack(takenItem);
        takenItem.set({
            'left': x,
            'top': y
        });
        let character = getObj("character", characterId);
        let attribute = findObjs({
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
    let characterId = token.get("represents");
    let character = getObj("character", characterId);
    let attribute = findObjs({
        type: 'attribute',
        characterid: characterId,
        name: PfLight.ATTRIBUTE
    }, {caseInsensitive: false})[0];

    if (!attribute || attribute.get("current") === "") {
        //PfLight.error(player, token.get("_name") + " is not carrying anything.");
    } else {
        let message = token.get("_name") + " drops what they are carrying.";
        PfLight.actionMessage(token, message);
        attribute.set({
            current: ""
        });
    }
};

on("change:graphic", function(obj) {
    log("PfLight: Graphic change event for " + obj.get("name"));
    if (obj.get("_pageid") === Campaign().get("playerpageid")) {
        PfLight.move(obj);
    }
});

PfLight.move = function(token) {
    let characterId = token.get("represents");
    if (characterId !== null && token.get("light_hassight") === true) {
        let carrying = getAttrByName(characterId, PfLight.ATTRIBUTE, "current");
        if (carrying) {
            let takenItem = getObj("graphic", carrying);
            if (!takenItem) {
                PfLight.dropCommand(null, token);
            } else {
                takenItem.set({
                    left: token.get("left"),
                    top: token.get("top")
                });
            }
        }
    }
};


PfLight.setVisionCommand = function(lightLevel, selected) {
    let radius = null;
    let dimRadius = null;
    let mesg = null;

    let VISION = [];
    VISION['day'] = { 'light': 960, 'dim': null, 'msg': "Full daylight" };
    VISION['overcast'] = { 'light': 480, 'dim': 360, 'msg': "Overcast daylight" };
    VISION['twilight'] = { 'light': 240, 'dim': 120, 'msg': "Twilight" };
    VISION['dusk'] = { 'light': 120, 'dim': 30, 'msg': "Dusk" };
    VISION['fullmoon'] = { 'light': 60, 'dim': -5, 'msg': "Full Moon" };
    VISION['quarter'] = { 'light': 30, 'dim': -5, 'msg': "Quarter Moon" };
    VISION['crescent'] = { 'light': 15, 'dim': -5, 'msg': "Crescent Moon" };
    VISION['starlight'] = { 'light': 10, 'dim': -5, 'msg': "Starlight" };
    VISION['dark'] = { 'light': null, 'dim': null, 'msg': "Complete darkness" };

    if (lightLevel) {
        if (VISION[lightLevel]) {
            radius = VISION[lightLevel].light;
            dimRadius = VISION[lightLevel].dim;
            mesg = VISION[lightLevel].msg;
        } else {
            let options = "";
            for (let o in VISION) {
                options += o + " ";
            }
            PfInfo.error(null, `Unrecognised light level argument. Use one of [ ${options.trim()} ]`);
            return;
        }
    } else {
        PfInfo.error(null, "No light level argument provided.");
        return;
    }
    log(radius + ", " + dimRadius);
    let message = "Setting light level to be <b>" + mesg + "</b>";
    if (radius !== null) {
        let dim = "";
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
    PfInfo.whisper("PfLights", message);

    if (selected && selected.length > 0) {
        log("Using selected characters");
        for (let i=0; i < selected.length; i++) {
            let token = getObj("graphic", selected[i]._id);
            if (token.get("name")) {
                log("Selected object: " + token.get("name"));
                PfLight.setVision(token, radius, dimRadius);
            }
        }
    } else {
        let currentObjects = findObjs({
            _pageid: Campaign().get("playerpageid"),
            _type: "graphic"
        });
        log("Looking for characters");
        _.each(currentObjects, function(token) {
            log("Found object: " + token.get("name"));
            PfLight.setVision(token, radius, dimRadius);
        });
    }
};

PfLight.lightsCommand = function(duration, token) {
    let message = "";
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

    let objects = null;
    if (!token) {
        objects = findObjs({
            _pageid: Campaign().get("playerpageid"),
            _type: "graphic", _subtype: "token", _name: "Light"
        });
    } else {
        objects = [ token ];
    }

    for (let i=0; i < objects.length && objects[i]; i++) {
        let obj = objects[i];
        let notes = obj.get("gmnotes");
        if (notes) {
            notes = unescape(notes);
            if (notes.indexOf("!Light") > -1) {
                let max = obj.get("bar2_max");
                let current = obj.get("bar2_value");
                let onOff = obj.get("bar3_value");

                let params = notes.split(" ");
                let type = params[1];
                let defaultLight = params[2];
                let defaultDim = params[3];

                let lightRadius = obj.get("light_radius");
                let dimRadius = obj.get("light_dimradius");

                let spell = false;
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

                for (let d=0; d < duration; d++) {
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

/**
 * Rotates an object. Used to rotate light sources such as Bullseye lanterns
 * which face a particular direction. Can be used in conjunction with 'Take'
 * and 'Drop' to rotate a light source that is being carried.
 *
 * @param token     Token to be rotated.
 * @param direction Direction to rotate, or angle to rotate to.
 */
PfLight.turnLightCommand = function(token, direction) {
    if (!token || !direction) {
        PfLight.error(null, "Invalid parameters to turnLightCommand.");
        return;
    }

    let rotation = token.get("rotation");
    if (rotation) {
        rotation = parseInt(rotation);
    } else {
        rotation = 0;
    }

    if (direction.startsWith("c")) {
        // Clockwise.
        rotation += 45;
    } else if (direction.startsWith("a")) {
        // Anti-clockwise.
        rotation -= 45;
    } else {
        // A specific angle in degrees.
        rotation = parseInt(direction);
    }
    // Force it to be in 45 degree increments.
    rotation = parseInt(rotation / 45) * 45;

    if (rotation < 0) {
        rotation += 360;
    } else if (rotation >= 360) {
        rotation -= 360;
    }

    token.set({
        'rotation': rotation
    });

};

