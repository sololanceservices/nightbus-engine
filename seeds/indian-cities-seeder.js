// ==================== data/indian-cities-seeder.js ====================
// Run this ONCE to populate your database: node data/indian-cities-seeder.js

const mongoose = require('mongoose');
const Location = require('../models/Route');
require('dotenv').config();

const indianCities = [
  // Major Cities - Tier 1
  { name: 'Delhi', state: 'Delhi', type: 'city', aliases: ['दिल्ली', 'New Delhi', 'नई दिल्ली'], popularity: 1000 },
  { name: 'Mumbai', state: 'Maharashtra', type: 'city', aliases: ['मुंबई', 'Bombay'], popularity: 1000 },
  { name: 'Bangalore', state: 'Karnataka', type: 'city', aliases: ['बैंगलोर', 'Bengaluru', 'बेंगलुरु'], popularity: 1000 },
  { name: 'Kolkata', state: 'West Bengal', type: 'city', aliases: ['कोलकाता', 'Calcutta'], popularity: 1000 },
  { name: 'Chennai', state: 'Tamil Nadu', type: 'city', aliases: ['चेन्नई', 'Madras'], popularity: 1000 },
  { name: 'Hyderabad', state: 'Telangana', type: 'city', aliases: ['हैदराबाद'], popularity: 1000 },
  { name: 'Pune', state: 'Maharashtra', type: 'city', aliases: ['पुणे'], popularity: 900 },
  { name: 'Ahmedabad', state: 'Gujarat', type: 'city', aliases: ['अहमदाबाद'], popularity: 900 },

  // Tier 2 - Major Cities
  { name: 'Jaipur', state: 'Rajasthan', type: 'city', aliases: ['जयपुर'], popularity: 800 },
  { name: 'Lucknow', state: 'Uttar Pradesh', type: 'city', aliases: ['लखनऊ'], popularity: 800 },
  { name: 'Kanpur', state: 'Uttar Pradesh', type: 'city', aliases: ['कानपुर'], popularity: 700 },
  { name: 'Nagpur', state: 'Maharashtra', type: 'city', aliases: ['नागपुर'], popularity: 700 },
  { name: 'Indore', state: 'Madhya Pradesh', type: 'city', aliases: ['इंदौर'], popularity: 800 },
  { name: 'Bhopal', state: 'Madhya Pradesh', type: 'city', aliases: ['भोपाल'], popularity: 700 },
  { name: 'Visakhapatnam', state: 'Andhra Pradesh', type: 'city', aliases: ['विशाखापत्तनम', 'Vizag'], popularity: 600 },
  { name: 'Patna', state: 'Bihar', type: 'city', aliases: ['पटना'], popularity: 700 },
  { name: 'Vadodara', state: 'Gujarat', type: 'city', aliases: ['वडोदरा', 'Baroda'], popularity: 600 },
  { name: 'Ludhiana', state: 'Punjab', type: 'city', aliases: ['लुधियाना'], popularity: 600 },
  { name: 'Agra', state: 'Uttar Pradesh', type: 'city', aliases: ['आगरा'], popularity: 700 },
  { name: 'Nashik', state: 'Maharashtra', type: 'city', aliases: ['नासिक'], popularity: 600 },

  // Madhya Pradesh Cities
  { name: 'Jabalpur', state: 'Madhya Pradesh', type: 'city', aliases: ['जबलपुर'], popularity: 600 },
  { name: 'Gwalior', state: 'Madhya Pradesh', type: 'city', aliases: ['ग्वालियर'], popularity: 500 },
  { name: 'Ujjain', state: 'Madhya Pradesh', type: 'city', aliases: ['उज्जैन'], popularity: 500 },
  { name: 'Dewas', state: 'Madhya Pradesh', type: 'city', aliases: ['देवास'], popularity: 300 },
  { name: 'Satna', state: 'Madhya Pradesh', type: 'city', aliases: ['सतना'], popularity: 300 },
  { name: 'Ratlam', state: 'Madhya Pradesh', type: 'city', aliases: ['रतलाम'], popularity: 300 },
  { name: 'Rewa', state: 'Madhya Pradesh', type: 'city', aliases: ['रीवा'], popularity: 300 },
  { name: 'Sagar', state: 'Madhya Pradesh', type: 'city', aliases: ['सागर'], popularity: 300 },
  { name: 'Singrauli', state: 'Madhya Pradesh', type: 'city', aliases: ['सिंगरौली'], popularity: 200 },
  { name: 'Burhanpur', state: 'Madhya Pradesh', type: 'city', aliases: ['बुरहानपुर'], popularity: 200 },

  // Rajasthan
  { name: 'Jodhpur', state: 'Rajasthan', type: 'city', aliases: ['जोधपुर'], popularity: 600 },
  { name: 'Kota', state: 'Rajasthan', type: 'city', aliases: ['कोटा'], popularity: 500 },
  { name: 'Bikaner', state: 'Rajasthan', type: 'city', aliases: ['बीकानेर'], popularity: 400 },
  { name: 'Udaipur', state: 'Rajasthan', type: 'city', aliases: ['उदयपुर'], popularity: 500 },
  { name: 'Ajmer', state: 'Rajasthan', type: 'city', aliases: ['अजमेर'], popularity: 400 },

  // Gujarat
  { name: 'Surat', state: 'Gujarat', type: 'city', aliases: ['सूरत'], popularity: 700 },
  { name: 'Rajkot', state: 'Gujarat', type: 'city', aliases: ['राजकोट'], popularity: 500 },
  { name: 'Bhavnagar', state: 'Gujarat', type: 'city', aliases: ['भावनगर'], popularity: 400 },
  { name: 'Jamnagar', state: 'Gujarat', type: 'city', aliases: ['जामनगर'], popularity: 400 },

  // Uttar Pradesh
  { name: 'Varanasi', state: 'Uttar Pradesh', type: 'city', aliases: ['वाराणसी', 'Banaras', 'Kashi'], popularity: 700 },
  { name: 'Meerut', state: 'Uttar Pradesh', type: 'city', aliases: ['मेरठ'], popularity: 500 },
  { name: 'Allahabad', state: 'Uttar Pradesh', type: 'city', aliases: ['इलाहाबाद', 'Prayagraj', 'प्रयागराज'], popularity: 600 },
  { name: 'Bareilly', state: 'Uttar Pradesh', type: 'city', aliases: ['बरेली'], popularity: 400 },
  { name: 'Aligarh', state: 'Uttar Pradesh', type: 'city', aliases: ['अलीगढ़'], popularity: 400 },
  { name: 'Moradabad', state: 'Uttar Pradesh', type: 'city', aliases: ['मुरादाबाद'], popularity: 400 },
  { name: 'Ghaziabad', state: 'Uttar Pradesh', type: 'city', aliases: ['गाजियाबाद'], popularity: 500 },
  { name: 'Noida', state: 'Uttar Pradesh', type: 'city', aliases: ['नोएडा'], popularity: 600 },

  // Maharashtra
  { name: 'Aurangabad', state: 'Maharashtra', type: 'city', aliases: ['औरंगाबाद'], popularity: 500 },
  { name: 'Solapur', state: 'Maharashtra', type: 'city', aliases: ['सोलापुर'], popularity: 400 },
  { name: 'Kolhapur', state: 'Maharashtra', type: 'city', aliases: ['कोल्हापुर'], popularity: 400 },
  { name: 'Amravati', state: 'Maharashtra', type: 'city', aliases: ['अमरावती'], popularity: 400 },
  { name: 'Nanded', state: 'Maharashtra', type: 'city', aliases: ['नांदेड़'], popularity: 300 },
  { name: 'Thane', state: 'Maharashtra', type: 'city', aliases: ['ठाणे'], popularity: 500 },

  // Karnataka
  { name: 'Mysore', state: 'Karnataka', type: 'city', aliases: ['मैसूर', 'Mysuru'], popularity: 600 },
  { name: 'Mangalore', state: 'Karnataka', type: 'city', aliases: ['मंगलोर', 'Mangaluru'], popularity: 500 },
  { name: 'Hubli', state: 'Karnataka', type: 'city', aliases: ['हुबली'], popularity: 400 },
  { name: 'Belgaum', state: 'Karnataka', type: 'city', aliases: ['बेलगाम'], popularity: 400 },

  // Tamil Nadu
  { name: 'Coimbatore', state: 'Tamil Nadu', type: 'city', aliases: ['कोयंबटूर'], popularity: 600 },
  { name: 'Madurai', state: 'Tamil Nadu', type: 'city', aliases: ['मदुरई'], popularity: 500 },
  { name: 'Tiruchirappalli', state: 'Tamil Nadu', type: 'city', aliases: ['तिरुचिरापल्ली', 'Trichy'], popularity: 500 },
  { name: 'Salem', state: 'Tamil Nadu', type: 'city', aliases: ['सलेम'], popularity: 400 },

  // Kerala
  { name: 'Kochi', state: 'Kerala', type: 'city', aliases: ['कोच्चि', 'Cochin'], popularity: 600 },
  { name: 'Thiruvananthapuram', state: 'Kerala', type: 'city', aliases: ['तिरुवनंतपुरम', 'Trivandrum'], popularity: 500 },
  { name: 'Kozhikode', state: 'Kerala', type: 'city', aliases: ['कोझिकोड', 'Calicut'], popularity: 500 },

  // Punjab
  { name: 'Amritsar', state: 'Punjab', type: 'city', aliases: ['अमृतसर'], popularity: 600 },
  { name: 'Jalandhar', state: 'Punjab', type: 'city', aliases: ['जालंधर'], popularity: 500 },
  { name: 'Patiala', state: 'Punjab', type: 'city', aliases: ['पटियाला'], popularity: 400 },

  // Haryana
  { name: 'Faridabad', state: 'Haryana', type: 'city', aliases: ['फरीदाबाद'], popularity: 500 },
  { name: 'Gurgaon', state: 'Haryana', type: 'city', aliases: ['गुड़गांव', 'Gurugram'], popularity: 600 },
  { name: 'Panipat', state: 'Haryana', type: 'city', aliases: ['पानीपत'], popularity: 400 },

  // Chhattisgarh
  { name: 'Raipur', state: 'Chhattisgarh', type: 'city', aliases: ['रायपुर'], popularity: 500 },
  { name: 'Bhilai', state: 'Chhattisgarh', type: 'city', aliases: ['भिलाई'], popularity: 400 },
  { name: 'Bilaspur', state: 'Chhattisgarh', type: 'city', aliases: ['बिलासपुर'], popularity: 400 },

  // Jharkhand
  { name: 'Ranchi', state: 'Jharkhand', type: 'city', aliases: ['रांची'], popularity: 500 },
  { name: 'Jamshedpur', state: 'Jharkhand', type: 'city', aliases: ['जमशेदपुर'], popularity: 500 },
  { name: 'Dhanbad', state: 'Jharkhand', type: 'city', aliases: ['धनबाद'], popularity: 400 },

  // Odisha
  { name: 'Bhubaneswar', state: 'Odisha', type: 'city', aliases: ['भुवनेश्वर'], popularity: 500 },
  { name: 'Cuttack', state: 'Odisha', type: 'city', aliases: ['कटक'], popularity: 400 },

  // Assam
  { name: 'Guwahati', state: 'Assam', type: 'city', aliases: ['गुवाहाटी'], popularity: 500 },

  // Uttarakhand
  { name: 'Dehradun', state: 'Uttarakhand', type: 'city', aliases: ['देहरादून'], popularity: 500 },
  { name: 'Haridwar', state: 'Uttarakhand', type: 'city', aliases: ['हरिद्वार'], popularity: 400 },

  // Himachal Pradesh
  { name: 'Shimla', state: 'Himachal Pradesh', type: 'city', aliases: ['शिमला'], popularity: 500 },
  { name: 'Manali', state: 'Himachal Pradesh', type: 'city', aliases: ['मनाली'], popularity: 400 },

  // Jammu & Kashmir
  { name: 'Srinagar', state: 'Jammu and Kashmir', type: 'city', aliases: ['श्रीनगर'], popularity: 500 },
  { name: 'Jammu', state: 'Jammu and Kashmir', type: 'city', aliases: ['जम्मू'], popularity: 500 },

  // Goa
  { name: 'Panaji', state: 'Goa', type: 'city', aliases: ['पणजी'], popularity: 400 },
  { name: 'Margao', state: 'Goa', type: 'city', aliases: ['मडगांव'], popularity: 300 },

  // Add more towns and smaller cities (100+ more)
  // ... You can expand this list to 1000+ cities
];

async function seedLocations() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    console.log('✅ Connected to MongoDB');

    // Clear existing locations
    await Location.deleteMany({});
    console.log('🗑️  Cleared existing locations');

    // Insert cities
    await Location.insertMany(indianCities);
    console.log(`✅ Inserted ${indianCities.length} cities`);

    console.log('🎉 Location seeding completed!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding error:', error);
    process.exit(1);
  }
}

seedLocations();