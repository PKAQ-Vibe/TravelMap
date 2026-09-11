import { useEffect, useRef, useState } from 'react'
import { Marker, Scene } from '@antv/l7'
import { MapLibre } from '@antv/l7-maps'

const SOPHIA = {
  name: '索菲亚大教堂',
  lng: 126.6218,
  lat: 45.7681,
  type: '历史建筑',
  district: '道里区',
}

const mapStyle = {
  version: 8,
  sources: {
    openStreetMap: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors',
    },
  },
  layers: [{ id: 'openStreetMap', type: 'raster', source: 'openStreetMap' }],
}

function createPlaceMarker(onSelect) {
  const marker = document.createElement('button')
  marker.className = 'place-marker'
  marker.type = 'button'
  marker.setAttribute('aria-label', `查看${SOPHIA.name}`)
  marker.innerHTML = `
    <span class="place-label">${SOPHIA.name}</span>
    <span class="pin" aria-hidden="true"><span></span></span>
    <span class="pin-shadow" aria-hidden="true"></span>
  `
  marker.addEventListener('click', onSelect)
  return marker
}

export default function App() {
  const mapRef = useRef(null)
  const sceneRef = useRef(null)
  const [loaded, setLoaded] = useState(false)
  const [selectedPlace, setSelectedPlace] = useState(null)
  const [city, setCity] = useState('哈尔滨')
  const [category, setCategory] = useState('全部景点')
  const [view, setView] = useState('地图模式')

  useEffect(() => {
    if (!mapRef.current || sceneRef.current) return undefined

    const scene = new Scene({
      id: mapRef.current,
      logoVisible: false,
      map: new MapLibre({
        style: mapStyle,
        center: [SOPHIA.lng, SOPHIA.lat],
        zoom: 13.1,
        minZoom: 3,
        maxZoom: 18,
        pitch: 0,
      }),
    })

    sceneRef.current = scene
    scene.on('loaded', () => {
      const markerElement = createPlaceMarker(() => setSelectedPlace(SOPHIA))
      const marker = new Marker({ element: markerElement, anchor: 'bottom' })
        .setLnglat([SOPHIA.lng, SOPHIA.lat])
      scene.addMarker(marker)
      setLoaded(true)
    })

    return () => {
      scene.destroy()
      sceneRef.current = null
    }
  }, [])

  return (
    <main className="workspace">
      <section className="map-panel" aria-label="哈尔滨景点地图">
        <div ref={mapRef} className="map" />

        <header className="filter-panel" aria-label="地图筛选">
          <label>
            <span>城市</span>
            <select value={city} onChange={(event) => setCity(event.target.value)}>
              <option>哈尔滨</option>
            </select>
          </label>
          <label>
            <span>类型</span>
            <select value={category} onChange={(event) => setCategory(event.target.value)}>
              <option>全部景点</option>
              <option>历史建筑</option>
            </select>
          </label>
          <label>
            <span>视图</span>
            <select value={view} onChange={(event) => setView(event.target.value)}>
              <option>地图模式</option>
              <option>卫星模式</option>
            </select>
          </label>
        </header>

        <footer className="month-panel" aria-label="当前月份">
          <button type="button" aria-label="上个月">‹</button>
          <strong>2026年10月</strong>
          <button type="button" aria-label="下个月">›</button>
        </footer>

        {!loaded && <div className="loading" role="status">地图加载中…</div>}
      </section>

      <aside className={`detail-panel${selectedPlace ? ' detail-panel--active' : ''}`} aria-live="polite">
        {selectedPlace ? (
          <>
            <div className="detail-head">
              <span className="detail-kicker">景点详情</span>
              <button type="button" onClick={() => setSelectedPlace(null)} aria-label="关闭详情">×</button>
            </div>
            <div className="detail-visual" aria-hidden="true"><span>⛪</span></div>
            <h1>{selectedPlace.name}</h1>
            <dl>
              <div><dt>城市</dt><dd>哈尔滨</dd></div>
              <div><dt>区域</dt><dd>{selectedPlace.district}</dd></div>
              <div><dt>类型</dt><dd>{selectedPlace.type}</dd></div>
            </dl>
          </>
        ) : (
          <div className="detail-empty">
            <span className="empty-pin" aria-hidden="true">⌖</span>
            <strong>点击景点后查看详情</strong>
            <p>地图上的蓝色标记可查看</p>
          </div>
        )}
      </aside>
    </main>
  )
}
