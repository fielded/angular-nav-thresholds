/* global moment:false */
import config from './config/config.json'

// TODO: replace with Array#find ponyfill
const find = (list, match) => {
  for (let i = 0; i < list.length; i++) {
    if (match(list[i])) {
      return list[i]
    }
  }
  return undefined
}

const isVersion = (date, version) => {
  const momentDate = moment().isoWeekYear(date.year).isoWeek(date.week).isoWeekday(1).startOf('day')
  const momentVersionStartDate = moment(version.date, config.versionDateFormat).startOf('isoWeek').startOf('day')
  return momentDate.isSameOrAfter(momentVersionStartDate)
}

const isId = (id, item) => item._id === id

const getFactor = (versions, date) => {
  const reverseVersions = versions.slice(0).reverse()
  const factor = find(reverseVersions, isVersion.bind(null, date))
  // If the doc is too old to have a matching version, default to the oldest one
  if (!factor) {
    return versions[0]
  }
  return factor
}

const getFactors = (stockCount, location) => {
  // centralized for whenever we implement #16
  const somethingIsWrong = () => undefined

  const getWeeklyLevels = () => {
    if (!(location.allocations && location.allocations.length)) {
      somethingIsWrong()
    }

    const allocations = getFactor(location.allocations, stockCount.date)
    return allocations && allocations.weeklyLevels
  }

  const getWeeksOfStock = () => {
    if (!(location.plans && location.plans.length)) {
      somethingIsWrong()
    }

    const plans = getFactor(location.plans, stockCount.date)
    return plans && plans.weeksOfStock
  }

  const getMonthlyTargetPopulations = () => {
    let monthlyTargetPopulations
    if (location.targetPopulations) {
      if (!location.targetPopulations.length) {
        somethingIsWrong()
      }

      const targetPopulations = getFactor(location.targetPopulations, stockCount.date)
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
  calculateThresholds (location, stockCount, products, requiredStateStoresAllocation = {}) {
    if (!(stockCount && stockCount.date)) {
      return
    }

    if (!(location && location.level)) {
      return
    }

    if (!(products && products.length)) {
      return
    }

    const { weeklyLevels, weeksOfStock, targetPopulations } = getFactors(stockCount, location)

    if (!(weeklyLevels && weeksOfStock)) {
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

      if (targetPopulations) { // old (and new?) zone docs have no target population doc
        index[productId].targetPopulation = targetPopulations[productId]
      }

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
      index[id] = { date: stockCount.date }

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
