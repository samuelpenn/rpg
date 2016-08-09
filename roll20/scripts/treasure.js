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


Treasure.BOX_STYLE="background-color: #DDDDAA; color: #000000; padding:0px; border:1px solid black; border-radius: 5px";
Treasure.TITLE_STYLE="background-color: #000000; color: #FFFFFF; padding: 1px; text-align: center";

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
    var treasureType = getAttrByName(character.id, "TreasureType");
    var treasureValue = getAttrByName(character.id, "TreasureType", "max");

    log(treasureType);
    log(treasureValue);


    // Treasure types are:
    //   common
    //   merchant
    //   noble
    //   thug
    //   beggar
    if (treasureType == null) {
        treasureType = "Scum";
    }
    if (treasureValue == null) {
        treasureValue = 1;
    }
    var items = Treasure.getRandomTreasure(treasureType, treasureValue);

    var message = "";
    if (items.length > 0) {
        var sortedItems = items.sort(function(a, b) { return a[0] - b[0] } );
        var dc = 0;
        for (var i = 0; i < sortedItems.length; i++) {
            log(sortedItems[i][0] + " - " + sortedItems[i][1]);
            if (sortedItems[i][0] > dc) {
                dc = sortedItems[i][0];
                message += Treasure.line("<b>DC " + dc + "</b>");
            }
            var text = Treasure.format(sortedItems[i][1]);
            if (sortedItems[i].length > 2) {
                var specialTable = sortedItems[i][2];
                var special = Treasure.getFromSpecialTable(specialTable);
                if (special != null) {
                    text += " <em>" + Treasure.format(special[0]) + "</em>";
                }
            }
            message += Treasure.line(text);
        }
    } else {
        message += Treasure.line("Nothing.");
    }

    Treasure.message(character, token.get("name") + ": " + treasureType + " / " + treasureValue, message);
}

Treasure.getRoll = function(sides, dice) {
    var total = 0;
    for (; dice > 0; dice--) {
        total += randomInteger(sides);
    }
    return total;
}

Treasure.getFromSpecialTable = function(tableName) {
    var table = Treasure.special[tableName].table;

    if (table == null) {
        log("No such special table [" + tableName + "]");
        return null;
    }

    var size = table.length;

    var item = table[randomInteger(size) - 1]

    return item;
}

Treasure.getItemFromTable = function(tableName) {
    var table = Treasure.lists[tableName].table;

    if (table == null) {
        log("No such treasure table [" + tableName + "]");
        return null;
    }

    var size = table.length;

    var item = table[randomInteger(size) - 1]

    if (item[0] == 0) {
        // Use a different table.
        item = Treasure.getItemFromTable(item[1])
    }

    return item;
}

Treasure.getItems = function(tableName, number) {
    var items = [];

    log("getItems: " + tableName + ", " + number);
    for (var i=0; i < number; i++) {
        var item = Treasure.getItemFromTable(tableName);

        if (item != null) {
            items.push(item);
        }
    }

    return items;
}

Treasure.getRandomCoins = function(tableName, value) {
    var table = Treasure.lists[tableName];

    if (table == null || table.coins == null) {
        log("No such treasure table [" + tableName + "]");
        return null;
    }
    return table.coins(value);
}

Treasure.getRandomTreasure = function(tableName, value) {
    var items = [];
    var cp = 0, sp = 0, gp = 0; pp = 0;

    var coins = Treasure.getRandomCoins(tableName, value);
    if (coins != null) {
        items.push(coins);
    }

    switch (Treasure.getRoll(6, value)) {
        case 1: case 2: case 3:
            items = items.concat(Treasure.getItems(tableName, randomInteger(2)-1));
            break;
        case 4: case 5: case 6:
            items = items.concat(Treasure.getItems(tableName, randomInteger(2)));
            break;
        case 7: case 8: case 9: case 10:
            items = items.concat(Treasure.getItems(tableName, randomInteger(4)));
            break;
        case 11: case 12: case 13: case 14: case 15:
            items = items.concat(Treasure.getItems(tableName, randomInteger(3) * 2));
            break;
        default:
            items = items.concat(Treasure.getItems(tableName, randomInteger(value) * 2));
            break;
    }

    return items;
}

Treasure.message = function(character, title, message) {
    if (message != null) {
        var image = character.get("avatar");
        var html = "<div style='" + Treasure.BOX_STYLE + "'>";
        html += "<div style='" + Treasure.TITLE_STYLE + "'>" + title + "</div>";
        html += "<table><tr><td style='width:48px; vertical-align: top'>";
        html += "<img src='"+image+"' width='40px' style='float:left; padding-right: 5px;'/>";
        html += "</td><td style='width:auto; vertical-align: top'>";
        html += message;
        html += "</td></tr></table>";
        html += "</div>";

        sendChat("", "/w GM " + html);
    }
}

Treasure.special = {};

Treasure.special['Notes'] = {};
Treasure.special['Notes'].table = [
    [ "Meet at a street in Underbridge [[1d4]] nights from now." ],
    [ "You are so dead." ]
];

Treasure.special['Maps'] = {};
Treasure.special['Maps'].table = [
    [ "Map to a lake in the Mushfens." ],
    [ "Map of a dungeon." ],
    [ "Map of what look like sewers." ],
    [ "<Poorly|Badly|Quickly|Carefully> drawn map of <Magnimar|the Docklands|Naos>." ]
];


Treasure.lists = {};

Treasure.lists['Scum'] = {};
Treasure.lists['Scum'].coins = function(value) {
    return [ 12, '[[2d4]] copper pinches.' ];
};
Treasure.lists['Scum'].table = [
    [ 6, "An old <dirty|stained|worn|torn|tattered> patchwork cloak, worth [[1d4+1]] gp." ],
    [ 6, "An old <dirty|stained|worn|torn|tattered> reversible cloak, worth [[1d4+1]] sp." ],
    [ 9, "A <broken|twisted|plain> copper ring worth [[2d4]] cp." ],
    [ 9, "A wooden pendant with a <bird|cat|dog|rat> carving worth [[1d6]] cp." ],
    [ 9, "A wooden holy symbol of <Desna|Calistria|Abadar|Erastil|Cayden Cailean>, [[1d4+2]] cp." ],
    [ 9, "A <small|dirty|filthy|cracked> bottle of <rum|wine|spirits> worth [[2d3]] cp." ],
    [ 12, "A piece of <string|wire|chalk|torn paper>." ],
    [ 12, "A pair of <ivory|wooden|bone> dice [[3d4]] cp." ],
    [ 12, "Half a <plain|scratched|twisted> silver ring worth [[1d4+1]] sp." ],
    [ 12, "A small bag of herbs, worth [[1d12]] cp." ],
    [ 12, "<Half a|A broken|A|A black> candle, worth [[1d4]] cp." ],
    [ 15, "A lock of <brown|golden|white> hair <wrapped|tied> around a wooden ring." ],
    [ 15, "A finger in a small wooden box." ],
    [ 15, "A set of broken lock picks." ],
    [ 15, "A <hastily scribbled|finely written|perfumed> note.", "Notes" ],
    [ 18, "[[2d4]] copper pinches hidden in shoe." ],
    [ 18, "A rusted blade in the heal of a shoe." ],
    [ 21, "A <small|tiny> <gemstone|piece of quartz|gem|crystal> worth [[2d4]] gp." ],
    [ 0, "Common" ]
];


Treasure.lists['Common'] = {};
Treasure.lists['Common'].coins = function(value) {
    return [ 12, '[[2d4]] silver shields.' ]
};
Treasure.lists['Common'].table = [
    [ 0, "Scum" ],
    [ 12, "A <plain|simply carved|scratched> wooden box containing snuff, [[1d4]] sp. " ],
    [ 12, "An IOU from a local <merchant|shop keeper|noble|person> claiming [[2d4]] gp." ],
    [ 21, "A small gemstone worth [[3d6]] gp." ],
    [ 0, "Expert" ]
];


Treasure.lists['Expert'] = {};
Treasure.lists['Expert'].coins = function(value) {
    return [ 12, '[[2d6]] gold sails.' ]
};
Treasure.lists['Expert'].table = [
    [ 0, "Common" ],
    [ 12, "An expert gemstone worth [[4d10]] gp." ],
    [ 0, "Noble" ]
];


Treasure.lists['Noble'] = {};
Treasure.lists['Noble'].coins = function(value) {
    return [ 12, '[[2d8]] platinum crowns.' ]
};
Treasure.lists['Noble'].table = [
    [ 0, "Expert" ],
    [ 12, "A noble gemstone worth [[4d100]] gp." ]
];



