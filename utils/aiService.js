/**
 * AI Service for interpreting bus telemetry data
 * In a real scenario, this would call OpenAI/Gemini API
 */

exports.analyzeTelemetry = async (telemetryData, previousData) => {
    // Mock AI Logic
    // Detects anomalies based on simple rules mimicking AI inference

    const statusUpdates = [];

    // 1. Idle Detection
    if (telemetryData.speed === 0 && telemetryData.ignitionStatus) {
        statusUpdates.push("Bus is idling with ignition ON.");
    }

    // 2. Fuel Drop Detection (Potential Theft/Leak)
    if (previousData && previousData.fuelLevel - telemetryData.fuelLevel > 5) {
        // If fuel drops more than 5% in one interval (unlikely unless long interval)
        statusUpdates.push("Abnormal fuel drop detected.");
    }

    // 3. Speeding
    if (telemetryData.speed > 80) {
        statusUpdates.push("Overspeeding detected.");
    }

    // 4. Overcrowding
    // Assuming we have max seats available in context, or just raw checks
    // This would ideally need Bus context, passing simulated "High" for now if occupancy > 50
    if (telemetryData.occupancy > 50) {
        statusUpdates.push("High occupancy detected.");
    }

    if (statusUpdates.length === 0) {
        return "Normal Operation";
    }

    return statusUpdates.join(" ");
};
