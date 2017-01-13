// TODO: replace with Array#find ponyfill
export function find (list, match) {
  for (let i = 0; i < list.length; i++) {
    if (match(list[i])) {
      return list[i]
    }
  }
  return undefined
}

export function somethingIsWrong (msg) {
  if (console) {
    console.warn(`angular-nav-thresholds: ${msg}`)
  }
  // TODO: log it to Google Analytics (#28)
}
