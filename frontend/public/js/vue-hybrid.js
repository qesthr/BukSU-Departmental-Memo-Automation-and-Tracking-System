(function initHybridVue(window, document) {
    'use strict';

    const namespace = 'EJSHybridVue';
    const dataAppKey = 'vueApp';
    const mountedFlag = '__vue_app__';
    const registry = Object.create(null);

    function decodeValue(value) {
        if (typeof value !== 'string') { return value; }
        const trimmed = value.trim();
        if (trimmed === '') { return ''; }
        if (trimmed === 'true') { return true; }
        if (trimmed === 'false') { return false; }
        if (trimmed === 'null') { return null; }
        if (trimmed === 'undefined') { return undefined; }
        if (!Number.isNaN(Number(trimmed))) { return Number(trimmed); }
        try {
            return JSON.parse(trimmed);
        } catch {
            return value;
        }
    }

    function buildProps(dataset) {
        const props = {};
        for (const [key, rawValue] of Object.entries(dataset)) {
            if (key === dataAppKey) { continue; }
            if (key === 'vueProps') {
                const parsed = decodeValue(rawValue);
                if (parsed && typeof parsed === 'object') {
                    Object.assign(props, parsed);
                }
                continue;
            }
            props[key] = decodeValue(rawValue);
        }
        return props;
    }

    function resolveComponent(entry, context) {
        if (!entry) { return null; }
        if (typeof entry === 'function') {
            return entry(context);
        }
        return entry;
    }

    function mountElement(el) {
        if (!window.Vue || typeof window.Vue.createApp !== 'function') {
            console.warn('[Vue Hybrid] Vue global build is not available. Ensure the CDN script loads correctly.');
            return;
        }
        if (!el || el[mountedFlag]) { return; }
        const appName = el.dataset[dataAppKey];
        if (!appName) { return; }
        const entry = registry[appName];
        if (!entry) {
            console.warn(`[Vue Hybrid] No Vue app registered for "${appName}". Call EJSHybridVue.register("${appName}", component).`);
            return;
        }

        const props = buildProps(el.dataset);
        const component = resolveComponent(entry, { props, el, Vue: window.Vue });

        if (!component) {
            console.warn(`[Vue Hybrid] Component factory for "${appName}" did not return a component.`);
            return;
        }

        const app = window.Vue.createApp(component, props);
        app.provide('initialProps', props);
        app.config.globalProperties.$initialProps = props;
        app.mount(el);
        el[mountedFlag] = app;
    }

    function mountAll(root) {
        const scope = root || document;
        scope.querySelectorAll('[data-vue-app]').forEach((el) => {
            if (!el[mountedFlag]) {
                mountElement(el);
            }
        });
    }

    function unmount(el) {
        if (el && el[mountedFlag]) {
            el[mountedFlag].unmount();
            delete el[mountedFlag];
        }
    }

    window[namespace] = {
        register(appName, componentOrFactory) {
            if (!appName) {
                throw new Error('[Vue Hybrid] register() requires a unique app name.');
            }
            registry[appName] = componentOrFactory;
            if (document.readyState === 'complete' || document.readyState === 'interactive') {
                mountAll();
            }
        },
        mount(root) {
            mountAll(root);
        },
        unmount
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => mountAll());
    } else {
        mountAll();
    }
})(window, document);

