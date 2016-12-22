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
    allocations: [
      { version: 1,
        date: '2016-01-06', // ISO week: 2016-W01
        weeklyLevels: {
          'product:a': 50,
          'product:b': 100
        }
      },
      {
        version: 2,
        date: '2016-01-15', // ISO week: 2016-W02
        weeklyLevels: {
          'product:a': 100,
          'product:b': 200
        }
      }
    ],
    targetPopulations: [
      {
        version: 1,
        date: '2016-01-06', // ISO week: 2016-W01
        monthlyTargetPopulations: {
          'product:a': 500,
          'product:b': 1000
        }
      },
      {
        version: 2,
        date: '2016-01-15', // ISO week: 2016-W02
        monthlyTargetPopulations: {
          'product:a': 1000,
          'product:b': 2000
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

  var products = [
    // TODO: presentation should be ints
    { _id: 'product:a', presentation: '10' },
    { _id: 'product:b', presentation: '2' }
  ]

  function getLocation (level) {
    return angular.extend({}, factors, { level: level })
  }

  function expectedThresholdsFor (versions) {
    return products.reduce(function (index, product) {
      index[product._id] = Object.keys(versions.plans.weeksOfStock).reduce(function (thresholds, key) {
        thresholds[key] = versions.plans.weeksOfStock[key] * versions.allocations.weeklyLevels[product._id]
        return thresholds
      }, {})
      index[product._id].targetPopulation = versions.targetPopulations.monthlyTargetPopulations[product._id]
      return index
    }, {})
  }

  describe('calculateThresholds', function () {
    it('takes a location and a stockCount and returns the min, reOrder, max thresholds', function () {
      // plans: version 1, targetPopulations: version 2, allocations: version 2
      var stockCount = { date: { year: 2016, week: 2 } }
      var versions = {
        plans: factors.plans[0],
        allocations: factors.allocations[1],
        targetPopulations: factors.targetPopulations[1]
      }
      var expected = expectedThresholdsFor(versions)
      var actual = thresholdsService.calculateThresholds(getLocation('lga'), stockCount, products)
      expect(actual).toEqual(expected)
    })
    it('defaults to the oldest factor version if the doc is too old to have a matching one', function () {
      var stockCount = { date: { year: 2014, week: 1 } }
      var versions = {
        plans: factors.plans[0],
        allocations: factors.allocations[0],
        targetPopulations: factors.targetPopulations[0]
      }
      var expected = expectedThresholdsFor(versions)
      var actual = thresholdsService.calculateThresholds(getLocation('lga'), stockCount, products)
      expect(actual).toEqual(expected)
    })
    it('works for zones when a required allocation for zone state stores is provided', function () {
      // plans: version 1, targetPopulations: version 2, allocations: version 2
      var stockCount = { date: { year: 2016, week: 2 } }
      var requiredStatesStoresAllocation = { 'product:a': 20 }
      var versions = {
        plans: factors.plans[0],
        allocations: factors.allocations[1],
        targetPopulations: factors.targetPopulations[1]
      }

      var expected = expectedThresholdsFor(versions)

      // Should add '20' to all product:a thresholds
      expected['product:a'].max = expected['product:a'].max + 20
      expected['product:a'].min = expected['product:a'].min + 20
      expected['product:a'].reOrder = expected['product:a'].reOrder + 20

      var actual = thresholdsService.calculateThresholds(getLocation('zone'), stockCount, products, requiredStatesStoresAllocation)
      expect(actual).toEqual(expected)
    })
    it('works for zones when no required allocations are provided', function () {
      // plans: version 1, targetPopulations: version 2, allocations: version 2
      var stockCount = { date: { year: 2016, week: 2 } }
      var versions = {
        plans: factors.plans[0],
        allocations: factors.allocations[1],
        targetPopulations: factors.targetPopulations[1]
      }
      var expected = expectedThresholdsFor(versions)
      var actual = thresholdsService.calculateThresholds(getLocation('zone'), stockCount, products)
      expect(actual).toEqual(expected)
    })
    it('rounds allocations up to the product presentation', function () {
      // plans: version 1, targetPopulations: version 2, allocations: version 2
      var stockCount = { date: { year: 2016, week: 2 } }
      var unroundedLocation = angular.extend({}, getLocation('lga'), {
        allocations: [
          {
            version: 2,
            date: '2016-01-15', // ISO week: 2016-W02
            weeklyLevels: {
              'product:a': 99.141592,
              'product:b': 43.892
            }
          }
        ]
      })
      var expected = {
        'product:a': {
          min: 100,
          reOrder: 200,
          max: 500,
          targetPopulation: 1000
        },
        'product:b': {
          min: 44,
          reOrder: 88,
          max: 220,
          targetPopulation: 2000
        }
      }
      var actual = thresholdsService.calculateThresholds(unroundedLocation, stockCount, products)
      expect(actual).toEqual(expected)
    })
    it('still works if the location doc contains a non versioned targetPopulation field (instead of targetPopulations)', function () {
      // plans: version 1, targetPopulations: version 1, allocations: version 1
      var stockCount = { date: { year: 2016, week: 1 } }
      var oldStyleLocation = {
        level: 'lga',
        allocations: factors.allocations,
        plans: factors.plans,
        targetPopulation: factors.targetPopulations[0].monthlyTargetPopulations
      }
      var versions = {
        plans: factors.plans[0],
        allocations: factors.allocations[0],
        targetPopulations: factors.targetPopulations[0]
      }
      var expected = expectedThresholdsFor(versions)
      var actual = thresholdsService.calculateThresholds(oldStyleLocation, stockCount, products)
      expect(actual).toEqual(expected)
    })
    it('still works if the location doc has no targetPopulation or targetPopulations field', function () {
      // plans: version 1, targetPopulations: version 1, allocations: version 1
      var stockCount = { date: { year: 2016, week: 1 } }
      var oldStyleLocation = getLocation('lga')
      delete oldStyleLocation.targetPopulations

      var versions = {
        plans: factors.plans[0],
        allocations: factors.allocations[0],
        targetPopulations: factors.targetPopulations[0]
      }
      var expected = expectedThresholdsFor(versions)
      delete expected['product:a'].targetPopulation
      delete expected['product:b'].targetPopulation

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
            allocations: factors.allocations[1],
            targetPopulations: factors.targetPopulations[1]
          })
        },
        'zone:nc:state:kogi:lga:adavi': {
          date: { year: 2016, week: 1 },
          thresholds: expectedThresholdsFor({
            plans: factors.plans[0],
            allocations: factors.allocations[0],
            targetPopulations: factors.targetPopulations[0]
          })
        }
      }

      thresholdsService.getThresholdsFor(stockCounts, products)
        .then(function (thresholds) {
          expect(thresholds).toEqual(expected)
        })
      $rootScope.$digest()
      done()
    })
  })
})
