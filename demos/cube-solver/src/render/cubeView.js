// Vue 3D du Rubik's Cube (three.js) : scène, stickers pilotés par l'état
// logique de 54 facettes (src/cube/facelets.js = vérité terrain).
//
// createCubeView(container, callbacks) -> vue
//   callbacks : { onUserMove, onMoveStart, onMoveCommitted, onQueueEmpty }
//   vue : enqueue, setPaused, stepOnce, clearQueue, setSpeed,
//         setFacelets, setDragEnabled, estOccupee, dispose

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { FACES, faceletPosition, faceletNormal } from '../cube/facelets.js';

// Couleurs fixées par le contrat du projet.
const COULEURS = {
  U: '#f5f5f5', // blanc
  D: '#ffd500', // jaune
  F: '#009e60', // vert
  B: '#0051ba', // bleu
  R: '#c41e3a', // rouge
  L: '#ff5800', // orange
};
const COULEUR_PLASTIQUE = '#111111';
const FOND_SCENE = '#12151d';

// Ordre des matériaux d'une BoxGeometry : +x, -x, +y, -y, +z, -z.
const INDEX_MATERIAU_PAR_NORMALE = new Map([
  ['1,0,0', 0],
  ['-1,0,0', 1],
  ['0,1,0', 2],
  ['0,-1,0', 3],
  ['0,0,1', 4],
  ['0,0,-1', 5],
]);

// Normale sortante de chaque face, dérivée de la vérité terrain.
const NORMALE_FACE = Object.fromEntries(FACES.map((face, i) => [face, faceletNormal(9 * i)]));

// Lettre de face pour une normale sortante donnée ('axe,signe' -> 'U'…).
const FACE_PAR_NORMALE = new Map(FACES.map((face) => [NORMALE_FACE[face].join(','), face]));

export function createCubeView(container, callbacks = {}) {
  // --- Rendu, caméra, lumières -------------------------------------------

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(FOND_SCENE);

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
  const lumiereCle = new THREE.DirectionalLight(0xffffff, 1.3);
  lumiereCle.position.set(6, 9, 7);
  scene.add(lumiereCle);
  const lumiereAppoint = new THREE.DirectionalLight(0xffffff, 0.45);
  lumiereAppoint.position.set(-6, -4, -7);
  scene.add(lumiereAppoint);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enablePan = false;
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 5.5;
  controls.maxDistance = 16;

  // --- Les 26 cubies et la table sticker <-> (cubie, matériau) ------------

  const groupeCube = new THREE.Group();
  scene.add(groupeCube);

  // Taille 0.96 : laisse un joint sombre entre les cubies.
  const geometrieCubie = new RoundedBoxGeometry(0.96, 0.96, 0.96, 4, 0.06);
  const materiauPlastique = new THREE.MeshStandardMaterial({
    color: COULEUR_PLASTIQUE,
    roughness: 0.55,
    metalness: 0.05,
  });

  const cubies = [];
  const cubieParGrille = new Map(); // 'x,y,z' -> mesh
  for (let x = -1; x <= 1; x++) {
    for (let y = -1; y <= 1; y++) {
      for (let z = -1; z <= 1; z++) {
        if (x === 0 && y === 0 && z === 0) continue; // cœur invisible
        const cubie = new THREE.Mesh(geometrieCubie, new Array(6).fill(materiauPlastique));
        cubie.position.set(x, y, z);
        cubie.userData.home = [x, y, z]; // position d'origine (identité)
        cubie.userData.grid = [x, y, z]; // position entière courante
        groupeCube.add(cubie);
        cubies.push(cubie);
        cubieParGrille.set(`${x},${y},${z}`, cubie);
      }
    }
  }

  // Pour chaque facette 0..53 : un matériau dédié sur le bon cubie, dérivé
  // de faceletPosition/faceletNormal (jamais de table écrite à la main).
  const materiauxStickers = [];
  for (let i = 0; i < 54; i++) {
    const cubie = cubieParGrille.get(faceletPosition(i).join(','));
    const indexMateriau = INDEX_MATERIAU_PAR_NORMALE.get(faceletNormal(i).join(','));
    const materiau = new THREE.MeshStandardMaterial({
      color: COULEURS[FACES[Math.floor(i / 9)]],
      roughness: 0.35,
      metalness: 0.04,
    });
    cubie.material[indexMateriau] = materiau;
    materiauxStickers.push(materiau);
  }

  // Remet chaque cubie à sa position/orientation d'identité.
  function remiseIdentite() {
    for (const cubie of cubies) {
      if (cubie.parent !== groupeCube) groupeCube.add(cubie);
      const [x, y, z] = cubie.userData.home;
      cubie.position.set(x, y, z);
      cubie.quaternion.identity();
      cubie.userData.grid = [x, y, z];
    }
    // Évacue les pivots orphelins (coup ou geste abandonné).
    for (const enfant of [...groupeCube.children]) {
      if (!enfant.isMesh) groupeCube.remove(enfant);
    }
  }

  // Recolorie les stickers d'après un état de 54 facettes, géométrie remise
  // à l'identité (aucun déplacement de cubie n'est nécessaire).
  function setFacelets(etat) {
    // Abandonne sans rappel un éventuel coup ou geste en cours : la
    // géométrie va de toute façon être remise à l'identité.
    coupCourant = null;
    recalage = null;
    if (geste) {
      librePointeur(geste.pointerId);
      geste = null;
    }
    remiseIdentite();
    for (let i = 0; i < 54; i++) {
      materiauxStickers[i].color.set(COULEURS[etat[i]] ?? COULEUR_PLASTIQUE);
    }
    besoinRendu = true;
  }

  // --- Moteur d'animation : file de coups ----------------------------------

  const AXES_MONDE = [
    new THREE.Vector3(1, 0, 0),
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(0, 0, 1),
  ];

  // Rendu à la demande : le GPU est partagé entre toutes les fenêtres, et
  // une scène immobile redessinée à 60 i/s fait saccader une vidéo qui
  // tourne à côté. Chaque mutation visuelle lève ce drapeau ; la boucle ne
  // rend que s'il est levé ou si la caméra a bougé (voir boucle()).
  let besoinRendu = true;

  let vitesseMs = 220; // durée d'un quart de tour
  let enPause = false;
  let pasDemande = false; // stepOnce : jouer exactement le prochain coup
  const file = []; // { move, meta, index }
  let coupCourant = null; // { move, meta, index, pivot, axe, angleCible, … }

  function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  // Décompose un jeton ('R', "U'", 'F2'…) : axe monde (0=x, 1=y, 2=z),
  // couche (coordonnée ±1 sur cet axe) et angle signé autour de +axe.
  // Jeton nu = -90° autour de la normale SORTANTE (horaire vu de
  // l'extérieur de la face), cohérent avec applyMove de facelets.js.
  function decomposerJeton(move) {
    const normale = NORMALE_FACE[move[0]];
    if (!normale) throw new Error(`Mouvement inconnu : ${move}`);
    const axe = normale.findIndex((c) => c !== 0);
    const couche = normale[axe];
    const suffixe = move.slice(1);
    const angleSortant = suffixe === "'" ? Math.PI / 2 : suffixe === '2' ? -Math.PI : -Math.PI / 2;
    return {
      axe,
      couche,
      angle: angleSortant * couche, // reporté sur l'axe monde positif
      demiTour: suffixe === '2',
    };
  }

  function cubiesDeCouche(axe, couche) {
    return cubies.filter((c) => c.userData.grid[axe] === couche);
  }

  function creerPivot(listeCubies) {
    const pivot = new THREE.Group();
    groupeCube.add(pivot);
    for (const cubie of listeCubies) pivot.attach(cubie);
    return pivot;
  }

  // Figeage : réintègre les cubies dans le groupe racine, positions
  // arrondies à la grille entière, orientation recalée sur l'alignement
  // d'axes le plus proche — aucune dérive de flottants entre deux coups.
  const matriceTmp = new THREE.Matrix4();
  function figerCubie(cubie) {
    cubie.position.set(
      Math.round(cubie.position.x),
      Math.round(cubie.position.y),
      Math.round(cubie.position.z),
    );
    matriceTmp.makeRotationFromQuaternion(cubie.quaternion);
    const e = matriceTmp.elements;
    for (let i = 0; i < 16; i++) e[i] = Math.round(e[i]);
    cubie.quaternion.setFromRotationMatrix(matriceTmp);
    cubie.userData.grid = [cubie.position.x, cubie.position.y, cubie.position.z];
  }

  function figerPivot(pivot) {
    for (const cubie of [...pivot.children]) {
      groupeCube.attach(cubie);
      figerCubie(cubie);
    }
    groupeCube.remove(pivot);
  }

  function demarrerCoup(maintenant) {
    const { move, meta, index } = file.shift();
    const { axe, couche, angle, demiTour } = decomposerJeton(move);
    const pivot = creerPivot(cubiesDeCouche(axe, couche));
    coupCourant = {
      move,
      meta,
      index,
      pivot,
      axe: AXES_MONDE[axe],
      angleCible: angle,
      debut: maintenant,
      duree: Math.max(1, vitesseMs * (demiTour ? 1.6 : 1)),
    };
    callbacks.onMoveStart?.(move, meta, index);
  }

  function terminerCoup() {
    const { pivot, axe, angleCible, move, meta, index } = coupCourant;
    pivot.quaternion.setFromAxisAngle(axe, angleCible);
    figerPivot(pivot);
    coupCourant = null;
    besoinRendu = true; // clearQueue peut figer hors de tickAnimation
    callbacks.onMoveCommitted?.(move, meta, index);
    // onMoveCommitted a pu ré-alimenter la file : ne signale le vide
    // qu'une fois la file réellement épuisée.
    if (!coupCourant && file.length === 0) callbacks.onQueueEmpty?.();
  }

  function tickAnimation(maintenant) {
    if (recalage) {
      besoinRendu = true;
      const t = Math.min(1, (maintenant - recalage.debut) / recalage.duree);
      recalage.pivot.quaternion.setFromAxisAngle(
        recalage.axeVec,
        recalage.de + (recalage.vers - recalage.de) * easeInOutCubic(t),
      );
      if (t >= 1) {
        const fini = recalage;
        recalage = null;
        fini.terminer();
      }
    }
    if (coupCourant) {
      besoinRendu = true;
      const t = Math.min(1, (maintenant - coupCourant.debut) / coupCourant.duree);
      coupCourant.pivot.quaternion.setFromAxisAngle(
        coupCourant.axe,
        coupCourant.angleCible * easeInOutCubic(t),
      );
      if (t >= 1) terminerCoup();
    }
    if (!coupCourant && !geste && !recalage && file.length > 0 && (!enPause || pasDemande)) {
      pasDemande = false;
      demarrerCoup(maintenant);
    }
  }

  // Ajoute un lot de coups ; `meta` et l'index du coup dans son lot sont
  // rendus tels quels à onMoveStart / onMoveCommitted.
  function enqueue(moves, meta) {
    moves.forEach((move, index) => file.push({ move, meta, index }));
  }

  function setPaused(pause) {
    enPause = Boolean(pause);
    if (!enPause) pasDemande = false;
  }

  // Joue exactement un coup quand la file est en pause.
  function stepOnce() {
    if (enPause && !coupCourant && file.length > 0) pasDemande = true;
  }

  // Vide la file en terminant proprement le coup en cours.
  function clearQueue() {
    const avaitTravail = Boolean(coupCourant) || file.length > 0;
    file.length = 0;
    pasDemande = false;
    if (coupCourant) terminerCoup();
    else if (avaitTravail) callbacks.onQueueEmpty?.();
  }

  function setSpeed(msParQuartDeTour) {
    const ms = Number(msParQuartDeTour);
    if (Number.isFinite(ms)) vitesseMs = Math.min(2000, Math.max(40, ms));
  }

  // --- Rotation des tranches au glisser (Pointer Events) --------------------

  // Normale locale de chaque indice de matériau d'une BoxGeometry.
  const NORMALES_LOCALES = [
    new THREE.Vector3(1, 0, 0),
    new THREE.Vector3(-1, 0, 0),
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(0, -1, 0),
    new THREE.Vector3(0, 0, 1),
    new THREE.Vector3(0, 0, -1),
  ];

  const SEUIL_DRAG_PX = 8; // seuil écran avant de choisir l'axe tangent
  const RAD_PAR_UNITE = Math.PI / 2 / 1.5; // ~90° par 1,5 largeur de cubie

  let dragAutorise = true;
  let geste = null; // phase 'attente' puis 'actif' (voir surPointerDown)
  let recalage = null; // animation de recalage au multiple de 90°
  let redispatchEnCours = false; // évènement synthétique pour OrbitControls

  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const planDrag = new THREE.Plane();
  const pointPlan = new THREE.Vector3();
  const vecteurTmp = new THREE.Vector3();

  function librePointeur(pointerId) {
    try {
      renderer.domElement.releasePointerCapture(pointerId);
    } catch {
      /* capture déjà relâchée */
    }
  }

  function rayonDepuisPointeur(e) {
    const rect = renderer.domElement.getBoundingClientRect();
    ndc.set(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    );
    raycaster.setFromCamera(ndc, camera);
  }

  // Intersection du rayon du pointeur avec le plan de la face saisie.
  function projeterSurPlan(e) {
    rayonDepuisPointeur(e);
    vecteurTmp.set(0, 0, 0).setComponent(geste.axeN, geste.signeN);
    planDrag.setFromNormalAndCoplanarPoint(vecteurTmp, geste.impact);
    return raycaster.ray.intersectPlane(planDrag, pointPlan);
  }

  // Signe de la permutation (i, j, k) de (0, 1, 2) — indices distincts.
  function signePermutation(i, j) {
    return (j - i + 3) % 3 === 1 ? 1 : -1;
  }

  function surPointerDown(e) {
    if (redispatchEnCours) return; // destiné à OrbitControls
    if (geste || recalage) {
      e.stopPropagation(); // pas d'orbite pendant un geste de tranche
      return;
    }
    if (!dragAutorise) return; // l'orbite reste active
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (coupCourant || file.length > 0) return; // animation en cours : orbite
    rayonDepuisPointeur(e);
    const impacts = raycaster.intersectObjects(cubies, false);
    if (impacts.length === 0) return; // fond : orbite
    const impact = impacts[0];
    // Face touchée identifiée par l'indice de matériau (fiable même sur
    // les arrondis), puis normale monde recalée sur l'axe dominant.
    const normaleMonde = NORMALES_LOCALES[impact.face.materialIndex]
      .clone()
      .transformDirection(impact.object.matrixWorld);
    let axeN = 0;
    if (Math.abs(normaleMonde.y) > Math.abs(normaleMonde.getComponent(axeN))) axeN = 1;
    if (Math.abs(normaleMonde.z) > Math.abs(normaleMonde.getComponent(axeN))) axeN = 2;
    const signeN = normaleMonde.getComponent(axeN) >= 0 ? 1 : -1;
    const grille = impact.object.userData.grid;
    if (grille[axeN] !== signeN) return; // face intérieure : orbite
    // Sticker central : toute rotation serait une tranche du milieu,
    // on laisse OrbitControls orbiter.
    const tangents = [0, 1, 2].filter((a) => a !== axeN);
    if (grille[tangents[0]] === 0 && grille[tangents[1]] === 0) return;
    // Mode tranche : on confisque le geste (OrbitControls ne verra pas
    // ce pointerdown grâce à stopPropagation en phase de capture).
    e.stopPropagation();
    try {
      renderer.domElement.setPointerCapture(e.pointerId);
    } catch {
      /* capture indisponible */
    }
    geste = {
      phase: 'attente',
      pointerId: e.pointerId,
      departX: e.clientX,
      departY: e.clientY,
      cubie: impact.object,
      axeN,
      signeN,
      impact: impact.point.clone(),
    };
  }

  // Tranche du milieu : on abandonne et on rend le geste à OrbitControls
  // en lui rejouant un pointerdown synthétique.
  function abandonnerPourOrbite(e) {
    librePointeur(geste.pointerId);
    geste = null;
    redispatchEnCours = true;
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
      redispatchEnCours = false;
    }
  }

  function surPointerMove(e) {
    if (!geste || e.pointerId !== geste.pointerId) return;
    if (geste.phase === 'attente') {
      const dx = e.clientX - geste.departX;
      const dy = e.clientY - geste.departY;
      if (Math.hypot(dx, dy) < SEUIL_DRAG_PX) return;
      if (!projeterSurPlan(e)) return;
      // Axe tangent t : celui des deux axes ⊥ n le plus aligné avec le
      // drag monde ; l'axe de rotation est le troisième axe.
      vecteurTmp.copy(pointPlan).sub(geste.impact);
      const [c1, c2] = [0, 1, 2].filter((a) => a !== geste.axeN);
      const tIdx =
        Math.abs(vecteurTmp.getComponent(c1)) >= Math.abs(vecteurTmp.getComponent(c2)) ? c1 : c2;
      const axeRot = tIdx === c1 ? c2 : c1;
      const coord = geste.cubie.userData.grid[axeRot];
      if (coord === 0) {
        abandonnerPourOrbite(e);
        return;
      }
      // sigma = (axe de rotation × normale sortante) · t : signe reliant
      // la distance de drag le long de t à l'angle autour de +axeRot.
      geste.phase = 'actif';
      geste.tIdx = tIdx;
      geste.axeRot = axeRot;
      geste.coord = coord;
      geste.axeVec = AXES_MONDE[axeRot];
      geste.sigma = signePermutation(axeRot, geste.axeN) * geste.signeN;
      geste.angle = 0;
      geste.pivot = creerPivot(cubiesDeCouche(axeRot, coord));
    }
    if (geste.phase === 'actif') {
      if (!projeterSurPlan(e)) return;
      const s = pointPlan.getComponent(geste.tIdx) - geste.impact.getComponent(geste.tIdx);
      geste.angle = Math.max(-Math.PI, Math.min(Math.PI, s * geste.sigma * RAD_PAR_UNITE));
      geste.pivot.quaternion.setFromAxisAngle(geste.axeVec, geste.angle);
      besoinRendu = true;
    }
  }

  // Recale la tranche au multiple de 90° le plus proche (borné à ±180°),
  // fige, puis émet le jeton correspondant via onUserMove.
  function lancerRecalage(g, duree) {
    const quarts = Math.max(-2, Math.min(2, Math.round(g.angle / (Math.PI / 2))));
    const cible = (quarts * Math.PI) / 2;
    const terminer = () => {
      g.pivot.quaternion.setFromAxisAngle(g.axeVec, cible);
      figerPivot(g.pivot);
      besoinRendu = true; // setDragEnabled peut figer hors de tickAnimation
      // Angle horaire autour de la NORMALE SORTANTE (axeRot · coord) :
      // jeton nu = 1 quart horaire, cohérent avec applyMove.
      const quartsHoraire = (((-quarts * g.coord) % 4) + 4) % 4;
      if (quartsHoraire !== 0) {
        vecteurTmp.set(0, 0, 0).setComponent(g.axeRot, g.coord);
        const face = FACE_PAR_NORMALE.get(`${vecteurTmp.x},${vecteurTmp.y},${vecteurTmp.z}`);
        const jeton = quartsHoraire === 1 ? face : quartsHoraire === 2 ? face + '2' : face + "'";
        callbacks.onUserMove?.(jeton);
      }
    };
    if (duree <= 0) {
      terminer();
    } else {
      recalage = {
        pivot: g.pivot,
        axeVec: g.axeVec,
        de: g.angle,
        vers: cible,
        debut: performance.now(),
        duree,
        terminer,
      };
    }
  }

  function surPointerUp(e) {
    if (!geste || e.pointerId !== geste.pointerId) return;
    const g = geste;
    geste = null;
    librePointeur(e.pointerId);
    if (g.phase === 'actif') lancerRecalage(g, 80);
    // phase 'attente' : simple clic sur un sticker, rien à faire.
  }

  // Coupe le mode tranche (l'orbite reste active). Un geste OU un recalage
  // en cours est terminé immédiatement (figeage + jeton émis le cas
  // échéant) : au retour de l'appel, plus aucun coup utilisateur n'est en
  // vol et onUserMove a déjà été notifié.
  function setDragEnabled(actif) {
    dragAutorise = Boolean(actif);
    if (dragAutorise) return;
    if (geste) {
      const g = geste;
      geste = null;
      librePointeur(g.pointerId);
      if (g.phase === 'actif') lancerRecalage(g, 0);
    }
    if (recalage) {
      const r = recalage;
      recalage = null;
      r.terminer();
    }
  }

  // Un coup (file ou en cours), un geste de tranche ou un recalage est-il
  // actif ? Tant que oui, l'état logique du consommateur peut encore bouger.
  function estOccupee() {
    return Boolean(coupCourant) || file.length > 0 || Boolean(geste) || Boolean(recalage);
  }

  // pointerdown en phase de capture sur le conteneur : si on entre en mode
  // tranche, stopPropagation empêche OrbitControls de démarrer une orbite.
  container.addEventListener('pointerdown', surPointerDown, true);
  renderer.domElement.addEventListener('pointermove', surPointerMove);
  renderer.domElement.addEventListener('pointerup', surPointerUp);
  renderer.domElement.addEventListener('pointercancel', surPointerUp);

  // --- Redimensionnement ---------------------------------------------------

  function redimensionner() {
    const largeur = Math.max(1, container.clientWidth);
    const hauteur = Math.max(1, container.clientHeight);
    camera.aspect = largeur / hauteur;
    camera.updateProjectionMatrix();
    // Le devicePixelRatio change avec le zoom du navigateur ou un
    // déplacement vers un autre écran : le réévaluer évite un rendu flou.
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(largeur, hauteur, false);
    besoinRendu = true; // setSize vide le tampon de dessin
  }
  const observateur = new ResizeObserver(redimensionner);
  observateur.observe(container);
  // Le zoom (et souvent le changement d'écran) déclenche resize sans
  // forcément changer la taille CSS du conteneur.
  window.addEventListener('resize', redimensionner);
  redimensionner();

  // --- Boucle de rendu -----------------------------------------------------

  let rafId = 0;
  function boucle(temps) {
    rafId = requestAnimationFrame(boucle);
    tickAnimation(temps ?? performance.now());
    // update() renvoie true tant que la caméra bouge (orbite, inertie,
    // zoom) : c'est lui qui couvre les mutations de caméra.
    const cameraBouge = controls.update();
    if (besoinRendu || cameraBouge) {
      besoinRendu = false;
      renderer.render(scene, camera);
    }
  }
  boucle(performance.now());

  // --- API publique --------------------------------------------------------

  function dispose() {
    cancelAnimationFrame(rafId);
    observateur.disconnect();
    window.removeEventListener('resize', redimensionner);
    container.removeEventListener('pointerdown', surPointerDown, true);
    renderer.domElement.removeEventListener('pointermove', surPointerMove);
    renderer.domElement.removeEventListener('pointerup', surPointerUp);
    renderer.domElement.removeEventListener('pointercancel', surPointerUp);
    controls.dispose();
    geometrieCubie.dispose();
    materiauPlastique.dispose();
    for (const materiau of materiauxStickers) materiau.dispose();
    renderer.dispose();
    renderer.domElement.remove();
  }

  const vue = {
    enqueue,
    setPaused,
    stepOnce,
    clearQueue,
    setSpeed,
    setFacelets,
    setDragEnabled,
    estOccupee,
    dispose,
  };
  return vue;
}
