/* ============================================================
    OPENROUTESERVICE KEY
============================================================ */
const ORS_API_KEY =
  "eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6ImQ3MDFmYmU1YzliZTQzYzZiNmQyMjYzYWMyMzYzNTBiIiwiaCI6Im11cm11cjY0In0=";

/* ============================================================
    PIZZA PLACE DATA
============================================================ */
let pizzaPlaces = [
  {
    name: "Yorkside Pizza",
    lat: 41.3111904,
    lon: -72.9298712,
    desc: "Very famous spot, not open as late but great quality and a change-up of the classic New Haven style. A full large costs $18.50."
  },
  {
    name: "Pepes Pizza",
    lat: 41.3029629,
    lon: -72.9168943,
    desc: "Classic Italian spot. Their classic pepperoni costs about $17.50."
  },
  {
    name: "Pizza Empire",
    lat: 41.312842,
    lon: -72.9332021,
    desc: "Great late-night hole-in-the-wall spot. A full pie runs $15.75."
  },
  {
    name: "Bar Pizza",
    lat: 41.3060661,
    lon: -72.9303862,
    desc: "Good vibes, thin crust, and great weekends. A large costs $25."
  },
  {
    name: "Bobbi's Pizza",
    lat: 41.3116274,
    lon: -72.9307068,
    desc: "'Detroit style' as advertised — awesome and unique. Standard pizza costs $16."
  },
  {
    name: "EstEstEst",
    lat: 41.3087258,
    lon: -72.9335242,
    desc: "Solid late-night spot. A large pizza runs around $14.95."
  },
  {
    name: "Brick Oven Pizza",
    lat: 41.3121331,
    lon: -72.9338354,
    desc: "True brick-oven classic. Their basic pie costs $14.50."
  }
];

/* ============================================================
    MAP SETUP
============================================================ */
const map = L.map("map", { zoomControl: false }).setView(
  [41.3083, -72.9279],
  15
);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19
}).addTo(map);

/* ============================================================
    INFO CARD FUNCTIONS
============================================================ */
function showInfoCard(title, desc) {
  const card = document.getElementById("info-card");
  document.getElementById("info-card-title").innerText = title;
  document.getElementById("info-card-desc").innerText = desc;

  card.classList.add("show");
}

function hideInfoCard() {
  document.getElementById("info-card").classList.remove("show");
}

/* ============================================================
    PLAYER + COMPASS
============================================================ */
let playerMarker = null;
let targetLatLng = null;

let compassHeading = 0;

function updateCompass() {
  document.getElementById("compass-needle").style.transform =
    `rotate(${-compassHeading}deg)`;
}

window.addEventListener("deviceorientation", e => {
  if (e.alpha != null) {
    compassHeading = e.alpha;
    updateCompass();
  }
});

/* ============================================================
    ROUTE LAYER
============================================================ */
let routeLayer = null;

/* ============================================================
    FOLLOW MODE + SORTING
============================================================ */
let followPlayer = true;

map.on("dragstart", () => (followPlayer = false));

/* ============================================================
    SORTING PLACES + MARKERS TOGETHER (IMPORTANT!)
============================================================ */
function sortPizzaPlacesByDistance() {
  if (!playerMarker) return;

  const user = playerMarker.getLatLng();

  // Combine
  const combined = pizzaPlaces.map((p, i) => ({
    place: p,
    marker: pizzaMarkers[i]
  }));

  // Sort by distance
  combined.sort((a, b) => {
    const da = Math.hypot(a.place.lat - user.lat, a.place.lon - user.lng);
    const db = Math.hypot(b.place.lat - user.lat, b.place.lon - user.lng);
    return da - db;
  });

  // Unpack
  pizzaPlaces = combined.map(x => x.place);
  pizzaMarkers = combined.map(x => x.marker);

  cycleIndex = 0;
}

/* ============================================================
    GPS + PLAYER MARKER
============================================================ */
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
      } else {
        playerMarker.setLatLng(targetLatLng);
      }

      if (followPlayer) map.panTo(targetLatLng);

      sortPizzaPlacesByDistance();
    },
    err => console.error("GPS error:", err),
    { enableHighAccuracy: true }
  );
}

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

  pizzaMarkers.push(marker);

  marker.on("click", () => {
    pauseAutoCycle();
    followPlayer = false;

    showInfoCard(place.name, place.desc);

    if (!playerMarker) {
      alert("GPS still loading…");
      return;
    }

    const user = playerMarker.getLatLng();
    requestRoute(user.lat, user.lng, place.lat, place.lon);

    map.flyTo([place.lat, place.lon], 17, { animate: true });
  });
});

/* ============================================================
    ROUTE REQUEST
============================================================ */
async function requestRoute(startLat, startLon, endLat, endLon) {
  const url =
    "https://api.openrouteservice.org/v2/directions/foot-walking/geojson";

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: ORS_API_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        coordinates: [
          [startLon, startLat],
          [endLon, endLat]
        ]
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
    AUTO-CYCLE (IDLE MODE)
============================================================ */
let autoCycleEnabled = false;
let autoCycleInterval = null;
let idleTimeout = null;
let cycleIndex = 0;

const IDLE_DELAY = 10000;

function startAutoCycle() {
  if (autoCycleInterval) return;

  autoCycleEnabled = true;

  autoCycleInterval = setInterval(() => {
    if (!autoCycleEnabled || !playerMarker) return;

    const place = pizzaPlaces[cycleIndex];
    const marker = pizzaMarkers[cycleIndex];

    showInfoCard(place.name, place.desc);

    map.flyTo(marker.getLatLng(), 17, { animate: true });

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
  idleTimeout = setTimeout(startAutoCycle, IDLE_DELAY);
}

["click", "touchstart", "mousemove", "mousedown", "wheel"].forEach(evt => {
  window.addEventListener(evt, pauseAutoCycle);
});

resetIdleTimer();

/* ============================================================
    UI BUTTONS
============================================================ */
document.getElementById("zoom-in").onclick = () => map.zoomIn();
document.getElementById("zoom-out").onclick = () => map.zoomOut();

document.getElementById("follow-me").onclick = () => {
  followPlayer = true;
  if (playerMarker) map.panTo(playerMarker.getLatLng());
  hideInfoCard();
  pauseAutoCycle();
};
