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
  // centralized for whenever we implement #16
  const somethingIsWrong = () => undefined

  const getWeeklyLevels = () => {
    if (!(location.allocations && location.allocations.length)) {
      somethingIsWrong()
    }

    const allocationsVersion = getFactorVersion(stockCount, 'allocations', options)

    if (typeof allocationsVersion === 'undefined') {
      somethingIsWrong()
    }

    const allocations = getFactor(location, location.allocations, allocationsVersion)
    return allocations && allocations.weeklyLevels
  }

  const getWeeksOfStock = () => {
    if (location.level !== 'zone' && !(location.plans && location.plans.length)) {
      somethingIsWrong()
    }

    const plansVersion = getFactorVersion(stockCount, 'plans', options)

    if (typeof plansVersion === 'undefined') {
      somethingIsWrong()
    }

    let plans = zonePlans
    if (location.level !== 'zone') {
      plans = getFactor(location, location.plans, plansVersion)
    }

    return plans && plans.weeksOfStock
  }

  const getMonthlyTargetPopulations = () => {
    let monthlyTargetPopulations
    if (location.targetPopulations) {
      if (!location.targetPopulations.length) {
        somethingIsWrong()
      }
      const targetPopulationVersion = getFactorVersion(stockCount, 'targetPopulations', options)

      if (typeof targetPopulationVersion === 'undefined') {
        somethingIsWrong()
      }

      const targetPopulations = getFactor(location, location.targetPopulations, targetPopulationVersion)
      monthlyTargetPopulations = targetPopulations && targetPopulations.monthlyTargetPopulations
    } else {
      // For backwards compatibility with the old style location docs,
      // since we have no control about when the dashboards are going
      // to replicate the new location docs
      if (!(location.targetPopulation && location.targetPopulation.length)) {
        somethingIsWrong()
      }
      monthlyTargetPopulations = location.targetPopulation
    }
    return monthlyTargetPopulations
  }

  return {
    weeksOfStock: getWeeksOfStock(),
    weeklyLevels: getWeeklyLevels(),
    targetPopulations: getMonthlyTargetPopulations()
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

    const { weeklyLevels, weeksOfStock, targetPopulations } = getFactors(stockCount, location, options)

    if (!(weeklyLevels && weeksOfStock && targetPopulations)) {
      return
    }

    return Object.keys(weeklyLevels).reduce((index, productId) => {
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

      index[productId].targetPopulation = targetPopulations[productId]

      return index
    }, {})
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
      const targetPopulations = stockCount.targetPopulations || { version: 1 }
      index[id] = angular.merge({}, {
        allocations,
        plans,
        targetPopulations
      })

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
