import defaultCoefficients from './config/coefficients.json'
import { find, somethingIsWrong } from './utils.js'
import getFactors from './factor-extractor.js'

class ThresholdsService {
  constructor ($q, smartId, lgasService, statesService, locationsService) {
    this.$q = $q
    this.smartId = smartId
    this.lgasService = lgasService
    this.statesService = statesService
    this.locationsService = locationsService
  }

  // Passing the coefficientVersions as a param so that it can be adapted later to use the database doc
  calculateThresholds (location, stockCount, products, productCoefficients = defaultCoefficients) {
    if (!stockCount) {
      const locationId = location && location._id ? location._id : 'with unknown id'
      return somethingIsWrong(`missing mandatory param stock count for location ${locationId}`)
    }
    if (!stockCount.date) {
      return somethingIsWrong(`missing date on stock count ${stockCount._id}`)
    }

    if (!location) {
      const stockCountId = stockCount && stockCount._id ? stockCount._id : 'with unknown id'
      return somethingIsWrong(`missing mandatory param location for stock count ${stockCountId}`)
    }
    if (!location.level) {
      return somethingIsWrong(`missing level on location ${location._id}`)
    }

    if (!(products && products.length)) {
      return somethingIsWrong('missing mandatory param products')
    }

    let locationFactors
    try {
      locationFactors = getFactors(location, productCoefficients, stockCount.date)
    } catch (e) {
      somethingIsWrong(e.message)
      return
    }

    const { weeksOfStock, weeklyLevels, monthlyTargetPopulations } = locationFactors

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
        return productThresholds
      }, {})

      index[productId].weeklyLevel = weeklyLevel

      if (monthlyTargetPopulations) { // old zone docs have no target population
        index[productId].targetPopulation = monthlyTargetPopulations[productId]
      }

      return index
    }, {})
  }

  getThresholdsFor (stockCounts, products, productCoefficients = defaultCoefficients) {
    const isId = (id, item) => item._id === id

    // TODO: make it work for zones too.
    const locationIdPattern = 'zone:?state:?lga'
    let index = {}
    let promises = {}

    index = stockCounts.reduce((index, stockCount) => {
      let scLocation = stockCount.location
      if (!scLocation) {
        return index
      }

      let id

      if (scLocation.national) {
        id = 'national'
        index[id] = { date: stockCount.date }
        index[id].type = 'national'

        if (!promises.national) {
          promises.national = this.locationsService.get('national')
        }
      } else {
        id = this.smartId.idify(scLocation, locationIdPattern)
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
      }

      return index
    }, {})

    const addThresholds = (promisesRes) => {
      Object.keys(index).forEach((key) => {
        const item = index[key]
        let location
        if (item.type === 'national') {
          location = promisesRes[item.type]
        } else {
          location = find(promisesRes[item.type], isId.bind(null, key))
        }
        item.thresholds = this.calculateThresholds(location, item, products, productCoefficients)
        delete item.type
      })

      return index
    }

    return this.$q.all(promises)
      .then(addThresholds)
  }
}

ThresholdsService.$inject = ['$q', 'smartId', 'lgasService', 'statesService', 'locationsService']

export default ThresholdsService
