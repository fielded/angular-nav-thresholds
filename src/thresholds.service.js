// TODO: replace with Array#find ponyfill
const find = (list, match) => {
  for (let i = 0; i < list.length; i++) {
    if (match(list[i])) {
      return list[i]
    }
  }
  return undefined
}

const isVersion = (version, item) => item.version === version

const isId = (id, item) => item._id === id

// Zones config
const zonePlans = {
  weeksOfStock: {
    min: 0,
    reOrder: 3,
    max: 6
  }
}

const getFactorVersion = (stockCount, factor, options) => {
  if (options.version === 'last') {
    return options.version
  }
  if (!(stockCount[factor] && stockCount[factor].version)) {
    return 1
  }
  return stockCount[factor].version
}

const getFactor = (location, versions, version) => {
  if (version === 'last') {
    return versions[versions.length - 1]
  }

  return find(versions, isVersion.bind(null, version))
}

const getFactors = (stockCount, location, options) => {
  if (!(location.allocations && location.allocations.length)) {
    return {}
  }

  if (location.level !== 'zone' && !(location.plans && location.plans.length)) {
    return {}
  }

  if (!(location.targetPopulation && location.targetPopulation.length)) {
    return {}
  }
  const allocationsVersion = getFactorVersion(stockCount, 'allocations', options)
  const plansVersion = getFactorVersion(stockCount, 'plans', options)
  const targetPopulationVersion = getFactorVersion(stockCount, 'targetPopulation', options)

  if (typeof allocationsVersion === 'undefined' ||
    typeof plansVersion === 'undefined' ||
    typeof targetPopulationVersion === 'undefined'
  ) {
    return {}
  }

  const allocation = getFactor(location, location.allocations, allocationsVersion)
  const targetPopulation = getFactor(location, location.targetPopulation, targetPopulationVersion)

  let plans = zonePlans
  if (location.level !== 'zone') {
    plans = getFactor(location, location.plans, plansVersion)
  }

  return {
    weeklyLevels: allocation && allocation.weeklyLevels,
    weeksOfStock: plans && plans.weeksOfStock,
    targetPopulation: targetPopulation && targetPopulation.targetPopulation
  }
}

class ThresholdsService {
  constructor ($q, smartId, lgasService, statesService) {
    this.$q = $q
    this.smartId = smartId
    this.lgasService = lgasService
    this.statesService = statesService
  }

  // For zones the thresholds are based on the state store required allocation for
  // the week, that information is passed as an optional param (`requiredStateStoresAllocation`).
  // That param is only used for zones.
  calculateThresholds (location, stockCount, products, requiredStateStoresAllocation = {}, options = {}) {
    if (!stockCount) {
      return
    }

    if (!location && location.level) {
      return
    }

    if (!products || !products.length) {
      return
    }

    const { weeklyLevels, weeksOfStock, targetPopulation } = getFactors(stockCount, location, options)

    if (!(weeklyLevels && weeksOfStock && targetPopulation)) {
      return
    }

    let thresholds = Object.keys(weeklyLevels).reduce((index, productId) => {
      index[productId] = Object.keys(weeksOfStock).reduce((productThresholds, threshold) => {
        const level = weeklyLevels[productId] * weeksOfStock[threshold]
        const product = find(products, isId.bind(null, productId))

        // Default rounding used in VSPMD and highest possible presentation
        let presentation = 20

        if (product && product.presentation) {
          // TODO: product presentations should be ints, not strings
          presentation = parseInt(product.presentation, 10)
        }

        const roundedLevel = Math.ceil(level / presentation) * presentation
        productThresholds[threshold] = roundedLevel

        if (location.level === 'zone' && requiredStateStoresAllocation[productId]) {
          productThresholds[threshold] += requiredStateStoresAllocation[productId]
        }

        return productThresholds
      }, {})

      index[productId].targetPopulation = targetPopulation[productId]

      return index
    }, {})

    return thresholds
  }

  getThresholdsFor (stockCounts, products) {
    // TODO: make it work for zones too.
    // For making it work with zones, we need to take into account the amount of stock
    // to be allocated to the zone state stores in a particular week
    const locationIdPattern = 'zone:?state:?lga'
    let index = {}
    let promises = {}

    index = stockCounts.reduce((index, stockCount) => {
      let scLocation = stockCount.location
      if (!scLocation) {
        return index
      }

      const id = this.smartId.idify(scLocation, locationIdPattern)
      const allocations = stockCount.allocations || { version: 1 }
      const plans = stockCount.plans || { version: 1 }
      const targetPopulation = stockCount.targetPopulation || { version: 1 }
      index[id] = angular.merge({}, { allocations: allocations, plans: plans, targetPopulation: targetPopulation })

      if (scLocation.lga) {
        if (!promises.lga) {
          promises.lga = this.lgasService.list()
        }
        index[id].type = 'lga'
      } else if (scLocation.state) {
        if (!promises.state) {
          promises.state = this.statesService.list()
        }
        index[id].type = 'state'
      }

      return index
    }, {})

    const addThresholds = (promisesRes) => {
      Object.keys(index).forEach((key) => {
        const item = index[key]
        const location = find(promisesRes[item.type], isId.bind(null, key))
        item.thresholds = this.calculateThresholds(location, item, products)
        delete item.type
      })

      return index
    }

    return this.$q.all(promises)
      .then(addThresholds)
  }
}

ThresholdsService.$inject = ['$q', 'smartId', 'lgasService', 'statesService']

export default ThresholdsService
