import angular from 'angular'

import ThresholdsService from './thresholds.service'

angular
  .module('angularNavThresholds', [
    'angularNavData',
    'ngSmartId'
  ])
  .service('thresholdsService', ThresholdsService)
