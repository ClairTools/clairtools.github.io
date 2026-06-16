(function() {
    'use strict';

    /* -- Language ------------------------------------------------ */
    var langs = [
        { code: 'en', flag: '\u{1F1EC}\u{1F1E7}' },
        { code: 'fr', flag: '\u{1F1EB}\u{1F1F7}' },
        { code: 'es', flag: '\u{1F1EA}\u{1F1F8}' },
        { code: 'pt', flag: '\u{1F1E7}\u{1F1F7}' }
    ];

    function detectLang() {
        var stored = localStorage.getItem('clair-lang');
        if (stored && langs.some(function(l) { return l.code === stored; })) return stored;
        var nav = (navigator.language || navigator.userLanguage || 'en').toLowerCase();
        if (nav.indexOf('fr') === 0) return 'fr';
        if (nav.indexOf('es') === 0) return 'es';
        if (nav.indexOf('pt') === 0) return 'pt';
        return 'en';
    }

    function setLang(code) {
        document.documentElement.setAttribute('data-lang', code);
        document.documentElement.setAttribute('lang', code);
        localStorage.setItem('clair-lang', code);
        var lang = langs.find(function(l) { return l.code === code; });
        document.getElementById('lang-btn').textContent = lang ? lang.flag : langs[0].flag;
    }

    var langMenu = document.getElementById('lang-menu');
    var langBtn = document.getElementById('lang-btn');

    langBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        langMenu.classList.toggle('open');
    });
    langMenu.querySelectorAll('button[data-lang-code]').forEach(function(btn) {
        btn.addEventListener('click', function() {
            setLang(btn.getAttribute('data-lang-code'));
            langMenu.classList.remove('open');
        });
    });
    document.addEventListener('click', function() { langMenu.classList.remove('open'); });
    setLang(detectLang());

    /* -- Theme --------------------------------------------------- */
    var themeBtn = document.getElementById('theme-btn');

    function detectTheme() {
        var stored = localStorage.getItem('clair-theme');
        if (stored) return stored;
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    function setTheme(t) {
        if (t === 'dark') {
            document.documentElement.setAttribute('data-theme', 'dark');
            themeBtn.textContent = '☀️';
            document.querySelector('meta[name="theme-color"]').setAttribute('content', '#1A1918');
        } else {
            document.documentElement.removeAttribute('data-theme');
            themeBtn.textContent = '\u{1F319}';
            document.querySelector('meta[name="theme-color"]').setAttribute('content', '#F1ECE0');
        }
        localStorage.setItem('clair-theme', t);
    }

    setTheme(detectTheme());
    themeBtn.addEventListener('click', function() {
        var current = document.documentElement.hasAttribute('data-theme') ? 'light' : 'dark';
        setTheme(current);
        themeBtn.blur();
    });

    /* -- Filmstrip carousels ------------------------------------- */
    document.querySelectorAll('.chapter-media').forEach(function(root) {
        var track = root.querySelector('.phone-carousel');
        if (!track) return;
        var slides = track.querySelectorAll('.phone-frame');
        if (!slides.length) return;

        // Controls are identical for every carousel — build them once here
        // instead of repeating the markup in the HTML.
        if (!root.querySelector('.carousel-controls')) {
            var controls = document.createElement('div');
            controls.className = 'carousel-controls';
            controls.innerHTML =
                '<button class="carousel-btn" data-carousel-prev aria-label="Previous screenshots">‹</button>' +
                '<div class="carousel-progress" aria-label="Scroll screenshots"><div class="carousel-progress-fill"></div></div>' +
                '<button class="carousel-btn" data-carousel-next aria-label="Next screenshots">›</button>';
            track.insertAdjacentElement('afterend', controls);
        }

        var prevBtn = root.querySelector('[data-carousel-prev]');
        var nextBtn = root.querySelector('[data-carousel-next]');
        var fill = root.querySelector('.carousel-progress-fill');

        function gap() {
            var g = parseFloat(getComputedStyle(track).columnGap);
            return isNaN(g) ? 18 : g;
        }
        function step() {
            return slides[0].getBoundingClientRect().width + gap();
        }
        function maxScroll() {
            return track.scrollWidth - track.clientWidth;
        }
        function sync() {
            var max = maxScroll();
            var ratio = max > 0 ? track.scrollLeft / max : 0;
            var visible = max > 0 ? track.clientWidth / track.scrollWidth : 1;
            if (fill) {
                fill.style.width = (visible * 100) + '%';
                fill.style.transform = 'translateX(' + (ratio * (1 - visible) / visible * 100) + '%)';
            }
            if (prevBtn) prevBtn.disabled = track.scrollLeft <= 2;
            if (nextBtn) nextBtn.disabled = track.scrollLeft >= max - 2;
        }

        if (prevBtn) prevBtn.addEventListener('click', function() {
            track.scrollBy({ left: -step() * 2, behavior: 'smooth' });
        });
        if (nextBtn) nextBtn.addEventListener('click', function() {
            track.scrollBy({ left: step() * 2, behavior: 'smooth' });
        });

        track.setAttribute('tabindex', '0');
        track.addEventListener('keydown', function(e) {
            if (e.key === 'ArrowLeft')  { e.preventDefault(); track.scrollBy({ left: -step(), behavior: 'smooth' }); }
            if (e.key === 'ArrowRight') { e.preventDefault(); track.scrollBy({ left: step(), behavior: 'smooth' }); }
        });

        var rafPending = false;
        track.addEventListener('scroll', function() {
            if (rafPending) return;
            rafPending = true;
            requestAnimationFrame(function() { rafPending = false; sync(); });
        });

        /* Draggable scrubber - works with mouse (PC) and finger (mobile).
           Sets scrollLeft directly (1:1 with the pointer) — no animation loop
           to fight a native swipe. Snap is off while dragging, restored on
           release so the strip magnet-snaps to a frame. */
        var progress = root.querySelector('.carousel-progress');
        if (progress) {
            var dragging = false;

            function scrollToPointer(clientX) {
                var rect = progress.getBoundingClientRect();
                var max = maxScroll();
                if (rect.width <= 0 || max <= 0) return;
                var visible = track.clientWidth / track.scrollWidth;
                var thumbW = rect.width * visible;
                var usable = rect.width - thumbW;
                var ratio = usable > 0 ? (clientX - rect.left - thumbW / 2) / usable : 0;
                track.scrollLeft = Math.max(0, Math.min(1, ratio)) * max;
            }

            progress.addEventListener('pointerdown', function(e) {
                dragging = true;
                progress.classList.add('dragging');
                progress.setPointerCapture(e.pointerId);
                track.style.scrollSnapType = 'none';
                scrollToPointer(e.clientX);
                e.preventDefault();
            });
            progress.addEventListener('pointermove', function(e) {
                if (dragging) scrollToPointer(e.clientX);
            });
            function endDrag() {
                if (!dragging) return;
                dragging = false;
                progress.classList.remove('dragging');
                track.style.scrollSnapType = '';
            }
            progress.addEventListener('pointerup', endDrag);
            progress.addEventListener('pointercancel', endDrag);

            // Keyboard support on the scrubber
            progress.setAttribute('tabindex', '0');
            progress.setAttribute('role', 'scrollbar');
            progress.addEventListener('keydown', function(e) {
                if (e.key === 'ArrowLeft')  { e.preventDefault(); track.scrollBy({ left: -step(), behavior: 'smooth' }); }
                if (e.key === 'ArrowRight') { e.preventDefault(); track.scrollBy({ left: step(), behavior: 'smooth' }); }
            });
        }

        sync();
        window.addEventListener('resize', sync);
        window.addEventListener('load', sync);
    });

    /* -- App catalogue: grid <-> detail -------------------------- */
    (function() {
        var grid = document.getElementById('app-grid');
        var detail = document.getElementById('app-detail');
        var chapters = Array.prototype.slice.call(document.querySelectorAll('.chapter[data-app]'));
        if (!grid || !detail || !chapters.length) return;

        // Always surface released apps first: a "Coming soon" chapter carries a
        // .btn-disabled CTA. Stable sort keeps each group in its source order, so
        // a newly-released app moves up automatically the moment its CTA goes live.
        var isSoon = function(ch) { return !!ch.querySelector('.chapter-cta .btn-disabled'); };
        chapters = chapters
            .map(function(ch, i) { return { ch: ch, i: i, soon: isSoon(ch) }; })
            .sort(function(a, b) { return (a.soon - b.soon) || (a.i - b.i); })
            .map(function(e) { return e.ch; });

        var STATUS = {
            live: '<span class="en">Available</span><span class="fr">Disponible</span><span class="es">Disponible</span><span class="pt">Disponível</span>',
            soon: '<span class="en">Coming soon</span><span class="fr">Bientôt</span><span class="es">Próximamente</span><span class="pt">Em breve</span>'
        };
        var BACK = '<span class="en">All apps</span><span class="fr">Toutes les apps</span><span class="es">Todas las apps</span><span class="pt">Todos os apps</span>';

        // Build one tile per chapter — no duplicated metadata, scales to any
        // number of apps (the grid auto-fills columns).
        chapters.forEach(function(ch) {
            var app = ch.getAttribute('data-app');
            var name = ch.querySelector('.chapter-name').textContent.trim();
            var cat = ch.querySelector('.chapter-eyebrow').innerHTML;
            var soon = !!ch.querySelector('.chapter-cta .btn-disabled');
            var tile = document.createElement('button');
            tile.type = 'button';
            tile.className = 'app-tile';
            tile.setAttribute('role', 'listitem');
            tile.setAttribute('data-app', app);
            tile.innerHTML =
                '<img class="app-tile-icon" src="img/icon-' + app + '.png" alt="" width="56" height="56" loading="lazy">' +
                '<span class="app-tile-cat">' + cat + '</span>' +
                '<span class="app-tile-name">' + name + '</span>' +
                '<span class="app-tile-status ' + (soon ? 'is-soon' : 'is-live') + '">' +
                    '<span class="app-tile-dot" aria-hidden="true"></span>' +
                    (soon ? STATUS.soon : STATUS.live) +
                '</span>';
            tile.addEventListener('click', function() { openApp(app, true); });
            grid.appendChild(tile);
        });

        // Sticky "back to grid" bar injected once at the top of the detail view.
        var bar = document.createElement('div');
        bar.className = 'back-bar';
        bar.innerHTML =
            '<div class="container">' +
                '<button type="button" class="back-to-grid">' +
                    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
                    '<rect x="3" y="3" width="7" height="7" rx="1.5"></rect><rect x="14" y="3" width="7" height="7" rx="1.5"></rect>' +
                    '<rect x="3" y="14" width="7" height="7" rx="1.5"></rect><rect x="14" y="14" width="7" height="7" rx="1.5"></rect></svg>' +
                    '<span>' + BACK + '</span>' +
                '</button>' +
            '</div>';
        bar.querySelector('.back-to-grid').addEventListener('click', function() { showGrid(true); });
        detail.insertBefore(bar, detail.firstChild);

        function navH() {
            var n = document.querySelector('nav.site-nav');
            return n ? n.offsetHeight : 0;
        }
        function scrollToAppsTop(smooth) {
            var apps = document.getElementById('apps');
            var y = apps.getBoundingClientRect().top + window.pageYOffset - navH() - 8;
            window.scrollTo({ top: Math.max(0, y), behavior: smooth ? 'smooth' : 'auto' });
        }

        // scroll: false = set state silently (initial load — keep the visitor
        // wherever they are). true = user action, glide to the apps section.
        function openApp(app, scroll) {
            var found = false;
            chapters.forEach(function(ch) {
                var on = ch.getAttribute('data-app') === app;
                ch.hidden = !on;
                if (on) found = true;
            });
            if (!found) return;
            grid.parentNode.hidden = true;
            detail.hidden = false;
            if (location.hash.replace('#', '') !== app) {
                history.replaceState(null, '', '#' + app);
            }
            // The carousel for this chapter initialised while hidden (zero width);
            // nudge it to recompute progress + button states now that it's visible.
            window.dispatchEvent(new Event('resize'));
            if (scroll) scrollToAppsTop(true);
        }

        function showGrid(scroll) {
            detail.hidden = true;
            grid.parentNode.hidden = false;
            chapters.forEach(function(ch) { ch.hidden = true; });
            if (location.hash) history.replaceState(null, '', location.pathname);
            if (scroll) scrollToAppsTop(true);
        }

        function syncFromHash(scroll) {
            var h = (location.hash || '').replace('#', '').toLowerCase();
            if (h && chapters.some(function(c) { return c.getAttribute('data-app') === h; })) {
                openApp(h, scroll);
            } else {
                showGrid(scroll);
            }
        }

        // #apps from the nav should always land on the grid, not a stale detail.
        document.querySelectorAll('a[href="#apps"]').forEach(function(a) {
            a.addEventListener('click', function() { showGrid(false); });
        });
        window.addEventListener('hashchange', function() { syncFromHash(true); });
        syncFromHash(false);
    })();

    /* -- Lightbox ------------------------------------------------ */
    var lightbox = document.getElementById('lightbox');
    var lightboxTrack = lightbox.querySelector('.lightbox-track');
    var lightboxState = { open: false, lights: [], darks: [] };

    function isDarkTheme() {
        return document.documentElement.hasAttribute('data-theme');
    }

    function buildLightboxSlides(carousel) {
        var frames = carousel.querySelectorAll('.phone-frame');
        lightboxState.lights = [];
        lightboxState.darks = [];
        while (lightboxTrack.firstChild) lightboxTrack.removeChild(lightboxTrack.firstChild);
        frames.forEach(function(frame) {
            var l = frame.querySelector('img.screenshot-light');
            var d = frame.querySelector('img.screenshot-dark');
            if (!l || !d) return;
            lightboxState.lights.push(l.src);
            lightboxState.darks.push(d.src);
            var slide = document.createElement('div');
            slide.className = 'lightbox-slide';
            var img = document.createElement('img');
            img.src = isDarkTheme() ? d.src : l.src;
            img.alt = l.alt || '';
            slide.appendChild(img);
            lightboxTrack.appendChild(slide);
        });
    }

    function openLightbox(carousel, startIndex) {
        buildLightboxSlides(carousel);
        lightboxState.open = true;
        lightbox.classList.add('open');
        lightbox.setAttribute('aria-hidden', 'false');
        document.body.classList.add('lightbox-open');
        requestAnimationFrame(function() {
            var prevBehavior = lightboxTrack.style.scrollBehavior;
            lightboxTrack.style.scrollBehavior = 'auto';
            lightboxTrack.scrollLeft = startIndex * lightboxTrack.clientWidth;
            requestAnimationFrame(function() {
                lightboxTrack.style.scrollBehavior = prevBehavior || '';
            });
        });
    }

    function closeLightbox() {
        if (!lightboxState.open) return;
        lightboxState.open = false;
        lightbox.classList.remove('open');
        lightbox.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('lightbox-open');
    }

    var lbStartX = 0, lbStartY = 0, lbMoved = false;
    lightbox.addEventListener('pointerdown', function(e) {
        lbStartX = e.clientX; lbStartY = e.clientY; lbMoved = false;
    });
    lightbox.addEventListener('pointermove', function(e) {
        if (Math.hypot(e.clientX - lbStartX, e.clientY - lbStartY) > 8) lbMoved = true;
    });
    lightbox.addEventListener('click', function() {
        if (!lbMoved) closeLightbox();
    });

    document.addEventListener('keydown', function(e) {
        if (!lightboxState.open) return;
        if (e.key === 'Escape') { closeLightbox(); return; }
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
            e.preventDefault();
            var w = lightboxTrack.clientWidth;
            var idx = Math.round(lightboxTrack.scrollLeft / w);
            var next = e.key === 'ArrowRight' ? idx + 1 : idx - 1;
            var max = lightboxTrack.children.length - 1;
            next = Math.max(0, Math.min(max, next));
            lightboxTrack.scrollTo({ left: next * w, behavior: 'smooth' });
        }
    });

    var themeObserver = new MutationObserver(function() {
        if (!lightboxState.open) return;
        var imgs = lightboxTrack.querySelectorAll('img');
        imgs.forEach(function(img, i) {
            img.src = isDarkTheme() ? lightboxState.darks[i] : lightboxState.lights[i];
        });
    });
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    document.querySelectorAll('.phone-frame').forEach(function(frame) {
        var startX = 0, startY = 0, moved = false;
        frame.addEventListener('pointerdown', function(e) {
            startX = e.clientX; startY = e.clientY; moved = false;
        });
        frame.addEventListener('pointermove', function(e) {
            if (Math.hypot(e.clientX - startX, e.clientY - startY) > 8) moved = true;
        });
        frame.addEventListener('click', function(e) {
            if (moved) return;
            var carousel = frame.closest('.phone-carousel');
            if (!carousel) return;
            var siblings = Array.prototype.slice.call(carousel.querySelectorAll('.phone-frame'));
            var idx = siblings.indexOf(frame);
            e.stopPropagation();
            openLightbox(carousel, idx);
        });
        frame.setAttribute('tabindex', '0');
        frame.setAttribute('role', 'button');
        frame.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                var carousel = frame.closest('.phone-carousel');
                if (!carousel) return;
                var siblings = Array.prototype.slice.call(carousel.querySelectorAll('.phone-frame'));
                openLightbox(carousel, siblings.indexOf(frame));
            }
        });
    });
})();
