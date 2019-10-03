/**
 * Blades in the Dark
 *
 * The MIT License (MIT)
 *
 * Copyright (c) 2019, Samuel Penn, sam@notasnark.net
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

var Clocks = Clocks || {};

Clocks.VERSION = "0.1";


on("ready", function() {
    log(`==== Clocks Version ${Clocks.VERSION} ====`);
});




// API COMMAND HANDLER
on("chat:message", function(msg) {
    if (msg.type !== "api") return;

    let args = msg.content.split(" ");
    let command = args.shift();
    let playerId = msg.playerid;

    if (command === "!clock") {
        if (msg.selected && msg.selected.length > 0) {
            let token = getObj("graphic", msg.selected[0]._id);
            Clocks.info(token);
        }
    } else if (command === "!inc") {
        if (msg.selected && msg.selected.length > 0) {
            let token = getObj("graphic", msg.selected[0]._id);
            Clocks.inc(token);
        }
    } else if (command === "!dec") {
        if (msg.selected && msg.selected.length > 0) {
            let token = getObj("graphic", msg.selected[0]._id);
            Clocks.dec(token);
        }
    }
});


Clocks.info = function(token) {
    sendChat("", `Hello World ${token.get("name")} is on ${token.get("sides")}`);

    let currentSide = Clocks.currentSide(token);
    
    sendChat("", `Current side is ${currentSide}`);
    
};

Clocks.getAllSides = function(token) {
    let sides = token.get("sides").split("|");
    for (let i=0; i < sides.length; i++) {
        sides[i] = sides[i].replace(/%3A/, ":");
        sides[i] = sides[i].replace(/%3F/, "?");
        sides[i] = sides[i].replace(/(max|med|original)/, "thumb");
    }
    return sides;
};


Clocks.currentSide = function(token, sides) {
    let img = token.get("imgsrc");
    img = img.replace(/(max|med|original)/, "thumb");

    for (let i=0; i < sides.length; i++) {
        if (img == sides[i]) {
            return i;
        }
    }
    
    return 0;
};

Clocks.setSide = function(token, sides, side) {
    let img = sides[side];
    log(token.get("imgsrc"));
    log(img);
    token.set("imgsrc", img);
};

Clocks.inc = function(token) {
    let sides = Clocks.getAllSides(token);
    let currentSide = Clocks.currentSide(token, sides);
    
    log("Current side is " + currentSide + " of " + sides.length);
    if (currentSide < sides.length - 1) {
        currentSide++;
    } else {
        currentSide = 0;
    }
    log("Changing to side " + currentSide);
    Clocks.setSide(token, sides, currentSide);

    Clocks.update(token, currentSide, sides.length - 1);
};

Clocks.dec = function(token) {
    let sides = Clocks.getAllSides(token);
    let currentSide = Clocks.currentSide(token, sides);
    
    log("Current side is " + currentSide + " of " + sides.length);
    if (currentSide > 0) {
        currentSide--;
    } else {
        currentSide = sides.length - 1;
    }
    log("Changing to side " + currentSide);
    Clocks.setSide(token, sides, currentSide);
    
    Clocks.update(token, currentSide, sides.length - 1);
};

Clocks.BOX_STYLE="background-color: #EEEEDD; color: #000000; margin-top: 0px; " +
                 "padding:5px; border:1px dashed black; border-radius: 10px; " +
                 "font-weight: normal; font-style: normal; text-align: left; "+
                 "background-image: url(http://imgsrv.roll20.net/?src=i.imgur.com/BLDFC8xg.jpg)";


Clocks.update = function(token, side, of) {
    let message = `Tick tock. ${side} of ${of}`;
    
    
    sendChat("", `/desc Tick tock. ${token.get("name")} ${side} of ${of}`);
}

