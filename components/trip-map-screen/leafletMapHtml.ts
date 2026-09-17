// Leaflet map HTML — palette-derived colors
// Palette: #111827 #FFFFFF #E53935
export const LEAFLET_MAP_HTML = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    * { margin: 0; padding: 0; }
    html, body, #map { width: 100%; height: 100%; }
    .custom-marker { text-align: center; }
    .custom-marker div { display: flex; align-items: center; justify-content: center; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = L.map('map', { zoomControl: false, attributionControl: false });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(map);

    var routePolylines = [];
    var courierMarker = null;
    var traveledPolyline = null;
    var waypointMarkers = [];

    function handleMessage(data) {
      var msg = typeof data === 'string' ? JSON.parse(data) : data;
      switch(msg.type) {
        case 'INIT_ROUTE':
          routePolylines.forEach(function(l) { map.removeLayer(l); });
          routePolylines = [];
          if (traveledPolyline) { map.removeLayer(traveledPolyline); traveledPolyline = null; }
          waypointMarkers.forEach(function(m) { map.removeLayer(m); });
          waypointMarkers = [];

          msg.segmentCoordinates.forEach(function(seg, i) {
            var latlngs = seg.map(function(c) { return [c[0], c[1]]; });
            var polyline = L.polyline(latlngs, { color: '#111827', weight: 4, opacity: 0.7 }).addTo(map);
            routePolylines.push(polyline);
          });

          var bounds = L.latLngBounds();
          msg.waypoints.forEach(function(wp, i) {
            if (!wp.latitude || !wp.longitude) return;
            var latlng = [wp.latitude, wp.longitude];
            bounds.extend(latlng);
            var color = wp.isFirstInRoute ? '#E53935' : wp.isLastInRoute ? '#E53935' : '#FFFFFF';
            var textColor = wp.isFirstInRoute ? '#FFFFFF' : wp.isLastInRoute ? '#FFFFFF' : '#111827';
            var badgeHtml = wp.count > 1
              ? '<div style="position:absolute;top:-6px;right:-6px;min-width:20px;height:20px;padding:0 4px;border-radius:10px;background:#E53935;color:#FFFFFF;font-weight:700;font-size:10px;border:2px solid #FFFFFF;display:flex;align-items:center;justify-content:center;z-index:1">' + wp.count + '</div>'
              : '';
            var icon = L.divIcon({
              className: 'custom-marker',
              html: '<div style="position:relative;width:38px;height:38px">' +
                '<div style="width:38px;height:38px;border-radius:50%;background:'+color+';color:'+textColor+';font-weight:bold;font-size:15px;border:2px solid #FFFFFF;box-shadow:0 2px 6px rgba(17,24,39,0.4);display:flex;align-items:center;justify-content:center">' + wp.position + '</div>' +
                badgeHtml +
                '</div>',
              iconSize: [38, 38],
              iconAnchor: [19, 19]
            });
            var marker = L.marker(latlng, { icon: icon }).addTo(map);
            marker.on('click', function() {
              window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'MARKER_CLICK', deliveryId: wp.deliveryId }));
            });
            waypointMarkers.push(marker);
          });
          map.fitBounds(bounds, { padding: [40, 40] });
          break;

        case 'UPDATE_POSITION':
          if (courierMarker) {
            courierMarker.setLatLng([msg.latitude, msg.longitude]);
          } else {
            var icon = L.divIcon({
              className: 'custom-marker',
              html: '<div style="width:24px;height:24px;border-radius:50%;background:#111827;border:3px solid #FFFFFF;box-shadow:0 2px 4px rgba(17,24,39,0.5)"></div>',
              iconSize: [24, 24],
              iconAnchor: [12, 12]
            });
            courierMarker = L.marker([msg.latitude, msg.longitude], { icon: icon, zIndexOffset: 0 }).addTo(map);
          }
          break;

        case 'SET_VIEW':
          map.setView([msg.latitude, msg.longitude], msg.zoom || 15);
          break;

        case 'UPDATE_TRAVELED':
          if (traveledPolyline) { map.removeLayer(traveledPolyline); }
          var latlngs = msg.traveledCoords.map(function(c) { return [c[0], c[1]]; });
          traveledPolyline = L.polyline(latlngs, { color: '#E53935', weight: 5, opacity: 0.9 }).addTo(map);
          break;

        case 'UPDATE_TARGET':
          waypointMarkers.forEach(function(m, i) {
            if (i === msg.groupIndex) {
              m.setZIndexOffset(1000);
            } else {
              m.setZIndexOffset(0);
            }
          });
          break;

        default:
          break;
      }
    }

    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'MAP_READY' }));
  </script>
</body>
</html>
`;
