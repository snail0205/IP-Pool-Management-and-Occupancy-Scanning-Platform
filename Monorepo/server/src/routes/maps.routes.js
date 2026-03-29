const express = require("express");

const router = express.Router();

let worldGeoJsonCache = null;
let worldGeoJsonUpdatedAt = 0;

router.get("/world-geojson", async (req, res, next) => {
  try {
    const now = Date.now();
    if (worldGeoJsonCache && now - worldGeoJsonUpdatedAt < 12 * 3600 * 1000) {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.send(worldGeoJsonCache);
      return;
    }

    const response = await fetch("https://echarts.apache.org/examples/data/asset/geo/world.json");
    if (!response.ok) {
      const err = new Error(`world map fetch failed: ${response.status}`);
      err.status = 502;
      throw err;
    }
    const text = await response.text();
    worldGeoJsonCache = text;
    worldGeoJsonUpdatedAt = now;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.send(text);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
