<template>
  <div class="screen-page">
    <div class="board-grid">
      <div class="col left">
        <div class="panel">
          <div class="panel-title">地图飞线</div>
          <div ref="flyMapRef" class="chart"></div>
        </div>
        <div class="panel">
          <div class="panel-title">世界地图</div>
          <div ref="worldMapRef" class="chart"></div>
        </div>
      </div>

      <div class="col center">
        <div class="panel panel-center">
          <div class="panel-title">全国 IP Pools 分布散点</div>
          <div ref="scatterMapRef" class="chart chart-center"></div>
        </div>
      </div>

      <div class="col right">
        <div class="panel panel-small">
          <div class="panel-title">省份地图（广东）</div>
          <div ref="provinceMapRef" class="chart"></div>
        </div>
        <div class="panel panel-small">
          <div class="panel-title">城市地图（深圳）</div>
          <div ref="cityMapRef" class="chart"></div>
        </div>
        <div class="panel panel-small">
          <div class="panel-title">区县地图（南山区）</div>
          <div ref="countyMapRef" class="chart"></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import * as echarts from 'echarts'
import { getPoolList } from '@/api/pool'

const loading = ref(false)
const poolList = ref([])
const flyMapRef = ref(null)
const worldMapRef = ref(null)
const scatterMapRef = ref(null)
const provinceMapRef = ref(null)
const cityMapRef = ref(null)
const countyMapRef = ref(null)

let flyChart = null
let worldChart = null
let scatterChart = null
let provinceChart = null
let cityChart = null
let countyChart = null
let rafId = null

const mapUrlMap = {
  china: [
    'https://geo.datav.aliyun.com/areas_v3/bound/100000_full.json',
    'https://geo.datav.aliyun.com/areas_v3/bound/100000.json'
  ],
  world: [
    '/api/maps/world-geojson',
    'https://echarts.apache.org/examples/data/asset/geo/world.json'
  ],
  guangdong: [
    'https://geo.datav.aliyun.com/areas_v3/bound/440000_full.json',
    'https://geo.datav.aliyun.com/areas_v3/bound/440000.json'
  ],
  shenzhen: [
    'https://geo.datav.aliyun.com/areas_v3/bound/440300_full.json',
    'https://geo.datav.aliyun.com/areas_v3/bound/440300.json'
  ],
  nanshan: []
}

const mapLoadTasks = new Map()

const regionCoordMap = {
  北京: [116.40, 39.90],
  上海: [121.47, 31.23],
  广州: [113.27, 23.13],
  深圳: [114.05, 22.55],
  天津: [117.20, 39.13],
  杭州: [120.15, 30.28],
  南京: [118.78, 32.04],
  苏州: [120.58, 31.30],
  成都: [104.06, 30.67],
  重庆: [106.55, 29.56],
  武汉: [114.31, 30.52],
  西安: [108.95, 34.27],
  郑州: [113.62, 34.75],
  长沙: [112.98, 28.20],
  厦门: [118.10, 24.46],
  福州: [119.30, 26.08],
  青岛: [120.38, 36.07],
  济南: [117.12, 36.65],
  合肥: [117.27, 31.86],
  昆明: [102.71, 25.04],
  贵阳: [106.71, 26.57],
  南昌: [115.89, 28.68],
  沈阳: [123.43, 41.80],
  大连: [121.62, 38.92],
  哈尔滨: [126.63, 45.75],
  长春: [125.35, 43.88],
  石家庄: [114.48, 38.03],
  太原: [112.55, 37.87],
  兰州: [103.73, 36.03],
  西宁: [101.78, 36.62],
  乌鲁木齐: [87.62, 43.79],
  拉萨: [91.11, 29.97],
  海口: [110.35, 20.02],
  南宁: [108.32, 22.82],
  呼和浩特: [111.65, 40.82],
  银川: [106.27, 38.47]
}

function normalizeRegion(text) {
  const raw = String(text || '').trim()
  if (!raw) return ''
  const candidates = Object.keys(regionCoordMap)
  for (const c of candidates) {
    if (raw.includes(c)) return c
  }
  return ''
}

function buildRegionCounter() {
  const counter = {}
  poolList.value.forEach((pool) => {
    const key = normalizeRegion(pool.region)
    if (!key) return
    counter[key] = (counter[key] || 0) + 1
  })
  return counter
}

function toScatterData(counter) {
  return Object.entries(counter)
    .map(([name, count]) => {
      const coord = regionCoordMap[name]
      if (!coord) return null
      return {
        name,
        value: [...coord, Number(count)]
      }
    })
    .filter(Boolean)
}

function topFlowTargets(counter, limit = 12) {
  return Object.entries(counter)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name, value]) => ({ name, value }))
}

async function ensureMapRegistered(name) {
  if (echarts.getMap(name)) return true
  if (name === 'nanshan') {
    const hasShenzhen = await ensureMapRegistered('shenzhen')
    if (!hasShenzhen) return false
    const shenzhenMap = echarts.getMap('shenzhen')
    const features = shenzhenMap?.geoJSON?.features || []
    const target = features.find((f) => {
      const n = f?.properties?.name || f?.name || ''
      return String(n).includes('南山')
    })
    if (!target) return false
    echarts.registerMap('nanshan', {
      type: 'FeatureCollection',
      features: [target]
    })
    return true
  }
  if (mapLoadTasks.has(name)) return mapLoadTasks.get(name)
  const task = (async () => {
    const urls = mapUrlMap[name]
    if (!urls || urls.length === 0) return false
    for (const url of urls) {
      try {
        const resp = await fetch(url)
        if (!resp.ok) continue
        const geoJson = await resp.json()
        echarts.registerMap(name, geoJson)
        return true
      } catch {
        continue
      }
    }
    return false
  })()
  mapLoadTasks.set(name, task)
  const ok = await task
  if (!ok) mapLoadTasks.delete(name)
  return ok
}

function setChartError(chart, title) {
  chart.clear()
  chart.setOption({
    title: {
      text: title,
      left: 'center',
      top: 'middle',
      textStyle: { color: '#8fb8d8', fontSize: 13, fontWeight: 500 }
    }
  })
}

async function renderFlyMap(counter) {
  if (!flyChart) return
  const ok = await ensureMapRegistered('china')
  if (!ok) {
    setChartError(flyChart, '中国地图加载失败')
    return
  }

  const originName = '北京'
  const originCoord = regionCoordMap[originName]
  const targets = topFlowTargets(counter, 18).filter((x) => x.name !== originName)

  const linesData = targets
    .map((item) => {
      const to = regionCoordMap[item.name]
      if (!to || !originCoord) return null
      return {
        fromName: originName,
        toName: item.name,
        value: item.value,
        coords: [originCoord, to]
      }
    })
    .filter(Boolean)

  const pointData = [{ name: originName, value: [...originCoord, Math.max(targets.length, 1)] }]
    .concat(
      targets
        .map((x) => {
          const c = regionCoordMap[x.name]
          if (!c) return null
          return { name: x.name, value: [...c, x.value] }
        })
        .filter(Boolean)
    )

  flyChart.setOption({
    geo: {
      map: 'china',
      roam: false,
      zoom: 1.05,
      label: { show: false },
      itemStyle: {
        areaColor: '#101f32',
        borderColor: '#43d0d6',
        borderWidth: 1
      },
      emphasis: {
        label: { show: false },
        itemStyle: {
          areaColor: '#0d4b78'
        }
      }
    },
    tooltip: {
      trigger: 'item',
      formatter: (p) => (p.value ? `${p.name}：${Array.isArray(p.value) ? p.value[2] : p.value}` : p.name)
    },
    series: [
      {
        type: 'lines',
        coordinateSystem: 'geo',
        zlevel: 1,
        effect: {
          show: true,
          period: 4,
          trailLength: 0.15,
          symbol: 'arrow',
          symbolSize: 6
        },
        lineStyle: {
          color: '#f19000',
          width: 1,
          opacity: 0.7,
          curveness: 0.2
        },
        data: linesData
      },
      {
        type: 'effectScatter',
        coordinateSystem: 'geo',
        zlevel: 2,
        rippleEffect: {
          period: 4,
          scale: 4,
          brushType: 'stroke'
        },
        symbolSize: (val) => Math.max(5, Math.min(20, 5 + Number(val[2] || 0) * 1.5)),
        itemStyle: {
          color: '#f19000'
        },
        data: pointData
      }
    ]
  }, true)
}

async function renderWorldMap(counter) {
  if (!worldChart) return
  const ok = await ensureMapRegistered('world')
  if (!ok) {
    setChartError(worldChart, '世界地图加载失败')
    return
  }
  const total = Object.values(counter).reduce((sum, n) => sum + n, 0)
  const worldPoints = [
    { name: 'China', value: [104.0, 35.0, total] },
    { name: 'Singapore', value: [103.8, 1.3, Math.max(1, Math.floor(total * 0.2))] },
    { name: 'Germany', value: [10.0, 51.0, Math.max(1, Math.floor(total * 0.15))] },
    { name: 'USA', value: [-98.0, 39.5, Math.max(1, Math.floor(total * 0.25))] }
  ]
  worldChart.setOption({
    geo: {
      map: 'world',
      roam: false,
      zoom: 1,
      label: { show: false },
      itemStyle: {
        areaColor: '#10253d',
        borderColor: '#43d0d6',
        borderWidth: 0.8
      },
      emphasis: {
        label: { show: false },
        itemStyle: {
          areaColor: '#174d79'
        }
      }
    },
    tooltip: {
      trigger: 'item',
      formatter: (p) => `${p.name}：${Array.isArray(p.value) ? p.value[2] : (p.value ?? '-')}`
    },
    series: [
      {
        type: 'scatter',
        coordinateSystem: 'geo',
        symbolSize: (val) => Math.max(6, Math.min(18, Number(val[2] || 0) + 6)),
        itemStyle: {
          color: '#57f1ff'
        },
        data: worldPoints
      }
    ]
  }, true)
}

async function renderScatterMap(counter) {
  if (!scatterChart) return
  const ok = await ensureMapRegistered('china')
  if (!ok) {
    setChartError(scatterChart, '中国地图加载失败')
    return
  }
  const data = toScatterData(counter)
  const max = Math.max(...data.map((x) => Number(x.value[2] || 0)), 1)
  scatterChart.setOption({
    geo: {
      map: 'china',
      roam: true,
      zoom: 1.1,
      label: { show: false },
      itemStyle: {
        areaColor: '#101f32',
        borderColor: '#43d0d6',
        borderWidth: 1
      },
      emphasis: {
        label: { show: false },
        itemStyle: {
          areaColor: '#0d4b78'
        }
      }
    },
    visualMap: {
      min: 0,
      max,
      left: 8,
      bottom: 10,
      text: ['高', '低'],
      calculable: true,
      inRange: {
        color: ['#1f7eb8', '#65f1ff', '#f7c64a', '#ff6b35']
      },
      textStyle: { color: '#d8ebff' }
    },
    tooltip: {
      trigger: 'item',
      formatter: (p) => `${p.name}<br/>IP Pools：${Array.isArray(p.value) ? p.value[2] : (p.value ?? 0)}`
    },
    series: [
      {
        type: 'scatter',
        coordinateSystem: 'geo',
        data,
        symbolSize: (val) => Math.max(8, Math.min(26, 8 + Number(val[2] || 0) * 3)),
        itemStyle: {
          color: '#ffd166',
          opacity: 0.85
        },
        emphasis: {
          itemStyle: {
            color: '#ff7f11'
          }
        }
      }
    ]
  }, true)
}

function buildAreaValues(mapName, base = 6) {
  const map = echarts.getMap(mapName)
  const features = map?.geoJSON?.features || []
  return features.map((f, idx) => {
    const len = poolList.value.length
    const val = ((idx + 1) * 7 + len * 3) % (base * 10) + base
    return {
      name: f.properties?.name || f.name,
      value: val
    }
  })
}

async function renderAreaMap(chart, mapName) {
  if (!chart) return
  const ok = await ensureMapRegistered(mapName)
  if (!ok) {
    setChartError(chart, '地图加载失败')
    return
  }
  const data = buildAreaValues(mapName, mapName === 'nanshan' ? 3 : 6)
  const max = Math.max(...data.map((x) => x.value), 1)
  chart.setOption({
    tooltip: {
      trigger: 'item',
      formatter: (p) => `${p.name}`
    },
    visualMap: {
      show: false,
      min: 0,
      max,
      inRange: {
        color: ['#103056', '#1b5888', '#39acd6', '#57f1ff']
      }
    },
    series: [
      {
        type: 'map',
        map: mapName,
        roam: true,
        label: { show: false, color: '#73f5ff', fontSize: 11 },
        itemStyle: {
          areaColor: '#112844',
          borderColor: '#43d0d6',
          borderWidth: 1
        },
        emphasis: {
          label: { show: true, color: '#ffffff' },
          itemStyle: {
            areaColor: '#1d6b9d'
          }
        },
        data
      }
    ]
  }, true)
}

async function renderAllMaps() {
  const counter = buildRegionCounter()
  await Promise.all([
    renderFlyMap(counter),
    renderWorldMap(counter),
    renderScatterMap(counter),
    renderAreaMap(provinceChart, 'guangdong'),
    renderAreaMap(cityChart, 'shenzhen'),
    renderAreaMap(countyChart, 'nanshan')
  ])
}

function initCharts() {
  if (flyMapRef.value && !flyChart) flyChart = echarts.init(flyMapRef.value)
  if (worldMapRef.value && !worldChart) worldChart = echarts.init(worldMapRef.value)
  if (scatterMapRef.value && !scatterChart) scatterChart = echarts.init(scatterMapRef.value)
  if (provinceMapRef.value && !provinceChart) provinceChart = echarts.init(provinceMapRef.value)
  if (cityMapRef.value && !cityChart) cityChart = echarts.init(cityMapRef.value)
  if (countyMapRef.value && !countyChart) countyChart = echarts.init(countyMapRef.value)
}

function handleResize() {
  if (document.hidden) return
  if (rafId) cancelAnimationFrame(rafId)
  rafId = requestAnimationFrame(() => {
    flyChart?.resize()
    worldChart?.resize()
    scatterChart?.resize()
    provinceChart?.resize()
    cityChart?.resize()
    countyChart?.resize()
  })
}

async function loadPools() {
  loading.value = true
  try {
    const ts = Date.now()
    const data = await getPoolList({ page: 1, pageSize: 1000, _t: ts })
    poolList.value = data.list || []
    await renderAllMaps()
  } catch (error) {
    const msg = error.response?.data?.message || error.message || '加载失败'
    ElMessage.error(msg)
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  await nextTick()
  initCharts()
  await loadPools()
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  if (rafId) cancelAnimationFrame(rafId)
  flyChart?.dispose()
  worldChart?.dispose()
  scatterChart?.dispose()
  provinceChart?.dispose()
  cityChart?.dispose()
  countyChart?.dispose()
  flyChart = null
  worldChart = null
  scatterChart = null
  provinceChart = null
  cityChart = null
  countyChart = null
})
</script>

<style scoped>
.screen-page {
  padding: 16px 16px 12px;
  min-height: calc(100dvh - 60px);
  background: radial-gradient(circle at 50% 0%, #10345d 0%, #08172f 40%, #061326 100%);
  box-sizing: border-box;
  overflow-x: auto;
}
.screen-head {
  margin-bottom: 12px;
  padding: 14px 16px;
  border-radius: 10px;
  border: 1px solid #1f3e5f;
  background: linear-gradient(90deg, #071427, #0d2845);
  color: #dbeafe;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.screen-head h2 {
  margin: 0;
  font-size: 18px;
}
.screen-head p {
  margin: 6px 0 0;
  font-size: 12px;
  color: #93c5fd;
}
.board-grid {
  min-height: 640px;
  height: calc(100dvh - 168px);
  display: grid;
  grid-template-columns: 23% 54% 23%;
  gap: 10px;
  width: 100%;
  box-sizing: border-box;
}
.col {
  min-height: 0;
}
.left,
.right {
  display: grid;
  gap: 10px;
}
.left {
  grid-template-rows: 1fr 1fr;
}
.right {
  grid-template-rows: repeat(3, 1fr);
}
.center {
  display: grid;
}
.panel {
  height: 100%;
  border: 1px solid rgba(67, 208, 214, 0.45);
  border-radius: 8px;
  background: rgba(7, 25, 46, 0.82);
  box-shadow: inset 0 0 16px rgba(31, 110, 170, 0.35);
  padding: 8px 8px 4px;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  overflow: hidden;
}
.panel-title {
  color: #57f1ff;
  text-align: center;
  font-size: 13px;
  font-weight: 600;
  line-height: 22px;
  margin-bottom: 4px;
}
.chart {
  flex: 1;
  min-height: 120px;
}
.panel-center .chart-center {
  min-height: 360px;
}
@media (max-width: 1400px) {
  .board-grid {
    grid-template-columns: 1fr;
    height: auto;
  }
  .left,
  .right,
  .center {
    display: grid;
    grid-template-rows: none;
    gap: 10px;
  }
  .panel {
    min-height: 280px;
  }
}
</style>
