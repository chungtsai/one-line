// ponytail: game engine using vanilla JS, SVG rendering, Web Audio API, and a fast DFS-based Euler path solver.
// All code is designed to be lightweight, self-contained, and performant.

// --- AUDIO SYNTHESIZER ---
// ponytail: synthesize retro/synth SFX programmatically to avoid loading external assets.
let audioCtx = null;
let soundEnabled = true;

function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

function playSound(type) {
  if (!soundEnabled) return;
  initAudio();
  if (!audioCtx) return;

  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(audioCtx.destination);

  const now = audioCtx.currentTime;

  if (type === 'connect') {
    // A nice rising ping, pitch scaled by current progress
    const levelProgress = path.length;
    const baseFreq = 300 + levelProgress * 40;
    osc.type = 'sine';
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.5, now + 0.1);
    
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
    osc.start(now);
    osc.stop(now + 0.15);
  } else if (type === 'portal') {
    // A sweeping space sound
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(800, now + 0.3);
    
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.3);
    osc.start(now);
    osc.stop(now + 0.3);
  } else if (type === 'error') {
    // Low buzzer
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(120, now);
    osc.frequency.linearRampToValueAtTime(80, now + 0.25);
    
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.25);
    osc.start(now);
    osc.stop(now + 0.25);
  } else if (type === 'reset') {
    // Descending swoop
    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.linearRampToValueAtTime(150, now + 0.2);
    
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.2);
    osc.start(now);
    osc.stop(now + 0.2);
  } else if (type === 'win') {
    // Beautiful major chord arpeggio
    const notes = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99]; // C major
    notes.forEach((freq, idx) => {
      const noteOsc = audioCtx.createOscillator();
      const noteGain = audioCtx.createGain();
      noteOsc.connect(noteGain);
      noteGain.connect(audioCtx.destination);
      
      noteOsc.type = 'sine';
      noteOsc.frequency.setValueAtTime(freq, now + idx * 0.08);
      
      noteGain.gain.setValueAtTime(0, now + idx * 0.08);
      noteGain.gain.linearRampToValueAtTime(0.12, now + idx * 0.08 + 0.02);
      noteGain.gain.exponentialRampToValueAtTime(0.01, now + idx * 0.08 + 0.5);
      
      noteOsc.start(now + idx * 0.08);
      noteOsc.stop(now + idx * 0.08 + 0.55);
    });
  }
}

// --- GAME STATE ---
let activeLevel = null;
let activeLevelIndex = 0;
let path = []; // node IDs visited
let edgeRemaining = []; // matching levels.js edges, tracking remaining traversals
let resetsCount = 0;
let hintsCount = 0;
let hintsUsedThisLevel = false;
let isDrawing = false;
let pointerX = 0;
let pointerY = 0;
let hintPaths = []; // next steps suggested by hint solver
let completedLevels = {}; // { levelId: stars }

// Timer state
let levelStartTime = null;
let timerInterval = null;
let levelDuration = 0;

function resetTimer() {
  clearInterval(timerInterval);
  timerInterval = null;
  levelStartTime = null;
  levelDuration = 0;
  const timeStat = document.getElementById('time-stat');
  if (timeStat) timeStat.textContent = '⏱️ 時間: 0秒';
}

function startTimer() {
  if (timerInterval) return;
  levelStartTime = Date.now();
  timerInterval = setInterval(() => {
    levelDuration = Math.floor((Date.now() - levelStartTime) / 1000);
    const timeStat = document.getElementById('time-stat');
    if (timeStat) timeStat.textContent = `⏱️ 時間: ${levelDuration}秒`;
  }, 1000);
}

// Load progress from Local Storage
function loadProgress() {
  try {
    const saved = localStorage.getItem('oneline_progress');
    if (saved) {
      completedLevels = JSON.parse(saved);
    }
  } catch (e) {
    console.error("Failed to load progress", e);
  }
}

function saveProgress() {
  try {
    localStorage.setItem('oneline_progress', JSON.stringify(completedLevels));
  } catch (e) {
    console.error("Failed to save progress", e);
  }
}

// --- DOM ELEMENTS ---
const appEl = document.getElementById('app');
const screenHome = document.getElementById('screen-home');
const screenLevels = document.getElementById('screen-levels');
const screenGame = document.getElementById('screen-game');
const levelGrid = document.getElementById('level-grid');
const svgEl = document.getElementById('game-svg');
const winOverlay = document.getElementById('win-overlay');

// Game UI Elements
const levelNameDisplay = document.querySelector('.level-name-display');
const levelDescDisplay = document.querySelector('.level-desc-display');
const stepStat = document.getElementById('step-stat');
const resetBtn = document.getElementById('reset-btn');
const undoBtn = document.getElementById('undo-btn');
const hintBtn = document.getElementById('hint-btn');
const soundToggle = document.getElementById('sound-toggle');
const levelSelectBackBtn = document.getElementById('level-select-back');
const gameBackBtn = document.getElementById('game-back');

// Win Overlay Elements
const overlayTitle = document.querySelector('.overlay-title');
const overlayStars = document.querySelector('.overlay-stars');
const winResetsVal = document.getElementById('win-resets-val');
const winHintsVal = document.getElementById('win-hints-val');
const nextLevelBtn = document.getElementById('next-level-btn');

// --- SCREEN SWITCHING ---
function showScreen(screen) {
  [screenHome, screenLevels, screenGame].forEach(s => s.classList.remove('active'));
  screen.classList.add('active');
  if (screen === screenLevels) {
    renderLevelGrid();
  }
}

// --- LEVEL SELECTION ---
function renderLevelGrid() {
  levelGrid.innerHTML = '';
  LEVELS.forEach((lvl, idx) => {
    const isUnlocked = idx === 0 || completedLevels[LEVELS[idx - 1].id] !== undefined;
    const stars = completedLevels[lvl.id] || 0;

    const card = document.createElement('div');
    card.className = `level-card ${isUnlocked ? '' : 'locked'}`;
    
    // Create badges for special features in the level
    let badgesHtml = '';
    const hasPortal = lvl.portals && lvl.portals.length > 0;
    const hasOneWay = lvl.edges.some(e => e.oneWay);
    const hasDouble = lvl.edges.some(e => e.double);
    const hasSE = lvl.startNode !== null || lvl.endNode !== null;

    if (hasPortal) badgesHtml += '<span class="badge-portal">傳送</span>';
    if (hasOneWay) badgesHtml += '<span class="badge-oneway">單向</span>';
    if (hasDouble) badgesHtml += '<span class="badge-double">雙線</span>';

    // Stars display
    let starsHtml = '';
    if (isUnlocked && stars > 0) {
      for (let i = 0; i < 3; i++) {
        starsHtml += i < stars ? '★' : '☆';
      }
    }

    card.innerHTML = `
      <div class="level-num">${lvl.id}</div>
      <div class="level-name">${lvl.name}</div>
      ${starsHtml ? `<div class="stars-container">${starsHtml}</div>` : ''}
      <div class="badges">${badgesHtml}</div>
    `;

    if (isUnlocked) {
      card.addEventListener('click', () => {
        initAudio();
        startLevel(idx);
      });
    } else {
      // Locked card visual indicator
      const lockIcon = document.createElement('div');
      lockIcon.style.position = 'absolute';
      lockIcon.style.top = '10px';
      lockIcon.style.right = '10px';
      lockIcon.style.fontSize = '0.9rem';
      lockIcon.innerHTML = '🔒';
      card.appendChild(lockIcon);
    }

    levelGrid.appendChild(card);
  });
}

// --- GAME PLAY LOGIC ---
function startLevel(index) {
  activeLevelIndex = index;
  activeLevel = LEVELS[index];
  
  // Reset state
  path = [];
  resetsCount = 0;
  hintsCount = 0;
  hintsUsedThisLevel = false;
  isDrawing = false;
  hintPaths = [];
  resetTimer();
  
  // Set edgeRemaining capacity
  edgeRemaining = activeLevel.edges.map(e => e.double ? 2 : 1);
  
  levelNameDisplay.textContent = activeLevel.name;
  levelDescDisplay.textContent = activeLevel.description;
  
  updateGameStats();
  renderGraph();
  showScreen(screenGame);
}

function updateGameStats() {
  // calculate total edges including double lines
  const totalRequired = activeLevel.edges.reduce((sum, e) => sum + (e.double ? 2 : 1), 0);
  const currentTraversed = totalRequired - edgeRemaining.reduce((sum, r) => sum + r, 0);
  stepStat.innerHTML = `🏁 進度: ${currentTraversed}/${totalRequired}`;
  
  // Update star indicators based on current tries & hints
  const starIcons = document.querySelectorAll('.stars-indicator .star-icon');
  const currentStars = calculateStarsEstimation();
  starIcons.forEach((star, idx) => {
    if (idx < currentStars) {
      star.classList.remove('dimmed');
    } else {
      star.classList.add('dimmed');
    }
  });
}

function calculateStarsEstimation() {
  if (hintsUsedThisLevel) return 1;
  if (resetsCount > 0) return 2;
  return 3;
}

// --- RENDER GRAPH (SVG) ---
function renderGraph() {
  svgEl.innerHTML = '';
  
  // 1. Setup Definitions (Glow filter, arrows, templates)
  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  defs.innerHTML = `
    <!-- Glowing filters -->
    <filter id="neon-glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  `;
  svgEl.appendChild(defs);

  // Group container for lines (background layers first)
  const edgesGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  svgEl.appendChild(edgesGroup);

  // Group container for portal arcs
  const portalArcsGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  svgEl.appendChild(portalArcsGroup);

  // Group container for temporary drawing line
  const dragLineGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  svgEl.appendChild(dragLineGroup);

  // Group container for nodes (rendered on top)
  const nodesGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  svgEl.appendChild(nodesGroup);

  const nodes = activeLevel.nodes;
  const edges = activeLevel.edges;
  
  // Draw Base Edges
  edges.forEach((edge, idx) => {
    const uNode = nodes.find(n => n.id === edge.u);
    const vNode = nodes.find(n => n.id === edge.v);
    const remaining = edgeRemaining[idx];
    const initialCapacity = edge.double ? 2 : 1;

    // Normalizing coordinates
    const x1 = uNode.x, y1 = uNode.y;
    const x2 = vNode.x, y2 = vNode.y;
    
    // Draw background/inactive track
    if (edge.double) {
      // Double line style: Render two parallel offset lines
      const dx = x2 - x1;
      const dy = y2 - y1;
      const len = Math.sqrt(dx * dx + dy * dy);
      const ux = dx / len;
      const uy = dy / len;
      const offset = 5;
      
      const ox = -uy * offset;
      const oy = ux * offset;

      // First line
      const line1 = createSvgLine(x1 + ox, y1 + oy, x2 + ox, y2 + oy, 'rgba(255, 255, 255, 0.1)', 4);
      // Second line
      const line2 = createSvgLine(x1 - ox, y1 - oy, x2 - ox, y2 - oy, 'rgba(255, 255, 255, 0.1)', 4);
      edgesGroup.appendChild(line1);
      edgesGroup.appendChild(line2);
      
      // Draw partially/fully active tracks
      if (remaining === 1) {
        // One pass complete: make one line glow green, other remains inactive
        const actLine = createSvgLine(x1 + ox, y1 + oy, x2 + ox, y2 + oy, varColor('--double-color'), 4);
        actLine.setAttribute('filter', 'url(#neon-glow)');
        edgesGroup.appendChild(actLine);
      } else if (remaining === 0) {
        // Both passes complete: make both glow blue
        const actLine1 = createSvgLine(x1 + ox, y1 + oy, x2 + ox, y2 + oy, varColor('--accent-color'), 4);
        const actLine2 = createSvgLine(x1 - ox, y1 - oy, x2 - ox, y2 - oy, varColor('--accent-color'), 4);
        actLine1.setAttribute('filter', 'url(#neon-glow)');
        actLine2.setAttribute('filter', 'url(#neon-glow)');
        edgesGroup.appendChild(actLine1);
        edgesGroup.appendChild(actLine2);
      }
    } else {
      // Normal single line
      const line = createSvgLine(x1, y1, x2, y2, 'rgba(255, 255, 255, 0.15)', 5);
      edgesGroup.appendChild(line);

      // Traversed single line
      if (remaining === 0) {
        const actLine = createSvgLine(x1, y1, x2, y2, varColor('--accent-color'), 5);
        actLine.setAttribute('filter', 'url(#neon-glow)');
        edgesGroup.appendChild(actLine);
      }
    }

    // Draw one-way arrow indicators if applicable
    if (edge.oneWay) {
      const dx = x2 - x1;
      const dy = y2 - y1;
      const len = Math.sqrt(dx * dx + dy * dy);
      const ux = dx / len;
      const uy = dy / len;
      
      // Draw arrow in the middle
      const mx = (x1 + x2) / 2;
      const my = (y1 + y2) / 2;
      
      const arrow = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
      arrow.setAttribute('class', 'edge-arrow');
      const arrowSize = 10;
      
      // Triangle points oriented along direction
      const p1x = mx + ux * arrowSize;
      const p1y = my + uy * arrowSize;
      const p2x = mx - ux * arrowSize + uy * (arrowSize * 0.6);
      const p2y = my - uy * arrowSize - ux * (arrowSize * 0.6);
      const p3x = mx - ux * arrowSize - uy * (arrowSize * 0.6);
      const p3y = my - uy * arrowSize + ux * (arrowSize * 0.6);
      
      arrow.setAttribute('points', `${p1x},${p1y} ${p2x},${p2y} ${p3x},${p3y}`);
      
      const isTraversed = remaining === 0;
      arrow.setAttribute('fill', isTraversed ? varColor('--accent-color') : 'rgba(255, 255, 255, 0.6)');
      if (isTraversed) {
        arrow.setAttribute('filter', 'url(#neon-glow)');
      }
      edgesGroup.appendChild(arrow);
    }
  });

  // Render Portal Jumps representation (dotted connections if portal active)
  activeLevel.portals.forEach(portal => {
    const nodeA = nodes.find(n => n.id === portal.a);
    const nodeB = nodes.find(n => n.id === portal.b);
    
    // Draw a curved dotted path connecting the portals to show they are connected
    const pLine = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    pLine.setAttribute('class', 'portal-arc');
    const x1 = nodeA.x, y1 = nodeA.y;
    const x2 = nodeB.x, y2 = nodeB.y;
    
    // Calculate control point for a nice arc
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const offsetDist = 60;
    
    // perpendicular vector
    const px = -dy / Math.sqrt(dx*dx + dy*dy) * offsetDist;
    const py = dx / Math.sqrt(dx*dx + dy*dy) * offsetDist;
    
    const cx = mx + px;
    const cy = my + py;
    
    pLine.setAttribute('d', `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`);
    pLine.setAttribute('stroke', portal.color || varColor('--portal-color'));
    pLine.setAttribute('stroke-width', '2');
    pLine.setAttribute('stroke-dasharray', '5, 8');
    pLine.setAttribute('fill', 'none');
    pLine.setAttribute('opacity', '0.45');
    portalArcsGroup.appendChild(pLine);
  });

  // Render Hint Solution if available
  if (hintPaths.length > 0) {
    for (let i = 0; i < hintPaths.length - 1; i++) {
      const u = hintPaths[i];
      const v = hintPaths[i+1];
      
      // Find if they form a portal jump (skip drawing lines for teleport)
      const isPortalJump = activeLevel.portals.some(p => (p.a === u && p.b === v) || (p.b === u && p.a === v));
      if (isPortalJump) continue;
      
      const uNode = nodes.find(n => n.id === u);
      const vNode = nodes.find(n => n.id === v);
      
      const hintLine = createSvgLine(uNode.x, uNode.y, vNode.x, vNode.y, '#ff9f0a', 4);
      hintLine.setAttribute('stroke-dasharray', '4, 4');
      hintLine.setAttribute('filter', 'url(#neon-glow)');
      hintLine.setAttribute('opacity', '0.85');
      dragLineGroup.appendChild(hintLine);
    }
  }

  // Draw active drag tracking line
  if (isDrawing && path.length > 0) {
    const activeNodeId = path[path.length - 1];
    const activeNode = nodes.find(n => n.id === activeNodeId);
    
    const trackingLine = createSvgLine(activeNode.x, activeNode.y, pointerX, pointerY, varColor('--accent-color'), 3);
    trackingLine.setAttribute('stroke-dasharray', '2, 3');
    dragLineGroup.appendChild(trackingLine);
  }

  // Render Nodes (with interaction)
  nodes.forEach(node => {
    const isStartNode = activeLevel.startNode === node.id;
    const isEndNode = activeLevel.endNode === node.id;
    const inPath = path.includes(node.id);
    const isActive = path.length > 0 && path[path.length - 1] === node.id;
    
    const nodeG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    
    // Draw outer glow/pulse ring if node is active
    if (isActive) {
      const activePulse = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      activePulse.setAttribute('cx', node.x);
      activePulse.setAttribute('cy', node.y);
      activePulse.setAttribute('r', 20);
      activePulse.setAttribute('fill', 'none');
      activePulse.setAttribute('stroke', varColor('--accent-color'));
      activePulse.setAttribute('stroke-width', '2');
      activePulse.setAttribute('filter', 'url(#neon-glow)');
      
      // Simple pulse animation markup inside SVG
      const anim = document.createElementNS('http://www.w3.org/2000/svg', 'animate');
      anim.setAttribute('attributeName', 'r');
      anim.setAttribute('values', '15;24;15');
      anim.setAttribute('dur', '2s');
      anim.setAttribute('repeatCount', 'indefinite');
      activePulse.appendChild(anim);
      
      nodeG.appendChild(activePulse);
    }

    // Detect portal
    const portal = activeLevel.portals.find(p => p.a === node.id || p.b === node.id);

    // Inner circle
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', node.x);
    circle.setAttribute('cy', node.y);
    circle.setAttribute('r', 13);
    circle.setAttribute('class', 'node-circle');
    
    // Determine colors
    if (portal) {
      circle.setAttribute('fill', '#050510');
      circle.setAttribute('stroke', portal.color || varColor('--portal-color'));
      circle.setAttribute('stroke-width', '3');
      circle.setAttribute('filter', 'url(#neon-glow)');

      // Add a rotating vortex-like ring inside the portal
      const ring = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      ring.setAttribute('cx', node.x);
      ring.setAttribute('cy', node.y);
      ring.setAttribute('r', 8);
      ring.setAttribute('fill', 'none');
      ring.setAttribute('stroke', portal.color || varColor('--portal-color'));
      ring.setAttribute('stroke-width', '2');
      ring.setAttribute('stroke-dasharray', '4, 4');
      ring.setAttribute('class', 'portal-ring');
      
      // Rotate transform origin
      ring.style.transformOrigin = `${node.x}px ${node.y}px`;
      nodeG.appendChild(ring);
    } else if (isActive) {
      circle.setAttribute('fill', varColor('--accent-color'));
      circle.setAttribute('stroke', '#fff');
      circle.setAttribute('stroke-width', '3');
      circle.setAttribute('filter', 'url(#neon-glow)');
    } else if (inPath) {
      circle.setAttribute('fill', '#0c3a50');
      circle.setAttribute('stroke', varColor('--accent-color'));
      circle.setAttribute('stroke-width', '2');
    } else if (isStartNode) {
      circle.setAttribute('fill', '#ff9f0a');
      circle.setAttribute('stroke', '#fff');
      circle.setAttribute('stroke-width', '2');
    } else if (isEndNode) {
      circle.setAttribute('fill', '#ff453a');
      circle.setAttribute('stroke', '#fff');
      circle.setAttribute('stroke-width', '2');
    } else {
      circle.setAttribute('fill', 'rgba(30, 30, 60, 0.9)');
      circle.setAttribute('stroke', 'rgba(255,255,255,0.4)');
      circle.setAttribute('stroke-width', '2');
    }
    
    nodeG.appendChild(circle);

    // Optional text label (S/E or numbers)
    if (node.label) {
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', node.x);
      text.setAttribute('y', node.y);
      text.setAttribute('class', 'node-label');
      text.textContent = node.label;
      nodeG.appendChild(text);
    }

    // Attach Event Listeners to each node group for drawing interactions
    nodeG.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      handleNodeInputStart(node.id);
    });
    nodeG.addEventListener('touchstart', (e) => {
      e.preventDefault();
      e.stopPropagation();
      handleNodeInputStart(node.id);
    }, { passive: false });

    nodeG.addEventListener('mouseenter', () => {
      if (isDrawing) {
        handleNodeInputHover(node.id);
      }
    });

    nodesGroup.appendChild(nodeG);
  });
}

function createSvgLine(x1, y1, x2, y2, strokeColor, strokeWidth) {
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  line.setAttribute('x1', x1);
  line.setAttribute('y1', y1);
  line.setAttribute('x2', x2);
  line.setAttribute('y2', y2);
  line.setAttribute('stroke', strokeColor);
  line.setAttribute('stroke-width', strokeWidth);
  line.setAttribute('class', 'edge-line');
  return line;
}

function varColor(cssVarName) {
  return getComputedStyle(document.documentElement).getPropertyValue(cssVarName).trim();
}

// --- NODE SELECTION & INTERACTION LOGIC ---
function handleNodeInputStart(nodeId) {
  if (path.length === 0) {
    // Starting a new path
    if (activeLevel.startNode !== null && activeLevel.startNode !== nodeId) {
      // Must start at designated startNode S
      playSound('error');
      shakeGameBoard();
      return;
    }
    path.push(nodeId);
    isDrawing = true;
    playSound('connect');
    
    // Check if node is portal, trigger teleport
    checkAndTriggerPortal(nodeId);
    
    // Start timer on first move
    startTimer();
    
    renderGraph();
    updateGameStats();
  } else {
    // Clicked node when path already started
    const currentActiveNode = path[path.length - 1];
    
    if (currentActiveNode === nodeId) {
      // Toggle drawing tracking line
      isDrawing = true;
    } else {
      // Attempting to connect to another node
      tryConnectToNode(nodeId);
    }
  }
}

function handleNodeInputHover(nodeId) {
  if (path.length === 0) return;
  const currentActive = path[path.length - 1];
  
  if (currentActive === nodeId) return;

  // Check if hover is going backward (Undo gesture)
  // If user rolls back to the previous node (before active), we pop the path
  if (path.length > 1) {
    // If it's a portal jump, the path structure is: [..., normal_A, portal_A, portal_B]
    // If we undo a portal jump, we must pop BOTH portal_B and portal_A
    const previousIndex = path.length - 2;
    const isPortalJump = activeLevel.portals.some(p => 
      (p.a === path[previousIndex] && p.b === currentActive) || 
      (p.b === path[previousIndex] && p.a === currentActive)
    );

    if (isPortalJump && path.length > 2 && path[path.length - 3] === nodeId) {
      // Undo portal teleport
      undoLastStep();
      return;
    } else if (path[path.length - 2] === nodeId) {
      // Standard Undo
      undoLastStep();
      return;
    }
  }

  // Otherwise, attempt forward connection
  tryConnectToNode(nodeId);
}

function checkAndTriggerPortal(nodeId) {
  const portal = activeLevel.portals.find(p => p.a === nodeId || p.b === nodeId);
  if (portal) {
    const destNode = portal.a === nodeId ? portal.b : portal.a;
    path.push(destNode); // Append destination portal node to path
    setTimeout(() => playSound('portal'), 50);
  }
}

function tryConnectToNode(nodeId) {
  const currentActiveNode = path[path.length - 1];
  
  // Find valid edge connecting active node and targeted node
  let edgeIndex = -1;
  let matchesDirection = true;
  
  for (let i = 0; i < activeLevel.edges.length; i++) {
    const e = activeLevel.edges[i];
    if (e.u === currentActiveNode && e.v === nodeId) {
      edgeIndex = i;
      matchesDirection = true;
      break;
    } else if (e.v === currentActiveNode && e.u === nodeId) {
      edgeIndex = i;
      matchesDirection = !e.oneWay; // if one-way, must travel in u -> v
      break;
    }
  }

  if (edgeIndex !== -1 && matchesDirection && edgeRemaining[edgeIndex] > 0) {
    // Valid connection!
    edgeRemaining[edgeIndex]--;
    path.push(nodeId);
    
    playSound('connect');
    
    // Check if target is a portal
    checkAndTriggerPortal(nodeId);
    
    // Clear hint path suggestions
    hintPaths = [];
    
    renderGraph();
    updateGameStats();
    
    // Check win condition
    checkWinCondition();
  } else {
    // Play subtle error sound if user dragged into an invalid node
    if (isDrawing) {
      playSound('error');
    }
  }
}

function undoLastStep() {
  if (path.length <= 1) {
    resetLevel();
    return;
  }
  
  const poppedNode = path.pop();
  
  // Check if we just popped a portal teleport
  // If so, we need to pop the corresponding paired portal too!
  const currentActive = path[path.length - 1];
  const portal = activeLevel.portals.find(p => 
    (p.a === poppedNode && p.b === currentActive) || 
    (p.b === poppedNode && p.a === currentActive)
  );

  if (portal) {
    // Yes! This was a portal jump. Pop the portal entrance node as well.
    path.pop();
  }

  // Restore the edge traversal capacity
  const prevActive = path[path.length - 1];
  const entranceNode = portal ? (portal.a === poppedNode ? portal.b : portal.a) : poppedNode;
  
  // Find which edge was traversed
  for (let i = 0; i < activeLevel.edges.length; i++) {
    const e = activeLevel.edges[i];
    if ((e.u === prevActive && e.v === entranceNode) || (e.v === prevActive && e.u === entranceNode)) {
      edgeRemaining[i]++;
      break;
    }
  }

  playSound('reset');
  hintPaths = [];
  renderGraph();
  updateGameStats();
}

function resetLevel() {
  path = [];
  edgeRemaining = activeLevel.edges.map(e => e.double ? 2 : 1);
  resetsCount++;
  isDrawing = false;
  hintPaths = [];
  resetTimer();
  
  playSound('reset');
  renderGraph();
  updateGameStats();
}

function shakeGameBoard() {
  const container = document.querySelector('.canvas-container');
  container.classList.add('shake');
  setTimeout(() => {
    container.classList.remove('shake');
  }, 400);
}

// --- WIN EVALUATION ---
function checkWinCondition() {
  // Check if all edges are traversed (all remaining capacity is 0)
  const allTraversed = edgeRemaining.every(rem => rem === 0);
  if (!allTraversed) return;

  // Check endNode constraint if specified
  if (activeLevel.endNode !== null) {
    const lastNode = path[path.length - 1];
    if (lastNode !== activeLevel.endNode) {
      return; // Traversed everything but didn't finish on E
    }
  }

  // Player Won!
  isDrawing = false;
  clearInterval(timerInterval); // Stop timer
  playSound('win');
  
  // Calculate final score
  const finalStars = calculateStarsEstimation();
  
  // Save progress
  const prevStars = completedLevels[activeLevel.id] || 0;
  if (finalStars > prevStars) {
    completedLevels[activeLevel.id] = finalStars;
    saveProgress();
  }

  // Show overlay
  setTimeout(() => {
    showWinOverlay(finalStars);
  }, 500);
}

function showWinOverlay(stars) {
  winResetsVal.textContent = resetsCount;
  winHintsVal.textContent = hintsUsedThisLevel ? "有使用" : "無使用";
  
  const winTimeVal = document.getElementById('win-time-val');
  if (winTimeVal) {
    winTimeVal.textContent = `${levelDuration}秒`;
  }
  
  // Set star colors in overlay
  overlayStars.innerHTML = '';
  for (let i = 1; i <= 3; i++) {
    const starSpan = document.createElement('span');
    starSpan.className = 'overlay-star';
    starSpan.innerHTML = '★';
    overlayStars.appendChild(starSpan);
    
    // Animate stars popping up sequentially
    setTimeout(() => {
      if (i <= stars) {
        starSpan.classList.add('active');
      }
    }, i * 200);
  }

  // Check if there is a next level
  if (activeLevelIndex < LEVELS.length - 1) {
    nextLevelBtn.style.display = 'block';
    nextLevelBtn.textContent = '下一關 (Next Level)';
  } else {
    nextLevelBtn.style.display = 'none';
  }

  winOverlay.classList.add('active');
}

function closeWinOverlay() {
  winOverlay.classList.remove('active');
}

// --- HINT SOLVER ---
// ponytail: DFS solver for Euler paths to suggest correct next moves. Very fast and lightweight.
function getHint() {
  if (path.length === 0 && activeLevel.startNode === null) {
    // If path hasn't started and there's no fixed starting node, solve starting from every node
    let solution = null;
    for (let i = 0; i < activeLevel.nodes.length; i++) {
      const solverPath = [activeLevel.nodes[i].id];
      const counts = [...edgeRemaining];
      solution = solveGraphDFS(activeLevel.nodes[i].id, solverPath, counts);
      if (solution) break;
    }
    
    if (solution) {
      hintsUsedThisLevel = true;
      hintPaths = solution.slice(0, 3); // show start node and next 2 steps
      renderGraph();
      updateGameStats();
    } else {
      playSound('error');
    }
    return;
  }

  const currentActiveNode = path.length > 0 ? path[path.length - 1] : activeLevel.startNode;
  const currentPath = path.length > 0 ? [...path] : [currentActiveNode];
  const currentCounts = [...edgeRemaining];

  const solution = solveGraphDFS(currentActiveNode, currentPath, currentCounts);
  if (solution) {
    hintsUsedThisLevel = true;
    
    // Find the relative path representing the hint
    // We display the next 3 steps from the current active node
    const activeIndex = path.length > 0 ? path.length - 1 : 0;
    hintPaths = solution.slice(activeIndex, activeIndex + 4);
    
    renderGraph();
    updateGameStats();
  } else {
    // No solution possible from this state! Show error and shake.
    playSound('error');
    shakeGameBoard();
  }
}

function solveGraphDFS(currentNode, curPath, edgeCounts) {
  // Check if all edge capacities are 0 (fully traversed)
  const isFinished = edgeCounts.every(c => c === 0);
  if (isFinished) {
    if (activeLevel.endNode !== null && currentNode !== activeLevel.endNode) {
      return null; // invalid ending node
    }
    return curPath;
  }

  // Iterate over connected nodes
  for (let i = 0; i < activeLevel.edges.length; i++) {
    if (edgeCounts[i] === 0) continue;
    
    const edge = activeLevel.edges[i];
    let nextNode = null;

    if (edge.u === currentNode) {
      nextNode = edge.v;
    } else if (edge.v === currentNode && !edge.oneWay) {
      nextNode = edge.u;
    }

    if (nextNode !== null) {
      // Traverse edge i
      edgeCounts[i]--;
      let nextPath = [...curPath];
      let nextActive = nextNode;
      
      // Portal check
      const portal = activeLevel.portals.find(p => p.a === nextNode || p.b === nextNode);
      if (portal) {
        const dest = portal.a === nextNode ? portal.b : portal.a;
        nextPath.push(nextNode);
        nextPath.push(dest);
        nextActive = dest;
      } else {
        nextPath.push(nextNode);
      }

      const result = solveGraphDFS(nextActive, nextPath, edgeCounts);
      if (result) return result;

      // Backtrack
      edgeCounts[i]++;
    }
  }

  return null;
}

// --- GLOBAL EVENT HANDLERS ---
// Track drag positions relative to the SVG canvas
function updatePointerPosition(e) {
  const rect = svgEl.getBoundingClientRect();
  let clientX = 0, clientY = 0;

  if (e.touches && e.touches.length > 0) {
    clientX = e.touches[0].clientX;
    clientY = e.touches[0].clientY;
  } else {
    clientX = e.clientX;
    clientY = e.clientY;
  }

  // Convert client space to local SVG space coordinates (viewBox 800x600)
  const localX = (clientX - rect.left) / rect.width * 800;
  const localY = (clientY - rect.top) / rect.height * 600;
  
  pointerX = localX;
  pointerY = localY;
}

document.addEventListener('mousemove', (e) => {
  if (isDrawing) {
    updatePointerPosition(e);
    // ponytail: proximity check for mouse to handle quick dragging and ensure line connects reliably
    const mouseX = pointerX;
    const mouseY = pointerY;
    activeLevel.nodes.forEach(node => {
      const dist = Math.hypot(node.x - mouseX, node.y - mouseY);
      if (dist < 25) { // trigger threshold
        handleNodeInputHover(node.id);
      }
    });
    renderGraph();
  }
});

document.addEventListener('touchmove', (e) => {
  if (isDrawing) {
    if (e.cancelable) e.preventDefault(); // ponytail: prevent mobile viewport scrolling while dragging paths
    updatePointerPosition(e);
    // For touches, we automatically detect which node we are hovering over
    const touchX = pointerX;
    const touchY = pointerY;
    
    // Find closest node
    activeLevel.nodes.forEach(node => {
      const dist = Math.hypot(node.x - touchX, node.y - touchY);
      if (dist < 25) { // ponytail: trigger threshold aligned with mouse proximity
        handleNodeInputHover(node.id);
      }
    });
    
    renderGraph();
  }
}, { passive: false });

document.addEventListener('mouseup', () => {
  if (isDrawing) {
    isDrawing = false;
    renderGraph();
  }
});

document.addEventListener('touchend', () => {
  if (isDrawing) {
    isDrawing = false;
    renderGraph();
  }
});

document.addEventListener('touchcancel', () => {
  if (isDrawing) {
    isDrawing = false;
    renderGraph();
  }
});

// Button Controls
resetBtn.addEventListener('click', () => {
  if (activeLevel) resetLevel();
});

undoBtn.addEventListener('click', () => {
  if (activeLevel) undoLastStep();
});

hintBtn.addEventListener('click', () => {
  if (activeLevel) getHint();
});

soundToggle.addEventListener('click', () => {
  soundEnabled = !soundEnabled;
  soundToggle.textContent = soundEnabled ? '🔊' : '🔇';
  initAudio();
});

levelSelectBackBtn.addEventListener('click', () => {
  showScreen(screenHome);
});

gameBackBtn.addEventListener('click', () => {
  showScreen(screenLevels);
});

document.getElementById('start-game-btn').addEventListener('click', () => {
  initAudio();
  showScreen(screenLevels);
});

document.getElementById('restart-btn').addEventListener('click', () => {
  closeWinOverlay();
  startLevel(activeLevelIndex);
});

nextLevelBtn.addEventListener('click', () => {
  closeWinOverlay();
  if (activeLevelIndex < LEVELS.length - 1) {
    startLevel(activeLevelIndex + 1);
  }
});

document.getElementById('overlay-menu-btn').addEventListener('click', () => {
  closeWinOverlay();
  showScreen(screenLevels);
});

// Keyboard shortcuts for power users (R to reset, U to undo, H to hint)
document.addEventListener('keydown', (e) => {
  if (screenGame.classList.contains('active') && !winOverlay.classList.contains('active')) {
    if (e.key.toLowerCase() === 'r') {
      resetLevel();
    } else if (e.key.toLowerCase() === 'u') {
      undoLastStep();
    } else if (e.key.toLowerCase() === 'h') {
      getHint();
    }
  }
});

// Initialize application
loadProgress();
showScreen(screenHome);
