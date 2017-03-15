/**
 * Generate random names..
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


var PfNames = PfNames || {};


on("chat:message", function(msg) {
    if (msg.type !== "api") {
        return;
    }
    if (msg.content.split(" ", 1)[0] != "!pfname") {
        return;
    }

    var nameList = null;
    if (msg.selected.length > 0) {
        for (var i=0; i < msg.selected.length; i++) {
            var tokenId = msg.selected[i]._id;
            var token = getObj("graphic", tokenId);
            if (token != null) {
                if (nameList == null) {
                    nameList = PfNames.getCurrentNames(token);
                }
                var character_id = token.get("represents");
                if (character_id == null) {
                    continue;
                }
                var character = getObj("character", character_id);
                PfNames.generate(token, character, nameList);
            }
        }
    }
    return;
});

/**
 * Gets a list of all the names on the current page, which is determined by the
 * token that is passed. The occurrences of each name is counted, and returned
 * as hash map with the count.
 *
 * @param token Token to use in order to determine the current page.
 */
PfNames.getCurrentNames = function(token) {
    var nameList = {};

    if (token == null || token.get("_pageid") == null) {
        return nameList;
    }

    var tokens = findObjs({
        _pageid: token.get("_pageid"),
        _type: "graphic"
    });
    for (var i=0; i < tokens.length; i++) {
        var t = tokens[i];
        if (t != null && t.get("name") != null && t.get("name") != "") {
            var name = t.get("name");
            if (nameList[name] == null) {
                nameList[name] = 1;
            } else {
                nameList[name] ++;
            }
            log("[" + name +"]: " + nameList[name]);
        }
    }

    return nameList;

}

/**
 * Generates a random name for the token. Uses the nameList to ensure that
 * the chosen name is random. The type of name chosen is determined by the
 * 'race' of the character, and it's 'gender'. If no race/gender list is
 * present for the token, then falls back to adding a #X suffix to the token
 * name, starting at #1, and going up. e.g. "Skeleton #1", "Skeleton #2".
 *
 * If a unique name can't be found after a few attempts, falls back to adding
 * a #X suffix to a non-unique name, e.g. "Bob", "Bob #1".
 *
 * Copes with renaming of existing tokens, stripping off any suffix before
 * trying to find a new name.
 */
PfNames.generate = function(token, character, nameList) {
    var race = getAttrByName(character.id, "race");
    var gender = getAttrByName(character.id, "gender");
    var currentName = token.get("name");
    var name = null;

    // If the character is of a known race, select a random name.
    if (race != null && gender != null && PfNames.names[race] != null && PfNames.names[race][gender] != null) {
        var list = PfNames.names[race][gender];

        // Find a unique random name. After a few attempts, we fall back
        // to using a indexed name.
        for (var attempt=3; attempt > 0; attempt--) {
            name = list[randomInteger(list.length -1)];
            if (nameList[name] == null) {
                token.set("name", name);
                break;
            }
            currentName = name;
            name = null;
        }
    }
    if (name == null) {
        // Haven't yet set a new name.
        if (currentName.indexOf("#") != -1) {
            // Is already a numbered mook. Is it a duplicate?
            if (nameList[currentName] > 1) {
                currentName = currentName.replace(/ #.*/, "");
            }
        }

        if (currentName.indexOf("#") == -1) {
            for (var suffix = 1; suffix < 1000; suffix ++) {
                name = currentName + " #" + suffix;
                if (nameList[name] == null) {
                    token.set("name", name);
                    nameList[name] = 1;
                    break;
                }
            }
        }
    }
    log("Set name to " + name);

}



PfNames.names = {};

PfNames.names["Human/Varisian"] = {};
PfNames.names["Human/Varisian"]["Male"] = [
    "Abela", "Aberahama", "Aberama", "Abesoloma", "Abia", "Abisai", "Adamu",
    "Amria", "Besnik", "Boiko", "Brishen", "Camlo", "Casamir", "Cato", "Chal",
    "Chik", "Danior", "Dukker", "Durriken", "Durril", "Ferka", "Garridan",
    "Gillie", "Hanzi", "Jal", "Jibben", "Lel", "Lendar", "Lennor", "Lensar",
    "Loiza", "Mander", "Marko", "Merripen", "Mestipen", "Nicu", "Pal",
    "Pattin", "Petsha", "Pias", "Pitivo", "Pov", "Pulika", "Punka", "Radu",
    "Ramon", "Rye", "Stiggur", "Tamas", "Tas", "Tawno", "Tem", "Theron",
    "Tobar", "Wen", "Wesh", "Yanko", "Yoska", "Zale", "Zindelo"

];
PfNames.names["Human/Varisian"]["Female"] = [
    "Acantha", "Adamina", "Adara", "Aditi", "Adria", "Aleta", "Aminta",
    "Beti", "Blasia", "Calandra", "Calypso", "Catarina", "Chavali", "Chavi",
    "Cosima", "Czigany", "Damara", "Dooriya", "Drabardi", "Dudee", "Electra",
    "Esmerelda", "Fifika", "Flora", "Florica", "Gitana", "Gypsy", "Ilona",
    "Kali", "Kirvi", "Kizzy", "Llesenia", "Malina", "Manishie", "Melantha",
    "Mirela", "Nadja", "Natayla", "Olena", "Oriana", "Pesha", "Philana",
    "Rasia", "Rawnie", "Risa", "Rumer", "Sadira", "Sapphira", "Shalaye",
    "Shebari", "Shey", "Shofranka", "Shimza", "Sirena", "Syeira", "Taletha",
    "Tzigane", "Vita", "Yesenia", "Zenda", "Zenina", "Zenobia", "Zigana"
];

PfNames.names["Human/Shoanti"] = {};
PfNames.names["Human/Shoanti"]["Male"] = [
    "Adahy", "Aditsan", "Ahiga", "Apiationu", "Ashkii", "Atohi", "Ceta",
    "Chaska", "Dohanzee", "Gaagii", "Gawonii", "Gomda", "Kangee", "Kanuna",
    "Kohali", "Kohanahto", "Loota", "Mammedaty", "Niyol", "Odakota", "Ohiye",
    "Paytah", "Shappa", "Tahate", "Tsela", "Tsiyi", "Unaduti", "Wahkah", "Wana"
];
PfNames.names["Human/Shoanti"]["Female"] = [
    "Agaskawee", "Ahyoka", "Angpetu", "Atsila", "Ayita", "Chapa",
    "Chlumana", "Chlumanita", "Chumana", "Chumani", "Dowanhowee",
    "Doya", "Ehawee", "Gola", "Haloke", "Hanta", "Hantuh",
    "Hiawassee", "Macawi", "Makanda", "Makawee", "Mina", "Noya",
    "Ojintka", "Shadi", "Tsomah", "Unega", "Usdi", "Wenona",
    "Yazhi"
];

PfNames.names["Human/Nidalese"] = PfNames.names["Human/Varisian"];


PfNames.names["Goblin"] = {};
PfNames.names["Goblin"]["Male"] = [
    "Arg", "Bog", "Chog", "Dorl", "Eb", "Fod", "Gorn", "Hab",
    "Jad", "Kal", "Lob", "Mob", "Nob", "Og", "Pek", "Rus", "Tad",
    "Wat", "Yal"
];
PfNames.names["Goblin"]["Female"] = [
    "Ana", "Bogi", "Coi", "Dori", "Eba", "Fodi", "Goro", "Haba",
    "Jada", "Kala", "Lobi", "Mobi", "Nobi", "Ogi", "Peki", "Rusa", "Tadi",
    "Wata", "Yali"
];



