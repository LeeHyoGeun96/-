const ColorSymbolConverter = {
  config: {
    levels: {
      10: { count: 10, width: 3 },
      20: { count: 20, width: 6 },
      40: { count: 40, width: 12 },
    },
    currentLevel: 20,
  },

  init() {
    chrome.storage.sync.get("pixelSize", ({ pixelSize }) => {
      this.config.currentLevel = parseInt(pixelSize) || 20;
    });

    this.processImages();
    this.setupEventListeners();
  },

  processImages() {
    const images = document.querySelectorAll("img:not([data-processed])");

    images.forEach((img) => {
      if (img.dataset.processed) return;

      // 버튼과 캔버스만 추가하고, 변환은 하지 않음
      this.setupImageConverter(img);
    });
  },

  setupImageConverter(img) {
    if (img.dataset.processed) return;

    const wrapper = document.createElement("div");
    wrapper.style.cssText = `
      position: relative;
      display: inline-block;
    `;

    let parentLink = img.closest("a");
    if (parentLink) {
      parentLink.style.position = "relative";
      parentLink.style.display = "inline-block";
      img.parentNode.insertBefore(wrapper, img);
      wrapper.appendChild(img);
    } else {
      img.parentNode.insertBefore(wrapper, img);
      wrapper.appendChild(img);
    }

    img.style.display = "block";

    const canvas = document.createElement("canvas");
    const bound = img.getBoundingClientRect();
    canvas.width = bound.width;
    canvas.height = bound.height;
    canvas.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 2;
      display: none;
    `;

    const button = this.createButton(wrapper, canvas, img);

    wrapper.appendChild(canvas);
    wrapper.appendChild(button);

    img.dataset.processed = "true";
  },

  createButton(wrapper, canvas, img) {
    const button = document.createElement("button");
    button.style.cssText = `
      position: absolute;
      top: 10px;
      left: 10px;
      width: 30px;
      height: 30px;
      border: 1px solid rgba(0,0,0,0.2);
      background: rgba(255,255,255,0.8);
      border-radius: 50%;
      cursor: pointer;
      z-index: 999999;
      display: block;
      transition: background-color 0.3s;
    `;

    button.addEventListener("mouseover", () => {
      button.style.backgroundColor = "rgba(255,255,255,1)";
    });

    button.addEventListener("mouseout", () => {
      button.style.backgroundColor = "rgba(255,255,255,0.8)";
    });

    const self = this;
    button.addEventListener("click", function (e) {
      e.stopPropagation();
      e.preventDefault();

      if (!img.complete || !img.crossOrigin) {
        img.crossOrigin = "anonymous";
        img.addEventListener(
          "load",
          () => {
            self.toggleSymbols(canvas, img);
          },
          { once: true }
        );
        img.src = img.src;
        return;
      }

      self.toggleSymbols(canvas, img);
    });

    return button;
  },

  toggleSymbols(canvas, img) {
    const isVisible = canvas.style.display === "block";
    canvas.style.display = isVisible ? "none" : "block";

    if (!isVisible) {
      try {
        this.drawSymbols(img, canvas);
      } catch (error) {
        console.error("Failed to draw symbols:", error);
        if (error.name === "SecurityError") {
          img.crossOrigin = "anonymous";
          img.addEventListener(
            "load",
            () => {
              this.drawSymbols(img, canvas);
            },
            { once: true }
          );
          img.src = img.src;
        }
      }
    }
  },

  drawSymbols(img, canvas) {
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const pixelSize = this.config.currentLevel;
    const level = this.config.levels[pixelSize];

    if (!level) return;

    try {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (let x = 0; x < canvas.width; x += level.count) {
        for (let y = 0; y < canvas.height; y += level.count) {
          const color = this.getAverageColor(imageData, x, y, level.count);
          const { h, s, l } = this.rgbToHsl(color.r, color.g, color.b);
          const symbol = this.matchColor(h, s);
          if (symbol) {
            // 어두운 배경(l < 50)에서는 흰색, 밝은 배경에서는 검은색 사용
            ctx.strokeStyle = l < 50 ? "white" : "black";
            this.drawColor(ctx, symbol, x, y, level);
          }
        }
      }
    } catch (error) {
      console.error("Error in drawSymbols:", error);
      throw error;
    }
  },

  getAverageColor(imageData, x, y, size) {
    let r = 0,
      g = 0,
      b = 0,
      count = 0;

    for (let i = x; i < x + size && i < imageData.width; i++) {
      for (let j = y; j < y + size && j < imageData.height; j++) {
        const index = (j * imageData.width + i) * 4;
        r += imageData.data[index];
        g += imageData.data[index + 1];
        b += imageData.data[index + 2];
        count++;
      }
    }

    return {
      r: Math.round(r / count),
      g: Math.round(g / count),
      b: Math.round(b / count),
    };
  },

  rgbToHsl(r, g, b) {
    r /= 255;
    g /= 255;
    b /= 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h,
      s,
      l = (max + min) / 2;

    if (max === min) {
      h = s = 0;
    } else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

      switch (max) {
        case r:
          h = (g - b) / d + (g < b ? 6 : 0);
          break;
        case g:
          h = (b - r) / d + 2;
          break;
        case b:
          h = (r - g) / d + 4;
          break;
      }
      h /= 6;
    }

    return {
      h: Math.round(h * 360),
      s: Math.round(s * 100),
      l: Math.round(l * 100),
    };
  },

  matchColor(h, s) {
    if (s < 5) return null;

    if (h <= 18) return "R";
    if (h <= 54) return "YR";
    if (h <= 90) return "Y";
    if (h <= 126) return "GY";
    if (h <= 162) return "G";
    if (h <= 198) return "BG";
    if (h <= 234) return "B";
    if (h <= 270) return "PB";
    if (h <= 306) return "P";
    if (h <= 342) return "RP";
    return "R";
  },

  drawColor(ctx, color, x, y, level) {
    const center = level.count / 2;
    ctx.save();
    ctx.translate(x + center, y + center);
    ctx.lineWidth = 1;
    ctx.beginPath();

    switch (color) {
      case "R":
        ctx.moveTo(0, -level.width);
        ctx.lineTo(-level.width, level.width);
        ctx.lineTo(level.width, level.width);
        ctx.closePath();
        break;
      case "YR":
        ctx.moveTo(-level.width, -level.width);
        ctx.lineTo(level.width, -level.width);
        ctx.lineTo(0, level.width);
        ctx.closePath();
        break;
      case "Y":
        ctx.moveTo(0, -level.width);
        ctx.lineTo(0, 0);
        ctx.moveTo(-level.width, level.width);
        ctx.lineTo(0, 0);
        ctx.lineTo(level.width, level.width);
        break;
      case "GY":
        ctx.moveTo(0, -level.width);
        ctx.lineTo(0, level.width);
        ctx.moveTo(-level.width, 0);
        ctx.lineTo(level.width, 0);
        break;
      case "G":
        ctx.rect(-level.width, -level.width, level.width * 2, level.width * 2);
        break;
      case "BG":
        ctx.moveTo(-level.width, -level.width);
        ctx.lineTo(level.width, level.width);
        ctx.moveTo(-level.width, level.width);
        ctx.lineTo(level.width, -level.width);
        break;
      case "B":
        ctx.arc(0, 0, level.width, 0, Math.PI * 2);
        break;
      case "PB":
        ctx.arc(0, 0, level.width, 0, Math.PI * 2);
        ctx.moveTo(level.width - 3, 0);
        ctx.arc(0, 0, level.width - 3, 0, Math.PI * 2);
        break;
      case "P":
        for (let i = 0; i < 5; i++) {
          const angle = (i * 72 * Math.PI) / 180;
          const x = level.width * Math.cos(angle);
          const y = level.width * Math.sin(angle);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        break;
      case "RP":
        for (let i = 0; i < 8; i++) {
          const angle = (i * 45 * Math.PI) / 180;
          const x = level.width * Math.cos(angle);
          const y = level.width * Math.sin(angle);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        break;
    }
    ctx.stroke();
    ctx.restore();
  },

  setupEventListeners() {
    document.addEventListener("DOMContentLoaded", () => this.processImages());
    window.addEventListener("load", () => this.processImages());

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === "PIXEL_SIZE_CHANGED") {
        const newSize = parseInt(message.pixelSize);
        if (this.config.levels[newSize]) {
          this.config.currentLevel = newSize;
          document.querySelectorAll("canvas").forEach((canvas) => {
            const img = canvas.previousElementSibling;
            if (
              img &&
              img.tagName === "IMG" &&
              canvas.style.display === "block"
            ) {
              this.drawSymbols(img, canvas);
            }
          });
        }
      }
    });

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === 1) {
            const images = node.getElementsByTagName("img");
            if (images.length > 0 || node.nodeName === "IMG") {
              this.processImages();
            }
          }
        });
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  },
};

ColorSymbolConverter.init();
