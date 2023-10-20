// my ip: 192.168.1.97
// port 80000
// telnet 192.168.1.97 8000
const REFRESH_RATE = 1000 / 15;
const server = Deno.listen({ port: 8000 });
const connections: Map<Deno.Conn, Player> = new Map();

const MAP_TILES = [
  `################################################################################`,
  `#           #                                                                  #`,
  `#   $       #                  $         $      #               $        $     #`,
  `#           #                        #          #        $                     #`,
  `#           #           $            #          #                              #`,
  `#        $  #                        #          #                $             #`,
  `#   $       #             $          ############                              #`,
  `#                                    #                  $                      #`,
  `#               $                    #          $               $              #`,
  `#        $            $              #                                    $    #`,
  `#     $                              #                                         #`,
  `#                 ########################           #####################     #`,
  `#       $                         $             $                              #`,
  `#                        $                                     $               #`,
  `################################################################################`,
];

enum Tile {
  Floor = ' ',
  Wall = '█',
  Snack = '$',
}
class GameMap {
  public tiles: Tile[][];
  public height: number;
  public width: number;

  constructor(mapDesign: string[]) {
    this.tiles = mapDesign.map((row) => row.split('').map(tile => {
      switch (tile) {
        case ' ': return Tile.Floor;
        case '#': return Tile.Wall;
        case '$': return Tile.Snack;
        default: throw new Error('We dont know what that is');
      }
    }));

    this.height = this.tiles.length;
    this.width = this.tiles[0].length;
  }
}

type Direction = 'up' | 'down' | 'right' | 'left';
class Player {
  public facing: Direction = 'up';
  public length = 5;
  public tail: number[][] = [];

  constructor(
    public name: string,
    public snakeBody: string,
    public x: number,
    public y: number,
  ) {}
}

const gameMap = new GameMap(MAP_TILES);

const gameLoop = () => {
  updateGameState();

  renderGame();
  setTimeout(gameLoop, REFRESH_RATE);
};

const updateGameState = () => {
  for (const [currentConnection, player] of connections) {
    player.tail = player.tail.slice(-player.length);
    let [newX, newY] = [player.x, player.y];

    if (player.facing === 'up') newY--;
    if (player.facing === 'down') newY++;
    if (player.facing === 'right') newX++;
    if (player.facing === 'left') newX--;

    const nextTile = gameMap.tiles[newY][newX];

    if (nextTile === Tile.Wall) continue;
    if (nextTile === Tile.Snack) {
      player.length++;
      gameMap.tiles[newY][newX] = Tile.Floor;
      let [newSnackX, newSnackY] = [0, 0];
      while (gameMap.tiles[newSnackY][newSnackX] !== Tile.Floor) {
        newSnackX = Math.floor(Math.random() * gameMap.width);
        newSnackY = Math.floor(Math.random() * gameMap.height);
      }
      gameMap.tiles[newSnackY][newSnackX] = Tile.Snack;
    }

    player.x = newX;
    player.y = newY;
    player.tail.push([player.x, player.y]);

    for (const [otherConnection, otherPlayer] of connections) {
      if (otherConnection === currentConnection) continue;

      for (const [x, y] of otherPlayer.tail) {
        if (x === player.x && y === player.y) {
          let winningPlayer = player;
          let losingConnection = otherConnection;

          if (otherPlayer.length > player.length) {
            winningPlayer = otherPlayer;
            losingConnection = currentConnection;
          }

          winningPlayer.length = Math.floor(winningPlayer.length / 2);
          losingConnection.write(new TextEncoder().encode('\nYou lose. Goodbye!\n'));
          losingConnection.close();
          connections.delete(losingConnection);
        }
      }
    }
  }
};

const colorizeTile = (tile: Tile) => {
  switch (tile) {
    case Tile.Wall: return `\x1b[2m${tile}\x1b[0m`;
    case Tile.Snack: return `\x1b[32m${tile}\x1b[0m`;
  }
  return tile;
};

const renderGame = () => {
  const encoder = new TextEncoder();
  const fullScreenMapBuffer = new Array(gameMap.height);

  for (let y = 0; y < gameMap.height; y++) {
    fullScreenMapBuffer[y] = new Array(gameMap.width);
    for (let x = 0; x < gameMap.width; x++) {
      fullScreenMapBuffer[y][x] = colorizeTile(gameMap.tiles[y][x]);
    }
  }

  for (const [_, player] of connections) {
    let idx = 0;
    for (const [x,y] of player.tail) {
      fullScreenMapBuffer[y][x] = idx++ % 2 === 0
        ? player.snakeBody.toUpperCase()
        : player.snakeBody.toLowerCase();
    }
    fullScreenMapBuffer[player.y][player.x] = player.snakeBody;
  }

  Deno.stdout.writeSync(encoder.encode('\x1b[2J\x1b[H'));
  Deno.stdout.writeSync(encoder.encode(fullScreenMapBuffer.map(row => row.join('')).join('\n')));

  for (const [conn, player] of connections) {
    const hudWidth = 32;
    const hudHeight = 12;

    const hudTop = player.y - hudHeight / 2;
    const hudLeft = player.x - hudWidth / 2;

    const hudBuffer = new Array(hudHeight);
    for (let y = 0; y < hudHeight; y++) {
      hudBuffer[y] = new Array(hudWidth);
      for (let x = 0; x < hudWidth; x++) {
        hudBuffer[y][x] = fullScreenMapBuffer[hudTop + y]?.[hudLeft + x] ?? ' ';
      }
    }

    hudBuffer[0][0] = '╔';
    hudBuffer[0][hudWidth - 1] = '╗';
    hudBuffer[hudHeight - 1][0] = '╚';
    hudBuffer[hudHeight - 1][hudWidth - 1] = '╝';

    for (let x = 1; x < hudWidth - 1; x++) {
      hudBuffer[0][x] = '═';
      hudBuffer[hudHeight - 1][x] = '═';
    }

    for (let y = 1; y < hudHeight - 1; y++) {
      hudBuffer[y][0] = '║';
      hudBuffer[y][hudWidth - 1] = '║';
    }

    conn.write(encoder.encode('\x1b[2J\x1b[H'));
    const hudHeader = `Player: ${player.name.padEnd(15)} Score: ${player.length}\n\n`;
    const hudFooter = ['Game Boy ', 'Unadvanced'].map(l => l.padStart(22)).join('\n');
    conn.write(encoder.encode(hudHeader));
    conn.write(encoder.encode(hudBuffer.map(row => row.join('')).join('\n')));
    conn.write(encoder.encode('\n\n'));
    conn.write(encoder.encode(hudFooter));
  }
};

gameLoop();

const snakeBodies = ['x', 'o', 'u', 'c', 'w'];

for await (const conn of server) {
  let [spawnX, spawnY] = [0, 0];

  while (gameMap.tiles[spawnY][spawnX] !== Tile.Floor) {
    spawnX = Math.floor(Math.random() * gameMap.width);
    spawnY = Math.floor(Math.random() * gameMap.height);
  }

  const player = new Player('Bob', snakeBodies[Math.floor(Math.random() * snakeBodies.length)], spawnX, spawnY);
  connections.set(conn, player);
  handleConn(conn, player);
}

async function handleConn(connection: Deno.Conn, player: Player) {
  connection.write(new Uint8Array([255, 253, 34]));
  const buffer = new Uint8Array(1024);

  while (true) {
    const read = await connection.read(buffer).catch(() => null);

    if (!read) {
      connections.delete(connection);
      break;
    }

    const msg = buffer.subarray(0, read);

    if (msg.byteLength !== 3) continue;
    if (msg[0] !== 27) continue;
    if (msg[1] !== 91) continue;

    if (msg[2] === 65) player.facing = 'up';
    if (msg[2] === 66) player.facing = 'down';
    if (msg[2] === 67) player.facing = 'right';
    if (msg[2] === 68) player.facing = 'left';
  }
}
