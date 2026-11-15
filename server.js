const express = require("express");
const path = require("path");
require("dotenv").config();

const app = express();
app.use(express.json());
app.use(express.static(__dirname));

// Explicitly serve the root index.html
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Dedicated Kathmandu NASA POWER endpoint (Lat: 27.7172, Lon: 85.3240)
app.get("/api/nasa-weather", async (req, res) => {
  const lat = "27.7172";
  const lon = "85.3240";

  try {
    const nasaUrl = `https://power.larc.nasa.gov/api/temporal/daily/point?parameters=PRECTOTCORR,T2M&community=RE&longitude=${lon}&latitude=${lat}&start=20240101&end=20240107&format=JSON`;
    
    const response = await fetch(nasaUrl);
    const data = await response.json();
    
    if (!data.properties || !data.properties.parameter) {
      return res.status(500).json({ error: "Invalid response structure from NASA API." });
    }

    const precipitationData = data.properties.parameter.PRECTOTCORR;
    const dates = Object.keys(precipitationData);
    const latestDate = dates[dates.length - 1];
    const rainfallMm = precipitationData[latestDate];

    console.log(`[NASA API Connected] Kathmandu Rainfall: ${rainfallMm} mm/day on ${latestDate}`);

    res.json({ 
      rainfall: rainfallMm !== undefined ? rainfallMm : 0, 
      date: latestDate, 
      location: { lat, lon, name: "Kathmandu" } 
    });
  } catch (error) {
    console.error("NASA API Error:", error);
    res.status(500).json({ error: "Failed to fetch NASA climate data." });
  }
});

app.listen(3000, () => console.log("Server running at http://localhost:3000"));