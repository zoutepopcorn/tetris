export function registerGameTools({ game, start, pause, resume, act, highscore, nextTick }, context = globalThis.document?.modelContext) {
  if (!context?.registerTool) return () => {}
  const lifecycle = new AbortController()
  const read = () => ({ status: game.status, score: game.score, highscore: highscore(), lines: game.lines, level: game.level, next: game.next, piece: game.piece ? { type: game.piece.type, x: game.piece.x, y: game.piece.y, rotation: game.piece.rotation } : null, board: game.board.map(row => [...row]) })
  const register = tool => {
    try { Promise.resolve(context.registerTool(tool, { signal: lifecycle.signal })).catch(() => {}) } catch { /* Optionele browser-API. */ }
  }
  register({
    name: 'read_tetris_game', title: 'Tetris-spel bekijken',
    description: 'Read the current board, active piece, score, local highscore and game state.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, untrustedContentHint: false },
    execute: input => { if (!input || Object.keys(input).length) throw new Error('No arguments accepted'); return read() },
  })
  register({
    name: 'control_tetris_game', title: 'Tetris besturen',
    description: 'Start a new game when ready or game over, pause, resume, or control the active piece. A drop locks the piece immediately.',
    inputSchema: { type: 'object', properties: { action: { type: 'string', enum: ['start', 'pause', 'resume', 'left', 'right', 'rotate', 'drop'] } }, required: ['action'], additionalProperties: false },
    annotations: { readOnlyHint: false, untrustedContentHint: false },
    async execute(input) {
      const action = input?.action
      if (!input || Object.keys(input).length !== 1 || !['start', 'pause', 'resume', 'left', 'right', 'rotate', 'drop'].includes(action)) throw new Error('Invalid action')
      if (action === 'start') {
        if (!['ready', 'over'].includes(game.status)) throw new Error('A game is already in progress')
        start()
      } else if (action === 'pause') {
        if (game.status !== 'playing') throw new Error('The game is not playing')
        pause()
      } else if (action === 'resume') {
        if (game.status !== 'paused') throw new Error('The game is not paused')
        resume()
      } else {
        if (!game.canAct) throw new Error('No active piece is available')
        if (action === 'left' || action === 'right') act('move', action === 'left' ? -1 : 1)
        else act(action === 'drop' ? 'hardDrop' : 'rotate')
      }
      await nextTick()
      return read()
    },
  })
  return () => lifecycle.abort()
}
