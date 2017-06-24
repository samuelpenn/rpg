/**
 * Work out incidental treasure.
 *
 * Designed to work with the Pathfinder character sheet for Roll20.
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


var PfTreasure = PfTreasure || {};
PfTreasure.VERSION = "2.0";

on("ready", function() {
    log(`==== PfTreasure Version ${PfTreasure.VERSION} ====`);

    if (PfInfo) {
        // Player commands.
        PfInfo.addPlayerHelp("!pftreasure", "Args: <b>tokenId</b><br/>Generate random treasure for the token.");
        // GM Only commands.
        //PfInfo.addGmHelp("!pflights", "Args: <b>duration</b>, <b>tokenId</b><br/>Reduce time left on light sources.");
    } else {
        sendChat("PfDescribe", "PfTreasure API depends on PfInfo, which is missing.");
    }
});

/**
 * Treasure.
 */
on("chat:message", function(msg) {
    let args = PfInfo.getArgs(msg);
    let command = args.shift();

    if (command === "!pftreasure") {
        let store = true;
        let option = args.shift();
        if (option === "nostore") {
            store = false;
        }

        let tokens = PfInfo.getSelectedTokens(msg);
        if (tokens && tokens.length > 0) {
            for (let i=0; i < tokens.length; i++) {
                let characterId = tokens[i].get("represents");
                let character = getObj("character", characterId);
                PfTreasure.generate(tokens[i], character, store);
            }
        }
    }
});


PfTreasure.BOX_STYLE="background-color: #DDDDAA; color: #000000; padding:0px; border:1px solid black; border-radius: 5px";
PfTreasure.TITLE_STYLE="background-color: #000000; color: #FFFFFF; padding: 1px; text-align: center";

PfTreasure.line = function(message) {
    return "<p style='margin-bottom: 0px'>" + message + "</p>";
};

/**
 * Format the output using the special replacement syntax. There are two replacement
 * commands that can be put into messages:
 * <<a|b|c>> - Select a random item from the list, delimited with |.
 * !!Var - Replace with a random item from the named variable list.
 */
PfTreasure.format = function(message) {
    while (message.indexOf("<<") > -1) {
        let left = message.substring(0, message.indexOf("<<") );
        let right = message.substring(message.indexOf(">>") + 2);
        let array = message.substring(message.indexOf("<<") + 2, message.indexOf(">>") ).split("|");
        let chosen = array[randomInteger(array.length - 1)];

        message = left + chosen + right;
    }
    while (list = message.match(/!![A-Za-z]+/)) {
        let variable = list[0].replace(/!/g, "");
        let result = "";
        if (Treasure.vars[variable]) {
            let vars = Treasure.vars[variable];
            result = vars[randomInteger(vars.length -1)];
        } else {
            result = "XXXX";
        }
        message = message.replace(/!![A-Za-z]+/, result);
    }

    return message;
};

PfTreasure.generate = function(token, character, store) {
    let treasureType = getAttrByName(character.id, "TreasureType");
    let treasureValue = getAttrByName(character.id, "TreasureType", "max");

    // Treasure types are:
    //   common
    //   merchant
    //   noble
    //   thug
    //   beggar
    if (!treasureType) {
        treasureType = "Scum";
    }
    if (!treasureValue) {
        treasureValue = 1;
    }
    let gmnotes = token.get("gmnotes");
    let message = "";

    if (!store || (gmnotes  && gmnotes.indexOf("TREASURE") === -1)) {
        let items = PfTreasure.getRandomTreasure(treasureType, treasureValue);

        if (items.length > 0) {
            let sortedItems = items.sort(function(a, b) { return a[0] - b[0] } );
            let dc = 0;
            for (let i = 0; i < sortedItems.length; i++) {
                if (sortedItems[i][0] > dc) {
                    dc = sortedItems[i][0];
                    message += PfTreasure.line("<span style='font-weight: bold; border: 1pt solid black; border-radius: 3px; padding: 0px 3px 0px 3px; background-color: #DDCC77'>DC " + dc + "</span>");
                }
                let text = PfTreasure.format(sortedItems[i][1]);
                if (sortedItems[i].length > 2) {
                    let specialTable = sortedItems[i][2];
                    let special = PfTreasure.getFromSpecialTable(specialTable);
                    if (special) {
                        text += " <em>" + PfTreasure.format(special[0]) + "</em>";
                    }
                }
                message += PfTreasure.line(PfTreasure.inlineRolls(text));
            }
        } else {
            message += PfTreasure.line("Nothing.");
        }
        if (store) {
            token.set({
                gmnotes: gmnotes + escape("<b>TREASURE</b>\n" + message + "\n---")
            });
        }
    } else {
        gmnotes = unescape(gmnotes);
        message = gmnotes.substring(gmnotes.indexOf("TREASURE"), gmnotes.indexOf("\n---"));
        message = message.substring(message.indexOf("<span"));
    }

    PfTreasure.message(character, token.get("name") + ": " + treasureType + " / " + treasureValue, message);
};

/**
 * Roll a number of dice of a given size and return the total.
 */
PfTreasure.getRoll = function(sides, dice) {
    let total = 0;
    for (; dice > 0; dice--) {
        total += randomInteger(sides);
    }
    return total;
};

/**
 * Find all references to [[xdy+z]] in the text, and replace with the results.
 * Returns the message text. This is a simple dice roller.
 */
PfTreasure.inlineRolls = function(message) {
    if (!message) {
        return "";
    }
    while (message.indexOf("[[") > -1) {
        let inline = message.substring(message.indexOf("[[")+2, message.indexOf("]]")).replace(/ /g, "");
        let total = 0;
        if (inline.indexOf("d")) {
            let number = parseInt(inline.replace(/d.*/, ""));
            let sides = parseInt(inline.replace(/.*d([0-9]+)/, "$1"));
            total = PfTreasure.getRoll(sides, number);
            if (inline.indexOf("+")) {
                total += parseInt(inline.replace(/.*\+([0-9]+).*/, "$1"));
            }
        }

        message = message.replace(/\[\[.*?\]\]/, total);
    }

    return message;
};

PfTreasure.getFromSpecialTable = function(tableName) {
    let table = PfTreasure.special[tableName].table;

    if (!table) {
        log("No such special table [" + tableName + "]");
        return null;
    }

    let size = table.length;

    return table[randomInteger(size) - 1];
};

PfTreasure.getItemFromTable = function(tableName) {
    if (!PfTreasure.lists[tableName]) {
        return null;
    }

    let table = PfTreasure.lists[tableName].table;

    if (!table) {
        log("No such treasure table [" + tableName + "]");
        return null;
    }

    let size = table.length;

    let item = table[randomInteger(size) - 1];

    if (parseInt(item[0]) === 0) {
        // Use a different table.
        item = PfTreasure.getItemFromTable(item[1])
    }

    return item;
};

/**
 * Gets an array of random items from the specified table. If no items are
 * found, then an empty array is returned. A number of items equal to the
 * number requested is usually returned.
 *
 * If the specified table doesn't exist, then an attempt is made to find a
 * different table, otherwise an empty array is returned. If a table ends
 * with a suffix of [A-G] (following a space), then the next highest table
 * is searched for. e.g., "My Table D" will look for "My Table C" if 'D'
 * doesn't exist. This carries down to "My Table A", and if that doesn't
 * exist then "My Table" will be finally tried before giving up.
 *
 * 'A' represents the cheapest items, 'G' represents the most expensive
 * (though most things cap out at 'E').
 */
PfTreasure.getItems = function(tableName, number) {
    let items = [];

    if (!tableName || !number) {
        return [];
    }

    if (!PfTreasure.lists[tableName] || !PfTreasure.lists[tableName].table) {
        // Table doesn't exist. Can we find a parent? If table
        let subTables = "ABCDEFG";
        let baseName = tableName.replace(/(.*) [A-G]$/, "$1");
        let suffix = tableName.replace(/.* ([A-G])$/, "$1");

        if (suffix && suffix.length === 1) {
            if (subTables.indexOf(suffix) === 0) {
                return PfTreasure.getItems(baseName, number);
            } else if (subTables.indexOf(suffix) > 0) {
                let i = subTables.indexOf(suffix) - 1;
                return PfTreasure.getItems(baseName + " " + subTables.substring(i, i + 1), number);
            }
        } else {
            return [];
        }
    }

    for (let i=0; i < number; i++) {
        let item = PfTreasure.getItemFromTable(tableName);

        if (item) {
            items.push(item);
        }
    }

    return items;
};

PfTreasure.getRandomCoins = function(tableName, value) {
    let table = PfTreasure.lists[tableName];

    if (!table || !table.coins) {
        log("No such treasure table [" + tableName + "]");
        return null;
    }
    let coins = table.coins(parseInt(value));
    let msg = "";

    if (coins.cp > 0) {
        msg += "" + coins.cp + " copper pinches; ";
    }
    if (coins.sp > 0) {
        msg += "" + coins.sp + " silver shields; ";
    }
    if (coins.gp > 0) {
        msg += "" + coins.gp + " gold sails; ";
    }
    if (coins.pp > 0) {
        msg += "" + coins.pp + " platinum crowns; ";
    }
    msg = msg.replace(/; $/, ".");

    return [ 12, msg ];
};

PfTreasure.getRandomTreasure = function(tableName, value) {
    let items = [];
    let cp = 0, sp = 0, gp = 0; pp = 0;

    if (!tableName || !value  || parseInt(value) < 0) {
        return [];
    }
    if (!value || parseInt(value) < 1) {
        value = 0;
    }
    value = parseInt(value);

    let coins = PfTreasure.getRandomCoins(tableName, value);
    if (coins) {
        items.push(coins);
    }

    let tableA = tableName + " A";
    let tableB = tableName + " B";
    let tableC = tableName + " C";
    let tableD = tableName + " D";
    let tableE = tableName + " E";

    let roll = PfTreasure.getRoll(10, 1) + value * 3;
    if (roll <= 5) {
        // No items.
    } else if (roll <= 10) {
        items = items.concat(PfTreasure.getItems(tableA, PfTreasure.getRoll(2, 1) ));
    } else if (roll <= 15) {
        items = items.concat(PfTreasure.getItems(tableA, PfTreasure.getRoll(3, 1) + 1 ));
        items = items.concat(PfTreasure.getItems(tableB, PfTreasure.getRoll(2, 1) - 1 ));
    } else if (roll <= 20) {
        items = items.concat(PfTreasure.getItems(tableA, PfTreasure.getRoll(2, 1) - 1 ));
        items = items.concat(PfTreasure.getItems(tableB, PfTreasure.getRoll(4, 1) ));
        items = items.concat(PfTreasure.getItems(tableC, PfTreasure.getRoll(2, 1) - 1 ));
    } else if (roll <= 25) {
        items = items.concat(PfTreasure.getItems(tableB, PfTreasure.getRoll(2, 1) - 1 ));
        items = items.concat(PfTreasure.getItems(tableC, PfTreasure.getRoll(4, 1) ));
        items = items.concat(PfTreasure.getItems(tableD, PfTreasure.getRoll(2, 1) - 1 ));
    } else if (roll <= 30) {
        items = items.concat(PfTreasure.getItems(tableC, PfTreasure.getRoll(2, 1) - 1 ));
        items = items.concat(PfTreasure.getItems(tableD, PfTreasure.getRoll(4, 1) ));
        items = items.concat(PfTreasure.getItems(tableE, PfTreasure.getRoll(2, 1) - 1 ));
    } else if (roll <= 35) {
        items = items.concat(PfTreasure.getItems(tableD, PfTreasure.getRoll(2, 1) - 1 ));
        items = items.concat(PfTreasure.getItems(tableE, PfTreasure.getRoll(4, 1) ));
    } else {
        items = items.concat(PfTreasure.getItems(tableE, PfTreasure.getRoll(4, 1) + 2 ));
    }

    return items;
};

PfTreasure.message = function(character, title, message) {
    if (message) {
        let image = character.get("avatar");
        let html = "<div style='" + PfTreasure.BOX_STYLE + "'>";
        html += "<div style='" + PfTreasure.TITLE_STYLE + "'>" + title + "</div>";
        html += "<table><tr><td style='width:48px; vertical-align: top'>";
        html += "<img src='"+image+"' width='40px' style='float:left; padding-right: 5px;'/>";
        html += "</td><td style='width:auto; vertical-align: top'>";
        html += message;
        html += "</td></tr></table>";
        html += "</div>";

        sendChat(character.get("name"), "/w GM " + html);
    }
};

// Following variables can be used as placeholders in text, and will be randomly
// replaced with an item from the named list. e.g., $$Colours will insert a random
// colour from the Colours list.
PfTreasure.vars = {};
PfTreasure.vars["Colours"] = [ "Red", "Blue", "Green", "Yellow", "Brown", "Black", "White" ];
PfTreasure.vars["Humans"] = [ "Varisian", "Shoanti", "Chelexian", "Nidalese", "Mwangi", "Tian" ];
PfTreasure.vars["Animals"] = [ "Bear", "Dog", "Cat", "Horse", "Fish", "Donkey", "Bird", "Wolf" ];
PfTreasure.vars["GoodGods"] = [ "Abadar", "Calistria", "Cayden Cailean", "Desna", "Erastil", "Gozreh", "Iomedae", "Irori", "Nethys", "Pharasma", "Sarenrae", "Shelyn", "Torag", "Alseta", "Brigh", "Sivanah", "Naderi", "Milani", "Kurgess", "Hanspur" ];
PfTreasure.vars["EvilGods"] = [ "Asmodeus", "Lamashtu", "Norgorber", "Rovagug", "Urgathoa", "Zon-Kuthon", "Achaekek", "Besmara", "Ghlaunder", "Groetus", "Gyronna", "Zyphus", "Razmir" ];
PfTreasure.vars["Gods"] = [ "Abadar", "Asmodeus", "Calistria", "Cayden Cailean", "Desna", "Erastil", "Gozreh", "Iomedae", "Irori", "Lamashtu", "Nethys", "Norgorber", "Pharasma", "Rovagug", "Sarenrae", "Shelyn", "Torag", "Urgathoa", "Zon-Kuthon" ];

/*
 * Each table may be divided into sub-tables with an A, B, C... suffix.
 *   A is most common 1-3.
 *   B is most common 3-5.
 *   C is most common 5-7.
 *   D is most common 7-9.
 *   E is most common 9+.
 *
 * If the suffix table doesn't exist, it falls back to the next highest.
 */

PfTreasure.special = {};

PfTreasure.special["Notes"] = {};
PfTreasure.special["Notes"].table = [
    [ "Meet at a street in Underbridge [[1d4]] nights from now." ],
    [ "A list of [[2d4 + 5]] names on a scrap of parchment. All but the last [[1d3]] have had a line drawn through them. " ],
    [ "<<A crude|An erotic|A hastily drawn>> portrait of <<a young woman|an elf maiden|an orc|two coupling halflings>>, with '<<To Be Killed|Stupid Whore|My Love|Where are you?|Beloved>>' <<scrawled|written>> <<underneath|alongside|above>>." ],
    [ "A list of [[1d4 + 3]] women, each with <<a number written|some hearts drawn>> next to her name." ],
    [ "A list of <<wizard|cleric|druid>> spells, with prices." ],
    [ "<<Under|By|In>> the <<rotten|fallen|burnt>> tree, by the gate to <<Docklands|Lowcleft|Naos|Capital|Alabaster|Keystone|Beacon's Point|Ordellia>>." ],
    [ "<<Conso|Serana|Petru>> <<5|6|7|8>>in; <<Filiu|Marku|Gillac>> <<5|6|7|8|9>>in; <<Boian|Adamu|Costol|Tawno>> <<5|6|7>>in; <<Besnik|Casamir|Jibben>>, <<6|7|8|9|10>>in; <<Cataril|Soare|Saban>> <<4|5|6|7|8>>in;" ],
    [ "<<Afina|Flavi|Orchili>> <<7|8|9>>; <<Alafarea|Helga|Pabay>> <<5|6|7>>; <<Alika|Iolana|Sorica>> <<8|9|10|10!!>>; <<Belinza|Irine|Teodora>> <<5|6|7>>; <<Cojinia|Kostela|Tas>> <<9|10>>; <<Daciana |Laurelica|Ujaritza>> <<2|3|4>>; <<Damaria|Lyuba|Vasildi>> <<3|4|5>>" ],
    [ "A <<detailed|rough|crude>> recipe for <<rat|apple|gooseberry|cherry|lemon|goblin|crow|chicken>> pie." ],
    [ "A crop is due to arrive at the docks tomorrow morning, reading for plucking." ],
    [ "You are so dead." ],
    [ "By the third strike after noon, the <<dragon|dove|bird>> will <<fly|crawl|cry>> for freedom." ],
];

PfTreasure.special["Maps"] = {};
PfTreasure.special["Maps"].table = [
    [ "Map to a lake in the Mushfens." ],
    [ "Map of a dungeon." ],
    [ "Map of what look like sewers." ],
    [ "<<Poorly|Badly|Quickly|Carefully>> drawn map of <<Magnimar|the Docklands|Naos>>." ]
];


PfTreasure.lists = {};

PfTreasure.lists["Cursed"] = {};
PfTreasure.lists["Cursed"].coins = function(value) {
    return null;
};
PfTreasure.lists["Cursed"].table = [
    [ 6, "A <<brass|copper|wooden>> <<ring|pendent>> <<carved|inscribed|decorated|embossed>> with <<cats|dragons|fish|birds>>, -1 to all saves." ],
    [ 6, "A <<dog's|cat's|rat's>> <<stuffed|mummified>> head that makes a <<hiss|scream|sound>> when it is <<squeezed|kissed|petted|given water>>." ],
    [ 6, "A miniature skull with drops of water around its teeth, -10 to swim checks." ],
    [ 6, "A <<brass|copper|electrum>> <<ring|necklace|bracelet>> with <<hearts|eyes|diamond patterns>> inscribed on it. -10 to all checks to resist alchohol." ],
];

/*
 * Clothing represents things worn by a person, as well as accessories, such as handkerchiefs, scarfs and the like.
 * Boring clothing won't be listed, so anything listed may be worthless but interesting in some way. The DC given
 * is the difficulty to notice the interested aspect of it, not to notice the clothing itself.
 *
 * e.g., a cloak is obvious, noticing the cloak has a symbol of Asmodeous on it may be DC 12.
 *
 *   A - Dirty cheap clothes, rags. Worthless.
 *   B - Cheap clothes. Coppers.
 *   C - Standard commoners garb. Silver.
 *   D - Good quality. Gold.
 *   E - Fine quality. Many gold.
 */
PfTreasure.lists["Clothing A"] = { "table": [
    [ 6, "A <<quite|relatively>> clean cloak, with 'This belongs to <<Barsali|Silvui|Marino|Catalin|Angelo|Dukker>> of <<Abadar|Nethys|Desna|Erastil|Sarenrae>>' stitched into it." ],
    [ 6, "An old <<dirty|dusty|muddy|torn|>> cloak, with bloodstains and filled with arrow holes." ],
    [ 6, "An old <<dirty|dusty|muddy|torn|>> cloak, with a handful of <<black|green|blue|red|white>> dragon scales (DC 20) stitched on the shoulders." ],
    [ 6, "An old <<dirty|dusty|muddy|torn|>> cloak, with a handful of <<lizard folk|troglodyte>> scales (DC 20) stitched on the shoulders." ],
    [ 6, "An old <<dirty|dusty|muddy|torn|>> cloak, with bloodstains and filled with arrow holes." ],
    [ 6, "An old cloak with a silk patch showing a symbol of <<Achaekek|Norgorber|Calistria>>." ],
    [ 9, "A <<red|black>> scarf with <<Abyssal|Necril|Infernal>> writing stitched along one edge, detailing an <<ancient|unholy|evil|holy|common|childish>> <<blessing|curse|prayer|ritual>>." ],
    [ 12, "A <<dark|bright>> <<brown|red>> <<neck scarf|handkerchief>> with dwarven runes and an image of a <<dwarven werebear|bulette>> stitched into it." ],
    [ 12, "There are symbols of <<Abadar|the Aspis Consortium|The Exchange|Liberty's Edge|the Dark Archive>> on the lapel of the jacket." ],
    [ 12, "The jacket has the crest of <<the Arcanamirium|Absalom|the Bellflower Network>> on it." ],
    [ 12, "Hidden in a <<shoe|belt|sleeve|wristband>> is a <<grubby|dirty|torn>> note.", "Notes" ],
    [ 12, "Hidden in a <<shoe|wristband|belt|sleeve>> is a picture of <<a young woman|an old woman|an old man|two girls|a boy|a dog>>." ],
    [ 12, "<<A steel|An iron>> manacle still attached to one <<leg|wrist>>." ],
    [ 12, "A <<green|brown|blue>> sash with 'Rise of the green world' written in Druidic." ],
    [ 12, "A hat with <<bright green|bright yellow|golden>> feathers from a baby Roc, [[3d4]]cp." ],
    [ 15, "A pair of dirty fingerless gloves with a set of lock picks hidden inside." ],
    [ 15, "A leather belt with a <<lock pick|garotte|small blade>> hidden in the buckle." ],
    [ 18, "Foot wrappings hide necrotic flesh, showing signs of ghoul fever." ],
    [ 18, "A pair of <<heavy|dirty|tough>> leather boots with a blade hidden in the heel." ],
    [ 18, "The buttons on the jacket are actually hiding silver shields, [[1d4+1]]sp." ]
]};

PfTreasure.lists["Clothing B"] = { "table": [
    [ 6, "An old <<dirty|stained|worn|torn|tattered>> reversible cloak, worth [[1d4+1]]sp." ],
    [ 6, "A cloth bandolier, which is empty. [[1d3]]sp." ],
    [ 6, "A floppy hat with a <<dark blue|dark red|green|red>> silk ribbon tied around it. The ribbon is worth [[1d4]]sp." ],
    [ 12, "A set of clothes designed to easily tear." ],
    [ 15, "A leather belt hiding a <<short blade|garotte|set of lockpicks>>, [[1d4]]cp." ],
    [ 15, "A handkerchief with the symbol of the <<Pathfinder Society|Aspis Consortium|Bellflower Network>>, [[1d6+2]] cp." ],
    [ 18, "A boot heel with [[1d4]]sp hidden inside it." ],
]};

PfTreasure.lists["Clothing C"] = { "table": [
    [ 6, "A cloak edged with <<white fur|red fur|black fur|golden fur>>, [[2d4]]gp" ],
    [ 6, "An old <<dirty|stained|worn|torn|tattered>> reversible cloak, worth [[1d4+1]] sp." ],
    [ 6, "An old <<dirty|stained|worn|torn|tattered>> patchwork cloak, worth [[1d4+1]] gp." ],
    [ 6, "A wide brimmed hat adorned with a massive feather, [[2d6]]sp." ],
    [ 12, "A theatrical mask depicting a <<white|black|green>> faced woman crying tears of <<gold|blood>>." ],
    [ 15, "A boot heel with [[1d4]]gp hidden inside it." ],
    [ 15, "A <<dirty|tattered>> handkerchief with the symbol of the <<Pathfinder Society|Aspis Consortium>>, [[1d6+2]] cp." ],
]};

PfTreasure.lists["Clothing D"] = { "table": [
    [ 6, "A <<good|fine>> quality <<blue|red|green|orange|scarlet>> cloak edged with <<white|black>> trimmings, [[2d4]]sp." ],
    [ 6, "A <<good|fine>> quality <<blue|red|green|orange|scarlet>> cloak with <<horses|birds|ships|axes|flowers>> stitched along the edge, [[2d6]]sp." ],
    [ 6, "A <<robust|thick|heavy>> cloak edged with fur, [[2d4]]gp." ],
    [ 6, "A silken cloak, [[2d6]]gp." ]
]};

PfTreasure.lists["Clothing E"] = { "table": [
    [ 6, "A silken cloak, [[4d12]]gp." ],
    [ 6, "A pair of high quality boots, [[4d6]]gp." ],
    [ 6, "A fine hat, [[4d6]]gp." ]
]};

/*
 * Tools includes small items which a merchant, craftsman or laborer might carry around
 * with them. If small, they can be difficult to find, so may have a high DC.
 *
 *   A - Damaged or broken, often worthless.
 *   B - Poor quality.
 *   C - Standard quality.
 *   D - Masterwork or artistic (non-functional) quality.
 *   E - Both masterwork and artistic.
 */
PfTreasure.lists["Tools A"] = { "table": [
    [ 9, "A <<box|leather bag>> containing flint and steel." ],
    [ 9, "A small jar of <<dried|smelly|blackened>> glue." ],
    [ 12, "A <<small|long|rusty|large|ornate>> <<brass|iron|bronze>> key." ],
    [ 12, "A small bag containing fish hooks and maggots." ],
    [ 12, "A small bag containing herbs and roots." ],
    [ 12, "A <<rusty|blood stained|chipped>> razor." ],
    [ 12, "A flute, [[1d4+3]] cp." ],
    [ 12, "Some <<blood stained|shiny|rusty>> meat hooks." ],
    [ 12, "A <<rusty|scratched|bloodstained|dirty|clean|bent>> crowbar." ],
    [ 12, "A <<long|scratched|chipped>> wooden pipe, worth [[1d3]] cp." ],
    [ 12, "A broken compass." ],
    [ 12, "A small bronze mirror" ],
    [ 12, "A small <<iron|bronze>> hammer" ],
    [ 12, "A rusty sewing kit, [[1d4]]cp." ],
    [ 15, "Two <<plain|rusty|small|bent>> keys tied together with a short length of <<fraying twine|rusty wire>>." ],
    [ 15, "A set of broken lock picks." ],
    [ 18, "A rusted blade in the heal of a shoe." ],
    [ 18, "A set of [[2d6]] <<small|iron|bronze>> needles, [[2d4]]cp." ],
    [ 21, "<<2|3|4|5>> <<short|long>>bow strings hidden in <<underwear|shoe|lining of jacket>>." ]
]};

PfTreasure.lists["Tools B"] = { "table": [
    [ 9, "A <<box|leather bag>> containing flint and steel" ],
    [ 12, "A <<box|leather bag>> containing a blade sharpening kit." ],
    [ 12, "A silver razor, [[2d4]] sp." ],
    [ 12, "A small <<bent|scratched|dented|dirty>> bronze mirror." ],
    [ 15, "Two <<plain|rusty|small|bent>> keys tied together with a short length of <<fraying twine|rusty wire>>." ],
    [ 18, "A set of [[2d6]] <<steel>> needles, [[2d4]]sp." ],
    [ 12, "A <<dirty|mishapen|>> block of wax." ],
    [ 9, "A set of <<rusty|broken|poor quality>> manacles, [[2d6]]sp." ],
    [ 9, "A block of wax with the imprint of a key in it." ],
    [ 12, "A <<small|rusty|chipped|wobbly>> iron hammer." ],
    [ 12, "A cheap tattoo kit." ],
    [ 12, "Some sealing wax, [[2d4+2]]sp." ],
]};

PfTreasure.lists["Tools C"] = { "table": [
    [ 9, "A <<box|leather bag>> containing flint and steel" ],
    [ 9, "A <<silk|velvet>> lined box with a number of empty slots sized for potion vials, [[2d6]]gp" ],
    [ 9, "A small hand drill, with a bit for drilling half-inch holes, [[1d4+1]]sp." ],
    [ 9, "A small chalkboard, with <<simple sums|fish prices|a bad poem>> scrawled on it, [[2d3]]sp." ],
    [ 12, "A <<box|leather bag>> containing a blade sharpening kit" ],
    [ 12, "A silver razor, [[2d4]] sp." ],
    [ 12, "A set of <<three|four|five>> <<small|tiny|blunted|rusted>> throwing daggers." ],
    [ 12, "A small well polished bronze mirror" ],
    [ 12, "A glass cutter, [[d2+3]]gp." ],
    [ 12, "A small magnet, [[1d4]]sp." ],
    [ 15, "Two <<plain|rusty|small|bent>> keys tied together with a short length of <<fraying twine|rusty wire>>." ],
    [ 18, "A set of [[2d6]] <<steel>> needles, [[2d4]]sp." ]
]};

PfTreasure.lists["Tools D"] = { "table": [
    [ 9, "A gunsmith's kit, [[d4+10]]gp." ],
    [ 9, "A gear maintenance kit, [[d3+2]]gp." ],
    [ 12, "A magnifying glass, [[5d10+50]]gp." ],
]};



/**
 * Trinkets are random small items, either random crap or toys and games. Can also
 * include cheap jewellery.
 *
 * A: Worthless to a few copper pieces.
 * B: Up to a few silver pieces.
 * C: Up to a few gold pieces.
 * D: Up to about 30 gold pieces.
 * E: Up to a 100 gold pieces.
 */
PfTreasure.lists["Trinkets A"] = { "table": [
    [ 9, "A <<broken|twisted|plain>> copper ring worth [[2d4]]cp." ],
    [ 9, "A wooden pendant with a <<bird|cat|dog|rat>> carving worth [[1d6]]cp." ],
    [ 9, "A wooden holy symbol of <<Desna|Calistria|Abadar|Erastil|Cayden Cailean>>, [[1d4+2]]cp." ],
    [ 9, "A bronze holy symbol of <<Desna|Calistria|Abadar|Cayden Cailean>>, [[1d6+3]]cp." ],
    [ 9, "A <<copper|bronze|brass>> amulet engraved with the image of <<an elf|a dryad|an angel>>, [[2d6]]cp." ],
    [ 9, "A miniature <<copper|bronze|tin>> <<hammer and anvil|bow and arrow|skull|rose>> on a pendant, [[2d4]]cp." ],
    [ 12, "A knife with a blade on one end and a fork on the other, [[1d4+1]]cp." ],
    [ 12, "A small piece of flint." ],
    [ 12, "A clean bandage." ],
    [ 12, "A <<large|red|oily>> feather." ],
    [ 12, "A <<copper|bronze|brass>> candle holder, [[1d4]]cp." ],
    [ 12, "<<Two|Three>> short bow strings." ],
    [ 12, "A deck of <<blank|grubby|marked|simple>> playing cards." ],
    [ 12, "A pair of <<ivory|wooden|bone>> dice [[3d4]]cp." ],
    [ 12, "A set of <<5|6|7|8|9|10>> knucklebones, [[2d4]]cp." ],
    [ 12, "A tarnished silver bell, [[2d4]]sp." ],
    [ 12, "A <<multi-coloured|red|blue|white>> feather, worth [[1d2]]cp." ],
    [ 12, "A portrait of <<a young girl|a woman|a boy|two girls>> carved on a wooden disc, [[2d4]]cp." ],
    [ 12, "A <<crudely|partially>> carved piece of wood that <<looks like|might represent|appears to be vaguely>> a <<cat|dog|goblin|horse>>, [[1d2]]cp." ],
    [ 12, "A <<shard|fragment>> of porcelain <<decorated|painted>> with <<tiny|delicate>> <<dancers|trees|animals|flowers|boats|houses>>." ],
    [ 12, "A set of <<plain|dog-eared|stained|sticky>> playing cards, worth [[2d4]]cp." ],
    [ 12, "A quill and empty inkpot, [[1d4+1]]cp." ],
    [ 12, "Fishing hooks with a large coil of line." ],
    [ 12, "A blade polishing kit, missing any oil." ],
    [ 12, "A single <<ebony|bone|wooden>> die, that has a 5 in 6 chance of rolling a <<1|1|2|3|4|5|6|6|6>>." ],
    [ 15, "A lock of <<brown|golden|white>> hair <<wrapped|tied>> around a wooden ring." ],
    [ 15, "A <<black|red|red and yellow|yellow|brown>> cloth mask with two eye holes." ],
    [ 15, "A small <<sliver|fragment|shard>> of <<glass|crystal>> that reflects different colours of light." ],
    [ 15, "A glass marble, worth [[1d2+1]]cp." ],
]};

// Silver pieces.
PfTreasure.lists["Trinkets B"] = { "table": [
    [ 9, "A small battered eyeglass, missing any glass. [[1d4]]sp." ],
    [ 9, "<<Four|Three>> vials of differently coloured <<sand|dirt|crushed rock|crushed leaves>>." ],
    [ 9, "A pair of wooden sticks, about 9inches long, slightly tapering at one end. They have Tian writing on them, 1d3sp." ],
    [ 9, "<<Seven|Six|Five>> small scented candles, each different [[1d4]]sp." ],
    [ 9, "<<Seven|Six|Five>> small scented candles, each with an erotic carving of <<a woman|a man|two women|two men>> <<on a bed|and a horse|and a dog|and a serpent>>, [[1d6]]sp." ],
    [ 9, "A small pot of animal glue, 5sp." ],
    [ 12, "A pair of <<ivory|wooden|bone>> dice [[3d4]]cp." ],
    [ 12, "A set of glass marbles, worth [[1d2+1]]sp." ],
    [ 12, "A set of coloured <<stone|glass>> beads, worth [[1d2]]sp." ],
    [ 12, "A set of playing cards, decorated with <<erotic art|goblins|animals|weapons|gods|abstract patterns>> worth [[2d4]]sp." ],
    [ 12, "Half a <<plain|scratched|twisted>> silver ring worth [[1d4+1]]sp." ],
    [ 12, "<<Two|Three|Four|Five>> <<worn|scratched>> and <<bent|chipped|shaved>> <<silver|electrum>> coins of <<apparently|obviously|possibly>> ancient origin. The details on the coins faces cannot be made out, worth [[2d4]]sp." ],
    [ 15, "A folded up sheet of paper listing <<dwarven|orcish|elven|giantish>> curses." ],
    [ 15, "A single glass <<bead|marble|fragment>> with a small carved metal <<goblin|woman|cat|sword|crown>> inside, worth [[3d6]]sp." ],
    [ 21, "A <<long|thick>> <<silver|gold>> needle with carven symbols of <<Asmodeous|Abadar|Desna|Torag|Rovagug|Lamashtu>> on it, [[2d4]]sp." ],
    [ 21, "A single bullet from a handgun." ],
    [ 21, "A small sheet of paper with invisible ink written on it.", "Notes" ],
]};

// Gold pieces.
PfTreasure.lists["Trinkets C"] = { "table": [
    [ 12, "A full set of Harrow cards, [[2d4]]gp." ],
    [ 12, "A gold ring with a <<horse|serpent|dragon|abstract pattern>> engraved on it, [[2d4]]gp." ],
    [ 12, "A single small firecracker." ],
    [ 12, "A small silver bell carved with a <<faun|centaur|dryad|mermaid>>, worth [[1d6+3]]gp." ],
    [ 15, "A small <<bead|shard>> of <<glass|crystal>> that <<glows|flickers>> with an internal light, like a candle." ],
    [ 21, "A <<small|tiny>> <<gemstone|piece of quartz|gem|crystal>> worth [[2d4]]gp." ],
]};

// Up to 30gp.
PfTreasure.lists["Trinkets D"] = { "table": [
    [ 12, "A pair of ivory dice studded with a small gemstone on the '1' [[5d6]]gp." ],
    [ 12, "A high quality set of Harrow Cards, worth [[8d6]]gp." ],
    [ 12, "A small <<worthless|cracked|dull>> gemstone that floats around your head like an ioun stone, but otherwise does nothing." ],
    [ 12, "<<3|4|5|6|7>> 1 inch tall intricately carved wooden figures of a <<goblin|orc|man|woman>>. Worth [[2d4]] gp, or 100 times this to a collector." ],
    [ 15, "A small silver locket with a portrait of <<Queen Ileosa Arabasti|Queen Domina Arabasti|Lady Eliasia Leroung|the Harlot Queen of Geb>> inside, [[4d6]]gp." ],
    [ 15, "A small silver locket with a portrait of a noble <<man|woman|lady>> and <<two|three|four|five>> children inside, [[3d6]]gp." ],
    [ 18, "A golden disc sewn into the clothing, showing a <<detailed|stylised|high quality|faint>> portrait of <<Urgathoa|Zon-Kuthon|Lamashtu|Asmodeus|Norgorber>> on one side and the number <<5|7|11|13|17|19>> on the other, [[2d4]]gp." ],
    [ 21, "A small crushable glass bead which contains <<Black Lotus Extract, 2250gp|Sassone leaf residue, 150gp|Tears of death, 3250gp>>." ],
]};

// Up to 100gp.
PfTreasure.lists["Trinkets E"] = { "table": [
    [ 9, "A <<tiny|miniature|pocket-sized>> <<ivory|wooden|brass> chess set, <<fully|mostly>> intact, worth [[6d10+40]]gp." ],
    [ 12, "A high quality set of Harrow Cards, worth [[10d6]]gp." ],
    [ 12, "A set of platinum jacks, decorated with <<elven|dwarven|draconic>> symbology, worth [[20d6]]gp." ],
]};


/**
 * Food and drink. Also includes drugs and herbs.
 */
PfTreasure.lists["Food A"] = { "table": [
    [ 6, "A pigskin flask of <<oil|brandy|wine>>, [[1d2+3]] cp." ],
    [ 9, "A <<small|dirty|filthy|cracked>> bottle of <<rum|wine|spirits>> worth [[2d3]] cp." ],
    [ 9, "Part of a loaf of <<stale|mouldy>> bread." ],
    [ 9, "A bottle of <<decent|quality|red|white>> wine wrapped in <<rags|used bandages|leather|furs>>, [[1d4]]sp." ],
    [ 12, "A couple of slices of <<mouldy|foul smelling|slimy|soft|hardened>> cheese." ],
    [ 12, "A small clay jar containing honey, worth [[1d4]] cp." ],
    [ 12, "A bag of dried herbs, [[1d6]] cp." ],
    [ 12, "A small bag of herbs, worth [[1d12]] cp." ],
    [ 12, "Some strips of beef jerky." ],
    [ 12, "A slightly mouldy <<orange|lemon|apple>>." ],
    [ 12, "A tomato wrapped in cloth." ],
    [ 12, "A <<small pouch|bag|pouch|handkerchief>> containing some nuts and berries." ]
]};
PfTreasure.lists["Food B"] = { "table": [
    [ 12, "A <<vegetable|meat|mushroom>> pasty." ],
    [ 12, "A small metal salt shaker, containing salt." ],
    [ 12, "A slice of cheese between two slices of bread." ],
    [ 12, "Some trail rations wrapped in paper." ],
    [ 12, "<<An apple|A pear>>." ],
    [ 12, "A small flask of decent quality wine." ],
]};
PfTreasure.lists["Food C"] = { "table": [
    [ 12, "A small wheel of cheese." ],
    [ 12, "A pouch of herbs and spices, [[2d4]]gp." ],
    [ 12, "A corked vial containing a <<spicy|hot|sweet>> sauce, [[2d4]]gp." ],
    [ 12, "A <<beef|pork>> pasty decorated with <<animals|plants|a ship|a mug of ale>>." ],
    [ 12, "A small flask of good quality wine." ],
    [ 12, "A fresh orange." ],
    [ 12, "A small pie with a skillfully made pastry bird on top." ],
    [ 12, "A small pie with the symbol of !!GoodGods carved into the pastry." ],
    [ 12, "A small <<brass|copper>> box containing <<2|3|4>> doses of <i>Bachelor snuff</i>." ],
    [ 12, "A small <<brass|copper>> box containing <<2|3|4>> doses of <i>snuff</i>." ],
    [ 12, "A small pouch containing <<3|4|5|6|7>> doses of powdered <i>Thileu bark</i>." ],
]};
PfTreasure.lists["Food D"] = { "table": [
    [ 9, "A small bottle of <<red|white|vintage>> wine, [[3d6]]gp." ],
    [ 12, "A small wheel of high quality cheese." ],
    [ 12, "A pouch of <<rare|expensive>> herbs and spices, [[3d12+5]]gp." ],
    [ 12, "A corked vial containing a <<spicy|hot|sweet>> sauce, [[2d8]]gp." ],
    [ 12, "A <<beef|pork>> pasty decorated with <<animals|plants|a ship|a mug of ale>>." ],
    [ 12, "A <<silver|gold>> cigar case containing <<3|4|5|6>> cigars." ],
]};
PfTreasure.lists["Food E"] = { "table": [
    [ 12, "A small wheel of cheese." ],
    [ 12, "A pouch of herbs and spices, [[2d4]]gp." ],
    [ 12, "A corked vial containing a <<spicy|hot|sweet>> sauce, [[2d4]]gp." ],
    [ 12, "A <<beef|pork>> pasty decorated with <<animals|plants|a ship|a mug of ale>>." ],
    [ 12, "A <<platinum|gold>> cigar case containing <<3|4|5|6>> cigars." ],
]};

/**
 * Tat is worthless rubbish, which add nothing but flavour.
 */
PfTreasure.lists["Tat"] = { "table": [
    [ 9, "A <<smelly|red dyed|blue dyed|blood stained>> rabbit's foot, on a string." ],
    [ 9, "A <<dirty|tattered|torn|short>> <<silk|cloth>> neck tie with the words '<<Lucky me|Love me|Great Fuck|This is mine>>' painted on." ],
    [ 9, "A leather belt with <<skulls|animal heads|a woman's face>> marked on it." ],
    [ 9, "A fist-sized <<grey|black>> flat rock, smooth and round." ],
    [ 9, "A <<scratched|twisted|partially melted>> <<brass|copper|iron>> ring, missing all of its precious stones." ],
    [ 9, "A locket, with a drawing of a <<young girl|old woman|noble looking woman>> which has been defaced with <<a moustache|a beard|blacked out eyes>>." ],
    [ 9, "An empty brass locket on a <<broken|tangled|short>> chain, worth [[1d6]]cp." ],
    [ 9, "A wooden earring stud, with a carved <<goblin face|dog's head|skull|seven pointed star|angel>> on it." ],
    [ 9, "A set of small <<rusty|locked|dirty|blood stained>> iron shackles, sized for a halfling or a child." ],
    [ 9, "A small <<cloth|dirty|smelly|torn>> bag with half a set of <<crude|worn|chipped|burnt>> <<black|white>> chess pieces." ],
    [ 9, "Several <<grubby|bent|moldy>> sheets of paper, with <<bad|crude|detailed|well drawn|quickly sketched>> drawings of <<elven women|halfing women|hairy dwarf women|naked men|giant cocks|buildings|the coast|swords|ears|landscapes>>." ],
    [ 9, "A <<red|blue|orange|yellow|green>> rabbit's foot." ],
    [ 12, "Half of a <<polished|scratched|burnt>> wooden <<flute|pipe>>." ],
    [ 12, "A heavily used fork, bent out of shape." ],
    [ 12, "About <<two|three|four|five>> feet of <<knotted|tangled>> string with a <<small stone|large needle>> at one end." ],
    [ 12, "A small harmonica with only a couple of working reeds." ],
    [ 12, "A piece of <<string|wire|chalk|torn paper>>." ],
    [ 12, "<<Half a|A broken|A|A black>> candle, worth [[1d4]]cp." ],
    [ 12, "A <<shark|ogre>>'s tooth on a <<wire|string>>, [[2d4]]cp." ],
    [ 12, "A pass to visit the Hells." ],
    [ 12, "An empty <<ebony|bone>> scroll tube missing both its stoppers." ],
    [ 12, "A fistfull of tinder scrap." ],
    [ 12, "A scrap of a ledger, marked as belonging to <<Pug's Contraptions|Joel's Bazarre|The Yellow Flower>>." ],
    [ 12, "A small bunch of poisonous berries." ],
    [ 12, "A <<cracked|small|grimy>> mirror and <<blunt|chipped|sharp>> shaving razor." ],
    [ 12, "A sewing kit of <<four|five|three>> needles and <<black|red|knotted>> thread." ],
    [ 12, "A ball of yarn, marked off at regular intervals with chalk." ],
    [ 12, "A cracked and almost useless small magnifying glass." ],
    [ 12, "<<One half of a|A bloodstained>> bootlace." ],
    [ 12, "A copper disc with a symbol of a <<stag|rearing stag|galloping horse|charging boar|hawk|goblin|dragon|wyvern|sea monster|mermaid>>." ],
    [ 12, "A seashell that sounds like the sea when held to the ear." ],
    [ 12, "A single small <<iron|copper|brass|wooden>> horseshoe." ],
    [ 12, "A sketch map of a sailing ship with a big cross in one of the cabins. The sketch is titled The <<Flying|White|Lucky|Blue|Quick|Old|Silver|Black|Red|Sea>> <<Wasp|Lady|Lamia|Maid|Hawk|Serpent|Harlot|Snake|Merchant|Sorceress|Goblin|Dodger>>." ],
    [ 15, "A broken wand with no charges, [[1d4]]cp." ],
    [ 15, "A piece of chalk, worth [[1]]cp." ],
    [ 15, "A <<hastily scribbled|finely written|perfumed>> note.", "Notes" ],
    [ 15, "A bundle of a half dozen toothpicks." ],
    [ 15, "A knotted ball of strings of varying lengths." ],
    [ 15, "A heavily filed iron key, which is probably now useless." ],
    [ 15, "A single six-sided <<wooden|bone|stone>> die, with <<a grinning skull|a heart|an apple|an eye|a pair of crossed swords>> in place of the <<one|six>>." ],
    [ 15, "A single twenty-sided <<wooden|bone|stone>> die, terribly balanced and most likely to roll a <<2|5|7|13|15|16|17>> than anything else." ],
    [ 15, "A single six-sided <<wooden|bone|stone>> die, weighted to roll a <<1|2|3|4|5|6>> about half the time." ],
    [ 18, "[[2d4]] copper pinches hidden in shoe." ],
    [ 18, "Several locks of hair <<twisted|tied|entwined|knotted>> together." ],
    [ 18, "A single <<melted|bent|chewed>> copper coin." ],
    [ 18, "A silver coin bitten in two, 1sp" ]
]};

/**
 * Eww is worthless and unpleasant rubbish which only a depraved person would carry.
 */
PfTreasure.lists["Eww"] = { "table": [
    [ 9, "A <<dried|mummified|skeletal>> <<human|monkey's|child's|delicate>> hand on a string." ],
    [ 9, "A mummified cat's head." ],
    [ 9, "A <<straw|sack|feather>> doll with needles stuck into it. <<It has a woman's face painted on it.|It is stained with blood.|It's head is almost detatched.>>" ],
    [ 9, "A dried-out <<dead snake|tentacle>> <<skewered on|wrapped around a>> <<gnarled branch|thick iron wire>>." ],
    [ 9, "A bracelet of <<fingernails|fish fins|knucklebones>> threaded with copper wire. " ],
    [ 9, "A <<dog's|cat's>> paw necklace." ],
    [ 9, "A small piece of wood carved into a crude penis." ],
    [ 12, "A <<small|smelly|blood stained>> bag full of <<human|goblin|dog|orc|shark|elf|dwarf|children's|wooden>> teeth." ],
    [ 12, "A <<small bag|wrapped sheet of cloth>> containing <<children's|human|dwarven|elven>> fingernails." ],
    [ 12, "A dried eyeball wrapped in cloth." ],
    [ 12, "Several chess pieces carved from <<human|elvish|goblin>> finger bones." ],
    [ 12, "<<Half a dozen|Three|Four>> <<fish|rat|mouse>> skeletons wrapped in paper." ],
    [ 12, "A tangled ball of pigeon feathers, stuck together with <<blood|glue>>." ],
    [ 12, "A soiled handkerchief, covered in <<moist|dried|aromatic>> green and brown stains." ],
    [ 12, "A squashed and dried eyeball, in a folded sheet of paper." ],
    [ 12, "A handful of dried and half-eaten beetles." ],
    [ 12, "A small dead <<mouse|rat>> stuffed with rags." ],
    [ 12, "Several <<ears|nipples|noses>> threaded on a wire necklace." ],
    [ 12, "A small blackened and shrivelled hand, probably from a small baby." ],
    [ 15, "A finger in a small wooden box." ],
    [ 15, "A collection of <<dog|cat>> claws." ],
    [ 15, "A torn scrap of skin with a tattoo of a <<Sihedron Rune|nipple|eyeball|penis|vagina|skull|scar>>." ],
    [ 15, "A large bundle of short coarse <<black|red|blonde|brown>> hair." ],
    [ 18, "A small collection of <<toe|finger>> nails." ],
    [ 21, "A scrap of parchment sewn into jacket, with a <<detailed|badly drawn|cartoonish>> sketch of a naked and mutilated <<man's|woman's>> corpse." ],
    [ 21, "A piece of dried skin with a tattoo of <<Lamashtu|Rovagug|Zon-Kuthon>> on it." ],
]};


PfTreasure.lists["Scum"] = {};
PfTreasure.lists["Scum"].coins = function(value) {
    let  cp = 0, sp = 0, gp = 0, pp = 0;

    if (value < 2) {
        cp = PfTreasure.getRoll(4, value + 1);
    } else if (value < 4) {
        cp = PfTreasure.getRoll(6, 2);
        sp = PfTreasure.getRoll(3, value);
        gp = PfTreasure.getRoll(2, value - 1);

    } else {
        cp = PfTreasure.getRoll(6, 2);
        sp = PfTreasure.getRoll(6, 2);
        gp = PfTreasure.getRoll(4, value - 2);
    }
    return { "cp": cp, "sp": sp, "gp": gp, "pp": pp };
};
PfTreasure.lists["Scum A"] = { "table": [
    [ 0, "Cursed" ],
    [ 0, "Clothing A" ],
    [ 0, "Tools A" ],
    [ 0, "Trinkets A" ], [ 0, "Trinkets A" ],
    [ 0, "Tat" ], [ 0, "Tat" ], [ 0, "Tat" ],
    [ 0, "Food A" ], [ 0, "Food A" ], [ 0, "Food B" ],
    [ 0, "Eww" ], [ 0, "Scum B" ]
]};
PfTreasure.lists["Scum B"] = { "table": [
    [ 0, "Scum A" ], [ 0, "Cursed" ],
    [ 0, "Clothing B" ],
    [ 0, "Tools B" ],
    [ 0, "Trinkets B" ], [ 0, "Trinkets B" ],
    [ 0, "Tat" ], [ 0, "Tat" ],
    [ 0, "Food A" ], [ 0, "Food B" ], [ 0, "Food B" ],
    [ 0, "Eww" ], [ 0, "Scum C" ]
]};
PfTreasure.lists["Scum C"] = { "table": [
    [ 0, "Scum B" ], [ 0, "Clothing C" ],
    [ 0, "Tools C" ],
    [ 0, "Trinkets B" ], [ 0, "Trinkets C" ],
    [ 0, "Tat" ],
    [ 0, "Food B" ], [ 0, "Food C" ], [ 0, "Food C" ],
    [ 0, "Scum D" ],
]};
PfTreasure.lists["Scum D"] = { "table": [
    [ 0, "Scum C" ], [ 0, "Clothing C" ],
    [ 0, "Tools D" ],
    [ 0, "Trinkets C" ], [ 0, "Trinkets D" ],
    [ 0, "Food C" ], [ 0, "Food C" ], [ 0, "Food D" ],
    [ 0, "Scum E" ],
]};
PfTreasure.lists["Scum E"] = { "table": [
    [ 0, "Scum D" ], [ 0, "Clothing D" ],
    [ 0, "Tools D" ], [ 0, "Tools E" ],
    [ 0, "Trinkets D" ], [ 0, "Trinkets E" ],
    [ 0, "Food C" ], [ 0, "Food D" ], [ 0, "Food E" ]
]};


PfTreasure.lists["Common"] = {};
PfTreasure.lists["Common"].coins = function(value) {
    let  cp = 0, sp = 0, gp = 0, pp = 0;

    if (value < 2) {
        cp = PfTreasure.getRoll(4, value + 1);
    } else if (value < 5) {
        cp = PfTreasure.getRoll(6, 2);
        sp = PfTreasure.getRoll(3, value);
    } else if (value < 8) {
        cp = PfTreasure.getRoll(6, 2);
        sp = PfTreasure.getRoll(6, 2);
        gp = PfTreasure.getRoll(3, value - 5);
    } else {
        cp = PfTreasure.getRoll(6, 2);
        sp = PfTreasure.getRoll(6, 2);
        gp = PfTreasure.getRoll(4, value - 5);
    }
    return { "cp": cp, "sp": sp, "gp": gp, "pp": pp };
};
PfTreasure.lists["Common"].table = [
    [ 12, "A <<plain|simply carved|scratched>> wooden box containing snuff, [[1d4]]sp." ],
    [ 12, "An IOU from a local <<merchant|shop keeper|noble|person>> claiming [[2d4]]gp." ],
    [ 12, "A small, <<mud-stained|blood-stained|water-stained>> book. The pages <<appear to be blank|are covered in some unreadable script|contain poor quality sketches>>, worth [[2d6]]cp."],
    [ 12, "A good quality paint brush, made of <<human|elf|horse>> hair, [[2d6]]cp." ],
    [ 15, "A <<copper|bronze>> <<acorn|walnut>> worth [[1d4]]sp." ],
    [ 15, "A wand of acid spray, with one charge [[75]]sp." ],
    [ 21, "A small gemstone worth [[3d6]]gp." ]
];
PfTreasure.lists["Common A"] = { "table": [
    [ 0, "Clothing B" ],
    [ 0, "Tools A" ],
    [ 0, "Trinkets A" ], [ 0, "Trinkets A" ], [ 0, "Trinkets A" ],
    [ 0, "Tat" ], [ 0, "Tat" ], [ 0, "Tat" ],
    [ 0, "Food A" ], [ 0, "Food A" ], [ 0, "Food B" ], [ 0, "Food B" ]
]};



PfTreasure.lists["Expert"] = {};
PfTreasure.lists["Expert"].coins = function(value) {
    let  cp = 0, sp = 0, gp = 0, pp = 0;

    if (value < 2) {
        cp = PfTreasure.getRoll(6, 3);
        sp = PfTreasure.getRoll(4, 1);
    } else if (value < 5) {
        cp = PfTreasure.getRoll(6, 2);
        sp = PfTreasure.getRoll(4, value);
    } else if (value < 8) {
        cp = PfTreasure.getRoll(6, 1);
        sp = PfTreasure.getRoll(6, 3);
        gp = PfTreasure.getRoll(3, value - 5);
    } else {
        cp = PfTreasure.getRoll(6, 1);
        sp = PfTreasure.getRoll(6, 3);
        gp = PfTreasure.getRoll(6, value - 5);
    }
    return { "cp": cp, "sp": sp, "gp": gp, "pp": pp };
};
PfTreasure.lists["Expert A"] = { "table": [
    [ 0, "Clothing B" ],
    [ 0, "Tools B" ], [ 0, "Tools B" ],
    [ 0, "Trinkets A" ], [ 0, "Trinkets A" ],
    [ 0, "Food B" ], [ 0, "Food B" ], [ 0, "Food C" ],
]};
PfTreasure.lists["Expert B"] = { "table": [
    [ 0, "Clothing B" ],
    [ 0, "Tools B" ], [ 0, "Tools B" ],
    [ 0, "Trinkets A" ], [ 0, "Trinkets B" ],
    [ 0, "Food B" ], [ 0, "Food C" ], [ 0, "Food C" ],
]};
PfTreasure.lists["Expert C"] = { "table": [
    [ 0, "Clothing C" ],
    [ 0, "Tools A" ], [ 0, "Tools C" ],
    [ 0, "Trinkets B" ], [ 0, "Trinkets B" ],
    [ 0, "Food C" ], [ 0, "Food C" ], [ 0, "Food C" ],
]};
PfTreasure.lists["Expert D"] = { "table": [
    [ 0, "Clothing C" ],
    [ 0, "Tools C" ], [ 0, "Tools D" ],
    [ 0, "Trinkets B" ], [ 0, "Trinkets C" ],
    [ 0, "Food C" ], [ 0, "Food C" ], [ 0, "Food D" ],
]};
PfTreasure.lists["Expert E"] = { "table": [
    [ 0, "Clothing C" ], [ 0, "Clothing D" ],
    [ 0, "Tools D" ], [ 0, "Tools E" ],
    [ 0, "Trinkets B" ], [ 0, "Trinkets C" ],
    [ 0, "Food C" ], [ 0, "Food C" ], [ 0, "Food D" ],
]};


PfTreasure.lists["Aristocrat"] = {};
PfTreasure.lists["Aristocrat"].coins = function(value) {
    let  cp = 0, sp = 0, gp = 0, pp = 0;

    if (value < 2) {
        cp = PfTreasure.getRoll(6, 3);
        sp = PfTreasure.getRoll(4, value);
    } else if (value < 5) {
        cp = PfTreasure.getRoll(6, 2);
        sp = PfTreasure.getRoll(6, value) + value;
    } else if (value < 8) {
        cp = PfTreasure.getRoll(6, 1);
        sp = PfTreasure.getRoll(6, 3);
        gp = PfTreasure.getRoll(6, value) + value;
    } else {
        cp = PfTreasure.getRoll(6, 2);
        sp = PfTreasure.getRoll(6, 2);
        gp = PfTreasure.getRoll(8, value - 5) + value;
        pp = PfTreasure.getRoll(6, value - 7);
    }
    return { "cp": cp, "sp": sp, "gp": gp, "pp": pp };
};
PfTreasure.lists["Aristocrat A"] = { "table": [
    [ 0, "Clothing B" ], [ 0, "Clothing C" ],
    [ 0, "Trinkets B" ], [ 0, "Trinkets B" ],
    [ 0, "Food B" ], [ 0, "Food C" ],
    [ 0, "Jewellery B" ]
]};
PfTreasure.lists["Aristocrat B"] = { "table": [
    [ 0, "Clothing C" ], [ 0, "Clothing C" ],
    [ 0, "Trinkets B" ], [ 0, "Trinkets C" ],
    [ 0, "Food C" ], [ 0, "Food C" ],
    [ 0, "Jewellery C" ]
]};
PfTreasure.lists["Aristocrat C"] = { "table": [
    [ 0, "Clothing D" ], [ 0, "Clothing D" ],
    [ 0, "Trinkets C" ], [ 0, "Trinkets C" ],
    [ 0, "Food C" ], [ 0, "Food D" ],
    [ 0, "Jewellery C" ], [ 0, "Jewellery C" ]
]};
PfTreasure.lists["Aristocrat D"] = { "table": [
    [ 0, "Clothing E" ], [ 0, "Clothing E" ],
    [ 0, "Trinkets C" ], [ 0, "Trinkets D" ],
    [ 0, "Food D" ], [ 0, "Food D" ],
    [ 0, "Jewellery C" ], [ 0, "Jewellery D" ], [ 0, "Jewellery D" ]
]};
PfTreasure.lists["Aristocrat E"] = { "table": [
    [ 0, "Clothing E" ], [ 0, "Clothing E" ],
    [ 0, "Trinkets D" ], [ 0, "Trinkets E" ],
    [ 0, "Food D" ], [ 0, "Food E" ],
    [ 0, "Jewellery D" ], [ 0, "Jewellery E" ], [ 0, "Jewellery E" ]
]};


PfTreasure.lists["Goblin"] = {};
PfTreasure.lists["Goblin"].coins = function(value) {
    let  cp = 0, sp = 0, gp = 0, pp = 0;

    if (value < 2) {
        cp = PfTreasure.getRoll(6, 1) - 3;
    } else if (value < 5) {
        cp = PfTreasure.getRoll(6, 1) - 2;
        sp = PfTreasure.getRoll(4, 1) - 2;
    } else if (value < 8) {
        cp = PfTreasure.getRoll(6, 2) - 5;
        sp = PfTreasure.getRoll(4, 2) - 4;
    } else {
        cp = PfTreasure.getRoll(6, 3) - 8;
        sp = PfTreasure.getRoll(4, 3) - 5;
        gp = PfTreasure.getRoll(value, 1) - 4;
    }
    if (cp < 0) {
        cp = 0;
    }
    if (sp < 0) {
        sp = 0;
    }
    if (gp < 0) {
        gp - 0;
    }
    return { "cp": cp, "sp": sp, "gp": gp, "pp": pp };
};
PfTreasure.lists["Goblin A"] = { "table": [
    [ 0, "Tat" ], [ 0, "Eww" ], [ 0, "Eww" ],
    [ 0, "Food A" ]
]};
PfTreasure.lists["Goblin B"] = { "table": [
    [ 0, "Tat" ], [ 0, "Eww" ],
    [ 0, "Food A" ], [ "Tools A" ]
]};
PfTreasure.lists["Goblin C"] = { "table": [
    [ 0, "Tat" ], [ 0, "Eww" ],
    [ 0, "Food A" ], [ "Tools A" ], [ "Trinkets A" ]
]};
