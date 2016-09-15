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
const zonesPlan = {
  min: 0,
  reOrder: 3,
  max: 6
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
  calculateThresholds (location, stockCount, products, requiredStateStoresAllocation = {}) {
    if (!location || !location.allocations || !location.plans || !location.level) {
      return
    }

    if (!stockCount || !stockCount.allocations || !stockCount.allocations.version ||
        !stockCount.plans || !stockCount.plans.version) {
      return
    }

    if (!products || !products.length) {
      return
    }

    const allocation = find(location.allocations, isVersion.bind(null, stockCount.allocations.version))
    if (!(allocation && allocation.weeklyLevels)) {
      return
    }

    const weeklyLevels = allocation.weeklyLevels
    let weeksOfStock = zonesPlan

    if (location.level !== 'zone') {
      const plan = find(location.plans, isVersion.bind(null, stockCount.plans.version))
      if (!(plan && plan.weeksOfStock)) {
        return
      }
      weeksOfStock = plan.weeksOfStock
    }

    let thresholds = Object.keys(weeklyLevels).reduce((index, productId) => {
      index[productId] = Object.keys(weeksOfStock).reduce((productThresholds, threshold) => {
        const level = weeklyLevels[productId] * weeksOfStock[threshold]
        const product = find(products, isId.bind(null, productId))
        if (!product || !product.presentation) {
          return productThresholds
        }
        // TODO: product presentations should be ints, not strings
        const presentation = parseInt(product.presentation, 10)

        const roundedLevel = Math.ceil(level / presentation) * presentation
        productThresholds[threshold] = roundedLevel

        if (location.level === 'zone' && requiredStateStoresAllocation[productId]) {
          productThresholds[threshold] += requiredStateStoresAllocation[productId]
        }

        return productThresholds
      }, {})

      if (location.targetPopulation) {
        index[productId].targetPopulation = location.targetPopulation[productId]
      }

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
      index[id] = angular.merge({}, { allocations: allocations, plans: plans })

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
