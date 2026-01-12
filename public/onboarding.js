/**
 * Onboarding Tour Logic
 * Neo-Brutalist Style
 */

const tourSteps = [
  {
    title: "Welcome to Mio",
    content:
      "Mio Message is a high-speed, Neo-Brutalist chat app. Ready for the tour?",
    target: "#join-screen .glass-card",
    position: "center",
  },
  {
    title: "Join the Vibe",
    content:
      "Pick a username and select a room. Every room has its own unique energy.",
    target: "#join-form",
    position: "bottom",
  },
  {
    title: "Who's Online?",
    content:
      "Check this sidebar to see everyone else currently vibing in the room.",
    target: ".sidebar",
    position: "right",
    condition: () =>
      document.getElementById("join-screen").style.display === "none",
  },
  {
    title: "The Conversation",
    content:
      "Messages pop in with a fluid animation. Outgoing messages are yellow, incoming are white.",
    target: "#chat-messages",
    position: "top",
    condition: () =>
      document.getElementById("join-screen").style.display === "none",
  },
  {
    title: "Bots & Powerups",
    content:
      "Type '@' to mention bots like @PWTeacher or @Comedian. They're here to spice things up!",
    target: ".chat-input-area",
    position: "top",
    condition: () =>
      document.getElementById("join-screen").style.display === "none",
  },
];

class OnboardingTour {
  constructor() {
    this.currentStep = 0;
    if (localStorage.getItem("mio_tour_completed")) return;

    this.init();
  }

  init() {
    this.overlay = document.createElement("div");
    this.overlay.className = "tour-overlay";
    document.body.appendChild(this.overlay);

    this.highlight = document.createElement("div");
    this.highlight.className = "tour-highlight";
    document.body.appendChild(this.highlight);

    this.card = document.createElement("div");
    this.card.className = "tour-card";
    document.body.appendChild(this.card);

    this.renderStep();
  }

  renderStep() {
    const step = tourSteps[this.currentStep];

    // Check if condition is met (e.g., join screen hidden)
    if (step.condition && !step.condition()) {
      // Find first step that meets condition or wait?
      // For simplicity, if we hit a step that requires being logged in but we aren't,
      // we just pause the tour until join is successful.
      this.hide();
      return;
    }

    this.show();

    this.card.innerHTML = `
      <h4>${step.title}</h4>
      <p>${step.content}</p>
      <div class="tour-footer">
        <span class="tour-steps">${this.currentStep + 1} / ${
      tourSteps.length
    }</span>
        <div class="tour-btns">
          <button class="tour-btn skip">Skip</button>
          <button class="tour-btn next">${
            this.currentStep === tourSteps.length - 1 ? "Finish" : "Next"
          }</button>
        </div>
      </div>
    `;

    this.card.querySelector(".skip").onclick = () => this.complete();
    this.card.querySelector(".next").onclick = () => this.next();

    this.positionHighlight(step);
  }

  positionHighlight(step) {
    const el = document.querySelector(step.target);
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const padding = 10;

    this.highlight.style.width = `${rect.width + padding * 2}px`;
    this.highlight.style.height = `${rect.height + padding * 2}px`;
    this.highlight.style.top = `${rect.top - padding}px`;
    this.highlight.style.left = `${rect.left - padding}px`;

    // Position card
    const cardRect = this.card.getBoundingClientRect();
    let top, left;

    if (step.position === "center") {
      top = (window.innerHeight - cardRect.height) / 2;
      left = (window.innerWidth - cardRect.width) / 2;
    } else if (step.position === "bottom") {
      top = rect.bottom + padding + 20;
      left = rect.left + (rect.width - cardRect.width) / 2;
    } else if (step.position === "top") {
      top = rect.top - cardRect.height - padding - 20;
      left = rect.left + (rect.width - cardRect.width) / 2;
    } else if (step.position === "right") {
      top = rect.top + (rect.height - cardRect.height) / 2;
      left = rect.right + padding + 20;
    }

    // Boundary check
    left = Math.max(
      20,
      Math.min(left, window.innerWidth - cardRect.width - 20)
    );
    top = Math.max(
      20,
      Math.min(top, window.innerHeight - cardRect.height - 20)
    );

    this.card.style.top = `${top}px`;
    this.card.style.left = `${left}px`;
  }

  next() {
    this.currentStep++;
    if (this.currentStep >= tourSteps.length) {
      this.complete();
    } else {
      this.renderStep();
    }
  }

  complete() {
    localStorage.setItem("mio_tour_completed", "true");
    this.destroy();
  }

  destroy() {
    this.overlay.remove();
    this.highlight.remove();
    this.card.remove();
  }

  hide() {
    this.overlay.style.display = "none";
    this.highlight.style.display = "none";
    this.card.style.display = "none";
  }

  show() {
    this.overlay.style.display = "block";
    this.highlight.style.display = "block";
    this.card.style.display = "block";
  }
}

// Global instance to resume after join
window.mioTour = null;
document.addEventListener("DOMContentLoaded", () => {
  window.mioTour = new OnboardingTour();
});
