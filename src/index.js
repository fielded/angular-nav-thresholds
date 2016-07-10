import angular from 'angular'

import ThresholdsService from './thresholds.service'

angular
  .module('angularNavThresholds', [])
  .service('thresholdsService', ThresholdsService)
