'use strict'

describe('thresholds service', function () {
  var $rootScope
  var thresholdsService
  var angularNavDataMock // eslint-disable-line
  var testMod // eslint-disable-line

  beforeEach(function () {
    angularNavDataMock = angular.module('angularNavData', [])
      .service('lgasService', function ($q) {
        this.list = function () {
          var lga = angular.extend({}, factors, { _id: 'zone:nc:state:kogi:lga:adavi', level: 'lga' })
          return $q.when([lga])
        }
      })
      .service('statesService', function ($q) {
        this.list = function () {
          var state = angular.extend({}, factors, { _id: 'zone:nc:state:kogi', level: 'state' })
          return $q.when([state])
        }
      })
    testMod = angular.module('testMod', ['angularNavData', 'angularNavThresholds'])
  })

  beforeEach(module('testMod'))

  beforeEach(inject(function (_$rootScope_, _thresholdsService_) {
    thresholdsService = _thresholdsService_
    $rootScope = _$rootScope_
  }))

  var factors = {
    targetPopulations: [
      {
        version: 1,
        date: '2016-01-06', // ISO week: 2016-W01
        monthlyTargetPopulations: {
          'product:mv': 100,
          'product:yf': 400,
          'product:5-reconst-syg': 500
        }
      },
      {
        version: 2,
        date: '2016-01-15', // ISO week: 2016-W02
        monthlyTargetPopulations: {
          'product:mv': 200,
          'product:yf': 800,
          'product:5-reconst-syg': 1000
        }
      }
    ],
    plans: [
      {
        version: 1,
        date: '2016-01-06', // ISO week: 2016-W01
        weeksOfStock: {
          max: 5,
          reOrder: 2,
          min: 1
        }
      },
      {
        version: 2,
        date: '2016-01-20', // ISO week: 2016-W03
        weeksOfStock: {
          max: 10,
          reOrder: 4,
          min: 2
        }
      }
    ]
  }

  var productCoefficients = { // eslint-disable-line
    versions: [
      {
        version: 1,
        date: '2016-01-06', // ISO week: 2016-W01
        coefficients: {
          'product:mv': {
            wastage: 2,
            coverage: 0.5,
            doses: 2
          },
          'product:yf': {
            wastage: 1,
            coverage: 1,
            doses: 1
          },
          'product:5-reconst-syg': {
            wastage: 2
          }
        }
      },
      {
        version: 2,
        date: '2016-01-15', // ISO week: 2016-W02
        coefficients: {
          'product:mv': {
            wastage: 2,
            coverage: 0.5,
            doses: 4
          },
          'product:yf': {
            wastage: 1,
            coverage: 1,
            doses: 1
          },
          'product:5-reconst-syg': {
            wastage: 4
          }
        }
      }
    ]
  }

  var products = [
    // TODO: presentation should be ints
    { _id: 'product:mv', presentation: '10' },
    { _id: 'product:yf', presentation: '2' },
    { _id: 'product:5-reconst-syg', presentation: '1' }
  ]

  function getLocation (level) {
    return angular.extend({}, factors, { level: level })
  }

  function expectedThresholdsFor (versions, coefficientsVersion) {
    var weeklyLevels = products.reduce(function (index, product) {
      var coefficients = coefficientsVersion[product._id] || {}
      var weeklyLevel
      if (product._id === 'product:5-reconst-syg') {
        weeklyLevel = (index['product:mv'] + index['product:yf']) / 10 * coefficients.wastage
      } else {
        weeklyLevel = versions.targetPopulations.monthlyTargetPopulations[product._id] / 4 *
          coefficients.wastage * coefficients.coverage * coefficients.doses
      }
      index[product._id] = weeklyLevel
      return index
    }, {})
    return products.reduce(function (index, product) {
      index[product._id] = Object.keys(versions.plans.weeksOfStock).reduce(function (thresholds, key) {
        thresholds[key] = versions.plans.weeksOfStock[key] * weeklyLevels[product._id]
        return thresholds
      }, {})
      index[product._id].weeklyLevel = weeklyLevels[product._id]
      index[product._id].targetPopulation = versions.targetPopulations.monthlyTargetPopulations[product._id]
      return index
    }, {})
  }

  describe('calculateThresholds', function () {
    it('takes a location and a stockCount and returns the min, reOrder, max thresholds', function () {
      // plans: version 1, targetPopulations: version 2, coefficients: version 2
      var stockCount = { date: { year: 2016, week: 2 } }
      var versions = {
        plans: factors.plans[0],
        targetPopulations: factors.targetPopulations[1]
      }
      var expected = expectedThresholdsFor(versions, productCoefficients.versions[1].coefficients)
      var actual = thresholdsService.calculateThresholds(getLocation('lga'), stockCount, products, null, productCoefficients)
      expect(actual).toEqual(expected)
    })
    it('defaults to the oldest factor version if the doc is too old to have a matching one', function () {
      var stockCount = { date: { year: 2016, week: 2 } }
      var plans = [
        {
          version: 1,
          date: '2016-02-01', // ISO week: 2016-W01
          weeksOfStock: {
            max: 5,
            reOrder: 2,
            min: 1
          }
        },
        {
          version: 2,
          date: '2016-03-01', // ISO week: 2016-W03
          weeksOfStock: {
            max: 10,
            reOrder: 4,
            min: 2
          }
        }
      ]
      var location = angular.extend({}, getLocation('lga'), { plans: plans })
      var versions = {
        plans: plans[0], // chooses version 1 for plans
        targetPopulations: factors.targetPopulations[1]
      }
      var expected = expectedThresholdsFor(versions, productCoefficients.versions[1].coefficients)
      var actual = thresholdsService.calculateThresholds(location, stockCount, products, null, productCoefficients)
      expect(actual).toEqual(expected)
    })
    it('works for zones when a required allocation for zone state stores is provided', function () {
      // plans: version 1, targetPopulations: version 2, coefficients: version 2
      var stockCount = { date: { year: 2016, week: 2 } }
      var requiredStatesStoresAllocation = { 'product:mv': 20 }
      var versions = {
        plans: factors.plans[0],
        targetPopulations: factors.targetPopulations[1]
      }

      var expected = expectedThresholdsFor(versions, productCoefficients.versions[1].coefficients)

      // Should add '20' to all product:mv thresholds
      expected['product:mv'].max = expected['product:mv'].max + 20
      expected['product:mv'].min = expected['product:mv'].min + 20
      expected['product:mv'].reOrder = expected['product:mv'].reOrder + 20

      var actual = thresholdsService.calculateThresholds(getLocation('zone'), stockCount, products, requiredStatesStoresAllocation, productCoefficients)
      expect(actual).toEqual(expected)
    })
    it('works for zones when no required allocations are provided', function () {
      // plans: version 1, targetPopulations: version 2, coefficients: version 2
      var stockCount = { date: { year: 2016, week: 2 } }
      var versions = {
        plans: factors.plans[0],
        targetPopulations: factors.targetPopulations[1]
      }
      var expected = expectedThresholdsFor(versions, productCoefficients.versions[1].coefficients)
      var actual = thresholdsService.calculateThresholds(getLocation('zone'), stockCount, products, {}, productCoefficients)
      expect(actual).toEqual(expected)
    })
    it('rounds allocations up to the product presentation', function () {
      // plans: version 1, targetPopulations: version 2, coefficients: 2
      var stockCount = { date: { year: 2016, week: 2 } }
      var unroundedLocation = angular.extend({}, getLocation('lga'), {
        targetPopulations: [
          {
            version: 2,
            date: '2016-01-15', // ISO week: 2016-W02
            monthlyTargetPopulations: {
              'product:mv': 196,
              'product:yf': 796,
              'product:5-reconst-syg': 995
            }
          }
        ]
      })
      var expected = {
        'product:mv': {
          min: 200,
          reOrder: 400,
          max: 980,
          targetPopulation: 196,
          weeklyLevel: 196
        },
        'product:yf': {
          min: 200,
          reOrder: 398,
          max: 996,
          targetPopulation: 796,
          weeklyLevel: 199
        },
        'product:5-reconst-syg': {
          min: 158, // (weeklyLevel yf + weeklyLevel mv)/10 * coverage
          reOrder: 316,
          max: 790,
          targetPopulation: 995,
          weeklyLevel: 158
        }
      }
      var actual = thresholdsService.calculateThresholds(unroundedLocation, stockCount, products, {}, productCoefficients)
      expect(actual).toEqual(expected)
    })
    it('works if the monthly target population for a particular product is 0', function () {
      // plans: version 1, targetPopulations: version 2, coefficients: 2
      var stockCount = { date: { year: 2016, week: 2 } }
      var location = angular.extend({}, getLocation('lga'), {
        targetPopulations: [
          {
            version: 2,
            date: '2016-01-15', // ISO week: 2016-W02
            monthlyTargetPopulations: {
              'product:mv': 0,
              'product:yf': 800,
              'product:5-reconst-syg': 1000
            }
          }
        ]
      })
      var versions = {
        plans: factors.plans[0],
        targetPopulations: location.targetPopulations[0]
      }
      var expected = expectedThresholdsFor(versions, productCoefficients.versions[1].coefficients)
      var actual = thresholdsService.calculateThresholds(location, stockCount, products, null, productCoefficients)
      expect(actual).toEqual(expected)
    })
    // In old docs `targetPopulations` doesn't exist and the `weeklyLevels` aren't necessarily calculated based on the targetPopulation
    // so we can't use the calculation based on coefficients
    it('is backwards compatible with location docs containing a targetPopulation instead of targetPopulations field)', function () {
      // plans: version 1, targetPopulations: version 1, allocations: version 1
      var stockCount = { date: { year: 2016, week: 1 } }
      var oldStyleLocation = {
        level: 'lga',
        allocations: [
          { version: 1,
            date: '2016-01-06', // ISO week: 2016-W01
            weeklyLevels: {
              'product:mv': 50,
              'product:yf': 100,
              'product:5-reconst-syg': 30
            }
          }
        ],
        plans: [
          {
            version: 1,
            date: '2016-01-06', // ISO week: 2016-W01
            weeksOfStock: {
              max: 5,
              reOrder: 2,
              min: 1
            }
          }
        ],
        targetPopulation: {
          'product:mv': 100,
          'product:yf': 400,
          'product:5-reconst-syg': 500
        }
      }
      var expected = {
        'product:mv': { min: 50, reOrder: 100, max: 250, targetPopulation: 100, weeklyLevel: 50 },
        'product:yf': { min: 100, reOrder: 200, max: 500, targetPopulation: 400, weeklyLevel: 100 },
        'product:5-reconst-syg': { min: 30, reOrder: 60, max: 150, targetPopulation: 500, weeklyLevel: 30 }
      }
      var actual = thresholdsService.calculateThresholds(oldStyleLocation, stockCount, products)
      expect(actual).toEqual(expected)
    })
    // The dynamic calculation doesn't work with the first version of targetPopulations since those
    // targetPopulations are wrong for states. Instead thresholds are based on `weeklyLevels`.
    it('calculates thresholds based on weeklyLevels if `targetPopulations` is at version 1)', function () {
      // plans: version 1, targetPopulations: version 1, allocations: version 1
      var stockCount = { date: { year: 2016, week: 1 } }
      var location = angular.extend({}, getLocation('lga'), {
        level: 'lga',
        allocations: [
          { version: 1,
            date: '2016-01-06', // ISO week: 2016-W01
            weeklyLevels: {
              'product:mv': 50,
              'product:yf': 100,
              'product:5-reconst-syg': 30
            }
          }
        ]
      })
      var expected = {
        'product:mv': { min: 50, reOrder: 100, max: 250, targetPopulation: 100, weeklyLevel: 50 },
        'product:yf': { min: 100, reOrder: 200, max: 500, targetPopulation: 400, weeklyLevel: 100 },
        'product:5-reconst-syg': { min: 30, reOrder: 60, max: 150, targetPopulation: 500, weeklyLevel: 30 }
      }
      var actual = thresholdsService.calculateThresholds(location, stockCount, products)
      expect(actual).toEqual(expected)
    })
    it('still works if the location doc has no targetPopulation or targetPopulations field, using weeklyLevels', function () {
      // plans: version 1, targetPopulations: version 1, allocations: version 1
      var stockCount = { date: { year: 2016, week: 1 } }
      var oldStyleLocation = {
        level: 'lga',
        allocations: [
          { version: 1,
            date: '2016-01-06', // ISO week: 2016-W01
            weeklyLevels: {
              'product:mv': 50,
              'product:yf': 100,
              'product:5-reconst-syg': 30
            }
          }
        ],
        plans: [
          {
            version: 1,
            date: '2016-01-06', // ISO week: 2016-W01
            weeksOfStock: {
              max: 5,
              reOrder: 2,
              min: 1
            }
          }
        ]
      }
      var expected = {
        'product:mv': { min: 50, reOrder: 100, max: 250, weeklyLevel: 50 },
        'product:yf': { min: 100, reOrder: 200, max: 500, weeklyLevel: 100 },
        'product:5-reconst-syg': { min: 30, reOrder: 60, max: 150, weeklyLevel: 30 }
      }
      var actual = thresholdsService.calculateThresholds(oldStyleLocation, stockCount, products)
      expect(actual).toEqual(expected)
    })
  })

  describe('getThresholdsFor', function () {
    it('takes an array of objects with location, allocations and plans fields and returns an object of location thresholds', function (done) {
      var stockCounts = [ // Note: it doesn't work yet with zones
        { location: { zone: 'nc', state: 'kogi' }, date: { year: 2016, week: 2 } },
        { location: { zone: 'nc', state: 'kogi', lga: 'adavi' }, date: { year: 2016, week: 3 } }
      ]
      var expected = {
        'zone:nc:state:kogi': {
          date: { year: 2016, week: 2 },
          thresholds: expectedThresholdsFor({
            plans: factors.plans[0],
            targetPopulations: factors.targetPopulations[1]
          }, productCoefficients.versions[1].coefficients)
        },
        'zone:nc:state:kogi:lga:adavi': {
          date: { year: 2016, week: 3 },
          thresholds: expectedThresholdsFor({
            plans: factors.plans[1],
            targetPopulations: factors.targetPopulations[1]
          }, productCoefficients.versions[1].coefficients)
        }
      }

      thresholdsService.getThresholdsFor(stockCounts, products, productCoefficients)
        .then(function (thresholds) {
          expect(thresholds).toEqual(expected)
        })
      $rootScope.$digest()
      done()
    })
  })
})
