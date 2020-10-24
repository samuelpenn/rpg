/**
 * Physics
 *
 * Commands to run some physics stuff. Useful for SF RPGs.
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


var Physics = Physics || {};
Physics.VERSION = "0.1";
Physics.DEBUG = true;
Physics.AU = 149597870700;
Physics.G = 6.6743e-11;
Physics.C = 299792458;
Physics.g = 9.807;

Physics.EARTH_RADIUS = 6371000;
Physics.EARTH_DENSITY = 5.51;
Physics.EARTH_MASS = 5.972e24;
Physics.JUPITER_MASS = 1.898e27;
Physics.SOL_MASS = 1.989e30;
Physics.SOL_RADIUS = 696340000;
Physics.MOON_DENSITY = 3.34;
Physics.JUPITER_DENSITY = 1.33;
Physics.SOL_DENSITY = 1.41;

on("ready", function() {
    log(`==== Physics Version ${Physics.VERSION} ====`);

});


/**
 * Single event handler for all chat messages.
 */
on("chat:message", function(msg) {
    if (msg.type !== "api") return;
    let args = msg.content.replace(/ +/, " ").split(" ");
    let command = args.shift();
    let playerId = msg.playerid;

    if (command === "!physics" || command === "!phy") {
        Physics.physicsCommand(playerId, args);
    }
});


Physics.STYLE="background-color: #EEDDDD; color: #000000; padding:2px; border:1px solid black; text-align: left; font-weight: normal; font-style: normal; min-height: 80px";


Physics.whisper = function(token, message, func) {
    let html = "<div style='" + Physics.STYLE + "'>";

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

Physics.message = function(title, message, func) {
    let html = "<div style='" + Physics.STYLE + "'>";

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

Physics.debug = function(title, message) {
    if (Physics.DEBUG) {
        sendChat("", `/desc <b>${title}:</b> ${message}`);
    }
    log(`$(title}: ${message}`);
};



Physics.physicsCommand = function (playerId, args) {
    log("physicsCommand:");
    if (args === null || args.length === 0) {
        // No commands.
        Physics.message("!physics help", "!physics <planet|orbit>")
    } else {
        let cmd = args.shift();

        if ("planet".startsWith(cmd)) {
            Physics.planetCommand(playerId, args);
        }
    }
};



// Returns a float, always in metres. Assumes given in km unless otherwise specified
Physics.getDistance = function (distance) {
    if (!distance || distance === "") {
        return Physics.EARTH_RADIUS;
    }
    if ((""+distance).match(/^[0-9.-]+$/)) {
        return parseFloat(distance) * 1000;
    }
    distance = ("" + distance).toLowerCase();
    let number = parseFloat(distance.replace(/[^0-9.-]/g, ""));

    if (distance.match("mkm$")) {
        number *= 1000000000;
    } else if (distance.match("km$")) {
        number *= 1000;
    } else if (distance.match("m$")) {
        number *= 1;
    } else if (distance.match("au$")) {
        number *= Physics.AU;
    } else if (distance.match("er$")) {
        number *= Physics.EARTH_RADIUS;
    } else if (distance.match("ed$")) {
        number *= Physics.EARTH_RADIUS * 2;
    } else if (distance.match("sol$")) {
        number *= Physics.SOL_RADIUS;
    }

    return parseFloat(number);
};

// Returns a float, always in metres.
Physics.getDensity = function (density) {
    if (!density || density === "") {
        return Physics.EARTH_DENSITY;
    }
    if ((""+density).match(/^[0-9.-]+$/)) {
        return parseFloat(density);
    }
    density = ("" + density).toLowerCase();
    let number = parseFloat(density.replace(/[^0-9.-]/g, ""));

    if (density.match("e$")) {
        number *= Physics.EARTH_DENSITY;
    } else if (density.match("m$")) {
        number *= Physics.MOON_DENSITY;
    } else if (density.match("j$")) {
        number *= Physics.JUPITER_DENSITY;
    } else if (density.match("sol$")) {
        number *= Physics.SOL_DENSITY;
    }

    return parseFloat(number);
};

Physics.printNumber = function (number) {
    number = parseFloat(number);

    if (number > 1e12) {
        return number.toExponential(2);
    } else if (number > 99) {
        return Number(parseInt(number)).toLocaleString();
    } else {
        return number.toPrecision(2);
    }
};

// Takes time in seconds.
Physics.printTime = function (number) {
    let time = "";

    if (number >= 86400) {
        let days = parseInt(number / 86400);
        if (days > 100) {
            time += Physics.printNumber(days) + "d ";
        } else {
            time += days + "d ";
        }
        number %= 86400;
    }
    if (time.length > 4) {
        return time;
    }
    if (number >= 3600) {
        time += parseInt(number / 3600) + "h ";
        number %= 3600;
    }
    if (time.length > 5) {
        return time;
    }
    if (number >= 60) {
        time += parseInt( number / 60) + "m ";
        number %= 60;
    }
    if (time === "") {
        time += Physics.printNumber(number) + "s";
    } else if (time.length < 5) {
        time += parseInt(number) + "s";
    }


    return time;
};

// Print out details on a planet.
Physics.planetCommand = function (playerId, args) {
    let radius = Physics.getDistance(args.shift());
    let density = Physics.getDensity(args.shift());

    let mass = 4.0/3.0 * Math.PI * radius * radius * radius * density * 1000;
    let g = mass * Physics.G / (radius * radius);
    let ev = Math.sqrt(mass * Physics.G * 2 / radius);

    let title = "Planet details";
    let html = "";
    html += `<b>Radius</b>: ${Physics.printNumber(radius / 1000)}km<br/>`;
    html += `<b>Density</b>: ${Physics.printNumber(density)}g/cm³<br/>`;
    html += `<b>Mass</b>: ${Physics.printNumber(mass)}kg<br/>`;
    if (mass > Physics.SOL_MASS / 10) {
        html += `&nbsp;<i><b>Mass</b>: ${Physics.printNumber(mass / Physics.SOL_MASS)} Sols</i><br/>`;
    }
    if (mass > Physics.JUPITER_MASS / 10 && mass < Physics.JUPITER_MASS * 200) {
        html += `&nbsp;<i><b>Mass</b>: ${Physics.printNumber(mass / Physics.JUPITER_MASS)} Jupiters</i><br/>`;
    }
    if (mass > Physics.EARTH_MASS / 100 && mass < Physics.EARTH_MASS * 200) {
        html += `&nbsp;<i><b>Mass</b>: ${Physics.printNumber(mass / Physics.EARTH_MASS)} Earths</i><br/>`;
    }
    // Escape velocity
    if (ev >= Physics.C) {
        html += `<i><b>Escape Velocity</b>: No escape.</i><br/>`;
    } else {
        html += `<b>Escape Velocity</b>: ${Physics.printNumber(ev)}m/s²<br/>`;
        if (ev > Physics.C / 100) {
            html += `&nbsp;<i><b>Escape Velocity</b>: ${Physics.printNumber(ev / Physics.C)}c</i><br/>`;
        }
        html += `<b>Surface Gravity</b>: ${Physics.printNumber(g)}m/s²<br/>`;
        if (g > 0.1) {
            html += `&nbsp;<i><b>Surface Gravity</b>: ${Physics.printNumber(g / Physics.g)}g</i><br/>`;
        }
    }

    if (args.length > 0) {
        let value = args.shift();
        let orbit = Physics.getDistance(value);
        if (value.startsWith("+")) {
            orbit += radius;
        }
        let velocity = Math.sqrt(Physics.G * mass / orbit);
        let circumference = 2 * Math.PI * orbit;
        let time = circumference / velocity;

        let orbitDistance = Physics.printNumber(orbit / 1000) + "km";
        if (orbit > Physics.AU * 2) {
            orbitDistance = Physics.printNumber(orbit / Physics.AU) + "AU";
        } else if (orbit > 10000000000) {
            orbitDistance = Physics.printNumber(orbit / 1000000000) + "Mkm";
        }
        title = `Planet (${orbitDistance} orbit)`;

        html += "<br/>";
        html += `<b>Orbit Velocity</b>: ${Physics.printNumber(velocity)}m/s<br/>`;
        html += `<b>Orbit Period</b>: ${Physics.printTime(time)}<br/>`;

    }

    Physics.message(title, html);
};



