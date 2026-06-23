// ponytail: levels definition as a clean, standalone JS module. No external dependencies.
const LEVELS = [
  {
    id: 1,
    name: "入門三角形 (Intro Triangle)",
    description: "連接三個頂點以完成三角形。點擊任意點開始！",
    startNode: null,
    endNode: null,
    nodes: [
      { id: 0, x: 400, y: 150 },
      { id: 1, x: 200, y: 450 },
      { id: 2, x: 600, y: 450 }
    ],
    edges: [
      { u: 0, v: 1 },
      { u: 1, v: 2 },
      { u: 2, v: 0 }
    ],
    portals: []
  },
  {
    id: 2,
    name: "經典小木屋 (Classic House)",
    description: "最經典的一筆畫關卡。試著找出合適的起點與終點吧！",
    startNode: null,
    endNode: null,
    nodes: [
      { id: 0, x: 250, y: 450 },
      { id: 1, x: 550, y: 450 },
      { id: 2, x: 250, y: 250 },
      { id: 3, x: 550, y: 250 },
      { id: 4, x: 400, y: 120 }
    ],
    edges: [
      { u: 0, v: 1 },
      { u: 0, v: 2 },
      { u: 0, v: 3 },
      { u: 1, v: 2 },
      { u: 1, v: 3 },
      { u: 2, v: 3 },
      { u: 2, v: 4 },
      { u: 3, v: 4 }
    ],
    portals: []
  },
  {
    id: 3,
    name: "單向穿梭 (One-Way Arrow)",
    description: "引入「單向道」。注意線段上的箭頭，只能順著箭頭方向畫過！",
    startNode: null,
    endNode: null,
    nodes: [
      { id: 0, x: 400, y: 120 },
      { id: 1, x: 200, y: 320 },
      { id: 2, x: 600, y: 320 },
      { id: 3, x: 400, y: 520 }
    ],
    edges: [
      { u: 0, v: 1 },
      { u: 0, v: 2, oneWay: true }, // from 0 to 2 only
      { u: 1, v: 3 },
      { u: 2, v: 3 },
      { u: 1, v: 2 }
    ],
    portals: []
  },
  {
    id: 4,
    name: "雙倍路徑 (Double Line)",
    description: "引入「雙道路」。較粗的綠色雙線段必須經過兩次才算填滿！",
    startNode: null,
    endNode: null,
    nodes: [
      { id: 0, x: 250, y: 200 },
      { id: 1, x: 550, y: 200 },
      { id: 2, x: 250, y: 450 },
      { id: 3, x: 550, y: 450 }
    ],
    edges: [
      { u: 0, v: 1, double: true }, // requires two traversals
      { u: 0, v: 2 },
      { u: 1, v: 3 },
      { u: 2, v: 3 },
      { u: 0, v: 3 }
    ],
    portals: []
  },
  {
    id: 5,
    name: "傳送之門 (Teleport Vortex)",
    description: "引入「傳送門」。畫入紫色 A 門時，會自動從 B 門延伸出來，不留下任何實體痕跡！",
    startNode: null,
    endNode: null,
    nodes: [
      { id: 0, x: 250, y: 150 },
      { id: 1, x: 550, y: 150 },
      { id: 2, x: 250, y: 320, isPortal: true, portalId: 0 },
      { id: 3, x: 550, y: 320, isPortal: true, portalId: 0 },
      { id: 4, x: 250, y: 480 },
      { id: 5, x: 550, y: 480 }
    ],
    edges: [
      { u: 0, v: 1 },
      { u: 0, v: 2 },
      { u: 1, v: 3 },
      { u: 4, v: 5 },
      { u: 2, v: 4 },
      { u: 3, v: 5 }
    ],
    portals: [
      { a: 2, b: 3, color: "#bf5af2" }
    ]
  },
  {
    id: 6,
    name: "指定起訖 (Start & End)",
    description: "地圖標示了「S」(Start) 與「E」(End)。你必須從 S 出發，並在 E 結束畫線！",
    startNode: 0,
    endNode: 4,
    nodes: [
      { id: 0, x: 200, y: 300, label: "S" },
      { id: 1, x: 400, y: 150 },
      { id: 2, x: 600, y: 300 },
      { id: 3, x: 400, y: 450 },
      { id: 4, x: 400, y: 300, label: "E" }
    ],
    edges: [
      { u: 0, v: 1 },
      { u: 1, v: 2 },
      { u: 2, v: 3 },
      { u: 3, v: 0 },
      { u: 0, v: 4 },
      { u: 2, v: 4 },
      { u: 1, v: 4 },
      { u: 3, v: 4 }
    ],
    portals: []
  },
  {
    id: 7,
    name: "璀璨星芒 (The Star)",
    description: "一個對角相連的五角星。交叉的中心點可以重複經過多次，但每條線只能畫一次！",
    startNode: null,
    endNode: null,
    nodes: [
      { id: 0, x: 400, y: 100 },
      { id: 1, x: 580, y: 230 },
      { id: 2, x: 510, y: 450 },
      { id: 3, x: 290, y: 450 },
      { id: 4, x: 220, y: 230 }
    ],
    edges: [
      { u: 0, v: 2 },
      { u: 2, v: 4 },
      { u: 4, v: 1 },
      { u: 1, v: 3 },
      { u: 3, v: 0 }
    ],
    portals: []
  },
  {
    id: 8,
    name: "網格穿梭 (Cyber Lattice)",
    description: "結合「單向道」與「雙道路」的 3x3 網格。每一步都需要精準規劃！",
    startNode: null,
    endNode: null,
    nodes: [
      { id: 0, x: 250, y: 180 },
      { id: 1, x: 400, y: 180 },
      { id: 2, x: 550, y: 180 },
      { id: 3, x: 250, y: 320 },
      { id: 4, x: 400, y: 320 },
      { id: 5, x: 550, y: 320 },
      { id: 6, x: 250, y: 460 },
      { id: 7, x: 400, y: 460 },
      { id: 8, x: 550, y: 460 }
    ],
    edges: [
      { u: 0, v: 1 },
      { u: 1, v: 2, oneWay: true }, // 1 -> 2
      { u: 0, v: 3 },
      { u: 1, v: 4, double: true },
      { u: 2, v: 5 },
      { u: 3, v: 4 },
      { u: 4, v: 5 },
      { u: 3, v: 6 },
      { u: 4, v: 7 },
      { u: 5, v: 8 },
      { u: 6, v: 7, oneWay: true }, // 6 -> 7
      { u: 7, v: 8 }
    ],
    portals: []
  },
  {
    id: 9,
    name: "時空交錯 (Warp Zone)",
    description: "左右兩邊的子圖形完全獨立，只有傳送門連接兩端。你必須利用傳送門完成跳躍！",
    startNode: null,
    endNode: null,
    nodes: [
      // Left Subgraph
      { id: 0, x: 200, y: 200 },
      { id: 1, x: 320, y: 200 },
      { id: 2, x: 200, y: 400 },
      { id: 3, x: 320, y: 400, isPortal: true, portalId: 0 },
      // Right Subgraph
      { id: 4, x: 480, y: 200, isPortal: true, portalId: 0 },
      { id: 5, x: 600, y: 200 },
      { id: 6, x: 480, y: 400 },
      { id: 7, x: 600, y: 400 }
    ],
    edges: [
      // Left shape
      { u: 0, v: 1 },
      { u: 1, v: 3 },
      { u: 3, v: 2 },
      { u: 2, v: 0 },
      { u: 0, v: 3 },
      // Right shape
      { u: 4, v: 5 },
      { u: 5, v: 7 },
      { u: 7, v: 6 },
      { u: 6, v: 4 },
      { u: 7, v: 4 }
    ],
    portals: [
      { a: 3, b: 4, color: "#30d158" } // Green portals linking 3 and 4
    ]
  },
  {
    id: 10,
    name: "終極考驗 (Infinite Nexus)",
    description: "集大成關卡！包含指定起訖 (S / E)、雙道路、單向道與傳送門。這是一場真正的幾何考驗！",
    startNode: 0,
    endNode: 7,
    nodes: [
      { id: 0, x: 150, y: 300, label: "S" },
      { id: 1, x: 300, y: 150 },
      { id: 2, x: 300, y: 300, isPortal: true, portalId: 0 },
      { id: 3, x: 300, y: 450 },
      { id: 4, x: 500, y: 150, isPortal: true, portalId: 0 },
      { id: 5, x: 500, y: 300 },
      { id: 6, x: 500, y: 450 },
      { id: 7, x: 650, y: 300, label: "E" }
    ],
    edges: [
      { u: 0, v: 1 },
      { u: 0, v: 3 },
      { u: 1, v: 2 },
      { u: 3, v: 2 },
      { u: 4, v: 5, double: true },
      { u: 5, v: 7 },
      { u: 6, v: 7 },
      { u: 4, v: 7, oneWay: true }, // 4 -> 7
      { u: 6, v: 5 }
    ],
    portals: [
      { a: 2, b: 4, color: "#ff9f0a" } // Orange portals linking 2 and 4
    ]
  }
];
