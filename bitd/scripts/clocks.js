/**
 * Blades in the Dark
 *
 * The MIT License (MIT)
 *
 * Copyright (c) 2017, Samuel Penn, sam@glendale.org.uk
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
    }
});


Clocks.info = function(token) {
    sendChat("", `Hello World ${token.get("name")} is on ${token.get("sides")}`);
    
    let currentSide = Clocks.currentSide(token);
    
    sendChat("", `Current side is ${currentSide}`);
    
};


Clocks.currentSide = function(token) {
    let img = token.get("imgsrc");
    let sides = token.get("sides").split("|");
    
    log("Token has " + sides.length + " sides");
    
    log("Current: " + img);
    for (let i=0; i < sides.length; i++) {
        sides[i] = sides[i].replace(/%3A/, ":");
        sides[i] = sides[i].replace(/%3F/, "?");
        log("Compare to " + sides[i]);
        if (img == sides[i]) {
            return i;
        }
    }
    
    return 0;
};



