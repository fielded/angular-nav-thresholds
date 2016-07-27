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
    targetPopulation: {
      'product:a': 1000,
      'product:b': 2000
    },
    plans: [
      {
        version: 1,
        weeksOfStock: {
          max: 5,
          reOrder: 2,
          min: 1
        }
      }
    ]
  }

  var stockCount = {
    allocations: { version: 2 },
    plans: { version: 1 }
  }

  var stockCounts = [
    // { location: { zone: 'nc' }, allocations: { version: 2 }, plans: { version: 1 } },
    { location: { zone: 'nc', state: 'kogi' }, allocations: { version: 2 }, plans: { version: 1 } },
    { location: { zone: 'nc', state: 'kogi', lga: 'adavi' } }
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
      var actual = thresholdsService.calculateThresholds(location, stockCount)
      expect(expected).toEqual(actual)
    })
  })

  describe('getThresholdsFor', function () {
    it('takes an array of objects with location, allocations and plans fields and returns an object of location thresholds', function (done) {
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
          thresholds: {
            'product:a': { min: 100, reOrder: 200, max: 500, targetPopulation: 1000 },
            'product:b': { min: 200, reOrder: 400, max: 1000, targetPopulation: 2000 }
          }
        },
        'zone:nc:state:kogi:lga:adavi': {
          allocations: { version: 1 },
          plans: { version: 1 },
          thresholds: {
            'product:a': { min: 50, reOrder: 100, max: 250, targetPopulation: 1000 },
            'product:b': { min: 100, reOrder: 200, max: 500, targetPopulation: 2000 }
          }
        }
      }

      thresholdsService.getThresholdsFor(stockCounts)
        .then(function (thresholds) {
          expect(expected).toEqual(thresholds)
        })
      $rootScope.$digest()
      done()
    })
  })
})
