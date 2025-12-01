/* ============================================================
    OPENROUTESERVICE KEY
============================================================ */
const ORS_API_KEY = "eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6ImQ3MDFmYmU1YzliZTQzYzZiNmQyMjYzYWMyMzYzNTBiIiwiaCI6Im11cm11cjY0In0=";

/* ============================================================
    PIZZA PLACE DATA
============================================================ */
let pizzaPlaces = [
  { name: "Yorkside Pizza", lat: 41.3111904, lon: -72.9298712,
    desc: "Very famous spot, not open as late but great quality and a change-up of the classic New Haven style. With a full large pizza costing $18.50" },

  { name: "Pepes Pizza", lat: 41.3029629, lon: -72.9168943,
    desc: "Classic Italian spot. Their classic peperoni will cost about $17.50." },

  { name: "Pizza Empire", lat: 41.312842, lon: -72.9332021,
    desc: "Great late-night hole-in-the-wall spot. A full pie runs $15.75." },

  { name: "Bar Pizza", lat: 41.3060661, lon: -72.9303862,
    desc: "Good vibes, thin crust, and great weekends. Pizza being on the pricey side with a large costing $25" },

  { name: "Bobbi's Pizza", lat: 41.3116274, lon: -72.9307068,
    desc: "'Detroit style' as advertised — awesome and unique. Will run you $16 for their standard pizza" },

  { name: "EstEstEst", lat: 41.3087258, lon: -72.9335242,
    desc: "Another solid late-night spot, and right by the Yale School of Art for all the students finishing a project late. A large pizza runs around $14.95" },
    
  { name: "Brick Oven Pizza", lat: 41.3121331, lon: -72.9338354, 
    desc: "As the name imples, you can't get a more traditionally cooked pizza. Their classic pies costs $14.50." }
];

/* ============================================================
    MAP SETUP
============================================================ */
const map = L.map("map", { zoomControl: false }).setView([41.3083, -72.9279], 15);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19
}).addTo(map);

/* ============================================================
    PLAYER + COMPASS
============================================================ */
let playerMarker = null;
let arrowMarker  = null;
let targetLatLng = null;

let compassHeading = 0;
function updateCompass() {
  const needle = document.getElementById("compass-needle");
  needle.style.transform = `rotate(${-compassHeading}deg)`;
}
window.addEventListener("deviceorientation", e => {
  if (e.alpha != null) {
    compassHeading = e.alpha;
    updateCompass();
  }
});

/* ============================================================
    ROUTE LAYERS
============================================================ */
let routeLayer = null; // full route

/* ============================================================
    GEOLOCATION & SORTING NEAREST PIZZA PLACES
============================================================ */
let followPlayer = true;

map.on("dragstart", () => followPlayer = false);

function sortPizzaPlacesByDistance() {
  if (!playerMarker) return;

  const user = playerMarker.getLatLng();
  pizzaPlaces.sort((a, b) => {
    const da = Math.hypot(a.lat - user.lat, a.lon - user.lng);
    const db = Math.hypot(b.lat - user.lat, b.lon - user.lng);
    return da - db;
  });

  
  cycleIndex = 0;
}

if ("geolocation" in navigator) {
  navigator.geolocation.watchPosition(
    pos => {
      const lat = pos.coords.latitude;
      const lon = pos.coords.longitude;
      targetLatLng = L.latLng(lat, lon);

      if (!playerMarker) {
        playerMarker = L.marker(targetLatLng, {
          icon: L.icon({
            iconUrl: "Images/person_clean.png",
            iconSize: [50, 50],
            iconAnchor: [25, 25]
          })
        }).addTo(map);

        arrowMarker = L.marker(targetLatLng, {
          icon: L.icon({
            iconUrl: "Images/arrow_up_transparent.png",
            iconSize: [45, 45],
            iconAnchor: [22, 22]
          }),
          rotationAngle: 0,
          rotationOrigin: "center"
        }).addTo(map);
      }

      
      sortPizzaPlacesByDistance();
    },
    err => console.error("GPS error:", err),
    { enableHighAccuracy: true }
  );
}


setInterval(() => {
  if (playerMarker && targetLatLng) {
    const cur = playerMarker.getLatLng();
    const smooth = L.latLng(
      cur.lat + (targetLatLng.lat - cur.lat) * 0.15,
      cur.lng + (targetLatLng.lng - cur.lng) * 0.15
    );

    playerMarker.setLatLng(smooth);
    arrowMarker.setLatLng(smooth);
    arrowMarker.setRotationAngle(compassHeading);

    if (followPlayer) {
      map.panTo(smooth, { animate: true, duration: 0.3 });
    }
  }
}, 50);

/* ============================================================
    ADD PIZZA MARKERS
============================================================ */
let pizzaMarkers = [];

pizzaPlaces.forEach(place => {
  const marker = L.marker([place.lat, place.lon], {
    icon: L.icon({
      iconUrl: "Images/pizza_clean.png",
      iconSize: [45, 45],
      iconAnchor: [22, 22]
    })
  }).addTo(map);

  marker.bindPopup(`<b>${place.name}</b><br>${place.desc}`);
  pizzaMarkers.push(marker);

  marker.on("click", () => {
    pauseAutoCycle();
    followPlayer = false;

    if (!playerMarker) {
      alert("GPS is still loading…");
      return;
    }

    const user = playerMarker.getLatLng();
    requestRoute(user.lat, user.lng, place.lat, place.lon);
  });
});

/* ============================================================
    FULL ROUTE FUNCTION (not preview)
============================================================ */
async function requestRoute(startLat, startLon, endLat, endLon) {
  const url = "https://api.openrouteservice.org/v2/directions/foot-walking/geojson";

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Authorization": ORS_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        coordinates: [[startLon, startLat], [endLon, endLat]]
      })
    });

    const data = await res.json();

    if (routeLayer) routeLayer.remove();

    routeLayer = L.geoJSON(data, {
      style: { color: "red", weight: 4 }
    }).addTo(map);

  } catch (err) {
    console.error("Route request error:", err);
  }
}

/* ============================================================
    AUTO CYCLING (NOW WITH FULL ROUTE + NEAREST ORDER)
============================================================ */
let autoCycleEnabled = false;
let autoCycleInterval = null;
let idleTimeout = null;
let cycleIndex = 0;

const IDLE_DELAY = 10000;

function startAutoCycle() {
  if (autoCycleInterval) return;

  autoCycleEnabled = true;

  autoCycleInterval = setInterval(async () => {
    if (!autoCycleEnabled || !playerMarker) return;

    const place  = pizzaPlaces[cycleIndex];
    const marker = pizzaMarkers[cycleIndex];

    // Switch popup
    pizzaMarkers.forEach(m => m.closePopup());
    marker.openPopup();

    // Pan map
    map.panTo(marker.getLatLng(), { animate: true });

    // Full route
    const user = playerMarker.getLatLng();
    requestRoute(user.lat, user.lng, place.lat, place.lon);

    cycleIndex = (cycleIndex + 1) % pizzaPlaces.length;
  }, 6000);
}

function pauseAutoCycle() {
  autoCycleEnabled = false;
  clearInterval(autoCycleInterval);
  autoCycleInterval = null;
  resetIdleTimer();
}

/* ============================================================
    IDLE DETECTION
============================================================ */
function resetIdleTimer() {
  clearTimeout(idleTimeout);
  idleTimeout = setTimeout(() => startAutoCycle(), IDLE_DELAY);
}

["click", "touchstart", "mousemove", "mousedown", "wheel"].forEach(evt => {
  window.addEventListener(evt, () => pauseAutoCycle());
});

resetIdleTimer();

/* ============================================================
    UI BUTTONS
============================================================ */
document.getElementById("zoom-in").onclick = () => {
  map.zoomIn();
};

document.getElementById("zoom-out").onclick = () => map.zoomOut();

document.getElementById("follow-me").onclick = () => {
  followPlayer = true;
  if (playerMarker) map.panTo(playerMarker.getLatLng());
  pauseAutoCycle();
};
