# `snakes`

Snakes game, but you battle it out with other players. and the client is just telnet

### Telnet server-2-client negotiations

References: https://pcmicro.com/netfoss/telnet.html

**Character Mode**

IAC DO LINEMODE
Bytes: [255, 253, 34]


### Control sequences

ASCII: https://www.ascii-code.com/
References: https://invisible-island.net/ncurses/terminfo.src.html

**ESC**: HEX `1b` OCTAL `033`

**Clear**: `2J`
**Home**: `H`
**Row + Column**: `<ROW>:<COL>H`
