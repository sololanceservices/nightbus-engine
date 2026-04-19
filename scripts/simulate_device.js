/**
 * Bus Telemetry Simulator
 * Usage: node simulate_device.js <busId>
 */

const axios = require('axios');
const io = require('socket.io-client');

const API_URL = 'http://localhost:5000/api';
// const API_URL = 'http://192.168.10.6:5000/api'; // Use for local network testing

const SIMULATION_INTERVAL = 2000; // 2 seconds

// Route path (approximate coordinates for a circular route in Bangalore)
const ROUTE_PATH = [
    { lat: 12.9716, lng: 77.5946 }, // Majestic
    { lat: 12.9783, lng: 77.6050 }, // MG Road
    { lat: 12.9830, lng: 77.6150 }, // Trinity
    { lat: 12.9730, lng: 77.6200 }, // Domlur
    { lat: 12.9590, lng: 77.6250 }, // Koramangala
    { lat: 12.9450, lng: 77.6100 }, // Dairy Circle
    { lat: 12.9550, lng: 77.5800 }, // Lalbagh
    { lat: 12.9650, lng: 77.5750 }, // Town Hall
];

const busId = process.argv[2];

if (!busId) {
    console.error('Please provide a Bus ID');
    console.log('Usage: node simulate_device.js <busId>');
    process.exit(1);
}

// Interpolate points for smoother animation
function interpolate(p1, p2, validFraction) {
    return {
        lat: p1.lat + (p2.lat - p1.lat) * validFraction,
        lng: p1.lng + (p2.lng - p1.lng) * validFraction
    };
}

let currentIndex = 0;
let fraction = 0;
let fuel = 95;
let battery = 98;
let passengers = 12;

console.log(`🚀 Starting simulation for Bus: ${busId}`);

async function sendTelemetry() {
    // Move logic
    fraction += 0.1;
    if (fraction >= 1) {
        fraction = 0;
        currentIndex = (currentIndex + 1) % ROUTE_PATH.length;
    }

    const p1 = ROUTE_PATH[currentIndex];
    const p2 = ROUTE_PATH[(currentIndex + 1) % ROUTE_PATH.length];
    const currentPos = interpolate(p1, p2, fraction);

    // Vary data
    const speed = Math.floor(Math.random() * (60 - 20) + 20); // 20-60 km/h
    fuel = Math.max(0, fuel - 0.01);
    battery = Math.max(0, battery - 0.05);

    // Random passenger change at "stops" (when fraction is near 0)
    if (fraction < 0.15) {
        if (Math.random() > 0.5) passengers = Math.min(50, passengers + Math.floor(Math.random() * 3));
        else passengers = Math.max(0, passengers - Math.floor(Math.random() * 3));
    }

    const payload = {
        busId,
        lat: currentPos.lat,
        lng: currentPos.lng,
        speed,
        fuel: parseFloat(fuel.toFixed(2)),
        battery: parseFloat(battery.toFixed(2)),
        occupancy: passengers,
        ignition: true,
        heading: 0, // Calculate actual heading if needed
        deviceId: 'SIMULATOR_001'
    };

    try {
        const response = await axios.post(`${API_URL}/telemetry`, payload);
        console.log(`✅ [${new Date().toLocaleTimeString()}] Sent: Speed=${speed}km/h Fuel=${payload.fuel}% Pax=${passengers} | AI: ${response.data.aiStatus}`);
    } catch (error) {
        console.error(`❌ Error: ${error.message}`);
    }
}

setInterval(sendTelemetry, SIMULATION_INTERVAL);
