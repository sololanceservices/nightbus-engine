const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const axios = require('axios');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/bus_app').then(async () => {
  try {
    const customerId = '698c1afa493735be635d55ba'; 
    const token = jwt.sign({ id: customerId }, process.env.JWT_SECRET || 'your_jwt_secret_key_change_this_in_production', { expiresIn: '1d' });
    
    console.log("Token generated.");
    const res = await axios.get(`http://localhost:5000/api/bookings/user/${customerId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    console.log("API Response Length:", res.data?.bookings?.length);
    // console.log(JSON.stringify(res.data, null, 2));
  } catch (err) {
    console.error('Error:', err.message);
    if(err.response) {
      console.error(err.response.data);
    }
  }

  mongoose.disconnect();
});
