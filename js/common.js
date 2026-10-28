/*
 * Shared helpers: wish store, card rendering, share, spinner.
 *
 * Two modes, picked automatically:
 *   server  - served by server.js: wishes live in SQLite, photos in /uploads, one wish per browser (signed cookie).
 *   static  - plain static hosting / file preview: demo data + this browser's own wishes in localStorage.
 */
(function () {
    var USER_KEY = 'gw_user_wishes';
    var LIKE_KEY = 'gw_liked';
    var POSTED_KEY = 'gw_posted';       // id of the wish this browser already sent (second line of defence besides the cookie)

    function read(key, fallback) {
        try { var v = JSON.parse(localStorage.getItem(key)); return v == null ? fallback : v; } catch (e) { return fallback; }
    }
    function write(key, value) {
        try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (e) { return false; }
    }

    function esc(s) {
        return String(s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }
    function initials(name) {
        var parts = String(name || '?').trim().split(/\s+/);
        return (parts.length > 1 ? parts[parts.length - 1][0] : parts[0][0] || '?').toUpperCase();
    }
    function countryName(code) {
        var c = GW_DATA.countries[code];
        return c ? (i18n.lang === 'en' ? c[1] : c[0]) : code;
    }
    function continentName(key) {
        var c = GW_DATA.continents[key];
        return c ? c[i18n.lang] || c.vi : key;
    }
    function formatDate(iso) {
        var d = new Date(iso);
        var pad = function (n) { return n < 10 ? '0' + n : n; };
        return pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear();
    }
    function fetchJson(url, opts) {
        opts = opts || {};
        opts.credentials = 'same-origin';
        var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
        if (controller && !opts.signal) opts.signal = controller.signal;
        var timer = controller ? setTimeout(function () { controller.abort(); }, 20000) : null;
        return fetch(url, opts).then(function (r) {
            if (timer) clearTimeout(timer);
            return r.json().catch(function () { return {}; }).then(function (body) {
                if (!r.ok) { var err = new Error(body.error || 'http_' + r.status); err.status = r.status; err.body = body; throw err; }
                return body;
            });
        }).catch(function (err) {
            if (timer) clearTimeout(timer);
            throw err;
        });
    }

    function fit(g, text, maxW) {
        text = String(text);
        if (g.measureText(text).width <= maxW) return text;
        while (text.length > 1 && g.measureText(text + '\u2026').width > maxW) text = text.slice(0, -1);
        return text + '\u2026';
    }
    function wrapText(g, text, maxW, maxLines) {
        var words = String(text).split(/\s+/), lines = [], cur = '';
        for (var i = 0; i < words.length; i++) {
            var test = cur ? cur + ' ' + words[i] : words[i];
            if (g.measureText(test).width <= maxW) { cur = test; continue; }
            if (cur) lines.push(cur);
            cur = words[i];
            if (lines.length === maxLines) break;
        }
        if (lines.length < maxLines && cur) lines.push(cur);
        if (lines.length === maxLines && words.join(' ') !== lines.join(' ')) lines[maxLines - 1] = fit(g, lines[maxLines - 1] + ' \u2026', maxW);
        return lines;
    }

    var list = [];
    var GW = window.GW = {
        mode: 'static',
        admin: false,
        esc: esc,
        countryName: countryName,
        continentName: continentName,
        formatDate: formatDate,

        /* ---------- loading ---------- */
        load: function () {
            return fetchJson('api/wishes').then(function (rows) {
                if (!Array.isArray(rows)) throw new Error('no_api');
                GW.mode = 'server'; list = rows;
                return fetchJson('api/admin/me').then(function (r) { GW.admin = !!r.admin; }, function () { }).then(function () { return list; });
            }).catch(function () {
                GW.mode = 'static';
                var mine = read(USER_KEY, []).map(function (w) { w.mine = true; return w; });
                list = mine.concat(GW_DATA.wishes);
                return list;
            });
        },
        all: function () { return list; },
        find: function (id) { return list.filter(function (w) { return w.id === id; })[0]; },

        /* ---------- one wish per browser ---------- */
        status: function () {
            var localId = read(POSTED_KEY, null);
            if (GW.mode !== 'server') return Promise.resolve({ posted: !!localId, wishId: localId });
            return fetchJson('api/me').then(function (me) {
                if (me.posted) write(POSTED_KEY, me.wishId);
                return { posted: me.posted || !!localId, wishId: me.wishId || localId };
            }).catch(function () { return { posted: !!localId, wishId: localId }; });
        },
        postWish: function (w) {
            if (GW.mode === 'server') {
                return fetchJson('api/wishes', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(w)
                }).then(function (saved) { write(POSTED_KEY, saved.id); return saved; })
                    .catch(function (e) { if (e.status === 409) write(POSTED_KEY, (e.body && e.body.wishId) || true); throw e; });
            }
            w.id = 'u' + Date.now(); w.hearts = 0; w.createdAt = new Date().toISOString();
            var mine = read(USER_KEY, []); mine.unshift(w);
            if (!write(USER_KEY, mine) || !write(POSTED_KEY, w.id)) return Promise.reject(new Error('storage_full'));
            return Promise.resolve(w);
        },

        /* ---------- admin (the server decides; the browser only holds a signed HttpOnly cookie) ---------- */
        adminLogin: function (passphrase) {
            return fetchJson('api/admin/login', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ passphrase: passphrase })
            }).then(function () { GW.admin = true; return true; });
        },
        adminLogout: function () {
            return fetchJson('api/admin/logout', { method: 'POST' }).then(function () { GW.admin = false; });
        },
        updateWish: function (id, body) {
            return fetchJson('api/wishes/' + encodeURIComponent(id), {
                method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
            });
        },
        deleteWish: function (id) {
            return fetchJson('api/wishes/' + encodeURIComponent(id), { method: 'DELETE' });
        },

        /*
         * Renders the wish card (photo + message + author + logo) into a 1000x1000 JPEG data URL.
         * This image is uploaded with the wish and is what Facebook shows when someone shares it, so the shared post
         * looks exactly like the card on the site. photoSrc: a <canvas> (fresh crop) or an image URL (existing photo).
         */
        renderCardImage: function (w, photoSrc) {
            var S = 800;
            function loadImg(src) {
                return new Promise(function (ok) {
                    var i = new Image();
                    var t = setTimeout(function () { ok(i); }, 2500);
                    i.onload = function () { clearTimeout(t); ok(i); };
                    i.onerror = function () { clearTimeout(t); ok(i); };
                    i.src = src;
                });
            }
            var fontTimeout = new Promise(function (resolve) { setTimeout(resolve, 800); });
            var fontPromise = document.fonts ? document.fonts.ready : Promise.resolve();
            var fonts = Promise.race([fontPromise, fontTimeout]);

            var photo = typeof photoSrc === 'string' ? loadImg(photoSrc) : Promise.resolve(photoSrc);
            return Promise.all([photo, loadImg('images/logo.png'), fonts]).then(function (r) {
                var img = r[0] || {}, logo = r[1] || {};
                var c = document.createElement('canvas'); c.width = c.height = S;
                var g = c.getContext('2d'); g.imageSmoothingQuality = 'medium';
                var FONT = '"Be Vietnam Pro", Arial, sans-serif';

                // photo, cover-fitted
                var iw = img.naturalWidth || img.width || S, ih = img.naturalHeight || img.height || S, k = Math.max(S / iw, S / ih);
                if (img.width || img.naturalWidth) {
                    g.drawImage(img, (S - iw * k) / 2, (S - ih * k) / 2, iw * k, ih * k);
                } else {
                    g.fillStyle = '#061b3d'; g.fillRect(0, 0, S, S);
                }

                // navy panel rising from the bottom (same stops as the CSS card)
                var gr = g.createLinearGradient(0, 0, 0, S);
                gr.addColorStop(0, 'rgba(6,27,61,0)'); gr.addColorStop(.30, 'rgba(6,27,61,0)');
                gr.addColorStop(.58, 'rgba(6,27,61,.88)'); gr.addColorStop(1, 'rgba(6,27,61,.97)');
                g.fillStyle = gr; g.fillRect(0, 0, S, S);

                function rrect(x, y, w, h, rad) {
                    g.beginPath(); g.moveTo(x + rad, y); g.arcTo(x + w, y, x + w, y + h, rad); g.arcTo(x + w, y + h, x, y + h, rad);
                    g.arcTo(x, y + h, x, y, rad); g.arcTo(x, y, x + w, y, rad); g.closePath();
                }
                // logo badge
                var lh = 72, lw = logo.width && logo.height ? Math.round(lh * logo.width / logo.height) : 200;
                g.fillStyle = 'rgba(255,255,255,.94)'; rrect(48, 40, lw + 42, lh + 22, 24); g.fill();
                if (logo.width) g.drawImage(logo, 69, 51, lw, lh);
                // date tag
                g.fillStyle = '#f37021'; g.fillRect(S - 160, 0, 160, 40);
                g.fillStyle = '#fff'; g.font = '700 21px ' + FONT; g.textAlign = 'center'; g.textBaseline = 'middle';
                g.fillText(formatDate(w.createdAt || new Date().toISOString()), S - 80, 22);

                // author block
                var scale = S / 1000;
                g.textAlign = 'left'; g.textBaseline = 'alphabetic';
                g.shadowColor = 'rgba(0,0,0,.45)'; g.shadowBlur = 8;
                var meta1 = i18n.t('role.' + w.role) + ' \u00b7 ' + i18n.t('campus.' + w.campus), meta2 = countryName(w.country);
                var footTop = Math.round(759 * scale), tx = Math.round(270 * scale);
                g.fillStyle = '#fff'; g.font = '800 ' + Math.round(54 * scale) + 'px ' + FONT; g.fillText(fit(g, w.name, 520), tx, footTop + Math.round(42 * scale));
                g.fillStyle = 'rgba(255,255,255,.85)'; g.font = '500 ' + Math.round(40 * scale) + 'px ' + FONT;
                g.fillText(fit(g, meta1, 520), tx, footTop + Math.round(42 * scale + 43 * scale));
                g.fillText(fit(g, '\u25CF ' + meta2, 520), tx, footTop + Math.round(42 * scale + 43 * scale + 42 * scale));
                g.shadowBlur = 0;
                var avR = Math.round(60 * scale);
                g.fillStyle = '#f37021'; g.beginPath(); g.arc(Math.round(155 * scale), footTop + Math.round(69 * scale), avR, 0, Math.PI * 2); g.fill();
                g.lineWidth = 3; g.strokeStyle = 'rgba(255,255,255,.7)'; g.stroke();
                g.fillStyle = '#fff'; g.font = '800 ' + Math.round(48 * scale) + 'px ' + FONT; g.textAlign = 'center';
                g.fillText(initials(w.name), Math.round(155 * scale), footTop + Math.round(69 * scale + 17 * scale)); g.textAlign = 'left';
                g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(Math.round(80 * scale), Math.round(729 * scale), Math.round(840 * scale), 2);

                // message, built upwards from the divider
                g.shadowColor = 'rgba(0,0,0,.5)'; g.shadowBlur = 10;
                g.font = '600 ' + Math.round(56 * scale) + 'px ' + FONT; g.fillStyle = '#fff';
                var lines = wrapText(g, w.message, Math.round(840 * scale), 4), lh2 = Math.round(77 * scale), top = Math.round(689 * scale) - lines.length * lh2;
                lines.forEach(function (ln, i) { g.fillText(ln, Math.round(80 * scale), top + (i + 1) * lh2 - 16); });
                g.shadowBlur = 0;
                g.fillStyle = '#f37021'; g.font = '900 ' + Math.round(150 * scale) + 'px Georgia, serif'; g.fillText('\u201C', Math.round(70 * scale), top + 20);

                var q = .78, data = c.toDataURL('image/jpeg', q);
                while (data.length > 350 * 1024 && q > .45) { q -= .1; data = c.toDataURL('image/jpeg', q); }
                return data;
            });
        },

        /* floating "ADMIN" pill: add a wish / leave admin mode (only exists while the admin cookie is valid) */
        mountAdminBar: function () {
            if (!GW.admin || document.getElementById('admin-bar')) return;
            var bar = document.createElement('div');
            bar.id = 'admin-bar'; bar.className = 'admin-bar';
            bar.innerHTML = '<span class="admin-tag"><i class="fas fa-user-shield me-1"></i>ADMIN</span>' +
                '<a href="create.html" class="admin-act"><i class="fas fa-plus me-1"></i>' + esc(i18n.t('admin.add')) + '</a>' +
                '<button type="button" class="admin-act out" id="admin-logout"><i class="fas fa-right-from-bracket me-1"></i>' + esc(i18n.t('admin.logout')) + '</button>';
            document.body.appendChild(bar);
            document.getElementById('admin-logout').addEventListener('click', function () {
                GW.adminLogout().then(function () { location.href = 'index.html'; });
            });
        },

        /* ---------- hearts ---------- */
        isLiked: function (w) {
            return GW.mode === 'server' ? !!w.liked : read(LIKE_KEY, []).indexOf(w.id) !== -1;
        },
        heartCount: function (w) {
            return GW.mode === 'server' ? (w.hearts || 0) : (w.hearts || 0) + (read(LIKE_KEY, []).indexOf(w.id) !== -1 ? 1 : 0);
        },
        toggleLike: function (w) {
            if (GW.mode === 'server') {
                return fetchJson('api/wishes/' + encodeURIComponent(w.id) + '/like', { method: 'POST' }).then(function (r) {
                    w.liked = r.liked; w.hearts = r.hearts; return r.liked;
                });
            }
            var liked = read(LIKE_KEY, []), i = liked.indexOf(w.id);
            if (i === -1) liked.push(w.id); else liked.splice(i, 1);
            write(LIKE_KEY, liked);
            return Promise.resolve(i === -1);
        },

        /* ---------- sharing ---------- */
        shareUrl: function (w) {
            var base = location.origin + location.pathname.replace(/[^/]*$/, '');
            // server mode: /w/:id serves Open Graph tags (photo, name, message) so Facebook shows a rich preview
            return GW.mode === 'server' ? location.origin + '/w/' + encodeURIComponent(w.id)
                : base + 'index.html#wish=' + encodeURIComponent(w.id);
        },
        shareFacebook: function (w) {
            var u = 'https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(GW.shareUrl(w));
            window.open(u, 'fbshare', 'width=600,height=520,menubar=no,toolbar=no');
        },

        /* ---------- card markup ---------- */
        cardFace: function (w) {
            var bg = w.image || (/^p\d\d$/.test(w.theme || '') ? 'images/photos/' + w.theme + '.jpg' : '');
            var style = bg ? ' style="background-image:url(\'' + esc(bg) + '\')"' : '';
            var meta = i18n.t('role.' + w.role) + ' · ' + i18n.t('campus.' + w.campus);
            return '<div class="wish-card ' + (bg ? 'photo' : 'theme-' + esc(w.theme || 'navy')) + '"' + style + '>' +
                '<div class="wc-brand"><img src="images/logo.png" alt="Greenwich"></div>' +
                '<div class="wc-quote"><i class="fas fa-quote-left"></i></div>' +
                '<div class="wc-msg">' + esc(w.message) + '</div>' +
                '<div class="wc-foot">' +
                '<div class="wc-avatar">' + esc(initials(w.name)) + '</div>' +
                '<div><div class="wc-name">' + esc(w.name) + '</div>' +
                '<div class="wc-meta">' + esc(meta) + '</div>' +
                '<div class="wc-meta"><i class="fas fa-location-dot me-1"></i>' + esc(countryName(w.country)) + '</div></div>' +
                '</div></div>';
        },

        cardBox: function (w, extraClass) {
            return '<div class="cr-detail-box ' + (extraClass || '') + '" data-id="' + esc(w.id) + '">' +
                GW.cardFace(w) +
                '<span class="cr-date">' + formatDate(w.createdAt) + '</span>' +
                (w.mine ? '<span class="my-wish-badge">' + esc(i18n.t('card.mine')) + '</span>' : '') +
                (GW.admin ? '<div class="wc-admin"><button type="button" data-admin-edit="' + esc(w.id) + '" title="' + esc(i18n.t('admin.edit')) + '"><i class="fas fa-pen"></i></button>' +
                    '<button type="button" class="del" data-admin-del="' + esc(w.id) + '" title="' + esc(i18n.t('admin.delete')) + '"><i class="fas fa-trash"></i></button></div>' : '') +
                '<button type="button" class="wc-share" data-share="' + esc(w.id) + '" title="' + esc(i18n.t('share.facebook')) + '" aria-label="' + esc(i18n.t('share.facebook')) + '"><i class="fab fa-facebook-f"></i></button>' +
                '<button type="button" class="wc-heart' + (GW.isLiked(w) ? ' liked' : '') + '" data-heart="' + esc(w.id) + '">' +
                '<i class="fas fa-heart"></i><span>' + GW.heartCount(w) + '</span></button>' +
                '</div>';
        },

        spinner: function (show, text) {
            var el = document.getElementById('spinner_layout');
            if (!el) return;
            if (text) document.getElementById('progress_status').textContent = text;
            el.classList.toggle('hidden', !show);
        }
    };

    document.addEventListener('click', function (e) {
        var edit = e.target.closest('[data-admin-edit]'), del = e.target.closest('[data-admin-del]');
        if (!edit && !del) return;
        e.stopPropagation(); e.preventDefault();
        if (!GW.admin) return;
        if (edit) { location.href = 'create.html?edit=' + encodeURIComponent(edit.getAttribute('data-admin-edit')); return; }
        if (!confirm(i18n.t('admin.confirmDelete'))) return;
        GW.deleteWish(del.getAttribute('data-admin-del')).then(function () { location.reload(); })
            .catch(function () { alert(i18n.t('admin.failed')); });
    }, true);

    /* heart + share buttons anywhere on the page (capture phase so the card's own click handler never fires) */
    document.addEventListener('click', function (e) {
        var heart = e.target.closest('[data-heart]');
        var share = e.target.closest('[data-share]');
        if (!heart && !share) return;
        e.stopPropagation();
        var id = (heart || share).getAttribute(heart ? 'data-heart' : 'data-share');
        var w = GW.find(id) || (window.GW_PREVIEW && window.GW_PREVIEW.id === id ? window.GW_PREVIEW : null);
        if (!w) return;
        if (share) return GW.shareFacebook(w);
        GW.toggleLike(w).then(function (liked) {
            document.querySelectorAll('[data-heart="' + id + '"]').forEach(function (b) {
                b.classList.toggle('liked', liked);
                b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop');
                b.querySelector('span').textContent = GW.heartCount(w);
            });
        }).catch(function () { });
    }, true);
})();
