/**
 * Work out incidental treasure.
 *
 * Designed to work with the Pathfinder character sheet for Roll20.
 *
 * Automatically tracks damage and hit points for a character, updating the
 * token with the current status. It also allows automated stabilisation
 * checks for creatures on negative hit points.
 *
 * ISC License
 *
 * Copyright (c) 2016, Samuel Penn, sam@glendale.org.uk
 *
 * Permission to use, copy, modify, and/or distribute this software for any
 * purpose with or without fee is hereby granted, provided that the above
 * copyright notice and this permission notice appear in all copies.
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
 * WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
 * ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
 * WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
 * ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
 * OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
 */


var Treasure = Treasure || {};


/**
 * Treasure.
 */
on("chat:message", function(msg) {
    if (msg.type !== "api") return;
    if (msg.content.split(" ", 1)[0] != "!treasure") return;

    if (msg.selected.length > 0) {
        for (var i=0; i < msg.selected.length; i++) {
            var tokenId = msg.selected[i]._id;
            var token = getObj("graphic", tokenId);
            if (token != null) {
                var character_id = token.get("represents");
                if (character_id == null) {
                    continue;
                }
                var character = getObj("character", character_id);
                Treasure.generate(token, character);
            }
        }
    }
    return;
});


Treasure.BOX_STYLE="background-color: #DDDDAA; color: #000000; padding:0px; border:1px solid black; border-radius: 5px; padding: 5px";

Treasure.line = function(message) {
    return "<p style='margin-bottom: 0px'>" + message + "</p>";
}

Treasure.format = function(message) {
    while (message.indexOf("<") > -1) {
        var left = message.substring(0, message.indexOf("<"));
        var right = message.substring(message.indexOf(">") + 1);
        var array = message.substring(message.indexOf("<") + 1, message.indexOf(">")).split("|");
        var chosen = array[randomInteger(array.length - 1)];

        message = left + chosen + right;
    }

    return message;
}

Treasure.generate = function(token, character) {
    var treasureType = getAttrByName(character.id, "treasure_type");
    var treasureValue = getAttrByName(character.id, "treasure_value");

    Treasure.format("This is a <simple|complex|hard|wonderful> test");

    // Treasure types are:
    //   common
    //   merchant
    //   noble
    //   thug
    //   beggar
    if (treasureType == null) {
        treasureType = "common";
    }
    if (treasureValue == null) {
        treasureValue = 1;
    }
    var items = Treasure.getCommon(treasureValue);

    var message = "";
    if (items.length > 0) {
        var sortedItems = items.sort(function(a, b) { return a[0] - b[0] } );
        var dc = 0;
        for (var i = 0; i < sortedItems.length; i++) {
            log(sortedItems[i][0] + " - " + sortedItems[i][1]);
            if (sortedItems[i][0] > dc) {
                dc = sortedItems[i][0];
                message += Treasure.line("DC " + dc);
            }
            message += Treasure.line(Treasure.format(sortedItems[i][1]));
        }
    } else {
        message += Treasure.line("Nothing.");
    }

    Treasure.message(character, message);
}

Treasure.getRoll = function(sides, dice) {
    var total = 0;
    for (; dice > 0; dice--) {
        total += randomInteger(sides);
    }
    return total;
}

Treasure.getItems = function(name, number) {
    var items = [];

    log("getItems: " + name + ", " + number);
    if (number > 0) {
        var list = Treasure.lists[name];
        var size = list.length;
        log("" + list + ", " + size);
        for (var i=0; i < number; i++) {
            var item = list[randomInteger(size) - 1]
            items.push ( item );
        }
    }
    return items;
}

Treasure.lists = {};

Treasure.lists['tat'] = [
    [ 9, "A <broken|twisted|plain> copper ring worth [[2d4]] cp." ],
    [ 9, "A wooden pendant with a <bird|cat|dog|rat> carving worth [[1d6]] cp." ],
    [ 12, "A piece of <string|wire|chalk|torn paper>." ],
    [ 12, "A pair of <ivory|wooden|bone> dice [[3d4]] cp." ],
    [ 15, "A lock of <brown|golden|white> hair <wrapped|tied> around a wooden ring." ],
    [ 15, "A finger in a small wooden box." ]
];

Treasure.getCommon = function(value) {
    var items = [];
    var cp = 0, sp = 0, gp = 0; pp = 0;
    switch (Treasure.getRoll(6, value)) {
        case 1: case 2: case 3: case 4:
            break;
        case 5: case 6:
            // A few coins.
            cp += Treasure.getRoll(4, value);
            items = items.concat(Treasure.getItems("tat", randomInteger(2)-1));
            break;
        case 7: case 8:
            cp += Treasure.getRoll(4, value);
            sp += Treasure.getRoll(4, value);
            items = items.concat(Treasure.getItems("tat", randomInteger(3)-1));
            break;
        case 9: case 10:
            cp += Treasure.getRoll(3, 2);
            sp += Treasure.getRoll(6, value);
            gp += Treasure.getRoll(4, parseInt(value / 2));
            items = items.concat(Treasure.getItems("tat", randomInteger(4)));
            break;
        default:
            gp += Treasure.getRoll(6, value);
            break;
    }
    if (cp > 0) items.push([ 12, cp + " copper pinches." ]);
    if (sp > 0) items.push([ 12, sp + " silver shields." ]);
    if (gp > 0) items.push([ 12, gp + " gold sails." ]);
    if (pp > 0) items.push([ 12, gp + " platinum crowns." ]);

    return items;
}


Treasure.message = function(character, message) {
    if (message != null) {
        var image = character.get("avatar");
        var html = "<div style='" + Damage.BOX_STYLE + "'>";
        html += "<table><tr><td style='width:48px; vertical-align: top'>";
        html += "<img src='"+image+"' width='40px' style='float:left; padding-right: 5px;'/>";
        html += "</td><td style='width:auto; vertical-align: top'>";
        html += message;
        html += "</td></tr></table>";
        html += "</div>";

        sendChat("", "/w GM " + html);
    }
}
