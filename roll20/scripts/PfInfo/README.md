PfInfo
======

Provides information on Pathfinder characters, working in conjunction with 
the _Pathfinder Character Sheet_ to determine character statistics. The 
information is output to the chat window so the GM doesn't have to open
the full character sheet.

Commands
--------

**!pfhelp** - Provides help text to players and GM.

**!pfinfo** tokenId - Displays information about the selected character token in
 the chat window, whispered to the GM.

It is normally best to set up a macro which shows a token action to run the
following command:
````
!pfinfo @{selected|token_id}
````

This will output something like the following to the chat window:

![Info](docs/example_info.png)


Advanced
--------

The basic statistics that are shown are relatively straightforward, and are
simply pulled directly from the character sheet. There are other assumptions
that are made about the use of note fields, status symbols and the like, which
provide further information.

Some of this comes from the character, some of it comes from the token.

Token Status
------------

Since it's mostly designed for NPCs, of which there can be many copies of
a token for a given character, most status information is pulled from the
token.

**HitPoints:** Hitpoints are held in bar3 (current hitpoints / maximum hitpoints),
and nonlethal damage is held in bar1 (nonlethal damage received). A brown status
symbol means the token is moderately wounded (taken 1/3 damage), a red one means
they are heavily wounded (2/3 damage). See the **PfCombat** API for details on this.
Green means that they are on negative hitpoints but stabilised.

Other status icons are used as follows:

| Status       | Meaning             | Description |
| ------------ | ------------------- | ----------- |
| brown        | Moderately wounded. | 2/3 hitpoints or fewer. |
| red          | Heavily wounded.    | 1/3 hitpoints or fewer. |
| green        | Stablised.          | On negative hitpoints, but not bleeding. |
| skull        | Unconscious.        | Negative hitpoints and unconscious. |
| dead         | Dead.               | Creature is dead, destroyed or dispersed. |
| bleeding-eye | Blind.              | |
| screaming    | Confused.           | |
| overdrive    | Dazzled             | |
| fishing-net  | Entangled.          | |
| sleepy       | Exhausted.          | |
| half-haze    | Fatigued.           | |
| broken-heart | Frightened.         | |
| padlock      | Grappled.           | |
| radioactive  | Nauseated           | |
| half-heart   | Panicked.           | |
| Cobweb       | Paralyzed.          | |
| chained-heart| Shaken.             | |
| arrowed      | Prone.              | |
| drink-me     | Sickened.           | |
| pummeled     | Staggered.          | On zero hitpoints. |
| interdiction | Stunned.            | |
| fist         | Power Attack.       | Just used to aid in memory. |

The **PfCombat** API will set some of these automatically. A summery of
the Pathfinder rules for the condition will be provided for tokens that
have the right status set.

Character Notes
---------------

If the `GMNotes` field of the character is set, then the contents of this
will be output as a text block beneath the status values. This means the
notes field should be limited in length so as not to overwhelm the output.

Token Notes
-----------

Notes can be placed in the `GMNotes` field of the token, and these are
displayed at the bottom. Only text within !! delimiters will be displayed.
This is so other information can be stored here.

For example:
``
!!This orc is carrying a +2 sword!!
Orc witnessed the event so if captured alive will be able to
give information.
```

Will cause just ``This orc is carrying a +2 sword`` to be output in the
info block.
