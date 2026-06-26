const express = require('express');
const router = express.Router();
const Journey = require('../models/Journey');

// Handle /share/yatra/:id
router.get('/yatra/:id', async (req, res) => {
  const { id } = req.params;
  
  // You could optionally fetch journey details to populate OG tags dynamically
  const title = "Check out this Yatra Package!";
  const description = "I found this great journey package. Click to open in the app!";
  const fallbackUrl = "https://play.google.com/store/apps/details?id=com.nightbus.app"; // Placeholder
  const deepLink = `nightbus://yatra/${id}`;

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      
      <!-- Open Graph meta tags for nice previews on WhatsApp/Facebook -->
      <meta property="og:title" content="${title}">
      <meta property="og:description" content="${description}">
      <meta property="og:type" content="website">
      <!-- <meta property="og:image" content="https://server.nightbusjourney.com/default-share-image.png"> -->
      
      <title>${title}</title>
      
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; text-align: center; padding: 40px 20px; background-color: #f9fafb; color: #111827; }
        .container { max-width: 500px; margin: 0 auto; background: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        h1 { font-size: 24px; margin-bottom: 10px; }
        p { color: #6b7280; margin-bottom: 24px; line-height: 1.5; }
        .btn { display: inline-block; background-color: #10b981; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; margin: 5px; }
        .btn-outline { background-color: white; color: #10b981; border: 2px solid #10b981; }
        .spinner { margin: 20px auto; width: 40px; height: 40px; border: 4px solid rgba(16, 185, 129, 0.2); border-top-color: #10b981; border-radius: 50%; animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="spinner"></div>
        <h1>Opening App...</h1>
        <p>If you have the app installed, it will open automatically.</p>
        
        <p>If nothing happens within a few seconds, you can download the app or try opening it manually.</p>
        
        <a href="${deepLink}" class="btn">Open in App</a>
        <a href="${fallbackUrl}" class="btn btn-outline">Download App</a>
      </div>

      <script>
        // Try to open the deep link
        window.location.href = "${deepLink}";
        
        // Fallback to the store link if the app doesn't open
        setTimeout(function() {
          // If the page is still visible, the app probably didn't open
          if (document.visibilityState !== 'hidden') {
            window.location.href = "${fallbackUrl}";
          }
        }, 3000); // Wait 3 seconds before fallback
      </script>
    </body>
    </html>
  `;
  
  res.send(html);
});

module.exports = router;
