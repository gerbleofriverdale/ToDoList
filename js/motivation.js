/**
 * MotivationalEngine - Provides congratulatory & encouraging celebrations,
 * motivational quotes on pause/completion, and canvas confetti particle burst.
 */
class MotivationalEngine {
  constructor(canvasElement) {
    this.canvas = canvasElement;
    this.ctx = canvasElement ? canvasElement.getContext('2d') : null;
    this.particles = [];
    this.animationId = null;

    if (this.canvas) {
      this.resizeCanvas();
      window.addEventListener('resize', () => this.resizeCanvas());
    }

    this.completionQuotes = [
      { text: "Phenomenal work! Every task completed is a step closer to mastery.", author: "FocusFlow" },
      { text: "Boom! Another objective crushed. Keep this incredible momentum going!", author: "FocusFlow" },
      { text: "Success is the sum of small efforts, repeated day in and day out.", author: "Robert Collier" },
      { text: "Discipline equals freedom. You set a goal and delivered on it!", author: "Jocko Willink" },
      { text: "Done is better than perfect, and you nailed it! High five! 🙌", author: "FocusFlow" },
      { text: "The secret of getting ahead is getting started, and you just finished!", author: "Mark Twain" },
      { text: "Great things are done by a series of small things brought together.", author: "Vincent Van Gogh" },
      { text: "Energy and persistence conquer all obstacles. Proud of your progress!", author: "Benjamin Franklin" },
      { text: "One more win in the books! Your future self is thanking you right now.", author: "FocusFlow" }
    ];

    this.pauseQuotes = [
      { text: "Rest is not idleness. Take a breather, hydrate, and return sharper! 💧", author: "FocusFlow" },
      { text: "Even champion race cars need pit stops. Rejuvenate and recharge your focus.", author: "FocusFlow" },
      { text: "Pacing yourself is the secret to deep productivity. Great focus so far!", author: "FocusFlow" },
      { text: "Take a deep breath and stretch. A clear mind solves challenges twice as fast.", author: "FocusFlow" },
      { text: "Pausing allows clarity to catch up with execution. Step back with a smile.", author: "FocusFlow" },
      { text: "Strategic pauses keep burnout away. Rest well, you're doing great!", author: "FocusFlow" }
    ];
  }

  resizeCanvas() {
    if (!this.canvas) return;
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  getRandomCompletionQuote() {
    const idx = Math.floor(Math.random() * this.completionQuotes.length);
    return this.completionQuotes[idx];
  }

  getRandomPauseQuote() {
    const idx = Math.floor(Math.random() * this.pauseQuotes.length);
    return this.pauseQuotes[idx];
  }

  /**
   * Spawns a multi-burst confetti celebration.
   */
  launchConfetti() {
    if (!this.canvas || !this.ctx) return;

    this.resizeCanvas();
    const colors = ['#6366f1', '#06b6d4', '#10b981', '#f59e0b', '#f43f5e', '#a855f7', '#ec4899'];
    const particleCount = 120;

    // Center burst coordinates
    const originX = this.canvas.width / 2;
    const originY = this.canvas.height * 0.4;

    for (let i = 0; i < particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 12 + 6;
      this.particles.push({
        x: originX,
        y: originY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 4, // initial upward lift
        size: Math.random() * 8 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 12,
        life: 1,
        decay: Math.random() * 0.015 + 0.008,
        shape: Math.random() > 0.4 ? 'rect' : 'circle'
      });
    }

    if (!this.animationId) {
      this.animate();
    }
  }

  animate() {
    if (!this.ctx) return;

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];

      // Physics
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.35; // Gravity
      p.vx *= 0.98; // Drag
      p.rotation += p.rotationSpeed;
      p.life -= p.decay;

      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      this.ctx.save();
      this.ctx.translate(p.x, p.y);
      this.ctx.rotate((p.rotation * Math.PI) / 180);
      this.ctx.globalAlpha = p.life;
      this.ctx.fillStyle = p.color;

      if (p.shape === 'rect') {
        this.ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      } else {
        this.ctx.beginPath();
        this.ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
        this.ctx.fill();
      }

      this.ctx.restore();
    }

    if (this.particles.length > 0) {
      this.animationId = requestAnimationFrame(() => this.animate());
    } else {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.animationId = null;
    }
  }
}
