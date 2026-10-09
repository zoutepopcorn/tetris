const KEY = 'tetris-pocket.highscore.v1'
export function readHighscore(storage) {
  try {
    const value = Number(storage.getItem(KEY))
    return Number.isSafeInteger(value) && value >= 0 ? value : 0
  } catch { return 0 }
}
export function saveHighscore(storage, value) {
  try {
    const best = Math.max(readHighscore(storage), Math.floor(value))
    if (!Number.isSafeInteger(best) || best < 0) return false
    storage.setItem(KEY, String(best))
    return true
  } catch { return false }
}
export { KEY as HIGHSCORE_KEY }
