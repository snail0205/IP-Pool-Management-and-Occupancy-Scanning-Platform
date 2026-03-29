<template>
  <el-card class="panel-card" shadow="hover">
    <template #header>
      <div class="header-row">
        <div>
          <div class="title">IP 地域分布大屏</div>
          <div class="subtitle">基于网段池 region 字段进行省级聚合亮灯</div>
        </div>
        <div class="stats">
          <div class="stat-item">
            <span class="stat-label">点亮省份</span>
            <span class="stat-value">{{ activeProvinceCount }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">区域记录</span>
            <span class="stat-value">{{ regionRecordCount }}</span>
          </div>
        </div>
      </div>
    </template>
    <div ref="mapRef" class="chart-box"></div>
    <div class="map-tip">颜色越亮表示省份内网段池数量越高</div>
  </el-card>
</template>

<script setup>
import { ref, watch, computed, onMounted, onUnmounted } from 'vue'
import * as echarts from 'echarts'

const props = defineProps({
  pools: {
    type: Array,
    default: () => []
  }
})

const mapRef = ref(null)
let chart = null
let rafId = null

const provinceNameMap = {
  北京: '北京市',
  天津: '天津市',
  上海: '上海市',
  重庆: '重庆市',
  内蒙古: '内蒙古自治区',
  广西: '广西壮族自治区',
  西藏: '西藏自治区',
  宁夏: '宁夏回族自治区',
  新疆: '新疆维吾尔自治区',
  香港: '香港特别行政区',
  澳门: '澳门特别行政区'
}

const provinceCenterMap = {
  北京市: [116.40, 39.90],
  天津市: [117.20, 39.13],
  上海市: [121.47, 31.23],
  重庆市: [106.55, 29.56],
  河北省: [114.48, 38.03],
  山西省: [112.55, 37.87],
  辽宁省: [123.43, 41.80],
  吉林省: [125.35, 43.88],
  黑龙江省: [126.63, 45.75],
  江苏省: [118.78, 32.04],
  浙江省: [120.15, 30.28],
  安徽省: [117.27, 31.86],
  福建省: [119.30, 26.08],
  江西省: [115.89, 28.68],
  山东省: [117.00, 36.65],
  河南省: [113.62, 34.75],
  湖北省: [114.31, 30.52],
  湖南省: [112.98, 28.20],
  广东省: [113.27, 23.13],
  海南省: [110.35, 20.02],
  四川省: [104.06, 30.67],
  贵州省: [106.71, 26.57],
  云南省: [102.71, 25.04],
  陕西省: [108.95, 34.27],
  甘肃省: [103.73, 36.03],
  青海省: [101.78, 36.62],
  台湾省: [121.50, 25.05],
  内蒙古自治区: [111.65, 40.82],
  广西壮族自治区: [108.32, 22.82],
  西藏自治区: [91.11, 29.97],
  宁夏回族自治区: [106.27, 38.47],
  新疆维吾尔自治区: [87.62, 43.79],
  香港特别行政区: [114.17, 22.32],
  澳门特别行政区: [113.54, 22.19]
}

function normalizeProvince(region) {
  const text = String(region || '').trim()
  if (!text) return ''
  for (const key of Object.keys(provinceNameMap)) {
    if (text.includes(key)) return provinceNameMap[key]
  }
  if (text.endsWith('省') || text.endsWith('市') || text.endsWith('自治区') || text.endsWith('特别行政区')) {
    return text
  }
  return `${text}省`
}

function buildMapData(pools = []) {
  const counter = {}
  pools.forEach((pool) => {
    const province = normalizeProvince(pool.region)
    if (!province) return
    counter[province] = (counter[province] || 0) + 1
  })
  return Object.entries(counter).map(([name, value]) => ({ name, value }))
}

const mapData = computed(() => buildMapData(props.pools))
const activeProvinceCount = computed(() => mapData.value.length)
const regionRecordCount = computed(() => props.pools.filter((x) => String(x.region || '').trim()).length)

function buildEffectData(data) {
  return data
    .map((item) => {
      const center = provinceCenterMap[item.name]
      if (!center) return null
      return {
        name: item.name,
        value: [...center, Number(item.value || 0)]
      }
    })
    .filter(Boolean)
}

async function ensureChinaMapRegistered() {
  if (echarts.getMap('china')) return true
  try {
    const resp = await fetch('https://geo.datav.aliyun.com/areas_v3/bound/100000_full.json')
    if (!resp.ok) return false
    const geoJson = await resp.json()
    echarts.registerMap('china', geoJson)
    return true
  } catch {
    return false
  }
}

async function renderMap() {
  if (!chart) return
  const ok = await ensureChinaMapRegistered()
  if (!ok) {
    chart.clear()
    chart.setOption({
      title: {
        text: '中国地图加载失败',
        left: 'center',
        top: 'middle',
        textStyle: { fontSize: 14, color: '#9fb3d1', fontWeight: 500 }
      }
    })
    return
  }

  const data = mapData.value
  const effectData = buildEffectData(data)
  const max = Math.max(...data.map((x) => Number(x.value || 0)), 1)

  chart.setOption({
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(10, 28, 53, 0.92)',
      borderColor: '#43d0d6',
      borderWidth: 1,
      textStyle: { color: '#d6e7ff' },
      formatter: (params) => {
        const value = Array.isArray(params.value) ? params.value[2] : params.value
        return `${params.name}<br/>网段池数量：${value ?? 0}`
      }
    },
    visualMap: {
      show: false,
      min: 0,
      max,
      inRange: {
        color: ['#0e2a4d', '#205f91', '#33a6d8', '#57f1ff']
      }
    },
    geo: {
      map: 'china',
      roam: true,
      zoom: 1.06,
      label: { show: false },
      itemStyle: {
        areaColor: '#101f32',
        borderColor: '#43d0d6',
        borderWidth: 1
      },
      emphasis: {
        label: { show: false },
        itemStyle: { areaColor: '#0d4b78' }
      }
    },
    series: [
      {
        name: '省份亮灯',
        type: 'map',
        map: 'china',
        geoIndex: 0,
        data,
        zlevel: 1
      },
      {
        name: '核心区域',
        type: 'effectScatter',
        coordinateSystem: 'geo',
        data: effectData,
        symbolSize: (val) => Math.max(8, Math.min(28, 8 + Number(val[2] || 0) * 2)),
        showEffectOn: 'render',
        rippleEffect: {
          period: 4,
          scale: 4,
          brushType: 'stroke'
        },
        itemStyle: {
          color: '#57f1ff',
          shadowBlur: 16,
          shadowColor: '#57f1ff'
        },
        zlevel: 3
      },
      {
        name: '核心区域外环',
        type: 'scatter',
        coordinateSystem: 'geo',
        data: effectData,
        symbolSize: (val) => Math.max(12, Math.min(34, 12 + Number(val[2] || 0) * 2.6)),
        itemStyle: {
          color: 'rgba(87,241,255,0.12)',
          borderColor: '#57f1ff',
          borderWidth: 1
        },
        zlevel: 2
      }
    ],
    animationDurationUpdate: 600
  }, true)
}

function handleResize() {
  if (document.hidden) return
  if (rafId) cancelAnimationFrame(rafId)
  rafId = requestAnimationFrame(() => {
    chart?.resize()
  })
}

watch(
  () => props.pools,
  async () => {
    await renderMap()
  },
  { deep: true }
)

onMounted(async () => {
  if (mapRef.value) {
    chart = echarts.init(mapRef.value)
    await renderMap()
    window.addEventListener('resize', handleResize)
  }
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  if (rafId) cancelAnimationFrame(rafId)
  chart?.dispose()
  chart = null
})
</script>

<style scoped>
.panel-card {
  border-radius: 12px;
  border: 1px solid rgba(67, 208, 214, 0.35);
  background: radial-gradient(circle at 50% 0%, rgba(58, 124, 184, 0.2), rgba(10, 19, 39, 0.96));
  box-shadow: inset 0 0 18px rgba(36, 103, 149, 0.45), 0 10px 24px rgba(7, 14, 28, 0.35);
  height: 500px;
}
.panel-card :deep(.el-card__header) {
  border-bottom: 1px solid rgba(67, 208, 214, 0.22);
}
.panel-card :deep(.el-card__body) {
  height: calc(100% - 76px);
  display: flex;
  flex-direction: column;
}
.header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 14px;
}
.title {
  font-size: 16px;
  font-weight: 700;
  color: #57f1ff;
  letter-spacing: 0.5px;
}
.subtitle {
  margin-top: 4px;
  font-size: 12px;
  color: #9fb3d1;
}
.stats {
  display: flex;
  gap: 10px;
}
.stat-item {
  min-width: 92px;
  padding: 6px 10px;
  border: 1px solid rgba(87, 241, 255, 0.28);
  border-radius: 8px;
  background: rgba(14, 42, 77, 0.45);
  display: flex;
  flex-direction: column;
  align-items: center;
}
.stat-label {
  font-size: 11px;
  color: #9fb3d1;
}
.stat-value {
  margin-top: 4px;
  font-size: 18px;
  line-height: 1;
  font-weight: 700;
  color: #57f1ff;
}
.chart-box {
  flex: 1;
  min-height: 360px;
}
.map-tip {
  margin-top: 8px;
  font-size: 12px;
  color: #9fb3d1;
  text-align: right;
}
</style>
