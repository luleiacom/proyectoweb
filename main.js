import * as THREE from 'three';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import Lenis from 'lenis';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

gsap.registerPlugin(ScrollTrigger, SplitText);

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const TAU = Math.PI * 2;

// --- 1. CONFIGURACIÓN DE LENIS (SMOOTH SCROLL) ---
const lenis = new Lenis({
    duration: 1.2,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smooth: true
});

function raf(time) {
    lenis.raf(time);
    ScrollTrigger.update();
    requestAnimationFrame(raf);
}
requestAnimationFrame(raf);

// --- 1b. PANTALLA DE CARGA E INTRO DEL TÍTULO ---
const loader = document.getElementById('loader');
const loaderProgress = document.getElementById('loader-progress');
lenis.stop();

function playIntro() {
    if (reduceMotion) return;

    const heroTitle = document.querySelector('.hero-section .gradient-title');
    const split = new SplitText(heroTitle, { type: "chars" });

    gsap.from(split.chars, {
        opacity: 0,
        y: 40,
        rotationX: -90,
        stagger: 0.03,
        duration: 0.8,
        ease: "back.out(1.7)",
        delay: 0.3,
        onComplete: () => split.revert()
    });
}

let loaderHidden = false;
function hideLoader() {
    if (loaderHidden) return;
    loaderHidden = true;

    playIntro();
    gsap.to(loader, {
        opacity: 0,
        duration: reduceMotion ? 0 : 0.8,
        ease: 'power2.out',
        onComplete: () => {
            loader.remove();
            lenis.start();
        }
    });
}

const loadingManager = new THREE.LoadingManager(hideLoader);
loadingManager.onProgress = (url, loadedCount, total) => {
    loaderProgress.style.transform = `scaleX(${loadedCount / total})`;
};
setTimeout(hideLoader, 8000);

// --- 1c. STACK TÉCNICO: CÓDIGO DE BARRAS ---
function buildBarcode(el, text, { unit = 1.5, height = 44 } = {}) {
    let x = 0;
    let rects = '';

    const push = (w, isBar) => {
        if (isBar) rects += `<rect x="${x}" y="0" width="${w}" height="${height}"/>`;
        x += w;
    };

    push(unit, true); push(unit, false); push(unit, true); push(unit * 2, false);

    for (const ch of text.toUpperCase()) {
        const bits = ch.charCodeAt(0).toString(2).padStart(8, '0');
        let isBar = true;
        for (const bit of bits) {
            push((bit === '1' ? 2 : 1) * unit, isBar);
            isBar = !isBar;
        }
        push(unit * 2, false);
    }

    push(unit, true); push(unit, false); push(unit, true);

    el.innerHTML =
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${x} ${height}" width="${x}" height="${height}" fill="currentColor">${rects}</svg>`;
}

buildBarcode(document.getElementById('barcode'), 'THREE.JS GSAP VITE');

// --- 2. THREE.JS: ESCENA, CÁMARA Y RENDERIZADOR ---
const container = document.getElementById('webgl-container');

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 7;

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
container.appendChild(renderer.domElement);

const ambientLight = new THREE.AmbientLight(0xffffff, 2.0);
scene.add(ambientLight);

// --- 3. POST-PROCESAMIENTO (EFECTO GLOW / BLOOM) ---
const renderScene = new RenderPass(scene, camera);
const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.35,
    0.4,
    0.85
);

const composer = new EffectComposer(renderer);
composer.addPass(renderScene);
composer.addPass(bloomPass);

// --- 3b. DUOTONO PARA LAS TEXTURAS DEL CUBO ---
function duotoneTexture(src, colorDark, colorLight, onLoad) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);

        const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const [dr, dg, db] = colorDark;
        const [lr, lg, lb] = colorLight;

        for (let i = 0; i < data.data.length; i += 4) {
            const gray = (data.data[i] * 0.299 + data.data[i + 1] * 0.587 + data.data[i + 2] * 0.114) / 255;
            data.data[i] = dr + (lr - dr) * gray;
            data.data[i + 1] = dg + (lg - dg) * gray;
            data.data[i + 2] = db + (lb - db) * gray;
        }
        ctx.putImageData(data, 0, 0);

        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
        onLoad(texture);
    };
    img.src = src;
}

// --- 4. TEXTURAS Y GEOMETRÍA DEL CUBO ---
const DARK = [10, 8, 20];
const LIGHT = [214, 205, 246];

function projectMat(file) {
    const material = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.3 });
    duotoneTexture(file, DARK, LIGHT, (texture) => {
        material.map = texture;
        material.color.set(0xffffff);
        material.needsUpdate = true;
    });
    return material;
}

const project1 = projectMat('./img1.jpg'); // Generador de paletas
const project2 = projectMat('./img2.jpg'); // Landing de marca
const project3 = projectMat('./img3.jpg'); // Configurador 3D
const project4 = projectMat('./img4.jpg'); // Laboratorio de partículas

const top = new THREE.MeshStandardMaterial({ color: 0x14102a, roughness: 0.4 });
const bottom = new THREE.MeshStandardMaterial({ color: 0x14102a, roughness: 0.4 });

const materials = [project2, project4, top, bottom, project1, project3];

const geometry = new THREE.BoxGeometry(2.4, 2.4, 2.4);
const cube = new THREE.Mesh(geometry, materials);
scene.add(cube);

const wireframeGeo = new THREE.EdgesGeometry(geometry);
const wireframeMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.15 });
const wireframeBox = new THREE.LineSegments(wireframeGeo, wireframeMat);
cube.add(wireframeBox);

// --- 5. ESTADOS DEL CUBO POR SECCIÓN ---
const isNarrow = () => window.innerWidth < 900 || window.innerHeight > window.innerWidth;

const CAMERA_Z = 7;
const CUBE_MAX_EXTENT = 2.4 * Math.SQRT2;

const heroSection = document.querySelector('.hero-section');
const heroContent = document.querySelector('.hero-content');
const projectSections = gsap.utils.toArray('.project-section');
const projectCards = projectSections.map((s) => s.querySelector('.project-card'));
const contactSection = document.querySelector('.contact-section');

function worldHalfSize() {
    const halfH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * CAMERA_Z;
    return { halfW: halfH * camera.aspect, halfH };
}

function freeSpaceFor(textEl, textSide) {
    const vw = window.innerWidth;
    const margin = vw * 0.05;
    const gap = 32;
    const r = textEl.getBoundingClientRect();

    const start = textSide === 'left' ? r.right + gap : margin;
    const end = textSide === 'left' ? vw - margin : r.left - gap;

    const { halfW } = worldHalfSize();
    const centerPx = (start + end) / 2;
    const widthWorld = (Math.max(end - start, 0) / vw) * 2 * halfW;

    return {
        x: ((centerPx / vw) * 2 - 1) * halfW,
        s: THREE.MathUtils.clamp((widthWorld * 0.9) / CUBE_MAX_EXTENT, 0.35, 1)
    };
}

function narrowLayout() {
    const { halfW, halfH } = worldHalfSize();
    return {
        x: 0,
        y: halfH * 0.4,
        s: THREE.MathUtils.clamp((halfW * 2 * 0.55) / CUBE_MAX_EXTENT, 0.3, 0.8)
    };
}

function stateFor(name) {
    const narrow = isNarrow();
    const stacked = narrow ? narrowLayout() : null;

    if (name === 'hero') {
        const space = narrow ? stacked : freeSpaceFor(heroContent, 'left');
        return { x: space.x, y: narrow ? stacked.y : 0, s: space.s, rx: 0.4, ry: -0.6 };
    }
    if (name === 'contact') {
        return { x: 0, y: 1.5, s: narrow ? Math.min(0.5, stacked.s) : 0.5, rx: 0.4, ry: -TAU - 0.6 };
    }
    const i = Number(name.split('-')[1]);
    const textSide = projectSections[i].classList.contains('is-left') ? 'left' : 'right';
    const space = narrow ? stacked : freeSpaceFor(projectCards[i], textSide);

    return {
        x: space.x,
        y: narrow ? stacked.y : 0,
        s: space.s,
        rx: 0.15,
        ry: -i * (Math.PI / 2)
    };
}

let currentState = 'hero';

function applyState(name, immediate = false) {
    currentState = name;
    const t = stateFor(name);
    const duration = immediate || reduceMotion ? 0 : 1.2;
    const ease = 'power3.inOut';

    const turns = Math.round((cube.rotation.y - t.ry) / TAU);
    cube.rotation.y -= turns * TAU;

    gsap.to(cube.position, { x: t.x, y: t.y, duration, ease, overwrite: 'auto' });
    gsap.to(cube.scale, { x: t.s, y: t.s, z: t.s, duration, ease, overwrite: 'auto' });
    gsap.to(cube.rotation, { x: t.rx, y: t.ry, duration, ease, overwrite: 'auto' });
}

applyState('hero', true);

window.addEventListener('load', () => applyState(currentState, true));

function watchSection(trigger, name) {
    ScrollTrigger.create({
        trigger,
        start: 'top center',
        end: 'bottom center',
        onToggle: (self) => {
            if (self.isActive) applyState(name);
        }
    });
}

watchSection(heroSection, 'hero');
projectSections.forEach((section, i) => watchSection(section, `project-${i}`));
watchSection(contactSection, 'contact');

// --- 5b. NAVEGACIÓN FIJA ---
const nav = document.getElementById('site-nav');
const navLinks = document.querySelectorAll('.site-nav nav a');

lenis.on('scroll', (e) => {
    nav.classList.toggle('is-scrolled', e.scroll > 40);
});

function setActiveLink(id) {
    navLinks.forEach((link) => {
        link.classList.toggle('is-active', link.dataset.section === id);
    });
}

['inicio', 'proyectos', 'contacto'].forEach((id) => {
    ScrollTrigger.create({
        trigger: document.getElementById(id),
        start: 'top center',
        end: 'bottom center',
        onToggle: (self) => {
            if (self.isActive) setActiveLink(id);
        }
    });
});
setActiveLink('inicio');

document.querySelectorAll('a[href^="#"]').forEach((link) => {
    const href = link.getAttribute('href');
    if (href.length < 2) return;

    link.addEventListener('click', (e) => {
        const target = document.querySelector(href);
        if (!target) return;
        e.preventDefault();
        lenis.scrollTo(target, { duration: reduceMotion ? 0 : 1.6 });
    });
});

// --- 6. INTERACTIVIDAD: INERCIA DE ARRASTRE Y MOUSE ---
let isDragging = false;
let previousMousePosition = { x: 0, y: 0 };
let targetRotationVelocity = { x: 0, y: 0 };

window.addEventListener('mousedown', (e) => {
    isDragging = true;
    previousMousePosition = { x: e.clientX, y: e.clientY };
});

window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;

    const deltaX = e.clientX - previousMousePosition.x;
    const deltaY = e.clientY - previousMousePosition.y;

    targetRotationVelocity.y = deltaX * 0.005;
    targetRotationVelocity.x = deltaY * 0.005;

    cube.rotation.y += targetRotationVelocity.y;
    cube.rotation.x += targetRotationVelocity.x;

    previousMousePosition = { x: e.clientX, y: e.clientY };
});

window.addEventListener('mouseup', () => {
    isDragging = false;
});

// --- 7. INTERACTIVIDAD POR CLICS CON ZOOM DE CÁMARA ---
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

window.addEventListener('click', (event) => {
    if (Math.abs(event.clientX - previousMousePosition.x) > 5) return;

    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObject(cube);

    if (intersects.length > 0) {
        gsap.to(camera.position, {
            z: 4.5,
            duration: 0.8,
            ease: "power2.out",
            yoyo: true,
            repeat: 1
        });
    }
});

// --- 8. RESPONSIVE Y BUCLE DE RENDERIZADO CON COMPOSER ---
let lastWidth = window.innerWidth;

window.addEventListener('resize', () => {
    if (isNarrow() && window.innerWidth === lastWidth) return;
    lastWidth = window.innerWidth;

    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
    applyState(currentState, true);
});

function animate() {
    requestAnimationFrame(animate);

    if (!isDragging) {
        targetRotationVelocity.y *= 0.95;
        targetRotationVelocity.x *= 0.95;
        cube.rotation.y += targetRotationVelocity.y;
        cube.rotation.x += targetRotationVelocity.x;
    }

    composer.render();
}
animate();