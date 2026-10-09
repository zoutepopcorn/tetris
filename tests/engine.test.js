import test from 'node:test'
import assert from 'node:assert/strict'
import { TetrisGame, SHAPES, emptyBoard, pieceCells, rotateMatrix, confettiCount } from '../src/game/engine.js'
import { GestureController } from '../src/game/gestures.js'
import { readHighscore, saveHighscore, HIGHSCORE_KEY } from '../src/game/storage.js'
import { registerGameTools } from '../src/game/webmcp.js'

function fresh() { const game = new TetrisGame(() => 0.37); game.start(); game.drainEvents(); return game }
function setPiece(game, type, x, y, rotation = 0) {
  let matrix = SHAPES[type].map(row => [...row])
  for (let i = 0; i < rotation; i++) matrix = rotateMatrix(matrix)
  game.piece = { type, x, y, rotation, matrix }
}

test('elke zak bevat alle zeven blokken precies eenmaal', () => {
  const game = new TetrisGame()
  for (let bag = 0; bag < 30; bag++) {
    const pieces = Array.from({ length: 7 }, () => game.drawFromBag())
    assert.deepEqual([...pieces].sort(), Object.keys(SHAPES).sort())
  }
})

test('bewegen en draaien kunnen niet door de muur of een vast blok', () => {
  const game = fresh()
  setPiece(game, 'T', 0, 4)
  assert.equal(game.move(-1), false)
  game.board[5][3] = 'O'
  assert.equal(game.move(1), false)
  assert.equal(game.piece.x, 0)
  for (let i = 0; i < 10; i++) { game.rotate(); assert.ok(game.fits(game.piece)) }
})

test('vier draaien geven de oorspronkelijke vorm terug', () => {
  for (const type of ['I','J','L','S','T','Z']) {
    const game = fresh()
    setPiece(game, type, 3, 5)
    const before = structuredClone(game.piece)
    for (let i = 0; i < 4; i++) assert.equal(game.rotate(), true)
    assert.deepEqual(game.piece, before)
  }
})

test('SRS draait een I-blok vanaf de linkerwand weer het veld in', () => {
  const game = fresh()
  setPiece(game, 'I', -2, 5, 1)
  assert.ok(game.fits(game.piece))
  assert.equal(game.rotate(), true)
  assert.ok(game.fits(game.piece))
  assert.ok(pieceCells(game.piece).every(cell => cell.x >= 0))
})

test('SRS geeft een T-blok draairuimte op de bodem', () => {
  const game = fresh()
  setPiece(game, 'T', 3, 18)
  assert.ok(game.fits(game.piece))
  assert.equal(game.rotate(), true)
  assert.ok(game.fits(game.piece))
  assert.equal(game.piece.rotation, 1)
})

test('harde val eindigt op de ghost, telt punten en zet precies vier cellen vast', () => {
  const game = fresh()
  setPiece(game, 'O', 4, 0)
  const ghost = game.ghost()
  assert.equal(ghost.y, 18)
  const serial = game.serial
  game.hardDrop()
  assert.equal(game.score, 36)
  assert.equal(game.board.flat().filter(Boolean).length, 4)
  assert.equal(game.serial, serial + 1)
  assert.equal(game.board[19][4], 'O')
})

for (const count of [1,2,3,4]) test(`${count} lijnen verdwijnen tegelijk, met correcte punten en confetti`, () => {
  const game = fresh()
  game.board = emptyBoard()
  for (let y = 20 - count; y < 20; y++) game.board[y] = Array.from({length:10}, (_, x) => x === 4 ? null : 'J')
  setPiece(game, 'I', 2, 16, 1)
  game.hardDrop()
  assert.equal(game.clearedRows.length, count)
  assert.equal(game.lines, count)
  assert.equal(game.score, [0,100,300,500,800][count])
  const event = game.drainEvents().find(e => e.type === 'clear')
  assert.equal(event.count, count)
  assert.equal(confettiCount(count), [0,0,36,64,100][count])
  game.step(100); game.step(100)
  assert.equal(game.board.length, 20)
  assert.equal(game.board.flat().filter(Boolean).length, 4 - count)
  assert.equal(game.clearedRows.length, 0)
  assert.ok(game.piece)
})

test('niveau neemt toe na tien lijnen en versnelt de val', () => {
  const game = fresh(), before = game.gravity
  game.lines = 9
  game.board[19] = Array.from({ length: 10 }, (_, x) => x === 4 ? null : 'L')
  setPiece(game, 'I', 2, 16, 1)
  game.hardDrop()
  assert.equal(game.level, 2)
  assert.ok(game.gravity < before)
  assert.equal(game.score, 100)
})

test('pauze bevriest de val en de actieve clear-animatie', () => {
  const game = fresh()
  const before = structuredClone(game.piece)
  game.pause()
  for (let i = 0; i < 20; i++) game.step(100)
  assert.deepEqual(game.piece, before)
  assert.equal(game.move(1), false)
  assert.equal(game.hardDrop(), false)
  game.clearedRows = [19]; game.clearMs = 140
  game.step(100)
  assert.equal(game.clearMs, 140)
  game.resume(); game.step(100)
  assert.equal(game.clearMs, 40)
})

test('bodemvertraging laat verplaatsen toe maar stopt eindeloos uitstellen', () => {
  const game = fresh()
  setPiece(game, 'O', 4, 18)
  for (let i = 0; i < 4; i++) game.step(100)
  assert.ok(game.piece)
  game.move(1)
  assert.equal(game.lockMs, 0)
  for (let i = 0; i < 14; i++) game.move(i % 2 ? 1 : -1)
  assert.equal(game.lockResets, 15)
  game.step(100); game.move(-1)
  assert.equal(game.lockMs, 100)
  for (let i = 0; i < 4; i++) game.step(100)
  assert.equal(game.board.flat().filter(Boolean).length, 4)
})

test('geen ruimte om te starten geeft game over; opnieuw spelen wist de vorige ronde', () => {
  const game = fresh()
  game.board[0].fill('T'); game.board[1].fill('T')
  game.next = 'O'; game.spawn()
  assert.equal(game.status, 'over')
  game.start()
  assert.equal(game.status, 'playing')
  assert.equal(game.score, 0)
  assert.equal(game.board.flat().filter(Boolean).length, 0)
})

test('tik draait eenmaal; horizontale swipe schuift; omlaag valt maar één blok', () => {
  const events = []
  const gestures = new GestureController({ move: direction => events.push(['move', direction]), drop: () => events.push(['drop']), rotate: () => events.push(['rotate']) })
  gestures.begin(100,100,30,1); gestures.end(104,103,1)
  assert.deepEqual(events.splice(0), [['rotate']])
  gestures.begin(100,100,30,1); gestures.update(148,103,1); gestures.end(170,102,1)
  assert.deepEqual(events.splice(0), [['move',1],['move',1],['move',1]])
  gestures.begin(100,100,30,1); gestures.update(101,145,1); gestures.update(103,190,2); gestures.end(103,195,2)
  assert.deepEqual(events.splice(0), [['drop']])
})

test('afgebroken of oude aanraking bestuurt nooit het volgende blok', () => {
  let actions = 0
  const gesture = new GestureController({ move: () => actions++, rotate: () => actions++, drop: () => actions++ })
  gesture.begin(100,100,30,1); gesture.end(100,100,2)
  gesture.begin(100,100,30,2); gesture.cancel(); gesture.end(100,100,2)
  gesture.begin(100,100,30,2); gesture.update(100,75,2); gesture.end(100,100,2)
  assert.equal(actions,0)
})

test('highscore overleeft een nieuwe opslaglezer en wordt nooit lager', () => {
  const data = new Map()
  const storage = { getItem: key => data.get(key), setItem: (key, value) => data.set(key, value) }
  assert.equal(readHighscore(storage),0)
  assert.equal(saveHighscore(storage,950),true)
  saveHighscore(storage,200)
  assert.equal(readHighscore(storage),950)
  data.set(HIGHSCORE_KEY,'corrupt')
  assert.equal(readHighscore(storage),0)
  assert.equal(saveHighscore(undefined,500),false)
  assert.equal(readHighscore(undefined),0)
})

test('WebMCP-acties delen de spelstatus en weigeren ongeldige invoer', async () => {
  const tools = new Map(), game = new TetrisGame()
  let signal
  const cleanup = registerGameTools({game, start:()=>game.start(), pause:()=>game.pause(), resume:()=>game.resume(), act:(name,arg)=>game[name](arg), highscore:()=>123, nextTick:async()=>{}}, {registerTool(tool,options){tools.set(tool.name,tool);signal=options.signal}})
  assert.deepEqual([...tools.keys()],['read_tetris_game','control_tetris_game'])
  const control = tools.get('control_tetris_game'), read = tools.get('read_tetris_game')
  assert.equal(read.annotations.readOnlyHint,true)
  assert.equal(control.inputSchema.additionalProperties,false)
  assert.equal((await control.execute({action:'start'})).status,'playing')
  const x = game.piece.x
  await control.execute({action:'left'})
  assert.equal(read.execute({}).piece.x,x-1)
  await assert.rejects(control.execute({action:'reset'}),/Invalid/)
  await assert.rejects(control.execute({action:'start'}),/already/)
  await control.execute({action:'pause'})
  await assert.rejects(control.execute({action:'drop'}),/No active/)
  assert.equal(game.status,'paused')
  cleanup(); assert.equal(signal.aborted,true)
})
