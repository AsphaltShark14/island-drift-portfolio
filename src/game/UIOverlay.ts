export class UIOverlay {
  private panel: HTMLElement;
  private titleEl: HTMLElement;
  private bodyEl: HTMLElement;
  private currentId: string | null = null;

  constructor() {
    this.panel = document.getElementById("panel")!;
    this.titleEl = document.getElementById("panel-title")!;
    this.bodyEl = document.getElementById("panel-body")!;
  }

  show(id: string, title: string, html: string): void {
    if (this.currentId === id) return;
    this.currentId = id;
    this.titleEl.textContent = title;
    this.bodyEl.innerHTML = html;
    this.panel.classList.remove("hidden");
  }

  hide(): void {
    if (this.currentId === null) return;
    this.currentId = null;
    this.panel.classList.add("hidden");
  }
}
