const formulae = {
  'product:bcg': 'regular',
  'product:mv': 'regular',
  'product:yf': 'regular',
  'product:opv': 'regular',
  'product:td': 'regular',
  'product:penta': 'regular',
  'product:hep-b': 'regular',
  'product:pcv': 'regular',
  'product:ipv': 'regular',
  'product:rota': 'regular',
  'product:hpv': 'regular',
  'product:ad-syg': 'adSyg',
  'product:bcg-syg': 'bcg',
  'product:5-reconst-syg': 'fiveReconst',
  'product:2-reconst-syg': 'twoReconst',
  'product:safety-boxes': 'safetyBoxes',
  'product:diluent-bcg': 'diluentBcg',
  'product:diluent-yf': 'diluentYf',
  'product:diluent-mv': 'diluentMv'
}

const calculator = {}
calculator.regular = (allocations, coefficient, targetPopulation) => (
  targetPopulation *
  coefficient.doses *
  coefficient.coverage *
  coefficient.wastage
)

calculator.adSyg = allocations => (
  allocations['product:penta'] +
  allocations['product:mv'] +
  allocations['product:yf'] +
  allocations['product:hep-b'] +
  allocations['product:td'] +
  allocations['product:pcv'] +
  allocations['product:ipv'] +
  allocations['product:hpv']
)

calculator.bcg = allocations => allocations['product:bcg']

calculator.fiveReconst = (allocations, coefficient) => (
  (allocations['product:mv'] + allocations['product:yf']) / 10 *
    coefficient.wastage
)

calculator.twoReconst = (allocations, coefficient) => (
  allocations['product:bcg'] / 20 * coefficient.wastage
)

calculator.safetyBoxes = (allocations, coefficient) => (
  (allocations['product:ad-syg'] +
  allocations['product:bcg-syg'] +
  allocations['product:5-reconst-syg'] +
  allocations['product:2-reconst-syg']) / 100 * coefficient.wastage
)

calculator.diluentBcg = allocations => allocations['product:bcg']
calculator.diluentYf = allocations => allocations['product:yf']
calculator.diluentMv = allocations => allocations['product:mv']

const calculateForProduct = (monthlyTargetPopulations, coefficients, allocations, productId) => {
  const coefficient = coefficients[productId]
  const monthlyTargetPopulation = monthlyTargetPopulations[productId]

  allocations[productId] = 0
  if (typeof monthlyTargetPopulation !== 'undefined' && coefficient) {
    allocations[productId] = calculator[formulae[productId]](allocations, coefficient, monthlyTargetPopulation / 4)
  }
  return allocations
}

export default (monthlyTargetPopulations, coefficients) => (
  Object.keys(formulae).reduce(calculateForProduct.bind(null, monthlyTargetPopulations, coefficients), {})
)
