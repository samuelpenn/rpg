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

PfNames.VERSION = "1.0";

on("ready", function() {
   log(`==== PfNames Version ${PfNames.VERSION} ====`);

   if (!PfInfo) {
       log("PfNames is dependent on PfInfo, which is not available.");
       sendChat("PfNames", "/w GM PfNames is dependent on PfInfo, which is not available.");
       return;
   }

   PfInfo.addGmHelp("!pfname", "Automatically sets the name of every selected token based on the " +
            "details set in their Pathfinder character. Uses the 'race' and 'gender' fields if they " +
            "are set, or otherwise appends a unique numerical suffix to them.");
});


on("chat:message", function(msg) {
    if (msg.type !== "api") {
        return;
    }

    if (!PfInfo) {
        sendChat("PfNames", "Cannot run PfName without the PfInfo script.");
        return;
    }

    let args = PfInfo.getArgs(msg);
    let command = args.shift();
    let player = getObj("player", msg.playerid);

    if (command === "!pfname") {
        if (!playerIsGM(player.get("_id"))) {
            sendChat("PNames", `/w "${player.get('displayname')}" You must be the GM to run this.`);
            return;
        }
        let results = "";
        let nameList = null;
        let tokenList = PfInfo.getSelectedTokens(msg);
        for (let i = 0; i < tokenList.length; i++) {
            let token = tokenList[i];
            if (!nameList) {
                // Do this here, because we need a token to find the current page.
                nameList = PfNames.getCurrentNames(token);
            }
            // Token should be guaranteed to have a valid character.
            let character = getObj("character", token.get("represents"));
            results += PfNames.generate(token, character, nameList);
        }
        if (results) {
            PfInfo.whisper(player, results, "Setting Names");
        }
    }
});

/**
 * Gets a list of all the names on the current page, which is determined by the
 * token that is passed. The occurrences of each name is counted, and returned
 * as hash map with the count.
 *
 * @param token Token to use in order to determine the current page.
 */
PfNames.getCurrentNames = function(token) {
    let nameList = {};

    if (!token || !token.get("_pageid")) {
        return nameList;
    }

    let tokens = findObjs({
        _pageid: token.get("_pageid"),
        _type: "graphic"
    });
    for (let i=0; i < tokens.length; i++) {
        let t = tokens[i];
        if (t && t.get("name")) {
            let name = t.get("name");
            if (!nameList[name]) {
                nameList[name] = 1;
            } else {
                nameList[name] ++;
            }
        }
    }

    return nameList;
};

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
    let race = getAttrByName(character.id, "race");
    let gender = getAttrByName(character.id, "gender");
    let currentName = token.get("name");
    let name = null;
    let results = "";

    // If the character is of a known race, select a random name.
    if (race && gender && PfNames.names[race] && PfNames.names[race][gender]) {
        let list = PfNames.names[race][gender];

        // Find a unique random name. After a few attempts, we fall back
        // to using a indexed name.
        for (let attempt=3; attempt > 0; attempt--) {
            name = list[randomInteger(list.length -1)];
            if (!nameList[name]) {
                token.set("name", name);
                results += `${race} (${gender}) -> ${name}<br/>`;
                break;
            }
            currentName = name;
            name = null;
        }
    }
    if (!name) {
        // Haven't yet set a new name.
        if (currentName.indexOf("#") !== -1) {
            // Is already a numbered mook. Is it a duplicate?
            if (nameList[currentName] > 1) {
                currentName = currentName.replace(/ #.*/, "");
            }
        }

        if (currentName.indexOf("#") === -1) {
            for (let suffix = 1; suffix < 1000; suffix ++) {
                name = currentName + " #" + suffix;
                if (!nameList[name]) {
                    results += `${currentName} -> ${name}<br/>`;
                    token.set("name", name);
                    nameList[name] = 1;
                    break;
                }
            }
        }
    }
    log("Set name to " + name);
    return results;
};



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
    "Tobar", "Wen", "Wesh", "Yanko", "Yoska", "Zale", "Zindelo",
    "Abert", "Bristur", "Ciprian", "Claudiu", "Costin", "Dariu", "Dominik",
    "Dracu", "Dragos", "Garril", "Kennick", "Maloney", "Matei", "Mazonn",
    "Nicolas", "Pitti", "Sergil", "Valerian", "Vasile", "Yanor"

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
    "Tzigane", "Vita", "Yesenia", "Zenda", "Zenina", "Zenobia", "Zigana",
    "Anemona", "Branka", "Carmelin", "Cataria", "Constanta", "Corica",
    "Fawni", "Georgeta", "Ilina", "Jaela", "Lizuca", "Lucia", "Minda",
    "Mirelda", "Monia", "Rodica", "Sandra", "Sorinnia", "Valeria",
    "Veronisha", "Violena"
];

PfNames.names["Human/Shoanti"] = {};
PfNames.names["Human/Shoanti"]["Male"] = [
    "Adahy", "Aditsan", "Ahiga", "Apiationu", "Ashkii", "Atohi", "Ceta",
    "Chaska", "Dohanzee", "Gaagii", "Gawonii", "Gomda", "Kangee", "Kanuna",
    "Kohali", "Kohanahto", "Loota", "Mammedaty", "Niyol", "Odakota", "Ohiye",
    "Paytah", "Shappa", "Tahate", "Tsela", "Tsiyi", "Unaduti", "Wahkah", "Wana",
    "Apiationu", "Ashkii", "Atoki", "Besha", "Boiko", "Chanzee", "Chatangee",
    "Enapa", "Eska", "Kohate", "Mahpee", "Naalnisin", "Seta", "Shiyesa",
    "Sintonka", "Toke", "Tsoai", "Wana", "Weaya", "Yani"
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

PfNames.names["Human/Chelaxian"] = {};
PfNames.names["Human/Chelaxian"]["Male"] = [
    "Andrea", "Bonavenlio", "Castumius", "Cervinus", "Cispianus", "Davius",
    "Duvius", "Epidio", "Folcarius", "Gianula", "Iovinus", "Laetanus",
    "Lucanicio", "Pilus", "Pilo", "Plauto", "Pollius", "Quartius",
    "Quinctius", "Rainaldo", "Remus", "Rufo", "Saulius", "Synisto",
    "Vesterius", "Vindex"
];
PfNames.names["Human/Chelaxian"]["Female"] = [
    "Arsina", "Bubo", "Camela", "Cascens", "Debonia", "Eclettina", "Elpiana",
    "Frugia", "Fuscina", "Juniana", "Lovella", "Marullia", "Melitia",
    "Morenatia", "Nennia", "Norial", "Ovida", "Pulcita", "Sarranta", "Terra",
    "Tina", "Urbica", "Vagenna", "Verenici", "Viducia", "Vinia", "Vinice"
];

PfNames.names["Human/Kellid"] = {};
PfNames.names["Human/Kellid"]["Male"] = [
    "Brok", "Brongu", "Burak", "Dangu", "Dannga", "Dannum", "Desk", "Drok",
    "Durgu", "Goresk", "Gorug", "Granga", "Grog", "Jannek", "Kannek", "Kokek",
    "Kolog", "Kolok", "Kolum", "Kranug", "Nanngu", "Nolug", "Trok", "Trokom",
    "Zanek", "Zanem",
];
PfNames.names["Human/Kellid"]["Female"] = [
    "Agik", "Bala", "Balet", "Bannka", "Belet", "Beska", "Dalik", "Deshka",
    "Eshka", "Fanka", "Faren", "Felen", "Janla", "Jeshka", "Jeski", "Jesla",
    "Kala", "Kalki", "Kesla", "Leshka", "Nagur", "Narit", "Nesen", "Neska",
    "Shalka", "Veshki", "Yannet", "Yannka", "Yelen",
];

/*
 * Goblin names.
 */
PfNames.names["Goblin"] = {};
PfNames.names["Goblin"]["Male"] = [
    "Arg", "Bog", "Chog", "Dorl", "Eb", "Fod", "Gorn", "Hab",
    "Jad", "Kal", "Lob", "Mob", "Nob", "Og", "Pek", "Rus", "Tad",
    "Wat", "Yal",
    "Ard", "Arl", "Ald", "Bolg", "Borb", "Chob", "Cob", "Dork", "Dal", "Dort",
    "Ed", "Egg", "Er", "Ford", "Fon", "Fob", "Gorb", "Gol", "Gort", "Hal",
    "Hed", "Hag", "Jeb", "Job", "Jord", "Kad", "Kas", "Kebb", "Lort", "Lor",
    "Lub", "Meb", "Mib", "Moth", "Nork", "Nan", "Nub", "Olg", "Oot", "Orn",
    "Pap", "Pelk", "Pork", "Rub", "Rad", "Rarn", "Ted", "Tolg", "Tan", "Wart",
    "Wob", "Wib", "Yang", "Yar", "Yig"
];
PfNames.names["Goblin"]["Female"] = [
    "Ana", "Bogi", "Coi", "Dori", "Eba", "Fodi", "Goro", "Haba",
    "Jada", "Kala", "Lobi", "Mobi", "Nobi", "Ogi", "Peki", "Rusa", "Tadi",
    "Wata", "Yali",
    "Arda", "Arli", "Aldi", "Bolga", "Borba", "Chobi", "Cobu", "Dorka", "Dali", "Dorti",
    "Eda", "Egga", "Era", "Forni", "Fonni", "Fobbi", "Gorba", "Golsa", "Gora", "Halba",
    "Hedda", "Hagi", "Jebe", "Jobi", "Jorda", "Kaldi", "Kassi", "Kebbo", "Lorti", "Loro",
    "Lube", "Mebba", "Mibba", "Mothi", "Norka", "Nanna", "Nubi", "Olga", "Ooti", "Orna",
    "Pai", "Pelki", "Pora", "Rubi", "Rada", "Rarna", "Tedi", "Tolga", "Tano", "Wari",
    "Woba", "Wibi", "Yani", "Yarli", "Yigga"
];

/*
 * Hobgoblin names.
 */
PfNames.names["Hobgoblin"] = {};
PfNames.names["Hobgoblin"]["Male"] = [
    "Nerlet", "Hivtug", "Hikluk", "Gethir", "Praldor", "Siltem", "Dorkong", "Prughad",
    "Nagrid", "Dethrun", "Darog", "Paled", "Borlim", "Sodrim", "Rethom", "Faglen",
    "Drivtar", "Nivron", "Rudrim", "Ruthir"
];
PfNames.names["Hobgoblin"]["Female"] = [
    "Phinre", "Oklal", "Dakli", "Imgi", "Mufne", "Nuyraf", "Wetnin", "Hema", "Ecmikdil",
    "Fulgonduh", "Sasmof", "Nelme", "Kecmo", "Phitran", "Sasza", "Nulu", "Tamko",
    "Simku", "Toszosdes", "Wustithum"
];

/*
 * Derro names.
 */
PfNames.names["Derro"] = {};
PfNames.names["Derro"]["Male"] = [
    "Adjgarfal", "Adjwoldin", "Adjgholthor", "Adjardan", "Arihorg", "Arisanakon",
    "Diinja", "Diinkoloba", "Diinjagog", "Diirghol", "Diirthok", "Fakasol", "Fakakoloba",
    "Inkamor", "Inkajan", "Inkajal", "Karadumm", "Karadorthag", "Karanavak",
    "Miirnwoldin", "Miirnjagog", "Miirnsold", "Secgholthor", "Secardan", "Secthok",
    "Uriinana", "Uriikoloba", "Uriisanakon", "Uriitotha", "Xeerjarda", "Xeerxanso",
    "Zandabra", "Zannakon"
];
PfNames.names["Derro"]["Female"] = [
    "Adjoolsii", "Adjaana", "Ariankoolaa", "Diinaanii", "Diijuulaa", "Diiruuba",
    "Fakasoolaarn", "Fakakuubaa", "Inkakaazuu", "Karameetoo", "Karajaataa",
    "Miirnooluum", "Secooraa", "Uriinaanaa", "Xeeroolee", "Zaneelaa",
];

