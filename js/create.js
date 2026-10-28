/*
 * Create / edit a wish: photo upload + square crop, live card preview, one wish per browser.
 *   create.html            visitors (one wish per browser) and admins (unlimited)
 *   create.html?edit=<id>  admins only: edit any wish (the photo is optional, keep the current one or crop a new one)
 *
 * On submit two JPEGs are produced: the cropped photo, and the fully rendered wish card. The card is what Facebook shows
 * when the wish is shared, so the shared post looks exactly like the one on the site.
 */
document.addEventListener('DOMContentLoaded', function () {
    var $ = function (id) { return document.getElementById(id); };
    var cropper = null, previewTimer = null, editing = null;       // editing = the wish being edited (admin)
    var MAX_FILE = 15 * 1024 * 1024;
    var PLACEHOLDER = 'p01';          // shown in the preview until the author picks a photo
    var editId = new URLSearchParams(location.search).get('edit');

    function fillCountries() {
        var sel = $('f-country'), cur = sel.value || 'VN';
        var codes = Object.keys(GW_DATA.countries).sort(function (a, b) {
            return a === 'VN' ? -1 : b === 'VN' ? 1 : GW.countryName(a).localeCompare(GW.countryName(b));
        });
        sel.innerHTML = codes.map(function (c) { return '<option value="' + c + '">' + GW.esc(GW.countryName(c)) + '</option>'; }).join('');
        sel.value = cur;
    }

    function fields() {
        return {
            name: $('f-name').value.trim(),
            role: $('f-role').value,
            campus: $('f-campus').value,
            country: $('f-country').value,
            message: $('f-message').value.trim()
        };
    }

    /* ---------- live preview (the real card, with the cropped photo) ---------- */
    function renderPreview() {
        var w = fields();
        w.name = w.name || i18n.t('create.defaultName');
        w.message = w.message || i18n.t('create.defaultMsg');
        w.createdAt = editing ? editing.createdAt : new Date().toISOString();
        if (cropper) w.image = cropper.getCroppedCanvas({ width: 480, height: 480, imageSmoothingQuality: 'medium' }).toDataURL('image/jpeg', .8);
        else if (editing && editing.image) w.image = editing.image;
        else w.theme = PLACEHOLDER;
        $('preview').innerHTML = GW.cardFace(w);
        $('f-count').textContent = $('f-message').value.length;
    }
    function schedulePreview() { clearTimeout(previewTimer); previewTimer = setTimeout(renderPreview, 60); }

    /* ---------- photo picking + cropping ---------- */
    function showMsg(key, kind) {
        var el = $('f-error');
        el.className = 'alert py-2 alert-' + (kind || 'warning');
        el.textContent = i18n.t(key); el.setAttribute('data-i18n', key);
    }
    function clearMsg() { $('f-error').classList.add('d-none'); }

    function destroyCropper() {
        if (cropper) { cropper.destroy(); cropper = null; }
        $('crop-area').classList.add('d-none'); $('btn-pick').classList.remove('d-none'); $('f-file').value = '';
    }

    function openFile(file) {
        clearMsg();
        if (!file) return;
        if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return showMsg('create.badType');
        if (file.size > MAX_FILE) return showMsg('create.tooBig');
        var url = URL.createObjectURL(file);
        if (cropper) { cropper.destroy(); cropper = null; }
        var img = $('crop-img');
        img.onload = function () {
            $('crop-area').classList.remove('d-none');
            $('btn-pick').classList.add('d-none');
            cropper = new Cropper(img, {
                aspectRatio: 1, viewMode: 1, dragMode: 'move', autoCropArea: 1, background: false, guides: false,
                center: false, highlight: false, cropBoxMovable: false, cropBoxResizable: false,
                toggleDragModeOnDblclick: false, checkOrientation: true, responsive: true,
                ready: renderPreview, crop: schedulePreview
            });
        };
        img.src = url;
    }
    $('btn-pick').addEventListener('click', function () { $('f-file').click(); });
    $('crop-change').addEventListener('click', function () { $('f-file').value = ''; $('f-file').click(); });
    var btnRemove = $('crop-remove');
    if (btnRemove) btnRemove.addEventListener('click', function () { destroyCropper(); renderPreview(); });
    $('f-file').addEventListener('change', function () { openFile(this.files[0]); });
    $('crop-zoom-in').addEventListener('click', function () { cropper && cropper.zoom(.1); });
    $('crop-zoom-out').addEventListener('click', function () { cropper && cropper.zoom(-.1); });
    $('crop-rotate').addEventListener('click', function () { cropper && cropper.rotate(90); });
    ['dragover', 'drop'].forEach(function (ev) {
        $('btn-pick').addEventListener(ev, function (e) {
            e.preventDefault();
            if (ev === 'drop' && e.dataTransfer.files.length) openFile(e.dataTransfer.files[0]);
        });
    });
    ['f-name', 'f-role', 'f-campus', 'f-country', 'f-message'].forEach(function (id) { $(id).addEventListener('input', schedulePreview); });

    /* ---------- "already sent" state (visitors) ---------- */
    function showPosted(wishId) {
        var w = GW.find(wishId) || window.GW_PREVIEW;
        $('wish-form').classList.add('d-none');
        $('posted-panel').classList.remove('d-none');
        if (w) {
            window.GW_PREVIEW = w;
            $('preview').innerHTML = GW.cardFace(w);
            $('btn-share-mine').onclick = function () { GW.shareFacebook(w); };
        } else {
            $('btn-share-mine').classList.add('d-none');
        }
    }

    /* ---------- submit ---------- */
    function photoCanvas() {
        // resize to 640x640: sharp on all screens, but 3x faster and avoids mobile OOM
        return cropper.getCroppedCanvas({ width: 640, height: 640, fillColor: '#ffffff', imageSmoothingQuality: 'medium' });
    }
    function canvasJpeg(canvas) {
        // compress with 0.78 quality: cuts payload from 1.5MB to ~80-120KB
        var q = .78, data = canvas.toDataURL('image/jpeg', q);
        while (data.length > 400 * 1024 && q > .45) { q -= .1; data = canvas.toDataURL('image/jpeg', q); }
        return data;
    }
    function fail(err) {
        GW.spinner(false);
        if (err.name === 'AbortError' || (err.message && err.message.indexOf('timeout') !== -1)) {
            return showMsg('create.tooBig');
        }
        if (err.status === 409) return GW.load().then(function () { showPosted(err.body && err.body.wishId); });
        if (err.status === 403) return showMsg('admin.expired');
        showMsg(err.status === 429 ? 'create.errRate' : (err.status === 413 || err.message === 'storage_full') ? 'create.tooBig' : 'create.errGeneric');
    }

    $('wish-form').addEventListener('submit', function (e) {
        e.preventDefault();
        clearMsg();
        var w = fields();
        if (!w.name || !w.message) return showMsg('create.required');
        GW.spinner(true, i18n.t('create.sending'));

        // If no photo was picked, pick a random theme photo
        var randomTheme = GW_DATA.themes[Math.floor(Math.random() * GW_DATA.themes.length)];
        var cardWish = {
            name: w.name, role: w.role, campus: w.campus, country: w.country, message: w.message,
            createdAt: editing ? editing.createdAt : new Date().toISOString()
        };
        var photo = cropper ? photoCanvas() : null;
        var photoSrcForCard = photo || (editing && editing.image) || ('images/photos/' + randomTheme + '.jpg');

        GW.renderCardImage(cardWish, photoSrcForCard).then(function (cardImage) {
            w.cardImage = cardImage;
            if (photo) {
                w.image = canvasJpeg(photo);
                w.theme = null;
            } else if (!editing) {
                w.image = null;
                w.theme = randomTheme;
            }

            if (editing) {
                return GW.updateWish(editing.id, w).then(function () { location.href = 'index.html'; });
            }
            return GW.postWish(w).then(function (saved) {
                GW.spinner(false);
                if (GW.admin) {                         // admins may keep posting: reset the form for the next one
                    $('wish-form').reset(); destroyCropper(); renderPreview();
                    showMsg('admin.posted', 'success');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                    return;
                }
                window.GW_PREVIEW = saved;
                showPosted(saved.id);
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
        }).catch(fail);
    });

    i18n.onChange(function () { fillCountries(); if (!$('posted-panel').classList.contains('d-none')) return; renderPreview(); });

    /* ---------- start ---------- */
    fillCountries();
    renderPreview();
    GW.load().then(function () {
        GW.mountAdminBar();
        if (editId) {
            if (!GW.admin) { location.href = 'index.html'; return; }
            editing = GW.find(editId);
            if (!editing) { location.href = 'index.html'; return; }
            $('f-name').value = editing.name; $('f-role').value = editing.role; $('f-campus').value = editing.campus;
            $('f-country').value = editing.country; $('f-message').value = editing.message;
            var h = document.querySelector('#wish-form h1'); h.setAttribute('data-i18n', 'admin.editTitle'); h.textContent = i18n.t('admin.editTitle');
            var sb = document.querySelector('#wish-form button[type=submit] span'); sb.setAttribute('data-i18n', 'admin.save'); sb.textContent = i18n.t('admin.save');
            $('f-photo-label').setAttribute('data-i18n', 'admin.photoOptional'); $('f-photo-label').textContent = i18n.t('admin.photoOptional');
            renderPreview();
            return;
        }
        if (GW.admin) { $('admin-note').classList.remove('d-none'); return; }
        return GW.status().then(function (st) { if (st.posted) showPosted(st.wishId); });
    });
});
