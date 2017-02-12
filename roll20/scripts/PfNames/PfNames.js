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
                PfNames.generate(token, character);
            }
        }
    }
    return;
});


PfNames.generate = function(token, character) {
    var race = getAttrByName(character.id, "race");
    var gender = getAttrByName(character.id, "gender");

    if (PfNames.names[race] != null && PfNames.names[race][gender] != null) {
        var list = PfNames.names[race][gender];
        var name = list[randomInteger(list.length -1)];

        token.set("name", name);
    }

}



PfNames.names = {};

PfNames.names["Human/Varisian"] = {};
PfNames.names["Human/Varisian"]["Male"] = [
    "Antonis", "Beryx", "Costelix", "Durril", "Horasilescu", "Horel",
    "Ilien", "Ionato", "Ionus", "Iosie", "Iulio", "Iuliu", "Kalodja",
    "Khulai", "Lender", "Mazonn", "Mihaita", "Octavian", "Octavius",
    "Petru", "Pitivo", "Razvantin", "Sander", "Simon", "Valin", "Veaceslav",
    "Victor", "Zache", "Zstel", "Zsteliu"
];
PfNames.names["Human/Varisian"]["Female"] = [
    "Alexanda", "Amali", "Antoanasildi", "Araunya", "Aurika", "Bordanasia",
    "Catalerina", "Cecilia", "Dorota", "Erika", "Esmera", "Georgeta",
    "Ineria", "Kaliana", "Lavia", "Lillai", "Maria", "Masia", "Mindusa",
    "Nataria", "Pabelandreina", "Piousia", "Raluca", "Reveka", "Sandreea",
    "Simona", "Sonica", "Ujarica", "Valerique", "Ylenia"
];


