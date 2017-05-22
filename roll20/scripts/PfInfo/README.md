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


