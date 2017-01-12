/* global moment:false */
import config from './config/config.json'
import { find } from './utils.js'
import calculateWeeklyLevels from './weekly-levels-calculator'

// centralized for whenever we implement #16
const somethingIsWrong = () => undefined

const isVersion = (date, version) => {
  const momentDate = moment().isoWeekYear(date.year).isoWeek(date.week).isoWeekday(1).startOf('day')
  const momentVersionStartDate = moment(version.date, config.versionDateFormat).startOf('isoWeek').startOf('day')
  return momentDate.isSameOrAfter(momentVersionStartDate)
}

const getFactor = (versions, date) => {
  const reverseVersions = versions.slice(0).reverse()
  const factor = find(reverseVersions, isVersion.bind(null, date))
  // If the doc is too old to have a matching version, default to the oldest one
  if (!factor) {
    return versions[0]
  }
  return factor
}

const getCoefficients = (productCoefficients, date) => {
  if (!(productCoefficients && productCoefficients.versions && productCoefficients.versions.length)) {
    somethingIsWrong()
  }
  const version = getFactor(productCoefficients.versions, date)
  return version && version.coefficients
}

const getWeeksOfStock = (location, date) => {
  if (!(location.plans && location.plans.length)) {
    somethingIsWrong()
  }

  const plans = getFactor(location.plans, date)
  return plans && plans.weeksOfStock
}

const getTargetPopulations = (location, date) => {
  if (location.targetPopulations && location.targetPopulations.length) {
    const targetPopulations = getFactor(location.targetPopulations, date)

    return {
      version: targetPopulations.version,
      monthlyTargetPopulations: targetPopulations && targetPopulations.monthlyTargetPopulations
    }
  }

  // For backwards compatibility to version before introducing `targetPopulations`,
  // since we have no control about when the dashboards are going
  // to replicate the new location docs
  if (!(location.targetPopulation && Object.keys(location.targetPopulation).length)) {
    return {
      version: 1
    }
  }

  return {
    version: 1,
    monthlyTargetPopulations: location.targetPopulation
  }
}

const getWeeklyLevels = (location, date) => {
  if (!(location.allocations && location.allocations.length)) {
    somethingIsWrong()
  }

  const allocations = getFactor(location.allocations, date)
  return allocations && allocations.weeklyLevels
}

export default function transform (location, productCoefficients, date) {
  const weeksOfStock = getWeeksOfStock(location, date)
  if (!weeksOfStock) {
    somethingIsWrong()
  }

  const { version, monthlyTargetPopulations } = getTargetPopulations(location, date)

  // For backwards compatibility to version before introducing `targetPopulations`,
  // since for that version `weeklyAllocations` were not always calculated
  // based on target population
  if (version === 1) {
    const weeklyLevels = getWeeklyLevels(location, date)
    if (!weeklyLevels) {
      somethingIsWrong()
    }

    return {
      level: location.level,
      weeklyLevels,
      weeksOfStock,
      monthlyTargetPopulations
    }
  }

  const coefficients = getCoefficients(productCoefficients, date)
  if (!(monthlyTargetPopulations && coefficients)) {
    somethingIsWrong()
  }

  const weeklyLevels = calculateWeeklyLevels(monthlyTargetPopulations, coefficients)
  if (!weeklyLevels) {
    somethingIsWrong()
  }

  return {
    level: location.level,
    weeklyLevels,
    weeksOfStock,
    monthlyTargetPopulations
  }
}
