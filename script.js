const SLOTS = 5;

class Cropper {
  constructor(canvas, controls) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.controls = controls;

    this.image = null;
    this.scale = 1;
    this.minScale = 0.5;
    this.maxScale = 3;
    this.offsetX = 0;
    this.offsetY = 0;

    this.dragging = false;
    this.lastX = 0;
    this.lastY = 0;

    this._bindEvents();
    this._resizeCanvas();
    window.addEventListener('resize', () => this._resizeCanvas());
  }

  _bindEvents() {
    const zoomInput = this.controls.querySelector('.zoom');
    zoomInput.addEventListener('input', (e) => {
      this.scale = Math.min(this.maxScale, Math.max(this.minScale, parseFloat(e.target.value)));
      this.render();
    });
    this.controls.querySelector('.reset').addEventListener('click', () => this.resetView());

    // Mouse events
    this.canvas.addEventListener('mousedown', (e) => this._startDrag(e.clientX, e.clientY));
    window.addEventListener('mousemove', (e) => this._drag(e.clientX, e.clientY));
    window.addEventListener('mouseup', () => this._endDrag());

    // Touch events
    this.canvas.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        const t = e.touches[0];
        this._startDrag(t.clientX, t.clientY);
      }
    }, { passive: true });
    this.canvas.addEventListener('touchmove', (e) => {
      if (e.touches.length === 1) {
        const t = e.touches[0];
        this._drag(t.clientX, t.clientY);
      }
    }, { passive: true });
    this.canvas.addEventListener('touchend', () => this._endDrag());

    // Wheel zoom (desktop)
    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const delta = -e.deltaY;
      const zoomFactor = delta > 0 ? 1.05 : 0.95;
      const newScale = Math.min(this.maxScale, Math.max(this.minScale, this.scale * zoomFactor));
      this.scale = newScale;
      this.controls.querySelector('.zoom').value = String(this.scale);
      this.render();
    }, { passive: false });
  }

  _startDrag(x, y) {
    if (!this.image) return;
    this.dragging = true;
    this.lastX = x;
    this.lastY = y;
  }
  _drag(x, y) {
    if (!this.dragging) return;
    const dx = x - this.lastX;
    const dy = y - this.lastY;
    this.offsetX += dx;
    this.offsetY += dy;
    this.lastX = x;
    this.lastY = y;
    this.render();
  }
  _endDrag() { this.dragging = false; }

  _resizeCanvas() {
    const rect = this.canvas.getBoundingClientRect();
    const size = Math.floor(Math.min(1024, rect.width));
    this.canvas.width = size;
    this.canvas.height = size;
    this.render();
  }

  loadImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          this.image = img;
          // Fit image into square: set initial scale to cover
          const scaleX = this.canvas.width / img.width;
          const scaleY = this.canvas.height / img.height;
          this.scale = Math.max(scaleX, scaleY);
          this.minScale = this.scale * 0.5;
          this.maxScale = this.scale * 6;
          // center
          this.offsetX = (this.canvas.width - img.width * this.scale) / 2;
          this.offsetY = (this.canvas.height - img.height * this.scale) / 2;
          this.controls.classList.remove('hidden');
          const zoom = this.controls.querySelector('.zoom');
          zoom.min = String(this.minScale);
          zoom.max = String(this.maxScale);
          zoom.value = String(this.scale);
          this.render();
          resolve();
        };
        img.onerror = reject;
        img.src = String(reader.result);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  resetView() {
    if (!this.image) return;
    const scaleX = this.canvas.width / this.image.width;
    const scaleY = this.canvas.height / this.image.height;
    this.scale = Math.max(scaleX, scaleY);
    this.offsetX = (this.canvas.width - this.image.width * this.scale) / 2;
    this.offsetY = (this.canvas.height - this.image.height * this.scale) / 2;
    const zoom = this.controls.querySelector('.zoom');
    zoom.value = String(this.scale);
    this.render();
  }

  render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    if (!this.image) return;
    ctx.save();
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(
      this.image,
      0,
      0,
      this.image.width,
      this.image.height,
      Math.round(this.offsetX),
      Math.round(this.offsetY),
      Math.round(this.image.width * this.scale),
      Math.round(this.image.height * this.scale)
    );
    ctx.restore();
  }

  toDataURL() {
    return this.canvas.toDataURL('image/png');
  }
}

function setup() {
  const slots = Array.from(document.querySelectorAll('.slot'));
  const croppers = [];

  slots.forEach((slot) => {
    const canvas = slot.querySelector('canvas');
    const controls = slot.querySelector('.controls');
    const cropper = new Cropper(canvas, controls);
    croppers.push(cropper);

    const fileInput = slot.querySelector('.file');
    const placeholder = slot.querySelector('.placeholder');
    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      await cropper.loadImage(file);
      placeholder.style.display = 'none';
    });
  });

  document.getElementById('export').addEventListener('click', () => {
    const opened = window.open();
    if (!opened) return;
    opened.document.write('<html><head><title>PNG предпросмотр</title></head><body style="font-family: sans-serif; padding: 16px;">');
    croppers.forEach((c, i) => {
      const url = c.toDataURL();
      opened.document.write(`<div style="margin-bottom:12px"><div>Фото ${i+1}</div><img src="${url}" style="width:200px;height:200px;border:1px solid #eee;border-radius:6px;object-fit:contain"/></div>`);
    });
    opened.document.write('</body></html>');
    opened.document.close();
  });
}

window.addEventListener('DOMContentLoaded', setup);