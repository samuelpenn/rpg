PfNames
=======

API Script to automatically give character tokens a unique name. Uses the 
_Pathfinder Character Sheet_ attributes to determine the race and gender of
the character.

If no race or gender can be determined, or it isn't anything recognised, then
the tokens will be given a numerical suffix instead. e.g. "Skeleton #1", 
"Skeleton #2".

Commands
--------

The commands for this API can only be run by the GM.

**!pfname** - For each of the currently selected tokens, if it represents a
character then give that token a name that is unique on the current map.