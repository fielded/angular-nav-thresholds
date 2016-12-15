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

  var getZoneLocation = function () {
    var plans = [{
      version: 1,
      date: '2016-01-06', // ISO week: 2016-W01
      weeksOfStock: {
        min: 0,
        reOrder: 3,
        max: 6
      }
    }]
    return angular.extend({}, location, { level: 'zone', plans: plans })
  }

  var stockCount = { // plans: version 1, targetPopulations: version 2, allocations: version 2
    date: {
      year: 2016,
      week: 2
    }
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
    it('defaults to the oldest factor version if the doc is to old to have a matching one', function () {
      var stockCount = { date: { year: 2014, week: 1 } }
      var expected = { // all versions defaulting to 1
        'product:a': {
          min: 50,
          reOrder: 100,
          max: 250,
          targetPopulation: 500
        },
        'product:b': {
          min: 100,
          reOrder: 200,
          max: 500,
          targetPopulation: 1000
        }
      }
      var actual = thresholdsService.calculateThresholds(location, stockCount, products)
      expect(actual).toEqual(expected)
    })
    it('works for zones when a required allocation for zone state stores is provided', function () {
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
      var actual = thresholdsService.calculateThresholds(getZoneLocation(), stockCount, products, requiredStatesStoresAllocation)
      expect(actual).toEqual(expected)
    })
    it('works for zones when no required allocations are provided', function () {
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
      var actual = thresholdsService.calculateThresholds(getZoneLocation(), stockCount, products)
      expect(actual).toEqual(expected)
    })
    it('rounds allocations up to the product presentation', function () {
      var unroundedLocation = angular.extend({}, location, {
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
    it('still works if the location doc contains a non versioned targetPopulation field', function () {
      var stockCount = { date: { year: 2016, week: 1 } }
      var oldStyleTargetPopulations = {
        'product:a': 500,
        'product:b': 1000
      }
      var oldStyleLocation = angular.extend({}, location, { targetPopulation: oldStyleTargetPopulations })
      delete oldStyleLocation.targetPopulations
      var expected = {
        'product:a': {
          min: 50,
          reOrder: 100,
          max: 250,
          targetPopulation: 500
        },
        'product:b': {
          min: 100,
          reOrder: 200,
          max: 500,
          targetPopulation: 1000
        }
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
          thresholds: {
            'product:a': { min: 100, reOrder: 200, max: 500, targetPopulation: 1000 },
            'product:b': { min: 200, reOrder: 400, max: 1000, targetPopulation: 2000 }
          }
        },
        'zone:nc:state:kogi:lga:adavi': {
          date: { year: 2016, week: 1 },
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
