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

        /* Draggable scrubber - works with mouse (PC) and finger (mobile) */
        var progress = root.querySelector('.carousel-progress');
        if (progress) {
            var dragging = false;
            var targetScroll = 0;
            var smoothing = false;

            function pointerTarget(clientX) {
                var rect = progress.getBoundingClientRect();
                if (rect.width <= 0) return null;
                var max = maxScroll();
                if (max <= 0) return null;
                var visible = track.clientWidth / track.scrollWidth;
                var thumbW = rect.width * visible;
                // Map pointer so the thumb centre follows the finger/cursor
                var usable = rect.width - thumbW;
                var ratio = usable > 0
                    ? (clientX - rect.left - thumbW / 2) / usable
                    : 0;
                ratio = Math.max(0, Math.min(1, ratio));
                return ratio * max;
            }

            // Eased follow loop: the strip glides toward the finger/cursor
            // instead of snapping pixel-to-pixel on every pointermove.
            function smoothLoop() {
                var diff = targetScroll - track.scrollLeft;
                if (Math.abs(diff) < 0.5) {
                    track.scrollLeft = targetScroll;
                    if (!dragging) { smoothing = false; return; }
                } else {
                    track.scrollLeft += diff * 0.22;
                }
                requestAnimationFrame(smoothLoop);
            }
            function startSmoothing() {
                if (smoothing) return;
                smoothing = true;
                requestAnimationFrame(smoothLoop);
            }

            progress.addEventListener('pointerdown', function(e) {
                dragging = true;
                progress.classList.add('dragging');
                progress.setPointerCapture(e.pointerId);
                var prevBehavior = track.style.scrollBehavior;
                track.style.scrollBehavior = 'auto';
                track.style.scrollSnapType = 'none';
                progress._prevBehavior = prevBehavior;
                var t = pointerTarget(e.clientX);
                if (t !== null) { targetScroll = t; startSmoothing(); }
                e.preventDefault();
            });
            progress.addEventListener('pointermove', function(e) {
                if (!dragging) return;
                var t = pointerTarget(e.clientX);
                if (t !== null) { targetScroll = t; startSmoothing(); }
            });
            function endDrag(e) {
                if (!dragging) return;
                dragging = false;
                progress.classList.remove('dragging');
                if (e.pointerId !== undefined && progress.hasPointerCapture(e.pointerId)) {
                    progress.releasePointerCapture(e.pointerId);
                }
                // let the smoothing loop finish gliding to the last target,
                // then restore the track's normal scroll behaviour
                var restore = function() {
                    if (smoothing) { requestAnimationFrame(restore); return; }
                    track.style.scrollBehavior = progress._prevBehavior || '';
                    track.style.scrollSnapType = '';
                };
                restore();
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

    /* -- App dock: jump + scrollspy ------------------------------ */
    (function() {
        var pills = Array.prototype.slice.call(document.querySelectorAll('.dock-pill'));
        var chapters = Array.prototype.slice.call(document.querySelectorAll('.chapter[data-app]'));
        if (!pills.length || !chapters.length) return;

        var dockWrap = document.querySelector('.app-dock-wrap');

        function offsetY() {
            var navH = document.querySelector('nav.site-nav').offsetHeight;
            var dockH = dockWrap ? dockWrap.offsetHeight : 0;
            return navH + dockH + 4;
        }

        function jumpTo(app) {
            var target = chapters.find(function(c) { return c.getAttribute('data-app') === app; });
            if (!target) return;
            var y = target.getBoundingClientRect().top + window.pageYOffset - offsetY() + 1;
            window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
        }

        pills.forEach(function(pill) {
            pill.addEventListener('click', function() {
                jumpTo(pill.getAttribute('data-app'));
            });
        });

        var lastActive = null;
        function setActive(app) {
            var activePill = null;
            pills.forEach(function(p) {
                var on = p.getAttribute('data-app') === app;
                p.classList.toggle('active', on);
                if (on) activePill = p;
            });
            // Keep the active pill visible in the horizontal strip (mobile overflow).
            if (activePill && app !== lastActive) {
                var dock = activePill.parentNode;
                var target = activePill.offsetLeft - (dock.clientWidth - activePill.offsetWidth) / 2;
                dock.scrollTo({ left: Math.max(0, target), behavior: 'smooth' });
            }
            lastActive = app;
        }

        // Scrollspy: pick the chapter whose top is closest above the dock line
        var spyPending = false;
        function spy() {
            var line = offsetY() + 60;
            var current = null;
            for (var i = 0; i < chapters.length; i++) {
                var r = chapters[i].getBoundingClientRect();
                if (r.top <= line && r.bottom > line) { current = chapters[i]; break; }
            }
            if (current) setActive(current.getAttribute('data-app'));
            else setActive(null);
        }
        window.addEventListener('scroll', function() {
            if (spyPending) return;
            spyPending = true;
            requestAnimationFrame(function() { spyPending = false; spy(); });
        }, { passive: true });
        spy();

        // Deep links: #vault, #moveproof, ...
        function fromHash() {
            var h = (location.hash || '').replace('#', '').toLowerCase();
            if (h && chapters.some(function(c) { return c.getAttribute('data-app') === h; })) {
                setTimeout(function() { jumpTo(h); }, 50);
            }
        }
        window.addEventListener('hashchange', fromHash);
        fromHash();
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
