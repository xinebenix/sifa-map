// Finalized JSX with map drag refresh + star layout and spacing + Go Back & Go Poop buttons
import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './App.css';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

function StarRating({ value, onChange }) {
  return (
    <span style={{ display: 'inline-flex', marginLeft: '8px' }}>
      {[1, 2, 3, 4, 5].map((star) => (
        <span
          key={star}
          onClick={() => onChange(star)}
          style={{ fontSize: '1.2rem', color: star <= value ? '#FFD700' : '#ccc', cursor: 'pointer' }}
        >
          ★
        </span>
      ))}
    </span>
  );
}

function App() {
  const [mapCenter, setMapCenter] = useState([35.6895, 139.6917]);
  const [toilets, setToilets] = useState([]);
  const [selectedToilet, setSelectedToilet] = useState(null);
  const [addingLocation, setAddingLocation] = useState(null);
  const [newToilet, setNewToilet] = useState({ name: '', description: '' });
  const [address, setAddress] = useState('');
  const [ratings, setRatings] = useState({ cleanliness: 3, accessibility: 3, crowd: 3 });
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [commentRating, setCommentRating] = useState({ cleanliness: 3, accessibility: 3, crowd: 3 });

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => setMapCenter([pos.coords.latitude, pos.coords.longitude]),
      () => console.warn('Geolocation failed. Using default location.')
    );
    fetchToilets();
  }, []);

  function fetchToilets() {
    fetch("http://localhost:3000/toilets")
      .then(res => res.json())
      .then(data => setToilets(data))
      .catch(err => console.error("Failed to load toilets:", err));
  }

  function ClickHandler() {
    useMapEvents({
      click(e) {
        const lat = e.latlng.lat;
        const lng = e.latlng.lng;
        setSelectedToilet(null);
        setAddingLocation([lat, lng]);
        setSidebarVisible(true);
        fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`)
          .then(res => res.json())
          .then(data => setAddress(data.display_name || ''))
          .catch(() => setAddress(''));
      },
      moveend(e) {
        const center = e.target.getCenter();
        setMapCenter([center.lat, center.lng]);
      }
    });
    return null;
  }

  function handleAddNewToilet(e) {
    e.preventDefault();
    const payload = {
      name: newToilet.name,
      description: newToilet.description,
      lat: addingLocation[0],
      lng: addingLocation[1],
      address,
      summary: "",
      comments: [{ text: newToilet.description, timestamp: new Date().toISOString() }],
      ratings,
      createdAt: new Date().toISOString()
    };

    fetch("http://localhost:3000/toilets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    })
      .then(res => res.json())
      .then(newToiletEntry => {
        setToilets(prev => [...prev, newToiletEntry]);
        setAddingLocation(null);
        setAddress('');
        setNewToilet({ name: '', description: '' });
        setRatings({ cleanliness: 3, accessibility: 3, crowd: 3 });
      })
      .catch(err => {
        console.error("Failed to add toilet:", err);
        alert("Something went wrong 💥");
      });
  }

  function handleCommentSubmit(e, toiletId) {
    e.preventDefault();
    if (!commentText.trim()) return;

    const newCommentData = {
      text: commentText.trim(),
      timestamp: new Date().toISOString(),
      ratings: commentRating
    };

    fetch(`http://localhost:3000/toilets/${toiletId}/comment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newCommentData)
    })
      .then(res => res.json())
      .then(() => {
        setToilets(prev => prev.map(t =>
          t.id === toiletId ? {
            ...t,
            comments: [...t.comments, newCommentData],
            ratings: {
              cleanliness: [...t.ratings.cleanliness, commentRating.cleanliness],
              accessibility: [...t.ratings.accessibility, commentRating.accessibility],
              crowd: [...t.ratings.crowd, commentRating.crowd]
            }
          } : t
        ));
        setSelectedToilet(prev => prev ? { ...prev, comments: [...prev.comments, newCommentData] } : null);
        setCommentText('');
        setCommentRating({ cleanliness: 3, accessibility: 3, crowd: 3 });
      })
      .catch(err => {
        console.error("Comment error:", err);
        alert("💥 Failed to add comment");
      });
  }

  const sortedToilets = toilets.map((t) => ({
    ...t,
    distance: getDistance(mapCenter, [t.lat, t.lng])
  })).sort((a, b) => a.distance - b.distance);

  function getDistance(a, b) {
    const toRad = (value) => (value * Math.PI) / 180;
    const R = 6371e3;
    const φ1 = toRad(a[0]);
    const φ2 = toRad(b[0]);
    const Δφ = toRad(b[0] - a[0]);
    const Δλ = toRad(b[1] - a[1]);
    const x = Δλ * Math.cos((φ1 + φ2) / 2);
    const y = Δφ;
    return Math.sqrt(x * x + y * y) * R;
  }

  const isMobile = window.innerWidth <= 768;
  const shouldShowSidebar = !isMobile || sidebarVisible;

  return (
    <div className="app-container">
      <h1 className="mondrian-header">🚽</h1>
      <div className="map-and-sidebar">
        <div id="map-wrapper" style={{ flex: shouldShowSidebar ? 2 : 1 }}>
          <MapContainer center={mapCenter} zoom={14} style={{ height: '100%', width: '100%' }}>
            <TileLayer attribution='&copy; OpenStreetMap contributors' url='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png' />
            <ClickHandler />
            {toilets.map((t) => (
              <Marker key={t.id} position={[t.lat, t.lng]} eventHandlers={{
                click: () => {
                  setSelectedToilet(t);
                  setAddingLocation(null);
                  setSidebarVisible(true);
                },
              }} />
            ))}
            <Marker position={mapCenter} />
          </MapContainer>
        </div>

        {shouldShowSidebar && (
          <div className="sidebar">
            <button className="sidebar-toggle" onClick={() => setSidebarVisible(false)}>❌</button>

            {addingLocation ? (
              <div className="sidebar-content">
                <h4>💩 Drop a New Poop Spot</h4>
                <p><strong>📍 Address:</strong> {address || `${addingLocation[0].toFixed(5)}, ${addingLocation[1].toFixed(5)}`}</p>
                <form onSubmit={handleAddNewToilet}>
                  <input type="text" placeholder="Name" value={newToilet.name} onChange={(e) => setNewToilet({ ...newToilet, name: e.target.value })} required />
                  <textarea placeholder="Comment or description" value={newToilet.description} onChange={(e) => setNewToilet({ ...newToilet, description: e.target.value })} />

                  {[['Cleanliness ⭐', 'cleanliness'], ['Accessibility ♿', 'accessibility'], ['Crowdedness 🚶', 'crowd']].map(([label, key]) => (
                    <div key={key} style={{ marginTop: '12px' }}>
                      <label>{label}</label>
                      <StarRating value={ratings[key]} onChange={(val) => setRatings({ ...ratings, [key]: val })} />
                    </div>
                  ))}

                  <div className="form-button-row">
                    <button type="submit">💾 Drop It</button>
                    <button type="button" onClick={() => { setAddingLocation(null); setAddress(''); }}>❌ Cancel</button>
                  </div>
                </form>
              </div>
            ) : selectedToilet ? (
              <div className="sidebar-content">
                <button className="button-back" onClick={() => setSelectedToilet(null)}>← Go Back</button>
                <h2>{selectedToilet.name} <span style={{ fontWeight: 'normal' }}>{averageRating(selectedToilet.ratings)}</span></h2>
                <p>{selectedToilet.description}</p>
                <p>{selectedToilet.address}</p>

                <a
                  className="button-go"
                  href={`https://www.google.com/maps/dir/?api=1&destination=${selectedToilet.lat},${selectedToilet.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  🧭 Go Poop
                </a>

                <h3>💬 Poop Reviews</h3>
                <ul style={{ padding: 0 }}>
                  {[...selectedToilet.comments].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).map((comment, index) => (
                    <li key={index} style={{ listStyle: 'none', borderBottom: '1px solid #ccc', paddingBottom: '8px', marginBottom: '8px' }}>
                      {comment.text} <span style={{ color: '#888', fontSize: '0.8rem' }}>({new Date(comment.timestamp).toLocaleString()})</span>
                    </li>
                  ))}
                </ul>
                <form onSubmit={(e) => handleCommentSubmit(e, selectedToilet.id)}>
                  <input type="text" name="comment" placeholder="💬 Add your poop review..." value={commentText} onChange={(e) => setCommentText(e.target.value)} required style={{ width: '100%', marginTop: '12px', padding: '8px', border: '1px solid #000' }} />

                  {[['Cleanliness ⭐', 'cleanliness'], ['Accessibility ♿', 'accessibility'], ['Crowdedness 🚶', 'crowd']].map(([label, key]) => (
                    <div key={key} style={{ marginTop: '12px' }}>
                      <label>{label}</label>
                      <StarRating value={commentRating[key]} onChange={(val) => setCommentRating({ ...commentRating, [key]: val })} />
                    </div>
                  ))}

                  <button type="submit" style={{ marginTop: '8px', padding: '8px', fontWeight: 'bold' }}>💩 Submit</button>
                </form>
              </div>
            ) : (
              <div className="sidebar-list">
                <h2>📍 Poop Stops Nearby (Closest First)</h2>
                <ul className="toilet-list">
                  {sortedToilets.map((toilet) => (
                    <li key={toilet.id} className="mondrian-card" onClick={() => {
                      setSelectedToilet(toilet);
                      setSidebarVisible(true);
                    }} style={{ width: '100%', boxSizing: 'border-box' }}>
                      <div className="block name">{toilet.name}</div>
                      <div className="block rating">⭐ {averageRating(toilet.ratings)}</div>
                      <div className="block distance">🚣 {Math.round(toilet.distance)} m</div>
                      <div className="block summary">{toilet.summary || 'No summary yet 💩'}</div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  function averageRating(r) {
    const avg = (arr) => arr.length ? (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1) : "-";
    return `🧼 ${avg(r.cleanliness)} ♿ ${avg(r.accessibility)} 🚶 ${avg(r.crowd)}`;
  }
}

export default App;