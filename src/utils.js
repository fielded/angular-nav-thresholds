// TODO: replace with Array#find ponyfill
export function find (list, match) {
  for (let i = 0; i < list.length; i++) {
    if (match(list[i])) {
      return list[i]
    }
  }
  return undefined
}
