const express = require('express');
const router = express.Router();
const YatraPackage = require('../models/YatraPackage');

// Handle /share/yatra/:id
router.get('/yatra/:id', async (req, res) => {
  const { id } = req.params;
  
  let pkg = null;
  try {
    pkg = await YatraPackage.findById(id);
  } catch (err) {
    console.error('Error fetching yatra in share endpoint:', err);
  }

  const deepLink = `nightbus://yatra/${id}`;
  const fallbackUrl = "https://play.google.com/store/apps/details?id=com.nightbus.app"; // Fallback store link

  let title = "Check out this Yatra Package!";
  let description = "I found this great journey package. Click to open in the app!";
  let html = '';

  if (!pkg) {
    title = "Yatra Not Found";
    description = "This Yatra package has departed or is no longer available.";
    
    html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title}</title>
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&display=swap" rel="stylesheet">
        <style>
          body {
            font-family: 'Outfit', sans-serif;
            background: linear-gradient(135deg, #0f172a 0%, #020617 100%);
            color: #f1f5f9;
            margin: 0;
            padding: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            text-align: center;
          }
          .glass-card {
            background: rgba(30, 41, 59, 0.45);
            backdrop-filter: blur(16px);
            -webkit-backdrop-filter: blur(16px);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 24px;
            padding: 40px 30px;
            max-width: 420px;
            width: 90%;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
          }
          .icon {
            font-size: 64px;
            margin-bottom: 20px;
          }
          h1 {
            font-size: 26px;
            font-weight: 800;
            margin: 0 0 10px 0;
            color: #ef4444;
          }
          p {
            font-size: 15px;
            color: #94a3b8;
            line-height: 1.6;
            margin-bottom: 30px;
          }
          .btn-download {
            display: block;
            background: linear-gradient(90deg, #6366f1 0%, #4f46e5 100%);
            color: #fff;
            font-weight: 600;
            text-decoration: none;
            padding: 14px 28px;
            border-radius: 12px;
            transition: all 0.3s ease;
            box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
          }
          .btn-download:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(99, 102, 241, 0.4);
          }
        </style>
      </head>
      <body>
        <div class="glass-card">
          <div class="icon">🛕</div>
          <h1>${title}</h1>
          <p>${description}</p>
          <a href="${fallbackUrl}" class="btn-download">Download Night Bus App</a>
        </div>
      </body>
      </html>
    `;
  } else {
    title = `Yatra: ${pkg.title}`;
    description = pkg.description || "Join us on this pilgrimage journey!";
    const formattedPrice = pkg.pricePerPerson ? pkg.pricePerPerson.toLocaleString() : '—';
    
    let dates = 'Dates pending';
    if (pkg.startDate && pkg.endDate) {
      dates = `${new Date(pkg.startDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} - ${new Date(pkg.endDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`;
    }
    
    let catEmoji = '🛕';
    if (pkg.category === 'adventure') catEmoji = '⛰️';
    if (pkg.category === 'heritage') catEmoji = '🏛️';
    if (pkg.category === 'leisure') catEmoji = '🌴';

    html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        
        <!-- Open Graph Meta Tags -->
        <meta property="og:title" content="${title}">
        <meta property="og:description" content="Destination: ${pkg.destinationCity} | Price: ₹${formattedPrice}/- per person. Click to open in app!">
        <meta property="og:type" content="website">
        
        <title>${title}</title>
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700;800&display=swap" rel="stylesheet">
        <style>
          body {
            font-family: 'Outfit', sans-serif;
            background: linear-gradient(135deg, #0b0f19 0%, #030712 100%);
            color: #f3f4f6;
            margin: 0;
            padding: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 90vh;
          }
          .glass-card {
            background: rgba(17, 24, 39, 0.6);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 28px;
            padding: 30px;
            max-width: 440px;
            width: 100%;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
            box-sizing: border-box;
          }
          .header-badge {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            background: rgba(99, 102, 241, 0.15);
            color: #a5b4fc;
            padding: 6px 14px;
            border-radius: 50px;
            font-size: 12px;
            font-weight: 700;
            letter-spacing: 0.5px;
            margin-bottom: 20px;
            text-transform: uppercase;
            border: 1px solid rgba(99, 102, 241, 0.2);
          }
          h1 {
            font-size: 24px;
            font-weight: 800;
            margin: 0 0 8px 0;
            line-height: 1.3;
            color: #fff;
          }
          .dates {
            font-size: 14px;
            color: #9ca3af;
            margin-bottom: 24px;
            display: flex;
            align-items: center;
            gap: 6px;
            font-weight: 500;
          }
          .divider {
            height: 1px;
            background: rgba(255, 255, 255, 0.08);
            margin: 20px 0;
          }
          .info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 16px;
            margin-bottom: 28px;
          }
          .info-box {
            background: rgba(255, 255, 255, 0.03);
            border: 1px solid rgba(255, 255, 255, 0.05);
            border-radius: 16px;
            padding: 12px 16px;
          }
          .info-label {
            font-size: 11px;
            color: #6b7280;
            text-transform: uppercase;
            font-weight: 700;
            letter-spacing: 0.5px;
            margin-bottom: 4px;
          }
          .info-value {
            font-size: 15px;
            font-weight: 700;
            color: #e5e7eb;
          }
          .price-box {
            background: linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(5, 150, 105, 0.1) 100%);
            border: 1px solid rgba(16, 185, 129, 0.2);
          }
          .price-box .info-label {
            color: #34d399;
          }
          .price-box .info-value {
            color: #10b981;
            font-size: 18px;
          }
          .btn-primary {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            background: linear-gradient(90deg, #10b981 0%, #059669 100%);
            color: #fff;
            font-weight: 700;
            text-decoration: none;
            padding: 15px;
            border-radius: 16px;
            font-size: 15px;
            transition: all 0.3s ease;
            box-shadow: 0 4px 15px rgba(16, 185, 129, 0.35);
            margin-bottom: 12px;
          }
          .btn-primary:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(16, 185, 129, 0.45);
          }
          .btn-secondary {
            display: block;
            text-align: center;
            background: transparent;
            color: #9ca3af;
            border: 1px solid rgba(255, 255, 255, 0.15);
            font-weight: 600;
            text-decoration: none;
            padding: 13px;
            border-radius: 16px;
            font-size: 14px;
            transition: all 0.3s ease;
          }
          .btn-secondary:hover {
            background: rgba(255, 255, 255, 0.05);
            color: #fff;
          }
          .loader-row {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            margin-bottom: 20px;
            font-size: 13px;
            color: #6366f1;
            font-weight: 600;
          }
          .spinner {
            width: 18px;
            height: 18px;
            border: 2px solid rgba(99, 102, 241, 0.2);
            border-top-color: #6366f1;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
          }
          @keyframes spin { to { transform: rotate(360deg); } }
        </style>
      </head>
      <body>
        <div class="glass-card">
          <div class="loader-row">
            <div class="spinner"></div>
            <span>Opening Night Bus App...</span>
          </div>

          <div class="header-badge">
            <span>${catEmoji} ${pkg.category} yatra</span>
          </div>

          <h1>${pkg.title}</h1>
          <div class="dates">📅 ${dates}</div>

          <div class="info-grid">
            <div class="info-box">
              <div class="info-label">Route</div>
              <div class="info-value">${pkg.departurePoint?.city} → ${pkg.destinationCity}</div>
            </div>
            <div class="info-box price-box">
              <div class="info-label">Price</div>
              <div class="info-value">₹${formattedPrice}</div>
            </div>
          </div>

          <a href="${deepLink}" class="btn-primary">
            <span>Open in App</span>
          </a>
          <a href="${fallbackUrl}" class="btn-secondary">Download App</a>
        </div>

        <script>
          // Automatic redirect to app
          window.location.href = "${deepLink}";
          
          // Fallback to store after 3.5 seconds
          setTimeout(function() {
            if (document.visibilityState !== 'hidden') {
              window.location.href = "${fallbackUrl}";
            }
          }, 3500);
        </script>
      </body>
      </html>
    `;
  }

  res.send(html);
});

module.exports = router;
