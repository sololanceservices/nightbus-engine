/**
 * Matching Config & Helper Utilities for Rental Matching Engine
 */

const getMatchingConfig = () => {
  const minFillRatio = parseFloat(process.env.MATCHING_MIN_FILL_RATIO) || 0.40;
  const minCapacityRatio = parseFloat(process.env.MATCHING_MIN_CAPACITY_RATIO) || 0.30;
  const priceTolerancePct = parseFloat(process.env.MATCHING_PRICE_TOLERANCE_PCT) || 0.30;

  return {
    minFillRatio,
    minCapacityRatio,
    priceTolerancePct
  };
};

/**
 * Calculate min & max capacity bounds for a given passenger count (peopleCount)
 */
const getCapacityBounds = (peopleCount) => {
  const count = Math.max(1, Number(peopleCount) || 1);
  const { minFillRatio, minCapacityRatio } = getMatchingConfig();

  const minCap = Math.max(1, Math.floor(count * minCapacityRatio));
  const maxCap = Math.floor(count / minFillRatio);

  return { minCap, maxCap };
};

/**
 * Calculate price bounds with tolerance for a given budget range
 */
const getPriceBounds = (budgetMin, budgetMax) => {
  const min = Math.max(0, Number(budgetMin) || 0);
  const max = Math.max(min, Number(budgetMax) || min);
  const { priceTolerancePct } = getMatchingConfig();

  const minTol = Math.max(0, Math.round(min * (1 - priceTolerancePct)));
  const maxTol = Math.round(max * (1 + priceTolerancePct));

  return { minTol, maxTol };
};

/**
 * Check if owner price range [priceMin, priceMax] overlaps with customer budget [budgetMin, budgetMax] (with tolerance)
 */
const isPriceOverlapping = (priceMin, priceMax, budgetMin, budgetMax) => {
  const { minTol: budgetMinTol, maxTol: budgetMaxTol } = getPriceBounds(budgetMin, budgetMax);
  const pMin = Number(priceMin) || 0;
  const pMax = Number(priceMax) || pMin;

  return pMin <= budgetMaxTol && pMax >= budgetMinTol;
};

/**
 * Check if vehicle capacity is compatible with peopleCount under 60:40 rule
 */
const isCapacityCompatible = (capacity, peopleCount) => {
  const { minCap, maxCap } = getCapacityBounds(peopleCount);
  const cap = Number(capacity) || 0;
  return cap >= minCap && cap <= maxCap;
};

const { getEquivalentVehicleTypes } = require('./vehicleTypeMapper');

/**
 * Detailed evaluation of a rental match. Returns flags for debugging and filtering.
 */
const evaluateRentalMatch = (ownerConfig, request, fromCity, toCity, availableDates) => {
  const evalResult = {
    routeMatch: false,
    capacityMatch: false,
    budgetMatch: false,
    vehicleTypeMatch: false,
    availabilityMatch: false,
    tripTypeMatch: true, // Placeholder if trip type logic is added
    acMatch: true,       // Placeholder
    luggageMatch: true,  // Placeholder
    isMatch: false,
    reasons: []
  };

  // 1. Route Match
  const ownerFrom = (ownerConfig.from || '').toLowerCase();
  const ownerTo = (ownerConfig.to || '').toLowerCase();
  const reqFrom = (request.from || '').toLowerCase();
  const reqTo = (request.to || '').toLowerCase();
  const resolvedFrom = (fromCity || '').toLowerCase();
  const resolvedTo = (toCity || '').toLowerCase();

  if ((ownerFrom === reqFrom || ownerFrom === resolvedFrom) && 
      (ownerTo === reqTo || ownerTo === resolvedTo)) {
    evalResult.routeMatch = true;
  } else {
    evalResult.reasons.push(`Route mismatch: Owner(${ownerConfig.from}->${ownerConfig.to}) vs Request(${request.from}->${request.to} / Resolved: ${fromCity}->${toCity})`);
  }

  // 2. Capacity Match
  evalResult.capacityMatch = isCapacityCompatible(ownerConfig.capacity, request.peopleCount);
  if (!evalResult.capacityMatch) {
    evalResult.reasons.push(`Capacity mismatch: Owner(${ownerConfig.capacity}) vs Request(${request.peopleCount} pax, 60:40 rule failed)`);
  }

  // 3. Budget Match
  evalResult.budgetMatch = isPriceOverlapping(ownerConfig.priceMin, ownerConfig.priceMax, request.budgetMin, request.budgetMax);
  if (!evalResult.budgetMatch) {
    evalResult.reasons.push(`Budget mismatch: Owner(${ownerConfig.priceMin}-${ownerConfig.priceMax}) vs Request(${request.budgetMin}-${request.budgetMax})`);
  }

  // 4. Vehicle Type Match
  const equivTypes = getEquivalentVehicleTypes(request.vehicleType).map(t => t.toLowerCase());
  const ownerType = (ownerConfig.vehicleType || '').toLowerCase();
  if (equivTypes.includes(ownerType)) {
    evalResult.vehicleTypeMatch = true;
  } else {
    evalResult.reasons.push(`Vehicle Type mismatch: Owner(${ownerConfig.vehicleType}) vs Request(${request.vehicleType})`);
  }

  // 5. Availability Match
  if (availableDates && Array.isArray(availableDates)) {
    const startOfDay = new Date(request.date);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(request.date);
    endOfDay.setUTCHours(23, 59, 59, 999);
    
    evalResult.availabilityMatch = availableDates.some(d => {
      const date = new Date(d);
      return date >= startOfDay && date <= endOfDay;
    });
    if (!evalResult.availabilityMatch) {
      evalResult.reasons.push(`Availability mismatch: Owner not available on ${startOfDay.toISOString().split('T')[0]}`);
    }
  } else {
    // If not provided, assume true (handled by external query)
    evalResult.availabilityMatch = true;
  }

  // Final Match
  evalResult.isMatch = evalResult.routeMatch && 
                       evalResult.capacityMatch && 
                       evalResult.budgetMatch && 
                       evalResult.vehicleTypeMatch &&
                       evalResult.availabilityMatch;

  return evalResult;
};

module.exports = {
  getMatchingConfig,
  getCapacityBounds,
  getPriceBounds,
  isPriceOverlapping,
  isCapacityCompatible,
  evaluateRentalMatch
};
