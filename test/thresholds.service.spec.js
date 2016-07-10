'use strict'

describe('thresholds service', function () {
  var thresholdsService

  beforeEach(module('angularNavThresholds'))

  beforeEach(inject(function (_thresholdsService_) {
    thresholdsService = _thresholdsService_
  }))

  var location = {
    allocations: [
      { version: 1 },
      {
        version: 2,
        weeklyLevels: {
          'product:a': 100,
          'product:b': 200
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
      }
    ]
  }

  var stockCount = {
    allocations: { version: 2 },
    plans: { version: 1 }
  }

  describe('calculate thesholds', function () {
    it('takes a location and a stockCount and returns the min, reOrder, max thresholds', function () {
      var expected = {
        'product:a': {
          min: 100,
          reOrder: 200,
          max: 500
        },
        'product:b': {
          min: 200,
          reOrder: 400,
          max: 1000
        }
      }
      var actual = thresholdsService.calculateThresholds(location, stockCount)
      expect(expected).toEqual(actual)
    })
  })
})
