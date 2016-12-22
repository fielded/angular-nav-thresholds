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
          'product:a': 25,
          'product:b': 100
        }
      },
      {
        version: 2,
        date: '2016-01-15', // ISO week: 2016-W02
        monthlyTargetPopulations: {
          'product:a': 50,
          'product:b': 200
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
          'product:a': {
            wastage: 2,
            coverage: 0.5,
            doses: 2
          }
        }
      },
      {
        version: 2,
        date: '2016-01-15', // ISO week: 2016-W02
        coefficients: {
          'product:a': {
            wastage: 2,
            coverage: 0.5,
            doses: 4
          }
        }
      }
    ]
  }

  var products = [
    // TODO: presentation should be ints
    { _id: 'product:a', presentation: '10' },
    { _id: 'product:b', presentation: '2' }
  ]

  function getLocation (level) {
    return angular.extend({}, factors, { level: level })
  }

  function expectedThresholdsFor (versions, coefficientsVersion) {
    return products.reduce(function (index, product) {
      index[product._id] = Object.keys(versions.plans.weeksOfStock).reduce(function (thresholds, key) {
        var coefficients = coefficientsVersion[product._id] || {}
        var weeklyLevel = versions.targetPopulations.monthlyTargetPopulations[product._id]
        if (angular.isNumber(coefficients.wastage)) {
          weeklyLevel = weeklyLevel * coefficients.wastage
        }
        if (angular.isNumber(coefficients.coverage)) {
          weeklyLevel = weeklyLevel * coefficients.coverage
        }
        if (angular.isNumber(coefficients.doses)) {
          weeklyLevel = weeklyLevel * coefficients.doses
        }
        thresholds[key] = versions.plans.weeksOfStock[key] * weeklyLevel
        return thresholds
      }, {})
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
      var stockCount = { date: { year: 2014, week: 1 } }
      var versions = {
        plans: factors.plans[0],
        targetPopulations: factors.targetPopulations[0]
      }
      var expected = expectedThresholdsFor(versions, productCoefficients.versions[0].coefficients)
      var actual = thresholdsService.calculateThresholds(getLocation('lga'), stockCount, products, null, productCoefficients)
      expect(actual).toEqual(expected)
    })
    it('works for zones when a required allocation for zone state stores is provided', function () {
      // plans: version 1, targetPopulations: version 2, allocations: version 2
      var stockCount = { date: { year: 2016, week: 2 } }
      var requiredStatesStoresAllocation = { 'product:a': 20 }
      var versions = {
        plans: factors.plans[0],
        targetPopulations: factors.targetPopulations[1]
      }

      var expected = expectedThresholdsFor(versions, productCoefficients.versions[1].coefficients)

      // Should add '20' to all product:a thresholds
      expected['product:a'].max = expected['product:a'].max + 20
      expected['product:a'].min = expected['product:a'].min + 20
      expected['product:a'].reOrder = expected['product:a'].reOrder + 20

      var actual = thresholdsService.calculateThresholds(getLocation('zone'), stockCount, products, requiredStatesStoresAllocation, productCoefficients)
      expect(actual).toEqual(expected)
    })
    it('works for zones when no required allocations are provided', function () {
      // plans: version 1, targetPopulations: version 2, allocations: version 2
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
      // plans: version 1, targetPopulations: version 2, allocations: version 2
      var stockCount = { date: { year: 2016, week: 2 } }
      var unroundedLocation = angular.extend({}, getLocation('lga'), {
        targetPopulations: [
          {
            version: 2,
            date: '2016-01-15', // ISO week: 2016-W02
            monthlyTargetPopulations: {
              'product:a': 49,
              'product:b': 199
            }
          }
        ]
      })
      var expected = {
        'product:a': {
          min: 200,
          reOrder: 400,
          max: 980,
          targetPopulation: 49
        },
        'product:b': {
          min: 200,
          reOrder: 398,
          max: 996,
          targetPopulation: 199
        }
      }
      var actual = thresholdsService.calculateThresholds(unroundedLocation, stockCount, products, {}, productCoefficients)
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
              'product:a': 50,
              'product:b': 100
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
          'product:a': 25,
          'product:b': 100
        }
      }
      var expected = {
        'product:a': { min: 50, reOrder: 100, max: 250, targetPopulation: 25 },
        'product:b': { min: 100, reOrder: 200, max: 500, targetPopulation: 100 }
      }
      var actual = thresholdsService.calculateThresholds(oldStyleLocation, stockCount, products)
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
              'product:a': 50,
              'product:b': 100
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
        'product:a': { min: 50, reOrder: 100, max: 250 },
        'product:b': { min: 100, reOrder: 200, max: 500 }
      }
      var actual = thresholdsService.calculateThresholds(oldStyleLocation, stockCount, products)
      expect(actual).toEqual(expected)
    })
  })

  describe('getThresholdsFor', function () {
    it('takes an array of objects with location, allocations and plans fields and returns an object of location thresholds', function (done) {
      var stockCounts = [ // Note: it doesn't work yet with zones
        { location: { zone: 'nc', state: 'kogi' }, date: { year: 2016, week: 2 } },
        { location: { zone: 'nc', state: 'kogi', lga: 'adavi' }, date: { year: 2016, week: 1 } }
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
          date: { year: 2016, week: 1 },
          thresholds: expectedThresholdsFor({
            plans: factors.plans[0],
            targetPopulations: factors.targetPopulations[0]
          }, productCoefficients.versions[0].coefficients)
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
