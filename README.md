# TravelMap

基于 React 19、Vite、AntV L7 与高德地图实现的交互式旅行规划地图。目前内置哈尔滨行程，支持精确景点点位、DAY 路线、方向箭头、区域覆盖、景点图片、预约提示与价格信息。

## 功能

- 全屏高德地图与草色青悬浮界面
- 城市、日期和 DAY 行程切换
- DAY-1、DAY-2、DAY-3 单独或全部显示
- 高德 `AMap.Polyline` 虚线方向路线
- 半透明 DAY 多边形区域与实线边框
- 23 个本地化景点图片与精确坐标
- 景点预约天数、价格和右侧详情面板
- 景点名称、日程区域独立显隐

## 本地运行

需要 Node.js 20 或更高版本。

```bash
npm install
```

复制环境变量示例并填写高德 Web Key 与安全密钥：

```bash
copy .env.example .env.local
```

```env
VITE_AMAP_KEY=your_amap_web_key
VITE_AMAP_SECURITY_CODE=your_amap_security_code
```

启动开发环境：

```bash
npm run dev
```

生产构建：

```bash
npm run build
```

## 数据维护

旅行数据统一存放于 `src/data/travel-data.json`。坐标使用 GCJ-02，连接顺序必须与 DAY 规划一致；图片存放于 `public/images/places/`，不依赖远程图片热链。

## 项目 Skill

仓库包含 `skills/travel-map-planner/`，记录旅行地图的数据、路线、区域、界面和验收规范。可将该目录复制到 Codex 的个人 Skills 目录，或直接阅读其中的 `SKILL.md` 继续维护本项目。
