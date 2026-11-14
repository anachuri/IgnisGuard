
 # 🌍 FuegoControl: Harmonized Fire Activity & Predictive Risk Calendar
 
﻿# pointHarmonization

> **NASA Space Apps Challenge Submission**  
> *Transforming 20+ years of fragmented satellite fire data into a unified, predictive, and interactive ecological intelligence platform.*

---

## 🚀 The Challenge

Understanding how burning activity is distributed across our planet over time—including wildfires and agricultural burns intense enough to be detected by satellite sensors—enables communities and authorities to anticipate critical periods, guide monitoring efforts, and improve fire response. 

Satellites have tracked active fire hotspots for more than two decades, but the record is split across sensors whose data cannot be compared directly (such as MODIS vs. VIIRS). This fragmentation leaves fire managers without a consistent, long-term picture of when and where burning has occurred. 

**Our Solution:** **OrbiTag** bridges this gap by harmonizing historical records into a unified active-fire calendar, leveraging machine learning to predict future fire risks, and auditing post-fire vegetation and biomass recovery in real time.

---

## 🛰️ Data Sources & Satellites Used

To build a robust 20+ year harmonized time series, OrbiTag integrates multi-sensor satellite architectures and environmental data streams:

1. **NASA FIRMS (Fire Information for Resource Management System):**
   * **MODIS (Terra & Aqua):** Provides historical records from 2000 onward at a ~1 km spatial resolution, capturing macro-trends and long-term seasonality.
   * **VIIRS (Suomi NPP, NOAA-20 & NOAA-21):** Delivers high-resolution (375 m) active fire detection from 2012 to the present, capturing smaller fire fronts and high-precision boundaries.
   * *Cross-Calibration:* Uses the overlap period (2012+) to harmonize Radiative Power (FRP) and unify detection densities across sensors.
2. **Vegetation & Biomass Recovery (Sentinel-2 / MODIS Surface Reflectance):**
   * Computes spectral indices such as **NDVI** (Normalized Difference Vegetation Index) and **dNBR** (Differenced Normalized Burn Ratio) to evaluate fire severity and calculate real-time vegetation recovery percentages post-fire.
3. **Meteomatics Weather API (Official Sponsor):**
   * Supplies high-resolution historical and forecasted atmospheric data (temperature, relative humidity, wind speed/direction, and barometric pressure) to feed environmental features into the predictive model.

---

## 🧠 Core Features & Architecture

* **🌌 Immersive Space-Theered Frontend (React + MapLibre GL):** An exploratory interface featuring a deep-space dark background, a rotating Earth globe, and glowing active-fire hotspots mapped onto an **Uber H3 spatial hexagonal grid**.
* **📈 Cross-Sensor Harmonization Engine (Python + Pandas + H3):** Normalizes, deduplicates, and cross-calibrates multi-decadal hotspot detections into a unified daily/weekly spatial index.
* **🔮 Predictive Risk Modeling (XGBoost):** Combines historical fire frequencies, vegetative stress indices, and live/forecasted meteorological data from **Meteomatics** to output an exact percentage probability of future fire risk for any selected area and future date.
* **📊 Historical Audits & Biomass Recovery Dashboard:** A D3.js activity calendar showing seasonal burning patterns alongside a live metric tracking the **percentage of vegetation and dry matter recovery** since past fire events.
* **☁️ Production Hosting (GoDaddy):** Deployed on a high-performance domain provided by GoDaddy for seamless public and judge evaluation.

---

## 🛠️ Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend** | React, TypeScript, Tailwind CSS, MapLibre GL, D3.js |
| **Backend & API** | Spring Boot / Python FastAPI |
| **Data Processing** | Python, Pandas, GeoPandas, Uber H3 Spatial Grid |
| **Machine Learning** | XGBoost (Predictive Risk Modeling) |
| **Oracles & APIs** | NASA FIRMS, Meteomatics Weather API, Sentinel-2 |
| **Infrastructure** | GoDaddy Hosting & Domain Management |
