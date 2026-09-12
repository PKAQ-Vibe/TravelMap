import { useEffect, useRef, useState } from 'react'
import { LineLayer, PolygonLayer, Scene } from '@antv/l7'
import { Marker } from '@antv/l7-component'
import { GaodeMap } from '@antv/l7-maps'
import { Button, Card } from 'animal-island-ui'
import 'animal-island-ui/style'
import travelData from './data/travel-data.json'

const DESTINATIONS = travelData.destinations
const DEFAULT_DESTINATION = DESTINATIONS[0]
const PLACES = DEFAULT_DESTINATION.places
const CONNECTIONS = DEFAULT_DESTINATION.connections || []
const REGIONS = DEFAULT_DESTINATION.dayPlans || []

const SOPHIA = PLACES.find((place) => place.name === '索菲亚大教堂')

const CITY_STOPS = DESTINATIONS.map(({ name, date, dateTime }) => ({ name, date, dateTime }))
const formatPlaceName = (place) => `${place.name}${place.reservationDays ? `（提前 ${place.reservationDays} 天约）` : ''}`
function createPlaceMarker(place, onSelect) {
  const marker = document.createElement('button')
  marker.className = 'place-marker'
  marker.type = 'button'
  marker.setAttribute('aria-label', `查看${formatPlaceName(place)}`)
  marker.innerHTML = `
    <span class="place-label">${formatPlaceName(place)}</span>
    <span class="pin" aria-hidden="true"><span></span></span>
    <span class="pin-shadow" aria-hidden="true"></span>
  `
  marker.addEventListener('click', onSelect)
  return marker
}

function createDayLabel(text) {
  const label = document.createElement('div')
  label.className = 'day-region-label'
  label.textContent = text
  return label
}

function createCurvedRoute(from, to, curveDirection = 1) {
  const start = [from.lng, from.lat]
  const end = [to.lng, to.lat]
  const dx = end[0] - start[0]
  const dy = end[1] - start[1]
  const distance = Math.hypot(dx, dy)
  const bend = Math.min(distance * 0.16, 0.035) * curveDirection
  const control = [
    (start[0] + end[0]) / 2 - (dy / distance) * bend,
    (start[1] + end[1]) / 2 + (dx / distance) * bend,
  ]
  const pointAt = (t) => {
    const inverse = 1 - t
    return [
      inverse * inverse * start[0] + 2 * inverse * t * control[0] + t * t * end[0],
      inverse * inverse * start[1] + 2 * inverse * t * control[1] + t * t * end[1],
    ]
  }
  const coordinates = Array.from({ length: 33 }, (_, index) => pointAt(index / 32))
  return coordinates
}

function convexHull(points) {
  const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1])
  if (sorted.length <= 2) return sorted
  const cross = (origin, a, b) => (a[0] - origin[0]) * (b[1] - origin[1]) - (a[1] - origin[1]) * (b[0] - origin[0])
  const lower = []
  sorted.forEach((point) => {
    while (lower.length >= 2 && cross(lower.at(-2), lower.at(-1), point) <= 0) lower.pop()
    lower.push(point)
  })
  const upper = []
  sorted.toReversed().forEach((point) => {
    while (upper.length >= 2 && cross(upper.at(-2), upper.at(-1), point) <= 0) upper.pop()
    upper.push(point)
  })
  return [...lower.slice(0, -1), ...upper.slice(0, -1)]
}

function createLocallyBufferedHull(points, padding, cornerSteps = 6) {
  return points.flatMap((point, index) => {
    const previous = points[(index - 1 + points.length) % points.length]
    const next = points[(index + 1) % points.length]
    const previousEdge = [point[0] - previous[0], point[1] - previous[1]]
    const nextEdge = [next[0] - point[0], next[1] - point[1]]
    const previousLength = Math.hypot(previousEdge[0], previousEdge[1]) || 1
    const nextLength = Math.hypot(nextEdge[0], nextEdge[1]) || 1
    const previousNormal = [previousEdge[1] / previousLength, -previousEdge[0] / previousLength]
    const nextNormal = [nextEdge[1] / nextLength, -nextEdge[0] / nextLength]
    const startAngle = Math.atan2(previousNormal[1], previousNormal[0])
    let endAngle = Math.atan2(nextNormal[1], nextNormal[0])
    while (endAngle <= startAngle) endAngle += Math.PI * 2
    return Array.from({ length: cornerSteps + 1 }, (_, step) => {
      const angle = startAngle + (endAngle - startAngle) * step / cornerSteps
      return [point[0] + Math.cos(angle) * padding, point[1] + Math.sin(angle) * padding]
    })
  })
}

export default function App() {
  const mapRef = useRef(null)
  const sceneRef = useRef(null)
  const panelRef = useRef(null)
  const cityListRef = useRef(null)
  const attractionListRef = useRef(null)
  const scheduleLayersRef = useRef([])
  const scheduleLabelsRef = useRef([])
  const [loaded, setLoaded] = useState(false)
  const [places, setPlaces] = useState(PLACES)
  const [selectedPlace, setSelectedPlace] = useState(null)
  const [panelOpen, setPanelOpen] = useState(false)
  const [city, setCity] = useState(CITY_STOPS[0].name)
  const [zoomPercent, setZoomPercent] = useState(100)
  const [showSchedule, setShowSchedule] = useState(false)
  const [showNames, setShowNames] = useState(true)
  const [activeDay, setActiveDay] = useState(REGIONS[0]?.label || '')

  const scrollCities = (direction) => {
    cityListRef.current?.scrollBy({ left: direction * 260, behavior: 'smooth' })
  }

  const scrollAttractions = (direction) => {
    attractionListRef.current?.scrollBy({ left: direction * 160, behavior: 'smooth' })
  }

  const changeZoom = (delta) => {
    const scene = sceneRef.current
    if (!scene) return
    const nextZoom = Math.max(3, Math.min(18, scene.getZoom() + delta))
    scene.setZoom(nextZoom)
    setZoomPercent(Math.round(100 + (nextZoom - 13.1) * 12))
  }

  useEffect(() => {
    if (!mapRef.current || sceneRef.current) return undefined
    let cancelled = false

    window._AMapSecurityConfig = {
      securityJsCode: import.meta.env.VITE_AMAP_SECURITY_CODE,
    }

    const scene = new Scene({
      id: mapRef.current,
      logoVisible: false,
      map: new GaodeMap({
        token: import.meta.env.VITE_AMAP_KEY,
        style: 'fresh',
        center: [SOPHIA.lng, SOPHIA.lat],
        zoom: 13.1,
        minZoom: 3,
        maxZoom: 18,
        pitch: 0,
      }),
    })

    sceneRef.current = scene
    scene.on('loaded', () => {
      const resolvedPlaces = PLACES
      if (cancelled) return
      setPlaces(resolvedPlaces)
      resolvedPlaces.forEach((place) => {
        const markerElement = createPlaceMarker(place, () => {
          setSelectedPlace(place)
          setPanelOpen(true)
        })
        const marker = new Marker({ element: markerElement, anchor: 'bottom' })
          .setLnglat([place.lng, place.lat])
        scene.addMarker(marker)
      })
      CONNECTIONS.forEach((connection, connectionIndex) => {
        const from = resolvedPlaces.find((place) => place.name === connection.from)
        const to = resolvedPlaces.find((place) => place.name === connection.to)
        if (!from || !to) return
        const route = createCurvedRoute(from, to, connectionIndex % 2 === 0 ? 1 : -1)
        const polyline = new window.AMap.Polyline({
          map: scene.getMapService().map,
          path: route,
          showDir: true,
          dirColor: '#238e77',
          strokeColor: '#238e77',
          strokeWeight: 4,
          strokeOpacity: 0.92,
          strokeStyle: 'dashed',
          strokeDasharray: [10, 7],
          lineJoin: 'round',
          lineCap: 'round',
          zIndex: 40,
        })
        polyline.hide()
        scheduleLayersRef.current.push({
          layer: polyline,
          day: connection.type === '接驳' ? 'DAY-1' : connection.type,
        })
      })
      REGIONS.forEach((region, regionIndex) => {
        const memberPlaces = region.members
          .map((name) => resolvedPlaces.find((place) => place.name === name))
          .filter(Boolean)
        if (memberPlaces.length < 2) return
        const memberPoints = memberPlaces.map((place) => [place.lng, place.lat])
        const hull = convexHull(memberPoints)
        const hullCenter = hull.reduce((sum, point) => [sum[0] + point[0], sum[1] + point[1]], [0, 0])
          .map((value) => value / hull.length)
        const localPadding = region.label === 'DAY-3' ? 0.0032 : 0.002
        const regionHull = createLocallyBufferedHull(hull, localPadding)
        const closedHull = [...regionHull, regionHull[0]]
        const regionColors = [
          { fill: '#d89a3a', border: '#a86418' },
          { fill: '#4da6a0', border: '#20766f' },
          { fill: '#8a78c2', border: '#584394' },
        ]
        const regionColor = regionColors[regionIndex % regionColors.length]
        const polygonData = {
          type: 'FeatureCollection',
          features: [{
            type: 'Feature',
            properties: { label: region.label },
            geometry: { type: 'Polygon', coordinates: [closedHull] },
          }],
        }
        const polygonLayer = new PolygonLayer({ zIndex: 2 })
          .source(polygonData)
          .shape('fill')
          .color(regionColor.fill)
          .style({ opacity: 0.18 })
        const borderLayer = new LineLayer({ zIndex: 3 })
          .source({
            type: 'FeatureCollection',
            features: [{
              type: 'Feature',
              properties: { label: region.label },
              geometry: { type: 'LineString', coordinates: closedHull },
            }],
          })
          .shape('line')
          .size(2)
          .color(regionColor.border)
          .style({ lineType: 'solid', opacity: 0.9 })
        scene.addLayer(polygonLayer)
        scene.addLayer(borderLayer)
        polygonLayer.hide()
        borderLayer.hide()
        scheduleLayersRef.current.push(
          { layer: polygonLayer, day: region.label },
          { layer: borderLayer, day: region.label },
        )
        const center = hullCenter
        const labelElement = createDayLabel(region.label)
        const labelMarker = new Marker({ element: labelElement, anchor: 'center' })
          .setLnglat(center)
        scene.addMarker(labelMarker)
        labelMarker.hide()
        scheduleLabelsRef.current.push({ marker: labelMarker, day: region.label })
      })
      setLoaded(true)
    })

    return () => {
      cancelled = true
      scene.destroy()
      sceneRef.current = null
      scheduleLayersRef.current = []
      scheduleLabelsRef.current = []
    }
  }, [])

  useEffect(() => {
    const canShow = showSchedule && city === DEFAULT_DESTINATION.name
    scheduleLayersRef.current.forEach(({ layer, day }) => {
      if (canShow && (activeDay === 'ALL' || day === activeDay)) layer.show()
      else layer.hide()
    })
    scheduleLabelsRef.current.forEach(({ marker, day }) => {
      if (canShow && (activeDay === 'ALL' || day === activeDay)) marker.show()
      else marker.hide()
    })
  }, [showSchedule, activeDay, city, loaded])

  useEffect(() => {
    if (!panelOpen) return undefined
    const closeOnOutsideClick = (event) => {
      if (!panelRef.current?.contains(event.target)) setPanelOpen(false)
    }
    document.addEventListener('pointerdown', closeOnOutsideClick)
    return () => document.removeEventListener('pointerdown', closeOnOutsideClick)
  }, [panelOpen])

  const activeDestination = DESTINATIONS.find((destination) => destination.name === city) || DEFAULT_DESTINATION
  const activeStop = CITY_STOPS.find((stop) => stop.name === city) || CITY_STOPS[0]
  const cityPlaces = activeDestination.name === DEFAULT_DESTINATION.name ? places : activeDestination.places

  return (
    <main className={`workspace ${panelOpen ? 'workspace--panel-open' : 'workspace--panel-closed'}${showNames ? ' workspace--show-names' : ''}`}>
      <section className="map-panel" aria-label="哈尔滨景点地图">
        <div ref={mapRef} className="map" />

        <header className="city-nav" aria-label="选择城市">
          <Button className="city-arrow" onClick={() => scrollCities(-1)} aria-label="向左查看更多城市">‹</Button>
          <div className="city-list" ref={cityListRef}>
            {CITY_STOPS.map((stop) => (
              <div className="city-stop" key={stop.name}>
                <Button
                  className={`city-button${city === stop.name ? ' city-button--active' : ''}`}
                  type="button"
                  onClick={() => {
                    setCity(stop.name)
                    const destination = DESTINATIONS.find((item) => item.name === stop.name)
                    setActiveDay(destination?.dayPlans?.[0]?.label || '')
                  }}
                  aria-pressed={city === stop.name}
                >
                  {stop.name}
                </Button>
                <time dateTime={stop.dateTime}>{stop.date}</time>
                {city === stop.name && activeDestination.dayPlans.length > 0 && (
                  <div className="day-selector" aria-label={`${stop.name}日程`}>
                    <Button
                      className={`day-button${activeDay === 'ALL' ? ' day-button--active' : ''}`}
                      onClick={() => {
                        setActiveDay('ALL')
                        setShowSchedule(true)
                      }}
                      aria-pressed={activeDay === 'ALL'}
                    >
                      全部
                    </Button>
                    {activeDestination.dayPlans.map((day) => (
                      <Button
                        key={day.label}
                        className={`day-button${activeDay === day.label ? ' day-button--active' : ''}`}
                        onClick={() => {
                          setActiveDay(day.label)
                          setShowSchedule(true)
                        }}
                        aria-pressed={activeDay === day.label}
                      >
                        {day.label}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
          <Button className="city-arrow" onClick={() => scrollCities(1)} aria-label="向右查看更多城市">›</Button>
        </header>

        {cityPlaces.length > 0 && (
          <section className="city-attractions" aria-label={`${city}景点图片`}>
            <Button className="attraction-arrow" onClick={() => scrollAttractions(-1)} aria-label="向左查看更多景点">‹</Button>
            <div className="attraction-list" ref={attractionListRef}>
              {cityPlaces.map((place, index) => (
                <Button
                  className="attraction-card"
                  key={place.name}
                  onClick={() => {
                    setSelectedPlace(place)
                    setPanelOpen(true)
                  }}
                  aria-label={`查看${formatPlaceName(place)}`}
                >
                  <img className="attraction-image" src={place.imageUrl} alt="" loading="lazy" />
                  <span className="attraction-name">{formatPlaceName(place)}</span>
                </Button>
              ))}
            </div>
            <Button className="attraction-arrow" onClick={() => scrollAttractions(1)} aria-label="向右查看更多景点">›</Button>
          </section>
        )}

        <div className="schedule-toggle">
          <label>
            <input
              type="checkbox"
              checked={showSchedule}
              onChange={(event) => setShowSchedule(event.target.checked)}
            />
            <span className="name-toggle-box" aria-hidden="true">✓</span>
            <span>显示日程</span>
          </label>
        </div>
        <div className="name-toggle">
          <label>
            <input
              type="checkbox"
              checked={showNames}
              onChange={(event) => setShowNames(event.target.checked)}
            />
            <span className="name-toggle-box" aria-hidden="true">✓</span>
            <span>显示名称</span>
          </label>
        </div>
        <div className="zoom-control" aria-label="地图缩放">
          <Button onClick={() => changeZoom(-1)} aria-label="缩小地图">－</Button>
          <span>{zoomPercent}%</span>
          <Button onClick={() => changeZoom(1)} aria-label="放大地图">＋</Button>
        </div>
        <time className="map-date" dateTime={activeStop.dateTime}>{activeStop.date}</time>

        {!loaded && <div className="loading" role="status">地图加载中…</div>}
      </section>

      <Card ref={panelRef} color="app-teal" pattern="none" className={`detail-panel ${panelOpen ? 'detail-panel--open' : 'detail-panel--closed'}`} aria-live="polite">
        <Button
          className="panel-toggle"
          type="button"
          onClick={() => setPanelOpen((open) => !open)}
          aria-expanded={panelOpen}
          aria-label={panelOpen ? '折叠详情面板' : '展开详情面板'}
        >
          <span>›</span>
        </Button>
        <div className="detail-content" aria-hidden={!panelOpen}>
          {selectedPlace ? (
            <>
            <div className="detail-head">
              <span className="detail-kicker">景点详情</span>
              <Button onClick={() => setPanelOpen(false)} aria-label="关闭详情面板">×</Button>
            </div>
            <div className="detail-visual" aria-hidden="true"><span>⛪</span></div>
            <h1>{formatPlaceName(selectedPlace)}</h1>
            <dl>
              <div><dt>城市</dt><dd>{selectedPlace.city}</dd></div>
              <div><dt>区域</dt><dd>{selectedPlace.district}</dd></div>
              <div><dt>类型</dt><dd>{selectedPlace.type}</dd></div>
              {selectedPlace.priceYuan != null && <div><dt>价格</dt><dd>¥{selectedPlace.priceYuan}</dd></div>}
              {selectedPlace.address && <div><dt>地址</dt><dd>{selectedPlace.address}</dd></div>}
            </dl>
            </>
          ) : (
            <div className="detail-empty">
              <span className="empty-pin" aria-hidden="true">⌖</span>
              <strong>点击景点后查看详情</strong>
              <p>地图上的蓝色标记可查看</p>
            </div>
          )}
        </div>
      </Card>
    </main>
  )
}
