// ==UserScript==
// @name         Web Text Styler
// @namespace    http://tampermonkey.net/
// @version      2.0.0
// @description  专业网页文本样式美化工具，基于专业排版规则，提供多级标题、行宽控制、段间距、亮暗模式等功能
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

    // 默认配置 - 基于专业排版规则
    const defaultConfig = {
        // 正文字体设置 (规则1: 22pt ≈ 29px，考虑屏幕显示使用px)
        fontSize: 22,
        lineHeight: 1.5,
        letterSpacing: 0.5,
        wordSpacing: 1,
        fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", "Liberation Sans", sans-serif',

        // 标题层级配置 (规则2-5)
        h1Scale: 1.9,
        h2Scale: 1.5,
        h3Scale: 1.25,
        h4Scale: 1.15,
        smallScale: 0.75,

        // 段间距设置 (规则6)
        paragraphMargin: 1.0,
        paragraphSpacing: 0.5,

        // 行宽控制 (规则8: 行文本字数)
        lineWidthMode: 'chars',
        lineWidthChars: 32,
        lineWidthPx: 700,
        maxLineWidthPx: 800,

        // 颜色设置
        textColor: '#333333',
        bgColor: '#ffffff',
        highlightColor: '#fff3cd',
        highlightOpacity: 0.8,
        darkMode: false,
        darkTextColor: '#e0e0e0',
        darkBgColor: '#1a1a1a',

        // 页面简化
        simplifyPage: false,

        // 单位配置
        usePt: false
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
                <!-- 正文字体设置 -->
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

                <!-- 标题层级设置 -->
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

                <!-- 段落间距设置 -->
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

                <!-- 行宽设置 -->
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
                        <input type="range" id="wts-line-width-chars" min="20" max="60" value="${config.lineWidthChars}" step="1">
                    </div>
                    <div class="wts-control" id="wts-line-width-px-control" style="display:none;">
                        <label for="wts-line-width-px">行宽(px): <span id="wts-line-width-px-value">${config.lineWidthPx}px</span></label>
                        <input type="range" id="wts-line-width-px" min="400" max="1000" value="${config.lineWidthPx}" step="10">
                    </div>
                    <div class="wts-control">
                        <label for="wts-max-line-width-px">最大行宽: <span id="wts-max-line-width-px-value">${config.maxLineWidthPx}px</span></label>
                        <input type="range" id="wts-max-line-width-px" min="500" max="1200" value="${config.maxLineWidthPx}" step="50">
                    </div>
                </div>

                <!-- 高亮设置 -->
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

                <!-- 亮暗模式 -->
                <div class="wts-section">
                    <h4>显示模式</h4>
                    <div class="wts-control wts-toggle">
                        <label>
                            <input type="checkbox" id="wts-dark-mode" ${config.darkMode ? 'checked' : ''}>
                            <span>暗色模式</span>
                        </label>
                    </div>
                    <div class="wts-control">
                        <label for="wts-light-text-color">浅色模式 - 文字颜色:</label>
                        <input type="color" id="wts-light-text-color" value="${config.textColor}">
                    </div>
                    <div class="wts-control">
                        <label for="wts-light-bg-color">浅色模式 - 背景颜色:</label>
                        <input type="color" id="wts-light-bg-color" value="${config.bgColor}">
                    </div>
                    <div class="wts-control">
                        <label for="wts-dark-text-color">暗色模式 - 文字颜色:</label>
                        <input type="color" id="wts-dark-text-color" value="${config.darkTextColor}">
                    </div>
                    <div class="wts-control">
                        <label for="wts-dark-bg-color">暗色模式 - 背景颜色:</label>
                        <input type="color" id="wts-dark-bg-color" value="${config.darkBgColor}">
                    </div>
                </div>

                <!-- 页面简化 -->
                <div class="wts-section">
                    <h4>页面简化</h4>
                    <div class="wts-control wts-toggle">
                        <label>
                            <input type="checkbox" id="wts-simplify-page" ${config.simplifyPage ? 'checked' : ''}>
                            <span>简化页面（隐藏广告和无关元素）</span>
                        </label>
                    </div>
                </div>

                <!-- 重置按钮 -->
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
                width: 340px;
                max-height: 90vh;
                background: #fff;
                border-radius: 8px;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
                z-index: 999999;
                font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
                font-size: 14px;
                color: #333;
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
                background: #f8f9fa;
                border-radius: 8px 8px 0 0;
            }

            #web-text-styler-panel .wts-header h3 {
                margin: 0;
                font-size: 16px;
                font-weight: 600;
            }

            #web-text-styler-panel .wts-close-btn {
                background: none;
                border: none;
                font-size: 24px;
                cursor: pointer;
                color: #666;
                padding: 0;
                line-height: 1;
            }

            #web-text-styler-panel .wts-close-btn:hover {
                color: #333;
            }

            #web-text-styler-panel .wts-content {
                padding: 16px;
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
                color: #444;
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
                color: #555;
            }

            #web-text-styler-panel .wts-control input[type="range"] {
                width: 100%;
                height: 4px;
                border-radius: 2px;
                background: #e0e0e0;
                outline: none;
                -webkit-appearance: none;
            }

            #web-text-styler-panel .wts-control input[type="range"]::-webkit-slider-thumb {
                -webkit-appearance: none;
                appearance: none;
                width: 16px;
                height: 16px;
                border-radius: 50%;
                background: #4a90d9;
                cursor: pointer;
            }

            #web-text-styler-panel .wts-control input[type="range"]::-moz-range-thumb {
                width: 16px;
                height: 16px;
                border-radius: 50%;
                background: #4a90d9;
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
            }

            #web-text-styler-panel .wts-radio input {
                margin-right: 4px;
            }

            #web-text-styler-panel .wts-btn {
                width: 100%;
                padding: 8px 16px;
                background: #4a90d9;
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-size: 13px;
                margin-bottom: 8px;
                transition: background 0.2s;
            }

            #web-text-styler-panel .wts-btn:hover {
                background: #3a7bc8;
            }

            #web-text-styler-panel .wts-btn:last-child {
                margin-bottom: 0;
            }

            #web-text-styler-panel .wts-btn-secondary {
                background: #6c757d;
            }

            #web-text-styler-panel .wts-btn-secondary:hover {
                background: #5a6268;
            }

            #web-text-styler-panel .wts-btn-danger {
                background: #dc3545;
            }

            #web-text-styler-panel .wts-btn-danger:hover {
                background: #c82333;
            }

            #web-text-styler-panel .wts-toggle label {
                display: flex;
                align-items: center;
                cursor: pointer;
                margin-bottom: 0;
            }

            #web-text-styler-panel .wts-toggle input[type="checkbox"] {
                margin-right: 8px;
            }

            #wts-highlight-indicator {
                position: fixed;
                top: 20px;
                right: 20px;
                background: #fff3cd;
                color: #856404;
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
                background: #4a90d9;
                color: white;
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
                background: #3a7bc8;
                transform: scale(1.1);
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

        const darkModeCheckbox = document.getElementById('wts-dark-mode');
        darkModeCheckbox.addEventListener('change', (e) => {
            config.darkMode = e.target.checked;
            applyDarkMode();
            saveConfig();
        });

        document.getElementById('wts-light-text-color').addEventListener('change', (e) => {
            config.textColor = e.target.value;
            if (!config.darkMode) {
                applyDarkMode();
            }
            saveConfig();
        });

        document.getElementById('wts-light-bg-color').addEventListener('change', (e) => {
            config.bgColor = e.target.value;
            if (!config.darkMode) {
                applyDarkMode();
            }
            saveConfig();
        });

        document.getElementById('wts-dark-text-color').addEventListener('change', (e) => {
            config.darkTextColor = e.target.value;
            if (config.darkMode) {
                applyDarkMode();
            }
            saveConfig();
        });

        document.getElementById('wts-dark-bg-color').addEventListener('change', (e) => {
            config.darkBgColor = e.target.value;
            if (config.darkMode) {
                applyDarkMode();
            }
            saveConfig();
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
            applyDarkMode();
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

        document.getElementById('wts-highlight-color').value = config.highlightColor;

        document.getElementById('wts-highlight-opacity').value = config.highlightOpacity;
        document.getElementById('wts-highlight-opacity-value').textContent = `${Math.round(config.highlightOpacity * 100)}%`;

        document.getElementById('wts-dark-mode').checked = config.darkMode;
        document.getElementById('wts-light-text-color').value = config.textColor;
        document.getElementById('wts-light-bg-color').value = config.bgColor;
        document.getElementById('wts-dark-text-color').value = config.darkTextColor;
        document.getElementById('wts-dark-bg-color').value = config.darkBgColor;

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

        const style = document.createElement('style');
        style.id = 'wts-text-styles';

        let styleContent = `
            body, p, li, span, div, article, section, main, aside, aside, td, th {
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
            .note, .comment, .caption, figcaption, footer {
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
                .container, .main-content, #content, #main {
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

        style.textContent = styleContent;
        document.head.appendChild(style);
    }

    function applyDarkMode() {
        const oldStyle = document.getElementById('wts-dark-mode-styles');
        if (oldStyle) {
            oldStyle.remove();
        }

        if (config.darkMode) {
            const style = document.createElement('style');
            style.id = 'wts-dark-mode-styles';
            style.textContent = `
                html, body, #root, .container, .main, .content, article, section,
                main, .entry-content, .post-content, .article-content {
                    background-color: ${config.darkBgColor} !important;
                    color: ${config.darkTextColor} !important;
                }

                a {
                    color: #64b5f6 !important;
                }

                a:hover {
                    color: #90caf9 !important;
                }

                pre, code, .code, .code-block {
                    background-color: #2d2d2d !important;
                    color: #f8f8f2 !important;
                }

                div, article, section, header, footer, nav, aside {
                    border-color: #444 !important;
                }

                input, textarea, select {
                    background-color: #333 !important;
                    color: ${config.darkTextColor} !important;
                    border-color: #555 !important;
                }

                button:not(#wts-float-btn):not(.wts-btn) {
                    background-color: #444 !important;
                    color: ${config.darkTextColor} !important;
                    border-color: #555 !important;
                }

                hr {
                    border-color: #444 !important;
                    background-color: #444 !important;
                }

                table {
                    border-color: #444 !important;
                }

                th, td {
                    border-color: #444 !important;
                }

                blockquote {
                    border-left-color: #555 !important;
                }

                #web-text-styler-panel, #wts-float-btn, #wts-highlight-indicator {
                    background-color: #fff !important;
                    color: #333 !important;
                }
            `;
            document.head.appendChild(style);
        } else {
            const style = document.createElement('style');
            style.id = 'wts-dark-mode-styles';
            style.textContent = `
                html, body, #root, .container, .main, .content, article, section {
                    background-color: ${config.bgColor} !important;
                    color: ${config.textColor} !important;
                }

                #web-text-styler-panel, #wts-float-btn, #wts-highlight-indicator {
                    background-color: #fff !important;
                    color: #333 !important;
                }
            `;
            document.head.appendChild(style);
        }
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
                [class*="promo"], [id*="promo"] {
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

    function init() {
        loadConfig();
        createControlPanel();
        createFloatButton();
        applyTextStyles();
        applyDarkMode();
        applySimplifyPage();

        GM_registerMenuCommand('打开/关闭控制面板', () => {
            toggleControlPanel();
        });

        GM_registerMenuCommand('切换高亮模式', () => {
            toggleHighlightMode();
        });

        GM_registerMenuCommand('切换暗色模式', () => {
            config.darkMode = !config.darkMode;
            applyDarkMode();
            saveConfig();
            updatePanelFromConfig();
        });

        GM_addValueChangeListener('webTextStylerConfig', (name, oldValue, newValue, remote) => {
            if (remote && newValue) {
                config = Object.assign({}, defaultConfig, JSON.parse(newValue));
                updatePanelFromConfig();
                applyTextStyles();
                applyDarkMode();
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
