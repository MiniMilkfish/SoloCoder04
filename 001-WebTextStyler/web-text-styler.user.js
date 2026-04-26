// ==UserScript==
// @name         Web Text Styler
// @namespace    http://tampermonkey.net/
// @version      2.1.0
// @description  专业网页文本样式美化工具，基于专业排版规则，提供多级标题、行宽控制、段间距、统一背景色、护眼墨绿色主题、亮暗模式等功能
// @author       WebTextStyler
// @match        *://*/*
// @grant        GM_addStyle
// @grant        GM_registerMenuCommand
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addValueChangeListener
// ==/UserScript==

(function() {
    'use strict';

    const defaultConfig = {
        fontSize: 22,
        lineHeight: 1.5,
        letterSpacing: 0.5,
        wordSpacing: 1,
        fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", "Liberation Sans", sans-serif',

        h1Scale: 1.9,
        h2Scale: 1.5,
        h3Scale: 1.25,
        h4Scale: 1.15,
        smallScale: 0.75,

        paragraphMargin: 1.0,
        paragraphSpacing: 0.5,

        lineWidthMode: 'pixels',
        lineWidthChars: 45,
        lineWidthPx: 900,
        maxLineWidthPx: 1100,

        textColor: '#e8e8e8',
        bgColor: '#264d39',
        contentBgColor: '#2a5540',
        highlightColor: '#fff3cd',
        highlightOpacity: 0.8,

        darkMode: false,
        darkTextColor: '#f5f5dc',
        darkBgColor: '#1a1a2e',
        darkContentBgColor: '#16213e',
        darkLinkColor: '#87ceeb',

        darkTextColorAlt: '#fffacd',
        darkBgColorAlt: '#2d2d2d',
        darkContentBgColorAlt: '#3d3d3d',

        linkColor: '#8ad0b5',
        linkHoverColor: '#a5e0cb',

        simplifyPage: false,
        usePt: false,
        enableCustomBg: true
    };

    let config = Object.assign({}, defaultConfig);
    let highlightedElements = [];
    let isHighlightMode = false;
    let isControlPanelVisible = false;

    function ptToPx(pt) {
        return pt * 1.3333;
    }

    function getFontSizePx() {
        return config.usePt ? ptToPx(config.fontSize) : config.fontSize;
    }

    function loadConfig() {
        const savedConfig = GM_getValue('webTextStylerConfig');
        if (savedConfig) {
            config = Object.assign({}, defaultConfig, JSON.parse(savedConfig));
        }
    }

    function saveConfig() {
        GM_setValue('webTextStylerConfig', JSON.stringify(config));
    }

    function createControlPanel() {
        if (document.getElementById('web-text-styler-panel')) {
            return;
        }

        const panel = document.createElement('div');
        panel.id = 'web-text-styler-panel';
        panel.className = 'web-text-styler-hidden';

        panel.innerHTML = `
            <div class="wts-header">
                <h3>Web Text Styler</h3>
                <button class="wts-close-btn">&times;</button>
            </div>
            <div class="wts-content">
                <div class="wts-section">
                    <h4>正文字体</h4>
                    <div class="wts-control">
                        <label for="wts-font-size">字体大小: <span id="wts-font-size-value">${config.fontSize}${config.usePt ? 'pt' : 'px'}</span></label>
                        <input type="range" id="wts-font-size" min="10" max="48" value="${config.fontSize}" step="1">
                    </div>
                    <div class="wts-control wts-toggle">
                        <label>
                            <input type="checkbox" id="wts-use-pt" ${config.usePt ? 'checked' : ''}>
                            <span>使用pt单位</span>
                        </label>
                    </div>
                    <div class="wts-control">
                        <label for="wts-line-height">行高: <span id="wts-line-height-value">${config.lineHeight}</span></label>
                        <input type="range" id="wts-line-height" min="1.0" max="2.0" value="${config.lineHeight}" step="0.05">
                    </div>
                    <div class="wts-control">
                        <label for="wts-letter-spacing">字间距: <span id="wts-letter-spacing-value">${config.letterSpacing}px</span></label>
                        <input type="range" id="wts-letter-spacing" min="-2" max="5" value="${config.letterSpacing}" step="0.5">
                    </div>
                    <div class="wts-control">
                        <label for="wts-word-spacing">词间距: <span id="wts-word-spacing-value">${config.wordSpacing}px</span></label>
                        <input type="range" id="wts-word-spacing" min="-2" max="10" value="${config.wordSpacing}" step="0.5">
                    </div>
                </div>

                <div class="wts-section">
                    <h4>标题层级</h4>
                    <div class="wts-control">
                        <label for="wts-h1-scale">一级标题 (H1): <span id="wts-h1-scale-value">${config.h1Scale}x</span></label>
                        <input type="range" id="wts-h1-scale" min="1.5" max="2.5" value="${config.h1Scale}" step="0.1">
                    </div>
                    <div class="wts-control">
                        <label for="wts-h2-scale">二级标题 (H2): <span id="wts-h2-scale-value">${config.h2Scale}x</span></label>
                        <input type="range" id="wts-h2-scale" min="1.2" max="2.0" value="${config.h2Scale}" step="0.1">
                    </div>
                    <div class="wts-control">
                        <label for="wts-h3-scale">三级标题 (H3): <span id="wts-h3-scale-value">${config.h3Scale}x</span></label>
                        <input type="range" id="wts-h3-scale" min="1.0" max="1.5" value="${config.h3Scale}" step="0.05">
                    </div>
                    <div class="wts-control">
                        <label for="wts-h4-scale">四级标题 (H4): <span id="wts-h4-scale-value">${config.h4Scale}x</span></label>
                        <input type="range" id="wts-h4-scale" min="1.0" max="1.3" value="${config.h4Scale}" step="0.05">
                    </div>
                    <div class="wts-control">
                        <label for="wts-small-scale">小字体/注释: <span id="wts-small-scale-value">${config.smallScale}x</span></label>
                        <input type="range" id="wts-small-scale" min="0.6" max="0.9" value="${config.smallScale}" step="0.05">
                    </div>
                </div>

                <div class="wts-section">
                    <h4>段落间距</h4>
                    <div class="wts-control">
                        <label for="wts-paragraph-margin">段前/段后间距: <span id="wts-paragraph-margin-value">${config.paragraphMargin}em</span></label>
                        <input type="range" id="wts-paragraph-margin" min="0" max="2.0" value="${config.paragraphMargin}" step="0.1">
                    </div>
                    <div class="wts-control">
                        <label for="wts-paragraph-spacing">行内行间: <span id="wts-paragraph-spacing-value">${config.paragraphSpacing}em</span></label>
                        <input type="range" id="wts-paragraph-spacing" min="0" max="1.0" value="${config.paragraphSpacing}" step="0.05">
                    </div>
                </div>

                <div class="wts-section">
                    <h4>行宽控制</h4>
                    <div class="wts-control">
                        <label>行宽模式:</label>
                        <div class="wts-radio-group">
                            <label class="wts-radio">
                                <input type="radio" name="wts-line-width-mode" value="chars" ${config.lineWidthMode === 'chars' ? 'checked' : ''}>
                                <span>按字符数</span>
                            </label>
                            <label class="wts-radio">
                                <input type="radio" name="wts-line-width-mode" value="pixels" ${config.lineWidthMode === 'pixels' ? 'checked' : ''}>
                                <span>按像素</span>
                            </label>
                            <label class="wts-radio">
                                <input type="radio" name="wts-line-width-mode" value="none" ${config.lineWidthMode === 'none' ? 'checked' : ''}>
                                <span>不限制</span>
                            </label>
                        </div>
                    </div>
                    <div class="wts-control" id="wts-line-width-chars-control">
                        <label for="wts-line-width-chars">每行字符数: <span id="wts-line-width-chars-value">${config.lineWidthChars}</span></label>
                        <input type="range" id="wts-line-width-chars" min="30" max="70" value="${config.lineWidthChars}" step="1">
                    </div>
                    <div class="wts-control" id="wts-line-width-px-control">
                        <label for="wts-line-width-px">行宽(px): <span id="wts-line-width-px-value">${config.lineWidthPx}px</span></label>
                        <input type="range" id="wts-line-width-px" min="600" max="1200" value="${config.lineWidthPx}" step="50">
                    </div>
                    <div class="wts-control">
                        <label for="wts-max-line-width-px">最大行宽: <span id="wts-max-line-width-px-value">${config.maxLineWidthPx}px</span></label>
                        <input type="range" id="wts-max-line-width-px" min="700" max="1400" value="${config.maxLineWidthPx}" step="50">
                    </div>
                </div>

                <div class="wts-section">
                    <h4>颜色设置</h4>
                    <div class="wts-control wts-toggle">
                        <label>
                            <input type="checkbox" id="wts-enable-custom-bg" ${config.enableCustomBg ? 'checked' : ''}>
                            <span>启用自定义背景色</span>
                        </label>
                    </div>
                    <div class="wts-control">
                        <label for="wts-text-color">文字颜色:</label>
                        <input type="color" id="wts-text-color" value="${config.textColor}">
                    </div>
                    <div class="wts-control">
                        <label for="wts-bg-color">背景颜色:</label>
                        <input type="color" id="wts-bg-color" value="${config.bgColor}">
                    </div>
                    <div class="wts-control">
                        <label for="wts-content-bg-color">内容区背景:</label>
                        <input type="color" id="wts-content-bg-color" value="${config.contentBgColor}">
                    </div>
                    <div class="wts-control">
                        <label for="wts-link-color">链接颜色:</label>
                        <input type="color" id="wts-link-color" value="${config.linkColor}">
                    </div>
                    <div class="wts-control">
                        <label for="wts-link-hover-color">链接悬停颜色:</label>
                        <input type="color" id="wts-link-hover-color" value="${config.linkHoverColor}">
                    </div>
                </div>

                <div class="wts-section">
                    <h4>显示模式</h4>
                    <div class="wts-control wts-toggle">
                        <label>
                            <input type="checkbox" id="wts-dark-mode" ${config.darkMode ? 'checked' : ''}>
                            <span>暗色模式</span>
                        </label>
                    </div>
                    <div class="wts-control">
                        <label for="wts-dark-text-color">暗色 - 文字颜色:</label>
                        <input type="color" id="wts-dark-text-color" value="${config.darkTextColor}">
                    </div>
                    <div class="wts-control">
                        <label for="wts-dark-bg-color">暗色 - 背景颜色:</label>
                        <input type="color" id="wts-dark-bg-color" value="${config.darkBgColor}">
                    </div>
                    <div class="wts-control">
                        <label for="wts-dark-content-bg-color">暗色 - 内容区背景:</label>
                        <input type="color" id="wts-dark-content-bg-color" value="${config.darkContentBgColor}">
                    </div>
                    <div class="wts-control">
                        <label for="wts-dark-link-color">暗色 - 链接颜色:</label>
                        <input type="color" id="wts-dark-link-color" value="${config.darkLinkColor}">
                    </div>
                </div>

                <div class="wts-section">
                    <h4>高亮设置</h4>
                    <div class="wts-control">
                        <label for="wts-highlight-color">高亮颜色:</label>
                        <input type="color" id="wts-highlight-color" value="${config.highlightColor}">
                    </div>
                    <div class="wts-control">
                        <label for="wts-highlight-opacity">高亮透明度: <span id="wts-highlight-opacity-value">${Math.round(config.highlightOpacity * 100)}%</span></label>
                        <input type="range" id="wts-highlight-opacity" min="0.1" max="1" value="${config.highlightOpacity}" step="0.1">
                    </div>
                    <button id="wts-toggle-highlight-mode" class="wts-btn">${isHighlightMode ? '退出高亮模式' : '进入高亮模式'}</button>
                    <button id="wts-clear-highlights" class="wts-btn wts-btn-secondary">清除所有高亮</button>
                </div>

                <div class="wts-section">
                    <h4>页面简化</h4>
                    <div class="wts-control wts-toggle">
                        <label>
                            <input type="checkbox" id="wts-simplify-page" ${config.simplifyPage ? 'checked' : ''}>
                            <span>简化页面（隐藏广告和无关元素）</span>
                        </label>
                    </div>
                </div>

                <div class="wts-section">
                    <button id="wts-reset-default" class="wts-btn wts-btn-danger">恢复默认设置</button>
                </div>
            </div>
        `;

        addPanelStyles();
        document.body.appendChild(panel);
        bindPanelEvents();
    }

    function addPanelStyles() {
        GM_addStyle(`
            #web-text-styler-panel {
                position: fixed;
                top: 20px;
                right: 20px;
                width: 360px;
                max-height: 90vh;
                background: #ffffff !important;
                border-radius: 8px;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
                z-index: 999999;
                font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
                font-size: 14px;
                color: #333333 !important;
                overflow-y: auto;
                transition: all 0.3s ease;
            }

            .web-text-styler-hidden {
                display: none !important;
            }

            #web-text-styler-panel .wts-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 12px 16px;
                border-bottom: 1px solid #e0e0e0;
                background: #f8f9fa !important;
                border-radius: 8px 8px 0 0;
            }

            #web-text-styler-panel .wts-header h3 {
                margin: 0;
                font-size: 16px;
                font-weight: 600;
                color: #333333 !important;
            }

            #web-text-styler-panel .wts-close-btn {
                background: none;
                border: none;
                font-size: 24px;
                cursor: pointer;
                color: #666666 !important;
                padding: 0;
                line-height: 1;
            }

            #web-text-styler-panel .wts-close-btn:hover {
                color: #333333 !important;
            }

            #web-text-styler-panel .wts-content {
                padding: 16px;
                background: #ffffff !important;
            }

            #web-text-styler-panel .wts-section {
                margin-bottom: 20px;
            }

            #web-text-styler-panel .wts-section:last-child {
                margin-bottom: 0;
            }

            #web-text-styler-panel .wts-section h4 {
                margin: 0 0 12px 0;
                font-size: 14px;
                font-weight: 600;
                color: #444444 !important;
                padding-bottom: 8px;
                border-bottom: 1px solid #eee;
            }

            #web-text-styler-panel .wts-control {
                margin-bottom: 12px;
            }

            #web-text-styler-panel .wts-control:last-child {
                margin-bottom: 0;
            }

            #web-text-styler-panel .wts-control label {
                display: block;
                margin-bottom: 6px;
                font-size: 13px;
                color: #555555 !important;
            }

            #web-text-styler-panel .wts-control input[type="range"] {
                width: 100%;
                height: 4px;
                border-radius: 2px;
                background: #e0e0e0 !important;
                outline: none;
                -webkit-appearance: none;
            }

            #web-text-styler-panel .wts-control input[type="range"]::-webkit-slider-thumb {
                -webkit-appearance: none;
                appearance: none;
                width: 16px;
                height: 16px;
                border-radius: 50%;
                background: #4a90d9 !important;
                cursor: pointer;
            }

            #web-text-styler-panel .wts-control input[type="range"]::-moz-range-thumb {
                width: 16px;
                height: 16px;
                border-radius: 50%;
                background: #4a90d9 !important;
                cursor: pointer;
                border: none;
            }

            #web-text-styler-panel .wts-control input[type="color"] {
                width: 60px;
                height: 30px;
                padding: 2px;
                border: 1px solid #ddd;
                border-radius: 4px;
                cursor: pointer;
            }

            #web-text-styler-panel .wts-radio-group {
                display: flex;
                gap: 12px;
                flex-wrap: wrap;
            }

            #web-text-styler-panel .wts-radio {
                display: flex;
                align-items: center;
                cursor: pointer;
                font-size: 13px;
                color: #555555 !important;
            }

            #web-text-styler-panel .wts-radio input {
                margin-right: 4px;
            }

            #web-text-styler-panel .wts-radio span {
                color: #555555 !important;
            }

            #web-text-styler-panel .wts-btn {
                width: 100%;
                padding: 8px 16px;
                background: #4a90d9 !important;
                color: #ffffff !important;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-size: 13px;
                margin-bottom: 8px;
                transition: background 0.2s;
            }

            #web-text-styler-panel .wts-btn:hover {
                background: #3a7bc8 !important;
            }

            #web-text-styler-panel .wts-btn:last-child {
                margin-bottom: 0;
            }

            #web-text-styler-panel .wts-btn-secondary {
                background: #6c757d !important;
            }

            #web-text-styler-panel .wts-btn-secondary:hover {
                background: #5a6268 !important;
            }

            #web-text-styler-panel .wts-btn-danger {
                background: #dc3545 !important;
            }

            #web-text-styler-panel .wts-btn-danger:hover {
                background: #c82333 !important;
            }

            #web-text-styler-panel .wts-toggle label {
                display: flex;
                align-items: center;
                cursor: pointer;
                margin-bottom: 0;
                color: #555555 !important;
            }

            #web-text-styler-panel .wts-toggle label span {
                color: #555555 !important;
            }

            #web-text-styler-panel .wts-toggle input[type="checkbox"] {
                margin-right: 8px;
            }

            #wts-highlight-indicator {
                position: fixed;
                top: 20px;
                right: 20px;
                background: #fff3cd !important;
                color: #856404 !important;
                padding: 8px 16px;
                border-radius: 4px;
                font-size: 14px;
                z-index: 999998;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
            }

            #wts-float-btn {
                position: fixed;
                bottom: 20px;
                right: 20px;
                width: 50px;
                height: 50px;
                background: #4a90d9 !important;
                color: #ffffff !important;
                border: none;
                border-radius: 50%;
                font-size: 24px;
                cursor: pointer;
                z-index: 999997;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
                transition: all 0.3s;
                display: flex;
                align-items: center;
                justify-content: center;
            }

            #wts-float-btn:hover {
                background: #3a7bc8 !important;
                transform: scale(1.1);
            }

            #web-text-styler-panel *,
            #wts-highlight-indicator,
            #wts-float-btn {
                box-sizing: border-box;
            }
        `);
    }

    function bindPanelEvents() {
        const panel = document.getElementById('web-text-styler-panel');

        panel.querySelector('.wts-close-btn').addEventListener('click', () => {
            toggleControlPanel(false);
        });

        const fontSizeSlider = document.getElementById('wts-font-size');
        const fontSizeValue = document.getElementById('wts-font-size-value');
        fontSizeSlider.addEventListener('input', (e) => {
            config.fontSize = parseInt(e.target.value);
            fontSizeValue.textContent = `${config.fontSize}${config.usePt ? 'pt' : 'px'}`;
            applyTextStyles();
            saveConfig();
        });

        const usePtCheckbox = document.getElementById('wts-use-pt');
        usePtCheckbox.addEventListener('change', (e) => {
            config.usePt = e.target.checked;
            fontSizeValue.textContent = `${config.fontSize}${config.usePt ? 'pt' : 'px'}`;
            applyTextStyles();
            saveConfig();
        });

        const lineHeightSlider = document.getElementById('wts-line-height');
        const lineHeightValue = document.getElementById('wts-line-height-value');
        lineHeightSlider.addEventListener('input', (e) => {
            config.lineHeight = parseFloat(e.target.value);
            lineHeightValue.textContent = config.lineHeight;
            applyTextStyles();
            saveConfig();
        });

        const letterSpacingSlider = document.getElementById('wts-letter-spacing');
        const letterSpacingValue = document.getElementById('wts-letter-spacing-value');
        letterSpacingSlider.addEventListener('input', (e) => {
            config.letterSpacing = parseFloat(e.target.value);
            letterSpacingValue.textContent = `${config.letterSpacing}px`;
            applyTextStyles();
            saveConfig();
        });

        const wordSpacingSlider = document.getElementById('wts-word-spacing');
        const wordSpacingValue = document.getElementById('wts-word-spacing-value');
        wordSpacingSlider.addEventListener('input', (e) => {
            config.wordSpacing = parseFloat(e.target.value);
            wordSpacingValue.textContent = `${config.wordSpacing}px`;
            applyTextStyles();
            saveConfig();
        });

        const h1ScaleSlider = document.getElementById('wts-h1-scale');
        const h1ScaleValue = document.getElementById('wts-h1-scale-value');
        h1ScaleSlider.addEventListener('input', (e) => {
            config.h1Scale = parseFloat(e.target.value);
            h1ScaleValue.textContent = `${config.h1Scale}x`;
            applyTextStyles();
            saveConfig();
        });

        const h2ScaleSlider = document.getElementById('wts-h2-scale');
        const h2ScaleValue = document.getElementById('wts-h2-scale-value');
        h2ScaleSlider.addEventListener('input', (e) => {
            config.h2Scale = parseFloat(e.target.value);
            h2ScaleValue.textContent = `${config.h2Scale}x`;
            applyTextStyles();
            saveConfig();
        });

        const h3ScaleSlider = document.getElementById('wts-h3-scale');
        const h3ScaleValue = document.getElementById('wts-h3-scale-value');
        h3ScaleSlider.addEventListener('input', (e) => {
            config.h3Scale = parseFloat(e.target.value);
            h3ScaleValue.textContent = `${config.h3Scale}x`;
            applyTextStyles();
            saveConfig();
        });

        const h4ScaleSlider = document.getElementById('wts-h4-scale');
        const h4ScaleValue = document.getElementById('wts-h4-scale-value');
        h4ScaleSlider.addEventListener('input', (e) => {
            config.h4Scale = parseFloat(e.target.value);
            h4ScaleValue.textContent = `${config.h4Scale}x`;
            applyTextStyles();
            saveConfig();
        });

        const smallScaleSlider = document.getElementById('wts-small-scale');
        const smallScaleValue = document.getElementById('wts-small-scale-value');
        smallScaleSlider.addEventListener('input', (e) => {
            config.smallScale = parseFloat(e.target.value);
            smallScaleValue.textContent = `${config.smallScale}x`;
            applyTextStyles();
            saveConfig();
        });

        const paragraphMarginSlider = document.getElementById('wts-paragraph-margin');
        const paragraphMarginValue = document.getElementById('wts-paragraph-margin-value');
        paragraphMarginSlider.addEventListener('input', (e) => {
            config.paragraphMargin = parseFloat(e.target.value);
            paragraphMarginValue.textContent = `${config.paragraphMargin}em`;
            applyTextStyles();
            saveConfig();
        });

        const paragraphSpacingSlider = document.getElementById('wts-paragraph-spacing');
        const paragraphSpacingValue = document.getElementById('wts-paragraph-spacing-value');
        paragraphSpacingSlider.addEventListener('input', (e) => {
            config.paragraphSpacing = parseFloat(e.target.value);
            paragraphSpacingValue.textContent = `${config.paragraphSpacing}em`;
            applyTextStyles();
            saveConfig();
        });

        const lineWidthModeRadios = document.querySelectorAll('input[name="wts-line-width-mode"]');
        lineWidthModeRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                config.lineWidthMode = e.target.value;
                updateLineWidthControls();
                applyTextStyles();
                saveConfig();
            });
        });

        const lineWidthCharsSlider = document.getElementById('wts-line-width-chars');
        const lineWidthCharsValue = document.getElementById('wts-line-width-chars-value');
        lineWidthCharsSlider.addEventListener('input', (e) => {
            config.lineWidthChars = parseInt(e.target.value);
            lineWidthCharsValue.textContent = config.lineWidthChars;
            applyTextStyles();
            saveConfig();
        });

        const lineWidthPxSlider = document.getElementById('wts-line-width-px');
        const lineWidthPxValue = document.getElementById('wts-line-width-px-value');
        lineWidthPxSlider.addEventListener('input', (e) => {
            config.lineWidthPx = parseInt(e.target.value);
            lineWidthPxValue.textContent = `${config.lineWidthPx}px`;
            applyTextStyles();
            saveConfig();
        });

        const maxLineWidthPxSlider = document.getElementById('wts-max-line-width-px');
        const maxLineWidthPxValue = document.getElementById('wts-max-line-width-px-value');
        maxLineWidthPxSlider.addEventListener('input', (e) => {
            config.maxLineWidthPx = parseInt(e.target.value);
            maxLineWidthPxValue.textContent = `${config.maxLineWidthPx}px`;
            applyTextStyles();
            saveConfig();
        });

        const enableCustomBgCheckbox = document.getElementById('wts-enable-custom-bg');
        enableCustomBgCheckbox.addEventListener('change', (e) => {
            config.enableCustomBg = e.target.checked;
            applyTextStyles();
            if (config.enableCustomBg) {
                applyInlineStyles();
            }
            saveConfig();
        });

        const textColorInput = document.getElementById('wts-text-color');
        textColorInput.addEventListener('change', (e) => {
            config.textColor = e.target.value;
            applyTextStyles();
            saveConfig();
        });

        const bgColorInput = document.getElementById('wts-bg-color');
        bgColorInput.addEventListener('change', (e) => {
            config.bgColor = e.target.value;
            applyTextStyles();
            saveConfig();
        });

        const contentBgColorInput = document.getElementById('wts-content-bg-color');
        contentBgColorInput.addEventListener('change', (e) => {
            config.contentBgColor = e.target.value;
            applyTextStyles();
            saveConfig();
        });

        const linkColorInput = document.getElementById('wts-link-color');
        linkColorInput.addEventListener('change', (e) => {
            config.linkColor = e.target.value;
            applyTextStyles();
            saveConfig();
        });

        const linkHoverColorInput = document.getElementById('wts-link-hover-color');
        linkHoverColorInput.addEventListener('change', (e) => {
            config.linkHoverColor = e.target.value;
            applyTextStyles();
            saveConfig();
        });

        const darkModeCheckbox = document.getElementById('wts-dark-mode');
        darkModeCheckbox.addEventListener('change', (e) => {
            config.darkMode = e.target.checked;
            applyTextStyles();
            saveConfig();
        });

        const darkTextColorInput = document.getElementById('wts-dark-text-color');
        darkTextColorInput.addEventListener('change', (e) => {
            config.darkTextColor = e.target.value;
            if (config.darkMode) {
                applyTextStyles();
            }
            saveConfig();
        });

        const darkBgColorInput = document.getElementById('wts-dark-bg-color');
        darkBgColorInput.addEventListener('change', (e) => {
            config.darkBgColor = e.target.value;
            if (config.darkMode) {
                applyTextStyles();
            }
            saveConfig();
        });

        const darkContentBgColorInput = document.getElementById('wts-dark-content-bg-color');
        darkContentBgColorInput.addEventListener('change', (e) => {
            config.darkContentBgColor = e.target.value;
            if (config.darkMode) {
                applyTextStyles();
            }
            saveConfig();
        });

        const darkLinkColorInput = document.getElementById('wts-dark-link-color');
        darkLinkColorInput.addEventListener('change', (e) => {
            config.darkLinkColor = e.target.value;
            if (config.darkMode) {
                applyTextStyles();
            }
            saveConfig();
        });

        const highlightColorInput = document.getElementById('wts-highlight-color');
        highlightColorInput.addEventListener('change', (e) => {
            config.highlightColor = e.target.value;
            saveConfig();
        });

        const highlightOpacitySlider = document.getElementById('wts-highlight-opacity');
        const highlightOpacityValue = document.getElementById('wts-highlight-opacity-value');
        highlightOpacitySlider.addEventListener('input', (e) => {
            config.highlightOpacity = parseFloat(e.target.value);
            highlightOpacityValue.textContent = `${Math.round(config.highlightOpacity * 100)}%`;
            saveConfig();
        });

        document.getElementById('wts-toggle-highlight-mode').addEventListener('click', () => {
            toggleHighlightMode();
        });

        document.getElementById('wts-clear-highlights').addEventListener('click', () => {
            clearAllHighlights();
        });

        const simplifyPageCheckbox = document.getElementById('wts-simplify-page');
        simplifyPageCheckbox.addEventListener('change', (e) => {
            config.simplifyPage = e.target.checked;
            applySimplifyPage();
            saveConfig();
        });

        document.getElementById('wts-reset-default').addEventListener('click', () => {
            config = Object.assign({}, defaultConfig);
            updatePanelFromConfig();
            applyTextStyles();
            applySimplifyPage();
            saveConfig();
        });

        updateLineWidthControls();
    }

    function updateLineWidthControls() {
        const charsControl = document.getElementById('wts-line-width-chars-control');
        const pxControl = document.getElementById('wts-line-width-px-control');

        if (config.lineWidthMode === 'chars') {
            charsControl.style.display = 'block';
            pxControl.style.display = 'none';
        } else if (config.lineWidthMode === 'pixels') {
            charsControl.style.display = 'none';
            pxControl.style.display = 'block';
        } else {
            charsControl.style.display = 'none';
            pxControl.style.display = 'none';
        }
    }

    function updatePanelFromConfig() {
        document.getElementById('wts-font-size').value = config.fontSize;
        document.getElementById('wts-font-size-value').textContent = `${config.fontSize}${config.usePt ? 'pt' : 'px'}`;
        document.getElementById('wts-use-pt').checked = config.usePt;

        document.getElementById('wts-line-height').value = config.lineHeight;
        document.getElementById('wts-line-height-value').textContent = config.lineHeight;

        document.getElementById('wts-letter-spacing').value = config.letterSpacing;
        document.getElementById('wts-letter-spacing-value').textContent = `${config.letterSpacing}px`;

        document.getElementById('wts-word-spacing').value = config.wordSpacing;
        document.getElementById('wts-word-spacing-value').textContent = `${config.wordSpacing}px`;

        document.getElementById('wts-h1-scale').value = config.h1Scale;
        document.getElementById('wts-h1-scale-value').textContent = `${config.h1Scale}x`;

        document.getElementById('wts-h2-scale').value = config.h2Scale;
        document.getElementById('wts-h2-scale-value').textContent = `${config.h2Scale}x`;

        document.getElementById('wts-h3-scale').value = config.h3Scale;
        document.getElementById('wts-h3-scale-value').textContent = `${config.h3Scale}x`;

        document.getElementById('wts-h4-scale').value = config.h4Scale;
        document.getElementById('wts-h4-scale-value').textContent = `${config.h4Scale}x`;

        document.getElementById('wts-small-scale').value = config.smallScale;
        document.getElementById('wts-small-scale-value').textContent = `${config.smallScale}x`;

        document.getElementById('wts-paragraph-margin').value = config.paragraphMargin;
        document.getElementById('wts-paragraph-margin-value').textContent = `${config.paragraphMargin}em`;

        document.getElementById('wts-paragraph-spacing').value = config.paragraphSpacing;
        document.getElementById('wts-paragraph-spacing-value').textContent = `${config.paragraphSpacing}em`;

        const lineWidthModeRadios = document.querySelectorAll('input[name="wts-line-width-mode"]');
        lineWidthModeRadios.forEach(radio => {
            radio.checked = (radio.value === config.lineWidthMode);
        });

        document.getElementById('wts-line-width-chars').value = config.lineWidthChars;
        document.getElementById('wts-line-width-chars-value').textContent = config.lineWidthChars;

        document.getElementById('wts-line-width-px').value = config.lineWidthPx;
        document.getElementById('wts-line-width-px-value').textContent = `${config.lineWidthPx}px`;

        document.getElementById('wts-max-line-width-px').value = config.maxLineWidthPx;
        document.getElementById('wts-max-line-width-px-value').textContent = `${config.maxLineWidthPx}px`;

        document.getElementById('wts-enable-custom-bg').checked = config.enableCustomBg;
        document.getElementById('wts-text-color').value = config.textColor;
        document.getElementById('wts-bg-color').value = config.bgColor;
        document.getElementById('wts-content-bg-color').value = config.contentBgColor;
        document.getElementById('wts-link-color').value = config.linkColor;
        document.getElementById('wts-link-hover-color').value = config.linkHoverColor;

        document.getElementById('wts-dark-mode').checked = config.darkMode;
        document.getElementById('wts-dark-text-color').value = config.darkTextColor;
        document.getElementById('wts-dark-bg-color').value = config.darkBgColor;
        document.getElementById('wts-dark-content-bg-color').value = config.darkContentBgColor;
        document.getElementById('wts-dark-link-color').value = config.darkLinkColor;

        document.getElementById('wts-highlight-color').value = config.highlightColor;
        document.getElementById('wts-highlight-opacity').value = config.highlightOpacity;
        document.getElementById('wts-highlight-opacity-value').textContent = `${Math.round(config.highlightOpacity * 100)}%`;

        document.getElementById('wts-simplify-page').checked = config.simplifyPage;

        document.getElementById('wts-toggle-highlight-mode').textContent = isHighlightMode ? '退出高亮模式' : '进入高亮模式';

        updateLineWidthControls();
    }

    function calculateLineWidth() {
        const fontSizePx = getFontSizePx();

        if (config.lineWidthMode === 'chars') {
            const avgCharWidth = fontSizePx * 0.6;
            return Math.min(config.lineWidthChars * avgCharWidth, config.maxLineWidthPx);
        } else if (config.lineWidthMode === 'pixels') {
            return Math.min(config.lineWidthPx, config.maxLineWidthPx);
        }
        return config.maxLineWidthPx;
    }

    function applyTextStyles() {
        const oldStyle = document.getElementById('wts-text-styles');
        if (oldStyle) {
            oldStyle.remove();
        }

        const fontSizePx = getFontSizePx();
        const lineWidth = calculateLineWidth();

        const textColor = config.darkMode ? config.darkTextColor : config.textColor;
        const bgColor = config.darkMode ? config.darkBgColor : config.bgColor;
        const contentBgColor = config.darkMode ? config.darkContentBgColor : config.contentBgColor;
        const linkColor = config.darkMode ? config.darkLinkColor : config.linkColor;
        const linkHoverColor = config.linkHoverColor;

        const style = document.createElement('style');
        style.id = 'wts-text-styles';

        let styleContent = `
            body, p, li, span, div, article, section, main, aside, td, th,
            .post-body, .article-body, .entry-content, .post-content, .article-content {
                font-size: ${fontSizePx}px !important;
                line-height: ${config.lineHeight} !important;
                letter-spacing: ${config.letterSpacing}px !important;
                word-spacing: ${config.wordSpacing}px !important;
                font-family: ${config.fontFamily} !important;
            }

            p, ul, ol, dl, blockquote, pre {
                margin-top: ${config.paragraphMargin}em !important;
                margin-bottom: ${config.paragraphMargin}em !important;
            }

            p + p {
                margin-top: ${config.paragraphSpacing}em !important;
            }

            h1 {
                font-size: ${fontSizePx * config.h1Scale}px !important;
                line-height: 1.2 !important;
                margin-top: ${config.paragraphMargin * 1.5}em !important;
                margin-bottom: ${config.paragraphMargin * 0.8}em !important;
                font-weight: 700 !important;
            }

            h2 {
                font-size: ${fontSizePx * config.h2Scale}px !important;
                line-height: 1.3 !important;
                margin-top: ${config.paragraphMargin * 1.3}em !important;
                margin-bottom: ${config.paragraphMargin * 0.6}em !important;
                font-weight: 600 !important;
            }

            h3 {
                font-size: ${fontSizePx * config.h3Scale}px !important;
                line-height: 1.4 !important;
                margin-top: ${config.paragraphMargin * 1.1}em !important;
                margin-bottom: ${config.paragraphMargin * 0.5}em !important;
                font-weight: 600 !important;
            }

            h4, h5, h6 {
                font-size: ${fontSizePx * config.h4Scale}px !important;
                line-height: 1.4 !important;
                margin-top: ${config.paragraphMargin}em !important;
                margin-bottom: ${config.paragraphMargin * 0.4}em !important;
                font-weight: 600 !important;
            }

            small, .small, [class*="small"], [id*="small"],
            .note, .comment, .caption, figcaption, footer,
            .post-meta, .article-meta, .entry-meta {
                font-size: ${fontSizePx * config.smallScale}px !important;
                line-height: ${config.lineHeight * 1.1} !important;
            }

            blockquote {
                border-left: 4px solid #ddd !important;
                padding-left: 1em !important;
                margin-left: 0 !important;
                font-style: italic !important;
            }

            pre, code {
                font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace !important;
                font-size: ${fontSizePx * 0.9}px !important;
            }

            li {
                margin-bottom: ${config.paragraphSpacing}em !important;
            }

            ul, ol {
                padding-left: 1.5em !important;
            }
        `;

        if (config.lineWidthMode !== 'none') {
            styleContent += `
                main, article, .content, .post, .article,
                .entry-content, .post-content, .article-content,
                .container, .main-content, #content, #main,
                .post-body, .article-body, .page-content,
                .single-content, .entry {
                    max-width: ${lineWidth}px !important;
                    margin-left: auto !important;
                    margin-right: auto !important;
                    padding-left: 20px !important;
                    padding-right: 20px !important;
                }

                p, h1, h2, h3, h4, h5, h6, ul, ol, blockquote, pre {
                    max-width: ${lineWidth}px !important;
                }
            `;
        }

        if (config.enableCustomBg) {
            styleContent += `
                p, span, li, td, th,
                h1, h2, h3, h4, h5, h6,
                blockquote, pre, code,
                label, legend, caption,
                small, em, strong, b, i,
                .title, .heading, .header,
                .text, .content-text {
                    color: ${textColor} !important;
                }

                html, body, #root, #___gatsby,
                #app, #App, #page, #site, #body,
                .app, .App, .page, .site, .body-wrapper {
                    background-color: ${bgColor} !important;
                }

                main, article, section, header, footer, nav, aside,
                #content, #main, #container, #article, #post, #entry, #header, #footer,
                .content, .main-content, .container, .article, .post, .entry, .body,
                .card, .panel, .box, .widget,
                .post-body, .article-body, .page-content,
                .entry-content, .post-content, .article-content,
                .single-content, .main-content {
                    background-color: ${contentBgColor} !important;
                }

                a, a:link, a:visited {
                    color: ${linkColor} !important;
                }

                a:hover, a:focus, a:active {
                    color: ${linkHoverColor} !important;
                }
            `;
        }

        style.textContent = styleContent;
        document.head.appendChild(style);
    }

    function applySimplifyPage() {
        const oldStyle = document.getElementById('wts-simplify-styles');
        if (oldStyle) {
            oldStyle.remove();
        }

        if (config.simplifyPage) {
            const style = document.createElement('style');
            style.id = 'wts-simplify-styles';
            style.textContent = `
                .ad, .ads, .advertisement, .banner, .popup, .modal,
                [class*="ad-"], [class*="-ad"], [id*="ad-"], [id*="-ad"],
                [class*="banner"], [id*="banner"],
                [class*="popup"], [id*="popup"],
                [class*="modal"], [id*="modal"],
                [class*="sidebar"], [id*="sidebar"],
                [class*="widget"], [id*="widget"],
                [class*="social"], [id*="social"],
                [class*="share"], [id*="share"],
                [class*="subscribe"], [id*="subscribe"],
                [class*="newsletter"], [id*="newsletter"],
                [class*="cookie"], [id*="cookie"],
                [class*="consent"], [id*="consent"],
                [class*="sponsored"], [id*="sponsored"],
                [class*="promo"], [id*="promo"],
                [class*="related"], [id*="related"],
                [class*="recommended"], [id*="recommended"],
                [class*="trending"], [id*="trending"] {
                    display: none !important;
                }

                #web-text-styler-panel, #wts-float-btn, #wts-highlight-indicator {
                    display: block !important;
                }
            `;
            document.head.appendChild(style);
        }
    }

    function toggleHighlightMode() {
        isHighlightMode = !isHighlightMode;

        const btn = document.getElementById('wts-toggle-highlight-mode');
        if (btn) {
            btn.textContent = isHighlightMode ? '退出高亮模式' : '进入高亮模式';
        }

        if (isHighlightMode) {
            showHighlightIndicator();
            addHighlightEventListeners();
        } else {
            hideHighlightIndicator();
            removeHighlightEventListeners();
        }
    }

    function showHighlightIndicator() {
        const indicator = document.createElement('div');
        indicator.id = 'wts-highlight-indicator';
        indicator.textContent = '高亮模式：点击文本进行高亮';
        document.body.appendChild(indicator);
    }

    function hideHighlightIndicator() {
        const indicator = document.getElementById('wts-highlight-indicator');
        if (indicator) {
            indicator.remove();
        }
    }

    function addHighlightEventListeners() {
        document.addEventListener('click', handleHighlightClick, true);
    }

    function removeHighlightEventListeners() {
        document.removeEventListener('click', handleHighlightClick, true);
    }

    function handleHighlightClick(e) {
        if (!isHighlightMode) return;

        const target = e.target;
        if (target.closest('#web-text-styler-panel') ||
            target.closest('#wts-float-btn') ||
            target.closest('#wts-highlight-indicator')) {
            return;
        }

        e.preventDefault();
        e.stopPropagation();

        let selection = window.getSelection();
        let text = selection.toString().trim();

        if (text.length > 0) {
            highlightSelection();
        } else {
            highlightElement(target);
        }
    }

    function highlightSelection() {
        const selection = window.getSelection();
        if (selection.rangeCount === 0) return;

        const range = selection.getRangeAt(0);
        if (range.collapsed) return;

        const wrapper = document.createElement('span');
        wrapper.style.backgroundColor = config.highlightColor;
        wrapper.style.opacity = config.highlightOpacity;
        wrapper.style.borderRadius = '2px';
        wrapper.style.padding = '0 2px';

        try {
            range.surroundContents(wrapper);
            highlightedElements.push({
                element: wrapper,
                originalHTML: wrapper.innerHTML
            });
        } catch (e) {
            const contents = range.extractContents();
            wrapper.appendChild(contents);
            range.insertNode(wrapper);
            highlightedElements.push({
                element: wrapper,
                originalHTML: wrapper.innerHTML
            });
        }

        selection.removeAllRanges();
    }

    function highlightElement(element) {
        if (element.closest('#web-text-styler-panel') ||
            element.closest('#wts-float-btn') ||
            element.closest('#wts-highlight-indicator')) {
            return;
        }

        const originalStyle = {
            backgroundColor: element.style.backgroundColor,
            opacity: element.style.opacity
        };

        element.style.backgroundColor = config.highlightColor;
        element.style.opacity = config.highlightOpacity;

        highlightedElements.push({
            element: element,
            originalStyle: originalStyle
        });
    }

    function clearAllHighlights() {
        highlightedElements.forEach((item) => {
            if (item.originalHTML) {
                try {
                    const parent = item.element.parentNode;
                    if (parent) {
                        const fragment = document.createRange().createContextualFragment(item.originalHTML);
                        parent.replaceChild(fragment, item.element);
                    }
                } catch (e) {
                    console.error('Error removing highlight:', e);
                }
            } else if (item.originalStyle) {
                try {
                    item.element.style.backgroundColor = item.originalStyle.backgroundColor;
                    item.element.style.opacity = item.originalStyle.opacity;
                } catch (e) {
                    console.error('Error removing highlight:', e);
                }
            }
        });

        highlightedElements = [];
    }

    function toggleControlPanel(show = null) {
        const panel = document.getElementById('web-text-styler-panel');
        if (!panel) return;

        if (show === null) {
            isControlPanelVisible = !isControlPanelVisible;
        } else {
            isControlPanelVisible = show;
        }

        if (isControlPanelVisible) {
            panel.classList.remove('web-text-styler-hidden');
        } else {
            panel.classList.add('web-text-styler-hidden');
        }
    }

    function createFloatButton() {
        if (document.getElementById('wts-float-btn')) {
            return;
        }

        const btn = document.createElement('button');
        btn.id = 'wts-float-btn';
        btn.innerHTML = 'Aa';
        btn.title = 'Web Text Styler';
        btn.addEventListener('click', () => {
            toggleControlPanel();
        });

        document.body.appendChild(btn);
    }

    function applyInlineStyles() {
        if (!config.enableCustomBg) return;

        const textColor = config.darkMode ? config.darkTextColor : config.textColor;
        const bgColor = config.darkMode ? config.darkBgColor : config.bgColor;
        const contentBgColor = config.darkMode ? config.darkContentBgColor : config.contentBgColor;
        const linkColor = config.darkMode ? config.darkLinkColor : config.linkColor;

        function shouldModifyElement(element) {
            if (!element) return false;
            if (element.id && (element.id.includes('wts-') || element.id.startsWith('wts-'))) return false;
            if (element.className && typeof element.className === 'string' && element.className.includes('wts-')) return false;

            const parentPanel = element.closest && element.closest('#web-text-styler-panel');
            const parentFloatBtn = element.closest && element.closest('#wts-float-btn');
            const parentIndicator = element.closest && element.closest('#wts-highlight-indicator');

            if (parentPanel || parentFloatBtn || parentIndicator) return false;

            return true;
        }

        function applyToElement(element) {
            if (!shouldModifyElement(element)) return;

            const tagName = element.tagName ? element.tagName.toLowerCase() : '';
            const classList = element.className ? (typeof element.className === 'string' ? element.className : '') : '';
            const id = element.id || '';

            const isBackgroundElement =
                tagName === 'html' ||
                tagName === 'body' ||
                id.includes('container') ||
                id.includes('wrapper') ||
                id.includes('page') ||
                id.includes('site') ||
                id.includes('body') ||
                id.includes('app') ||
                id.includes('root') ||
                classList.includes('container') ||
                classList.includes('wrapper') ||
                classList.includes('page') ||
                classList.includes('site') ||
                classList.includes('body-wrapper') ||
                classList.includes('app') ||
                classList.includes('root') ||
                classList.includes('mt-entry');

            const isContentElement =
                tagName === 'main' ||
                tagName === 'article' ||
                tagName === 'section' ||
                tagName === 'header' ||
                tagName === 'footer' ||
                tagName === 'nav' ||
                tagName === 'aside' ||
                id.includes('content') ||
                id.includes('article') ||
                id.includes('post') ||
                id.includes('entry') ||
                id.includes('body') ||
                id.includes('main') ||
                id.includes('header') ||
                id.includes('footer') ||
                classList.includes('content') ||
                classList.includes('article') ||
                classList.includes('post') ||
                classList.includes('entry') ||
                classList.includes('body') ||
                classList.includes('main') ||
                classList.includes('card') ||
                classList.includes('panel') ||
                classList.includes('box') ||
                classList.includes('widget');

            const isTextElement =
                tagName === 'p' ||
                tagName === 'span' ||
                tagName === 'div' ||
                tagName === 'li' ||
                tagName === 'td' ||
                tagName === 'th' ||
                tagName === 'h1' ||
                tagName === 'h2' ||
                tagName === 'h3' ||
                tagName === 'h4' ||
                tagName === 'h5' ||
                tagName === 'h6' ||
                tagName === 'blockquote' ||
                tagName === 'pre' ||
                tagName === 'code' ||
                tagName === 'label' ||
                tagName === 'legend' ||
                tagName === 'caption' ||
                tagName === 'small' ||
                tagName === 'em' ||
                tagName === 'strong' ||
                tagName === 'b' ||
                tagName === 'i';

            const isLinkElement =
                tagName === 'a';

            try {
                if (isBackgroundElement) {
                    element.style.setProperty('background-color', bgColor, 'important');
                }

                if (isContentElement) {
                    element.style.setProperty('background-color', contentBgColor, 'important');
                }

                if (isTextElement) {
                    element.style.setProperty('color', textColor, 'important');
                }

                if (isLinkElement) {
                    element.style.setProperty('color', linkColor, 'important');
                }

                if (tagName === 'html' || tagName === 'body') {
                    element.style.setProperty('background-color', bgColor, 'important');
                }
            } catch (e) {
            }
        }

        function walkDOM(element) {
            if (!element) return;

            applyToElement(element);

            let child = element.firstChild;
            while (child) {
                if (child.nodeType === Node.ELEMENT_NODE) {
                    walkDOM(child);
                }
                child = child.nextSibling;
            }
        }

        walkDOM(document.documentElement);
    }

    let styleObserver = null;

    function startStyleObserver() {
        if (styleObserver) {
            styleObserver.disconnect();
        }

        styleObserver = new MutationObserver((mutations) => {
            let shouldReapply = false;

            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes') {
                    if (mutation.attributeName === 'style' ||
                        mutation.attributeName === 'class' ||
                        mutation.attributeName === 'id') {
                        shouldReapply = true;
                    }
                }

                if (mutation.type === 'childList') {
                    shouldReapply = true;
                }
            });

            if (shouldReapply && config.enableCustomBg) {
                setTimeout(() => {
                    applyInlineStyles();
                }, 50);
            }
        });

        styleObserver.observe(document.documentElement, {
            attributes: true,
            childList: true,
            subtree: true,
            attributeFilter: ['style', 'class', 'id']
        });
    }

    function init() {
        loadConfig();
        createControlPanel();
        createFloatButton();
        applyTextStyles();
        applySimplifyPage();

        GM_registerMenuCommand('打开/关闭控制面板', () => {
            toggleControlPanel();
        });

        GM_registerMenuCommand('切换高亮模式', () => {
            toggleHighlightMode();
        });

        GM_registerMenuCommand('切换暗色模式', () => {
            config.darkMode = !config.darkMode;
            applyTextStyles();
            saveConfig();
            updatePanelFromConfig();
        });

        GM_addValueChangeListener('webTextStylerConfig', (name, oldValue, newValue, remote) => {
            if (remote && newValue) {
                config = Object.assign({}, defaultConfig, JSON.parse(newValue));
                updatePanelFromConfig();
                applyTextStyles();
                applySimplifyPage();
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
