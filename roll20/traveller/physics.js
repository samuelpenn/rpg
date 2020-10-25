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
Physics.VERSION = "0.5";
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
Physics.JUPITER_RADIUS = 69911000;
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

    if ("!physics".startsWith(command) && command.length > 3) {
        Physics.physicsCommand(playerId, args);
    }
});


Physics.STYLE="background-color: #eeeeee; color: #000000; padding:2px; border:1px solid black; border-radius: 5px; text-align: left; font-weight: normal; font-style: normal; min-height: 80px";


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
        let html = "!physics &lt;planet|thrust&gt; &lt;args...&gt;<br/>";
        html += "<span style='display: inline-block; width: 2em'> </span>planet &lt;radius&gt; &lt;density&gt; [&lt;orbit&gt;]<br/>";
        html += "<span style='display: inline-block; width: 2em'> </span>thrust &lt;thrust&gt; &lt;distance&gt;<br/>";
        html += "<br/>";
        html += "See the website at <a hre='https://www.notasnark.net/traveller/roll20'>https://www.notasnark.net/traveller/roll20</a> for details.";

        Physics.message("!physics help", html)
    } else {
        let cmd = args.shift();

        if ("planet".startsWith(cmd)) {
            Physics.planetCommand(playerId, args);
        } else if ("thrust".startsWith(cmd)) {
            Physics.thrustCommand(playerId, args);
        } else if ("rocket".startsWith(cmd)) {
            Physics.rocketCommand(playerId, args);
        }
    }
};

Physics.getNumber = function(number) {
    if (!number || number === "") {
        return 0;
    }
    return parseFloat(number.replace(/[^0-9.\-]/g, ""));
};

Physics.getThrust = function (thrust) {
    if (!thrust || thrust === "") {
        return Physics.g;
    }
    if ((""+thrust).match(/^[0-9.\-]+$/)) {
        return parseFloat(thrust);
    }
    thrust = ("" + thrust).toLowerCase();
    let number = parseFloat(thrust.replace(/[^0-9.\-]/g, ""));

    if (thrust.match("g$")) {
        number *= Physics.g;
    }

    return parseFloat(number);
};



// Returns a float, always in metres. Assumes given in km unless otherwise specified
Physics.getDistance = function (distance) {
    if (!distance || distance === "") {
        return Physics.EARTH_RADIUS;
    }
    if ((""+distance).match(/^[0-9.\-]+$/)) {
        return parseFloat(distance) * 1000;
    }
    distance = ("" + distance).toLowerCase();
    let number = parseFloat(distance.replace(/[^0-9.\-]/g, ""));

    if (distance.match("mkm$")) {
        number *= 1000000000;
    } else if (distance.match("km$")) {
        number *= 1000;
    } else if (distance.match("m$")) {
        number *= 1;
    } else if (distance.match("au$")) {
        number *= Physics.AU;
    } else if (distance.match("j$")) {
        number *= Physics.JUPITER_RADIUS;
    } else if (distance.match("e$")) {
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
    if ((""+density).match(/^[0-9.\-]+$/)) {
        return parseFloat(density);
    }
    density = ("" + density).toLowerCase();
    let number = parseFloat(density.replace(/[^0-9.\-]/g, ""));

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

Physics.printNumber = function (number, precision) {
    number = parseFloat(number);
    if (precision === null || precision === undefined || precision < 0) {
        precision = 2;
    }

    if (number > 1e12 || number < 1e-3) {
        return number.toExponential(precision);
    } else if (number > 99) {
        return Number(parseInt(number)).toLocaleString();
    } else {
        return number.toPrecision(precision);
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

// Takes a distance in metres.
Physics.printDistance = function (number) {
    number = parseInt(number);

    let units = "m";
    if (number > Physics.AU * 2) {
        units = "AU";
        number = (1.0 * number) / Physics.AU;
    } else if (number > 2_000_000_000) {
        units = "Mkm";
        number = (1.0 * number) / 1_000_000_000;
    } else if (number >= 10_000) {
        units = "km";
        number = number / 1_000;
    }

    return Physics.printNumber(number) + units;
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
        html += `<b>Escape Velocity</b>: ${Physics.printNumber(ev)}m/s<br/>`;
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
        let evo = Math.sqrt(mass * Physics.G * 2 / orbit);
        let og = mass * Physics.G / (orbit * orbit);

        let orbitDistance = Physics.printNumber(orbit / 1000) + "km";
        if (orbit > Physics.AU * 2) {
            orbitDistance = Physics.printNumber(orbit / Physics.AU) + "AU";
        } else if (orbit > 10000000000) {
            orbitDistance = Physics.printNumber(orbit / 1000000000) + "Mkm";
        } else if (orbit > 100000000) {
            orbitDistance = Physics.printNumber(orbit / 1000000) + "Kkm";
        }
        title = `Planet (${orbitDistance} orbit)`;

        html += "<br/>";
        if (evo >= Physics.C) {
            html += `<i>No orbits possible</i><br/>`;
        } else {
            html += `<b>Orbit Velocity</b>: ${Physics.printNumber(velocity)}m/s<br/>`;
            html += `<b>Orbit Period</b>: ${Physics.printTime(time)}<br/>`;
            html += `<b>Escape Velocity</b>: ${Physics.printNumber(evo)}m/s<br/>`;
            if (evo > Physics.C / 100) {
                html += `&nbsp;<i><b>Escape Velocity</b>: ${Physics.printNumber(evo / Physics.C)}c</i><br/>`;
            }
            html += `<b>Gravity</b>: ${Physics.printNumber(og)}m/s²<br/>`;
            if (og > 0.1) {
                html += `&nbsp;<i><b>Gravity</b>: ${Physics.printNumber(og / Physics.g)}g</i><br/>`;
            }
        }
    }

    Physics.message(title, html);
};

Physics.printVelocity = function(title, velocity) {
    let html = "";

    html += `<b>${title}</b>: ${Physics.printNumber(velocity / 1000)}km/s`;
    if (velocity >= Physics.C) {
        html += " <i>(!)</i><br/>";
    } else if (velocity > Physics.C / 10) {
        html += ` (${(velocity / Physics.C).toFixed(2)}c)<br/>`;
        let td = Math.sqrt( 1 - (velocity * velocity) / (Physics.C * Physics.C));
        html += `<b>Time dilation</b>: ${td.toFixed(3)}<br/>`;
    } else {
        html += "<br/>";
    }

    return html;
}

Physics.thrustCommand = function(playerId, args) {
    let thrust = Physics.getThrust(args.shift());
    let distance = Physics.getDistance(args.shift());

    time = parseInt(2 * Math.sqrt(distance / thrust ));
    let maxv = thrust * time / 2;

    let title = "Travel Times";

    let html = "";
    html += `<b>Thrust</b>: ${Physics.printNumber(thrust)}m/s² (${Physics.printNumber(thrust / Physics.g)}g) <br/>`;
    html += `<b>Distance</b>: ${Physics.printDistance(distance)}<br/>`;

    html += `<b>Time</b>: ${Physics.printTime(time)}<br/>`;
    html += Physics.printVelocity("Max Velocity", maxv);

    // But what if we don't want to stop, and just thrust until impact?
    time = parseInt(Math.sqrt(2 * distance / thrust));
    maxv = thrust * time;

    html += "<br/>";
    html += `<b>Time to impact</b>: ${Physics.printTime(time)}<br/>`;
    html += Physics.printVelocity("Velocity to impact", maxv);

    Physics.message(title, html);
};

Physics.rocketCommand = function(playerId, args) {
    let wet = Physics.getNumber(args.shift());
    let dry = Physics.getNumber(args.shift());
    let isp = Physics.getNumber(args.shift());

    if (dry <= 0 || wet <= 0 || isp <= 0) {
        Physics.message("Rocket Equation", "Invalid values.")
        return;
    }
    let ratio = wet / dry;
    let log = Math.log(ratio);
    let deltaVee = log * isp * Physics.g;

    html = "";
    html += `<b>Wet Mass</b>: ${wet.toLocaleString()}<br/>`;
    html += `<b>Dry Mass</b>: ${dry.toLocaleString()}<br/>`;
    html += `<b>Mass Ratio</b>: ${Physics.printNumber(ratio)}<br/>`;
    html += `<b>I<sub>sp</sub></b>: ${Physics.printNumber(isp)}<br/>`;
    if (deltaVee >= 10000) {
        html += `<b>Δv</b>: ${Number((deltaVee / 1000.0).toPrecision(4)).toLocaleString()} kms<sup>-1</sup><br/>`;
    } else {
        html += `<b>Δv</b>: ${Physics.printNumber(deltaVee)} ms<sup>-1</sup><br/>`;
    }

    Physics.message("Rocket Equation", html);

};


