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
          var lga = angular.merge({ _id: 'zone:nc:state:kogi:lga:adavi' }, location)
          return $q.when([lga])
        }
      })
      .service('statesService', function ($q) {
        this.list = function () {
          var state = angular.merge({ _id: 'zone:nc:state:kogi' }, location)
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

  var location = {
    level: 'lga',
    allocations: [
      { version: 1,
        weeklyLevels: {
          'product:a': 50,
          'product:b': 100
        }
      },
      {
        version: 2,
        weeklyLevels: {
          'product:a': 100,
          'product:b': 200
        }
      }
    ],
    targetPopulation: [
      {
        version: 1,
        targetPopulation: {
          'product:a': 500,
          'product:b': 1000
        }
      },
      {
        version: 2,
        targetPopulation: {
          'product:a': 1000,
          'product:b': 2000
        }
      }
    ],
    plans: [
      {
        version: 1,
        weeksOfStock: {
          max: 5,
          reOrder: 2,
          min: 1
        }
      },
      {
        version: 2,
        weeksOfStock: {
          max: 10,
          reOrder: 4,
          min: 2
        }
      }
    ]
  }

  var stockCount = {
    allocations: { version: 2 },
    plans: { version: 1 },
    targetPopulation: { version: 2 }
  }

  var products = [
    // TODO: presentation should be ints
    { _id: 'product:a', presentation: '10' },
    { _id: 'product:b', presentation: '2' }
  ]

  describe('calculateThresholds', function () {
    it('takes a location and a stockCount and returns the min, reOrder, max thresholds', function () {
      var expected = {
        'product:a': {
          min: 100,
          reOrder: 200,
          max: 500,
          targetPopulation: 1000
        },
        'product:b': {
          min: 200,
          reOrder: 400,
          max: 1000,
          targetPopulation: 2000
        }
      }
      var actual = thresholdsService.calculateThresholds(location, stockCount, products)
      expect(actual).toEqual(expected)
    })
    it('also works with zones', function () {
      var zone = angular.extend({}, location, { level: 'zone' })
      // Note: `plans.weeksOfStock` is ignored (at least for now) in the case of zone stores
      // See https://github.com/fielded/angular-nav-thresholds/issues/9
      var expected = {
        'product:a': {
          min: 0,
          reOrder: 300,
          max: 600,
          targetPopulation: 1000
        },
        'product:b': {
          min: 0,
          reOrder: 600,
          max: 1200,
          targetPopulation: 2000
        }
      }
      var actual = thresholdsService.calculateThresholds(zone, stockCount, products)
      expect(actual).toEqual(expected)
    })
    it('works with zones if there is a required allocation for zone state stores', function () {
      var zone = angular.extend({}, location, { level: 'zone' })
      // Note: `plans.weeksOfStock` is ignored (at least for now) in the case of zone stores
      // See https://github.com/fielded/angular-nav-thresholds/issues/9
      var requiredStatesStoresAllocation = { 'product:a': 20 }
      var expected = {
        'product:a': {
          min: 20,
          reOrder: 320,
          max: 620,
          targetPopulation: 1000
        },
        'product:b': {
          min: 0,
          reOrder: 600,
          max: 1200,
          targetPopulation: 2000
        }
      }
      var actual = thresholdsService.calculateThresholds(zone, stockCount, products, requiredStatesStoresAllocation)
      expect(actual).toEqual(expected)
    })
    it('rounds allocations up to the product presentation', function () {
      var unroundedLocation = angular.extend({}, location, {
        allocations: [
          {
            version: 2,
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
    it('uses the last version of plans and allocations if { version: "last"} is passed as option', function () {
      var expected = {
        'product:a': {
          min: 200,
          reOrder: 400,
          max: 1000,
          targetPopulation: 1000
        },
        'product:b': {
          min: 400,
          reOrder: 800,
          max: 2000,
          targetPopulation: 2000
        }
      }
      var actual = thresholdsService.calculateThresholds(location, stockCount, products, null, { version: 'last' })
      expect(actual).toEqual(expected)
    })
  })

  describe('getThresholdsFor', function () {
    it('takes an array of objects with location, allocations and plans fields and returns an object of location thresholds', function (done) {
      var stockCounts = [
        // { location: { zone: 'nc' }, allocations: { version: 2 }, plans: { version: 1 } },
        { location: { zone: 'nc', state: 'kogi' }, allocations: { version: 2 }, plans: { version: 1 }, targetPopulation: { version: 2 } },
        { location: { zone: 'nc', state: 'kogi', lga: 'adavi' } }
      ]
      var expected = {
        // 'zone:nc': {
          // thresholds: {
            // 'product:a': { min: 100, reOrder: 200, max: 500 },
            // 'product:b': { min: 200, reOrder: 400, max: 1000 }
          // }
        // },
        'zone:nc:state:kogi': {
          allocations: { version: 2 },
          plans: { version: 1 },
          targetPopulation: { version: 2 },
          thresholds: {
            'product:a': { min: 100, reOrder: 200, max: 500, targetPopulation: 1000 },
            'product:b': { min: 200, reOrder: 400, max: 1000, targetPopulation: 2000 }
          }
        },
        'zone:nc:state:kogi:lga:adavi': {
          allocations: { version: 1 },
          plans: { version: 1 },
          targetPopulation: { version: 1 },
          thresholds: {
            'product:a': { min: 50, reOrder: 100, max: 250, targetPopulation: 500 },
            'product:b': { min: 100, reOrder: 200, max: 500, targetPopulation: 1000 }
          }
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
