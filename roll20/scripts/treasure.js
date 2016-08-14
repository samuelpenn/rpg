/**
 * Work out incidental treasure.
 *
 * Designed to work with the Pathfinder character sheet for Roll20.
 *
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
    while (message.indexOf("<<") > -1) {
        log("Formatting: " + message);
        var left = message.substring(0, message.indexOf("<<") );
        var right = message.substring(message.indexOf(">>") + 2);
        log("Formatting: [" + left + "] and [" + right + "]");
        var array = message.substring(message.indexOf("<<") + 2, message.indexOf(">>") ).split("|");
        log("Formatting: Choice " + array);
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
                if (dc > 0) {
                    //message += "<hr style='padding:0px; margin: 1px; border-bottom: 1px dashed #555555; width: 100%'/>";
                }
                dc = sortedItems[i][0];
                message += Treasure.line("<span style='font-weight: bold; border: 1pt solid black; border-radius: 3px; padding: 0px 3px 0px 3px; background-color: #DDCC77'>DC " + dc + "</span>");
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
    if (Treasure.lists[tableName] == null) {
        return null;
    }

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
Treasure.getItems = function(tableName, number) {
    var items = [];

    log("getItems: " + tableName + ", " + number);

    if (tableName == null || number == null || number < 1) {
        return [];
    }

    if (Treasure.lists[tableName] == null || Treasure.lists[tableName].table == null) {
        // Table doesn't exist. Can we find a parent? If table
        var subTables = "ABCDEFG";
        var baseName = tableName.replace(/(.*) [A-G]$/, "$1");
        var suffix = tableName.replace(/.* ([A-G])$/, "$1");
        log(suffix);
        if (suffix != null && suffix.length == 1) {
            if (subTables.indexOf(suffix) == 0) {
                return Treasure.getItems(baseName, number);
            } else if (subTables.indexOf(suffix) > 0) {
                var i = subTables.indexOf(suffix) - 1;
                return Treasure.getItems(baseName + " " + subTables.substring(i, i + 1), number);
            }
        } else {
            return [];
        }
    }

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
    var coins = table.coins(parseInt(value));
    var msg = "";

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
}

Treasure.getRandomTreasure = function(tableName, value) {
    var items = [];
    var cp = 0, sp = 0, gp = 0; pp = 0;

    if (tableName == null || value == null || value < 0) {
        return [];
    }
    if (value == null || value < 1) {
        value = 0;
    }
    value = parseInt(value);

    var coins = Treasure.getRandomCoins(tableName, value);
    if (coins != null) {
        items.push(coins);
    }

    var tableA = tableName + " A";
    var tableB = tableName + " B";
    var tableC = tableName + " C";
    var tableD = tableName + " D";
    var tableE = tableName + " E";

    var roll = Treasure.getRoll(10, 1) + value * 3;
    if (roll <= 5) {
        // No items.
    } else if (roll <= 10) {
        items = items.concat(Treasure.getItems(tableA, Treasure.getRoll(2, 1) ));
    } else if (roll <= 15) {
        items = items.concat(Treasure.getItems(tableA, Treasure.getRoll(3, 1) + 1 ));
        items = items.concat(Treasure.getItems(tableB, Treasure.getRoll(2, 1) - 1 ));
    } else if (roll <= 20) {
        items = items.concat(Treasure.getItems(tableA, Treasure.getRoll(2, 1) - 1 ));
        items = items.concat(Treasure.getItems(tableB, Treasure.getRoll(4, 1) ));
        items = items.concat(Treasure.getItems(tableC, Treasure.getRoll(2, 1) - 1 ));
    } else if (roll <= 25) {
        items = items.concat(Treasure.getItems(tableB, Treasure.getRoll(2, 1) - 1 ));
        items = items.concat(Treasure.getItems(tableC, Treasure.getRoll(4, 1) ));
        items = items.concat(Treasure.getItems(tableD, Treasure.getRoll(2, 1) - 1 ));
    } else if (roll <= 30) {
        items = items.concat(Treasure.getItems(tableC, Treasure.getRoll(2, 1) - 1 ));
        items = items.concat(Treasure.getItems(tableD, Treasure.getRoll(4, 1) ));
        items = items.concat(Treasure.getItems(tableE, Treasure.getRoll(2, 1) - 1 ));
    } else if (roll <= 35) {
        items = items.concat(Treasure.getItems(tableD, Treasure.getRoll(2, 1) - 1 ));
        items = items.concat(Treasure.getItems(tableE, Treasure.getRoll(4, 1) ));
    } else {
        items = items.concat(Treasure.getItems(tableE, Treasure.getRoll(4, 1) + 2 ));
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

        sendChat(character.get("name"), "/w GM " + html);
    }
}

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

Treasure.special = {};

Treasure.special['Notes'] = {};
Treasure.special['Notes'].table = [
    [ "Meet at a street in Underbridge [[1d4]] nights from now." ],
    [ "A list of [[2d4 + 5]] names on a scrap of parchment. All but the last [[1d3]] have had a line drawn through them. " ],
    [ "<<A crude|An erotic|A hastily drawn>> portrait of <<a young woman|an elf maiden|an orc|two coupling halflings>>, with '<<To Be Killed|Stupid Whore|My Love|Where are you?|Beloved>>' <<scrawled|written>> <<underneath|alongside|above>>." ],
    [ "A list of [[1d4 + 3]] women, each with <<a number written|some hearts drawn>> next to her name." ],
    [ "A list of <<wizard|cleric|druid>> spells, with prices." ],
    [ "<<Under|By|In>> the <<rotten|fallen|burnt>> tree, by the gate to <<Docklands|Lowcleft|Naos|Capital|Alabaster|Keystone|Beacon's Point|Ordellia>>." ],
    [ "<<Conso|Serana|Petru>> <<5|6|7|8>>in; <<Filiu|Marku|Gillac>> <<5|6|7|8|9>>in; <<Boian|Adamu|Costol|Tawno>> <<5|6|7>>in; <<Besnik|Casamir|Jibben>>, <<6|7|8|9|10>>in; <<Cataril|Soare|Saban>> <<4|5|6|7|8>>in;" ],
    [ "<<Afina|Flavi|Orchili>> <<7|8|9>>; <<Alafarea|Helga|Pabay>> <<5|6|7>>; <<Alika|Iolana|Sorica>> <<8|9|10|10!!>>; <<Belinza|Irine|Teodora>> <<5|6|7>>; <<Cojinia|Kostela|Tas>> <<9|10>>; <<Daciana |Laurelica|Ujaritza>> <<2|3|4>>; <<Damaria|Lyuba|Vasildi>> <<3|4|5>>" ],
    [ "A <<detailed|rough|crude>> recipe for <<rat|apple|gooseberry|cherry|lemon|goblin|crow|chicken>> pie." ],
    [ "You are so dead." ]
];

Treasure.special['Maps'] = {};
Treasure.special['Maps'].table = [
    [ "Map to a lake in the Mushfens." ],
    [ "Map of a dungeon." ],
    [ "Map of what look like sewers." ],
    [ "<<Poorly|Badly|Quickly|Carefully>> drawn map of <<Magnimar|the Docklands|Naos>>." ]
];


Treasure.lists = {};

Treasure.lists['Cursed'] = {};
Treasure.lists['Cursed'].coins = function(value) {
    return null;
}
Treasure.lists['Cursed'].table = [
    [ 6, "A <<brass|copper|wooden>> <<ring|pendent>> <<carved|inscribed|decorated|embossed>> with <<cats|dragons|fish|birds>>, -1 to all saves." ]
];

/*
 * Clothing represents things worn by a person, as well as accessories, such as handkerchiefs, scarfs and the like.
 * Boring clothing won't be listed, so anything listed may be worthless but interesting in some way. The DC given
 * is the difficulty to notice the interested aspect of it, not to notice the clothing itself.
 *
 * e.g., a cloak is obvious, noticing the cloak has a symbol of Asmodeous on it may be DC 12.
 *
 *   A - Dirty cheap clothes, rags.
 *   B - Cheap clothes.
 *   C - Standard commoners garb.
 *   D - Good quality.
 *   E - Fine quality.
 */
Treasure.lists['Clothing A'] = { 'table': [
    [ 9, "An old <<dirty|dusty|muddy|torn|>> cloak, with bloodstains and filled with arrow holes." ],
    [ 9, "An old <<dirty|dusty|muddy|torn|>> cloak, with a handful of <<black|green|blue|red|white>> dragon scales (DC 20) stitched on the shoulders." ],
    [ 9, "An old <<dirty|dusty|muddy|torn|>> cloak, with a handful of <<lizardfolk|troglodyte>> scales (DC 20) stitched on the shoulders." ],
    [ 9, "An old <<dirty|dusty|muddy|torn|>> cloak, with bloodstains and filled with arrow holes." ],
    [ 9, "An old cloak with a silk patch showing a symbol of <<Achaekek|Norgorber|Calistria>>." ],
    [ 9, "A <<red|black>> scarf with <<Abyssal|Necril|Infernal>> writing stitched along one edge, detailing an <<ancient|unholy|evil>> <<blessing|curse|prayer|ritual>>." ],
    [ 15, "A pair of dirty fingerless gloves with a set of lockpicks hidden inside." ],
    [ 15, "A <<quite|relatively>> clean cloak, with 'This belongs to <<Barsali|Silvui|Marino|Catalin|Angelo|Dukker>> of <<Abadar|Nethys|Desna|Erastil|Sarenrae>>' stitched into it." ],
    [ 18, "Foot wrappings hide necrotic flesh, showing signs of ghoul fever." ],
    [ 18, "A pair of <<heavy|dirty|tough>> leather boots with a blade hidden in the heel." ],
]};

Treasure.lists['Clothing B'] = { 'table': [
    [ 6, "An old <<dirty|stained|worn|torn|tattered>> reversible cloak, worth [[1d4+1]] sp." ],
    [ 12, "A set of clothes designed to easily tear." ],
    [ 15, "A leather belt hiding a <<short blade|garotte|set of lockpicks>>, [[1d4]]cp." ],
    [ 15, "A handkerchief with the symbol of the <<Pathfinder Society|Aspis Corporation>>, [[1d6+2]] cp." ],
    [ 18, "A boot heel with [[1d4]]sp hidden inside it." ],
]};

Treasure.lists['Clothing C'] = { 'table': [
    [ 6, "A cloak edged with <<white fur|red fur|black fur|golden fur>>, [[2d4]]gp" ],
    [ 6, "An old <<dirty|stained|worn|torn|tattered>> reversible cloak, worth [[1d4+1]] sp." ],
    [ 6, "An old <<dirty|stained|worn|torn|tattered>> patchwork cloak, worth [[1d4+1]] gp." ],
    [ 15, "A boot heel with [[1d4]]gp hidden inside it." ],
    [ 15, "A <<dirty|tattered>> handkerchief with the symbol of the <<Pathfinder Society|Aspis Corporation>>, [[1d6+2]] cp." ],
]};

Treasure.lists['Clothing D'] = { 'table': [
    [ 6, "A <<good|fine>> quality <<blue|red|green|orange|scarlet>> cloak edged with <<white|black>> trimmings, [[2d4]]sp." ],
    [ 6, "A <<good|fine>> quality <<blue|red|green|orange|scarlet>> cloak with <<horses|birds|ships|axes|flowers>> stitched along the edge, [[2d6]]sp." ],
    [ 6, "A <<robust|thick|heavy>> cloak edged with fur, [[2d4]]gp." ],
    [ 6, "A silken cloak, [[2d6]]gp." ],
]};

Treasure.lists['Clothing E'] = { 'table': [
    [ 6, "A silken cloak, [[4d12]]gp." ],
    [ 6, "A pair of high quality boots, [[4d6]]gp." ],
    [ 6, "A fine hat, [[4d6]]gp." ],
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
Treasure.lists['Tools A'] = { 'table': [
    [ 9, "A <<box|leather bag>> containing flint and steel." ],
    [ 9, "A small jar of <<dried|smelly|blackened>> glue." ],
    [ 12, "A <<small|long|rusty|large|ornate>> <<brass|iron|bronze>> key." ],
    [ 12, "A small bag containing fish hooks and maggots." ],
    [ 12, "A <<rusty|blood stained|chipped>> razor." ],
    [ 12, "A flute, [[1d4+3]] cp." ],
    [ 12, "Some <<blood stained|shiny|rusty>> meat hooks." ],
    [ 12, "A <<rusty|scratched|bloodstained|dirty|clean|bent>> crowbar." ],
    [ 12, "A <<long|scratched|chipped>> wooden pipe, worth [[1d3]] cp." ],
    [ 12, "A broken compass." ],
    [ 12, "A small bronze mirror", ],
    [ 12, "A small <<iron|bronze>> hammer" ],
    [ 12, "A rusty sewing kit, [[1d4]]cp." ],
    [ 15, "Two <<plain|rusty|small|bent>> keys tied together with a short length of <<fraying twine|rusty wire>>." ],
    [ 15, "A set of broken lock picks." ],
    [ 18, "A rusted blade in the heal of a shoe." ],
    [ 18, "A set of [[2d6]] <<small|iron|bronze>> needles, [[2d4]]cp." ],
    [ 21, "<<2|3|4|5>> <<short|long>>bow strings hidden in <<underwear|shoe|lining of jacket>>." ],
]};

Treasure.lists['Tools B'] = { 'table': [
    [ 9, "A <<box|leather bag>> containing flint and steel" ],
    [ 12, "A <<box|leather bag>> containing a blade sharpening kit." ],
    [ 12, "A silver razor, [[2d4]] sp." ],
    [ 12, "A small bronze mirror", ],
    [ 15, "Two <<plain|rusty|small|bent>> keys tied together with a short length of <<fraying twine|rusty wire>>." ],
    [ 18, "A set of [[2d6]] <<steel>> needles, [[2d4]]sp." ],
    [ 12, "A <<dirty|mishapen|>> block of wax." ],
    [ 9, "A set of <<rusty|broken|poor quality>> manacles, [[2d6]]sp." ],
    [ 12, "A <<small|rusty|chipped|wobbly>> iron hammer." ],
]};

Treasure.lists['Tools C'] = { 'table': [
    [ 9, "A <<box|leather bag>> containing flint and steel" ],
    [ 12, "A <<box|leather bag>> containing a blade sharpening kit" ],
    [ 12, "A silver razor, [[2d4]] sp." ],
    [ 12, "A small bronze mirror", ],
    [ 15, "Two <<plain|rusty|small|bent>> keys tied together with a short length of <<fraying twine|rusty wire>>." ],
    [ 18, "A set of [[2d6]] <<steel>> needles, [[2d4]]sp." ]
]};


Treasure.lists['Toys'] = { 'table': [
    [ 12, "A pair of <<ivory|wooden|bone>> dice [[3d4]] cp." ],
    [ 12, "A glass marble, worth [[1d2+1]] cp." ],
    [ 12, "A set of <<plain|dog-eared|stained|sticky>> playing cards, worth [[2d4]]cp." ],
    [ 12, "A set of <<5|6|7|8|9|10>> knucklebones, [[2d4]]cp." ],
]};

Treasure.lists['Trinkets'] = { 'table': [
    [ 9, "A <<broken|twisted|plain>> copper ring worth [[2d4]] cp." ],
    [ 9, "A wooden pendant with a <<bird|cat|dog|rat>> carving worth [[1d6]] cp." ],
    [ 9, "A wooden holy symbol of <<Desna|Calistria|Abadar|Erastil|Cayden Cailean>>, [[1d4+2]] cp." ],
    [ 9, "A bronze holy symbol of <<Desna|Calistria|Abadar|Cayden Cailean>>, [[1d6+3]] cp." ],
    [ 9, "A <<copper|bronze|brass>> amulet engraved with the image of <<an elf|a dryad|an angel>>, [[2d6]] cp." ],
    [ 12, "Half a <<plain|scratched|twisted>> silver ring worth [[1d4+1]] sp." ],
    [ 12, "A tarnished silver bell, [[2d4]]sp." ],
    [ 12, "A <<multi-coloured|red|blue|white>> feather, worth [[1d2]] cp." ],
    [ 12, "A portrait of <<a young girl|a woman|a boy|two girls>> carved on a wooden disc, [[2d4]] cp." ],
    [ 12, "A <<crudely|partially>> carved piece of wood that <<looks like|might represent|appears to be vaguely>> a <<cat|dog|goblin|horse>>, [[1d2]] cp." ],
    [ 12, "<<Two|Three|Four|Five>> <<worn|scratched>> and <<bent|chipped|shaved>> <<silver|electrum>> coins of <<apparently|obviously|possibly>> ancient origin. The details on the coins faces cannot be made out, worth [[2d4]] sp." ],
    [ 12, "<<3|4|5|6|7>> 1 inch tall intricately carved wooden figures of a <<goblin|orc|man|woman>>. Worth [[2d4]] gp, or 100 times this to a collector." ],
    [ 12, "A <<shard|fragment>> of porcelain <<decorated|painted>> with <<tiny|delicate>> <<dancers|trees|animals|flowers|boats|houses>>." ],
    [ 15, "A lock of <<brown|golden|white>> hair <<wrapped|tied>> around a wooden ring." ],
    [ 15, "A small <<sliver|fragment|shard>> of <<glass|crystal>> that reflects different colours of light." ],
    [ 21, "A <<small|tiny>> <<gemstone|piece of quartz|gem|crystal>> worth [[2d4]] gp." ],
    [ 21, "A <<long|thick>> <<silver|gold>> needle with carven symbols of <<Asmodeous|Abadar|Desna|Torag|Rovagug|Lamashtu>> on it, [[2d4]]sp." ],
]};

Treasure.lists['Food'] = { 'table': [
    [ 6, "A pigskin flask of <<oil|brandy|wine>>, [[1d2+3]] cp." ],
    [ 9, "A <<small|dirty|filthy|cracked>> bottle of <<rum|wine|spirits>> worth [[2d3]] cp." ],
    [ 12, "A small clay jar containing honey, worth [[1d4]] cp." ],
    [ 12, "A bag of dried herbs, [[1d6]] cp." ],
    [ 12, "A small bag of herbs, worth [[1d12]] cp." ],
]};

Treasure.lists['Tat'] = { 'table': [
    [ 9, "A <<smelly|red dyed|blue dyed|blood stained>> rabbit's foot, on a string." ],
    [ 9, "A <<dirty|tattered|torn|short>> <<silk|cloth>> neck tie with the words '<<Lucky me|Love me|Great Fuck|This is mine>>' painted on." ],
    [ 9, "A leather belt with <<skulls|animal heads|a woman's face>> marked on it." ],
    [ 12, "A piece of <<string|wire|chalk|torn paper>>." ],
    [ 12, "<<Half a|A broken|A|A black>> candle, worth [[1d4]] cp." ],
    [ 12, "A <<shark|ogre>>'s tooth on a <<wire|string>>, [[2d4]] cp." ],
    [ 12, "A pass to visit the Hells." ],
    [ 12, "An empty <<ebony|bone>> scroll tube missing both its stoppers." ],
    [ 15, "A broken wand with no charges, [[1d4]] cp." ],
    [ 15, "A piece of chalk, worth [[1]] cp." ],
    [ 15, "A <<hastily scribbled|finely written|perfumed>> note.", "Notes" ],
    [ 18, "[[2d4]] copper pinches hidden in shoe." ],
    [ 18, "Several locks of hair <<twisted|tied|entwined|knotted>> together." ],
    [ 18, "A silver coin bitten in two, 1sp" ],
]};

Treasure.lists['Eww'] = { 'table': [
    [ 9, "A <<dried|mummified|skeletal>> <<human|monkey's|child's|delicate>> hand on a string." ],
    [ 9, "A <<straw|sack|feather>> doll with needles stuck into it. <<It has a woman's face painted on it.|It is stained with blood.|It's head is almost detatched.>>" ],
    [ 12, "A <<small|smelly|blood stained>> bag full of <<human|goblin|dog|orc|shark|elf|dwarf|children's|wooden>> teeth." ],
    [ 12, "A <<small bag|wrapped sheet of cloth>> containing <<children's|human|dwarven|elven>> fingernails." ],
    [ 12, "A dried eyeball wrapped in cloth." ],
    [ 15, "A finger in a small wooden box." ],
    [ 21, "A piece of dried skin with a tattoo of <<Lamashtu|Rovagug|Zon-Kuthon>> on it." ],
]};


Treasure.lists['Scum'] = {};
Treasure.lists['Scum'].coins = function(value) {
    var  cp = 0, sp = 0, gp = 0, pp = 0;

    if (value < 2) {
        cp = Treasure.getRoll(4, value + 1);
    } else if (value < 5) {
        cp = Treasure.getRoll(6, 2);
        sp = Treasure.getRoll(3, value - 1);
    } else {
        cp = Treasure.getRoll(6, 2);
        sp = Treasure.getRoll(6, 2);
        gp = Treasure.getRoll(2, value - 5);
    }
    return { 'cp': cp, 'sp': sp, 'gp': gp, 'pp': pp };
};
Treasure.lists['Scum A'] = { 'table': [
    [ 0, "Cursed" ],
    [ 0, "Clothing A" ],
    [ 0, "Tools A" ],
    [ 0, "Toys A" ],
    [ 0, "Trinkets A" ], [ 0, "Trinkets A" ],
    [ 0, "Tat" ], [ 0, "Tat" ], [ 0, "Tat" ],
    [ 0, "Food A" ], [ 0, "Food A" ], [ 0, "Food B" ],
    [ 0, "Eww" ]
]};
Treasure.lists['Scum B'] = { 'table': [
    [ 0, "Cursed" ],
    [ 0, "Clothing B" ],
    [ 0, "Tools B" ],
    [ 0, "Toys B" ],
    [ 0, "Trinkets B" ], [ 0, "Trinkets B" ],
    [ 0, "Tat" ], [ 0, "Tat" ],
    [ 0, "Food A" ], [ 0, "Food B" ], [ 0, "Food B" ],
    [ 0, "Eww" ]
]};
Treasure.lists['Scum C'] = { 'table': [
    [ 0, "Clothing C" ],
    [ 0, "Tools C" ],
    [ 0, "Toys C" ],
    [ 0, "Trinkets B" ], [ 0, "Trinkets C" ],
    [ 0, "Tat" ],
    [ 0, "Food B" ], [ 0, "Food C" ], [ 0, "Food C" ]
]};


Treasure.lists['Common'] = {};
Treasure.lists['Common'].coins = function(value) {
    var  cp = 0, sp = 0, gp = 0, pp = 0;

    if (value < 2) {
        cp = Treasure.getRoll(4, value + 1);
    } else if (value < 5) {
        cp = Treasure.getRoll(6, 2);
        sp = Treasure.getRoll(3, value);
    } else if (value < 8) {
        cp = Treasure.getRoll(6, 2);
        sp = Treasure.getRoll(6, 2);
        gp = Treasure.getRoll(3, value - 5);
    } else {
        cp = Treasure.getRoll(6, 2);
        sp = Treasure.getRoll(6, 2);
        gp = Treasure.getRoll(4, value - 5);
    }
    return { 'cp': cp, 'sp': sp, 'gp': gp, 'pp': pp };
};
Treasure.lists['Common'].table = [
    [ 12, "A <<plain|simply carved|scratched>> wooden box containing snuff, [[1d4]]sp. " ],
    [ 12, "An IOU from a local <<merchant|shop keeper|noble|person>> claiming [[2d4]]gp." ],
    [ 12, "A small, <<mud-stained|blood-stained|water-stained>> book. The pages <<appear to be blank|are covered in some unreadable script|contain poor quality sketches>>, worth [[2d6]]cp."],
    [ 12, "A good quality paint brush, made of <<human|elf|horse>> hair, [[2d6]] cp. " ],
    [ 12, "A set of playing cards, decorated with <<erotic art|goblins|animals|weapons|gods|abstract patterns>> worth [[2d4]]sp." ],
    [ 15, "A <<copper|bronze>> <<acorn|walnut>> worth [[1d4]]sp. " ],
    [ 15, "A wand of acid spray, with one charge [[75]]sp." ],
    [ 21, "A small gemstone worth [[3d6]]gp." ],
];
Treasure.lists['Common A'] = { 'table': [
    [ 0, "Clothing B" ],
    [ 0, "Tools A" ],
    [ 0, "Toys A" ],
    [ 0, "Trinkets A" ], [ 0, "Trinkets A" ], [ 0, "Trinkets A" ],
    [ 0, "Tat" ], [ 0, "Tat" ], [ 0, "Tat" ],
    [ 0, "Food A" ], [ 0, "Food A" ], [ 0, "Food B" ], [ 0, "Food B" ]
]};



Treasure.lists['Expert'] = {};
Treasure.lists['Expert'].coins = function(value) {
    var  cp = 0, sp = 0, gp = 0, pp = 0;

    if (value < 2) {
        cp = Treasure.getRoll(6, 3);
        sp = Treasure.getRoll(4, 1);
    } else if (value < 5) {
        cp = Treasure.getRoll(6, 2);
        sp = Treasure.getRoll(4, value);
    } else if (value < 8) {
        cp = Treasure.getRoll(6, 1);
        sp = Treasure.getRoll(6, 3);
        gp = Treasure.getRoll(3, value - 5);
    } else {
        cp = Treasure.getRoll(6, 1);
        sp = Treasure.getRoll(6, 3);
        gp = Treasure.getRoll(6, value - 5);
    }
    return { 'cp': cp, 'sp': sp, 'gp': gp, 'pp': pp };
};
Treasure.lists['Expert'].table = [
    [ 12, "An expert gemstone worth [[4d10]] gp." ],
];


Treasure.lists['Noble'] = {};
Treasure.lists['Noble'].coins = function(value) {
    var  cp = 0, sp = 0, gp = 0, pp = 0;

    if (value < 2) {
        cp = Treasure.getRoll(6, 3);
        sp = Treasure.getRoll(4, value);
    } else if (value < 5) {
        cp = Treasure.getRoll(6, 2);
        sp = Treasure.getRoll(6, value) + value;
    } else if (value < 8) {
        cp = Treasure.getRoll(6, 1);
        sp = Treasure.getRoll(6, 3);
        gp = Treasure.getRoll(6, value) + value;
    } else {
        cp = Treasure.getRoll(6, 2);
        sp = Treasure.getRoll(6, 2);
        gp = Treasure.getRoll(8, value - 5) + value;
        pp = Treasure.getRoll(6, value - 7);
    }
    return { 'cp': cp, 'sp': sp, 'gp': gp, 'pp': pp };
};
Treasure.lists['Noble'].table = [
    [ 12, "A noble gemstone worth [[4d100]] gp." ]
];
