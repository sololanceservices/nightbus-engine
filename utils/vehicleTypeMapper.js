/**
 * Helper utility to map between client vehicleType labels and backend model classifications.
 * Customer uses descriptive labels like '50-Seater Bus', while Owner uses category enums like 'Bus'.
 */
const getEquivalentVehicleTypes = (type) => {
  if (!type) return [];
  const normalized = type.toLowerCase().trim();

  // Bus mappings
  if (normalized === 'bus' || normalized === '50-seater bus' || normalized === 'ac sleeper') {
    return ['Bus', '50-Seater Bus', 'AC Sleeper'];
  }

  // Mini Bus mappings
  if (
    normalized === 'mini bus' ||
    normalized === 'minibus (25s)' ||
    normalized === 'tempo traveler' ||
    normalized === 'tempo traveller'
  ) {
    return ['Mini Bus', 'Minibus (25s)', 'Tempo Traveler', 'Tempo Traveller'];
  }

  // Car mappings
  if (normalized === 'car' || normalized === 'car (4-7s)') {
    return ['Car', 'Car (4-7s)'];
  }

  // Luxury mappings
  if (normalized === 'luxury') {
    return ['Luxury', 'AC Sleeper'];
  }

  // Other mappings
  if (normalized === 'other' || normalized === 'bike/scooter') {
    return ['Other', 'Bike/Scooter'];
  }

  // Fallback to original and lower/upper forms
  return [type];
};

module.exports = {
  getEquivalentVehicleTypes
};
