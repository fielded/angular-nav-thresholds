import defaultCoefficients from './config/coefficients.json'
import { find } from './utils.js'
import transform from './location-transformer.js'

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
  //
  // Passing the coefficientVersions as a param so that it can be adapted later to use the database doc
  calculateThresholds (location, stockCount, products, requiredStateStoresAllocation = {}, productCoefficients = defaultCoefficients) {
    if (!(stockCount && stockCount.date)) {
      return
    }

    if (!(location && location.level)) {
      return
    }

    if (!(products && products.length)) {
      return
    }

    const transformedLocation = transform(location, productCoefficients, stockCount.date)

    if (!transformedLocation) {
      return
    }

    const { weeksOfStock, weeklyLevels, monthlyTargetPopulations } = transformedLocation

    return products.reduce((index, product) => {
      const productId = product._id
      const weeklyLevel = weeklyLevels[productId]

      // Default rounding used in VSPMD and highest possible presentation
      let presentation = 20

      if (product && product.presentation) {
        // TODO: product presentations should be ints, not strings
        presentation = parseInt(product.presentation, 10)
      }

      index[productId] = Object.keys(weeksOfStock).reduce((productThresholds, threshold) => {
        const level = weeklyLevel * weeksOfStock[threshold]
        const roundedLevel = Math.ceil(level / presentation) * presentation
        productThresholds[threshold] = roundedLevel

        if (transformedLocation.level === 'zone' && requiredStateStoresAllocation[productId]) {
          productThresholds[threshold] += requiredStateStoresAllocation[productId]
        }

        return productThresholds
      }, {})

      if (monthlyTargetPopulations) { // old zone docs have no target population
        index[productId].targetPopulation = monthlyTargetPopulations[productId]
      }

      return index
    }, {})
  }

  getThresholdsFor (stockCounts, products, productCoefficients = defaultCoefficients) {
    const isId = (id, item) => item._id === id

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
        item.thresholds = this.calculateThresholds(location, item, products, null, productCoefficients)
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
