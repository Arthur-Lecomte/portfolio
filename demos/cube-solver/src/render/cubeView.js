// Vue 3D du Rubik's Cube (three.js) : scène, stickers pilotés par l'état
// logique de 54 facettes (src/cube/facelets.js = vérité terrain).
//
// createCubeView(container, callbacks) -> view
//   callbacks : { onUserMove, onMoveStart, onMoveCommitted, onQueueEmpty }
//   view : enqueue, setPaused, stepOnce, clearQueue, setSpeed,
//          setFacelets, setDragEnabled, isBusy, dispose

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { FACES, faceletPosition, faceletNormal } from '../cube/facelets.js';

// Couleurs de la SCÈNE (identité de la démo) — fixées par le contrat du
// projet, indépendantes des tokens d'habillage de la charte.
const COLORS = {
  U: '#f5f5f5', // blanc
  D: '#ffd500', // jaune
  F: '#009e60', // vert
  B: '#0051ba', // bleu
  R: '#c41e3a', // rouge
  L: '#ff5800', // orange
};
const PLASTIC_COLOR = '#111111';
const SCENE_BACKGROUND = '#12151d';

// Ordre des matériaux d'une BoxGeometry : +x, -x, +y, -y, +z, -z.
const MATERIAL_INDEX_BY_NORMAL = new Map([
  ['1,0,0', 0],
  ['-1,0,0', 1],
  ['0,1,0', 2],
  ['0,-1,0', 3],
  ['0,0,1', 4],
  ['0,0,-1', 5],
]);

// Normale sortante de chaque face, dérivée de la vérité terrain.
const FACE_NORMAL = Object.fromEntries(FACES.map((face, i) => [face, faceletNormal(9 * i)]));

// Lettre de face pour une normale sortante donnée ('axe,signe' -> 'U'…).
const FACE_BY_NORMAL = new Map(FACES.map((face) => [FACE_NORMAL[face].join(','), face]));

export function createCubeView(container, callbacks = {}) {
  // --- Rendu, caméra, lumières -------------------------------------------

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(SCENE_BACKGROUND);

  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  camera.position.set(5.2, 4.4, 6.6);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.domElement.style.display = 'block';
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  renderer.domElement.style.touchAction = 'none';
  container.appendChild(renderer.domElement);

  scene.add(new THREE.AmbientLight(0xffffff, 0.85));
  const keyLight = new THREE.DirectionalLight(0xffffff, 1.3);
  keyLight.position.set(6, 9, 7);
  scene.add(keyLight);
  const fillLight = new THREE.DirectionalLight(0xffffff, 0.45);
  fillLight.position.set(-6, -4, -7);
  scene.add(fillLight);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enablePan = false;
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 5.5;
  controls.maxDistance = 16;

  // --- Les 26 cubies et la table sticker <-> (cubie, matériau) ------------

  const cubeGroup = new THREE.Group();
  scene.add(cubeGroup);

  // Taille 0.96 : laisse un joint sombre entre les cubies.
  const cubieGeometry = new RoundedBoxGeometry(0.96, 0.96, 0.96, 4, 0.06);
  const plasticMaterial = new THREE.MeshStandardMaterial({
    color: PLASTIC_COLOR,
    roughness: 0.55,
    metalness: 0.05,
  });

  const cubies = [];
  const cubieByGrid = new Map(); // 'x,y,z' -> mesh
  for (let x = -1; x <= 1; x++) {
    for (let y = -1; y <= 1; y++) {
      for (let z = -1; z <= 1; z++) {
        if (x === 0 && y === 0 && z === 0) continue; // cœur invisible
        const cubie = new THREE.Mesh(cubieGeometry, new Array(6).fill(plasticMaterial));
        cubie.position.set(x, y, z);
        cubie.userData.home = [x, y, z]; // position d'origine (identité)
        cubie.userData.grid = [x, y, z]; // position entière courante
        cubeGroup.add(cubie);
        cubies.push(cubie);
        cubieByGrid.set(`${x},${y},${z}`, cubie);
      }
    }
  }

  // Pour chaque facette 0..53 : un matériau dédié sur le bon cubie, dérivé
  // de faceletPosition/faceletNormal (jamais de table écrite à la main).
  const stickerMaterials = [];
  for (let i = 0; i < 54; i++) {
    const cubie = cubieByGrid.get(faceletPosition(i).join(','));
    const materialIndex = MATERIAL_INDEX_BY_NORMAL.get(faceletNormal(i).join(','));
    const material = new THREE.MeshStandardMaterial({
      color: COLORS[FACES[Math.floor(i / 9)]],
      roughness: 0.35,
      metalness: 0.04,
    });
    cubie.material[materialIndex] = material;
    stickerMaterials.push(material);
  }

  // Remet chaque cubie à sa position/orientation d'identité.
  function resetToIdentity() {
    for (const cubie of cubies) {
      if (cubie.parent !== cubeGroup) cubeGroup.add(cubie);
      const [x, y, z] = cubie.userData.home;
      cubie.position.set(x, y, z);
      cubie.quaternion.identity();
      cubie.userData.grid = [x, y, z];
    }
    // Évacue les pivots orphelins (coup ou geste abandonné).
    for (const child of [...cubeGroup.children]) {
      if (!child.isMesh) cubeGroup.remove(child);
    }
  }

  // Recolorie les stickers d'après un état de 54 facettes, géométrie remise
  // à l'identité (aucun déplacement de cubie n'est nécessaire).
  function setFacelets(state) {
    // Abandonne sans rappel un éventuel coup ou geste en cours : la
    // géométrie va de toute façon être remise à l'identité.
    currentMove = null;
    snapAnim = null;
    if (gesture) {
      releasePointer(gesture.pointerId);
      gesture = null;
    }
    resetToIdentity();
    for (let i = 0; i < 54; i++) {
      stickerMaterials[i].color.set(COLORS[state[i]] ?? PLASTIC_COLOR);
    }
    needsRender = true;
  }

  // --- Moteur d'animation : file de coups ----------------------------------

  const WORLD_AXES = [
    new THREE.Vector3(1, 0, 0),
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(0, 0, 1),
  ];

  // Rendu à la demande : le GPU est partagé entre toutes les fenêtres, et
  // une scène immobile redessinée à 60 i/s fait saccader une vidéo qui
  // tourne à côté. Chaque mutation visuelle lève ce drapeau ; la boucle ne
  // rend que s'il est levé ou si la caméra a bougé (voir loop()).
  let needsRender = true;

  let speedMs = 220; // durée d'un quart de tour
  let paused = false;
  let stepRequested = false; // stepOnce : jouer exactement le prochain coup
  const queue = []; // { move, meta, index }
  let currentMove = null; // { move, meta, index, pivot, axis, targetAngle, … }

  function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  // Décompose un jeton ('R', "U'", 'F2'…) : axe monde (0=x, 1=y, 2=z),
  // couche (coordonnée ±1 sur cet axe) et angle signé autour de +axe.
  // Jeton nu = -90° autour de la normale SORTANTE (horaire vu de
  // l'extérieur de la face), cohérent avec applyMove de facelets.js.
  function parseToken(move) {
    const normal = FACE_NORMAL[move[0]];
    if (!normal) throw new Error(`Unknown move: ${move}`);
    const axis = normal.findIndex((c) => c !== 0);
    const layer = normal[axis];
    const suffix = move.slice(1);
    const outwardAngle = suffix === "'" ? Math.PI / 2 : suffix === '2' ? -Math.PI : -Math.PI / 2;
    return {
      axis,
      layer,
      angle: outwardAngle * layer, // reporté sur l'axe monde positif
      halfTurn: suffix === '2',
    };
  }

  function layerCubies(axis, layer) {
    return cubies.filter((c) => c.userData.grid[axis] === layer);
  }

  function createPivot(cubieList) {
    const pivot = new THREE.Group();
    cubeGroup.add(pivot);
    for (const cubie of cubieList) pivot.attach(cubie);
    return pivot;
  }

  // Figeage : réintègre les cubies dans le groupe racine, positions
  // arrondies à la grille entière, orientation recalée sur l'alignement
  // d'axes le plus proche — aucune dérive de flottants entre deux coups.
  const tmpMatrix = new THREE.Matrix4();
  function snapCubie(cubie) {
    cubie.position.set(
      Math.round(cubie.position.x),
      Math.round(cubie.position.y),
      Math.round(cubie.position.z),
    );
    tmpMatrix.makeRotationFromQuaternion(cubie.quaternion);
    const e = tmpMatrix.elements;
    for (let i = 0; i < 16; i++) e[i] = Math.round(e[i]);
    cubie.quaternion.setFromRotationMatrix(tmpMatrix);
    cubie.userData.grid = [cubie.position.x, cubie.position.y, cubie.position.z];
  }

  function snapPivot(pivot) {
    for (const cubie of [...pivot.children]) {
      cubeGroup.attach(cubie);
      snapCubie(cubie);
    }
    cubeGroup.remove(pivot);
  }

  function startMove(now) {
    const { move, meta, index } = queue.shift();
    const { axis, layer, angle, halfTurn } = parseToken(move);
    const pivot = createPivot(layerCubies(axis, layer));
    currentMove = {
      move,
      meta,
      index,
      pivot,
      axis: WORLD_AXES[axis],
      targetAngle: angle,
      start: now,
      duration: Math.max(1, speedMs * (halfTurn ? 1.6 : 1)),
    };
    callbacks.onMoveStart?.(move, meta, index);
  }

  function finishMove() {
    const { pivot, axis, targetAngle, move, meta, index } = currentMove;
    pivot.quaternion.setFromAxisAngle(axis, targetAngle);
    snapPivot(pivot);
    currentMove = null;
    needsRender = true; // clearQueue peut figer hors de tickAnimation
    callbacks.onMoveCommitted?.(move, meta, index);
    // onMoveCommitted a pu ré-alimenter la file : ne signale le vide
    // qu'une fois la file réellement épuisée.
    if (!currentMove && queue.length === 0) callbacks.onQueueEmpty?.();
  }

  function tickAnimation(now) {
    if (snapAnim) {
      needsRender = true;
      const t = Math.min(1, (now - snapAnim.start) / snapAnim.duration);
      snapAnim.pivot.quaternion.setFromAxisAngle(
        snapAnim.axisVec,
        snapAnim.from + (snapAnim.to - snapAnim.from) * easeInOutCubic(t),
      );
      if (t >= 1) {
        const done = snapAnim;
        snapAnim = null;
        done.finish();
      }
    }
    if (currentMove) {
      needsRender = true;
      const t = Math.min(1, (now - currentMove.start) / currentMove.duration);
      currentMove.pivot.quaternion.setFromAxisAngle(
        currentMove.axis,
        currentMove.targetAngle * easeInOutCubic(t),
      );
      if (t >= 1) finishMove();
    }
    if (!currentMove && !gesture && !snapAnim && queue.length > 0 && (!paused || stepRequested)) {
      stepRequested = false;
      startMove(now);
    }
  }

  // Ajoute un lot de coups ; `meta` et l'index du coup dans son lot sont
  // rendus tels quels à onMoveStart / onMoveCommitted.
  function enqueue(moves, meta) {
    moves.forEach((move, index) => queue.push({ move, meta, index }));
  }

  function setPaused(pause) {
    paused = Boolean(pause);
    if (!paused) stepRequested = false;
  }

  // Joue exactement un coup quand la file est en pause.
  function stepOnce() {
    if (paused && !currentMove && queue.length > 0) stepRequested = true;
  }

  // Vide la file en terminant proprement le coup en cours.
  function clearQueue() {
    const hadWork = Boolean(currentMove) || queue.length > 0;
    queue.length = 0;
    stepRequested = false;
    if (currentMove) finishMove();
    else if (hadWork) callbacks.onQueueEmpty?.();
  }

  function setSpeed(msPerQuarterTurn) {
    const ms = Number(msPerQuarterTurn);
    if (Number.isFinite(ms)) speedMs = Math.min(2000, Math.max(40, ms));
  }

  // --- Rotation des tranches au glisser (Pointer Events) --------------------

  // Normale locale de chaque indice de matériau d'une BoxGeometry.
  const LOCAL_NORMALS = [
    new THREE.Vector3(1, 0, 0),
    new THREE.Vector3(-1, 0, 0),
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(0, -1, 0),
    new THREE.Vector3(0, 0, 1),
    new THREE.Vector3(0, 0, -1),
  ];

  const DRAG_THRESHOLD_PX = 8; // seuil écran avant de choisir l'axe tangent
  const RAD_PER_UNIT = Math.PI / 2 / 1.5; // ~90° par 1,5 largeur de cubie

  let dragEnabled = true;
  let gesture = null; // phase 'pending' puis 'active' (voir onPointerDown)
  let snapAnim = null; // animation de recalage au multiple de 90°
  let redispatching = false; // évènement synthétique pour OrbitControls

  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const dragPlane = new THREE.Plane();
  const planePoint = new THREE.Vector3();
  const tmpVector = new THREE.Vector3();

  function releasePointer(pointerId) {
    try {
      renderer.domElement.releasePointerCapture(pointerId);
    } catch {
      /* capture déjà relâchée */
    }
  }

  function rayFromPointer(e) {
    const rect = renderer.domElement.getBoundingClientRect();
    ndc.set(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    );
    raycaster.setFromCamera(ndc, camera);
  }

  // Intersection du rayon du pointeur avec le plan de la face saisie.
  function projectOnPlane(e) {
    rayFromPointer(e);
    tmpVector.set(0, 0, 0).setComponent(gesture.normalAxis, gesture.normalSign);
    dragPlane.setFromNormalAndCoplanarPoint(tmpVector, gesture.impact);
    return raycaster.ray.intersectPlane(dragPlane, planePoint);
  }

  // Signe de la permutation (i, j, k) de (0, 1, 2) — indices distincts.
  function permutationSign(i, j) {
    return (j - i + 3) % 3 === 1 ? 1 : -1;
  }

  function onPointerDown(e) {
    if (redispatching) return; // destiné à OrbitControls
    if (gesture || snapAnim) {
      e.stopPropagation(); // pas d'orbite pendant un geste de tranche
      return;
    }
    if (!dragEnabled) return; // l'orbite reste active
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (currentMove || queue.length > 0) return; // animation en cours : orbite
    rayFromPointer(e);
    const hits = raycaster.intersectObjects(cubies, false);
    if (hits.length === 0) return; // fond : orbite
    const hit = hits[0];
    // Face touchée identifiée par l'indice de matériau (fiable même sur
    // les arrondis), puis normale monde recalée sur l'axe dominant.
    const worldNormal = LOCAL_NORMALS[hit.face.materialIndex]
      .clone()
      .transformDirection(hit.object.matrixWorld);
    let normalAxis = 0;
    if (Math.abs(worldNormal.y) > Math.abs(worldNormal.getComponent(normalAxis))) normalAxis = 1;
    if (Math.abs(worldNormal.z) > Math.abs(worldNormal.getComponent(normalAxis))) normalAxis = 2;
    const normalSign = worldNormal.getComponent(normalAxis) >= 0 ? 1 : -1;
    const grid = hit.object.userData.grid;
    if (grid[normalAxis] !== normalSign) return; // face intérieure : orbite
    // Sticker central : toute rotation serait une tranche du milieu,
    // on laisse OrbitControls orbiter.
    const tangents = [0, 1, 2].filter((a) => a !== normalAxis);
    if (grid[tangents[0]] === 0 && grid[tangents[1]] === 0) return;
    // Mode tranche : on confisque le geste (OrbitControls ne verra pas
    // ce pointerdown grâce à stopPropagation en phase de capture).
    e.stopPropagation();
    try {
      renderer.domElement.setPointerCapture(e.pointerId);
    } catch {
      /* capture indisponible */
    }
    gesture = {
      phase: 'pending',
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      cubie: hit.object,
      normalAxis,
      normalSign,
      impact: hit.point.clone(),
    };
  }

  // Tranche du milieu : on abandonne et on rend le geste à OrbitControls
  // en lui rejouant un pointerdown synthétique.
  function yieldToOrbit(e) {
    releasePointer(gesture.pointerId);
    gesture = null;
    redispatching = true;
    try {
      renderer.domElement.dispatchEvent(
        new PointerEvent('pointerdown', {
          pointerId: e.pointerId,
          pointerType: e.pointerType,
          isPrimary: true,
          clientX: e.clientX,
          clientY: e.clientY,
          button: 0,
          buttons: 1,
          bubbles: true,
        }),
      );
    } finally {
      redispatching = false;
    }
  }

  function onPointerMove(e) {
    if (!gesture || e.pointerId !== gesture.pointerId) return;
    if (gesture.phase === 'pending') {
      const dx = e.clientX - gesture.startX;
      const dy = e.clientY - gesture.startY;
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
      if (!projectOnPlane(e)) return;
      // Axe tangent t : celui des deux axes ⊥ n le plus aligné avec le
      // drag monde ; l'axe de rotation est le troisième axe.
      tmpVector.copy(planePoint).sub(gesture.impact);
      const [c1, c2] = [0, 1, 2].filter((a) => a !== gesture.normalAxis);
      const tIdx =
        Math.abs(tmpVector.getComponent(c1)) >= Math.abs(tmpVector.getComponent(c2)) ? c1 : c2;
      const rotAxis = tIdx === c1 ? c2 : c1;
      const coord = gesture.cubie.userData.grid[rotAxis];
      if (coord === 0) {
        yieldToOrbit(e);
        return;
      }
      // sigma = (axe de rotation × normale sortante) · t : signe reliant
      // la distance de drag le long de t à l'angle autour de +rotAxis.
      gesture.phase = 'active';
      gesture.tIdx = tIdx;
      gesture.rotAxis = rotAxis;
      gesture.coord = coord;
      gesture.axisVec = WORLD_AXES[rotAxis];
      gesture.sigma = permutationSign(rotAxis, gesture.normalAxis) * gesture.normalSign;
      gesture.angle = 0;
      gesture.pivot = createPivot(layerCubies(rotAxis, coord));
    }
    if (gesture.phase === 'active') {
      if (!projectOnPlane(e)) return;
      const s = planePoint.getComponent(gesture.tIdx) - gesture.impact.getComponent(gesture.tIdx);
      gesture.angle = Math.max(-Math.PI, Math.min(Math.PI, s * gesture.sigma * RAD_PER_UNIT));
      gesture.pivot.quaternion.setFromAxisAngle(gesture.axisVec, gesture.angle);
      needsRender = true;
    }
  }

  // Recale la tranche au multiple de 90° le plus proche (borné à ±180°),
  // fige, puis émet le jeton correspondant via onUserMove.
  function startSnap(g, duration) {
    const quarters = Math.max(-2, Math.min(2, Math.round(g.angle / (Math.PI / 2))));
    const target = (quarters * Math.PI) / 2;
    const finish = () => {
      g.pivot.quaternion.setFromAxisAngle(g.axisVec, target);
      snapPivot(g.pivot);
      needsRender = true; // setDragEnabled peut figer hors de tickAnimation
      // Angle horaire autour de la NORMALE SORTANTE (rotAxis · coord) :
      // jeton nu = 1 quart horaire, cohérent avec applyMove.
      const clockwiseQuarters = (((-quarters * g.coord) % 4) + 4) % 4;
      if (clockwiseQuarters !== 0) {
        tmpVector.set(0, 0, 0).setComponent(g.rotAxis, g.coord);
        const face = FACE_BY_NORMAL.get(`${tmpVector.x},${tmpVector.y},${tmpVector.z}`);
        const token =
          clockwiseQuarters === 1 ? face : clockwiseQuarters === 2 ? face + '2' : face + "'";
        callbacks.onUserMove?.(token);
      }
    };
    if (duration <= 0) {
      finish();
    } else {
      snapAnim = {
        pivot: g.pivot,
        axisVec: g.axisVec,
        from: g.angle,
        to: target,
        start: performance.now(),
        duration,
        finish,
      };
    }
  }

  function onPointerUp(e) {
    if (!gesture || e.pointerId !== gesture.pointerId) return;
    const g = gesture;
    gesture = null;
    releasePointer(e.pointerId);
    if (g.phase === 'active') startSnap(g, 80);
    // phase 'pending' : simple clic sur un sticker, rien à faire.
  }

  // Coupe le mode tranche (l'orbite reste active). Un geste OU un recalage
  // en cours est terminé immédiatement (figeage + jeton émis le cas
  // échéant) : au retour de l'appel, plus aucun coup utilisateur n'est en
  // vol et onUserMove a déjà été notifié.
  function setDragEnabled(enabled) {
    dragEnabled = Boolean(enabled);
    if (dragEnabled) return;
    if (gesture) {
      const g = gesture;
      gesture = null;
      releasePointer(g.pointerId);
      if (g.phase === 'active') startSnap(g, 0);
    }
    if (snapAnim) {
      const s = snapAnim;
      snapAnim = null;
      s.finish();
    }
  }

  // Un coup (file ou en cours), un geste de tranche ou un recalage est-il
  // actif ? Tant que oui, l'état logique du consommateur peut encore bouger.
  function isBusy() {
    return Boolean(currentMove) || queue.length > 0 || Boolean(gesture) || Boolean(snapAnim);
  }

  // pointerdown en phase de capture sur le conteneur : si on entre en mode
  // tranche, stopPropagation empêche OrbitControls de démarrer une orbite.
  container.addEventListener('pointerdown', onPointerDown, true);
  renderer.domElement.addEventListener('pointermove', onPointerMove);
  renderer.domElement.addEventListener('pointerup', onPointerUp);
  renderer.domElement.addEventListener('pointercancel', onPointerUp);

  // --- Redimensionnement ---------------------------------------------------

  function resize() {
    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    // Le devicePixelRatio change avec le zoom du navigateur ou un
    // déplacement vers un autre écran : le réévaluer évite un rendu flou.
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height, false);
    needsRender = true; // setSize vide le tampon de dessin
  }
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(container);
  // Le zoom (et souvent le changement d'écran) déclenche resize sans
  // forcément changer la taille CSS du conteneur.
  window.addEventListener('resize', resize);
  resize();

  // --- Boucle de rendu -----------------------------------------------------

  let rafId = 0;
  function loop(time) {
    rafId = requestAnimationFrame(loop);
    tickAnimation(time ?? performance.now());
    // update() renvoie true tant que la caméra bouge (orbite, inertie,
    // zoom) : c'est lui qui couvre les mutations de caméra.
    const cameraMoved = controls.update();
    if (needsRender || cameraMoved) {
      needsRender = false;
      renderer.render(scene, camera);
    }
  }
  loop(performance.now());

  // --- API publique --------------------------------------------------------

  function dispose() {
    cancelAnimationFrame(rafId);
    resizeObserver.disconnect();
    window.removeEventListener('resize', resize);
    container.removeEventListener('pointerdown', onPointerDown, true);
    renderer.domElement.removeEventListener('pointermove', onPointerMove);
    renderer.domElement.removeEventListener('pointerup', onPointerUp);
    renderer.domElement.removeEventListener('pointercancel', onPointerUp);
    controls.dispose();
    cubieGeometry.dispose();
    plasticMaterial.dispose();
    for (const material of stickerMaterials) material.dispose();
    renderer.dispose();
    renderer.domElement.remove();
  }

  const view = {
    enqueue,
    setPaused,
    stepOnce,
    clearQueue,
    setSpeed,
    setFacelets,
    setDragEnabled,
    isBusy,
    dispose,
  };
  return view;
}
