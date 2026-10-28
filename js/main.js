/* Homepage: counters, wish wall, connection globe, 3D wishing tree, modals. */
GW.load().then(function (wishes) {
    var PAGE = 24;
    var shown = 0;
    var filtered = wishes;

    /* ---------------- Counters ---------------- */
    function countUp(el, target, ms) {
        var t0 = performance.now();
        (function step(now) {
            var p = Math.min(1, (now - t0) / ms);
            var eased = 1 - Math.pow(1 - p, 3);
            el.textContent = Math.round(target * eased).toLocaleString('en-US');
            if (p < 1) requestAnimationFrame(step);
        })(t0);
    }

    function groupBy(fn) {
        var map = {};
        wishes.forEach(function (w) { var k = fn(w); if (k) map[k] = (map[k] || 0) + 1; });
        return Object.keys(map).map(function (k) { return { key: k, count: map[k] }; })
            .sort(function (a, b) { return b.count - a.count; });
    }
    var byCountry = groupBy(function (w) { return w.country; });
    var byContinent = groupBy(function (w) { var c = GW_DATA.countries[w.country]; return c && c[2]; });
    var byCampus = groupBy(function (w) { return w.campus; });

    countUp(document.getElementById('total-wishes-count'), wishes.length, 2200);
    countUp(document.getElementById('total-continents-count'), byContinent.length, 1500);
    countUp(document.getElementById('total-countries-count'), byCountry.length, 1500);
    countUp(document.getElementById('total-campuses-count'), 4, 1500);

    /* ---------------- Reach modal ---------------- */
    var reachModal = new bootstrap.Modal('#reachModal');
    var reachMode = 'countries';
    function renderReach() {
        var cfg = {
            continents: { rows: byContinent, title: 'index.reach.continents', head: 'index.reach.continent', name: GW.continentName },
            countries: { rows: byCountry, title: 'index.reach.countries', head: 'index.reach.country', name: GW.countryName },
            campuses: { rows: byCampus, title: 'index.reach.campuses', head: 'index.reach.campus', name: function (k) { return i18n.t('campus.' + k); } }
        }[reachMode];
        document.getElementById('reachModalTitle').textContent = i18n.t(cfg.title);
        document.getElementById('reachModalNameHead').textContent = i18n.t(cfg.head);
        document.getElementById('reach-table-body').innerHTML = cfg.rows.map(function (r, i) {
            return '<tr class="' + (i < 3 ? 'reach-top' : '') + '"><td class="reach-rank">' + (i + 1) + '</td>' +
                '<td>' + GW.esc(cfg.name(r.key)) + '</td><td class="text-end reach-count">' + r.count + '</td></tr>';
        }).join('');
    }
    document.querySelectorAll('.reach-stat').forEach(function (btn) {
        btn.addEventListener('click', function () {
            reachMode = btn.dataset.reach;
            renderReach();
            reachModal.show();
        });
    });

    /* ---------------- Wish wall ---------------- */
    var list = document.getElementById('lst_congratulations');
    var moreWrap = document.getElementById('wish-load-more-wrap');

    function renderWall(reset) {
        if (reset) { list.innerHTML = ''; shown = 0; }
        var next = filtered.slice(shown, shown + PAGE);
        var html = next.map(function (w, i) {
            return '<li class="col-12 col-sm-6 col-lg-4" style="animation-delay:' + (i % PAGE) * 35 + 'ms">' +
                GW.cardBox(w, 'slide-in') + '</li>';
        }).join('');
        list.insertAdjacentHTML('beforeend', html);
        shown += next.length;
        if (!filtered.length) list.innerHTML = '<li class="col-12 empty-state"><i class="far fa-face-smile fa-2x mb-2 d-block"></i>' + i18n.t('index.empty') + '</li>';
        moreWrap.classList.toggle('d-none', shown >= filtered.length);
    }

    function applyFilter() {
        var q = document.getElementById('wish-search').value.trim().toLowerCase();
        var campus = document.getElementById('wish-campus').value;
        filtered = wishes.filter(function (w) {
            return (!campus || w.campus === campus) &&
                (!q || (w.name + ' ' + w.message).toLowerCase().indexOf(q) !== -1);
        });
        renderWall(true);
    }
    document.getElementById('wish-search').addEventListener('input', applyFilter);
    document.getElementById('wish-campus').addEventListener('change', applyFilter);
    document.getElementById('btn-wish-load-more').addEventListener('click', function () { renderWall(false); });
    list.addEventListener('scroll', function () {
        if (list.scrollTop + list.clientHeight > list.scrollHeight - 200 && shown < filtered.length) renderWall(false);
    });
    renderWall(true);

    /* ---------------- Detail modal ---------------- */
    var detailModal = new bootstrap.Modal('#wishDetailModal');
    function openDetail(id) {
        var w = wishes.find(function (x) { return x.id === id; });
        if (!w) return;
        document.getElementById('wishDetailBody').innerHTML = '<div class="detail-card">' + GW.cardBox(w) + '</div>';
        detailModal.show();
    }
    document.addEventListener('click', function (e) {
        var box = e.target.closest('.cr-detail-box');
        if (box && !box.closest('#wishDetailBody') && !box.closest('#tree-wish-display')) openDetail(box.dataset.id);
    });

    /* ---------------- Cluster modal (wishes per country) ---------------- */
    var clusterModal = new bootstrap.Modal('#clusterModal');
    var clusterList = [], clusterShown = 0;
    function renderCluster(reset) {
        var ul = document.getElementById('lst_cluster_wishes');
        if (reset) { ul.innerHTML = ''; clusterShown = 0; }
        var next = clusterList.slice(clusterShown, clusterShown + 12);
        ul.insertAdjacentHTML('beforeend', next.map(function (w) {
            return '<li class="col-12 col-sm-6 col-lg-4">' + GW.cardBox(w, 'slide-in') + '</li>';
        }).join(''));
        clusterShown += next.length;
        document.getElementById('cluster-load-more-wrap').style.display = clusterShown < clusterList.length ? '' : 'none';
    }
    function cityOf(w) { var c = GW_DATA.countries[w.country]; return w.city || (c && c[6][0][0]); }
    function openCluster(code, city) {
        clusterList = wishes.filter(function (w) { return w.country === code && (!city || cityOf(w) === city); });
        document.getElementById('clusterModalTitle').textContent =
            i18n.t('index.clusterTitle', { name: (city ? city + ', ' : '') + GW.countryName(code) }) + ' (' + clusterList.length + ')';
        renderCluster(true);
        clusterModal.show();
    }
    document.getElementById('btn-cluster-load-more').addEventListener('click', function () { renderCluster(false); });

    /* ---------------- Tab description toggle ---------------- */
    window.toggleTabDesc = function (btn) {
        var box = btn.closest('.tab-desc-collapsible');
        box.classList.toggle('expanded');
        btn.querySelector('span').textContent = i18n.t(box.classList.contains('expanded') ? 'index.viewLess' : 'index.viewMore');
    };

    /* ---------------- Fullscreen helper ---------------- */
    function bindFullscreen(btnId, el, onResize) {
        var btn = document.getElementById(btnId);
        btn.addEventListener('click', function () {
            if (el.requestFullscreen && !document.fullscreenElement) { el.requestFullscreen(); return; }
            if (document.fullscreenElement) { document.exitFullscreen(); return; }
            el.classList.toggle('mobile-fullscreen');   // iOS Safari fallback
            onResize();
        });
        document.addEventListener('fullscreenchange', function () {
            btn.innerHTML = '<i class="fas fa-' + (document.fullscreenElement === el ? 'compress' : 'expand') + '"></i>';
            setTimeout(onResize, 60);
        });
    }

    /* ---------------- Connection globe ---------------- */
    var globe = null;
    function initGlobe() {
        if (globe || typeof Globe === 'undefined') return;
        var wrap = document.getElementById('map-wrapper');
        var host = document.getElementById('globe-container');
        var home = GW_DATA.home;
        // one point per city, so wishes spread over the whole world instead of one dot per country
        var cityMap = {};
        wishes.forEach(function (w) {
            var c = GW_DATA.countries[w.country];
            var name = cityOf(w);
            var info = c[6].filter(function (x) { return x[0] === name; })[0] || c[6][0];
            var key = w.country + '|' + info[0];
            if (!cityMap[key]) cityMap[key] = { code: w.country, city: info[0], lat: info[1], lng: info[2], count: 0 };
            cityMap[key].count++;
        });
        var pts = Object.keys(cityMap).map(function (k) { return cityMap[k]; });

        var campusKeys = ['hn', 'dn', 'hcm', 'ct'];
        var campusPts = campusKeys.map(function (k) {
            var c = GW_DATA.campuses[k]; return { key: k, lat: c.lat, lng: c.lng, label: 'Greenwich ' + i18n.t('campus.' + k) };
        });
        function dist(a, b) { var dx = a.lat - b.lat, dy = (a.lng - b.lng) * Math.cos(a.lat * Math.PI / 180); return Math.sqrt(dx * dx + dy * dy); }

        var s = 4242; function rnd() { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }
        var arcs = [];
        function addArc(a, b, count, kind) {
            arcs.push({ startLat: a.lat, startLng: a.lng, endLat: b.lat, endLng: b.lng, count: count, kind: kind });
        }
        pts.forEach(function (p) {
            if (p.code === 'VN') {
                // domestic: each city connects to its nearest campus, bigger cities to a second one too
                var sorted = campusPts.slice().sort(function (a, b) { return dist(p, a) - dist(p, b); });
                if (dist(p, sorted[0]) > .5) addArc(p, sorted[0], p.count, 'vn');
                if (p.count > 4 && dist(p, sorted[1]) > .5) addArc(p, sorted[1], p.count / 2, 'vn');
            } else {
                // international: fan out to 1-4 different campuses, picked at random so lines spread across Vietnam
                var n = Math.min(4, 1 + Math.floor(p.count / 3));
                var order = campusPts.slice().sort(function () { return rnd() - .5; });
                for (var i = 0; i < n; i++) addArc(p, order[i], p.count, 'int');
            }
        });
        // mesh between international cities, same-continent neighbours + a few long-haul links
        var intl = pts.filter(function (p) { return p.code !== 'VN'; });
        for (var j = 0; j < 55; j++) {
            var a = intl[Math.floor(rnd() * intl.length)], b = intl[Math.floor(rnd() * intl.length)];
            if (a !== b && dist(a, b) > 8) addArc(a, b, 1, 'mesh');
        }
        // the four campuses link to the UK campus city
        campusPts.forEach(function (c) { addArc(c, GW_DATA.campuses.uk, 8, 'uk'); });

        globe = Globe()(host)
            .width(wrap.clientWidth).height(wrap.clientHeight)
            .globeImageUrl('https://unpkg.com/three-globe@2.31.0/example/img/earth-blue-marble.jpg')
            .bumpImageUrl('https://unpkg.com/three-globe@2.31.0/example/img/earth-topology.png')
            .backgroundImageUrl('https://unpkg.com/three-globe@2.31.0/example/img/night-sky.png')
            .atmosphereColor('#7fb2ff').atmosphereAltitude(.2)
            .pointsData(pts)
            .pointColor(function () { return '#f37021'; })
            .pointAltitude(function (d) { return .004 + Math.min(.04, d.count / 400); })
            .pointRadius(function (d) { return .2 + Math.min(.5, d.count / 30); })
            .pointLabel(function (d) { return '<div class="globe-tooltip">' + GW.esc(d.city + ', ' + GW.countryName(d.code)) + ' · ' + d.count + ' ' + GW.esc(i18n.t('index.reach.wishes').toLowerCase()) + '</div>'; })
            .onPointClick(function (d) { openCluster(d.code, d.city); })
            .arcsData(arcs)
            .arcColor(function (d) {
                return d.kind === 'mesh' ? ['rgba(140,190,255,0.05)', 'rgba(170,210,255,0.55)']
                    : d.kind === 'vn' ? ['rgba(255,220,120,0.1)', 'rgba(255,230,150,0.9)']
                    : ['rgba(243,112,33,0.12)', 'rgba(255,190,140,0.95)'];
            })
            .arcStroke(function (d) { return d.kind === 'mesh' ? .12 : .15 + Math.min(.4, d.count / 40); })
            .arcDashLength(.4).arcDashGap(.3)
            .arcDashInitialGap(function () { return Math.random(); })
            .arcDashAnimateTime(function () { return 2200 + Math.random() * 2600; })
            .arcAltitudeAutoScale(.4)
            .ringsData(campusPts)
            .ringColor(function () { return function (t) { return 'rgba(243,112,33,' + (1 - t) + ')'; }; })
            .ringMaxRadius(5).ringPropagationSpeed(2.5).ringRepeatPeriod(900)
            .labelsData(campusPts)
            .labelText('label').labelSize(.55).labelDotRadius(.35)
            .labelColor(function () { return '#ffffff'; }).labelResolution(3);

        globe.pointOfView({ lat: 22, lng: 85, altitude: 2.3 }, 0);
        setTimeout(function () { globe.width(wrap.clientWidth).height(wrap.clientHeight); }, 250);
        var ctr = globe.controls();
        ctr.autoRotate = true; ctr.autoRotateSpeed = .45;
        host.addEventListener('pointerdown', function () { ctr.autoRotate = false; });

        bindFullscreen('btn-fullscreen-map', wrap, function () { globe.width(wrap.clientWidth).height(wrap.clientHeight); });
        window.addEventListener('resize', function () { globe.width(wrap.clientWidth).height(wrap.clientHeight); });
        if (window.ResizeObserver) new ResizeObserver(function () { globe.width(wrap.clientWidth).height(wrap.clientHeight); }).observe(wrap);
    }

    /* ---------------- 3D wishing tree ---------------- */
    var treeReady = false;
    function initTree() {
        if (treeReady || typeof THREE === 'undefined') return;
        treeReady = true;
        var box = document.getElementById('tree-container');
        var display = document.getElementById('tree-wish-display');

        var renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
        renderer.setSize(box.clientWidth, box.clientHeight);
        box.appendChild(renderer.domElement);

        var scene = new THREE.Scene();
        scene.background = new THREE.Color(0x040d22);
        scene.fog = new THREE.FogExp2(0x040d22, 0.018);

        // Optional 360 equirectangular panoramic background
        (function () {
            var texLoader = new THREE.TextureLoader();
            texLoader.load('images/tree_bg_360.jpg', function (tex) {
                tex.mapping = THREE.EquirectangularReflectionMapping;
                scene.background = tex;
                scene.fog = null;
            }, undefined, function () {
                // Keep default dark color if no 360 panorama image is present
            });
        })();

        var camera = new THREE.PerspectiveCamera(50, box.clientWidth / box.clientHeight, 0.1, 500);
        camera.position.set(0, 15, 36);

        var controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.target.set(0, 12, 0);
        controls.enableDamping = true;
        controls.autoRotate = true; controls.autoRotateSpeed = .6;
        controls.minDistance = 12; controls.maxDistance = 60;
        controls.maxPolarAngle = Math.PI * .52;

        scene.add(new THREE.AmbientLight(0x8fa8d8, .55));
        var moon = new THREE.DirectionalLight(0xffffff, .8); moon.position.set(10, 30, 15); scene.add(moon);
        var warm = new THREE.PointLight(0xf37021, 1.4, 60); warm.position.set(0, 14, 0); scene.add(warm);

        // ground disc with a navy/orange ring
        var ground = new THREE.Mesh(new THREE.CircleGeometry(30, 64), new THREE.MeshStandardMaterial({ color: 0x0a2a5e, roughness: 1 }));
        ground.rotation.x = -Math.PI / 2; scene.add(ground);
        var ring = new THREE.Mesh(new THREE.RingGeometry(9, 9.35, 96), new THREE.MeshBasicMaterial({ color: 0xf37021, side: THREE.DoubleSide }));
        ring.rotation.x = -Math.PI / 2; ring.position.y = .02; scene.add(ring);

        // ground decal: text running around the tree, like an engraved plaza
        (function () {
            var cv = document.createElement('canvas'); cv.width = cv.height = 1024;
            var g = cv.getContext('2d'); g.translate(512, 512);
            g.strokeStyle = 'rgba(243,112,33,.9)'; g.lineWidth = 5;
            g.beginPath(); g.arc(0, 0, 500, 0, Math.PI * 2); g.stroke();
            g.lineWidth = 2; g.beginPath(); g.arc(0, 0, 392, 0, Math.PI * 2); g.stroke();
            var label = '   UNIVERSITY OF GREENWICH VIETNAM  ✦  WISHING TREE  ✦  CÂY ƯỚC NGUYỆN  ✦  ';
            var n = label.length, radius = 445;
            g.fillStyle = '#ffffff'; g.font = '700 46px "Be Vietnam Pro", Arial, sans-serif'; g.textAlign = 'center';
            for (var i = 0; i < n; i++) {
                var a = (i / n) * Math.PI * 2;
                g.save(); g.rotate(a); g.translate(0, -radius); g.fillText(label[i], 0, 0); g.restore();
            }
            var decal = new THREE.Mesh(new THREE.CircleGeometry(14, 96), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false }));
            decal.rotation.x = -Math.PI / 2; decal.position.y = .03; scene.add(decal);
        })();

        // pedestal wrapped with the Greenwich logo + name, repeated so it reads from every side
        (function () {
            var cv = document.createElement('canvas'); cv.width = 1400; cv.height = 300;
            var tex = new THREE.CanvasTexture(cv);
            tex.wrapS = THREE.RepeatWrapping; tex.repeat.set(3, 1);
            function draw(logo) {
                var g = cv.getContext('2d');
                g.fillStyle = '#0a2a5e'; g.fillRect(0, 0, 1400, 300);
                g.fillStyle = '#f37021'; g.fillRect(0, 0, 1400, 14); g.fillRect(0, 286, 1400, 14);
                g.fillStyle = '#ffffff';
                if (g.roundRect) { g.beginPath(); g.roundRect(40, 40, 480, 220, 24); g.fill(); } else g.fillRect(40, 40, 480, 220);
                if (logo) { var h = 200, w = h * logo.width / logo.height; g.drawImage(logo, 40 + (480 - w) / 2, 50, w, h); }
                g.fillStyle = '#ffffff'; g.textBaseline = 'middle';
                g.font = '800 84px "Be Vietnam Pro", Arial, sans-serif'; g.fillText('GREENWICH WISHES', 570, 115);
                g.fillStyle = '#f37021'; g.font = '700 50px "Be Vietnam Pro", Arial, sans-serif'; g.fillText('Cây ước nguyện · Wishing Tree', 574, 205);
                tex.needsUpdate = true;
            }
            draw(null);
            var img = new Image(); img.onload = function () { draw(img); }; img.src = 'images/logo.png';
            var ped = new THREE.Mesh(new THREE.CylinderGeometry(5.2, 5.6, 2.2, 96, 1, false), new THREE.MeshStandardMaterial({ map: tex, roughness: .5 }));
            ped.position.y = 1.1; scene.add(ped);
            var cap = new THREE.Mesh(new THREE.CylinderGeometry(4.8, 5.2, .3, 96), new THREE.MeshStandardMaterial({ color: 0xf37021, roughness: .4, emissive: 0x401a00 }));
            cap.position.y = 2.35; scene.add(cap);
        })();

        // seeded randomness so the tree keeps its shape
        var s = 7; function rnd() { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }

        var barkMat = new THREE.MeshStandardMaterial({ color: 0x6b4a32, roughness: .9 });
        var tips = [];
        function branch(start, dir, len, radius, depth) {
            var end = start.clone().add(dir.clone().multiplyScalar(len));
            var geo = new THREE.CylinderGeometry(radius * .68, radius, len, 8);
            var mesh = new THREE.Mesh(geo, barkMat);
            mesh.position.copy(start).add(end).multiplyScalar(.5);
            mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
            scene.add(mesh);
            if (depth === 0) { tips.push(end); return; }
            var n = depth > 3 ? 2 : 3;
            for (var i = 0; i < n; i++) {
                var nd = dir.clone().add(new THREE.Vector3((rnd() - .5) * 1.5, rnd() * .55 + .05, (rnd() - .5) * 1.5)).normalize();
                branch(end, nd, len * (.68 + rnd() * .14), radius * .66, depth - 1);
            }
            if (depth <= 2) tips.push(end.clone().lerp(start, .4));
        }
        branch(new THREE.Vector3(0, 2.4, 0), new THREE.Vector3(0, 1, 0), 8, 1.1, 5);

        // foliage clouds (navy-green tinted, translucent)
        var leafMat = new THREE.MeshStandardMaterial({ color: 0x1f6f5c, roughness: .8, transparent: true, opacity: .55 });
        tips.forEach(function (p, i) {
            if (i % 3) return;
            var f = new THREE.Mesh(new THREE.IcosahedronGeometry(1.4 + rnd() * 1.2, 1), leafMat);
            f.position.copy(p); scene.add(f);
        });

        // glowing wish lights
        var glowTex = (function () {
            var c = document.createElement('canvas'); c.width = c.height = 64;
            var g = c.getContext('2d'), grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
            grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(.25, 'rgba(255,200,150,.9)');
            grd.addColorStop(1, 'rgba(243,112,33,0)');
            g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
            return new THREE.CanvasTexture(c);
        })();
        var lights = [];
        var pool = wishes.slice(0, Math.min(wishes.length, 320));
        pool.forEach(function (w, i) {
            var base = tips[i % tips.length];
            var pos;
            if (i % 2) {   // half of the lights fill an ellipsoid canopy so the crown reads as a full, even shape
                var u = rnd() * Math.PI * 2, v = Math.acos(2 * rnd() - 1), rr = Math.cbrt(rnd());
                pos = new THREE.Vector3(Math.sin(v) * Math.cos(u) * 12 * rr, 18 + Math.cos(v) * 7.5 * rr, Math.sin(v) * Math.sin(u) * 12 * rr);
            } else pos = base.clone().add(new THREE.Vector3((rnd() - .5) * 2.4, (rnd() - .5) * 2 - .5, (rnd() - .5) * 2.4));
            var colors = [0xffffff, 0xffc08a, 0xf37021, 0x9cc4ff];
            var mat = new THREE.SpriteMaterial({ map: glowTex, color: colors[i % colors.length], transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
            var sp = new THREE.Sprite(mat);
            sp.position.copy(pos);
            var sc = .9 + rnd() * .6; sp.scale.set(sc, sc, sc);
            sp.userData = { wish: w, base: sc, phase: rnd() * Math.PI * 2 };
            scene.add(sp); lights.push(sp);
        });

        // floating fireflies
        var ffGeo = new THREE.BufferGeometry(), ffPos = [];
        for (var i = 0; i < 400; i++) ffPos.push((rnd() - .5) * 60, rnd() * 30, (rnd() - .5) * 60);
        ffGeo.setAttribute('position', new THREE.Float32BufferAttribute(ffPos, 3));
        var ff = new THREE.Points(ffGeo, new THREE.PointsMaterial({ color: 0xffd2a8, size: .15, transparent: true, opacity: .7 }));
        scene.add(ff);

        // picking
        var ray = new THREE.Raycaster(), mouse = new THREE.Vector2(), downAt = null;
        renderer.domElement.addEventListener('pointerdown', function (e) { downAt = [e.clientX, e.clientY]; controls.autoRotate = false; });
        renderer.domElement.addEventListener('pointerup', function (e) {
            if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 6) return;
            var r = renderer.domElement.getBoundingClientRect();
            mouse.x = ((e.clientX - r.left) / r.width) * 2 - 1;
            mouse.y = -((e.clientY - r.top) / r.height) * 2 + 1;
            ray.setFromCamera(mouse, camera);
            var hit = ray.intersectObjects(lights)[0];
            if (hit) {
                showTreeWish(hit.object.userData.wish);
            } else if (display.classList.contains('show')) {
                display.classList.remove('show');
            }
        });
        var hoverCheck = function (e) {
            var r = renderer.domElement.getBoundingClientRect();
            mouse.x = ((e.clientX - r.left) / r.width) * 2 - 1;
            mouse.y = -((e.clientY - r.top) / r.height) * 2 + 1;
            ray.setFromCamera(mouse, camera);
            renderer.domElement.style.cursor = ray.intersectObjects(lights).length ? 'pointer' : 'grab';
        };
        renderer.domElement.addEventListener('pointermove', hoverCheck);

        function showTreeWish(w) {
            display.classList.remove('hint');
            display.innerHTML = '<div class="wish-popup-content">' +
                GW.cardBox(w) +
                '<button class="close-popup-btn" aria-label="' + GW.esc(i18n.t('common.close')) + '" title="' + GW.esc(i18n.t('common.close')) + '"><i class="fas fa-xmark"></i></button>' +
                '</div>';
            display.classList.add('show');
            var btn = display.querySelector('.close-popup-btn');
            if (btn) {
                btn.addEventListener('click', function (e) {
                    e.stopPropagation();
                    display.classList.remove('show');
                });
            }
        }

        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && display && display.classList.contains('show')) {
                display.classList.remove('show');
            }
        });

        function resize() {
            camera.aspect = box.clientWidth / box.clientHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(box.clientWidth, box.clientHeight);
        }
        bindFullscreen('btn-fullscreen-tree', box, resize);
        window.addEventListener('resize', resize);

        var clock = new THREE.Clock();
        (function loop() {
            requestAnimationFrame(loop);
            var t = clock.getElapsedTime();
            lights.forEach(function (sp) {
                var k = sp.userData.base * (1 + .25 * Math.sin(t * 2 + sp.userData.phase));
                sp.scale.set(k, k, k);
            });
            ff.rotation.y = t * .02;
            ring.material.opacity = .6 + .4 * Math.sin(t * 1.5);
            controls.update();
            renderer.render(scene, camera);
        })();
    }

    // 3D scenes need real dimensions, so start them when their tab is first shown
    document.getElementById('map-tab').addEventListener('shown.bs.tab', initGlobe);
    document.getElementById('tree-tab').addEventListener('shown.bs.tab', initTree);

    /*
     * Hidden admin entry: type the passphrase in the search box and press Ctrl+Alt+X.
     * The passphrase is NOT in this file: it is sent to the server, which checks it and, if correct, sets a signed
     * HttpOnly cookie. A wrong phrase does nothing visible.
     */
    var searchBox = document.getElementById('wish-search');
    searchBox.addEventListener('keydown', function (e) {
        if (!(e.ctrlKey && e.altKey && e.code === 'KeyX')) return;
        e.preventDefault();
        var phrase = searchBox.value.trim();
        // nothing is shown on the page (the entry stays hidden); DevTools > Console tells you what happened
        console.info('[admin] Ctrl+Alt+X received');
        if (!phrase) return console.info('[admin] search box is empty: type the passphrase first');
        if (GW.mode !== 'server') return console.info('[admin] no server API (static preview): admin needs server.js');
        GW.adminLogin(phrase).then(function () { searchBox.value = ''; location.reload(); }, function (err) {
            console.info('[admin] login refused: ' + (err.status === 401 ? 'wrong passphrase' : err.status === 429 ? 'too many attempts, wait 10 minutes' : err.message));
        });
    });
    GW.mountAdminBar();

    // shared link: index.html#wish=<id> opens that wish
    var wishHash = /^#wish=([\w-]+)/.exec(location.hash);
    if (wishHash) setTimeout(function () { openDetail(decodeURIComponent(wishHash[1])); }, 400);

    // deep links: index.html#map / #tree open that tab directly
    var deepTab = { '#map': 'map-tab', '#tree': 'tree-tab' }[location.hash];
    if (deepTab) bootstrap.Tab.getOrCreateInstance(document.getElementById(deepTab)).show();

    /* ---------------- Language switch: re-render dynamic text ---------------- */
    i18n.onChange(function () {
        renderWall(true);
        if (document.getElementById('reachModal').classList.contains('show')) renderReach();
        var box = document.querySelector('.tab-desc-collapsible');
        if (box) box.querySelector('.tab-desc-toggle span').textContent = i18n.t(box.classList.contains('expanded') ? 'index.viewLess' : 'index.viewMore');
    });
});
