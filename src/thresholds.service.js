const find = (list, match) => {
  for (let i = 0; i < list.length; i++) {
    if (match(list[i])) {
      return list[i]
    }
  }
  return undefined
}

const isVersion = (version, item) => {
  return item.version === version
}

class ThresholdsService {
  calculateThresholds (location, stockCount) {
    if (!location || !location.allocations || !location.plans) {
      return
    }

    if (!stockCount || !stockCount.allocations || !stockCount.allocations.version ||
        !stockCount.plans || !stockCount.plans.version) {
      return
    }

    const weeklyLevels = find(location.allocations, isVersion.bind(null, stockCount.allocations.version)).weeklyLevels
    const weeksOfStock = find(location.plans, isVersion.bind(null, stockCount.plans.version)).weeksOfStock

    let thresholds = Object.keys(weeklyLevels).reduce((index, product) => {
      index[product] = Object.keys(weeksOfStock).reduce((productThresholds, threshold) => {
        productThresholds[threshold] = Math.round(weeklyLevels[product] * weeksOfStock[threshold])
        return productThresholds
      }, {})
      return index
    }, {})

    return thresholds
  }
}

export default ThresholdsService
