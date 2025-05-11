// src/App.jsx
// Finalized JSX with map drag refresh + star layout and spacing + Go Back & Go Poop buttons
import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './App.css';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// ⭐ 评分组件
function StarRating({ value, onChange }) {
  return (
    <span style={{ display: 'inline-flex', marginLeft: 8 }}>
      {[1, 2, 3, 4, 5].map(star => (
        <span
          key={star}
          onClick={() => onChange(star)}
          style={{
            fontSize: '1.2rem',
            color: star <= value ? '#FFD700' : '#ccc',
            cursor: 'pointer'
          }}
        >
          ★
        </span>
      ))}
    </span>
  );
}

// 地图点击与拖拽事件处理器
function ClickHandler({ onMapClick, onMapMove }) {
  useMapEvents({
    click(e) {
      const { lat, lng } = e.latlng;
      onMapClick([lat, lng]);
    },
    moveend(e) {
      const center = e.target.getCenter();
      onMapMove([center.lat, center.lng]);
    }
  });
  return null;
}

export default function App() {
  const [mapCenter, setMapCenter] = useState([35.6895, 139.6917]);
  const [toilets, setToilets] = useState([]);
  const [selectedToilet, setSelectedToilet] = useState(null);
  const [addingLocation, setAddingLocation] = useState(null);
  const [newToilet, setNewToilet] = useState({ name: '', description: '' });
  const [address, setAddress] = useState('');
  const [ratings, setRatings] = useState({
    cleanliness: 3,
    accessibility: 3,
    crowd: 3
  });
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [commentRating, setCommentRating] = useState({
    cleanliness: 3,
    accessibility: 3,
    crowd: 3
  });

  // 首次加载：获取浏览器位置 & 拉厕所列表
  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      pos => setMapCenter([pos.coords.latitude, pos.coords.longitude]),
      () => console.warn('Geolocation failed. Using default.')
    );
    fetch('https://sifa-backend.onrender.com/toilets')
      .then(res => res.json())
      .then(data => setToilets(data))
      .catch(err => console.error('Failed to load toilets:', err));
  }, []);

  // 点击定位按钮
  function handleLocate() {
    navigator.geolocation.getCurrentPosition(
      pos => setMapCenter([pos.coords.latitude, pos.coords.longitude]),
      () => alert('无法获取当前位置，请检查定位权限。')
    );
  }

  // 地图点击：放新厕所点 + 地址反查
  function handleMapClick([lat, lng]) {
    setSelectedToilet(null);
    setAddingLocation([lat, lng]);
    setSidebarVisible(true);
    fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`)
      .then(res => res.json())
      .then(data => setAddress(data.display_name || ''))
      .catch(() => setAddress(''));
  }

  // 拖拽结束：更新 center
  function handleMapMove(center) {
    setMapCenter(center);
  }

  // 添加新厕所
  function handleAddNewToilet(e) {
    e.preventDefault();
    const payload = {
      name: newToilet.name,
      description: newToilet.description,
      lat: addingLocation[0],
      lng: addingLocation[1],
      address,
      summary: '',
      comments: [{ text: newToilet.description, timestamp: new Date().toISOString() }],
      ratings,
      createdAt: new Date().toISOString()
    };
    fetch('https://sifa-backend.onrender.com/toilets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(res => res.json())
      .then(entry => {
        setToilets(prev => [...prev, entry]);
        setAddingLocation(null);
        setAddress('');
        setNewToilet({ name: '', description: '' });
        setRatings({ cleanliness: 3, accessibility: 3, crowd: 3 });
      })
      .catch(err => { console.error(err); alert('添加失败 💥'); });
  }

  // 提交评论
  function handleCommentSubmit(e, toiletId) {
    e.preventDefault();
    if (!commentText.trim()) return;
    const newComment = {
      text: commentText.trim(),
      timestamp: new Date().toISOString(),
      ratings: commentRating
    };
    fetch(`https://sifa-backend.onrender.com/toilets/${toiletId}/comment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newComment)
    })
      .then(res => res.json())
      .then(() => {
        setToilets(prev => prev.map(t =>
          t.id === toiletId
            ? {
                ...t,
                comments: [...t.comments, newComment],
                ratings: {
                  cleanliness: [...t.ratings.cleanliness, commentRating.cleanliness],
                  accessibility: [...t.ratings.accessibility, commentRating.accessibility],
                  crowd: [...t.ratings.crowd, commentRating.crowd]
                }
              }
            : t
        ));
        setSelectedToilet(prev => prev ? { ...prev, comments: [...prev.comments, newComment] } : null);
        setCommentText('');
        setCommentRating({ cleanliness: 3, accessibility: 3, crowd: 3 });
      })
      .catch(err => { console.error(err); alert('评论失败 💥'); });
  }

  // 计算距离并排序
  function getDistance(a, b) {
    const toRad = v => (v * Math.PI) / 180;
    const R = 6371e3;
    const φ1 = toRad(a[0]), φ2 = toRad(b[0]);
    const Δφ = toRad(b[0] - a[0]), Δλ = toRad(b[1] - a[1]);
    const x = Δλ * Math.cos((φ1 + φ2) / 2), y = Δφ;
    return Math.sqrt(x*x + y*y) * R;
  }
  const sortedToilets = toilets
    .map(t => ({ ...t, distance: getDistance(mapCenter, [t.lat, t.lng]) }))
    .sort((a, b) => a.distance - b.distance);

  const isMobile = window.innerWidth <= 768;
  const shouldShowSidebar = !isMobile || sidebarVisible;

  // 主渲染
  return (
    <div className="app-container">
      <h1 className="mondrian-header">🚽</h1>
      <div className="map-and-sidebar">
        <div id="map-wrapper" style={{ position: 'relative', flex: shouldShowSidebar ? 2 : 1 }}>
          {/* 定位按钮 */}
          <button
            onClick={handleLocate}
            style={{
              position: 'absolute',
              top: 10,
              right: 10,
              zIndex: 1000,
              background: '#fff',
              border: '2px solid #000',
              padding: '6px 10px',
              cursor: 'pointer'
            }}
          >📍</button>

          {/* 地图 */}
          <MapContainer
            center={mapCenter}
            zoom={14}
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer
              attribution="&copy; OpenStreetMap contributors"
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <ClickHandler onMapClick={handleMapClick} onMapMove={handleMapMove} />
            {/* 所有厕所标记 */}
            {sortedToilets.map(t => (
              <Marker
                key={t.id}
                position={[t.lat, t.lng]}
                eventHandlers={{
                  click: () => {
                    setSelectedToilet(t);
                    setAddingLocation(null);
                    setSidebarVisible(true);
                  }
                }}
              />
            ))}
            {/* 当前中心标记 */}
            <Marker position={mapCenter} />
          </MapContainer>
        </div>

        {/* 侧边栏：保持你原有的完整逻辑 */}
        {shouldShowSidebar && (
          <div className="sidebar">
            <button className="sidebar-toggle" onClick={() => setSidebarVisible(false)}>❌</button>

            {addingLocation ? (
              /* — 新厕所表单 — */
              <div className="sidebar-content">
                <h4>💩 Drop a New Poop Spot</h4>
                <p>
                  <strong>📍 Address:</strong> {address || `${addingLocation[0].toFixed(5)}, ${addingLocation[1].toFixed(5)}`}
                </p>
                <form onSubmit={handleAddNewToilet}>
                  <input
                    type="text"
                    placeholder="Name"
                    value={newToilet.name}
                    onChange={e => setNewToilet({ ...newToilet, name: e.target.value })}
                    required
                  />
                  <textarea
                    placeholder="Comment or description"
                    value={newToilet.description}
                    onChange={e => setNewToilet({ ...newToilet, description: e.target.value })}
                  />

                  {[
                    ['Cleanliness ⭐', 'cleanliness'],
                    ['Accessibility ♿', 'accessibility'],
                    ['Crowdedness 🚶', 'crowd']
                  ].map(([label, key]) => (
                    <div key={key} style={{ marginTop: 12 }}>
                      <label>{label}</label>
                      <StarRating
                        value={ratings[key]}
                        onChange={val => setRatings({ ...ratings, [key]: val })}
                      />
                    </div>
                  ))}

                  <div className="form-button-row">
                    <button type="submit">💾 Drop It</button>
                    <button
                      type="button"
                      onClick={() => { setAddingLocation(null); setAddress(''); }}
                    >❌ Cancel</button>
                  </div>
                </form>
              </div>
            ) : selectedToilet ? (
              /* — 详情 & 评论 — */
              <div className="sidebar-content">
                <button className="button-back" onClick={() => setSelectedToilet(null)}>← Go Back</button>
                <h2>
                  {selectedToilet.name}{' '}
                  <span style={{ fontWeight: 'normal' }}>
                    {averageRating(selectedToilet.ratings)}
                  </span>
                </h2>
                <p>{selectedToilet.description}</p>
                <p>{selectedToilet.address}</p>
                <a
                  className="button-go"
                  href={`https://www.google.com/maps/dir/?api=1&destination=${selectedToilet.lat},${selectedToilet.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >🧭 Go Poop</a>

                <h3>💬 Poop Reviews</h3>
                <ul style={{ padding: 0 }}>
                  {[...selectedToilet.comments]
                    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
                    .map((c, i) => (
                      <li key={i} style={{
                        listStyle: 'none',
                        borderBottom: '1px solid #ccc',
                        paddingBottom: 8,
                        marginBottom: 8
                      }}>
                        {c.text}{' '}
                        <span style={{ color: '#888', fontSize: '0.8rem' }}>
                          ({new Date(c.timestamp).toLocaleString()})
                        </span>
                      </li>
                    ))}
                </ul>
                <form onSubmit={e => handleCommentSubmit(e, selectedToilet.id)}>
                  <input
                    type="text"
                    placeholder="💬 Add your poop review..."
                    value={commentText}
                    onChange={e => setCommentText(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      marginTop: 12,
                      padding: 8,
                      border: '1px solid #000'
                    }}
                  />
                  {[
                    ['Cleanliness ⭐', 'cleanliness'],
                    ['Accessibility ♿', 'accessibility'],
                    ['Crowdedness 🚶', 'crowd']
                  ].map(([label, key]) => (
                    <div key={key} style={{ marginTop: 12 }}>
                      <label>{label}</label>
                      <StarRating
                        value={commentRating[key]}
                        onChange={val => setCommentRating({ ...commentRating, [key]: val })}
                      />
                    </div>
                  ))}
                  <button
                    type="submit"
                    style={{ marginTop: 8, padding: 8, fontWeight: 'bold' }}
                  >💩 Submit</button>
                </form>
              </div>
            ) : (
              /* — 列表视图 — */
              <div className="sidebar-list">
                <h2>📍 Poop Stops Nearby (Closest First)</h2>
                <ul className="toilet-list">
                  {sortedToilets.map(t => (
                    <li
                      key={t.id}
                      className="mondrian-card"
                      onClick={() => { setSelectedToilet(t); setSidebarVisible(true); }}
                      style={{ width: '100%', boxSizing: 'border-box' }}
                    >
                      <div className="block name">{t.name}</div>
                      <div className="block rating">⭐ {averageRating(t.ratings)}</div>
                      <div className="block distance">🚣 {Math.round(t.distance)} m</div>
                      <div className="block summary">{t.summary || 'No summary yet 💩'}</div>
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
}

// 平均评分函数
function averageRating(r) {
  const avg = arr => arr.length
    ? (arr.reduce((a,b) => a+b, 0)/arr.length).toFixed(1)
    : '-';
  return `🧼 ${avg(r.cleanliness)} ♿ ${avg(r.accessibility)} 🚶 ${avg(r.crowd)}`;
}